-- ===================================
-- RELIA🐂LIMO™ DATABASE SCHEMA
-- Run this FIRST before supabase-setup.sql
-- ===================================

-- Drop everything first for clean slate
drop table if exists public.reservation_events cascade;
drop table if exists public.reservation_assignments cascade;
drop table if exists public.reservation_route_stops cascade;
drop table if exists public.reservations cascade;
drop table if exists public.vehicles cascade;
drop table if exists public.drivers cascade;
drop table if exists public.booking_agents cascade;
drop table if exists public.passengers cascade;
drop table if exists public.account_booking_contacts cascade;
drop table if exists public.account_emails cascade;
drop table if exists public.account_addresses cascade;
drop table if exists public.accounts cascade;
drop table if exists public.organization_members cascade;
drop table if exists public.organizations cascade;
drop function if exists public.get_user_role_in_org(uuid);

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ===================================
-- 1. ORGANIZATIONS TABLE
-- ===================================

create table if not exists public.organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  phone text,
  email text,
  address text,
  city text,
  state text,
  postal_code text,
  country text,
  website text,
  timezone text default 'America/Chicago',
  currency text default 'USD',
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.organizations enable row level security;

-- ===================================
-- 2. ORGANIZATION MEMBERS TABLE
-- ===================================

create table if not exists public.organization_members (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'dispatcher', 'driver', 'member')),
  created_at timestamp with time zone default now(),
  unique(organization_id, user_id)
);

alter table public.organization_members enable row level security;

-- ===================================
-- 3. ACCOUNTS TABLE (Customers)
-- ===================================

create table if not exists public.accounts (
  id uuid primary key default uuid_generate_v4(),
  account_number text unique,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  
  -- Account Info
  prefix text,
  first_name text,
  last_name text,
  company_name text,
  email text not null,
  phone text,
  cell_phone text,
  fax text,
  employee_id text,
  vip_number text,
  
  -- Contact preferences
  contact_method text,
  status text default 'active' check (status in ('active', 'inactive', 'archived')),
  
  -- Financial Settings
  post_method text,
  post_terms text,
  primary_agent_assigned text,
  secondary_agent_assigned text,
  
  -- Payment Information
  credit_card_number text,
  name_on_card text,
  billing_address text,
  billing_city text,
  billing_state text,
  billing_zip text,
  billing_address_line2 text,
  billing_country text,
  exp_month text,
  exp_year text,
  cc_type text,
  cvv text,
  credit_card_notes text,
  
  -- Metadata
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique(organization_id, email)
);

alter table public.accounts enable row level security;

-- ===================================
-- 4. ACCOUNT ADDRESSES TABLE (Stored addresses for accounts)
-- ===================================

