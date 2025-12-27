// HtmlAttachmentService.js
// Tracks titles -> template filenames and per-reservation HTML attachment content.
// LocalStorage-first with graceful Supabase fallback when available.

import { getSupabaseClient, isLocalDevModeEnabled, getOrgContextOrThrow } from './api-service.js';

const TITLES_KEY = 'relia_html_attachment_titles'; // [{ title, filename }]
const ATTACH_PREFIX = 'relia_reservation_attachments_'; // per reservationId

function slugifyTitle(title) {
  return String(title)
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

function titleToFilename(title) {
  const slug = slugifyTitle(title);
  return `attachments/templates/${slug || 'untitled'}.html`;
}

export function getTrackedTitles() {
  try {
    const raw = localStorage.getItem(TITLES_KEY);
    const list = JSON.parse(raw || '[]');
    if (Array.isArray(list) && list.length) {
      return list;
    }
    // Bootstrap sensible defaults when none exist
    const defaults = [
      'Special Instructions',
      'Dispatch Notes',
      'Partner Notes',
      'Passenger Welcome',
      'Driver Notes',
      'Invoice Terms'
    ];
    const seeded = defaults.map(title => ({ title, filename: titleToFilename(title) }));
    localStorage.setItem(TITLES_KEY, JSON.stringify(seeded));
    return seeded;
  } catch {
    return [];
  }
}

export function registerTitles(titles) {
  const current = getTrackedTitles();
  const byTitle = new Map(current.map(t => [t.title, t]));
  (titles || []).forEach(title => {
    if (!title) return;
    if (!byTitle.has(title)) {
      byTitle.set(title, { title, filename: titleToFilename(title) });
    }
  });
  const merged = Array.from(byTitle.values());
  localStorage.setItem(TITLES_KEY, JSON.stringify(merged));
  return merged;
}

function getReservationBucket(reservationId) {
  const key = ATTACH_PREFIX + String(reservationId);
  try {
    return JSON.parse(localStorage.getItem(key) || '{}');
  } catch {
    return {};
  }
}

function saveReservationBucket(reservationId, data) {
  const key = ATTACH_PREFIX + String(reservationId);
  localStorage.setItem(key, JSON.stringify(data || {}));
}

export function listAttachments(reservationId) {
  const bucket = getReservationBucket(reservationId);
  const titles = Object.keys(bucket);
  return titles.map(title => ({ title, updated_at: bucket[title]?.updated_at || null }));
}

export function openAttachment(reservationId, title) {
  const bucket = getReservationBucket(reservationId);
  const entry = bucket[title];
  // If nothing saved yet, return empty string for content
  return {
    title,
    content_html: entry?.content_html || '',
    updated_at: entry?.updated_at || null
  };
}

export function saveAttachment(reservationId, title, contentHtml) {
  const bucket = getReservationBucket(reservationId);
  bucket[title] = {
    content_html: String(contentHtml ?? ''),
    updated_at: new Date().toISOString()
  };
  saveReservationBucket(reservationId, bucket);
  return { success: true, title };
}

export function deleteAttachment(reservationId, title) {
  const bucket = getReservationBucket(reservationId);
  if (bucket[title]) {
    delete bucket[title];
    saveReservationBucket(reservationId, bucket);
    return { success: true };
  }
  return { success: false, error: 'Not found' };
}

// Optional Supabase-backed persistence. If table missing/RLS blocks, we fallback to local.
async function supabaseSave(reservationId, title, contentHtml) {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Client not initialized' };
  try {
    const { organizationId, userId } = await getOrgContextOrThrow(client);
    const payload = {
      organization_id: organizationId,
      reservation_id: reservationId,
      title,
      content_html: String(contentHtml ?? ''),
      updated_by: userId,
      updated_at: new Date().toISOString()
    };
    const { data, error } = await client
      .from('reservation_attachments')
      .upsert([payload], { onConflict: 'reservation_id,title' })
      .select()
      .maybeSingle();
    if (error) throw error;
    return { success: true, data };
  } catch (e) {
    return { success: false, error: e?.message || String(e) };
  }
}

async function supabaseFetch(reservationId) {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Client not initialized', data: [] };
  try {
    const { organizationId } = await getOrgContextOrThrow(client);
    const { data, error } = await client
      .from('reservation_attachments')
      .select('title, content_html, updated_at')
      .eq('organization_id', organizationId)
      .eq('reservation_id', reservationId)
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return { success: true, data: Array.isArray(data) ? data : [] };
  } catch (e) {
    return { success: false, error: e?.message || String(e), data: [] };
  }
}

export async function persistAttachment(reservationId, title, contentHtml) {
  const useLocal = isLocalDevModeEnabled();
  if (!useLocal) {
    const result = await supabaseSave(reservationId, title, contentHtml);
    if (result.success) {
      return result;
    }
  }
  // local fallback
  return saveAttachment(reservationId, title, contentHtml);
}

export async function fetchAllForReservation(reservationId) {
  const useLocal = isLocalDevModeEnabled();
  if (!useLocal) {
    const result = await supabaseFetch(reservationId);
    if (result.success && result.data?.length) {
      return result.data;
    }
  }
  // local fallback
  const bucket = getReservationBucket(reservationId);
  return Object.keys(bucket).map(title => ({
    title,
    content_html: bucket[title]?.content_html || '',
    updated_at: bucket[title]?.updated_at || null
  }));
}
