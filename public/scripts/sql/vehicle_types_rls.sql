-- scripts/sql/vehicle_types_rls.sql
-- Recommended RLS policies and sample data for `public.vehicle_types`.
-- Run in Supabase SQL editor or psql as a privileged user (service_role).

-- 1) Enable RLS
ALTER TABLE IF EXISTS public.vehicle_types ENABLE ROW LEVEL SECURITY;

-- 2) Public read: allow anonymous (anon) users to SELECT ALL rows
DROP POLICY IF EXISTS "vehicle_types_select_public" ON public.vehicle_types;
CREATE POLICY "vehicle_types_select_public" ON public.vehicle_types
  FOR SELECT
  USING (
    auth.role() = 'anon'
  );

-- 3) Authenticated users can SELECT ALL rows
DROP POLICY IF EXISTS "vehicle_types_select_all" ON public.vehicle_types;
CREATE POLICY "vehicle_types_select_all" ON public.vehicle_types
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
  );

-- 4) Allow authenticated users to INSERT if status is ACTIVE or INACTIVE
DROP POLICY IF EXISTS "vehicle_types_insert_all" ON public.vehicle_types;
CREATE POLICY "vehicle_types_insert_all" ON public.vehicle_types
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (status IN ('ACTIVE','INACTIVE'))
  );

-- 5) Allow authenticated users to UPDATE most fields; code can only change when vt_can_update_code approves
DROP POLICY IF EXISTS "vehicle_types_user_update_guard" ON public.vehicle_types;
CREATE POLICY "vehicle_types_user_update_guard" ON public.vehicle_types
  FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
  )
  WITH CHECK (
    (code = public.vehicle_types.code)
    OR vt_can_update_code(id, code)
  );

-- 6) Admin/dispatch/superadmin can fully UPDATE
DROP POLICY IF EXISTS "vehicle_types_admin_full_update" ON public.vehicle_types;
CREATE POLICY "vehicle_types_admin_full_update" ON public.vehicle_types
  FOR UPDATE
  USING (
    auth.role() IN ('admin','dispatch','superadmin')
  )
  WITH CHECK (
    auth.role() IN ('admin','dispatch','superadmin')
  );

-- 7) Admin/dispatch/superadmin can DELETE
DROP POLICY IF EXISTS "vehicle_types_admin_delete" ON public.vehicle_types;
CREATE POLICY "vehicle_types_admin_delete" ON public.vehicle_types
  FOR DELETE
  USING (
    auth.role() IN ('admin','dispatch','superadmin')
  );

-- Grants (do not bypass RLS)
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.vehicle_types TO anon, authenticated;

-- Sample data insertion (example row, adjust fields to match your schema):
-- INSERT INTO public.vehicle_types (id, name, code, status, sort_order) VALUES
--   ('00000000-0000-0000-0000-000000000001', 'Standard Sedan', 'SEDAN', 'ACTIVE', 100);

-- Notes:
-- - This configuration makes `vehicle_types` globally visible/readable to all users (anon and authenticated).
-- - Insert/Update/Delete are restricted to authenticated users and admin roles as defined above.
-- - Ensure `vt_can_update_code(id, code)` is secure and returns a boolean; it controls code-change permissions.
-- - If you later want organization scoping, add `organization_id` predicates to SELECT/INSERT/UPDATE policies.
