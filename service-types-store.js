// Centralized Service Types store (Supabase-first, localStorage fallback)
//
// Service Types drive:
// - Reservation Form "Service Type" dropdown (reservation-form.html)
// - Vehicle Types -> association to one or more service types
// - Company Preferences "Applies To" selectors
//
// IMPORTANT:
// - Uses Supabase REST endpoints if the `service_types` table exists and requests succeed.
// - Falls back to localStorage when Supabase is unavailable (missing table / not signed in / RLS blocks).
//
// Why this file exists:
// Your Supabase `service_types` table schema may differ between environments.
// Some builds stored fields like `pricing_type` and `agreement` as top-level columns,
// while others stored them inside `metadata` (jsonb) or use `pricing_modes`/`default_label`.
//
// To avoid PostgREST 400 errors ("column does not exist"), this store:
// - Loads via `select=*` and maps whatever shape is returned
// - Upserts using a small set of common columns + metadata, with automatic retries

import { apiFetch, isLocalDevModeEnabled } from './api-service.js';

export const SERVICE_TYPES_STORAGE_KEY = 'relia_service_types_v1';

const DEFAULT_SERVICE_TYPES = [
  { code: 'from-airport', name: 'From Airport', pricing_type: 'DISTANCE', active: true, sort_order: 10 },
  { code: 'to-airport', name: 'To Airport', pricing_type: 'DISTANCE', active: true, sort_order: 20 },
  { code: 'point-to-point', name: 'Point-to-Point', pricing_type: 'DISTANCE', active: true, sort_order: 30 },
  { code: 'hourly', name: 'Hourly / As Directed', pricing_type: 'HOURS', active: true, sort_order: 40 }
];

function isUuid(value) {
  return typeof value === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value);
}

function safeUuid() {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    // ignore
  }
  // Fallback (not cryptographically strong, but fine for client-side IDs)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
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

