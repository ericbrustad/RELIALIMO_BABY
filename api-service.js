// api-service.js

import { getSupabaseConfig } from './config.js';

function getApiBase() {
  try {
    const cfg = getSupabaseConfig();
    return cfg?.url ? `${cfg.url.replace(/\/$/, '')}/rest/v1` : '/rest/v1';
  } catch (e) {
    // Fallback to window.ENV if config lookup fails
    return window?.ENV?.SUPABASE_URL ? `${window.ENV.SUPABASE_URL.replace(/\/$/, '')}/rest/v1` : '/rest/v1';
  }
}

function getApiKey() {
  try {
    const cfg = getSupabaseConfig();
    return cfg?.anonKey || (window?.ENV?.SUPABASE_ANON_KEY || '');
  } catch (e) {
    return window?.ENV?.SUPABASE_ANON_KEY || '';
  }
}

function buildUrl(path) {
  const API_BASE = getApiBase();
  if (!path) return API_BASE;
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith(API_BASE)) return path;
  if (path.startsWith('/')) return `${API_BASE}${path}`;
  return `${API_BASE}/${path}`;
}

async function request(path, options = {}) {
  const url = buildUrl(path);
  const apiKey = getApiKey();
  let finalUrl = url;

  // Add apikey query param as belt-and-suspenders when talking to Supabase
  try {
    const baseForUrl = (typeof window !== 'undefined' && window.location) ? window.location.origin : 'http://localhost';
    const urlObj = new URL(url, baseForUrl);
    if (!urlObj.searchParams.has('apikey') && apiKey && /supabase\.co$/i.test(urlObj.hostname)) {
      urlObj.searchParams.append('apikey', apiKey);
      finalUrl = urlObj.toString();
    }
  } catch (e) {
    // ignore URL parsing errors and fall back to original url
  }

  // Diagnostic: log presence and a masked preview of the anon key so we can debug header issues
  try {
    console.debug('[api-service] Preparing request', {
      method: options.method || 'GET',
      path,
      url: finalUrl,
      apiKeyPresent: !!apiKey,
      apiKeyPreview: apiKey ? `${apiKey.slice(0,6)}...` : null,
      optionHeaders: options.headers ? Object.keys(options.headers) : []
    });
  } catch (e) { /* ignore debug errors */ }

  if (!apiKey) {
    const err = new Error('Missing Supabase API key: ensure env.js is loaded before application scripts or set FORCE_DATABASE_ON_LOCALHOST for dev');
    console.error('[api-service] Aborting request, no API key:', { path, url });
    setLastApiError(err);
    throw err;
  }

  try {
    // Extract headers from options separately to prevent overwriting
    const { headers: optionHeaders, ...restOptions } = options;
    
    const res = await fetch(finalUrl, {
      ...restOptions,
      headers: {
        "Content-Type": "application/json",
        apikey: apiKey,
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        ...optionHeaders
      }
    });

    // read raw text first so we can include it in error messages even when JSON parsing fails
    const text = await res.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch (err) {
        // include parsing error context
        console.error('Failed to parse JSON response:', err, 'raw:', text);
        setLastApiError(err);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status} ${res.statusText}: ${text}`);
        }
        throw new Error(`Invalid JSON response: ${text}`);
      }
    }

    if (!res.ok) {
      const msg = data?.error || data?.message || JSON.stringify(data) || text || `${res.status} ${res.statusText}`;
      const err = new Error(msg);
      console.error('API request failed:', { path, url: finalUrl, status: res.status, body: msg });
      setLastApiError(err);
      throw err;
    }

    return data;
  } catch (err) {
    setLastApiError(err);
    throw err;
  }
}

// Basic exported helpers (used across the app)
export async function apiFetch(path, options = {}) {
  const url = buildUrl(path);
  const apiKey = getApiKey();
  
  // Destructure headers from options to merge properly
  const { headers: optionHeaders, ...restOptions } = options;
  
  const res = await fetch(url, {
    ...restOptions,
    headers: {
      'Content-Type': 'application/json',
      apikey: apiKey,
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      ...(optionHeaders || {})
    }
  });
  const text = await res.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }
  if (!res.ok) {
    const msg = data?.message || data?.error || text || `${res.status} ${res.statusText}`;
    const err = new Error(msg);
    setLastApiError(err);
    throw err;
  }
  return data;
}

export async function setupAPI() {
  // compatibility shim - real auth/session management lives elsewhere
  return true;
}

// Import lightweight supabase client for functions that need it
import { supabase as _supabaseClient } from './supabase-client.js';
export function getSupabaseClient() { return _supabaseClient; }

// Error capture
let _lastApiError = null;
function setLastApiError(err) { _lastApiError = err; }
export function getLastApiError() { return _lastApiError; }

// Reservations
export async function createReservation(payload) {
  const rows = await request('/reservations', { method: 'POST', body: JSON.stringify(payload) });
  return Array.isArray(rows) ? rows[0] : rows;
}
export async function updateReservation(id, payload) {
  const rows = await request(`/reservations?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(payload) });
  return Array.isArray(rows) ? rows[0] : rows;
}
export async function fetchReservations() { return await request('/reservations?select=*'); }
export async function getReservation(id) { const rows = await request(`/reservations?id=eq.${encodeURIComponent(id)}&select=*`); return Array.isArray(rows)&&rows.length?rows[0]:null; }

