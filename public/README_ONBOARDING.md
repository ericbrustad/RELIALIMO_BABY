# RELIALIMO Onboarding (Drop‑in)

This bundle implements the corrected onboarding flow:

1. Collect driver info (no DB write)
2. Select/create Affiliate → fetch its `organization_id`
3. Create Driver with `{ affiliate_id, organization_id }`
4. Add one-or-many `fleet_vehicles` (with permit/usdot/mndot)

## Files

- `driver-onboarding.html` – page (no external CSS to avoid MIME error)
- `driver-onboarding.js` – logic for steps 1–4
- `api-service.js` – Supabase PostgREST helpers

## Install

1. Copy all files into your project root (same folder as other HTML)
2. Start your local server
3. Open `/driver-onboarding.html`

## Env

Provide `window.ENV` before these scripts (e.g. via `env.js` you already use):

```html
<script>
window.ENV = {
  SUPABASE_URL: "https://YOUR-PROJECT.supabase.co",
  SUPABASE_ANON_KEY: "ey...",
  // Optional – if affiliates require organization_id on insert
  RELIALIMO_ORG_ID: "YOUR-ORG-UUID"
};
</script>
```

## RLS minimum (for public onboarding)

```sql
-- drivers: allow INSERT for signup
alter table public.drivers enable row level security;
create policy "allow public driver signup"
on public.drivers for insert to anon with check (true);

-- If drivers can create affiliates during onboarding
create policy "allow public affiliate create"
on public.affiliates for insert to anon with check (true);

-- If drivers can add vehicles during onboarding
create policy "allow public fleet_vehicles create"
on public.fleet_vehicles for insert to anon with check (true);
```

> You can later replace public inserts with a backend route that uses a service role.

## Notes

- `createAffiliate()` will include `organization_id` **if** `window.ENV.RELIALIMO_ORG_ID` is set.
- Driver creation happens **after** affiliate is known, and uses `affiliate.organization_id`.
- Vehicle inserts require `affiliate_id`; DOT/permit fields are optional.
