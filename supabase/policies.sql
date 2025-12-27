-- Enable Row Level Security for all tables if not already enabled
alter table public.organization_settings enable row level security;
alter table public.reservations enable row level security;
-- Add other tables here as needed, e.g.:
-- alter table public.accounts enable row level security;
-- alter table public.drivers enable row level security;

-- Clear existing policies to prevent conflicts
drop policy if exists org_settings_select on public.organization_settings;
drop policy if exists org_settings_insert on public.organization_settings;
drop policy if exists org_settings_update on public.organization_settings;
drop policy if exists reservations_select on public.reservations;
drop policy if exists reservations_insert on public.reservations;
drop policy if exists reservations_update on public.reservations;

-- RLS Policies for organization_settings
-- Policy: Authenticated users can read settings for organizations they are a member of.
create policy "org_settings_select"
  on public.organization_settings
  for select
  to authenticated
  using (
    organization_id in (
      select organization_id
      from public.organization_members
      where user_id = (select auth.uid())
    )
  );

-- Policy: Authenticated users can insert settings for organizations they are a member of.
create policy "org_settings_insert"
  on public.organization_settings
  for insert
  to authenticated
  with check (
    organization_id in (
      select organization_id
      from public.organization_members
      where user_id = (select auth.uid())
    )
  );

-- Policy: Authenticated users can update settings for organizations they are a member of.
create policy "org_settings_update"
  on public.organization_settings
  for update
  to authenticated
  using (
    organization_id in (
      select organization_id
      from public.organization_members
      where user_id = (select auth.uid())
    )
  )
  with check (
    organization_id in (
      select organization_id
      from public.organization_members
      where user_id = (select auth.uid())
    )
  );

-- RLS Policies for reservations
-- Policy: Authenticated users can view reservations for organizations they are a member of.
create policy "reservations_select"
  on public.reservations
  for select
  to authenticated
  using (
    organization_id in (
      select organization_id from public.organization_members
      where user_id = (select auth.uid())
    )
  );

-- Policy: Authenticated users can insert reservations for organizations they are a member of.
create policy "reservations_insert"
  on public.reservations
  for insert
  to authenticated
  with check (
    organization_id in (
      select organization_id from public.organization_members
      where user_id = (select auth.uid())
    )
  );

-- Policy: Authenticated users can update reservations for organizations they are a member of.
create policy "reservations_update"
  on public.reservations
  for update
  to authenticated
  using (
    organization_id in (
      select organization_id from public.organization_members
      where user_id = (select auth.uid())
    )
  )
  with check (
    organization_id in (
      select organization_id from public.organization_members
      where user_id = (select auth.uid())
    )
  );

-- Note: Repeat the pattern above for other tables like accounts, drivers, etc.
