// Shared Supabase credential resolver
// Credentials are resolved lazily to ensure window.ENV is loaded first

let cachedUrl = null;
let cachedAnonKey = null;

function resolveSupabaseUrl() {
  // Check window.ENV first (loaded by env.js)
  if (typeof window !== 'undefined' && window.ENV?.SUPABASE_URL) {
    return window.ENV.SUPABASE_URL;
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

function resolveSupabaseAnonKey() {
  // Check window.ENV first (loaded by env.js)
  if (typeof window !== 'undefined' && window.ENV?.SUPABASE_ANON_KEY) {
    return window.ENV.SUPABASE_ANON_KEY;
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

  if (!url || !anonKey) {
    const missing = [];
    if (!url) missing.push('SUPABASE_URL (NEXT_PUBLIC_SUPABASE_URL | SUPABASE_URL | window.ENV | VITE_SUPABASE_URL)');
    if (!anonKey)
      missing.push('SUPABASE_ANON_KEY (NEXT_PUBLIC_SUPABASE_ANON_KEY | SUPABASE_ANON_KEY | window.ENV | VITE_SUPABASE_ANON_KEY)');

    throw new Error(
      `Supabase credentials are missing: ${missing.join(
        '; '
      )}. Set your public Supabase URL and anon key environment variables.`
    );
  }

  // Cache for subsequent calls
  cachedUrl = url;
  cachedAnonKey = anonKey;

  return { url, anonKey };
}
