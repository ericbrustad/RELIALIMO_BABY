// API Service for RELIA🐂LIMO™
import { getSupabaseConfig, initSupabase } from './config.js';

// Minimal REST helper with safe session refresh
const SESSION_KEY = 'supabase_session';
let refreshPromise = null;

// Persist resolved org/user so UI layers can reuse without guessing
const IDENTITY_WALLET_KEY = 'relia_identity_wallet';

function saveIdentityWallet(payload) {
  if (!payload) return;
  try {
    const snapshot = {
      organizationId: payload.organizationId || payload.organization_id || null,
      userId: payload.userId || payload.user_id || null,
      email: payload.email || null,
      ts: Date.now()
    };
    localStorage.setItem(IDENTITY_WALLET_KEY, JSON.stringify(snapshot));
  } catch (e) {
    console.warn('⚠️ Unable to persist identity wallet:', e);
  }
}

function loadIdentityWallet() {
  try {
    const raw = localStorage.getItem(IDENTITY_WALLET_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      organizationId: parsed.organizationId || parsed.organization_id || null,
      userId: parsed.userId || parsed.user_id || null,
      email: parsed.email || null,
      ts: parsed.ts || null
    };
  } catch (e) {
    console.warn('⚠️ Unable to read identity wallet:', e);
    return null;
  }
}

const getSession = () => {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const setSession = (session) => {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    if (session?.access_token) {
      localStorage.setItem('supabase_access_token', session.access_token);
    }
  } catch (e) {
    console.warn('⚠️ Unable to persist session:', e);
  }
};

const clearSession = () => {
  try {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem('supabase_access_token');
  } catch (e) {
    console.warn('⚠️ Unable to clear session:', e);
  }
};

const isExpired = (session) => {
  if (!session?.expires_at) return true;
  const now = Math.floor(Date.now() / 1000);
  return now >= (session.expires_at - 60); // 60s skew buffer
};

async function refreshToken() {
  if (refreshPromise) return refreshPromise;
  let session = getSession();

  // Try migrating from the SDK key if our cache is missing the refresh token
  if (!session?.refresh_token) {
    try {
      const sdkRaw = localStorage.getItem('sb-siumiadylwcrkaqsfwkj-auth-token');
      if (sdkRaw) {
        const parsed = JSON.parse(sdkRaw);
        const migrated = parsed.currentSession || parsed;
        if (migrated?.refresh_token) {
          setSession(migrated);
          session = migrated;
        }
      }
    } catch (e) {
      console.warn('⚠️ Failed to migrate refresh token from SDK key:', e);
    }
  }

  if (!session?.refresh_token || !`${session.refresh_token}`.trim()) {
    const err = new Error('NO_REFRESH_TOKEN');
    err.status = 401;
    throw err;
  }

  const { url, anonKey } = getSupabaseConfig();
  const body = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: session.refresh_token });

  const doFetch = async () => {
    const response = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json'
      },
      body
    });

    if (response.status === 200) {
      const data = await response.json();
      const expires_at = Math.floor(Date.now() / 1000) + (data.expires_in ?? 3600);
      setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token ?? session.refresh_token,
        expires_at,
        user: data.user ?? session.user
      });
      return getSession();
    }

    if (response.status === 400) {
      const body = await response.text().catch(() => '');
      clearSession();
      const err = new Error('REFRESH_INVALID');
      err.status = 400;
      err.details = body;
      throw err;
    }

    if (response.status === 429) {
      const err = new Error('RATE_LIMITED');
      err.status = 429;
      throw err;
    }

    const text = await response.text().catch(() => '');
    const err = new Error(`REFRESH_FAILED_${response.status}:${text}`);
    err.status = response.status;
    err.details = text;
    throw err;
  };

  refreshPromise = doFetch().finally(() => {
    setTimeout(() => { refreshPromise = null; }, 0);
  });

  return refreshPromise;
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const jitter = (base) => base + Math.floor(Math.random() * base);

// Reset confirmation counter to starting point defined in company settings
export function resetConfirmationCounterToStart() {
  try {
    const settingsKey = 'relia_company_settings';
    const raw = localStorage.getItem(settingsKey);
    const settings = raw ? JSON.parse(raw) : {};
    const startRaw = settings.confirmationStartNumber;
    const start = Number.isFinite(parseInt(startRaw, 10)) && parseInt(startRaw, 10) > 0
      ? parseInt(startRaw, 10)
      : 100000;

    settings.confirmationStartNumber = start;
    settings.lastUsedConfirmationNumber = start - 1;
    localStorage.setItem(settingsKey, JSON.stringify(settings));
    console.log('🔁 Confirmation counter reset to start:', start);
    return start;
  } catch (e) {
    console.warn('⚠️ Unable to reset confirmation counter:', e);
    return null;
  }
}

export async function robustRefresh(maxTries = 3) {
  let delay = 250;
  for (let i = 0; i < maxTries; i += 1) {
    try {
      return await refreshToken();
    } catch (e) {
      if (e.message === 'RATE_LIMITED') {
        await sleep(jitter(delay));
        delay *= 2;
        continue;
      }
      throw e;
    }
  }
  throw new Error('REFRESH_RATE_LIMITED');
}

export async function apiFetch(path, { method = 'GET', headers = {}, body, retry = true } = {}) {
  let session = getSession();
  const { url, anonKey } = getSupabaseConfig();
  const fullUrl = path.startsWith('http') ? path : `${url}${path}`;

  // Prefer the SDK-managed session refresher when available (auth-guard).
  // This avoids refresh-token rotation races between multiple refresh implementations.
  try {
    if (typeof window !== 'undefined' && typeof window.__reliaGetValidSession === 'function') {
      const sdkSession = await window.__reliaGetValidSession({ minimumRemainingMs: 120_000 });
      if (sdkSession?.access_token) {
        session = sdkSession;
        setSession(sdkSession);
      }
    }
  } catch (e) {
    console.warn('⚠️ apiFetch: SDK session helper failed:', e);
  }

  const h = {
    apikey: anonKey,
    Accept: 'application/json',
    ...headers
  };

  // Use the best available bearer token: SDK session -> cached session -> anon.
  if (session?.access_token) {
    h.Authorization = `Bearer ${session.access_token}`;
  } else {
    h.Authorization = `Bearer ${anonKey}`;
  }

  const response = await fetch(fullUrl, { method, headers: h, body });

  // If auth failed, try a single forced refresh via the SDK (if present) and retry once.
  if ((response.status === 401 || response.status === 403) && retry) {
    try {
      if (typeof window !== 'undefined' && typeof window.__reliaGetValidSession === 'function') {
        const forced = await window.__reliaGetValidSession({ force: true, minimumRemainingMs: 0 });
        if (forced?.access_token) {
          setSession(forced);
          const h2 = { ...h, Authorization: `Bearer ${forced.access_token}` };
          return await fetch(fullUrl, { method, headers: h2, body });
        }
      }
    } catch (refreshErr) {
      console.warn('⚠️ apiFetch SDK forced refresh failed:', refreshErr?.message || refreshErr);
    }
  }

  return response;
}

// Local dev mode toggle used by dev-mode-banner.js used by dev-mode-banner.js
const DEV_MODE_STORAGE_KEY = 'relia_local_dev_mode';

export function isLocalDevModeEnabled() {
  try {
    return localStorage.getItem(DEV_MODE_STORAGE_KEY) === 'true';
  } catch (e) {
    console.warn('⚠️ Unable to read dev mode flag:', e);
    return false;
  }
}

export function setLocalDevModeEnabled(enabled) {
  try {
    localStorage.setItem(DEV_MODE_STORAGE_KEY, enabled ? 'true' : 'false');
  } catch (e) {
    console.warn('⚠️ Unable to persist dev mode flag:', e);
  }
}

let supabaseClient = null;
let lastApiError = null;

// Valid driver table columns based on database schema
const VALID_DRIVER_COLUMNS = [
  'id', 'organization_id', 'user_id', 'first_name', 'last_name', 'email', 'contact_email',
  'cell_phone', 'cell_phone_provider', 'home_phone', 'fax', 'other_phone', 'other_phone_provider',
  'primary_address', 'address_line2', 'city', 'state', 'address_zip', 'postal_code', 'country',
  'license_number', 'license_state', 'license_exp_date', 'badge_id', 'badge_exp_date',
  'ssn', 'dob', 'tlc_license_number', 'tlc_license_exp_date', 'payroll_id',
  'hire_date', 'termination_date', 'driver_level', 'status', 'type', 'is_active', 'is_vip',
  'suppress_auto_notifications', 'show_call_email_dispatch', 'quick_edit_dispatch',
  'include_phone_home', 'include_phone_cell', 'include_phone_other',
  'notify_email', 'notify_fax', 'notify_sms', 'include_phone_1', 'include_phone_2', 'include_phone_3',
  'driver_alias', 'driver_group', 'assigned_vehicle_id', 'dispatch_display_name', 'trip_sheets_display_name',
  'driver_notes', 'web_username', 'web_password', 'web_access',
  'trip_regular_rate', 'trip_overtime_rate', 'trip_double_time_rate',
  'travel_regular_rate', 'travel_overtime_rate', 'travel_double_time_rate',
  'passenger_regular_rate', 'passenger_overtime_rate', 'passenger_double_time_rate',
  'voucher_fee', 'extra_nv_1', 'extra_nv_2', 'extra_nv_3', 'extra_fl_1', 'extra_fl_2', 'extra_fl_3',
  'created_by', 'updated_by', 'created_at', 'updated_at',
  'driver_status', 'affiliate_id', 'affiliate_name'
];

/**
 * Sanitize driver data to only include valid database columns
 * and fix data types as needed
 */
function sanitizeDriverData(data) {
  const sanitized = {};
  
  for (const [key, value] of Object.entries(data)) {
    // Only include columns that exist in the database
    if (!VALID_DRIVER_COLUMNS.includes(key)) {
      console.log(`⚠️ Removing unknown driver field: ${key}`);
      continue;
    }
    
    // Skip undefined values
    if (value === undefined) continue;
    
    // Handle empty strings for UUID fields - convert to null
    if ((key === 'assigned_vehicle_id' || key === 'affiliate_id' || key === 'user_id') && value === '') {
      sanitized[key] = null;
      continue;
    }
    
    // Handle empty strings for date fields - convert to null
    if (key.endsWith('_date') && value === '') {
      sanitized[key] = null;
      continue;
    }
    
    sanitized[key] = value;
  }
  
  return sanitized;
}

function resolveAdminOrgId() {
  const env = (typeof window !== 'undefined' && window.ENV) ? window.ENV : {};
  const candidate = env.ADMIN_ORG_ID || env.ADMIN_UUID || env.SUPABASE_ADMIN_ORG_ID || env.ORG_ID ||
    (typeof process !== 'undefined' ? (
      process.env?.ADMIN_ORG_ID ||
      process.env?.ADMIN_UUID ||
      process.env?.SUPABASE_ADMIN_ORG_ID ||
      process.env?.ORG_ID
    ) : null);

  const fallbackOrgId = '54eb6ce7-ba97-4198-8566-6ac075828160';
  if (!candidate || candidate === '00000000-0000-0000-0000-000000000000') return fallbackOrgId;
  return candidate;
}

export function getLastApiError() {
  return lastApiError;
}

function describeSupabaseError(error, context = '') {
  if (!error) return { message: 'Unknown error' };
  const info = {
    context,
    message: error.message || error.msg || 'Unknown error',
    code: error.code,
    status: error.status,
    details: error.details,
    hint: error.hint
  };
  if (error.body) info.body = error.body;
  if (error.stack) info.stack = error.stack;
  return info;
}

// Expose token validation so UI layers can force refresh before writes
export { ensureValidToken };

/**
 * Check if JWT token is expired and attempt to refresh it
 */
