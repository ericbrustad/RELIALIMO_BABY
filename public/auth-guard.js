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
      if (!session) return null;

      const expiresAtMs = session.expires_at ? session.expires_at * 1000 : null;
      const remaining = expiresAtMs ? (expiresAtMs - Date.now()) : null;

      if (force || (remaining != null && remaining < minimumRemainingMs)) {
        const { data, error } = await supabase.auth.refreshSession();
        if (!error && data?.session) return data.session;
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

  if (event === 'SIGNED_OUT') {
    if (!isAuthPage) {
      window.location.replace('/auth.html');
    }
  } else if (event === 'SIGNED_IN' && isAuthPage) {
    window.location.replace('/');
  }
  
  // Sync session to localStorage for other parts of the app
  if (session) {
    lastKnownSession = session;
    localStorage.setItem('supabase_session', JSON.stringify(session));
    if (session.access_token) {
      localStorage.setItem('supabase_access_token', session.access_token);
    }

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

// Initial auth check on page load
handleAuth();

export { supabase };

