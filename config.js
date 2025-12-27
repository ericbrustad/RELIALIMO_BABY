import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Function to get environment variables safely
function getEnvVar(varName) {
  const w = typeof window !== 'undefined' ? window : undefined;
  const hasProcess = typeof process !== 'undefined' && process && process.env;
  
  return (w && w.ENV && w.ENV[varName])
      || (hasProcess && process.env[varName])
      || (hasProcess && process.env[`NEXT_PUBLIC_${varName}`])
      || (hasProcess && process.env[`VITE_${varName}`])
      || null;
}

// Function to get Supabase configuration
export function getSupabaseConfig() {
  const url = getEnvVar('SUPABASE_URL');
  const anonKey = getEnvVar('SUPABASE_ANON_KEY');
  
  if (!url || !anonKey) {
    // For development, check if we're on localhost and provide fallback
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      console.info('ℹ️  Using localhost fallback for Supabase configuration');
      return {
        url: 'https://siumiadylwcrkaqsfwkj.supabase.co',
        anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpdW1pYWR5bHdjcmthcXNmd2tqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2NjMzMTMsImV4cCI6MjA4MTIzOTMxM30.sSZBsXyOOmIp2eve_SpiUGeIwx3BMoxvY4c7bvE2kKw'
      };
    }
    console.error('❌ Missing Supabase environment variables and not on localhost. Ensure env.js is loaded before config.js');
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

// Get Supabase client (uses official Supabase JS SDK via ESM)
export function initSupabase() {
  if (typeof window === 'undefined') {
    // This check can remain for server-side rendering scenarios, though not currently used.
    console.warn('Supabase client initialization skipped: Not in a browser environment.');
    return null;
  }
  
  const config = getSupabaseConfig();
  const client = createClient(config.url, config.anonKey);
  console.log('✅ Supabase client initialized via ESM');
  
  // For backward compatibility with code that expects a global SupabaseDB object
  window.SupabaseDB = client;
  
  return client;
}