async function ensureValidToken(client) {
  try {
    // Development mode bypass
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      console.log('🔧 Development mode: Bypassing token validation');
      return true;
    }

    // If auth-guard is managing sessions (supabase-js), delegate validation/refresh to it.
    try {
      if (typeof window !== 'undefined' && typeof window.__reliaGetValidSession === 'function') {
        await window.__reliaGetValidSession({ minimumRemainingMs: 5 * 60_000 });
        return true;
      }
    } catch (e) {
      console.warn('⚠️ ensureValidToken: SDK session helper failed:', e);
    }
    
    const session = localStorage.getItem('supabase_session');
    if (!session) return true; // No session yet, allow to proceed
    
    const parsed = JSON.parse(session);
    if (!parsed.access_token || parsed.access_token.startsWith('offline-')) {
      // Offline token or demo account, skip refresh
      return true;
    }
    
    // Decode JWT to check expiration
    const parts = parsed.access_token.split('.');
    if (parts.length !== 3) return true; // Invalid JWT format, but allow to proceed
    
    try {
      const decoded = JSON.parse(atob(parts[1]));
      const expiresAt = decoded.exp * 1000; // Convert to milliseconds
      const now = Date.now();
      const timeUntilExpiry = expiresAt - now;
      
      // If already expired or expires in less than 5 minutes, refresh
      if (timeUntilExpiry < 5 * 60 * 1000) {
        const isExpired = timeUntilExpiry <= 0;
        console.warn(isExpired ? '⚠️ Token EXPIRED, attempting refresh...' : '⚠️ Token expiring soon, attempting refresh...');
        
        // Only try to refresh if we have a refresh token
        if (parsed.refresh_token && !parsed.refresh_token.startsWith('offline-')) {
          const refreshResult = await refreshAccessToken(client, parsed.refresh_token);
          if (refreshResult.success) {
            console.log('✅ Token refreshed successfully');
            return true;
          }
        }
        
        // If token is expired AND refresh failed, handle it
        if (isExpired) {
          console.error('❌ Token expired and refresh failed');
          
          // If in a popup or iframe, just return false - don't block UI
          const isPopup = window.opener !== null;
          const isIframe = window.self !== window.top;
          
          if (isPopup || isIframe) {
            console.warn('⚠️ Session expired in popup/iframe - operations will fail');
            return false;
          }
          
          // Main window - redirect to login (but only once)
          if (!window._reliaSessionExpiredRedirecting) {
            window._reliaSessionExpiredRedirecting = true;
            window.location.href = '/auth.html';
          }
          return false;
        }
        
        // If just expiring soon but refresh failed, allow to proceed
        console.warn('⚠️ Token refresh failed, but will attempt API call');
        return true;
      }
      
      return true;
    } catch (decodeError) {
      console.warn('⚠️ Could not decode JWT:', decodeError);
      return true; // Allow to proceed even if we can't decode
    }
  } catch (error) {
    console.error('❌ Token validation error:', error);
    return true; // Allow to proceed even if validation fails
  }
}

/**
 * Refresh access token using refresh token
 */
async function refreshAccessToken(client, providedRefreshToken) {
  try {
    // Development mode bypass
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      console.log('🔧 Development mode: Bypassing token refresh');
      return { success: true, message: 'Development mode bypass' };
    }
    
    if (!providedRefreshToken) {
      console.warn('⚠️ No refresh token available');
      return { success: false, error: 'No refresh token' };
    }

    // Prefer the SDK-managed refresh when available to avoid refresh-token rotation races.
    try {
      if (typeof window !== 'undefined' && typeof window.__reliaGetValidSession === 'function') {
        const session = await window.__reliaGetValidSession({ force: true, minimumRemainingMs: 0 });
        if (session?.access_token) {
          setSession(session);
          return { success: true, message: 'SDK refreshSession succeeded' };
        }
      }
    } catch (e) {
      console.warn('⚠️ refreshAccessToken: SDK refresh failed:', e);
    }

    // Ensure the stored session has a refresh token before calling refreshToken()
    const existing = getSession();
    if (!existing?.refresh_token) {
      setSession({
        ...(existing || {}),
        refresh_token: providedRefreshToken
      });
    }

    const refreshed = await refreshToken();
    return { success: true, session: refreshed };
  } catch (error) {
    console.error('❌ Token refresh failed:', error);
    return { success: false, error };
  }
}

// SDK storage key pattern
const SDK_SESSION_KEY = 'sb-siumiadylwcrkaqsfwkj-auth-token';

function generateDevUuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Lightweight fallback UUID v4-ish
  const tpl = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
  return tpl.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function buildDevUser() {
  const id = generateDevUuid();
  return {
    id,
    email: 'dev@localhost.local',
    created_at: new Date().toISOString(),
    external_ref: `dev-user-${Date.now()}`
  };
}

async function getOrgContextOrThrow(client) {
  console.log('🔐 getOrgContextOrThrow starting...');
  console.log('🔐 Client available:', !!client);

  // If we already cached identity, warm it for downstream callers (does not short-circuit real checks)
  const cachedIdentity = loadIdentityWallet();
  
  // Development mode bypass
  // Attempt real auth/user context first (even on localhost) before any dev bypass
  try {
    // First, try to refresh session if needed (especially important for popups)
    try {
      // Check our custom key first, then fall back to SDK key
      let session = localStorage.getItem('supabase_session');
      if (!session) {
        session = localStorage.getItem(SDK_SESSION_KEY);
        if (session) {
          console.log('ℹ️ Found session in SDK storage key');
          // Migrate to our key
          const parsed = JSON.parse(session);
          const actualSession = parsed.currentSession || parsed;
          if (actualSession?.access_token) {
            localStorage.setItem('supabase_session', JSON.stringify(actualSession));
            session = JSON.stringify(actualSession);
          }
        }
      }
      console.log('📋 Session exists:', !!session);
      if (session) {
        const parsed = JSON.parse(session);
        // Check if token is expired or expiring soon
        if (parsed.access_token && !parsed.access_token.startsWith('offline-')) {
          const parts = parsed.access_token.split('.');
          if (parts.length === 3) {
            try {
              const decoded = JSON.parse(atob(parts[1]));
              const expiresAt = decoded.exp * 1000;
              const now = Date.now();
              const minutesUntilExpiry = Math.round((expiresAt - now) / 60000);
              console.log('⏱️ Token expires in:', minutesUntilExpiry, 'minutes');
              // If token expires in less than 2 minutes or is already expired
              if (expiresAt - now < 2 * 60 * 1000) {
                console.log('🔄 Token expiring/expired, attempting refresh before auth check...');
                const refreshResult = await refreshAccessToken(client, parsed.refresh_token);
                if (refreshResult.success) {
                  console.log('✅ Token refreshed successfully');
                } else {
                  console.warn('⚠️ Token refresh failed:', refreshResult.error);
                }
              }
            } catch (e) {
              console.warn('⚠️ Could not decode token:', e);
            }
          }
        }
      }
    } catch (e) {
      console.warn('⚠️ Pre-auth token refresh check failed:', e);
    }
    
    console.log('👤 Getting user...');
    const { data: { user }, error: userError } = await client.auth.getUser();
    console.log('👤 User result:', user?.id || 'null', 'error:', userError?.message || 'none');
    
    if (userError) {
      // Check if it's a permission error related to users table
      if (userError.message && userError.message.includes('permission denied for table users')) {
        console.warn('⚠️ Users table permission denied - using development fallback');
        // Create a fake user for development
        const devUser = buildDevUser();
        const devOrgId = resolveAdminOrgId();
        saveIdentityWallet({ userId: devUser.id, organizationId: devOrgId, email: devUser.email });
        console.log('🔧 Using development user context:', devUser.id);
        return { user: devUser, organizationId: devOrgId, userId: devUser.id };
      }
      throw userError;
    }
    
    if (!user) {
      console.warn('⚠️ No user found - using development fallback');
      const devUser = buildDevUser();
      const devOrgId = resolveAdminOrgId();
      saveIdentityWallet({ userId: devUser.id, organizationId: devOrgId, email: devUser.email });
      return { user: devUser, organizationId: devOrgId, userId: devUser.id };
    }

    console.log('🏢 Getting organization membership...');
    const { data: membershipList, error: membershipError } = await client
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id);

    const membership = Array.isArray(membershipList) && membershipList.length ? membershipList[0] : null;
    console.log('🏢 Membership result:', membership?.organization_id || 'null', 'error:', membershipError?.message || 'none');
    
    // If membership is missing, fall back to cached wallet or dev org (when allowed)
    if (membershipError || !membership?.organization_id) {
      console.warn('⚠️ No organization membership found - considering fallbacks');
      let fallbackOrgId = cachedIdentity?.organizationId || null;

      if (!fallbackOrgId && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
        console.log('🔧 Development fallback: Using admin organization context (no membership found)');
        fallbackOrgId = resolveAdminOrgId();
      }

      saveIdentityWallet({ userId: user.id, organizationId: fallbackOrgId, email: user.email });
      return { user, organizationId: fallbackOrgId, userId: user.id };
    }

    saveIdentityWallet({ userId: user.id, organizationId: membership.organization_id, email: user.email });
    return { user, organizationId: membership.organization_id, userId: user.id };
    
  } catch (error) {
    // Catch any other authentication errors and provide development fallback when on localhost only
    console.error('❌ Authentication failed:', error);

    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocalhost && error.message && (
        error.message.includes('permission denied') || 
        error.message.includes('RLS') ||
        error.message.includes('not authenticated')
    )) {
      console.warn('⚠️ Database permission error - using development fallback (localhost only)');
      const devUser = buildDevUser();
      const devOrgId = resolveAdminOrgId();
      saveIdentityWallet({ userId: devUser.id, organizationId: devOrgId, email: devUser.email });
      return { user: devUser, organizationId: devOrgId, userId: devUser.id };
    }

    // For other errors, still throw
    throw error;
  }
}

/**
 * Initialize the Supabase client
 */
export async function setupAPI() {
  try {
    if (supabaseClient) return supabaseClient;
    supabaseClient = await initSupabase();
    
    // Ensure token is valid on startup (non-blocking)
    const isValid = await ensureValidToken(supabaseClient);
    if (!isValid) {
      console.warn('⚠️ Token validation indicated potential issues, but proceeding');
    }
    
    console.log('✅ Supabase API initialized successfully');
    return supabaseClient;
  } catch (error) {
    console.error('❌ Failed to initialize Supabase:', error);
    throw error;
  }
}

/**
 * Get the Supabase client instance
 */
export function getSupabaseClient() {
  if (!supabaseClient) {
    console.warn('⚠️ Supabase client not initialized. Call setupAPI() first.');
  }
  return supabaseClient;
}

const DEV_DRIVERS_KEY = 'dev_drivers';
const isDevHost = () => {
  // If FORCE_DATABASE_ON_LOCALHOST is true, never use dev/localStorage mode
  if (window.ENV?.FORCE_DATABASE_ON_LOCALHOST) return false;
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
};

