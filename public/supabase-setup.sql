-- ===================================
-- SUPABASE DATABASE SETUP & SECURITY
-- ===================================

-- 1. CREATE INDEXES FOR RLS PERFORMANCE
-- ===================================

create index if not exists idx_res_assignments_res_driver
  on public.reservation_assignments(reservation_id, assigned_driver_user_id);

create index if not exists idx_reservations_booked_by
  on public.reservations(booked_by_user_id);

create index if not exists idx_reservations_org_id
  on public.reservations(organization_id);

create index if not exists idx_vehicle_types_org_id
  on public.vehicle_types(organization_id);

create index if not exists idx_reservation_events_reservation_id
  on public.reservation_events(reservation_id);

-- 2. ENFORCE EMAIL LOWERCASE CONSISTENCY
-- ===================================

alter table public.accounts
  add constraint chk_accounts_email_lowercase
  check (email is null or email = lower(email));

alter table public.account_emails
  add constraint chk_account_emails_lowercase
  check (email = lower(email));

-- 3. CONFIRMATION NUMBER GENERATION
-- ===================================

create sequence if not exists reservation_conf_seq;

create or replace function public.tg_reservations_set_conf()
returns trigger language plpgsql as $$
begin
  if new.confirmation_number is null or length(trim(new.confirmation_number)) = 0 then
    new.confirmation_number := 'R' || lpad(nextval('reservation_conf_seq')::text, 7, '0');
  end if;
  return new;
end $$;

drop trigger if exists set_conf_reservations on public.reservations;
create trigger set_conf_reservations
before insert on public.reservations
for each row execute function public.tg_reservations_set_conf();

-- 4. AUDIT FIELDS (created_by / updated_by) AUTO-POPULATION
-- ===================================

create or replace function public.tg_set_audit_user()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if new.created_by is null then new.created_by := (select auth.uid()); end if;
    new.updated_by := (select auth.uid());
  else
    new.updated_by := (select auth.uid());
  end if;
  return new;
end $$;

-- Attach to key tables
drop trigger if exists set_audit_user_orgs on public.organizations;
create trigger set_audit_user_orgs
before insert or update on public.organizations
for each row execute function public.tg_set_audit_user();

drop trigger if exists set_audit_user_accounts on public.accounts;
create trigger set_audit_user_accounts
before insert or update on public.accounts
for each row execute function public.tg_set_audit_user();

drop trigger if exists set_audit_user_reservations on public.reservations;
create trigger set_audit_user_reservations
before insert or update on public.reservations
for each row execute function public.tg_set_audit_user();

drop trigger if exists set_audit_user_res_events on public.reservation_events;
create trigger set_audit_user_res_events
before insert or update on public.reservation_events
for each row execute function public.tg_set_audit_user();

-- 5. GRANT EXECUTE ON HELPER FUNCTIONS
-- ===================================

grant execute on function public.get_user_role_in_org(uuid) to authenticated;
grant execute on function public.tg_set_audit_user() to authenticated;
grant execute on function public.tg_reservations_set_conf() to authenticated;

-- Vehicle Types policies
drop policy if exists "vehicle_types_select" on public.vehicle_types;
create policy "vehicle_types_select"
on public.vehicle_types for select to authenticated
using (organization_id in (select organization_id from public.organization_members where user_id = auth.uid()));

drop policy if exists "vehicle_types_insert" on public.vehicle_types;
create policy "vehicle_types_insert"
on public.vehicle_types for insert to authenticated
with check (organization_id in (select organization_id from public.organization_members where user_id = auth.uid()));

drop policy if exists "vehicle_types_update" on public.vehicle_types;
create policy "vehicle_types_update"
on public.vehicle_types for update to authenticated
using (organization_id in (select organization_id from public.organization_members where user_id = auth.uid()))
with check (organization_id in (select organization_id from public.organization_members where user_id = auth.uid()));

drop policy if exists "vehicle_types_delete" on public.vehicle_types;
create policy "vehicle_types_delete"
on public.vehicle_types for delete to authenticated
using (organization_id in (select organization_id from public.organization_members where user_id = auth.uid()));

-- 6. RESERVATION EVENTS INSERT POLICY (Allow drivers/customers to add notes)
-- ===================================

drop policy if exists "res_events_insert_permitted_roles" on public.reservation_events;
create policy "res_events_insert_permitted_roles"
on public.reservation_events
for insert to authenticated
with check (
  public.get_user_role_in_org(organization_id) in ('admin','dispatcher')
  or exists (
    select 1 from public.reservations r
    where r.id = reservation_events.reservation_id
      and r.organization_id = reservation_events.organization_id
      and (
        r.booked_by_user_id = (select auth.uid())
        or exists (
          select 1 from public.reservation_assignments ra
          where ra.reservation_id = r.id
            and ra.assigned_driver_user_id = (select auth.uid())
        )
      )
  )
);

-- 7. VERIFY INDEXES CREATED
-- ===================================

select 
  schemaname,
  tablename,
  indexname,
  indexdef
from pg_indexes
where tablename in ('reservation_assignments', 'reservations', 'reservation_events')
order by tablename, indexname;
