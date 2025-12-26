// Supabase Client - REST API (Buildless Compatible)
// Pure fetch-based REST API client - no SDK dependency

import { getSupabaseCredentials } from './supabase-config.js';

// Lazy-loaded credentials (resolved on first use, after env.js loads)
let _supabaseUrl = null;
let _supabaseAnonKey = null;

function ensureCredentials() {
  if (!_supabaseUrl || !_supabaseAnonKey) {
    const creds = getSupabaseCredentials();
    _supabaseUrl = creds.url;
    _supabaseAnonKey = creds.anonKey;
  }
  return { url: _supabaseUrl, anonKey: _supabaseAnonKey };
}

// Export getters for lazy access
export function getSupabaseUrl() {
  return ensureCredentials().url;
}

export function getSupabaseAnonKey() {
  return ensureCredentials().anonKey;
}

// Legacy exports for compatibility (use getters internally)
export const supabaseUrl = null; // Deprecated - use getSupabaseUrl()
export const supabaseAnonKey = null; // Deprecated - use getSupabaseAnonKey()

// Demo fallback credentials for offline auth
const OFFLINE_DEMO_ACCOUNTS = {
  'admin@relialimo.demo': {
    password: 'G0dD@mnNutj08!',
    role: 'admin'
  },
  'dispatcher@relialimo.demo': {
    password: 'DemoDispatcher123!',
    role: 'dispatcher'
  },
  'driver@relialimo.demo': {
    password: 'DemoDriver123!',
    role: 'driver'
  }
};

// Note: Credentials are validated lazily when first used, not at module load time
// This allows env.js to load first

console.log('✅ Supabase REST API client module loaded (credentials resolved on first use)');

const SESSION_STORAGE_KEY = 'supabase_session';

// The official SDK uses this pattern: sb-<project-ref>-auth-token
const SDK_SESSION_KEY = 'sb-siumiadylwcrkaqsfwkj-auth-token';

function loadStoredSession() {
  try {
    // First check our custom key
    let session = localStorage.getItem(SESSION_STORAGE_KEY);
    if (session) {
      return JSON.parse(session);
    }
    
    // Fall back to official SDK storage key
    session = localStorage.getItem(SDK_SESSION_KEY);
    if (session) {
      console.log('ℹ️ Found session in SDK storage, migrating...');
      const parsed = JSON.parse(session);
      // SDK stores session nested: { currentSession: {...}, expiresAt: ... }
      // OR directly as the session object
      const actualSession = parsed.currentSession || parsed;
      // Persist to our key for future use
      if (actualSession?.access_token) {
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(actualSession));
        return actualSession;
      }
      return parsed;
    }
    
    return null;
  } catch (error) {
    console.error('❌ Failed to parse stored session:', error);
    return null;
  }
}

function base64UrlDecode(segment) {
  try {
    const padded = segment.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(segment.length / 4) * 4, '=');

    if (typeof atob === 'function') {
      return atob(padded);
    }

    if (typeof Buffer !== 'undefined') {
      return Buffer.from(padded, 'base64').toString('utf8');
    }
  } catch (error) {
    console.warn('⚠️ base64 decode failed:', error);
  }

  return null;
}

function decodeJwt(token) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const payload = base64UrlDecode(parts[1]);
  if (!payload) return null;

  try {
    return JSON.parse(payload);
  } catch (error) {
    console.warn('⚠️ Failed to parse JWT payload:', error);
    return null;
  }
}

function computeExpiryTimestamp(session) {
  if (!session) return null;

  if (typeof session.expires_at === 'number' && Number.isFinite(session.expires_at)) {
    return session.expires_at;
  }

  if (session.expires_in != null) {
    const expiresInMs = Number(session.expires_in) * 1000;
    if (Number.isFinite(expiresInMs)) {
      return Date.now() + expiresInMs;
    }
  }

  const decoded = decodeJwt(session.access_token);
  if (decoded?.exp) {
    return decoded.exp * 1000;
  }

  return null;
}

