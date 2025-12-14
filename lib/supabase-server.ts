import { createClient } from 'npm:@supabase/supabase-js@2';

const DEFAULT_SUPABASE_URL = 'https://siumiadylwcrkaqsfwkj.supabase.co';
const DEFAULT_SUPABASE_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpdW1pYWR5bHdjcmthcXNmd2tqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2NjMzMTMsImV4cCI6MjA4MTIzOTMxM30.sSZBsXyOOmIp2eve_SpiUGeIwx3BMoxvY4c7bvE2kKw';

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || DEFAULT_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error(
    'Supabase server configuration is missing. Ensure SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.'
  );
}

export const supabaseServer = () =>
  createClient(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false } });

/**
 * Fetch auth configuration via Edge Function using a service role Authorization header.
 * The Edge Function requires elevated privileges because it reads Supabase auth config.
 */
export async function fetchAuthConfig() {
  const response = await fetch(`${supabaseUrl}/functions/v1/auth-config`, {
    method: 'GET',
    headers: {
      apikey: supabaseServiceRoleKey,
      Authorization: `Bearer ${supabaseServiceRoleKey}`
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to load auth config (${response.status}): ${body}`);
  }

  return response.json();
}
