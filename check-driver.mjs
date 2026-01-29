import { createClient } from '@supabase/supabase-js';

// Use ANON key to simulate what the app would do
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpdW1pYWR5bHdjcmthcXNmd2tqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2NjMzMTMsImV4cCI6MjA4MTIzOTMxM30.sSZBsXyOOmIp2eve_SpiUGeIwx3BMoxvY4c7bvE2kKw';

const supabase = createClient(
  'https://siumiadylwcrkaqsfwkj.supabase.co',
  ANON_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
  const email = 'eric@erixmn.com';
  const password = 'Newhouse2025!';
  
  // Sign in like the app does
  console.log('Signing in as', email);
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  
  if (authError) {
    console.log('Auth error:', authError.message);
    return;
  }
  console.log('Auth success! User ID:', authData.user.id);
  
  // Fetch driver like the app does
  const { data: driver, error: driverErr } = await supabase
    .from('drivers')
    .select('*')
    .ilike('email', email)
    .maybeSingle();
  
  if (driverErr) {
    console.log('Driver fetch error:', driverErr);
    return;
  }
  console.log('Driver found:', driver?.id, driver?.first_name, driver?.last_name);
  
  // Fetch trips like the app does
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  console.log('\nFetching trips for driver:', driver.id);
  console.log('From date:', today.toISOString());
  
  const { data: trips, error: tripsErr } = await supabase
    .from('reservations')
    .select('*')
    .eq('assigned_driver_id', driver.id)
    .gte('pickup_datetime', today.toISOString())
    .order('pickup_datetime', { ascending: true })
    .limit(50);
  
  if (tripsErr) {
    console.log('Trips error:', tripsErr);
  } else {
    console.log('Trips found:', trips?.length || 0);
    if (trips && trips.length > 0) {
      trips.forEach(t => console.log(' -', t.id.substring(0,8), t.pickup_datetime, t.status));
    }
  }
}

main().catch(console.error);

main().catch(console.error);