function safeJsonParse(value) {
  if (typeof value !== 'string') return null;
  const s = value.trim();
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function normalizePricingType(value) {
  const v = (value || '').toString().trim().toUpperCase();
  if (!v) return 'DISTANCE';
  if (v === 'HOURLY') return 'HOURS';
  if (v === 'HOUR') return 'HOURS';
  if (v === 'PER_HOUR') return 'HOURS';
  return v;
}

export function normalizeServiceType(input) {
  const st = { ...(input || {}) };

  if (!st.id || !isUuid(st.id)) {
    st.id = st.id && typeof st.id === 'string' && st.id.length ? st.id : safeUuid();
    if (!isUuid(st.id)) st.id = safeUuid();
  }

  st.code = (st.code || '').toString().trim();
  st.name = (st.name || '').toString().trim();

  st.pricing_type = normalizePricingType(st.pricing_type || 'DISTANCE');
  st.custom_label = (st.custom_label || '').toString();
  st.agreement = (st.agreement || '').toString();
  st.default_settings = st.default_settings ?? '';

  st.active = st.active !== false; // default true
  st.sort_order = Number.isFinite(Number(st.sort_order)) ? Number(st.sort_order) : 0;

  return st;
}

export function generateServiceTypeCode(name) {
  const raw = (name || '').toString().trim().toLowerCase();
  if (!raw) return '';
  return raw
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function getDefaultServiceTypes() {
  return DEFAULT_SERVICE_TYPES.map((st) => normalizeServiceType({
    ...st,
    id: safeUuid(),
    custom_label: st.name,
    agreement: '',
    default_settings: ''
  }));
}

export function loadLocalServiceTypes({ includeInactive = true } = {}) {
  try {
    const raw = localStorage.getItem(SERVICE_TYPES_STORAGE_KEY);
    if (!raw) {
      const seeded = getDefaultServiceTypes();
      try { localStorage.setItem(SERVICE_TYPES_STORAGE_KEY, JSON.stringify(seeded)); } catch { /* ignore */ }
      return includeInactive ? seeded : seeded.filter((s) => s.active);
    }

    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed) ? parsed.map(normalizeServiceType) : [];
    if (!list.length) {
      const seeded = getDefaultServiceTypes();
      try { localStorage.setItem(SERVICE_TYPES_STORAGE_KEY, JSON.stringify(seeded)); } catch { /* ignore */ }
      return includeInactive ? seeded : seeded.filter((s) => s.active);
    }

    return includeInactive ? list : list.filter((s) => s.active);
  } catch {
    const seeded = getDefaultServiceTypes();
    try { localStorage.setItem(SERVICE_TYPES_STORAGE_KEY, JSON.stringify(seeded)); } catch { /* ignore */ }
    return includeInactive ? seeded : seeded.filter((s) => s.active);
  }
}

export function saveLocalServiceTypes(list) {
  const normalized = Array.isArray(list) ? list.map(normalizeServiceType) : [];
  try {
    localStorage.setItem(SERVICE_TYPES_STORAGE_KEY, JSON.stringify(normalized));
  } catch (e) {
    console.warn('⚠️ Failed to persist service types to localStorage.', e);
  }

  // Notify same-window listeners
  try {
    window.dispatchEvent(new CustomEvent('relia:service-types-updated', { detail: normalized }));
  } catch {
    // ignore
  }

  return normalized;
}

// -------------------------
// Remote helpers
// -------------------------

let remoteChecked = false;
let remoteAvailable = false;

async function checkRemoteAvailable() {
  if (remoteChecked) return remoteAvailable;
  remoteChecked = true;

  // If local dev mode is explicitly enabled, prefer local storage.
  if (isLocalDevModeEnabled()) {
    remoteAvailable = false;
    return remoteAvailable;
  }

  try {
    const data = await apiFetch('/service_types?select=id&limit=1');
    // If the table exists, apiFetch returns parsed JSON (array) or throws on error
    remoteAvailable = Array.isArray(data);
    return remoteAvailable;
  } catch {
    remoteAvailable = false;
    return remoteAvailable;
  }
}

function derivePricingTypeFromRow(row) {
  // Direct columns (old/new)
  if (row && typeof row.pricing_type === 'string' && row.pricing_type.trim()) {
    return normalizePricingType(row.pricing_type);
  }
  if (row && typeof row.billing_mode === 'string' && row.billing_mode.trim()) {
    return normalizePricingType(row.billing_mode);
  }

  // pricing_modes can be jsonb array or string
  const pm = row?.pricing_modes;
  if (Array.isArray(pm) && pm.length) {
    return normalizePricingType(pm[0]);
  }
  if (typeof pm === 'string') {
    const parsed = safeJsonParse(pm);
    if (Array.isArray(parsed) && parsed.length) return normalizePricingType(parsed[0]);
    return normalizePricingType(pm);
  }

  // metadata json
  const md = row?.metadata;
  if (md && typeof md === 'object') {
    const v = md.pricing_type || md.billing_mode || md.pricingMode || md.rate_mode;
    if (v) return normalizePricingType(v);
  }

  return 'DISTANCE';
}

function deriveDefaultSettingsFromRow(row) {
  if (row?.default_settings !== undefined && row.default_settings !== null) {
    return row.default_settings;
  }
  if (row?.default_label !== undefined && row.default_label !== null) {
    return row.default_label;
  }
  const md = row?.metadata;
  if (md && typeof md === 'object') {
    return md.default_settings ?? md.default_label ?? '';
  }
  return '';
}

function deriveAgreementFromRow(row) {
  if (row?.agreement !== undefined && row.agreement !== null) return String(row.agreement);
  const md = row?.metadata;
  if (md && typeof md === 'object' && (md.agreement !== undefined)) return String(md.agreement);
  return '';
}

function deriveCustomLabelFromRow(row) {
  if (row?.custom_label !== undefined && row.custom_label !== null) return String(row.custom_label);
  const md = row?.metadata;
  if (md && typeof md === 'object' && (md.custom_label !== undefined)) return String(md.custom_label);
  return '';
}

function deriveActiveFromRow(row) {
  if (typeof row?.active === 'boolean') return row.active;
  if (typeof row?.status === 'string') {
    const s = row.status.toString().trim().toUpperCase();
    if (!s) return true;
    return s !== 'INACTIVE';
  }
  return true;
}

function mapRemoteRow(row) {
  const st = normalizeServiceType({
    id: row?.id,
    code: row?.code,
    name: row?.name,
    pricing_type: derivePricingTypeFromRow(row),
    custom_label: deriveCustomLabelFromRow(row),
    agreement: deriveAgreementFromRow(row),
    default_settings: deriveDefaultSettingsFromRow(row),
    sort_order: row?.sort_order,
    active: deriveActiveFromRow(row)
  });

  // Preserve org id when present
  if (row?.organization_id) st.organization_id = row.organization_id;

  return st;
}

export async function loadServiceTypes({ includeInactive = true, preferRemote = true } = {}) {
  const local = loadLocalServiceTypes({ includeInactive: true });

  if (!preferRemote) {
    return includeInactive ? local : local.filter((s) => s.active);
  }

  const ok = await checkRemoteAvailable();
  if (!ok) {
    return includeInactive ? local : local.filter((s) => s.active);
  }

  try {
    // IMPORTANT: select=* avoids 400s when columns differ between schemas
    // apiFetch returns parsed JSON directly (not a Response object)
    const data = await apiFetch('/service_types?select=*');
    const remote = Array.isArray(data) ? data.map(mapRemoteRow) : [];

    // If remote exists but empty, keep local (do not auto-write / seed remote)
    // to avoid surprising inserts when RLS is misconfigured.
    if (!remote.length) {
      return includeInactive ? local : local.filter((s) => s.active);
    }

    // Keep local cache in sync for fast dropdown population
    saveLocalServiceTypes(remote);

    return includeInactive ? remote : remote.filter((s) => s.active);
  } catch {
    return includeInactive ? local : local.filter((s) => s.active);
  }
}

async function tryRemoteUpsert(url, rows) {
  try {
    const data = await apiFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Prefer: 'return=representation,resolution=merge-duplicates'
      },
      body: JSON.stringify(rows)
    });
    // apiFetch returns parsed JSON on success
    return Array.isArray(data) ? data.map(mapRemoteRow) : null;
  } catch (err) {
    return { status: 'error', bodyText: err.message };
  }
}