create table if not exists public.account_addresses (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  address_type text check (address_type in ('primary', 'pickup', 'dropoff', 'waypoint', 'billing', 'home', 'other')),
  address_name text,
  address_line1 text not null,
  address_line2 text,
  city text,
  state text,
  zip_code text,
  country text default 'United States',
  latitude numeric,
  longitude numeric,
  use_count integer default 1,
  last_used_at timestamp with time zone default now(),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.account_addresses enable row level security;

create index idx_account_addresses_account_id on public.account_addresses(account_id);
create index idx_account_addresses_address_type on public.account_addresses(address_type);

-- ===================================
-- 5. ACCOUNT EMAILS TABLE (Alternative contacts)
-- ===================================

create table if not exists public.account_emails (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  email_type text default 'alternate',
  created_at timestamp with time zone default now(),
  unique(account_id, email)
);

alter table public.account_emails enable row level security;

-- ===================================
-- 6. ACCOUNT BOOKING CONTACTS TABLE
-- ===================================

create table if not exists public.account_booking_contacts (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contact_name text not null,
  contact_info text,
  created_at timestamp with time zone default now()
);

alter table public.account_booking_contacts enable row level security;

-- ===================================
-- 6A. PASSENGERS TABLE
-- ===================================

create table if not exists public.passengers (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  phone text,
  email text,
  alt_contact_name text,
  alt_contact_phone text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.passengers enable row level security;

create index idx_passengers_name on public.passengers(first_name, last_name);
create index idx_passengers_email on public.passengers(email);

-- ===================================
-- 6B. BOOKING AGENTS TABLE
-- ===================================

create table if not exists public.booking_agents (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  phone text,
  email text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.booking_agents enable row level security;

create index idx_booking_agents_name on public.booking_agents(first_name, last_name);
create index idx_booking_agents_email on public.booking_agents(email);

-- ===================================
-- 7. DRIVERS TABLE
-- ===================================

create table if not exists public.drivers (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  first_name text not null,
  last_name text not null,
  email text,
  cell_phone text,
  home_phone text,
  primary_address text,
  city text,
  state text,
  address_zip text,
  postal_code text,
  license_number text,
  license_state text,
  license_exp_date date,
  tlc_license text,
  ssn text,
  dob date,
  badge_id text,
  hire_date date,
  termination_date date,
  driver_level text default '0',
  status text default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  type text default 'FULL TIME' check (type in ('FULL TIME', 'PART TIME')),
  web_access text default 'DENY' check (web_access in ('ALLOW', 'DENY')),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique(organization_id, email),
  unique(organization_id, license_number)
);

alter table public.drivers enable row level security;


-- Vehicle Types (lookup used by vehicles/reservations)
create table if not exists public.vehicle_types (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  code text,
  status text default 'ACTIVE' check (status in ('ACTIVE','INACTIVE')),
  pricing_basis text default 'HOURS',
  passenger_capacity integer,
  luggage_capacity integer,
  color_hex text,
  service_type_tags jsonb default '[]'::jsonb,
  accessible boolean default false,
  hide_from_online boolean default false,
  description text,
  sort_order integer default 0,
  metadata jsonb default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique(organization_id, name)
);

alter table public.vehicle_types enable row level security;


create table if not exists public.vehicles (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  make text,
  model text,
  year integer,
  color text,
  license_plate text unique,
  vin text unique,
  vehicle_type text,
  capacity integer default 1,
  status text default 'AVAILABLE' check (status in ('AVAILABLE', 'IN_USE', 'MAINTENANCE', 'RETIRED')),
  mileage integer default 0,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.vehicles enable row level security;

-- ===================================
-- 9. RESERVATIONS TABLE
-- ===================================

create table if not exists public.reservations (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  confirmation_number text unique not null,
  account_id uuid references public.accounts(id) on delete set null,
  booked_by_user_id uuid not null references auth.users(id) on delete restrict,
  status text default 'pending' check (status in ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled')),
  trip_type text,
  pickup_address text,
  pickup_city text,
  pickup_state text,
  pickup_zip text,
  pickup_lat numeric,
  pickup_lon numeric,
  pickup_datetime timestamp with time zone,
  dropoff_address text,
  dropoff_city text,
  dropoff_state text,
  dropoff_zip text,
  dropoff_lat numeric,
  dropoff_lon numeric,
  dropoff_datetime timestamp with time zone,
  passenger_count integer default 1,
  special_instructions text,
  rate_type text,
  rate_amount numeric(10, 2),
  currency text default 'USD',
  timezone text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.reservations enable row level security;

-- ===================================
-- 10. RESERVATION ROUTE STOPS TABLE
-- ===================================

create table if not exists public.reservation_route_stops (
  id uuid primary key default uuid_generate_v4(),
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  kind text not null check (kind in ('pickup', 'dropoff', 'waypoint')),
  sort_order integer not null,
  address text,
  city text,
  state text,
  zip_code text,
  latitude numeric,
  longitude numeric,
  datetime timestamp with time zone,
  notes text,
  created_at timestamp with time zone default now()
);

alter table public.reservation_route_stops enable row level security;

-- ===================================
-- 11. RESERVATION ASSIGNMENTS TABLE
-- ===================================

create table if not exists public.reservation_assignments (
  id uuid primary key default uuid_generate_v4(),
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  assigned_driver_user_id uuid not null references auth.users(id) on delete restrict,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  status text default 'assigned' check (status in ('assigned', 'accepted', 'in_progress', 'completed', 'cancelled')),
  assigned_at timestamp with time zone default now(),
  accepted_at timestamp with time zone,
  completed_at timestamp with time zone,
  notes text,
  created_at timestamp with time zone default now(),
  unique(reservation_id, assigned_driver_user_id)
);

alter table public.reservation_assignments enable row level security;

-- ===================================
-- 12. RESERVATION EVENTS TABLE
-- ===================================

create table if not exists public.reservation_events (
  id uuid primary key default uuid_generate_v4(),
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_type text,
  title text,
  description text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.reservation_events enable row level security;

-- ===================================
-- CREATE HELPER FUNCTION
-- ===================================

create or replace function public.get_user_role_in_org(org_id uuid)
returns text as $$
  select role from public.organization_members
  where organization_id = org_id
    and user_id = auth.uid()
  limit 1;
$$ language sql;

grant execute on function public.get_user_role_in_org(uuid) to authenticated;

-- ===================================
-- BASIC RLS POLICIES
-- ===================================

-- Organizations: users see only their orgs
create policy "orgs_user_can_see_own"
on public.organizations for select to authenticated
using (id in (
  select organization_id from public.organization_members
  where user_id = auth.uid()
));

-- Organization Members: visible within org
create policy "org_members_visible_in_org"
on public.organization_members for select to authenticated
using (organization_id in (
  select organization_id from public.organization_members
  where user_id = auth.uid()
));

-- Accounts: visible if user is in org
create policy "accounts_visible_in_org"
on public.accounts for select to authenticated
using (organization_id in (
  select organization_id from public.organization_members
  where user_id = auth.uid()
));

-- Accounts: allow insert if user is in org
create policy "accounts_insert_in_org"
on public.accounts for insert to authenticated
with check (organization_id in (
  select organization_id from public.organization_members
  where user_id = auth.uid()
));

-- Accounts: allow update if user is in org
create policy "accounts_update_in_org"
on public.accounts for update to authenticated
using (organization_id in (
  select organization_id from public.organization_members
  where user_id = auth.uid()
));

-- Account Addresses: visible if user is in org
create policy "account_addresses_visible_in_org"
on public.account_addresses for select to authenticated
using (organization_id in (
  select organization_id from public.organization_members
  where user_id = auth.uid()
));

-- Account Emails: visible if user is in org
create policy "account_emails_visible_in_org"
on public.account_emails for select to authenticated
using (organization_id in (
  select organization_id from public.organization_members
  where user_id = auth.uid()
));

-- Account Booking Contacts: visible if user is in org
create policy "account_booking_contacts_visible_in_org"
on public.account_booking_contacts for select to authenticated
using (organization_id in (
  select organization_id from public.organization_members
  where user_id = auth.uid()
));

-- Passengers: visible if user is in org
create policy "passengers_visible_in_org"
on public.passengers for select to authenticated
using (organization_id in (
  select organization_id from public.organization_members
  where user_id = auth.uid()
));

-- Passengers: allow insert if user is in org
create policy "passengers_insert_in_org"
on public.passengers for insert to authenticated
with check (organization_id in (
  select organization_id from public.organization_members
  where user_id = auth.uid()
));

-- Passengers: allow update if user is in org
create policy "passengers_update_in_org"
on public.passengers for update to authenticated
using (organization_id in (
  select organization_id from public.organization_members
  where user_id = auth.uid()
));

-- Booking Agents: visible if user is in org
create policy "booking_agents_visible_in_org"
on public.booking_agents for select to authenticated
using (organization_id in (
  select organization_id from public.organization_members
  where user_id = auth.uid()
));

-- Booking Agents: allow insert if user is in org
create policy "booking_agents_insert_in_org"
on public.booking_agents for insert to authenticated
with check (organization_id in (
  select organization_id from public.organization_members
  where user_id = auth.uid()
));

-- Booking Agents: allow update if user is in org
create policy "booking_agents_update_in_org"
on public.booking_agents for update to authenticated
using (organization_id in (
  select organization_id from public.organization_members
  where user_id = auth.uid()
));

-- Drivers: visible if user is in org
create policy "drivers_visible_in_org"
on public.drivers for select to authenticated
using (organization_id in (
  select organization_id from public.organization_members
  where user_id = auth.uid()
));

-- Vehicles: visible if user is in org
create policy "vehicles_visible_in_org"
on public.vehicles for select to authenticated
using (organization_id in (
  select organization_id from public.organization_members
  where user_id = auth.uid()
));

-- Reservations: visible if user is in org or involved
create policy "reservations_visible_in_org"
on public.reservations for select to authenticated
using (
  organization_id in (
    select organization_id from public.organization_members
    where user_id = auth.uid()
  )
  or booked_by_user_id = auth.uid()
  or id in (
    select reservation_id from public.reservation_assignments
    where assigned_driver_user_id = auth.uid()
  )
);

-- Reservation Route Stops: visible with reservation
create policy "route_stops_visible_in_org"
on public.reservation_route_stops for select to authenticated
using (
  organization_id in (
    select organization_id from public.organization_members
    where user_id = auth.uid()
  )
  or reservation_id in (
    select id from public.reservations
    where booked_by_user_id = auth.uid()
  )
);

-- Reservation Assignments: visible if involved
create policy "assignments_visible_in_org"
on public.reservation_assignments for select to authenticated
using (
  organization_id in (
    select organization_id from public.organization_members
    where user_id = auth.uid()
  )
  or assigned_driver_user_id = auth.uid()
);

-- Reservation Events: visible with reservation
create policy "events_visible_in_org"
on public.reservation_events for select to authenticated
using (
  organization_id in (
    select organization_id from public.organization_members
    where user_id = auth.uid()
  )
  or reservation_id in (
    select id from public.reservations
    where booked_by_user_id = auth.uid()
  )
);

-- ===================================
-- COMMENTS FOR DOCUMENTATION
-- ===================================

comment on table public.organizations is 'Main organization/company records';
comment on table public.organization_members is 'Users and their roles within organizations';
comment on table public.accounts is 'Customer accounts';
comment on table public.drivers is 'Driver profiles and credentials';
comment on table public.vehicles is 'Vehicle inventory';
comment on table public.reservations is 'Trip reservations';
comment on table public.reservation_route_stops is 'Pickup, dropoff, and waypoint stops for trips';
comment on table public.reservation_assignments is 'Driver assignments to reservations';
comment on table public.reservation_events is 'Activity log and notes for reservations';

-- ===================================
-- SCHEMA COMPLETE
-- ===================================

select 'Schema created successfully! Now run supabase-setup.sql to add indexes and triggers.' as status;
