-- Supabase schema updates for RELIALIMO Accounts persistence
-- Safe to run multiple times (uses ADD COLUMN IF NOT EXISTS).
-- Review in Supabase SQL Editor before executing.

-- Optional: inspect current columns
-- select column_name, data_type
-- from information_schema.columns
-- where table_schema='public' and table_name='accounts'
-- order by ordinal_position;

alter table public.accounts
  add column if not exists department text,
  add column if not exists job_title text,
  add column if not exists primary_address1 text,
  add column if not exists primary_address2 text,
  add column if not exists primary_city text,
  add column if not exists primary_state text,
  add column if not exists primary_zip text,
  add column if not exists primary_country text,
  add column if not exists billing_address2 text,
  add column if not exists billing_country text,
  add column if not exists credit_card_notes text,
  add column if not exists account_types jsonb,
  add column if not exists account_emails jsonb,
  add column if not exists account_notes jsonb,
  add column if not exists stored_addresses jsonb,
  add column if not exists financial_settings jsonb,
  add column if not exists payment_profile jsonb;

-- Helpful indexes (optional)
create index if not exists accounts_org_account_number_idx
  on public.accounts(organization_id, account_number);

create index if not exists accounts_org_email_idx
  on public.accounts(organization_id, email);
