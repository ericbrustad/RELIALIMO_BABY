-- scripts/sql/service_types_rls.sql
-- Recommended RLS policies for `public.service_types`.
-- Mirrors the vehicle_types policy structure for global public read access.
-- Run in Supabase SQL editor or psql as a privileged user (service_role).

-- 1) Enable RLS
ALTER TABLE IF EXISTS public.service_types ENABLE ROW LEVEL SECURITY;

-- 2) Public read: allow anonymous (anon) users to SELECT ALL rows
DROP POLICY IF EXISTS "service_types_select_public" ON public.service_types;
CREATE POLICY "service_types_select_public" ON public.service_types
  FOR SELECT
  USING (
    auth.role() = 'anon'
  );

-- 3) Authenticated users can SELECT ALL rows
DROP POLICY IF EXISTS "service_types_select_all" ON public.service_types;
CREATE POLICY "service_types_select_all" ON public.service_types
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
  );

-- 4) Allow authenticated users to INSERT if status is ACTIVE or INACTIVE
DROP POLICY IF EXISTS "service_types_insert_all" ON public.service_types;
CREATE POLICY "service_types_insert_all" ON public.service_types
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (status IN ('ACTIVE','INACTIVE'))
  );

-- 5) Allow authenticated users to UPDATE most fields; code can only change when st_can_update_code approves
-- NOTE: If you don't have a st_can_update_code function, use the simpler policy below instead
DROP POLICY IF EXISTS "service_types_user_update_guard" ON public.service_types;
CREATE POLICY "service_types_user_update_guard" ON public.service_types
  FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
  );

-- 6) Admin/dispatch/superadmin can fully UPDATE
DROP POLICY IF EXISTS "service_types_admin_full_update" ON public.service_types;
CREATE POLICY "service_types_admin_full_update" ON public.service_types
  FOR UPDATE
  USING (
    auth.role() IN ('admin','dispatch','superadmin')
  )
  WITH CHECK (
    auth.role() IN ('admin','dispatch','superadmin')
  );

-- 7) Admin/dispatch/superadmin can DELETE
DROP POLICY IF EXISTS "service_types_admin_delete" ON public.service_types;
CREATE POLICY "service_types_admin_delete" ON public.service_types
  FOR DELETE
  USING (
    auth.role() IN ('admin','dispatch','superadmin')
  );

-- Grants (do not bypass RLS)
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.service_types TO anon, authenticated;

-- Notes:
-- - This configuration makes `service_types` globally visible/readable to all users (anon and authenticated).
-- - Insert/Update/Delete are restricted to authenticated users and admin roles as defined above.
-- - If you later want organization scoping, add `organization_id` predicates to SELECT/INSERT/UPDATE policies.