export async function upsertServiceTypes(list, { preferRemote = true } = {}) {
  const normalized = Array.isArray(list) ? list.map(normalizeServiceType) : [];

  // Always update local cache immediately
  saveLocalServiceTypes(normalized);

  if (!preferRemote) return normalized;

  const ok = await checkRemoteAvailable();
  if (!ok) return normalized;

  const orgId = loadOrgIdFromIdentityWallet();

  // PostgREST upsert
  const query = new URLSearchParams();
  query.set('on_conflict', 'id');
  const url = `/rest/v1/service_types?${query.toString()}`;

  // Build shared core data
  const core = normalized.map((st) => {
    const id = isUuid(st.id) ? st.id : safeUuid();
    return {
      id,
      name: st.name,
      code: st.code,
      sort_order: Number.isFinite(st.sort_order) ? st.sort_order : 0,
      // status variants handled per schema below
      _active: st.active === true,
      _pricing_type: normalizePricingType(st.pricing_type || 'DISTANCE'),
      _custom_label: st.custom_label || null,
      _agreement: st.agreement || null,
      _default_settings: st.default_settings || null
    };
  });

  // Helper: attach org id if we have it
  const withOrg = (rows) => {
    if (!orgId) return rows;
    return rows.map((r) => ({ ...r, organization_id: orgId }));
  };

  // Variant A: active/pricing_type/default_settings columns exist
  const variantA = core.map((r) => ({
    id: r.id,
    organization_id: orgId || undefined,
    active: r._active,
    status: r._active ? 'active' : 'inactive',
    name: r.name,
    code: r.code,
    pricing_type: r._pricing_type,
    custom_label: r._custom_label,
    agreement: r._agreement,
    default_settings: r._default_settings,
    sort_order: r.sort_order
  }));

  // Variant B: pricing_modes/default_label schema
  const pricingModesFor = (pt) => {
    const v = normalizePricingType(pt);
    if (v === 'HYBRID') return ['HOURS', 'DISTANCE', 'PASSENGER'];
    return [v];
  };

  const variantB = core.map((r) => ({
    id: r.id,
    organization_id: orgId || undefined,
    status: r._active ? 'ACTIVE' : 'INACTIVE',
    name: r.name,
    code: r.code,
    pricing_modes: pricingModesFor(r._pricing_type),
    custom_label: r._custom_label,
    agreement: r._agreement,
    default_label: r._default_settings,
    sort_order: r.sort_order
  }));

  // Variant C: metadata schema (billing_mode + metadata)
  const billingModeFor = (pt) => {
    const v = normalizePricingType(pt);
    if (v === 'HOURS') return 'HOURLY';
    return v;
  };

  const variantC = core.map((r) => ({
    id: r.id,
    organization_id: orgId || undefined,
    status: r._active ? 'ACTIVE' : 'INACTIVE',
    name: r.name,
    code: r.code,
    billing_mode: billingModeFor(r._pricing_type),
    sort_order: r.sort_order,
    metadata: {
      pricing_type: r._pricing_type,
      custom_label: r._custom_label,
      agreement: r._agreement,
      default_settings: r._default_settings
    }
  }));

  // Variant D: minimal common columns
  const variantD = core.map((r) => ({
    id: r.id,
    organization_id: orgId || undefined,
    status: r._active ? 'ACTIVE' : 'INACTIVE',
    name: r.name,
    code: r.code,
    sort_order: r.sort_order
  }));

  const attempts = [
    { name: 'variantA', rows: variantA },
    { name: 'variantB', rows: variantB },
    { name: 'variantC', rows: variantC },
    { name: 'variantD', rows: variantD }
  ];

  try {
    for (const attempt of attempts) {
      // First try with org_id (when provided). If the schema doesn't have organization_id,
      // we'll retry without it.
      const rowsWithOrg = orgId ? attempt.rows : attempt.rows.map(({ organization_id, ...rest }) => rest);

      // eslint-disable-next-line no-await-in-loop
      const result = await tryRemoteUpsert(url, rowsWithOrg);

      if (Array.isArray(result)) {
        saveLocalServiceTypes(result);
        return result;
      }

      // If RLS/auth blocks, stop retrying.
      if (result && (result.status === 401 || result.status === 403)) {
        return normalized;
      }

      // If organization_id column missing, retry once without it.
      const bodyText = result?.bodyText || '';
      const orgMissing = /organization_id/i.test(bodyText) && /(does not exist|unknown column|column)/i.test(bodyText);
      if (orgMissing && orgId) {
        const rowsNoOrg = attempt.rows.map(({ organization_id, ...rest }) => rest);
        // eslint-disable-next-line no-await-in-loop
        const retry = await tryRemoteUpsert(url, rowsNoOrg);
        if (Array.isArray(retry)) {
          saveLocalServiceTypes(retry);
          return retry;
        }
        if (retry && (retry.status === 401 || retry.status === 403)) {
          return normalized;
        }
      }

      // Otherwise: try next variant (handles differing schemas)
    }
  } catch {
    // ignore (local already saved)
  }

  return normalized;
}

export async function deleteServiceTypeById(id, { preferRemote = true } = {}) {
  if (!id) return;

  const local = loadLocalServiceTypes({ includeInactive: true });
  const updated = local.filter((st) => st.id !== id);
  saveLocalServiceTypes(updated);

  if (!preferRemote) return;

  const ok = await checkRemoteAvailable();
  if (!ok) return;

  try {
    await apiFetch(`/service_types?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
  } catch {
    // ignore remote failure; local already updated
  }
}

export function getActiveServiceTypes(list) {
  const arr = Array.isArray(list) ? list : [];
  return arr.filter((st) => st && st.active !== false);
}
