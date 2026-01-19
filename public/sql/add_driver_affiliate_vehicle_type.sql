-- Add driver-to-affiliate + driver-to-vehicle-type assignment fields
-- Run this in Supabase SQL editor (or as a migration)

alter table public.drivers
  add column if not exists affiliate_id uuid null,
  add column if not exists vehicle_type_id uuid null;

-- Foreign keys (optional but recommended)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'drivers_affiliate_id_fkey'
  ) then
    alter table public.drivers
      add constraint drivers_affiliate_id_fkey
      foreign key (affiliate_id) references public.affiliates(id)
      on delete set null;
  end if;
exception when undefined_table then
  -- affiliates table might not exist yet in some environments
  raise notice 'affiliates table not found; skipping drivers_affiliate_id_fkey';
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'drivers_vehicle_type_id_fkey'
  ) then
    alter table public.drivers
      add constraint drivers_vehicle_type_id_fkey
      foreign key (vehicle_type_id) references public.vehicle_types(id)
      on delete set null;
  end if;
exception when undefined_table then
  -- vehicle_types table might not exist yet in some environments
  raise notice 'vehicle_types table not found; skipping drivers_vehicle_type_id_fkey';
end $$;

create index if not exists drivers_affiliate_id_idx on public.drivers (affiliate_id);
create index if not exists drivers_vehicle_type_id_idx on public.drivers (vehicle_type_id);
