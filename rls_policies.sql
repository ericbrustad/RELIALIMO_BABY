-- rls_policies.sql (optional helper)

-- drivers: insert allowed to anon (signup)
alter table public.drivers enable row level security;
do $$ begin
  create policy "allow public driver signup"
  on public.drivers for insert to anon with check (true);
exception when duplicate_object then null; end $$;

-- affiliates: optional insert (if drivers can create affiliates)
do $$ begin
  create policy "allow public affiliate create"
  on public.affiliates for insert to anon with check (true);
exception when duplicate_object then null; end $$;

-- fleet_vehicles: optional insert (if drivers add vehicles)
do $$ begin
  create policy "allow public fleet_vehicles create"
  on public.fleet_vehicles for insert to anon with check (true);
exception when duplicate_object then null; end $$;
