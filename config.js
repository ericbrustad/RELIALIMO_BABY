// Function to get environment variables safely (works in browser without process)
function getEnvVar(varName) {
  const env = (typeof window !== 'undefined' && window.ENV) ? window.ENV : {};
  const procEnv = (typeof process !== 'undefined' && process.env) ? process.env : {};
  return env[varName] || procEnv[varName] || procEnv[`NEXT_PUBLIC_${varName}`] || procEnv[`VITE_${varName}`];
}

// Function to get Supabase configuration
export function getSupabaseConfig() {
  const url = getEnvVar('SUPABASE_URL');
  const anonKey = getEnvVar('SUPABASE_ANON_KEY');

  const isFileProtocol = typeof window !== 'undefined' && window.location && window.location.protocol === 'file:';
  const hostname = (typeof window !== 'undefined' && window.location && window.location.hostname) ? window.location.hostname : '';
  const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '' || isFileProtocol;
  const forceDb = (typeof window !== 'undefined' && window.ENV && window.ENV.FORCE_DATABASE_ON_LOCALHOST) === true;

  if (!url || !anonKey) {
    console.error('❌ Missing Supabase environment variables. Make sure env.js is loaded before config.js');

    // For development, allow a manual override via FORCE_DATABASE_ON_LOCALHOST or when running from file://
    if (isLocalHost || forceDb) {
      console.warn('🔧 Running in development mode (localhost/file:// or FORCE_DATABASE_ON_LOCALHOST) - using fallback Supabase creds');
      return {
        url: 'https://siumiadylwcrkaqsfwkj.supabase.co',
        anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpdW1pYWR5bHdjcmthcXNmd2tqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2NjMzMTMsImV4cCI6MjA4MTIzOTMxM30.sSZBsXyOOmIp2eve_SpiUGeIwx3BMoxvY4c7bvE2kKw'
      };
    }

    throw new Error('Supabase configuration is missing');
  }

  return { url, anonKey };
}

// Legacy exports for backward compatibility (will be evaluated lazily)
export function getSupabaseUrl() {
  return getSupabaseConfig().url;
}

export function getSupabaseAnonKey() {
  return getSupabaseConfig().anonKey;
}

// Deprecated: Use getSupabaseConfig() instead
export const supabaseConfig = {
  get url() { return getSupabaseConfig().url; },
  get anonKey() { return getSupabaseConfig().anonKey; }
};

// Get Supabase client (uses REST API - no SDK import needed)
export async function initSupabase() {
  // Import the supabase-client module which uses REST API
  const { default: supabase } = await import('./supabase-client.js');
  return supabase;
}