const loadDevDrivers = () => {
  if (!isDevHost()) return [];
  try {
    const raw = localStorage.getItem(DEV_DRIVERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn('⚠️ Failed to read dev drivers:', e);
    return [];
  }
};

const saveDevDrivers = (drivers) => {
  if (!isDevHost()) return;
  try {
    localStorage.setItem(DEV_DRIVERS_KEY, JSON.stringify(drivers || []));
  } catch (e) {
    console.warn('⚠️ Failed to persist dev drivers:', e);
  }
};

// Direct REST fetch for drivers using apiFetch with auto refresh/retry
export async function listDrivers({ limit = 50, offset = 0 } = {}) {
  const res = await apiFetch(`/rest/v1/drivers?select=*&order=updated_at.desc&limit=${limit}&offset=${offset}`);
  if (!res.ok) throw new Error(`listDrivers failed: ${res.status}`);
  return res.json();
}

// Lightweight driver list for dropdowns (active only, name fallback)
// Includes assigned_vehicle_id for auto-selection of driver's assigned vehicle
export async function listDriverNames({ limit = 200, offset = 0 } = {}) {
  const res = await apiFetch(`/rest/v1/drivers?select=id,dispatch_display_name,first_name,last_name,status,assigned_vehicle_id&order=last_name.asc,first_name.asc&limit=${limit}&offset=${offset}`);
  if (!res.ok) throw new Error(`listDriverNames failed: ${res.status}`);
  return res.json();
}

/**
 * Example: Fetch all drivers
 */
export async function fetchDrivers() {
  const devData = loadDevDrivers();
  try {
    lastApiError = null;
    const data = await listDrivers();
    if (Array.isArray(data) && data.length) return data;
    if (devData.length) {
      console.warn('⚠️ Using dev drivers fallback (Supabase returned empty)');
      return devData;
    }
    return data;
  } catch (error) {
    console.error('Error fetching drivers:', error);
    lastApiError = error;
    if (devData.length) {
      console.warn('⚠️ Using dev drivers fallback (Supabase fetch failed)');
      return devData;
    }
    return null;
  }
}

/**
 * Example: Create new driver
 */
export async function createDriver(driverData) {
  const client = getSupabaseClient();
  if (!client || isDevHost()) {
    const existing = loadDevDrivers();
    const now = new Date().toISOString();
    const newDriver = {
      id: driverData.id || `dev-driver-${Date.now()}`,
      ...driverData,
      organization_id: driverData.organization_id || resolveAdminOrgId(),
      created_at: driverData.created_at || now,
      updated_at: driverData.updated_at || now
    };
    const next = existing.filter(d => d.id !== newDriver.id).concat(newDriver);
    saveDevDrivers(next);
    return newDriver;
  }
  
  try {
    const timestamp = new Date().toISOString();
    // Sanitize driver data - remove fields that aren't in the database schema
    const payload = sanitizeDriverData({
      ...driverData,
      created_at: driverData.created_at || timestamp,
      updated_at: driverData.updated_at || timestamp
    });

    console.log('📤 createDriver payload:', payload);

    const res = await apiFetch('/rest/v1/drivers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errorBody = await res.text();
      console.error('❌ createDriver API error:', res.status, errorBody);
      throw new Error(`createDriver failed: ${res.status} - ${errorBody}`);
    }
    const data = await res.json();
    return Array.isArray(data) ? data[0] || null : data;
  } catch (error) {
    console.error('Error creating driver:', error);
    lastApiError = error;
    return null;
  }
}

/**
 * Example: Update driver
 */
export async function updateDriver(driverId, driverData) {
  const client = getSupabaseClient();
  if (!client || isDevHost()) {
    const existing = loadDevDrivers();
    const now = new Date().toISOString();
    const updated = {
      ...driverData,
      id: driverId,
      updated_at: driverData.updated_at || now
    };
    const next = existing.map(d => d.id === driverId ? { ...d, ...updated } : d);
    saveDevDrivers(next);
    return updated;
  }
  
  try {
    // Sanitize driver data - remove fields that aren't in the database schema
    const payload = sanitizeDriverData({
      ...driverData,
      updated_at: driverData.updated_at || new Date().toISOString()
    });

    console.log('📤 updateDriver payload:', payload);

    const res = await apiFetch(`/rest/v1/drivers?id=eq.${encodeURIComponent(driverId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errorBody = await res.text();
      console.error('❌ updateDriver API error:', res.status, errorBody);
      throw new Error(`updateDriver failed: ${res.status} - ${errorBody}`);
    }
    const data = await res.json();
    return Array.isArray(data) ? data[0] || null : data;
  } catch (error) {
    console.error('Error updating driver:', error);
    lastApiError = error;
    return null;
  }
}

/**
 * Example: Delete driver
 */
export async function deleteDriver(driverId) {
  const client = getSupabaseClient();
  if (!client || isDevHost()) {
    const existing = loadDevDrivers();
    saveDevDrivers(existing.filter(d => d.id !== driverId));
    return true;
  }
  
  try {
    const { data, error } = await client
      .from('drivers')
      .delete()
      .eq('id', driverId);
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error deleting driver:', error);
    return null;
  }
}

function normalizeSpaces(value) {
  return value.replace(/\s+/g, ' ').trim();
}

// ============================================================================
// AFFILIATE CRUD OPERATIONS (for 'affiliates' table from import)
// ============================================================================

/**
 * Fetch all affiliates from the affiliates table
 */
export async function fetchAffiliates() {
  const client = getSupabaseClient();
  console.log('🔍 fetchAffiliates - client:', client ? 'initialized' : 'NULL');
  if (!client) return null;

  try {
    lastApiError = null;
    
    // Ensure token is valid before making request
    const isValid = await ensureValidToken(client);
    if (!isValid) {
      console.warn('⚠️ Token validation failed');
      if (confirm('Your session has expired. Would you like to log in again?')) {
        window.location.href = 'auth.html';
      }
      return null;
    }
    
    const { data, error } = await client
      .from('affiliates')
      .select('*')
      .order('company_name', { ascending: true });

    console.log('🔍 fetchAffiliates - data:', data?.length, 'error:', error);
    
    // Handle JWT expiration
    if (error && error.status === 401 && error.message?.includes('JWT')) {
      console.warn('⚠️ JWT expired - clearing session');
      localStorage.removeItem('supabase_session');
      localStorage.removeItem('supabase_access_token');
      // Optionally redirect to login
      if (confirm('Your session has expired. Would you like to log in again?')) {
        window.location.href = 'auth.html';
      }
      return null;
    }
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching affiliates:', error);
    lastApiError = error;
    return null;
  }
}

/**
 * Create a new affiliate
 */
export async function createAffiliate(affiliateData) {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    lastApiError = null;
    const { data, error } = await client
      .from('affiliates')
      .insert([affiliateData])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating affiliate:', error);
    lastApiError = error;
    return null;
  }
}

/**
 * Update an existing affiliate
 */
export async function updateAffiliate(affiliateId, affiliateData) {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    lastApiError = null;
    const { data, error } = await client
      .from('affiliates')
      .update(affiliateData)
      .eq('id', affiliateId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating affiliate:', error);
    lastApiError = error;
    return null;
  }
}

/**
 * Delete an affiliate
 */
export async function deleteAffiliate(affiliateId) {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    lastApiError = null;
    const { data, error } = await client
      .from('affiliates')
      .delete()
      .eq('id', affiliateId);

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error deleting affiliate:', error);
    lastApiError = error;
    return null;
  }
}

// ============================================================================
// VEHICLE TYPE CRUD OPERATIONS
// ============================================================================

function sanitizeVehiclePayload(payload) {
  const cleaned = { ...payload };
  Object.keys(cleaned).forEach((key) => {
    if (cleaned[key] === undefined) {
      delete cleaned[key];
    }
  });
  return cleaned;
}

export async function fetchVehicleTypes(options = {}) {
  const { includeInactive = false } = options;
  const client = getSupabaseClient();
  if (!client) return [];

  try {
    lastApiError = null;
    const forcedOrgId = (typeof window !== 'undefined' && (window.VEHICLE_FORCE_ORG_ID || window.FORCED_ORG_ID || window.ENV?.FORCE_VEHICLE_ORG_ID)) || null;
    let organizationId = forcedOrgId || null;

    if (!organizationId) {
      const ctx = await getOrgContextOrThrow(client);
      organizationId = ctx.organizationId;
    }

    // If still no org, bail to avoid null filter errors
    if (!organizationId) {
      const wallet = loadIdentityWallet();
      organizationId = wallet?.organizationId || null;
    }

    if (!organizationId) {
      console.warn('⚠️ No organization_id; skipping Supabase vehicle type fetch.');
      return [];
    }

    const { data, error } = await client
      .from('vehicle_types')
      .select('*')
      .eq('organization_id', organizationId)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) throw error;
    const normalized = (data || []).map((v) => ({
      ...v,
      rates: v?.metadata?.rates ?? null,
      images: v?.metadata?.images ?? null
    }));

    if (includeInactive) return normalized;

    return normalized.filter((v) => {
      const status = (v.status || '').toString().toUpperCase();
      if (!status) return true; // treat missing as active
      return status === 'ACTIVE';
    });
  } catch (error) {
    console.error('Error fetching vehicle types:', error);
    lastApiError = error;
    return [];
  }
}

// Fetch active vehicles from the "Company Resources > Vehicles" list
// Filters to the current organization and only includes rows marked active
export async function fetchActiveVehicles(options = {}) {
  const { includeInactive = false, limit = 500 } = options;
  const client = getSupabaseClient();

  // ALWAYS load localStorage fleet - it contains real fleet vehicles created locally
  const loadLocalFleet = () => {
    try {
      const raw = localStorage.getItem('cr_fleet');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || !parsed.length) return [];

      return parsed.map((v, idx) => ({
        id: v.id || `local-fleet-${idx}`,
        veh_disp_name: v.veh_disp_name || v.plate || v.name || v.type || 'Vehicle',
        veh_title: v.veh_title || v.type || v.name || v.plate,
        veh_type: v.veh_type || v.vehicle_type || v.type || v.name,
        vehicle_type: v.vehicle_type || v.veh_type,
        vehicle_type_id: v.vehicle_type_id,
        status: v.status || 'ACTIVE',
        veh_active: v.veh_active ?? 'Y',
        unit_number: v.unit_number,
        make: v.make,
        model: v.model,
        year: v.year,
        color: v.color,
        license_plate: v.license_plate,
        assigned_driver_id: v.assigned_driver_id,
        veh_pax_capacity: v.veh_pax_capacity || v.passenger_capacity
      }));
    } catch (e) {
      console.warn('⚠️ Failed to load local fleet:', e);
      return [];
    }
  };

  // Always load local fleet first
  const localVehicles = loadLocalFleet();

  if (!client) {
    if (localVehicles.length) return localVehicles;
    return [];
  }

  try {
    lastApiError = null;
    const forcedOrgId = (typeof window !== 'undefined' && (window.VEHICLE_FORCE_ORG_ID || window.FORCED_ORG_ID || window.ENV?.FORCE_VEHICLE_ORG_ID)) || null;
    let organizationId = forcedOrgId || null;

    if (!organizationId) {
      const { organizationId: ctxOrg } = await getOrgContextOrThrow(client);
      organizationId = ctxOrg;
    }

    if (!organizationId) {
      const wallet = loadIdentityWallet();
      organizationId = wallet?.organizationId || organizationId;
    }

    if (!organizationId) {
      console.warn('⚠️ No organization_id; using local fleet only.');
      return localVehicles.length ? localVehicles : [];
    }

    const { data, error } = await client
      .from('vehicles')
      .select('*')
      .eq('organization_id', organizationId)
      .order('veh_disp_name', { ascending: true })
      .order('veh_title', { ascending: true })
      .order('veh_type', { ascending: true })
      .limit(limit);

    if (error) throw error;

    const filtered = includeInactive
      ? (data || [])
      : (data || []).filter(v => {
          const flag = (v?.veh_active || v?.status || '').toString().trim().toUpperCase();
          if (!flag) return true; // treat empty as active
          return ['Y', 'YES', 'ACTIVE', 'TRUE', 'T', '1'].includes(flag);
        });

    // ALWAYS merge Supabase and localStorage - don't just return one or the other
    const seenIds = new Set();
    const merged = [];
    
    // Add Supabase vehicles first
    for (const v of filtered) {
      if (v.id) seenIds.add(v.id);
      merged.push(v);
    }
    
    // Add local vehicles that aren't already in Supabase
    for (const v of localVehicles) {
      if (!v.id || !seenIds.has(v.id)) {
        if (v.id) seenIds.add(v.id);
        merged.push(v);
      }
    }
    
    console.log(`✅ fetchActiveVehicles: ${filtered.length} from Supabase, ${localVehicles.length} from localStorage, ${merged.length} total`);
    return merged;

  } catch (error) {
    console.error('Error fetching active vehicles:', error);
    lastApiError = error;

    // On error, return local vehicles as fallback
    if (localVehicles.length) {
      console.warn('⚠️ Using local fleet fallback because Supabase fetch failed');
      return localVehicles;
    }

    return [];
  }
}

// Lightweight active vehicles for dropdowns (id + display fields)
export async function listActiveVehiclesLight({ limit = 200, offset = 0 } = {}) {
  const activeStatuses = 'ACTIVE,AVAILABLE,IN_USE';
  const forcedOrgId = (typeof window !== 'undefined' && (window.VEHICLE_FORCE_ORG_ID || window.FORCED_ORG_ID || window.ENV?.FORCE_VEHICLE_ORG_ID)) || null;
  let orgFilter = forcedOrgId ? `&organization_id=eq.${forcedOrgId}` : '';

  if (!orgFilter) {
    const wallet = loadIdentityWallet();
    if (wallet?.organizationId) {
      orgFilter = `&organization_id=eq.${wallet.organizationId}`;
    }
  }

  if (!orgFilter) {
    try {
      const client = getSupabaseClient();
      if (client) {
        const ctx = await getOrgContextOrThrow(client);
        if (ctx?.organizationId) {
          orgFilter = `&organization_id=eq.${ctx.organizationId}`;
        }
      }
    } catch (err) {
      console.warn('⚠️ Unable to resolve organization for vehicles list; proceeding without filter', err?.message || err);
    }
  }

  const res = await apiFetch(`/rest/v1/vehicles?select=id,veh_disp_name,unit_number,make,model,year,license_plate,status,veh_type,veh_title,assigned_driver_id${orgFilter}&status=in.(${activeStatuses})&order=veh_disp_name.asc,make.asc,model.asc,year.desc&limit=${limit}&offset=${offset}`);
  if (!res.ok) throw new Error(`listActiveVehiclesLight failed: ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

// Active vehicle types for dropdowns
export async function listActiveVehicleTypes({ limit = 200, offset = 0 } = {}) {
  const forcedOrgId = (typeof window !== 'undefined' && (window.VEHICLE_FORCE_ORG_ID || window.FORCED_ORG_ID || window.ENV?.FORCE_VEHICLE_ORG_ID)) || null;
  let orgFilter = forcedOrgId ? `&organization_id=eq.${forcedOrgId}` : '';

  if (!orgFilter) {
    const wallet = loadIdentityWallet();
    if (wallet?.organizationId) {
      orgFilter = `&organization_id=eq.${wallet.organizationId}`;
    }
  }
  const res = await apiFetch(`/rest/v1/vehicle_types?select=id,name,code,status&status=eq.ACTIVE${orgFilter}&order=sort_order.asc,name.asc&limit=${limit}&offset=${offset}`);
  if (!res.ok) throw new Error(`listActiveVehicleTypes failed: ${res.status}`);
  return res.json();
}

export async function upsertVehicleType(vehicleType) {
  try {
    lastApiError = null;
    const { organizationId, user } = await getOrgContextOrThrow(getSupabaseClient());
    const now = new Date().toISOString();
    
    // Check if this is an existing UUID record
    const isUUID = typeof vehicleType.id === 'string'
      && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(vehicleType.id);

    // For non-UUID ids (legacy numeric like '2'), generate a new UUID
    const newUUID = !isUUID ? crypto.randomUUID() : null;
    const effectiveId = isUUID ? vehicleType.id : newUUID;

    const metadata = {
      ...(vehicleType.metadata || {}),
      ...(vehicleType.rates ? { rates: vehicleType.rates } : {}),
      ...(vehicleType.images ? { images: vehicleType.images } : {}),
      // Store legacy id in metadata for reference
      ...(vehicleType.id && !isUUID ? { legacy_id: vehicleType.id } : {})
    };

    const payload = sanitizeVehiclePayload({
      id: effectiveId,
      organization_id: organizationId,
      name: vehicleType.name?.trim() || null,
      code: vehicleType.code?.trim() || null,
      status: (vehicleType.status || 'ACTIVE').toUpperCase(),
      pricing_basis: (vehicleType.pricing_basis || 'HOURS').toUpperCase(),
      passenger_capacity: vehicleType.passenger_capacity !== undefined && vehicleType.passenger_capacity !== null && vehicleType.passenger_capacity !== ''
        ? Number(vehicleType.passenger_capacity)
        : null,
      luggage_capacity: vehicleType.luggage_capacity !== undefined && vehicleType.luggage_capacity !== null && vehicleType.luggage_capacity !== ''
        ? Number(vehicleType.luggage_capacity)
        : null,
      color_hex: vehicleType.color_hex?.trim() || null,
      service_type_tags: Array.isArray(vehicleType.service_type_tags)
        ? vehicleType.service_type_tags
        : (vehicleType.service_type ? [vehicleType.service_type] : []),
      accessible: vehicleType.accessible === true,
      hide_from_online: vehicleType.hide_from_online === true,
      description: vehicleType.description?.trim() || null,
      sort_order: Number.isFinite(vehicleType.sort_order) ? vehicleType.sort_order : 0,
      metadata,
      updated_at: now,
      updated_by: user.id,
      created_at: isUUID ? undefined : now,
      created_by: isUUID ? undefined : user.id,
    });

    let response;
    
    if (isUUID) {
      // UPDATE existing record with PATCH using UUID id
      console.log('📤 Updating vehicle type by UUID:', vehicleType.id);
      const updatePayload = { ...payload };
      delete updatePayload.id;
      delete updatePayload.created_at;
      delete updatePayload.created_by;
      
      response = await apiFetch(`/rest/v1/vehicle_types?id=eq.${encodeURIComponent(vehicleType.id)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Prefer: 'return=representation'
        },
        body: JSON.stringify(updatePayload),
        retry: true
      });
    } else {
      // Non-UUID id or no id - check if name already exists first
      const searchName = vehicleType.name?.trim();
      console.log('📤 Checking if vehicle type exists by name:', searchName);
      
      // Use ilike for case-insensitive match
      const lookupRes = await apiFetch(`/rest/v1/vehicle_types?name=ilike.${encodeURIComponent(searchName)}&organization_id=eq.${organizationId}&select=id,name`, {
        method: 'GET'
      });
      
      console.log('📤 Lookup response status:', lookupRes.status);
      
      if (lookupRes.ok) {
        const existing = await lookupRes.json();
        console.log('📤 Lookup result:', existing);
        if (existing && existing.length > 0) {
          // Name exists - update existing record
          console.log('📤 Found existing vehicle type by name, updating UUID:', existing[0].id);
          const updatePayload = { ...payload };
          delete updatePayload.id;
          delete updatePayload.created_at;
          delete updatePayload.created_by;
          
          response = await apiFetch(`/rest/v1/vehicle_types?id=eq.${encodeURIComponent(existing[0].id)}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Prefer: 'return=representation'
            },
            body: JSON.stringify(updatePayload),
            retry: true
          });
        } else {
          // Name doesn't exist - create new record
          console.log('📤 Creating vehicle type with new UUID:', effectiveId, vehicleType.id ? `(legacy id: ${vehicleType.id})` : '');
          response = await apiFetch('/rest/v1/vehicle_types', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Prefer: 'return=representation'
            },
            body: JSON.stringify([payload]),
            retry: true
          });
        }
      } else {
        throw new Error(`Lookup by name failed: ${lookupRes.status}`);
      }
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      console.error('❌ upsertVehicleType response not ok:', response.status, body);
      const error = { message: `Supabase upsert failed (${response.status})`, status: response.status, body };
      throw error;
    }

    const data = await response.json();
    console.log('✅ upsertVehicleType success:', data);
    const row = Array.isArray(data) ? data[0] || null : data;
    return row;
  } catch (error) {
    const info = describeSupabaseError(error, 'upsertVehicleType');
    console.error('❌ upsertVehicleType Supabase error:', info);
    lastApiError = info;
    throw new Error(`upsertVehicleType failed: ${info.message || 'Supabase error'} [code:${info.code || 'unknown'}]`);
  }
}

