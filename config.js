// Function to get environment variables safely
function getEnvVar(varName) {
  // Check multiple possible locations for environment variables
  return window.ENV?.[varName] || 
         process?.env?.[varName] || 
         process?.env?.[`NEXT_PUBLIC_${varName}`] ||
         process?.env?.[`VITE_${varName}`];
}

// Function to get Supabase configuration
export function getSupabaseConfig() {
  const url = getEnvVar('SUPABASE_URL');
  const anonKey = getEnvVar('SUPABASE_ANON_KEY');
  
  if (!url || !anonKey) {
    console.error('❌ Missing Supabase environment variables. Make sure env.js is loaded before config.js');
    // For development, check if we're on localhost and provide fallback
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      console.warn('🔧 Running in localhost development mode');
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
