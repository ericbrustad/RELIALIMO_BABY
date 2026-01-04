-- ============================================================================
-- RELIA LIMO - Service Types schema (Supabase / Postgres)
-- Run this in your Supabase SQL editor (local or hosted).
--
-- This adds the backing table for:
--   Office → Company Settings → System Settings → Service Types
--
-- Notes:
-- - If you already created a service_types table, merge/adjust as needed.
-- - RLS policies below are conservative; if your app uses a service-role proxy,
--   you may choose to relax or manage policies differently.
-- ============================================================================

create table if not exists public.service_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,

  name text not null,
  code text not null,

  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE')),

  -- e.g. ['HOURS','DISTANCE','PASSENGER'] – used by UI today; can drive pricing logic later
  pricing_modes jsonb not null default '[]'::jsonb,

  custom_label text,
  agreement text,
  default_label text,
  sort_order integer not null default 0,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create unique index if not exists service_types_org_code_uq
  on public.service_types (organization_id, code);

alter table public.service_types enable row level security;

-- ---------------------------------------------------------------------------
-- RLS: allow org members to read; only admins/owners to write
-- ---------------------------------------------------------------------------

do $$
begin
  create policy "service_types_select" on public.service_types
    for select
    using (
      exists (
        select 1 from public.organization_members om
        where om.organization_id = service_types.organization_id
          and om.user_id = auth.uid()
      )
    );
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy "service_types_insert_admin" on public.service_types
    for insert
    with check (
      exists (
        select 1 from public.organization_members om
        where om.organization_id = service_types.organization_id
          and om.user_id = auth.uid()
          and om.role in ('owner','admin')
      )
    );
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy "service_types_update_admin" on public.service_types
    for update
    using (
      exists (
        select 1 from public.organization_members om
        where om.organization_id = service_types.organization_id
          and om.user_id = auth.uid()
          and om.role in ('owner','admin')
      )
    )
    with check (
      exists (
        select 1 from public.organization_members om
        where om.organization_id = service_types.organization_id
          and om.user_id = auth.uid()
          and om.role in ('owner','admin')
      )
    );
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy "service_types_delete_admin" on public.service_types
    for delete
    using (
      exists (
        select 1 from public.organization_members om
        where om.organization_id = service_types.organization_id
          and om.user_id = auth.uid()
          and om.role in ('owner','admin')
      )
    );
exception when duplicate_object then null;
end $$;
