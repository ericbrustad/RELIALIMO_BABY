import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getSupabaseCredentials, getSupabaseAuthUrl } from './supabase-config.js';

const { anonKey: SUPABASE_ANON_KEY } = getSupabaseCredentials();
const SUPABASE_URL = getSupabaseAuthUrl();

// Create Supabase client with proper auth configuration
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

// =====================================================
// PROACTIVE SESSION REFRESH - Prevent JWT Expiration
// =====================================================
const REFRESH_BUFFER_MS = 5 * 60 * 1000; // Refresh 5 minutes before expiry
let refreshTimer = null;

async function scheduleTokenRefresh() {
  // Clear any existing timer
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.expires_at) return;

    const expiresAtMs = session.expires_at * 1000;
    const now = Date.now();
    const timeUntilExpiry = expiresAtMs - now;
    const refreshIn = Math.max(timeUntilExpiry - REFRESH_BUFFER_MS, 10000); // Min 10 seconds

    console.log(`AuthGuard: Token expires in ${Math.round(timeUntilExpiry / 60000)} min, scheduling refresh in ${Math.round(refreshIn / 60000)} min`);

    refreshTimer = setTimeout(async () => {
      console.log('AuthGuard: Proactively refreshing session...');
      const { data, error } = await supabase.auth.refreshSession();
      if (error) {
        console.error('AuthGuard: Proactive refresh failed:', error.message);
        // If refresh fails, redirect to login
        const isAuthPage = window.location.pathname.endsWith('/auth.html');
        if (!isAuthPage) {
          window.location.replace('/auth.html');
        }
      } else if (data?.session) {
        console.log('AuthGuard: Session refreshed proactively');
        scheduleTokenRefresh(); // Schedule next refresh
      }
    }, refreshIn);
  } catch (e) {
    console.warn('AuthGuard: Failed to schedule token refresh:', e);
  }
}

// Refresh token when user returns to the tab (visibility change)
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible') {
      console.log('AuthGuard: Tab became visible, checking session...');
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const expiresAtMs = session.expires_at ? session.expires_at * 1000 : null;
          const remaining = expiresAtMs ? (expiresAtMs - Date.now()) : null;
          
          // If less than 5 minutes remaining or already expired, refresh immediately
          if (remaining !== null && remaining < REFRESH_BUFFER_MS) {
            console.log('AuthGuard: Session expiring soon, refreshing now...');
            const { data, error } = await supabase.auth.refreshSession();
            if (error) {
              console.error('AuthGuard: Visibility refresh failed:', error.message);
              const isAuthPage = window.location.pathname.endsWith('/auth.html');
              if (!isAuthPage) {
                window.location.replace('/auth.html');
              }
            } else if (data?.session) {
              console.log('AuthGuard: Session refreshed on visibility change');
              scheduleTokenRefresh();
            }
          } else {
            scheduleTokenRefresh(); // Reschedule based on current expiry
          }
        }
      } catch (e) {
        console.warn('AuthGuard: Visibility check failed:', e);
      }
    }
  });
}

// Start the proactive refresh timer on load (delayed to avoid init race conditions)
setTimeout(() => {
  scheduleTokenRefresh().catch(e => {
    // Ignore AbortError - happens when page navigates during init
    if (e?.name !== 'AbortError') {
      console.warn('AuthGuard: Initial token refresh scheduling failed:', e);
    }
  });
}, 100);

// Expose a single, SDK-managed session refresher for the rest of the app.
// This prevents refresh-token races between multiple auth implementations.
if (typeof window !== 'undefined') {
  window.__RELIA_SDK_AUTH_MANAGED = true;

  // Provide a shared helper to obtain a fresh session (and optionally force refresh).
  window.__reliaGetValidSession = async function getValidSession(options = {}) {
    const minimumRemainingMs = Number.isFinite(options.minimumRemainingMs) ? options.minimumRemainingMs : 120_000;
    const force = options.force === true;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.warn('AuthGuard: No session found, user may need to re-login');
        return null;
      }

      const expiresAtMs = session.expires_at ? session.expires_at * 1000 : null;
      const remaining = expiresAtMs ? (expiresAtMs - Date.now()) : null;

      // Check if token is already expired or about to expire
      if (force || (remaining != null && remaining < minimumRemainingMs)) {
        console.log('AuthGuard: Refreshing session (force:', force, ', remaining:', remaining, 'ms)');
        const { data, error } = await supabase.auth.refreshSession();
        if (error) {
          console.error('AuthGuard: Session refresh failed:', error.message);
          // If refresh fails due to expired refresh token, redirect to login
          if (error.message?.includes('expired') || error.message?.includes('invalid')) {
            console.warn('AuthGuard: Refresh token expired/invalid, redirecting to login');
            const isAuthPage = window.location.pathname.endsWith('/auth.html');
            if (!isAuthPage) {
              window.location.replace('/auth.html');
            }
            return null;
          }
          return session; // Return existing session, it might still work
        }
        if (data?.session) {
          console.log('AuthGuard: Session refreshed successfully');
          return data.session;
        }
      }
      return session;
    } catch (e) {
      console.warn('AuthGuard: __reliaGetValidSession failed', e);
      return null;
    }
  };
}

// --- AUTH LOGIC ---

let lastKnownSession = null;

// Check if we're inside an iframe (e.g., admin.html loads index.html in iframe)
// If in iframe, the parent handles auth - don't redirect
function isInsideIframe() {
  try {
    return window !== window.top;
  } catch (e) {
    // Cross-origin iframe access will throw
    return true;
  }
}