/**
 * Update all vehicles that have a specific vehicle_type to use a new name
 * Called when renaming a vehicle type to propagate the change
 */
export async function updateVehiclesWithVehicleTypeName(oldName, newName, vehicleTypeId) {
  const client = getSupabaseClient();
  if (!client) {
    console.warn('Supabase client not initialized, skipping vehicle type name propagation');
    return { updated: 0 };
  }

  try {
    lastApiError = null;
    const { organizationId } = await getOrgContextOrThrow(client);
    
    // Update vehicles where vehicle_type matches old name OR vehicle_type_id matches
    // We need to update both fields: vehicle_type and veh_type
    const now = new Date().toISOString();
    
    let updateCount = 0;
    
    // Update by old name (text field)
    if (oldName) {
      const { data: byName, error: nameError } = await client
        .from('vehicles')
        .update({ vehicle_type: newName, veh_type: newName, updated_at: now })
        .eq('organization_id', organizationId)
        .or(`vehicle_type.eq.${oldName},veh_type.eq.${oldName}`)
        .select('id');
      
      if (nameError) {
        console.warn('Error updating vehicles by name:', nameError);
      } else {
        updateCount += byName?.length || 0;
      }
    }
    
    // Update by vehicle_type_id (UUID reference)
    if (vehicleTypeId) {
      const { data: byId, error: idError } = await client
        .from('vehicles')
        .update({ vehicle_type: newName, veh_type: newName, updated_at: now })
        .eq('organization_id', organizationId)
        .eq('vehicle_type_id', vehicleTypeId)
        .select('id');
      
      if (idError) {
        console.warn('Error updating vehicles by type ID:', idError);
      } else {
        updateCount += byId?.length || 0;
      }
    }
    
    console.log(`✅ Updated ${updateCount} vehicles with new vehicle type name: "${newName}"`);
    return { updated: updateCount };
  } catch (error) {
    console.error('Error updating vehicles with vehicle type name:', error);
    lastApiError = error;
    return { updated: 0, error };
  }
}

