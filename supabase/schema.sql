-- Create the organization_settings table
create table if not exists public.organization_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  settings jsonb not null default '{}'::jsonb,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Add a helpful index for querying by organization
create index if not exists idx_org_settings_org on public.organization_settings(organization_id);

-- Create a sequence for generating unique confirmation numbers
create sequence if not exists confirmation_seq;

-- Create a function to get the next confirmation number, padded with zeros
create or replace function next_confirmation_number()
returns text
language sql
stable
as $$
  select lpad((nextval('confirmation_seq'))::text, 8, '0');
$$;

-- Set the default value for the confirmation_number column in the reservations table
-- This will automatically assign a new number on insert
alter table public.reservations
  alter column confirmation_number set default next_confirmation_number();

-- Add a unique constraint to ensure confirmation numbers are never duplicated
create unique index if not exists uq_reservations_confirmation on public.reservations(confirmation_number);

-- Add an index for organization_id on the reservations table for performance
create index if not exists idx_reservations_org on public.reservations(organization_id);

-- Create the organization_members table if it doesn't exist (required for policies)
create table if not exists public.organization_members (
    organization_id uuid not null,
    user_id uuid not null,
    primary key (organization_id, user_id)
);

-- Add an index for performance on policy checks
create index if not exists idx_org_members_user_org on public.organization_members(user_id, organization_id);