// Try to hydrate session from localStorage cache
async function hydrateFromCache() {
  try {
    const cached = localStorage.getItem('supabase_session');
    if (!cached) return null;
    const parsed = JSON.parse(cached);
    if (parsed?.access_token && parsed?.refresh_token) {
      const { data, error } = await supabase.auth.setSession({
        access_token: parsed.access_token,
        refresh_token: parsed.refresh_token,
      });
      if (!error && data?.session) {
        lastKnownSession = data.session;
        return data.session;
      }
    }
  } catch (err) {
    console.warn('AuthGuard: failed to hydrate from cache', err);
  }
  return null;
}

// Ask parent/top window for a session if embedded
function requestSessionFromParent(timeoutMs = 1200) {
  return new Promise((resolve) => {
    if (window === window.top) return resolve(null);

    const requestId = `relia-session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(null);
      window.removeEventListener('message', onMessage);
    }, timeoutMs);

    function onMessage(event) {
      if (event.origin !== window.location.origin) return;
      const { type, session, requestId: incomingId } = event.data || {};
      if (type === 'RELIA_SUPABASE_SESSION' && incomingId === requestId) {
        clearTimeout(timer);
        settled = true;
        window.removeEventListener('message', onMessage);
        resolve(session || null);
      }
    }

    window.addEventListener('message', onMessage);
    window.top.postMessage({ type: 'RELIA_REQUEST_SUPABASE_SESSION', requestId }, window.location.origin);
  });
}

// Respond to children asking for session (only same-origin)
window.addEventListener('message', async (event) => {
  if (event.origin !== window.location.origin) return;
  const { type, requestId } = event.data || {};
  if (type !== 'RELIA_REQUEST_SUPABASE_SESSION') return;

  const { data: { session } } = await supabase.auth.getSession();
  const sessionToSend = session || lastKnownSession || null;
  if (!sessionToSend) return;
  event.source?.postMessage({
    type: 'RELIA_SUPABASE_SESSION',
    requestId,
    session: sessionToSend,
  }, event.origin);
});

// Function to handle redirection
const handleAuth = async () => {
  // If we're inside an iframe (e.g., admin.html embedding index.html),
  // don't redirect - the parent window handles authentication
  if (isInsideIframe()) {
    console.log('AuthGuard: Running in iframe, skipping redirect (parent handles auth)');
    // Still try to get session from parent for API calls
    const parentSession = await requestSessionFromParent();
    if (parentSession?.access_token && parentSession?.refresh_token) {
      const { data, error } = await supabase.auth.setSession({
        access_token: parentSession.access_token,
        refresh_token: parentSession.refresh_token,
      });
      if (!error && data?.session) {
        console.log('AuthGuard: Session received from parent');
        lastKnownSession = data.session;
      }
    }
    return;
  }

  const { data: { session: liveSession } } = await supabase.auth.getSession();
  let session = liveSession;
  const isAuthPage = window.location.pathname.endsWith('/auth.html');

  // Attempt to rehydrate before forcing login
  if (!session) {
    session = await hydrateFromCache();
  }
  if (!session) {
    const parentSession = await requestSessionFromParent();
    if (parentSession?.access_token && parentSession?.refresh_token) {
      const { data, error } = await supabase.auth.setSession({
        access_token: parentSession.access_token,
        refresh_token: parentSession.refresh_token,
      });
      if (!error && data?.session) {
        session = data.session;
      }
    }
  }

  if (!session && !isAuthPage) {
    console.log('AuthGuard: No session, redirecting to login.');
    window.location.replace('/auth.html');
  } else if (session && isAuthPage) {
    console.log('AuthGuard: Session found on auth page, redirecting to app.');
    window.location.replace('/');
  } else {
    console.log('AuthGuard: Auth check passed.');
  }
};

// Listen for auth state changes
supabase.auth.onAuthStateChange((event, session) => {
  console.log(`AuthGuard: Auth state changed. Event: ${event}`);
  const isAuthPage = window.location.pathname.endsWith('/auth.html');
  const inIframe = isInsideIframe();

  if (event === 'SIGNED_OUT') {
    // Clear refresh timer on sign out
    if (refreshTimer) {
      clearTimeout(refreshTimer);
      refreshTimer = null;
    }
    // Only redirect if not in iframe - parent handles iframe auth
    if (!isAuthPage && !inIframe) {
      window.location.replace('/auth.html');
    }
  } else if (event === 'SIGNED_IN' && isAuthPage && !inIframe) {
    window.location.replace('/');
  }
  
  // Sync session to localStorage for other parts of the app
  if (session) {
    lastKnownSession = session;
    localStorage.setItem('supabase_session', JSON.stringify(session));
    if (session.access_token) {
      localStorage.setItem('supabase_access_token', session.access_token);
    }

    // Schedule proactive token refresh for new session
    scheduleTokenRefresh();

    // Notify any buildless REST helpers listening for auth updates in this same window.
    try {
      window.dispatchEvent(new CustomEvent('supabase-session-change', { detail: session }));
    } catch (_) {}
  } else {
    lastKnownSession = null;
    localStorage.removeItem('supabase_session');
    localStorage.removeItem('supabase_access_token');

    try {
      window.dispatchEvent(new CustomEvent('supabase-session-change', { detail: null }));
    } catch (_) {}
  }
});

// Initial auth check on page load (delayed to allow parent session sharing)
setTimeout(() => {
  handleAuth().catch(e => {
    // Ignore AbortError - happens when page navigates during init
    if (e?.name !== 'AbortError') {
      console.error('AuthGuard: Initial auth check failed:', e);
    }
  });
}, 50);

export { supabase };

