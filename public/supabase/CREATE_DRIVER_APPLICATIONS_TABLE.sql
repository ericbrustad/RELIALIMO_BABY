-- CREATE_DRIVER_APPLICATIONS_TABLE.sql - idempotent creation of public.driver_applications and safe RLS
BEGIN;

-- Applications table for drivers when signups are disabled or manual review is required
CREATE TABLE IF NOT EXISTS public.driver_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  first_name text,
  last_name text,
  phone text,
  affiliate_id uuid REFERENCES public.affiliates (id),
  vehicle jsonb,
  metadata jsonb,
  status text DEFAULT 'submitted', -- submitted | reviewed | approved | rejected
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS driver_applications_email_idx ON public.driver_applications (email);

-- Enable RLS and allow anonymous INSERTs only (no public SELECT/UPDATE/DELETE)
ALTER TABLE public.driver_applications ENABLE ROW LEVEL SECURITY;

-- Allow anon inserts (so the public onboarding form can submit applications)
DROP POLICY IF EXISTS insert_applications_for_anon ON public.driver_applications;
CREATE POLICY insert_applications_for_anon ON public.driver_applications
  FOR INSERT TO anon WITH CHECK (true);

-- Disallow public SELECT/UPDATE/DELETE; allow admin roles to SELECT/UPDATE
DROP POLICY IF EXISTS select_applications_for_admins ON public.driver_applications;
CREATE POLICY select_applications_for_admins ON public.driver_applications
  FOR SELECT TO authenticated USING (is_user_in_roles(auth.uid(), ARRAY['admin','dispatch','superadmin']));

DROP POLICY IF EXISTS update_applications_for_admins ON public.driver_applications;
CREATE POLICY update_applications_for_admins ON public.driver_applications
  FOR UPDATE TO authenticated USING (is_user_in_roles(auth.uid(), ARRAY['admin','dispatch','superadmin']))
  WITH CHECK (is_user_in_roles(auth.uid(), ARRAY['admin','dispatch','superadmin']));

COMMIT;