export async function deleteVehicleType(vehicleTypeId) {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase client not initialized');

  try {
    lastApiError = null;
    const { organizationId } = await getOrgContextOrThrow(client);
    const { error } = await client
      .from('vehicle_types')
      .delete()
      .eq('id', vehicleTypeId)
      .eq('organization_id', organizationId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting vehicle type:', error);
    lastApiError = error;
    throw error;
  }
}

// ============================================================================
// Vehicle Type Images - Supabase Storage
// ============================================================================

const VEHICLE_IMAGES_BUCKET = 'vehicle-type-images';

/**
 * Upload an image for a vehicle type to Supabase Storage
 * @param {string} vehicleTypeId - The vehicle type UUID
 * @param {File} file - The image file to upload
 * @param {Object} options - Options like isPrimary, displayName
 * @returns {Promise<Object>} The created vehicle_type_images record
 */
export async function uploadVehicleTypeImage(vehicleTypeId, file, options = {}) {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase client not initialized');

  try {
    lastApiError = null;
    const { organizationId, userId } = await getOrgContextOrThrow(client);

    // Validate file type
    const allowedTypes = ['image/gif', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      throw new Error('Invalid file type. Allowed: GIF, JPG, JPEG, PNG');
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new Error('File size must be less than 5MB');
    }

    // Generate unique filename
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const timestamp = Date.now();
    const uniqueId = crypto.randomUUID().slice(0, 8);
    const storagePath = `${organizationId}/${vehicleTypeId}/${timestamp}-${uniqueId}.${ext}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await client.storage
      .from(VEHICLE_IMAGES_BUCKET)
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('❌ Storage upload error:', uploadError);
      throw uploadError;
    }

    console.log('✅ Image uploaded to storage:', uploadData.path);

    // If this is set as primary, unset existing primary images first
    if (options.isPrimary) {
      await client
        .from('vehicle_type_images')
        .update({ is_primary: false })
        .eq('vehicle_type_id', vehicleTypeId)
        .eq('organization_id', organizationId);
    }

    // Get current max sort_order
    const { data: existingImages } = await client
      .from('vehicle_type_images')
      .select('sort_order')
      .eq('vehicle_type_id', vehicleTypeId)
      .eq('organization_id', organizationId)
      .order('sort_order', { ascending: false })
      .limit(1);

    const nextSortOrder = (existingImages?.[0]?.sort_order ?? -1) + 1;

    // Create record in vehicle_type_images table
    const imageRecord = {
      organization_id: organizationId,
      vehicle_type_id: vehicleTypeId,
      storage_path: storagePath,
      display_name: options.displayName || file.name,
      is_primary: options.isPrimary || false,
      sort_order: options.sortOrder ?? nextSortOrder,
      metadata: {
        original_name: file.name,
        content_type: file.type,
        size: file.size
      },
      created_by: userId,
      updated_by: userId
    };

    const { data: savedImage, error: saveError } = await client
      .from('vehicle_type_images')
      .insert(imageRecord)
      .select()
      .single();

    if (saveError) {
      console.error('❌ Failed to save image record:', saveError);
      // Try to clean up the uploaded file
      await client.storage.from(VEHICLE_IMAGES_BUCKET).remove([storagePath]);
      throw saveError;
    }

    console.log('✅ Vehicle type image saved:', savedImage);
    return savedImage;
  } catch (error) {
    console.error('Error uploading vehicle type image:', error);
    lastApiError = error;
    throw error;
  }
}

/**
 * Fetch all images for a vehicle type
 * @param {string} vehicleTypeId - The vehicle type UUID
 * @returns {Promise<Array>} Array of image records with public URLs
 */
export async function fetchVehicleTypeImages(vehicleTypeId) {
  const client = getSupabaseClient();
  if (!client) return [];

  try {
    lastApiError = null;
    const { organizationId } = await getOrgContextOrThrow(client);

    const { data: images, error } = await client
      .from('vehicle_type_images')
      .select('*')
      .eq('vehicle_type_id', vehicleTypeId)
      .eq('organization_id', organizationId)
      .order('sort_order', { ascending: true });

    if (error) throw error;

    // Get public URLs for each image
    return (images || []).map((img) => {
      const { data: urlData } = client.storage
        .from(VEHICLE_IMAGES_BUCKET)
        .getPublicUrl(img.storage_path);

      return {
        ...img,
        public_url: urlData?.publicUrl || null
      };
    });
  } catch (error) {
    console.error('Error fetching vehicle type images:', error);
    lastApiError = error;
    return [];
  }
}

/**
 * Delete a vehicle type image
 * @param {string} imageId - The image record UUID
 * @returns {Promise<boolean>} True if successful
 */
export async function deleteVehicleTypeImage(imageId) {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase client not initialized');

  try {
    lastApiError = null;
    const { organizationId } = await getOrgContextOrThrow(client);

    // First get the image record to find the storage path
    const { data: image, error: fetchError } = await client
      .from('vehicle_type_images')
      .select('storage_path')
      .eq('id', imageId)
      .eq('organization_id', organizationId)
      .single();

    if (fetchError) throw fetchError;

    // Delete from storage
    if (image?.storage_path) {
      const { error: storageError } = await client.storage
        .from(VEHICLE_IMAGES_BUCKET)
        .remove([image.storage_path]);

      if (storageError) {
        console.warn('⚠️ Failed to delete from storage:', storageError);
      }
    }

    // Delete the database record
    const { error: deleteError } = await client
      .from('vehicle_type_images')
      .delete()
      .eq('id', imageId)
      .eq('organization_id', organizationId);

    if (deleteError) throw deleteError;

    console.log('✅ Vehicle type image deleted:', imageId);
    return true;
  } catch (error) {
    console.error('Error deleting vehicle type image:', error);
    lastApiError = error;
    throw error;
  }
}

/**
 * Update image properties (like is_primary, sort_order, display_name)
 * @param {string} imageId - The image record UUID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated image record
 */
export async function updateVehicleTypeImage(imageId, updates) {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase client not initialized');

  try {
    lastApiError = null;
    const { organizationId, userId } = await getOrgContextOrThrow(client);

    // If setting as primary, unset other primaries first
    if (updates.is_primary) {
      // Get the vehicle_type_id for this image
      const { data: img } = await client
        .from('vehicle_type_images')
        .select('vehicle_type_id')
        .eq('id', imageId)
        .single();

      if (img?.vehicle_type_id) {
        await client
          .from('vehicle_type_images')
          .update({ is_primary: false })
          .eq('vehicle_type_id', img.vehicle_type_id)
          .eq('organization_id', organizationId)
          .neq('id', imageId);
      }
    }

    const { data, error } = await client
      .from('vehicle_type_images')
      .update({
        ...updates,
        updated_by: userId,
        updated_at: new Date().toISOString()
      })
      .eq('id', imageId)
      .eq('organization_id', organizationId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating vehicle type image:', error);
    lastApiError = error;
    throw error;
  }
}

/**
 * Remove duplicate affiliates from the database
 * Keeps the first occurrence (by id) and deletes duplicates based on company_name
 */
export async function removeDuplicateAffiliates() {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Client not initialized', removed: 0 };

  try {
    // Fetch all affiliates ordered by id
    const { data: affiliates, error: fetchError } = await client
      .from('affiliates')
      .select('id, company_name, first_name, last_name')
      .order('id', { ascending: true });

    if (fetchError) throw fetchError;
    if (!affiliates || affiliates.length === 0) {
      return { success: true, removed: 0, message: 'No affiliates found' };
    }

    // Track seen company names (normalized)
    const seen = new Map();
    const duplicateIds = [];

    affiliates.forEach(aff => {
      // Create a key from company_name or first+last name
      const key = (aff.company_name || `${aff.first_name || ''} ${aff.last_name || ''}`).trim().toLowerCase();
      
      if (key && seen.has(key)) {
        // This is a duplicate
        duplicateIds.push(aff.id);
      } else if (key) {
        // First occurrence
        seen.set(key, aff.id);
      }
    });

    if (duplicateIds.length === 0) {
      return { success: true, removed: 0, message: 'No duplicates found' };
    }

    // Delete duplicates
    const { error: deleteError } = await client
      .from('affiliates')
      .delete()
      .in('id', duplicateIds);

    if (deleteError) throw deleteError;

    console.log(`✅ Removed ${duplicateIds.length} duplicate affiliates`);
    return { success: true, removed: duplicateIds.length, message: `Removed ${duplicateIds.length} duplicates` };
  } catch (error) {
    console.error('Error removing duplicate affiliates:', error);
    return { success: false, error: error.message, removed: 0 };
  }
}

function buildDriverDuplicateKey(driver) {
  if (!driver) {
    return null;
  }
  const org = driver.organization_id || 'no_org';
  const email = (driver.email || '').trim().toLowerCase();
  if (email) {
    return `${org}|email|${email}`;
  }
  const phone = (driver.phone || '').replace(/[^0-9]/g, '');
  if (phone.length >= 7) {
    return `${org}|phone|${phone}`;
  }
  const first = (driver.first_name || '').trim().toLowerCase();
  const last = (driver.last_name || '').trim().toLowerCase();
  if (first || last) {
    return `${org}|name|${first} ${last}`.trim();
  }
  return null;
}

/**
 * Remove duplicate drivers from the database
 * Duplicates are detected per organization by email, then phone, then full name.
 */
export async function removeDuplicateDrivers() {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Client not initialized', removed: 0 };

  try {
    const { data: drivers, error: fetchError } = await client
      .from('drivers')
      .select('id, organization_id, email, phone, first_name, last_name, created_at')
      .order('created_at', { ascending: true });

    if (fetchError) throw fetchError;
    if (!drivers || drivers.length === 0) {
      return { success: true, removed: 0, message: 'No drivers found' };
    }

    const seen = new Map();
    const duplicateIds = [];

    drivers.forEach(driver => {
      const key = buildDriverDuplicateKey(driver);
      if (!key) {
        return;
      }
      if (seen.has(key)) {
        duplicateIds.push(driver.id);
      } else {
        seen.set(key, driver.id);
      }
    });

    if (duplicateIds.length === 0) {
      return { success: true, removed: 0, message: 'No duplicates found' };
    }

    const { error: deleteError } = await client
      .from('drivers')
      .delete()
      .in('id', duplicateIds);

    if (deleteError) throw deleteError;

    console.log(`✅ Removed ${duplicateIds.length} duplicate drivers`);
    return { success: true, removed: duplicateIds.length, message: `Removed ${duplicateIds.length} duplicates` };
  } catch (error) {
    console.error('Error removing duplicate drivers:', error);
    return { success: false, error: error.message, removed: 0 };
  }
}

export function normalizeAffiliateName(rawName) {
  if (typeof rawName !== 'string') {
    return '';
  }
  const normalized = normalizeSpaces(rawName);
  return normalized;
}

export async function fetchAllAffiliates() {
  const client = getSupabaseClient();
  if (!client) return [];

  try {
    lastApiError = null;
    const { data, error } = await client
      .from('affiliate_organizations')
      .select('id, name')
      .order('name', { ascending: true });

    if (error) throw error;
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Error fetching affiliates:', error);
    lastApiError = error;
    return [];
  }
}

export async function fetchOrganizationAffiliates() {
  const client = getSupabaseClient();
  if (!client) return [];

  try {
    lastApiError = null;
    const { organizationId } = await getOrgContextOrThrow(client);

    const { data, error } = await client
      .from('organization_affiliates')
      .select('affiliate_id, affiliate:affiliate_organizations(id, name)')
      .eq('organization_id', organizationId)
      .order('affiliate(name)', { ascending: true });

    if (error) throw error;

    const rows = Array.isArray(data) ? data : [];
    return rows
      .map(row => {
        const affiliate = row?.affiliate;
        const id = affiliate?.id || row?.affiliate_id;
        const name = affiliate?.name || '';
        if (!id || !name) {
          return null;
        }
        return { id, name };
      })
      .filter(Boolean);
  } catch (error) {
    console.error('Error fetching organization affiliates:', error);
    lastApiError = error;
    return [];
  }
}

export async function ensureAffiliateForOrganization(rawName) {
  const client = getSupabaseClient();
  if (!client) return null;

  const name = normalizeAffiliateName(rawName);
  if (!name) {
    throw new Error('Affiliate name is required');
  }

  try {
    lastApiError = null;
    const literal = name.replace(/[%_]/g, match => `\\${match}`);

    const { data: existingRows, error: existingError } = await client
      .from('affiliate_organizations')
      .select('id, name')
      .ilike('name', literal)
      .limit(1);

    if (existingError) throw existingError;

    let affiliate = Array.isArray(existingRows) && existingRows.length > 0 ? existingRows[0] : null;

    if (!affiliate) {
      const { data: inserted, error: insertError } = await client
        .from('affiliate_organizations')
        .insert([{ name }])
        .select('id, name')
        .single();

      if (insertError) {
        if (insertError.code === '23505' || /duplicate/i.test(insertError.message || '')) {
          const { data: retryRows, error: retryError } = await client
            .from('affiliate_organizations')
            .select('id, name')
            .ilike('name', literal)
            .limit(1);

          if (retryError) throw retryError;
          affiliate = Array.isArray(retryRows) && retryRows.length > 0 ? retryRows[0] : null;
        } else {
          throw insertError;
        }
      } else {
        affiliate = inserted;
      }
    }

    if (!affiliate) {
      throw new Error('Unable to resolve affiliate');
    }

    const { organizationId } = await getOrgContextOrThrow(client);

    const { error: linkError } = await client
      .from('organization_affiliates')
      .upsert({
        organization_id: organizationId,
        affiliate_id: affiliate.id
      }, { onConflict: 'organization_id,affiliate_id' });

    if (linkError && linkError.code !== '23505') {
      throw linkError;
    }

    return {
      affiliateId: affiliate.id,
      affiliateName: affiliate.name
    };
  } catch (error) {
    console.error('Error ensuring affiliate:', error);
    lastApiError = error;
    throw error;
  }
}

/**
 * Create new reservation
 */
export async function createReservation(reservationData) {
  const client = getSupabaseClient();
  if (!client) return null;
  
  try {
    const { organizationId, userId } = await getOrgContextOrThrow(client);
    console.log('🆔 Using organization ID:', organizationId, 'User ID:', userId);
    
    // Generate confirmation number
    const confirmationNumber = reservationData.confirmationNumber || 
                               reservationData.confirmation_number ||
                               `${Date.now()}`;
    
    // Parse pickup/dropoff from routing stops
    const stops = reservationData.routing?.stops || [];
    const pickup = stops[0] || {};
    const dropoff = stops[1] || stops[stops.length - 1] || {};
    
    // First attempt: Try normal insert with organization
    let insertData = {
      organization_id: organizationId.startsWith('dev-org-') ? null : organizationId,
      confirmation_number: confirmationNumber,
      booked_by_user_id: userId,
      account_id: reservationData.accountId || reservationData.account_id || null,
      status: reservationData.status || 'pending',
      trip_type: reservationData.tripType || reservationData.trip_type || null,
      pickup_address: pickup.address || reservationData.pickup_location || '',
      pickup_city: pickup.city || '',
      pickup_state: pickup.state || '',
      pickup_zip: pickup.zip || '',
      pickup_lat: pickup.lat || null,
      pickup_lon: pickup.lng || pickup.lon || null,
      pickup_datetime: reservationData.pickupDateTime || reservationData.pickup_datetime || null,
      dropoff_address: dropoff.address || reservationData.dropoff_location || '',
      dropoff_city: dropoff.city || '',
      dropoff_state: dropoff.state || '',
      dropoff_zip: dropoff.zip || '',
      dropoff_lat: dropoff.lat || null,
      dropoff_lon: dropoff.lng || dropoff.lon || null,
      dropoff_datetime: reservationData.dropoffDateTime || reservationData.dropoff_datetime || null,
      passenger_count: reservationData.passengerCount || reservationData.passenger_count || 1,
      special_instructions: reservationData.routing?.tripNotes || reservationData.special_instructions || '',
      notes: reservationData.routing?.dispatchNotes || reservationData.notes || '',
      rate_type: reservationData.rateType || reservationData.rate_type || null,
      rate_amount: reservationData.grandTotal || reservationData.rate_amount || 0,
      currency: reservationData.currency || 'USD',
      timezone: reservationData.timezone || null,
      farm_option: reservationData.farm_option || reservationData.farmOption || reservationData.formSnapshot?.details?.farmOption || reservationData.form_snapshot?.details?.farmOption || 'in-house'
    };

    // Persist the full form snapshot when provided so reservation details reload correctly
    if (reservationData.form_snapshot || reservationData.formSnapshot) {
      insertData.form_snapshot = reservationData.form_snapshot || reservationData.formSnapshot;
    }
    
    const { data, error } = await client
      .from('reservations')
      .insert([insertData])
      .select();
      
    // Check if RLS policy is blocking the insert
    if (error && error.code === '42501') {
      console.warn('⚠️ RLS policy blocking insert, using local storage fallback...');
      
      // Development fallback: Store in localStorage for development
      const reservationWithId = {
        ...insertData,
        id: `local-${Date.now()}`, // Generate local ID
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      // Get existing local reservations
      const existingReservations = JSON.parse(localStorage.getItem('local_reservations') || '[]');
      existingReservations.push(reservationWithId);
      localStorage.setItem('local_reservations', JSON.stringify(existingReservations));
      
      console.log('✅ Reservation saved locally for development:', reservationWithId);
      return [reservationWithId]; // Return as array to match Supabase format
    }

    if (error) throw error;
    console.log('✅ Reservation created in Supabase:', data);
    return data;
  } catch (error) {
    console.error('❌ Error creating reservation in Supabase:', error);
    console.error('❌ Error details:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint
    });
    
    // Store the error for retrieval
    lastApiError = error;
    return null;
  }
}

/**
 * Update reservation
 */
export async function updateReservation(reservationId, reservationData) {
  const client = getSupabaseClient();
  if (!client) return null;
  
  try {
    const { organizationId, userId } = await getOrgContextOrThrow(client);
    
    // Parse pickup/dropoff from routing stops
    const stops = reservationData.routing?.stops || [];
    const pickup = stops[0] || {};
    const dropoff = stops[1] || stops[stops.length - 1] || {};
    
    const { data, error } = await client
      .from('reservations')
      .update({
        status: reservationData.status || undefined,
        trip_type: reservationData.tripType || reservationData.trip_type || undefined,
        pickup_address: pickup.address || reservationData.pickup_location || undefined,
        pickup_city: pickup.city || undefined,
        pickup_state: pickup.state || undefined,
        pickup_zip: pickup.zip || undefined,
        pickup_lat: pickup.lat || undefined,
        pickup_lon: pickup.lng || pickup.lon || undefined,
        pickup_datetime: reservationData.pickupDateTime || reservationData.pickup_datetime || undefined,
        dropoff_address: dropoff.address || reservationData.dropoff_location || undefined,
        dropoff_city: dropoff.city || undefined,
        dropoff_state: dropoff.state || undefined,
        dropoff_zip: dropoff.zip || undefined,
        dropoff_lat: dropoff.lat || undefined,
        dropoff_lon: dropoff.lng || dropoff.lon || undefined,
        dropoff_datetime: reservationData.dropoffDateTime || reservationData.dropoff_datetime || undefined,
        passenger_count: reservationData.passengerCount || reservationData.passenger_count || undefined,
        special_instructions: reservationData.routing?.tripNotes || reservationData.special_instructions || undefined,
        notes: reservationData.routing?.dispatchNotes || reservationData.notes || undefined,
        rate_amount: reservationData.grandTotal || reservationData.rate_amount || undefined,
        updated_by: userId,
        form_snapshot: reservationData.form_snapshot || reservationData.formSnapshot || undefined,
        farm_option: reservationData.farm_option || reservationData.farmOption || reservationData.formSnapshot?.details?.farmOption || reservationData.form_snapshot?.details?.farmOption || undefined
      })
      .eq('id', reservationId)
      .eq('organization_id', organizationId)
      .select();
    
    if (error) throw error;
    console.log('✅ Reservation updated in Supabase:', data);
    return data;
  } catch (error) {
    console.error('Error updating reservation in Supabase:', error);
    return null;
  }
}

/**
 * Fetch all reservations
 */
export async function fetchReservations() {
  const client = getSupabaseClient();
  if (!client) return null;
  
  try {
    const { organizationId } = await getOrgContextOrThrow(client);
    if (!organizationId) {
      console.warn('⚠️ No organization_id; using local reservations only.');
      return JSON.parse(localStorage.getItem('local_reservations') || '[]');
    }

    const { data, error } = await client
      .from('reservations')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    // Include local reservations for development, but deduplicate
    const localReservations = JSON.parse(localStorage.getItem('local_reservations') || '[]');
    
    // Supabase is the source of truth - only include local reservations not in Supabase
    const supabaseIds = new Set((data || []).map(r => r.id));
    const supabaseConfNumbers = new Set((data || []).map(r => r.confirmation_number));
    
    const uniqueLocalOnly = localReservations.filter(r => 
      !supabaseIds.has(r.id) && !supabaseConfNumbers.has(r.confirmation_number)
    );
    
    const allReservations = [...(data || []), ...uniqueLocalOnly];
    
    console.log(`📊 Loaded ${(data || []).length} Supabase + ${uniqueLocalOnly.length} local-only reservations`);
    return allReservations;
  } catch (error) {
    console.error('Error fetching reservations:', error);
    
    // Fallback to local reservations only
    const localReservations = JSON.parse(localStorage.getItem('local_reservations') || '[]');
    if (localReservations.length > 0) {
      console.log(`📊 Using ${localReservations.length} local reservations only`);
      return localReservations;
    }
    
    return null;
  }
}

/**
 * Get reservation by ID
 */
export async function getReservation(reservationId) {
  const client = getSupabaseClient();
  if (!client) return null;
  
  try {
    const { organizationId } = await getOrgContextOrThrow(client);
    const { data, error } = await client
      .from('reservations')
      .select('*')
      .eq('id', reservationId)
      .eq('organization_id', organizationId)
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching reservation:', error);
    return null;
  }
}

/**
 * Search airports by name or code
 */
export async function searchAirports(query) {
  try {
    // Using OpenFlights Airport database via public API
    const response = await fetch(`https://api.flightapi.io/airports?search=${encodeURIComponent(query)}`, {
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      // Fallback to static airport list if API fails
      return getStaticAirports(query);
    }
    
    const data = await response.json();
    return data.airports || [];
  } catch (error) {
    console.error('Airport search error:', error);
    return getStaticAirports(query);
  }
}

