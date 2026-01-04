// Centralized Policies / Agreements store (Supabase-first, localStorage fallback)
//
// Policies drive:
// - Office -> Company Settings -> Policies (Agreements + Privacy Policy)
// - Service Types -> Agreement dropdown (select an existing policy)
// - Future: Reservation receipts, templates, terms, etc.
//
// IMPORTANT:
// - Uses Supabase REST endpoints if the `policies` table exists and requests succeed.
// - Falls back to localStorage when Supabase is unavailable (missing table / not signed in / RLS blocks).
//
// Storage key: relia_policies_v1

import { apiFetch } from './api-service.js';

export const POLICIES_STORAGE_KEY = 'relia_policies_v1';

function safeUuid() {
  try { return crypto.randomUUID(); } catch {
    // Fallback RFC4122-ish
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}

function isUuid(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function loadOrgIdFromIdentityWallet() {
  try {
    const raw = localStorage.getItem('relia_identity_wallet');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.organizationId || parsed?.organization_id || null;
  } catch {
    return null;
  }
}

export function normalizePolicy(input) {
  const p = { ...(input || {}) };

  if (!p.id || !isUuid(p.id)) {
    p.id = p.id && typeof p.id === 'string' && p.id.length ? p.id : safeUuid();
  }

  p.name = (p.name || '').toString().trim() || 'Untitled Policy';
  p.type = (p.type || p.policy_type || 'rental').toString().trim().toLowerCase(); // rental/privacy/terms/waiver/custom
  p.status = (p.status || (p.active === false ? 'inactive' : 'active')).toString().trim().toLowerCase();
  p.active = p.active !== undefined ? !!p.active : (p.status !== 'inactive');

  p.html = (p.html ?? p.content_html ?? '').toString();
  p.sort_order = Number.isFinite(Number(p.sort_order)) ? Number(p.sort_order) : 0;

  // optional scoping
  const orgId = p.organization_id || p.organizationId || loadOrgIdFromIdentityWallet();
  if (orgId) p.organization_id = orgId;

  return p;
}

function loadLocalPolicies({ includeInactive = true } = {}) {
  try {
    const raw = localStorage.getItem(POLICIES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const arr = Array.isArray(parsed) ? parsed : [];
    const normalized = arr.map(normalizePolicy).sort((a, b) => (a.sort_order - b.sort_order) || a.name.localeCompare(b.name));
    return includeInactive ? normalized : normalized.filter((p) => p.active);
  } catch {
    return [];
  }
}

function saveLocalPolicies(policies) {
  try {
    localStorage.setItem(POLICIES_STORAGE_KEY, JSON.stringify(Array.isArray(policies) ? policies : []));
    // Help other pages (iframes) notice the update
    window.dispatchEvent(new StorageEvent('storage', { key: POLICIES_STORAGE_KEY }));
  } catch {
    // ignore
  }
}

async function checkRemoteAvailable() {
  try {
    const res = await apiFetch('/rest/v1/policies?select=id&limit=1');
    // 404 means table doesn't exist; 401/403 means auth/RLS
    return res && (res.ok || res.status === 401 || res.status === 403);
  } catch {
    return false;
  }
}

function mapRemoteRow(row) {
  // Allow varying schemas
  return normalizePolicy({
    ...row,
    policy_type: row.type ?? row.policy_type,
    content_html: row.html ?? row.content_html
  });
}

export async function loadPolicies({ includeInactive = true, preferRemote = true } = {}) {
  const local = loadLocalPolicies({ includeInactive: true });

  if (!preferRemote) {
    return includeInactive ? local : local.filter((p) => p.active);
  }

  const ok = await checkRemoteAvailable();
  if (!ok) return includeInactive ? local : local.filter((p) => p.active);

  try {
    let url = '/rest/v1/policies?select=id,organization_id,active,status,name,type,policy_type,html,content_html,sort_order,created_at,updated_at&order=sort_order.asc,name.asc';
    if (!includeInactive) {
      url += '&active=eq.true';
    }
    const res = await apiFetch(url);
    if (!res.ok) return includeInactive ? local : local.filter((p) => p.active);
    const data = await res.json();
    const remote = Array.isArray(data) ? data.map(mapRemoteRow) : [];

    // If remote exists but empty, keep local; don't auto-seed remote to avoid surprising writes.
    return includeInactive ? remote : remote.filter((p) => p.active);
  } catch {
    return includeInactive ? local : local.filter((p) => p.active);
  }
}

export async function upsertPolicy(policy, { preferRemote = true } = {}) {
  const p = normalizePolicy(policy);
  const local = loadLocalPolicies({ includeInactive: true });

  // local upsert always
  const idx = local.findIndex((x) => x.id === p.id);
  if (idx >= 0) local[idx] = { ...local[idx], ...p };
  else local.push(p);
  saveLocalPolicies(local);

  if (!preferRemote) return p;

  const ok = await checkRemoteAvailable();
  if (!ok) return p;

  try {
    const payload = {
      id: isUuid(p.id) ? p.id : undefined,
      organization_id: p.organization_id || null,
      active: p.active,
      status: p.active ? 'active' : 'inactive',
      name: p.name,
      type: p.type,
      html: p.html,
      sort_order: p.sort_order
    };

    const res = await apiFetch('/rest/v1/policies', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=representation'
      },
      body: JSON.stringify([payload])
    });

    if (res.ok) {
      const rows = await res.json();
      const saved = Array.isArray(rows) && rows[0] ? mapRemoteRow(rows[0]) : p;
      // refresh local with canonical row
      const local2 = loadLocalPolicies({ includeInactive: true });
      const i2 = local2.findIndex((x) => x.id === saved.id);
      if (i2 >= 0) local2[i2] = saved;
      else local2.push(saved);
      saveLocalPolicies(local2);
      return saved;
    }
  } catch {
    // ignore remote failure; local already saved
  }
  return p;
}

export async function deletePolicyById(id, { preferRemote = true } = {}) {
  const local = loadLocalPolicies({ includeInactive: true }).filter((p) => p.id !== id);
  saveLocalPolicies(local);

  if (!preferRemote) return true;

  const ok = await checkRemoteAvailable();
  if (!ok) return true;

  try {
    const res = await apiFetch(`/rest/v1/policies?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
    return res.ok;
  } catch {
    return true;
  }
}

export function getActivePolicies(policies) {
  return (Array.isArray(policies) ? policies : []).filter((p) => p.active);
}
