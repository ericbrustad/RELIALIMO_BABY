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

// Service role key for bypassing RLS (use carefully!)
function getServiceRoleKey() {
  return window?.ENV?.SUPABASE_SERVICE_ROLE_KEY || '';
}

// Get appropriate API key - use service role for read operations that need RLS bypass
function getApiKeyForPath(path) {
  const serviceKey = getServiceRoleKey();
  // Use service role key for reservations to bypass RLS
  if (serviceKey && path && (path.includes('/reservations') || path.includes('reservations'))) {
    return serviceKey;
  }
  return getApiKey();
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
  const apiKey = getApiKeyForPath(path);
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
    
    // Get user's access token for Authorization header (required for RLS)
    let authToken = apiKey; // Default to anon key
    try {
      // First, try the shared session helper from auth-guard.js
      if (window.__reliaGetValidSession) {
        const session = await window.__reliaGetValidSession();
        if (session?.access_token) {
          authToken = session.access_token;
          console.debug('[api-service] Using user access token for auth (from __reliaGetValidSession)');
        }
      }
      // Fallback: try localStorage (auth-guard.js saves it there)
      else if (localStorage.getItem('supabase_access_token')) {
        authToken = localStorage.getItem('supabase_access_token');
        console.debug('[api-service] Using user access token for auth (from localStorage)');
      }
      // Fallback: try to get from Supabase client if available
      else if (window.__supabaseClient) {
        const { data: { session } } = await window.__supabaseClient.auth.getSession();
        if (session?.access_token) {
          authToken = session.access_token;
          console.debug('[api-service] Using user access token for auth (from __supabaseClient)');
        }
      } else if (window.supabase?.auth) {
        const { data: { session } } = await window.supabase.auth.getSession();
        if (session?.access_token) {
          authToken = session.access_token;
          console.debug('[api-service] Using user access token for auth (from window.supabase)');
        }
      }
    } catch (authErr) {
      console.warn('[api-service] Could not get user session, using anon key:', authErr.message);
    }
    
    const res = await fetch(finalUrl, {
      ...restOptions,
      headers: {
        "Content-Type": "application/json",
        apikey: apiKey,
        Authorization: `Bearer ${authToken}`,
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
  
  // Get user's access token for Authorization header (required for RLS)
  let authToken = apiKey; // Default to anon key
  try {
    if (window.__reliaGetValidSession) {
      const session = await window.__reliaGetValidSession();
      if (session?.access_token) {
        authToken = session.access_token;
      }
    } else if (localStorage.getItem('supabase_access_token')) {
      authToken = localStorage.getItem('supabase_access_token');
    }
  } catch (authErr) {
    console.warn('[apiFetch] Could not get user session:', authErr.message);
  }
  
  const res = await fetch(url, {
    ...restOptions,
    headers: {
      'Content-Type': 'application/json',
      apikey: apiKey,
      Authorization: `Bearer ${authToken}`,
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

// Get organization_id from ENV config
function getOrganizationId() {
  if (typeof window !== 'undefined' && window.ENV) {
    return window.ENV.ORGANIZATION_ID || window.ENV.SUPABASE_ORGANIZATION_ID || window.ENV.ORG_ID || null;
  }
  return null;
}

// Valid reservation columns in the database (snake_case)
const VALID_RESERVATION_COLUMNS = new Set([
  'id', 'organization_id', 'confirmation_number', 'status', 'account_id',
  'passenger_name', 'passenger_count', 'vehicle_type', 'trip_type', 'service_type',
  'pickup_datetime', 'pickup_address', 'pickup_city', 'pickup_state', 'pickup_zip', 'pickup_lat', 'pickup_lon',
  'dropoff_datetime', 'dropoff_address', 'dropoff_city', 'dropoff_state', 'dropoff_zip', 'dropoff_lat', 'dropoff_lon',
  'pu_address', 'do_address',
  'assigned_driver_id', 'assigned_driver_name', 'driver_status', 'fleet_vehicle_id',
  'grand_total', 'rate_type', 'rate_amount', 'payment_type', 'currency',
  'farm_option', 'farmout_status', 'farmout_mode', 'farmout_notes', 'farmout_attempts', 'farmout_declined_drivers',
  'current_offer_driver_id', 'current_offer_sent_at', 'current_offer_expires_at',
  'notes', 'special_instructions', 'timezone', 'form_snapshot',
  'created_at', 'updated_at', 'created_by', 'updated_by', 'booked_by_user_id'
]);

// Build structured special_instructions that encodes passenger, billing, and booking agent info
function buildSpecialInstructions(payload) {
  const parts = [];
  
  // Passenger info
  const passenger = payload.passenger || {};
  const passengerName = payload.passenger_name || `${passenger.firstName || ''} ${passenger.lastName || ''}`.trim();
  if (passengerName) parts.push(`Passenger: ${passengerName}`);
  if (passenger.phone) parts.push(`Phone: ${passenger.phone}`);
  if (passenger.email) parts.push(`Email: ${passenger.email}`);
  if (passenger.altContactName) parts.push(`Alt Contact: ${passenger.altContactName}`);
  if (passenger.altContactPhone) parts.push(`Alt Phone: ${passenger.altContactPhone}`);
  
  // Flight info (if present in routing)
  const routing = payload.routing || {};
  if (routing.airline) parts.push(`Airline: ${routing.airline}`);
  if (routing.flightNumber) parts.push(`Flight: ${routing.flightNumber}`);
  if (routing.airport) parts.push(`Airport: ${routing.airport}`);
  
  // Existing special instructions
  if (payload.special_instructions || payload.specialInstructions) {
    parts.push(payload.special_instructions || payload.specialInstructions);
  }
  
  return parts.join(', ');
}

// Build notes field with billing and booking agent info
function buildNotesField(payload) {
  const parts = [];
  
  // Billing account info
  const billing = payload.billingAccount || {};
  if (billing.company) parts.push(`Billing: ${billing.company}`);
  if (billing.account) parts.push(`Account #${billing.account}`);
  if (billing.firstName || billing.lastName) {
    const billingName = `${billing.firstName || ''} ${billing.lastName || ''}`.trim();
    if (billingName) parts.push(`Billing Contact: ${billingName}`);
  }
  if (billing.cellPhone) parts.push(`Billing Phone: ${billing.cellPhone}`);
  if (billing.email) parts.push(`Billing Email: ${billing.email}`);
  
  // Booked by info
  const bookedBy = payload.bookedBy || {};
  if (bookedBy.firstName || bookedBy.lastName) {
    const bookerName = `${bookedBy.firstName || ''} ${bookedBy.lastName || ''}`.trim();
    if (bookerName) parts.push(`Booked By: ${bookerName}`);
  }
  if (bookedBy.phone) parts.push(`Booker Phone: ${bookedBy.phone}`);
  if (bookedBy.email) parts.push(`Booker Email: ${bookedBy.email}`);
  
  // Reference number
  const details = payload.details || {};
  if (details.referenceNum) parts.push(`Ref#: ${details.referenceNum}`);
  if (details.affiliate) parts.push(`Affiliate: ${details.affiliate}`);
  
  // Existing trip notes
  const tripNotes = (payload.routing?.tripNotes || payload.notes || '').trim();
  if (tripNotes) parts.push(tripNotes);
  
  return parts.join(' | ');
}

// Transform rich form payload to flat database columns
function transformReservationPayload(payload) {
  const result = {};
  
  // Direct mappings for already-correct fields
  for (const [key, value] of Object.entries(payload)) {
    if (VALID_RESERVATION_COLUMNS.has(key) && value !== undefined && value !== null && value !== '') {
      result[key] = value;
    }
  }
  
  // Map camelCase to snake_case
  if (payload.confirmationNumber) result.confirmation_number = payload.confirmationNumber;
  if (payload.accountId) result.account_id = payload.accountId;
  if (payload.passengerName) result.passenger_name = payload.passengerName;
  if (payload.passengerCount) result.passenger_count = payload.passengerCount;
  if (payload.vehicleType) result.vehicle_type = payload.vehicleType;
  if (payload.tripType) result.trip_type = payload.tripType;
  if (payload.pickupDateTime || payload.pickupDatetime) result.pickup_datetime = payload.pickupDateTime || payload.pickupDatetime;
  if (payload.pickupAddress) result.pickup_address = payload.pickupAddress;
  if (payload.pickupCity) result.pickup_city = payload.pickupCity;
  if (payload.pickupState) result.pickup_state = payload.pickupState;
  if (payload.pickupZip) result.pickup_zip = payload.pickupZip;
  if (payload.dropoffDateTime || payload.dropoffDatetime) result.dropoff_datetime = payload.dropoffDateTime || payload.dropoffDatetime;
  if (payload.dropoffAddress) result.dropoff_address = payload.dropoffAddress;
  if (payload.dropoffCity) result.dropoff_city = payload.dropoffCity;
  if (payload.dropoffState) result.dropoff_state = payload.dropoffState;
  if (payload.dropoffZip) result.dropoff_zip = payload.dropoffZip;
  if (payload.assignedDriverId) result.assigned_driver_id = payload.assignedDriverId;
  if (payload.assignedDriverName) result.assigned_driver_name = payload.assignedDriverName;
  if (payload.driverStatus) result.driver_status = payload.driverStatus;
  if (payload.grandTotal) result.grand_total = payload.grandTotal;
  if (payload.rateType) result.rate_type = payload.rateType;
  if (payload.rateAmount) result.rate_amount = payload.rateAmount;
  if (payload.paymentType) result.payment_type = payload.paymentType;
  if (payload.farmoutStatus) result.farmout_status = payload.farmoutStatus;
  if (payload.farmoutMode) result.farmout_mode = payload.farmoutMode;
  // Map farm_option (radio button) to farm_option column and set farmout workflow
  if (payload.farm_option) {
    result.farm_option = payload.farm_option;
    if (payload.farm_option === 'farm-out') {
      // Setting to farm-out: enable farmout workflow
      result.farmout_mode = result.farmout_mode || 'manual';
      result.farmout_status = result.farmout_status || 'unassigned';
    } else if (payload.farm_option === 'in-house') {
      // Setting to in-house: clear farmout status so it leaves farmout list
      result.farmout_status = null;
      result.farmout_mode = null;
    }
  }
  if (payload.farmOption) {
    result.farm_option = payload.farmOption;
    if (payload.farmOption === 'farm-out') {
      // Setting to farm-out: enable farmout workflow
      result.farmout_mode = result.farmout_mode || 'manual';
      result.farmout_status = result.farmout_status || 'unassigned';
    } else if (payload.farmOption === 'in-house') {
      // Setting to in-house: clear farmout status so it leaves farmout list
      result.farmout_status = null;
      result.farmout_mode = null;
    }
  }
  if (payload.specialInstructions) result.special_instructions = payload.specialInstructions;
  if (payload.createdAt) result.created_at = payload.createdAt;
  if (payload.updatedAt) result.updated_at = payload.updatedAt;
  
  // Extract from nested objects if present
  if (payload.passenger) {
    const p = payload.passenger;
    const name = `${p.firstName || ''} ${p.lastName || ''}`.trim();
    if (name) result.passenger_name = name;
  }
  
  // Build structured special_instructions with passenger details
  const specialInstructions = buildSpecialInstructions(payload);
  if (specialInstructions) {
    result.special_instructions = specialInstructions;
  }
  
  // Build notes with billing and booking agent info
  const notesField = buildNotesField(payload);
  if (notesField) {
    result.notes = notesField;
  }
  
  if (payload.routing && payload.routing.stops && payload.routing.stops.length > 0) {
    const stops = payload.routing.stops;
    // First stop is pickup
    const pickup = stops[0];
    if (pickup) {
      if (pickup.address1) result.pickup_address = pickup.address1;
      if (pickup.city) result.pickup_city = pickup.city;
      if (pickup.state) result.pickup_state = pickup.state;
      if (pickup.zipCode) result.pickup_zip = pickup.zipCode;
      // Also set pu_address as combined address
      result.pu_address = [pickup.address1, pickup.city, pickup.state, pickup.zipCode].filter(Boolean).join(', ');
    }
    // Last stop is dropoff (if more than one)
    if (stops.length > 1) {
      const dropoff = stops[stops.length - 1];
      if (dropoff) {
        if (dropoff.address1) result.dropoff_address = dropoff.address1;
        if (dropoff.city) result.dropoff_city = dropoff.city;
        if (dropoff.state) result.dropoff_state = dropoff.state;
        if (dropoff.zipCode) result.dropoff_zip = dropoff.zipCode;
        result.do_address = [dropoff.address1, dropoff.city, dropoff.state, dropoff.zipCode].filter(Boolean).join(', ');
      }
    }
  }
  
  if (payload.routing && payload.routing.tripNotes) {
    result.notes = payload.routing.tripNotes;
  }
  
  if (payload.details) {
    const d = payload.details;
    
    // Valid database status values (CHECK constraint)
    const VALID_DB_STATUSES = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'];
    
    // Map UI statuses to database statuses
    const UI_STATUS_MAP = {
      'unassigned': 'pending',
      'assigned': 'confirmed',
      'offered': 'pending',
      'offered_to_affiliate': 'pending',
      'affiliate_assigned': 'confirmed',
      'affiliate_driver_assigned': 'confirmed',
      'driver_en_route': 'in_progress',
      'on_the_way': 'in_progress',
      'dispatched': 'in_progress',
      'in_progress': 'in_progress',
      'in-progress': 'in_progress',
      'arrived': 'in_progress',
      'passenger_on_board': 'in_progress',
      'pob': 'in_progress',
      'completed': 'completed',
      'cancelled': 'cancelled',
      'canceled': 'cancelled',
      'no_show': 'cancelled',
      'pending': 'pending',
      'confirmed': 'confirmed',
      'get_status_now': 'pending',
      'flight_time_change': 'pending',
      'offered_efarm_in': 'pending'
    };
    
    // Map of UI farmout statuses to farmout_status column values
    const FARMOUT_STATUS_MAP = {
      'farm_out_unassigned': 'unassigned',
      'farm-out unassigned': 'unassigned',
      'farmout_unassigned': 'unassigned',
      'farm_out_offered': 'offered',
      'farm-out offered': 'offered',
      'farmout_offered': 'offered',
      'farm_out_assigned': 'assigned',
      'farm-out assigned': 'assigned',
      'farmout_assigned': 'assigned',
      'farm_out_confirmed': 'confirmed',
      'farm-out confirmed': 'confirmed',
      'farmout_confirmed': 'confirmed',
      'farm_out_completed': 'completed',
      'farm-out completed': 'completed',
      'farmout_completed': 'completed',
      'farm_out_cancelled': 'cancelled',
      'farm-out cancelled': 'cancelled',
      'farmout_cancelled': 'cancelled'
    };
    
    if (d.status) {
      const statusLower = d.status.toLowerCase().replace(/ /g, '_').replace(/-/g, '_');
      
      // Check if this is a farmout status
      if (FARMOUT_STATUS_MAP[statusLower] || statusLower.includes('farm')) {
        // It's a farmout status - set farmout_status column and use 'pending' for status
        const farmoutVal = FARMOUT_STATUS_MAP[statusLower] || 
          statusLower.replace(/farm_?out_?/i, '').replace(/_+/g, '_').replace(/^_|_$/g, '') || 'unassigned';
        result.farmout_status = farmoutVal;
        result.status = 'pending'; // Valid for database constraint
        // Also set farmout_mode if not already set
        if (!result.farmout_mode && !d.eFarmOut && !d.farmoutMode) {
          result.farmout_mode = 'manual';
        }
        console.log(`📦 Mapped farmout status: ${d.status} -> status:pending, farmout_status:${farmoutVal}`);
      } else if (VALID_DB_STATUSES.includes(statusLower)) {
        // It's a valid regular status
        result.status = statusLower;
      } else if (UI_STATUS_MAP[statusLower]) {
        // Map UI status to valid database status
        result.status = UI_STATUS_MAP[statusLower];
        console.log(`📦 Mapped UI status: ${d.status} -> ${result.status}`);
      } else {
        // Unknown status - default to pending
        console.warn(`⚠️ Unknown status "${d.status}", defaulting to pending`);
        result.status = 'pending';
      }
    }
    
    if (d.puDate && d.puTime) {
      result.pickup_datetime = `${d.puDate}T${d.puTime}`;
    } else if (d.puDate) {
      result.pickup_datetime = d.puDate;
    }
    // Dropoff datetime
    if (d.puDate && d.doTime) {
      result.dropoff_datetime = `${d.puDate}T${d.doTime}`;
    }
    
    // Farmout fields - comprehensive mapping
    // Priority: eFarmOut dropdown > farmOption radio > fallback
    if (d.eFarmOut || d.farmoutMode) {
      // If eFarmOut dropdown has a value, use it
      const fMode = d.eFarmOut || d.farmoutMode;
      result.farmout_mode = fMode === 'in-house' ? 'in_house' : fMode;
      
      // If automatic mode and no farmout_status yet, set to unassigned
      if (fMode === 'automatic' && !result.farmout_status) {
        result.farmout_status = 'unassigned';
        console.log('📦 Auto farmout: setting farmout_status to unassigned');
      }
    } else if (d.farmOption) {
      // Fallback to radio button value
      if (d.farmOption === 'in-house') {
        result.farmout_mode = 'in_house';
      } else if (d.farmOption === 'farm-out') {
        // Farm-out selected but no eFarmOut mode specified, default to manual
        result.farmout_mode = result.farmout_mode || 'manual';
        // Ensure farmout_status is set
        if (!result.farmout_status) {
          result.farmout_status = 'unassigned';
        }
      }
    }
    
    // Additional farmout status from explicit fields (takes precedence)
    if (d.farmoutStatusCanonical || d.efarmStatus || d.eFarmStatus) {
      const status = d.farmoutStatusCanonical || d.efarmStatus || d.eFarmStatus;
      // Normalize the status to canonical form
      result.farmout_status = status.toLowerCase()
        .replace(/farm-out\s+/i, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '') || 'unassigned';
    }
    
    if (d.driver) result.assigned_driver_name = d.driver;
    
    // Driver and fleet vehicle from snapshot
    if (d.driverId) result.assigned_driver_id = d.driverId;
    if (d.driverName) result.assigned_driver_name = d.driverName;
    
    // Fleet vehicle ID - store in fleet_vehicle_id column
    if (d.fleetVehicleId) result.fleet_vehicle_id = d.fleetVehicleId;
    
    // Service type - store in both service_type and trip_type for compatibility
    if (d.serviceType) {
      result.service_type = d.serviceType;
      result.trip_type = d.serviceType;
    }
    
    // Vehicle type from details
    if (d.vehicleType) {
      result.vehicle_type = d.vehicleType;
    }
  }
  
  // Ensure organization_id is set
  if (!result.organization_id) {
    result.organization_id = getOrganizationId();
  }
  
  // Ensure booked_by_user_id is set (required by database constraint)
  if (!result.booked_by_user_id) {
    // Try to get from window.ENV or use the admin user as fallback
    const userId = (typeof window !== 'undefined' && window.ENV?.USER_ID) || 
                   (typeof window !== 'undefined' && window.ENV?.SUPABASE_USER_ID) ||
                   '99d34cd5-a593-4362-9846-db7167276592'; // Admin fallback
    result.booked_by_user_id = userId;
  }
  
  // Clear driver and vehicle when status is "unassigned" or "farmout unassigned"
  // This ensures unassigned reservations don't retain stale driver/vehicle assignments
  const statusForCheck = (result.status || '').toLowerCase();
  const farmoutStatusForCheck = (result.farmout_status || '').toLowerCase();
  const isUnassigned = statusForCheck === 'unassigned' || 
                       statusForCheck.includes('unassigned') ||
                       farmoutStatusForCheck === 'unassigned';
  
  if (isUnassigned) {
    console.log('📦 Status is unassigned - clearing driver and fleet vehicle');
    result.assigned_driver_id = null;
    result.assigned_driver_name = null;
    result.fleet_vehicle_id = null;
  }
  
  // Don't send empty strings for UUID fields
  if (result.account_id === '') delete result.account_id;
  if (result.assigned_driver_id === '') delete result.assigned_driver_id;
  
  console.log('📤 Transformed reservation payload:', result);
  return result;
}

// Reservations
export async function createReservation(payload) {
  // Transform to database schema
  const dbPayload = transformReservationPayload(payload);
  const rows = await request('/reservations', { method: 'POST', body: JSON.stringify(dbPayload) });
  return Array.isArray(rows) ? rows[0] : rows;
}
export async function updateReservation(id, payload) {
  // Transform to database schema
  const dbPayload = transformReservationPayload(payload);
  delete dbPayload.id; // Don't include id in PATCH body
  const rows = await request(`/reservations?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(dbPayload) });
  return Array.isArray(rows) ? rows[0] : rows;
}
export async function fetchReservations() { return await request('/reservations?select=*'); }
export async function getReservation(id) {
  // Check if id looks like a UUID (36 chars with dashes)
  const isUUID = typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  
  if (isUUID) {
    // Query by UUID id
    const rows = await request(`/reservations?id=eq.${encodeURIComponent(id)}&select=*`);
    if (Array.isArray(rows) && rows.length) return rows[0];
  }
  
  // Query by confirmation_number (common when selecting from list)
  const rows = await request(`/reservations?confirmation_number=eq.${encodeURIComponent(id)}&select=*`);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

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
    if (res.status === 401 || res.status === 403 || res.status === 404 || res.status === 405) {
      console.warn('[api-service] Vehicle type PATCH unauthorized or route missing; falling back to direct Supabase request');
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
  if (res.status === 401 || res.status === 403 || res.status === 404 || res.status === 405) {
    console.warn('[api-service] Vehicle type POST unauthorized or route missing; falling back to direct Supabase request');
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

export async function deleteFleetVehicle(id) {
  return await request(`/fleet_vehicles?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
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

/**
 * Transform passenger payload from camelCase to snake_case for database
 */
function transformPassengerPayload(payload) {
  console.log('🔄 transformPassengerPayload input:', JSON.stringify(payload));
  
  // Get first_name - check all possible keys
  const firstName = payload.firstName || payload.first_name || payload.name?.split(' ')[0] || '';
  const lastName = payload.lastName || payload.last_name || payload.name?.split(' ').slice(1).join(' ') || '';
  
  // Validate required fields
  if (!firstName.trim()) {
    console.warn('⚠️ Passenger first_name is empty, using placeholder');
  }
  
  const transformed = {
    organization_id: payload.organization_id || getOrganizationId(),
    first_name: firstName.trim() || 'Unknown',
    last_name: lastName.trim() || 'Passenger',
    phone: payload.phone || '',
    email: payload.email || '',
    alt_contact_name: payload.altContactName || payload.alt_contact_name || null,
    alt_contact_phone: payload.altContactPhone || payload.alt_contact_phone || null,
    notes: payload.notes || null
  };
  
  // Preserve id if updating
  if (payload.id) transformed.id = payload.id;
  
  console.log('🔄 transformPassengerPayload output:', JSON.stringify(transformed));
  return transformed;
}

/**
 * Transform booking agent payload from camelCase to snake_case for database
 */
function transformBookingAgentPayload(payload) {
  console.log('🔄 transformBookingAgentPayload input:', JSON.stringify(payload));
  
  // Get first_name - check all possible keys
  const firstName = payload.firstName || payload.first_name || payload.name?.split(' ')[0] || '';
  const lastName = payload.lastName || payload.last_name || payload.name?.split(' ').slice(1).join(' ') || '';
  
  // Validate required fields
  if (!firstName.trim()) {
    console.warn('⚠️ Booking agent first_name is empty, using placeholder');
  }
  
  const transformed = {
    organization_id: payload.organization_id || getOrganizationId(),
    company_name: payload.companyName || payload.company_name || null,
    first_name: firstName.trim() || 'Unknown',
    last_name: lastName.trim() || 'Agent',
    phone: payload.phone || '',
    email: payload.email || '',
    notes: payload.notes || null
  };
  
  // Preserve id if updating
  if (payload.id) transformed.id = payload.id;
  
  console.log('🔄 transformBookingAgentPayload output:', JSON.stringify(transformed));
  return transformed;
}

export async function savePassengerToSupabase(payload) {
  // Transform camelCase to snake_case
  const dbPayload = transformPassengerPayload(payload);
  if (dbPayload.id) { 
    const rows = await request(`/passengers?id=eq.${encodeURIComponent(dbPayload.id)}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(dbPayload) }); 
    return Array.isArray(rows) && rows.length ? rows[0] : rows; 
  } 
  const rows = await request('/passengers', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(dbPayload) }); 
  return Array.isArray(rows) && rows.length ? rows[0] : rows; 
}

export async function saveBookingAgentToSupabase(payload) {
  // Transform camelCase to snake_case
  const dbPayload = transformBookingAgentPayload(payload);
  
  if (dbPayload.id) { 
    const rows = await request(`/booking_agents?id=eq.${encodeURIComponent(dbPayload.id)}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(dbPayload) }); 
    return Array.isArray(rows) && rows.length ? rows[0] : rows; 
  } 
  const rows = await request('/booking_agents', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(dbPayload) }); 
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

/**
 * Reset confirmation counter - clears localStorage tracker so next conf# uses company settings start number
 */
export function resetConfirmationCounterToStart() {
  try {
    // Clear the confirmation counter from localStorage
    localStorage.removeItem('relia_confirmation_counter');
    
    // Also clear the lastUsedConfirmationNumber from company settings
    const settingsRaw = localStorage.getItem('relia_company_settings');
    if (settingsRaw) {
      const settings = JSON.parse(settingsRaw);
      delete settings.lastUsedConfirmationNumber;
      localStorage.setItem('relia_company_settings', JSON.stringify(settings));
    }
    
    console.log('🔢 Confirmation counter reset to start number');
    return true;
  } catch (e) {
    console.warn('⚠️ Failed to reset confirmation counter:', e);
    return false;
  }
}

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
  deleteFleetVehicle,
  fetchFleetVehicles,
  deleteVehicleTypeImage,
  fetchVehicleTypeImages,
  uploadVehicleTypeImage,
  updateVehicleTypeImage,
  saveAccountToSupabase,
  fetchAccounts
};