/**
 * Static airport list for fallback
 */
function getStaticAirports(query) {
  const airports = [
    { code: 'MSP', name: 'Minneapolis-Saint Paul International', city: 'Minneapolis', state: 'MN' },
    { code: 'JFK', name: 'John F. Kennedy International', city: 'New York', state: 'NY' },
    { code: 'LAX', name: 'Los Angeles International', city: 'Los Angeles', state: 'CA' },
    { code: 'ORD', name: 'Chicago O\'Hare International', city: 'Chicago', state: 'IL' },
    { code: 'DFW', name: 'Dallas/Fort Worth International', city: 'Dallas', state: 'TX' },
    { code: 'DEN', name: 'Denver International', city: 'Denver', state: 'CO' },
    { code: 'SEA', name: 'Seattle-Tacoma International', city: 'Seattle', state: 'WA' },
    { code: 'SFO', name: 'San Francisco International', city: 'San Francisco', state: 'CA' },
    { code: 'LAS', name: 'Harry Reid International', city: 'Las Vegas', state: 'NV' },
    { code: 'MIA', name: 'Miami International', city: 'Miami', state: 'FL' }
  ];
  
  const q = query.toLowerCase();
  return airports.filter(a => 
    a.code.toLowerCase().includes(q) || 
    a.name.toLowerCase().includes(q) ||
    a.city.toLowerCase().includes(q)
  );
}

/**
 * Geocode address using Nominatim (OpenStreetMap)
 */
export async function geocodeAddress(address) {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=5`,
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'RELIA-LIMO-APP'
        }
      }
    );
    
    if (!response.ok) {
      console.warn('Geocoding service unavailable');
      return [];
    }
    
    const data = await response.json();
    return data.map(result => ({
      name: result.name,
      address: result.display_name,
      latitude: result.lat,
      longitude: result.lon,
      context: {
        city: result.address?.city,
        state: result.address?.state,
        zipcode: result.address?.postcode,
        country: result.address?.country
      }
    }));
  } catch (error) {
    console.error('Geocoding error:', error);
    return [];
  }
}

/**
 * Reverse geocode coordinates to address
 */
export async function reverseGeocode(lat, lon) {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`,
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'RELIA-LIMO-APP'
        }
      }
    );
    
    if (!response.ok) {
      console.warn('Reverse geocoding service unavailable');
      return null;
    }
    
    const data = await response.json();
    return {
      name: data.name,
      address: data.display_name,
      latitude: data.lat,
      longitude: data.lon,
      context: {
        city: data.address?.city,
        state: data.address?.state,
        zipcode: data.address?.postcode,
        country: data.address?.country
      }
    };
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return null;
  }
}

/**
 * Calculate distance between two coordinates
 */
export async function calculateDistance(start, end) {
  try {
    // Using OSRM (Open Source Routing Machine)
    const response = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${start.lon},${start.lat};${end.lon},${end.lat}?overview=false`,
      {
        headers: {
          'Accept': 'application/json'
        }
      }
    );
    
    if (!response.ok) {
      console.warn('Distance calculation service unavailable');
      return null;
    }
    
    const data = await response.json();
    if (data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      return {
        distance_miles: (route.distance * 0.000621371).toFixed(2),
        distance_km: (route.distance / 1000).toFixed(2),
        duration_minutes: Math.round(route.duration / 60),
        duration_hours: (route.duration / 3600).toFixed(2)
      };
    }
    return null;
  } catch (error) {
    console.error('Distance calculation error:', error);
    return null;
  }
}

// ============================================================================
// BULK DELETE HELPERS
// ============================================================================

async function deleteAllForOrganization(tableName, organizationId, column = 'organization_id') {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase client not initialized');

  const query = client.from(tableName).delete();
  if (organizationId && column) {
    query.eq(column, organizationId);
  }

  const { error } = await query;
  if (error) throw error;
  return true;
}

function clearLocalAccountStorage() {
  try {
    const keys = [
      'local_accounts',
      'dev_accounts',
      'relia_accounts',
      'accounts',
      'relia_account_draft',
      'nextAccountNumber'
    ];
    console.log('🗑️ Clearing all local account storage keys:', keys);
    keys.forEach(key => {
      try {
        localStorage.removeItem(key);
        console.log(`🗑️ Removed ${key}`);
      } catch (e) {
        console.warn(`⚠️ Unable to remove ${key}:`, e);
      }
    });

    // Remove locally cached address records
    try {
      const keysToDelete = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key && key.startsWith('relia_account_') && key.endsWith('_addresses')) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach(key => localStorage.removeItem(key));
    } catch (e) {
      console.warn('⚠️ Unable to purge account address cache:', e);
    }
  } catch (e) {
    console.warn('⚠️ Account local cache purge hit an unexpected error:', e);
  }
}

function clearLocalReservationStorage() {
  const keys = [
    'dev_reservations',
    'local_reservations',
    'relia_reservations',
    'relia_reservation_draft',
    'relia_reservation_status_details'
  ];
  keys.forEach(key => {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn(`⚠️ Unable to remove ${key}:`, e);
    }
  });
}

function clearLocalDriverStorage() {
  try {
    localStorage.removeItem('dev_drivers');
  } catch (e) {
    console.warn('⚠️ Unable to clear local driver cache:', e);
  }
}

export async function deleteAllAccountsSupabase() {
  try {
    await setupAPI();
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not initialized');
    const { organizationId } = await getOrgContextOrThrow(client);

    // Delete accounts scoped to the org
    if (organizationId) {
      const { error: scopedError } = await client
        .from('accounts')
        .delete()
        .eq('organization_id', organizationId);
      if (scopedError) throw scopedError;
      console.log('✅ Deleted accounts for organization:', organizationId);
    }

    // Also delete any accounts without an organization_id (cleanup)
    // Use filter for null check since .is() may not be available on REST client
    try {
      const { error: nullOrgError } = await client
        .from('accounts')
        .delete()
        .filter('organization_id', 'is', 'null');
      if (nullOrgError) {
        console.warn('⚠️ Could not delete null-org accounts:', nullOrgError);
      } else {
        console.log('✅ Deleted accounts with null organization_id');
      }
    } catch (e) {
      console.warn('⚠️ Null org cleanup skipped:', e.message);
    }

    clearLocalAccountStorage();
    return true;
  } catch (error) {
    console.error('❌ Failed to delete all accounts:', error);
    lastApiError = error;
    return false;
  }
}

export async function deleteAllReservationsSupabase() {
  try {
    await setupAPI();
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not initialized');
    const { organizationId } = await getOrgContextOrThrow(client);
    await deleteAllForOrganization('reservations', organizationId);

    clearLocalReservationStorage();
    resetConfirmationCounterToStart();
    return true;
  } catch (error) {
    console.error('❌ Failed to delete all reservations:', error);
    lastApiError = error;
    return false;
  }
}

export async function deleteAllDriversSupabase() {
  try {
    await setupAPI();
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not initialized');
    const { organizationId } = await getOrgContextOrThrow(client);
    await deleteAllForOrganization('drivers', organizationId);

    clearLocalDriverStorage();
    return true;
  } catch (error) {
    console.error('❌ Failed to delete all drivers:', error);
    lastApiError = error;
    return false;
  }
}

export async function deleteAllRatesSupabase() {
  try {
    await setupAPI();
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not initialized');
    const { organizationId } = await getOrgContextOrThrow(client);

    // Best-effort: cascade across common rate tables. Ignore missing tables gracefully.
    const rateTables = [
      'rate_matrix_entries',
      'rate_matrices',
      'peak_rates',
      'vehicle_types'
    ];

    for (const table of rateTables) {
      try {
        await deleteAllForOrganization(table, organizationId);
      } catch (innerError) {
        console.warn(`⚠️ Skipped deleting from ${table}:`, innerError?.message || innerError);
      }
    }

    return true;
  } catch (error) {
    console.error('❌ Failed to delete all rate data:', error);
    lastApiError = error;
    return false;
  }
}

export async function deleteAllVehiclesSupabase() {
  try {
    await setupAPI();
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not initialized');
    const forcedOrgId = (typeof window !== 'undefined' && (window.VEHICLE_FORCE_ORG_ID || window.FORCED_ORG_ID || window.ENV?.FORCE_VEHICLE_ORG_ID)) || null;
    let organizationId = forcedOrgId || null;

    if (!organizationId) {
      const ctx = await getOrgContextOrThrow(client);
      organizationId = ctx.organizationId;
    }

    // Delete vehicles for this org
    if (organizationId) {
      const { error: scopedError } = await client
        .from('vehicles')
        .delete()
        .eq('organization_id', organizationId);
      if (scopedError) throw scopedError;
    }

    // Cleanup any vehicles missing org linkage (use REST fetch to avoid builder API quirks)
    const supabaseUrl = window.ENV?.SUPABASE_URL;
    const supabaseKey = window.ENV?.SUPABASE_ANON_KEY;
    if (supabaseUrl && supabaseKey) {
      const { data: sessionData } = await client.auth.getSession();
      const authToken = sessionData?.session?.access_token || supabaseKey;

      const resp = await fetch(`${supabaseUrl}/rest/v1/vehicles?organization_id=is.null`, {
        method: 'DELETE',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${authToken}`
        }
      });

      if (!resp.ok && resp.status !== 204) {
        const body = await resp.text().catch(() => '');
        throw new Error(`Null-org vehicle cleanup failed: ${resp.status} ${body}`);
      }
    }

    return true;
  } catch (error) {
    console.error('❌ Failed to delete all vehicles:', error);
    lastApiError = error;
    return false;
  }
}

