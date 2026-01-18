// Shared Supabase credential resolver
// Credentials are resolved lazily to ensure window.ENV is loaded first

let cachedUrl = null;
let cachedAnonKey = null;
let cachedAuthUrl = null;

function loadDotEnvSync() {
  // Try multiple common locations synchronously so the browser can discover env settings
  // even if deploys place them in `server/.env` or `server/.env.local`.
  if (typeof window === 'undefined') return null;
  try {
    const tryPaths = ['.env', 'server/.env', 'server/.env.local', '../.env', '../server/.env'];
    const env = {};
    for (const p of tryPaths) {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', p, false);
        xhr.send(null);
        if (xhr.status !== 200) continue;
        const text = xhr.responseText || '';
        text.split(/\r?\n/).forEach(line => {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) return;
          const eq = trimmed.indexOf('=');
          if (eq === -1) return;
          const key = trimmed.slice(0, eq).trim();
          let val = trimmed.slice(eq + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          env[key] = val;
        });
      } catch (e) {
        // ignore this path and continue
      }
    }

    if (Object.keys(env).length > 0) {
      window.ENV = window.ENV || {};
      Object.assign(window.ENV, env);
      return env;
    }
  } catch (e) {
    console.warn('⚠️ Could not load .env file(s):', e);
  }
  return null;
}

function resolveSupabaseBaseUrl() {
  if (typeof window !== 'undefined' && window.ENV?.SUPABASE_URL) {
    return window.ENV.SUPABASE_URL;
  }

  if (typeof window !== 'undefined' && !window.ENV) {
    loadDotEnvSync();
    if (window.ENV?.SUPABASE_URL) return window.ENV.SUPABASE_URL;
  }

  if (typeof process !== 'undefined') {
    const url = process.env?.NEXT_PUBLIC_SUPABASE_URL || process.env?.SUPABASE_URL;
    if (url) return url;
  }

  if (typeof import.meta !== 'undefined' && import.meta?.env?.VITE_SUPABASE_URL) {
    return import.meta.env.VITE_SUPABASE_URL;
  }

  return null;
}

function resolveSupabaseUrl() {
  if (typeof window !== 'undefined' && window.ENV?.SUPABASE_PROXY_URL) {
    return window.ENV.SUPABASE_PROXY_URL;
  }

  return resolveSupabaseBaseUrl();
}

function resolveSupabaseAuthUrl() {
  return resolveSupabaseBaseUrl();
}

function resolveSupabaseAnonKey() {
  // Check window.ENV first (loaded by env.js)
  if (typeof window !== 'undefined' && window.ENV?.SUPABASE_ANON_KEY) {
    return window.ENV.SUPABASE_ANON_KEY;
  }

   // Try loading .env on the fly if window.ENV was not set yet
  if (typeof window !== 'undefined' && !window.ENV) {
    loadDotEnvSync();
    if (window.ENV?.SUPABASE_ANON_KEY) return window.ENV.SUPABASE_ANON_KEY;
  }

  if (typeof process !== 'undefined') {
    const anonKey = process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env?.SUPABASE_ANON_KEY;
    if (anonKey) return anonKey;
  }

  if (typeof import.meta !== 'undefined' && import.meta?.env?.VITE_SUPABASE_ANON_KEY) {
    return import.meta.env.VITE_SUPABASE_ANON_KEY;
  }

  return null;
}

export function getSupabaseCredentials() {
  // Use cached values if already resolved
  if (cachedUrl && cachedAnonKey) {
    return { url: cachedUrl, anonKey: cachedAnonKey };
  }

  const url = resolveSupabaseUrl();
  const anonKey = resolveSupabaseAnonKey();

  // Dev fallback: allow running without explicit env.js when developer sets FORCE_DATABASE_ON_LOCALHOST
  const forceDb = (typeof window !== 'undefined' && window.ENV && window.ENV.FORCE_DATABASE_ON_LOCALHOST) === true;
  const isFileProtocol = typeof window !== 'undefined' && window.location && window.location.protocol === 'file:';
  const hostname = (typeof window !== 'undefined' && window.location && window.location.hostname) ? window.location.hostname : '';
  const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '' || isFileProtocol;

  if (!url || !anonKey) {
    const missing = [];
    if (!url) missing.push('SUPABASE_URL (NEXT_PUBLIC_SUPABASE_URL | SUPABASE_URL | window.ENV | VITE_SUPABASE_URL)');
    if (!anonKey) missing.push('SUPABASE_ANON_KEY (NEXT_PUBLIC_SUPABASE_ANON_KEY | SUPABASE_ANON_KEY | window.ENV | VITE_SUPABASE_ANON_KEY)');

    if (isLocalHost || forceDb) {
      console.warn('⚠️ Supabase credentials missing, but running in development mode (FORCE_DATABASE_ON_LOCALHOST or file://). Using fallback public credentials for development only.');
      cachedUrl = 'https://siumiadylwcrkaqsfwkj.supabase.co';
      cachedAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpdW1pYWR5bHdjcmthcXNmd2tqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2NjMzMTMsImV4cCI6MjA4MTIzOTMxM30.sSZBsXyOOmIp2eve_SpiUGeIwx3BMoxvY4c7bvE2kKw';
      return { url: cachedUrl, anonKey: cachedAnonKey };
    }

    throw new Error(
      `Supabase credentials are missing: ${missing.join('; ')}. Set your public Supabase URL and anon key environment variables.`
    );
  }

  // Cache for subsequent calls
  cachedUrl = url;
  cachedAnonKey = anonKey;

  return { url, anonKey };
}

export function getSupabaseAuthUrl() {
  if (cachedAuthUrl) return cachedAuthUrl;

  const authUrl = resolveSupabaseAuthUrl();
  if (!authUrl) {
    throw new Error('Supabase auth URL is missing: set SUPABASE_URL in env.js or .env');
  }

  cachedAuthUrl = authUrl;
  return cachedAuthUrl;
}
