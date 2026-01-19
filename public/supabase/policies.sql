-- Policies / Agreements table for Supabase
-- Used by:
--  - Office -> Company Settings -> Policies
--  - Service Types -> Agreement dropdown
--
-- NOTE: RLS policies should be added to match your existing auth model.
-- If you run locally without RLS, you can still use localStorage fallback.

create table if not exists public.policies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid null,
  name text not null,
  type text not null default 'rental', -- rental | privacy | terms | waiver | custom
  html text not null default '',
  active boolean not null default true,
  status text not null default 'active',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists policies_org_idx on public.policies (organization_id);
create index if not exists policies_active_idx on public.policies (active);
