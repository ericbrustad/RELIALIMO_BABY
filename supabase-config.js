// Shared Supabase credential resolver
export function getSupabaseCredentials() {
  const url =
    (typeof process !== 'undefined' &&
      (process.env?.NEXT_PUBLIC_SUPABASE_URL || process.env?.SUPABASE_URL)) ||
    (typeof window !== 'undefined' && window.ENV?.SUPABASE_URL) ||
    (typeof import.meta !== 'undefined' && import.meta?.env?.VITE_SUPABASE_URL) ||
    'https://siumiadylwcrkaqsfwkj.supabase.co';

  const anonKey =
    (typeof process !== 'undefined' &&
      (process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env?.SUPABASE_ANON_KEY)) ||
    (typeof window !== 'undefined' && window.ENV?.SUPABASE_ANON_KEY) ||
    (typeof import.meta !== 'undefined' && import.meta?.env?.VITE_SUPABASE_ANON_KEY) ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpdW1pYWR5bHdjcmthcXNmd2tqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2NjMzMTMsImV4cCI6MjA4MTIzOTMxM30.sSZBsXyOOmIp2eve_SpiUGeIwx3BMoxvY4c7bvE2kKw';

  if (!url || !anonKey) {
    throw new Error('Supabase credentials are missing. Set URL and anon key environment variables.');
  }

  return { url, anonKey };
}