function normalizeSession(session) {
  if (!session) return session;

  const normalized = { ...session };
  const expiresAt = computeExpiryTimestamp(normalized);

  if (expiresAt) {
    normalized.expires_at = expiresAt;
  }

  if (!normalized.user && normalized.session?.user) {
    normalized.user = normalized.session.user;
  }

  return normalized;
}

function persistSession(session) {
  if (!session) return;

  const normalized = normalizeSession(session);
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(normalized));

  if (normalized.access_token) {
    localStorage.setItem('supabase_access_token', normalized.access_token);
  }

  notifySessionChange();
}

function sessionNeedsRefresh(session, thresholdMs = 60_000) {
  if (!session) return false;

  const token = session.access_token;
  if (!token || token.startsWith('offline-')) {
    return false;
  }

  const expiresAt = computeExpiryTimestamp(session);
  if (!expiresAt) return false;

  const timeRemaining = expiresAt - Date.now();
  return timeRemaining <= thresholdMs;
}

async function performTokenRefresh(currentSession) {
  const refreshToken = currentSession?.refresh_token;

  if (!refreshToken || refreshToken.startsWith('offline-')) {
    return { success: false, error: 'No refresh token available' };
  }

  try {
    const response = await fetch(`${getSupabaseUrl()}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': getSupabaseAnonKey()
      },
      body: JSON.stringify({ refresh_token: refreshToken })
    });

    if (!response.ok) {
      const details = await response.text().catch(() => null);
      const message = `Token refresh failed (${response.status})`;
      return { success: false, error: message, details };
    }

    const data = await response.json();
    const merged = normalizeSession({
      ...currentSession,
      ...data,
      access_token: data.access_token || currentSession.access_token,
      refresh_token: data.refresh_token || currentSession.refresh_token,
      user: data.user || currentSession.user
    });

    persistSession(merged);
    return { success: true, session: merged };
  } catch (error) {
    console.error('❌ Token refresh exception:', error);
    return { success: false, error: error.message || error };
  }
}

export async function refreshSessionIfNeeded(options = {}) {
  const { force = false, minimumRemainingMs = 60_000 } = options;
  const session = loadStoredSession();

  if (!session) {
    return { success: false, reason: 'no-session' };
  }

  if (!force && !sessionNeedsRefresh(session, minimumRemainingMs)) {
    return { success: true, refreshed: false, session };
  }

  const result = await performTokenRefresh(session);
  if (result.success) {
    return { success: true, refreshed: true, session: result.session };
  }

  return { success: false, error: result.error, details: result.details };
}

function notifySessionChange() {
  const session = loadStoredSession();
  window.dispatchEvent(new CustomEvent('supabase-session-change', { detail: session }));
}

function isOffline() {
  return typeof navigator !== 'undefined' && navigator?.onLine === false;
}

function isNetworkError(error) {
  return (
    error?.code === 'ENETUNREACH' ||
    error?.message?.includes('ENETUNREACH') ||
    error?.message?.includes('fetch failed') ||
    error?.message?.includes('Failed to fetch')
  );
}

function buildOfflineSession(email, role) {
  const session = {
    access_token: `offline-${Date.now()}`,
    user: {
      id: `offline-${role}-${Date.now()}`,
      email,
      role,
      is_demo: true
    }
  };

  persistSession(session);

  return {
    success: true,
    user: session.user,
    session,
    access_token: session.access_token
  };
}

// Mock Supabase client for buildless environment
// This is a minimal mock that allows imports to work without throwing errors
export const supabase = {
  get url() { return getSupabaseUrl(); },
  get key() { return getSupabaseAnonKey(); },
  auth: {
    getUser: async () => {
      const session = loadStoredSession();
      let user = session?.user || null;
      
      // If no user in session but we have an access token, try to decode it
      if (!user && session?.access_token && !session.access_token.startsWith('offline-')) {
        try {
          const decoded = decodeJwt(session.access_token);
          if (decoded && decoded.sub) {
            user = {
              id: decoded.sub,
              email: decoded.email,
              role: decoded.role || 'authenticated'
            };
            console.log('ℹ️ User extracted from JWT:', user.email);
          }
        } catch (e) {
          console.warn('⚠️ Could not decode user from JWT:', e);
        }
      }
      
      return { data: { user }, error: null };
    },
    getSession: async () => {
      const session = loadStoredSession();
      return { data: { session: session || null }, error: null };
    },
    signInWithPassword: async ({ email, password }) => {
      const result = await signInWithEmail(email, password);

      if (!result.success) {
        return { data: null, error: { message: result.error || 'Sign in failed' } };
      }

      const session = result.session || {
        access_token: result.access_token,
        user: result.user
      };

      persistSession(session);

      return {
        data: {
          session,
          user: result.user
        },
        error: null
      };
    },
    signOut: async () => {
      const result = await signOut();
      return { error: result.success ? null : { message: result.error || 'Sign out failed' } };
    },
    onAuthStateChange: (callback) => {
      console.log('ℹ️ Auth state listener registered');

      const handler = (event) => {
        const session = event?.detail ?? loadStoredSession();
        const eventName = session ? 'SIGNED_IN' : 'SIGNED_OUT';
        callback?.(eventName, session);
      };

      // Fire once with the current state
      handler({ detail: loadStoredSession() });

      window.addEventListener('storage', handler);
      window.addEventListener('supabase-session-change', handler);

      return () => {
        window.removeEventListener('storage', handler);
        window.removeEventListener('supabase-session-change', handler);
      };
    }
  },
  from: (table) => new PostgrestQuery(table)
};

class PostgrestQuery {
  constructor(table) {
    this.table = table;
    this.method = 'GET';
    this.filters = [];
    this.orderBy = null;
    this.selectColumns = null;
    this.body = undefined;
    this.returnRepresentation = false;
    this.expectSingle = false;
    this._limit = null;
  }

  select(columns = '*') {
    this.selectColumns = columns;
    if (this.method === 'POST' || this.method === 'PATCH' || this.method === 'DELETE') {
      this.returnRepresentation = true;
    } else {
      this.method = 'GET';
    }
    return this;
  }

  insert(rows) {
    this.method = 'POST';
    this.body = rows;
    return this;
  }

  update(values) {
    this.method = 'PATCH';
    this.body = values;
    return this;
  }

  delete() {
    this.method = 'DELETE';
    return this;
  }

  eq(column, value) {
    this.filters.push({ op: 'eq', column, value });
    return this;
  }

  order(column, options = {}) {
    const dir = options.ascending === false ? 'desc' : 'asc';
    this.orderBy = { column, dir };
    return this;
  }

  single() {
    this.expectSingle = true;
    return this;
  }

  limit(n) {
    this._limit = typeof n === 'number' ? Math.max(0, Math.floor(n)) : null;
    return this;
  }

  async execute() {
    const url = new URL(`${getSupabaseUrl()}/rest/v1/${this.table}`);

    if (this.selectColumns) {
      url.searchParams.set('select', this.selectColumns);
    }

    if (this.orderBy?.column) {
      url.searchParams.set('order', `${this.orderBy.column}.${this.orderBy.dir}`);
    }

    if (this._limit != null) {
      url.searchParams.set('limit', String(this._limit));
    }

    this.filters.forEach(f => {
      url.searchParams.append(f.column, `${f.op}.${f.value}`);
    });

    const hasBody = this.method === 'POST' || this.method === 'PATCH';
    const bodyPayload = hasBody ? JSON.stringify(this.body ?? {}) : undefined;

    let attempt = 0;
    let lastError = null;

    while (attempt < 2) {
      if (attempt === 0) {
        await refreshSessionIfNeeded({ minimumRemainingMs: 2 * 60_000 });
      } else {
        const refreshOutcome = await refreshSessionIfNeeded({ force: true });
        if (!refreshOutcome.success) {
          break;
        }
      }

      const token = localStorage.getItem('supabase_access_token') || getSupabaseAnonKey();

      const headers = {
        apikey: getSupabaseAnonKey(),
        Authorization: `Bearer ${token}`
      };

      if (this.expectSingle) {
        headers.Accept = 'application/vnd.pgrst.object+json';
      }

      if (this.returnRepresentation) {
        headers.Prefer = 'return=representation';
      }

      if (hasBody) {
        headers['Content-Type'] = 'application/json';
      }

      const response = await fetch(url.toString(), {
        method: this.method,
        headers,
        body: bodyPayload
      });

      const contentType = response.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json') || contentType.includes('+json');

      const payload = response.status === 204
        ? null
        : (isJson ? await response.json().catch(() => null) : await response.text().catch(() => null));

      if (response.ok) {
        return { data: payload, error: null };
      }

      const message = (payload && typeof payload === 'object' && (payload.message || payload.error_description || payload.error))
        ? (payload.message || payload.error_description || payload.error)
        : `Supabase request failed (${response.status})`;

      lastError = {
        status: response.status,
        message,
        details: payload
      };

      if (response.status === 401 && /jwt expired/i.test(message || '') && attempt === 0) {
        attempt += 1;
        continue;
      }

      break;
    }

    return { data: null, error: lastError };
  }

  then(onFulfilled, onRejected) {
    return this.execute().then(onFulfilled, onRejected);
  }

  catch(onRejected) {
    return this.execute().catch(onRejected);
  }

  finally(onFinally) {
    return this.execute().finally(onFinally);
  }
}

// Test connection via simple REST request
export async function testSupabaseConnection() {
  try {
    const response = await fetch(`${getSupabaseUrl()}/rest/v1/`, {
      method: 'GET',
      headers: {
        'apikey': getSupabaseAnonKey(),
        'Authorization': `Bearer ${getSupabaseAnonKey()}`
      }
    });
    
    if (response.ok) {
      console.log('✅ Supabase REST API connected successfully');
      return true;
    } else {
      console.error('❌ Supabase REST API connection failed:', response.status);
      return false;
    }
  } catch (error) {
    console.error('❌ Connection test error:', error);
    return false;
  }
}

// Get current user from localStorage (session-based auth)
export async function getCurrentUser() {
  try {
    const session = loadStoredSession();
    return session?.user || null;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

// Get current session from localStorage
export async function getCurrentSession() {
  try {
    return loadStoredSession();
  } catch (error) {
    console.error('Error getting current session:', error);
    return null;
  }
}

// Sign in with email/password via REST API
export async function signInWithEmail(email, password) {
  try {
    const response = await fetch(`${getSupabaseUrl()}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'apikey': getSupabaseAnonKey(),
        'Authorization': `Bearer ${getSupabaseAnonKey()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email,
        password
      })
    });
    
    const data = await response.json();
    
    if (!response.ok || data.error) {
      console.error('❌ Sign in error:', data.error || data.error_description);
      return { success: false, error: data.error || 'Sign in failed' };
    }
    
    // Store session
    persistSession(data);

    console.log('✅ Signed in:', email);
    return {
      success: true,
      user: data.user,
      session: data,
      access_token: data.access_token
    };
  } catch (error) {
    console.error('❌ Sign in exception:', error);

    const lowerEmail = email?.toLowerCase();
    const offlineAccount = OFFLINE_DEMO_ACCOUNTS[lowerEmail];

    const canUseOfflineDemo =
      offlineAccount &&
      offlineAccount.password === password &&
      (isOffline() || isNetworkError(error));

    if (canUseOfflineDemo) {
      console.warn('⚠️ Network unavailable, using offline demo session');
      return buildOfflineSession(lowerEmail, offlineAccount.role);
    }

    const errorMessage = isOffline() || isNetworkError(error)
      ? 'Network unavailable. Please check your connection and try again.'
      : error.message;

    return { success: false, error: errorMessage };
  }
}

// Sign out
export async function signOut() {
  try {
    // Clear session from localStorage
    localStorage.removeItem(SESSION_STORAGE_KEY);
    localStorage.removeItem('supabase_access_token');

    notifySessionChange();
    
    console.log('✅ Signed out');
    return { success: true };
  } catch (error) {
    console.error('❌ Sign out exception:', error);
    return { success: false, error: error.message };
  }
}

// Get stored auth token
export function getAuthToken() {
  return localStorage.getItem('supabase_access_token');
}

// Set auth token
export function setAuthToken(token) {
  if (token) {
    localStorage.setItem('supabase_access_token', token);
  } else {
    localStorage.removeItem('supabase_access_token');
  }
}

export default supabase;
