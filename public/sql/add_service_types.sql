-- ============================================================================
-- Service Types table (Reservation "Service Type" source of truth)
-- ============================================================================
-- Run this in Supabase SQL editor if you want service types stored/synced in
-- Supabase across users/devices.
--
-- The frontend automatically falls back to localStorage if this table does not
-- exist, so the app will still run without it.

create table if not exists public.service_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  code text not null,
  status text not null default 'ACTIVE', -- ACTIVE | INACTIVE
  billing_mode text, -- HOURLY | DISTANCE | PASSENGER | HYBRID (optional)
  sort_order integer not null default 0,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);

create unique index if not exists service_types_org_code_uq
  on public.service_types (organization_id, code);

alter table public.service_types enable row level security;

-- Policies assume you have `organization_members` table like the rest of this project.
-- Adjust if your org membership model differs.

drop policy if exists "service_types_select" on public.service_types;
create policy "service_types_select"
  on public.service_types
  for select
  to authenticated
  using (
    organization_id in (
      select organization_id from public.organization_members where user_id = auth.uid()
    )
  );

drop policy if exists "service_types_insert" on public.service_types;
create policy "service_types_insert"
  on public.service_types
  for insert
  to authenticated
  with check (
    organization_id in (
      select organization_id from public.organization_members where user_id = auth.uid()
    )
  );

drop policy if exists "service_types_update" on public.service_types;
create policy "service_types_update"
  on public.service_types
  for update
  to authenticated
  using (
    organization_id in (
      select organization_id from public.organization_members where user_id = auth.uid()
    )
  )
  with check (
    organization_id in (
      select organization_id from public.organization_members where user_id = auth.uid()
    )
  );

drop policy if exists "service_types_delete" on public.service_types;
create policy "service_types_delete"
  on public.service_types
  for delete
  to authenticated
  using (
    organization_id in (
      select organization_id from public.organization_members where user_id = auth.uid()
    )
  );
