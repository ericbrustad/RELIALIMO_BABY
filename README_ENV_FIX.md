# Onboarding env fix

Add `env.js` and include it BEFORE the module scripts so API calls go to Supabase
(instead of falling back to `/rest/v1` on your local server).

Order:
  <script src="./env.js"></script>
  <script type="module" src="./driver-onboarding.js"></script>

Update env.js with your SUPABASE_URL and SUPABASE_ANON_KEY.

If you still get RLS errors on affiliates or fleet_vehicles, add insert policies or proxy through a backend.