// Drivers
export async function createDriver(payload) { 
  const rows = await request('/drivers', { 
    method: 'POST', 
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(payload) 
  }); 
  return Array.isArray(rows) ? rows[0] : rows; 
}
export async function listDriverNames({ limit, offset } = {}) {
  // Include address fields for garage time calculations
  let q = `/drivers?select=id,dispatch_display_name,first_name,last_name,status,assigned_vehicle_id,primary_address,city,state,postal_code&order=last_name.asc,first_name.asc`;
  if (limit) q += `&limit=${limit}`;
  if (offset) q += `&offset=${offset}`;
  try {
    return await request(q);
  } catch (err) {
    // Fallback when dispatch_display_name column doesn't exist on older schemas
    if (/dispatch_display_name/i.test(err.message) || /dispatch_display_name does not exist/i.test(err.message)) {
      const q2 = `/drivers?select=id,first_name,last_name,status,assigned_vehicle_id,primary_address,city,state,postal_code&order=last_name.asc,first_name.asc${limit?`&limit=${limit}`:''}${offset?`&offset=${offset}`:''}`;
      const rows = await request(q2);
      return rows.map(r => ({
        ...r,
        dispatch_display_name: ((r.last_name || '').trim() ? `${r.last_name}, ${r.first_name || ''}` : `${r.first_name || ''}`).trim()
      }));
    }
    throw err;
  }
}
export async function fetchDrivers() { return await request('/drivers'); }
export async function updateDriver(id, payload) { const rows = await request(`/drivers?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(payload) }); return Array.isArray(rows)?rows[0]:rows; }
export async function deleteDriver(id) { return await request(`/drivers?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' }); }

// Affiliates
export async function fetchAffiliates() { return await request('/affiliates?order=company_name.asc'); }
export async function createAffiliate(payload) { 
  const rows = await request('/affiliates', { 
    method: 'POST', 
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(payload) 
  }); 
  return Array.isArray(rows) ? rows[0] : rows; 
}
export async function updateAffiliate(id, payload) { const rows = await request(`/affiliates?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(payload) }); return Array.isArray(rows)?rows[0]:rows; }
export async function deleteAffiliate(id) { return await request(`/affiliates?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' }); }

// Vehicle types
// IMPORTANT: the client must READ and WRITE ONLY to the base table `vehicle_types`.
// Do not rely on `vehicle_types_public` view — reads and writes should target the base table.
export async function getVehicleTypes() { return await request('/vehicle_types?order=name.asc'); }

export async function fetchVehicleTypesTable(opts = {}) {
  // Direct table query (requires authenticated session/privileges)
  const includeInactive = !!opts.includeInactive;
  let q = `/vehicle_types?select=*&order=name.asc`;
  if (!includeInactive) q += `&status=eq.ACTIVE`;
  if (opts.limit) q += `&limit=${opts.limit}`;
  if (opts.offset) q += `&offset=${opts.offset}`;
  return await request(q);
}

export async function fetchVehicleTypes(opts = {}) {
  // Strict: always query the base table. If permission/RLS prevents access, the caller should surface the error.
  return await fetchVehicleTypesTable(opts);
}

export async function listActiveVehicleTypes({ limit, offset } = {}) { let q = `/vehicle_types?select=*&status=eq.ACTIVE&order=name.asc`; if (limit) q += `&limit=${limit}`; if (offset) q += `&offset=${offset}`; return await request(q); }
// Client-side writes are proxied to server endpoints to avoid exposing service_role keys

async function getUserAccessToken() {
  try {
    // Prefer SDK-managed session when available
    const { data: { session } } = await _supabaseClient.auth.getSession();
    const token = session?.access_token || null;
    if (token) return token;
  } catch (e) {
    // ignore
  }
  // Fallback: check local storage key used elsewhere
  try { return localStorage.getItem('supabase_access_token'); } catch (e) { return null; }
}

export async function upsertVehicleType(payload) {
  const token = await getUserAccessToken();
  const allowDirectFallback = !token && (isLocalDevModeEnabled() || window?.SUPABASE_POLICY_ERROR);

  async function upsertViaSupabase(authToken = null) {
    // Pass user's auth token if available for RLS
    const authHeader = authToken ? { Authorization: `Bearer ${authToken}` } : {};
    if (payload.id) {
      const rows = await request(`/vehicle_types?id=eq.${encodeURIComponent(payload.id)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=representation', ...authHeader },
        body: JSON.stringify(payload)
      });
      return Array.isArray(rows) && rows.length ? rows[0] : rows;
    }
    const rows = await request('/vehicle_types', { 
      method: 'POST', 
      headers: authHeader,
      body: JSON.stringify(payload) 
    });
    return Array.isArray(rows) && rows.length ? rows[0] : rows;
  }

  if (!token) {
    if (allowDirectFallback) {
      console.warn('[api-service] Missing auth token for vehicle-types; using direct Supabase fallback');
      return upsertViaSupabase();
    }
    throw new Error('No authenticated user session (missing access token)');
  }

  if (payload.id) {
    const res = await fetch(`/api/vehicle-types/${encodeURIComponent(payload.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(payload)
    });
    if (res.status === 401 || res.status === 403) {
      console.warn('[api-service] Vehicle type PATCH unauthorized; falling back to direct Supabase request');
      return upsertViaSupabase(token);
    }
    const text = await res.text();
    if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
    const data = JSON.parse(text);
    if (Array.isArray(data) && data.length) return data[0];
    return data;
  }

  const res = await fetch('/api/vehicle-types', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(payload)
  });
  if (res.status === 401 || res.status === 403) {
    console.warn('[api-service] Vehicle type POST unauthorized; falling back to direct Supabase request');
    return upsertViaSupabase(token);
  }
  const text = await res.text();
  if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
  const data = JSON.parse(text);
  if (Array.isArray(data) && data.length) return data[0];
  return data;
}

export async function deleteVehicleType(id) {
  if (!id) throw new Error('Missing vehicle type id');
  const token = await getUserAccessToken();
  const allowDirectFallback = !token && (isLocalDevModeEnabled() || window?.SUPABASE_POLICY_ERROR);

  if (!token) {
    if (allowDirectFallback) {
      console.warn('[api-service] Missing auth token for deleteVehicleType; using direct Supabase fallback');
      return await request(`/vehicle_types?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
    }
    throw new Error('No authenticated user session (missing access token)');
  }

  const res = await fetch(`/api/vehicle-types/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (res.status === 401 || res.status === 403) {
    console.warn('[api-service] Vehicle type DELETE unauthorized; falling back to direct Supabase request');
    return await request(`/vehicle_types?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
  }
  const text = await res.text();
  if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
  return JSON.parse(text);
}
export async function deleteVehicleTypeImage(id) { if (!id) throw new Error('Missing vehicle type image id'); return await request(`/vehicle_type_images?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' }); }

// Vehicle type images: list, upload (basic), update
export async function fetchVehicleTypeImages(vehicleTypeId) {
  if (!vehicleTypeId) throw new Error('Missing vehicle type id');
  return await request(`/vehicle_type_images?vehicle_type_id=eq.${encodeURIComponent(vehicleTypeId)}&order=sort_order.asc`);
}

export async function uploadVehicleTypeImage(vehicleTypeId, fileOrData, opts = {}) {
  if (!vehicleTypeId) throw new Error('Missing vehicle type id');

  // If a File is provided, we do a best-effort create of a DB record referencing the file metadata.
  // Full file storage upload should be handled separately (Supabase Storage), but for now create DB row so UI can proceed.
  const payload = {
    vehicle_type_id: vehicleTypeId,
    display_name: opts.displayName || (fileOrData && fileOrData.name) || null,
    is_primary: !!opts.isPrimary,
    metadata: opts.metadata ? JSON.stringify(opts.metadata) : null
  };

  const rows = await request('/vehicle_type_images', { method: 'POST', body: JSON.stringify(payload) });
  return Array.isArray(rows) ? rows[0] : rows;
}

export async function updateVehicleTypeImage(id, payload) {
  if (!id) throw new Error('Missing vehicle type image id');
  const rows = await request(`/vehicle_type_images?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(payload) });
  return Array.isArray(rows) ? rows[0] : rows;
}

// Vehicles
export async function listActiveVehiclesLight({ limit, offset } = {}) {
  let q = `/vehicles?select=id,veh_disp_name,unit_number,make,model,year,license_plate,status,veh_type,veh_title&status=in.(ACTIVE,AVAILABLE,IN_USE)&order=veh_disp_name.asc,make.asc,model.asc,year.desc`;
  if (limit) q += `&limit=${limit}`;
  if (offset) q += `&offset=${offset}`;
  try {
    return await request(q);
  } catch (err) {
    // Fallback when veh_disp_name doesn't exist: return a derived display name
    if (/veh_disp_name/i.test(err.message) || /veh_disp_name does not exist/i.test(err.message)) {
      const q2 = `/vehicles?select=id,unit_number,make,model,year,license_plate,status,veh_type,veh_title&status=in.(ACTIVE,AVAILABLE,IN_USE)&order=make.asc,model.asc,year.desc${limit?`&limit=${limit}`:''}${offset?`&offset=${offset}`:''}`;
      const rows = await request(q2);
      return rows.map(r => ({
        ...r,
        veh_disp_name: (r.veh_title && r.veh_title.trim()) ? r.veh_title : `${(r.make||'').trim()} ${(r.model||'').trim()} ${(r.year||'').toString().trim()}`.trim()
      }));
    }
    throw err;
  }
}
export async function fetchActiveVehicles({ includeInactive = false } = {}) {
  // Include veh_title and license_plate in the select fields
  const selectFields = 'select=id,veh_disp_name,unit_number,make,model,year,license_plate,status,veh_type,veh_title,color,vin';
  const statusFilter = includeInactive ? '' : '&status=in.(ACTIVE,AVAILABLE,IN_USE)';
  try {
    return await request(`/vehicles?${selectFields}&order=veh_disp_name.asc${statusFilter}`);
  } catch (err) {
    // Fallback when veh_disp_name doesn't exist: order by make/model
    if (/veh_disp_name/i.test(err.message) || /veh_disp_name does not exist/i.test(err.message)) {
      return await request(`/vehicles?${selectFields}&order=make.asc,model.asc,year.desc${statusFilter}`);
    }
    throw err;
  }
}

export async function createFleetVehicle(payload) { 
  const rows = await request('/fleet_vehicles', { 
    method: 'POST', 
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(payload) 
  }); 
  return Array.isArray(rows) ? rows[0] : rows; 
}

export async function updateFleetVehicle(id, payload) {
  const rows = await request(`/fleet_vehicles?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(payload)
  });
  return Array.isArray(rows) ? rows[0] : rows;
}

export async function fetchFleetVehicles({ limit, offset, includeInactive } = {}) {
  // Fetch from fleet_vehicles table (Supabase)
  let q = '/fleet_vehicles?select=*&order=unit_number.asc,make.asc,model.asc';
  if (!includeInactive) {
    q += '&status=in.(ACTIVE,AVAILABLE,IN_USE)';
  }
  if (limit) q += `&limit=${limit}`;
  if (offset) q += `&offset=${offset}`;
  return await request(q);
}

// Accounts / Passengers / Booking Agents
export async function saveAccountToSupabase(payload) { 
  if (payload.id) { 
    const rows = await request(`/accounts?id=eq.${encodeURIComponent(payload.id)}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(payload) }); 
    return Array.isArray(rows) && rows.length ? rows[0] : rows; 
  } 
  const rows = await request('/accounts', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(payload) }); 
  return Array.isArray(rows) && rows.length ? rows[0] : rows; 
}
export async function fetchAccounts() { return await request('/accounts?select=*'); }
export async function savePassengerToSupabase(payload) { 
  if (payload.id) { 
    const rows = await request(`/passengers?id=eq.${encodeURIComponent(payload.id)}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(payload) }); 
    return Array.isArray(rows) && rows.length ? rows[0] : rows; 
  } 
  const rows = await request('/passengers', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(payload) }); 
  return Array.isArray(rows) && rows.length ? rows[0] : rows; 
}
export async function saveBookingAgentToSupabase(payload) { 
  if (payload.id) { 
    const rows = await request(`/booking_agents?id=eq.${encodeURIComponent(payload.id)}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(payload) }); 
    return Array.isArray(rows) && rows.length ? rows[0] : rows; 
  } 
  const rows = await request('/booking_agents', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(payload) }); 
  return Array.isArray(rows) && rows.length ? rows[0] : rows; 
}

// Simple admin helpers (used by utilities)
export async function deleteAllReservationsSupabase() { return await request('/reservations', { method: 'DELETE' }); }
export async function deleteAllAccountsSupabase() { return await request('/accounts', { method: 'DELETE' }); }
export async function deleteAllDriversSupabase() { return await request('/drivers', { method: 'DELETE' }); }
export async function deleteAllVehiclesSupabase() { return await request('/vehicles', { method: 'DELETE' }); }
export async function deleteAllRatesSupabase() { return await request('/rates', { method: 'DELETE' }); }
export async function removeDuplicateAffiliates() { /* no-op utility stub */ return true; }
export async function removeDuplicateDrivers() { /* no-op utility stub */ return true; }
export async function resetConfirmationCounterToStart() { /* no-op utility stub */ return true; }

// Geocoding / helpers (stubs)
export async function geocodeAddress(address) { return []; }
export async function reverseGeocode(lat, lon) { return null; }
export async function searchAirports(query) { return []; }
export async function calculateDistance(from, to) { return { meters: 0, miles: 0, duration_secs: 0 }; }

// Dev helpers
export function isLocalDevModeEnabled() {
  try { if (typeof window === 'undefined') return false; const host = window.location.hostname; if (!host) return false; if (host === 'localhost' || host === '127.0.0.1') return true; if (window.ENV && (window.ENV.NODE_ENV === 'development' || window.ENV.LOCAL === 'true')) return true; return false; } catch (e) { return false; }
}

// Export a default helper object for older modules
export default {
  apiFetch,
  request,
  buildUrl,
  setupAPI,
  getSupabaseClient,
  getLastApiError,
  createReservation,
  fetchReservations,
  getReservation,
  createDriver,
  fetchDrivers,
  listDriverNames,
  getVehicleTypes,
  fetchVehicleTypes,
  listActiveVehicleTypes,
  listActiveVehiclesLight,
  fetchActiveVehicles,
  createFleetVehicle,
  updateFleetVehicle,
  fetchFleetVehicles,
  deleteVehicleTypeImage,
  fetchVehicleTypeImages,
  uploadVehicleTypeImage,
  updateVehicleTypeImage,
  saveAccountToSupabase,
  fetchAccounts
};