/**
 * Create or update account in Supabase
 */
export async function saveAccountToSupabase(accountData) {
  console.log('📤 saveAccountToSupabase called with:', accountData?.account_number);
  const client = getSupabaseClient();
  if (!client) {
    console.warn('⚠️ Supabase client not available, skipping account sync');
    return null;
  }
  
  try {
    lastApiError = null;
    console.log('🔍 Getting org context...');
    const { user, organizationId } = await getOrgContextOrThrow(client);
    console.log('✅ Got org context:', { userId: user?.id, organizationId });

    // If we don't have a real org/user (or we're in a dev fallback), avoid Supabase write to prevent RLS failures
    const isDevHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const missingAuth = !user?.id || !organizationId;
    const placeholderOrg = organizationId === '00000000-0000-0000-0000-000000000000' || (organizationId || '').startsWith('dev-org');
    const devUser = (user?.external_ref || '').startsWith('dev-user') || (user?.email || '').includes('@localhost');
    if (isDevHost || missingAuth || placeholderOrg || devUser) {
      console.warn('⚠️ No valid auth/org for Supabase accounts insert; using local storage fallback to avoid RLS.');
      const localAccount = {
        ...accountData,
        id: accountData.id || `local-account-${Date.now()}`,
        organization_id: organizationId || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      const existingAccounts = JSON.parse(localStorage.getItem('local_accounts') || '[]');
      
      // Check for duplicate by account_number or id
      const existingIndex = existingAccounts.findIndex(a => 
        (a.account_number && a.account_number === localAccount.account_number) ||
        (a.id && a.id === localAccount.id)
      );
      
      if (existingIndex >= 0) {
        // Update existing account
        existingAccounts[existingIndex] = { ...existingAccounts[existingIndex], ...localAccount, updated_at: new Date().toISOString() };
        console.log('🔄 Updated existing local account:', localAccount.account_number);
      } else {
        // Add new account
        existingAccounts.push(localAccount);
        console.log('➕ Added new local account:', localAccount.account_number);
      }
      
      localStorage.setItem('local_accounts', JSON.stringify(existingAccounts));
      return localAccount;
    }
    
    // Prepare account data for Supabase with all fields
    const supabaseAccount = {
      organization_id: organizationId,
      account_number: accountData.account_number || accountData.id,
      first_name: accountData.first_name,
      last_name: accountData.last_name,
      company_name: accountData.company_name,
      department: accountData.department,
      job_title: accountData.job_title,
      email: accountData.email,
      phone: accountData.phone,
      cell_phone: accountData.cell_phone || accountData.phone,
      
      // Additional phone fields
      office_phone: accountData.office_phone,
      office_phone_ext: accountData.office_phone_ext,
      home_phone: accountData.home_phone,
      home_phone_ext: accountData.home_phone_ext,
      cell_phone_2: accountData.cell_phone_2,
      cell_phone_3: accountData.cell_phone_3,
      fax_1: accountData.fax_1,
      fax_2: accountData.fax_2,
      fax_3: accountData.fax_3,
      
      // Address fields
      address_line1: accountData.address_line1,
      address_line2: accountData.address_line2,
      city: accountData.city,
      state: accountData.state,
      zip: accountData.zip,
      country: accountData.country || 'US',
      
      // Notes
      internal_notes: accountData.internal_notes,
      trip_notes: accountData.trip_notes,
      notes_others: accountData.notes_others,
      
      // Restrictions (stored as JSON arrays)
      restricted_drivers: accountData.restricted_drivers || [],
      restricted_cars: accountData.restricted_cars || [],
      
      // Settings
      source: accountData.source,
      rental_agreement: accountData.rental_agreement,
      account_settings: accountData.account_settings || 'normal',
      status: accountData.status || 'active',
      web_access: accountData.web_access || 'allow',
      
      // Account types
      is_billing_client: accountData.is_billing_client || false,
      is_passenger: accountData.is_passenger || false,
      is_booking_contact: accountData.is_booking_contact || false,
      
      // Email preferences (default to true if not explicitly set)
      email_pref_all: accountData.email_pref_all !== false,
      email_pref_confirmation: accountData.email_pref_confirmation !== false,
      email_pref_payment_receipt: accountData.email_pref_payment_receipt !== false,
      email_pref_invoice: accountData.email_pref_invoice !== false,
      email_pref_other: accountData.email_pref_other !== false,
      
      // Financial/legacy fields
      post_method: accountData.post_method,
      post_terms: accountData.post_terms,
      primary_agent_assigned: accountData.primary_agent_assigned,
      secondary_agent_assigned: accountData.secondary_agent_assigned,
      credit_card_number: accountData.credit_card_number,
      name_on_card: accountData.name_on_card,
      billing_address: accountData.billing_address,
      billing_city: accountData.billing_city,
      billing_state: accountData.billing_state,
      billing_zip: accountData.billing_zip,
      exp_month: accountData.exp_month,
      exp_year: accountData.exp_year,
      cc_type: accountData.cc_type,
      cvv: accountData.cvv,
      notes: accountData.notes,
      
      created_by: user.id,
      updated_by: user.id
    };
    
    // Check for existing account by account number
    const { data: existingRows, error: existingError } = await client
      .from('accounts')
      .select('id')
      .eq('account_number', supabaseAccount.account_number)
      .eq('organization_id', organizationId);

    if (existingError) throw existingError;
    const existing = Array.isArray(existingRows) && existingRows.length > 0 ? existingRows[0] : null;
    
    if (existing) {
      // Update existing account
      const { data, error } = await client
        .from('accounts')
        .update(supabaseAccount)
        .eq('id', existing.id)
        .select();
      
      // Check if RLS policy is blocking the update
      if (error && error.code === '42501') {
        console.warn('⚠️ RLS policy blocking account update, using local storage fallback...');
        
        // Development fallback: Update in localStorage
        const accountWithId = {
          ...supabaseAccount,
          id: existing.id,
          updated_at: new Date().toISOString()
        };
        
        const existingAccounts = JSON.parse(localStorage.getItem('local_accounts') || '[]');
        const accountIndex = existingAccounts.findIndex(a => a.id === existing.id);
        if (accountIndex >= 0) {
          existingAccounts[accountIndex] = accountWithId;
        } else {
          existingAccounts.push(accountWithId);
        }
        localStorage.setItem('local_accounts', JSON.stringify(existingAccounts));
        
        console.log('✅ Account updated locally for development:', accountWithId);
        return accountWithId;
      }
      
      if (error) throw error;
      console.log('✅ Account updated in Supabase:', data);
      return data[0];
    } else {
      // Insert new account
      const { data, error } = await client
        .from('accounts')
        .insert([supabaseAccount])
        .select();
      
      // Check if RLS policy is blocking the insert
      if (error && error.code === '42501') {
        console.warn('⚠️ RLS policy blocking account insert, using local storage fallback...');
        
        // Development fallback: Store in localStorage for development
        const accountWithId = {
          ...supabaseAccount,
          id: `local-account-${Date.now()}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        // Get existing local accounts and check for duplicates
        const existingAccounts = JSON.parse(localStorage.getItem('local_accounts') || '[]');
        const existingIndex = existingAccounts.findIndex(a => 
          (a.account_number && a.account_number === accountWithId.account_number)
        );
        
        if (existingIndex >= 0) {
          existingAccounts[existingIndex] = { ...existingAccounts[existingIndex], ...accountWithId };
          console.log('🔄 Updated existing local account:', accountWithId.account_number);
        } else {
          existingAccounts.push(accountWithId);
          console.log('➕ Added new local account:', accountWithId.account_number);
        }
        
        localStorage.setItem('local_accounts', JSON.stringify(existingAccounts));
        
        console.log('✅ Account saved locally for development:', accountWithId);
        return accountWithId;
      }
      
      if (error) throw error;
      console.log('✅ Account created in Supabase:', data);
      return data[0];
    }
  } catch (error) {
    console.error('❌ Error saving account to Supabase:', error);
    
    // Handle JWT expiration and permission errors with local storage fallback
    if (error.message && (
        error.message.includes('JWT expired') || 
        error.message.includes('permission denied') ||
        error.message.includes('User not authenticated') ||
        error.message.includes('not authenticated')
    )) {
      console.warn('⚠️ Authentication error - using local storage fallback for account');
      
      // Create local account
      const localAccount = {
        ...accountData,
        id: `local-account-${Date.now()}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      // Save to local storage with duplicate prevention
      const existingAccounts = JSON.parse(localStorage.getItem('local_accounts') || '[]');
      const existingIndex = existingAccounts.findIndex(a => 
        (a.account_number && a.account_number === localAccount.account_number) ||
        (a.id && a.id === localAccount.id)
      );
      
      if (existingIndex >= 0) {
        existingAccounts[existingIndex] = { ...existingAccounts[existingIndex], ...localAccount, updated_at: new Date().toISOString() };
        console.log('🔄 Updated existing local account:', localAccount.account_number);
      } else {
        existingAccounts.push(localAccount);
        console.log('➕ Added new local account:', localAccount.account_number);
      }
      localStorage.setItem('local_accounts', JSON.stringify(existingAccounts));
      
      console.log('✅ Account saved locally due to authentication issue:', localAccount);
      return localAccount;
    }
    
    lastApiError = error;
    return null;
  }
}

/**
 * Fetch accounts from Supabase
 */
export async function fetchAccounts() {
  const client = getSupabaseClient();
  if (!client) return null;
  
  try {
    lastApiError = null;
    const { organizationId } = await getOrgContextOrThrow(client);

    if (!organizationId) {
      console.warn('⚠️ No organization_id; using local accounts only.');
      return JSON.parse(localStorage.getItem('local_accounts') || '[]');
    }

    const { data, error } = await client
      .from('accounts')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    // Include local accounts for development, but deduplicate
    const localAccounts = JSON.parse(localStorage.getItem('local_accounts') || '[]');
    
    // Supabase is the source of truth - only include local accounts not in Supabase
    const supabaseIds = new Set((data || []).map(a => a.id));
    const supabaseAccountNumbers = new Set((data || []).map(a => a.account_number).filter(Boolean));
    
    const uniqueLocalOnly = localAccounts.filter(a => 
      !supabaseIds.has(a.id) && !supabaseAccountNumbers.has(a.account_number)
    );
    
    const allAccounts = [...(data || []), ...uniqueLocalOnly];
    
    console.log(`✅ Fetched ${(data || []).length} Supabase + ${uniqueLocalOnly.length} local-only accounts`);
    return allAccounts;
  } catch (error) {
    console.error('❌ Error fetching accounts:', error);
    
    // Fallback to local accounts only
    const localAccounts = JSON.parse(localStorage.getItem('local_accounts') || '[]');
    if (localAccounts.length > 0) {
      console.log(`✅ Using ${localAccounts.length} local accounts only`);
      return localAccounts;
    }
    
    lastApiError = error;
    return null;
  }
}

// ============================================================================
// COMPANY / OFFICE SETTINGS
// ============================================================================

export async function saveCompanySettings(settings) {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Supabase client not initialized' };

  try {
    lastApiError = null;

    // Refresh token if close to expiry
    if (typeof ensureValidToken === 'function') {
      await ensureValidToken(client);
    }

    const { organizationId } = await getOrgContextOrThrow(client);
    const payload = {
      ...settings,
      organization_id: organizationId,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await client
      .from('company_settings')
      .upsert(payload, { onConflict: 'organization_id' })
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('❌ Error saving company settings to Supabase:', error);
    lastApiError = error;
    return { success: false, error };
  }
}

/**
 * Save passenger to Supabase
 */
export async function savePassengerToSupabase(passengerData) {
  const client = getSupabaseClient();
  if (!client) return null;
  
  try {
    lastApiError = null;
    const { user, organizationId } = await getOrgContextOrThrow(client);
    
    const supabasePassenger = {
      organization_id: organizationId,
      first_name: passengerData.firstName || passengerData.first_name,
      last_name: passengerData.lastName || passengerData.last_name,
      phone: passengerData.phone,
      email: passengerData.email,
      alt_contact_name: passengerData.altContactName || passengerData.alt_contact_name,
      alt_contact_phone: passengerData.altContactPhone || passengerData.alt_contact_phone,
      notes: passengerData.notes,
      created_by: user.id,
      updated_by: user.id
    };
    
    // Check for duplicate
    const { data: existingRows, error: existingError } = await client
      .from('passengers')
      .select('id')
      .eq('first_name', supabasePassenger.first_name)
      .eq('last_name', supabasePassenger.last_name)
      .eq('email', supabasePassenger.email)
      .eq('organization_id', organizationId);

    if (existingError) throw existingError;
    const existing = Array.isArray(existingRows) && existingRows.length > 0 ? existingRows[0] : null;
    
    if (existing) {
      const { data, error } = await client
        .from('passengers')
        .update(supabasePassenger)
        .eq('id', existing.id)
        .select();
      
      if (error) throw error;
      return data[0];
    } else {
      const { data, error } = await client
        .from('passengers')
        .insert([supabasePassenger])
        .select();
      
      if (error) throw error;
      return data[0];
    }
  } catch (error) {
    console.error('❌ Error saving passenger to Supabase:', error);
    lastApiError = error;
    return null;
  }
}

/**
 * Save booking agent to Supabase
 */
export async function saveBookingAgentToSupabase(agentData) {
  const client = getSupabaseClient();
  if (!client) return null;
  
  try {
    lastApiError = null;
    const { user, organizationId } = await getOrgContextOrThrow(client);
    
    const supabaseAgent = {
      organization_id: organizationId,
      first_name: agentData.firstName || agentData.first_name,
      last_name: agentData.lastName || agentData.last_name,
      phone: agentData.phone,
      email: agentData.email,
      notes: agentData.notes,
      created_by: user.id,
      updated_by: user.id
    };
    
    // Check for duplicate
    const { data: existingRows, error: existingError } = await client
      .from('booking_agents')
      .select('id')
      .eq('first_name', supabaseAgent.first_name)
      .eq('last_name', supabaseAgent.last_name)
      .eq('email', supabaseAgent.email)
      .eq('organization_id', organizationId);

    if (existingError) throw existingError;
    const existing = Array.isArray(existingRows) && existingRows.length > 0 ? existingRows[0] : null;
    
    if (existing) {
      const { data, error } = await client
        .from('booking_agents')
        .update(supabaseAgent)
        .eq('id', existing.id)
        .select();
      
      if (error) throw error;
      return data[0];
    } else {
      const { data, error } = await client
        .from('booking_agents')
        .insert([supabaseAgent])
        .select();
      
      if (error) throw error;
      return data[0];
    }
  } catch (error) {
    console.error('❌ Error saving booking agent to Supabase:', error);
    lastApiError = error;
    return null;
  }
}


// ============================================================================
// SERVICE TYPE CRUD OPERATIONS
// ============================================================================
//
// Source of truth for Reservation Form "Service Type" dropdown and for
// Vehicle Types "Associated with Service Types" assignment.
//
// Strategy:
// - Prefer Supabase table `service_types` when available
// - Fall back to localStorage when table is missing / auth isn't ready
//
// Local storage key is also used as a cache so changes made in the Service Types
// System Settings iframe can propagate across pages via the `storage` event.
//

const LOCAL_SERVICE_TYPES_KEY = 'relia_service_types_v1';

function slugifyServiceTypeCode(input) {
  return (input || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function ensureServiceTypeId(st) {
  if (st?.id && typeof st.id === 'string') return st.id;
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
  } catch (e) {
    // ignore
  }
  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeServiceTypeRow(row) {
  const name = (row?.name || '').toString().trim();
  const code = (row?.code || row?.service_code || '').toString().trim() || slugifyServiceTypeCode(name);
  const statusRaw = (row?.status ?? row?.active ?? row?.is_active ?? 'ACTIVE');
  const status = (typeof statusRaw === 'string')
    ? statusRaw.toUpperCase()
    : (statusRaw === false ? 'INACTIVE' : 'ACTIVE');

  const billingMode = (row?.billing_mode || row?.pricing_type || row?.rate_mode || '').toString().trim() || null;

  return {
    id: row?.id || null,
    organization_id: row?.organization_id || null,
    name,
    code,
    status,
    billing_mode: billingMode,
    sort_order: Number.isFinite(Number(row?.sort_order)) ? Number(row.sort_order) : 0,
    description: (row?.description || '').toString(),
    metadata: row?.metadata && typeof row.metadata === 'object' ? row.metadata : {}
  };
}

function dedupeServiceTypes(list) {
  const out = [];
  const seen = new Set();
  (Array.isArray(list) ? list : []).forEach((raw) => {
    const st = normalizeServiceTypeRow(raw);
    const key = (st.code || st.name || '').toLowerCase();
    if (!key) return;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ ...st, id: st.id || ensureServiceTypeId(st) });
  });

  // Keep stable ordering: sort_order then name
  out.sort((a, b) => {
    const ao = Number.isFinite(a.sort_order) ? a.sort_order : 0;
    const bo = Number.isFinite(b.sort_order) ? b.sort_order : 0;
    if (ao !== bo) return ao - bo;
    return (a.name || '').localeCompare(b.name || '');
  });

  return out;
}

function defaultServiceTypesSeed() {
  return [
    { name: 'From Airport', code: 'from-airport', status: 'ACTIVE', billing_mode: 'DISTANCE', sort_order: 10 },
    { name: 'To Airport', code: 'to-airport', status: 'ACTIVE', billing_mode: 'DISTANCE', sort_order: 20 },
    { name: 'Point-to-Point', code: 'point-to-point', status: 'ACTIVE', billing_mode: 'DISTANCE', sort_order: 30 },
    { name: 'Hourly / As Directed', code: 'hourly', status: 'ACTIVE', billing_mode: 'HOURLY', sort_order: 40 },
  ];
}

function loadLocalServiceTypes() {
  try {
    const raw = localStorage.getItem(LOCAL_SERVICE_TYPES_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed) && parsed.length) {
      return dedupeServiceTypes(parsed);
    }
  } catch (e) {
    // ignore
  }

  const seeded = dedupeServiceTypes(defaultServiceTypesSeed().map((st) => ({ ...st, id: ensureServiceTypeId(st) })));
  try {
    localStorage.setItem(LOCAL_SERVICE_TYPES_KEY, JSON.stringify(seeded));
  } catch (e) {
    // ignore
  }
  return seeded;
}

function saveLocalServiceTypes(list) {
  const cleaned = dedupeServiceTypes(list);
  try {
    localStorage.setItem(LOCAL_SERVICE_TYPES_KEY, JSON.stringify(cleaned));
  } catch (e) {
    console.warn('⚠️ Unable to persist service types locally:', e);
  }
  return cleaned;
}

function isActiveServiceType(st) {
  const flag = (st?.status || '').toString().trim().toUpperCase();
  if (!flag) return true;
  return flag === 'ACTIVE';
}

function ensureUniqueServiceCode(list, desiredCode, currentId = null) {
  let code = slugifyServiceTypeCode(desiredCode);
  if (!code) code = 'service';
  const existing = new Set(
    (Array.isArray(list) ? list : [])
      .filter((x) => !currentId || x.id !== currentId)
      .map((x) => (x.code || '').toLowerCase())
      .filter(Boolean)
  );

  if (!existing.has(code.toLowerCase())) return code;

  // append -2, -3 ...
  let n = 2;
  while (existing.has(`${code}-${n}`.toLowerCase())) n += 1;
  return `${code}-${n}`;
}

export async function fetchServiceTypes(options = {}) {
  const { includeInactive = false } = options;
  const client = getSupabaseClient();
  // Try Supabase first
  if (client) {
    try {
      lastApiError = null;
      const { organizationId } = await getOrgContextOrThrow(client);
      const { data, error } = await client
        .from('service_types')
        .select('*')
        .eq('organization_id', organizationId)
        .order('sort_order', { ascending: true });

      if (error) throw error;

      const normalized = dedupeServiceTypes(data || []);
      // Cache locally for fast rendering + cross-page sync
      saveLocalServiceTypes(normalized);
      if (includeInactive) return normalized;
      return normalized.filter(isActiveServiceType);
    } catch (error) {
      // Most common failure: table doesn't exist yet (relation "service_types" does not exist)
      console.warn('⚠️ fetchServiceTypes failed; falling back to local storage:', error);
      lastApiError = error;
    }
  }

  const local = loadLocalServiceTypes();
  if (includeInactive) return local;
  return local.filter(isActiveServiceType);
}

export async function upsertServiceType(serviceType) {
  const draft = normalizeServiceTypeRow(serviceType || {});
  if (!draft.name) {
    throw new Error('Service Type name is required');
  }

  // Always ensure code is present + unique in local cache
  const localExisting = loadLocalServiceTypes();
  const isValidUuid = typeof draft.id === 'string'
    && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(draft.id);

  draft.id = draft.id || ensureServiceTypeId(draft);
  draft.code = ensureUniqueServiceCode(localExisting, draft.code || draft.name, draft.id);

  const client = getSupabaseClient();

  // Try Supabase first
  if (client) {
    try {
      lastApiError = null;
      const { organizationId, user } = await getOrgContextOrThrow(client);
      const now = new Date().toISOString();

      const payload = {
        id: isValidUuid ? draft.id : undefined,
        organization_id: organizationId,
        name: draft.name,
        code: draft.code,
        status: (draft.status || 'ACTIVE').toString().toUpperCase(),
        billing_mode: draft.billing_mode,
        sort_order: Number.isFinite(draft.sort_order) ? draft.sort_order : 0,
        description: draft.description || null,
        metadata: draft.metadata || {},
        updated_at: now,
        updated_by: user?.id || null,
        created_at: isValidUuid ? undefined : now,
        created_by: isValidUuid ? undefined : (user?.id || null),
      };

      // Upsert and return row
      const table = client.from('service_types');

      let response;
      if (typeof table.upsert === 'function') {
        // Supabase-js style client
        response = await table.upsert([payload]).select();
      } else if (isValidUuid) {
        // REST client fallback: update by id
        const updatePayload = { ...payload };
        delete updatePayload.created_at;
        delete updatePayload.created_by;
        delete updatePayload.organization_id;

        response = await table
          .update(updatePayload)
          .eq('id', draft.id)
          .eq('organization_id', organizationId)
          .select();

        // If row didn't exist, insert instead
        if (!response?.data || (Array.isArray(response.data) && response.data.length === 0)) {
          const insertPayload = { ...payload };
          delete insertPayload.id; // let DB generate id
          response = await table.insert([insertPayload]).select();
        }
      } else {
        // REST client fallback: insert new
        const insertPayload = { ...payload };
        delete insertPayload.id; // let DB generate id
        response = await table.insert([insertPayload]).select();
      }

      const { data, error } = response || {};
      if (error) throw error;

      const row = Array.isArray(data) ? data[0] || null : data;
      if (row) {
        const normalized = normalizeServiceTypeRow(row);
        // update local cache too
        const updatedLocal = localExisting.filter((x) => x.id !== normalized.id);
        updatedLocal.push({ ...normalized, id: normalized.id || ensureServiceTypeId(normalized) });
        saveLocalServiceTypes(updatedLocal);
        return normalized;
      }
    } catch (error) {
      console.warn('⚠️ upsertServiceType failed; saving locally:', error);
      lastApiError = error;
      // fall through to local save
    }
  }

  // Local fallback upsert
  const updated = localExisting.filter((x) => x.id !== draft.id);
  updated.push(draft);
  saveLocalServiceTypes(updated);
  return draft;
}

export async function deleteServiceType(serviceTypeId) {
  if (!serviceTypeId) return false;
  const client = getSupabaseClient();
  // Try Supabase delete
  if (client) {
    try {
      lastApiError = null;
      const { organizationId } = await getOrgContextOrThrow(client);
      const { error } = await client
        .from('service_types')
        .delete()
        .eq('id', serviceTypeId)
        .eq('organization_id', organizationId);

      if (error) throw error;
    } catch (error) {
      console.warn('⚠️ deleteServiceType failed; deleting locally:', error);
      lastApiError = error;
      // fall through to local delete
    }
  }

  const localExisting = loadLocalServiceTypes();
  const updated = localExisting.filter((x) => x.id !== serviceTypeId);
  saveLocalServiceTypes(updated);
  return true;
}
