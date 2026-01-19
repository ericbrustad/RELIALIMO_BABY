-- scripts/sql/fleet_vehicles_rls.sql
-- Recommended RLS policies for `public.fleet_vehicles`.
-- Mirrors the vehicle_types policy structure for global public read access.
-- Run in Supabase SQL editor or psql as a privileged user (service_role).

-- 1) Enable RLS
ALTER TABLE IF EXISTS public.fleet_vehicles ENABLE ROW LEVEL SECURITY;

-- 2) Public read: allow anonymous (anon) users to SELECT ALL rows
DROP POLICY IF EXISTS "fleet_vehicles_select_public" ON public.fleet_vehicles;
CREATE POLICY "fleet_vehicles_select_public" ON public.fleet_vehicles
  FOR SELECT
  USING (
    auth.role() = 'anon'
  );

-- 3) Authenticated users can SELECT ALL rows
DROP POLICY IF EXISTS "fleet_vehicles_select_all" ON public.fleet_vehicles;
CREATE POLICY "fleet_vehicles_select_all" ON public.fleet_vehicles
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
  );

-- 4) Allow authenticated users to INSERT
DROP POLICY IF EXISTS "fleet_vehicles_insert_all" ON public.fleet_vehicles;
CREATE POLICY "fleet_vehicles_insert_all" ON public.fleet_vehicles
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (status IN ('AVAILABLE','IN_USE','MAINTENANCE','RETIRED','OUT_OF_SERVICE'))
  );

-- 5) Allow anon to INSERT (for upsert from client without login)
-- Note: This requires status to be valid per schema constraint
DROP POLICY IF EXISTS "fleet_vehicles_insert_anon" ON public.fleet_vehicles;
CREATE POLICY "fleet_vehicles_insert_anon" ON public.fleet_vehicles
  FOR INSERT
  WITH CHECK (
    auth.role() = 'anon'
    AND (status IN ('AVAILABLE','IN_USE','MAINTENANCE','RETIRED','OUT_OF_SERVICE'))
  );

-- 6) Allow authenticated users to UPDATE
DROP POLICY IF EXISTS "fleet_vehicles_update_all" ON public.fleet_vehicles;
CREATE POLICY "fleet_vehicles_update_all" ON public.fleet_vehicles
  FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
  );

-- 7) Allow anon to UPDATE (for upsert from client without login)
DROP POLICY IF EXISTS "fleet_vehicles_update_anon" ON public.fleet_vehicles;
CREATE POLICY "fleet_vehicles_update_anon" ON public.fleet_vehicles
  FOR UPDATE
  USING (
    auth.role() = 'anon'
  )
  WITH CHECK (
    auth.role() = 'anon'
  );

-- 8) Admin/dispatch/superadmin can DELETE
DROP POLICY IF EXISTS "fleet_vehicles_admin_delete" ON public.fleet_vehicles;
CREATE POLICY "fleet_vehicles_admin_delete" ON public.fleet_vehicles
  FOR DELETE
  USING (
    auth.role() IN ('admin','dispatch','superadmin')
  );

-- Grants (do not bypass RLS)
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.fleet_vehicles TO anon, authenticated;

-- Notes:
-- - This configuration makes `fleet_vehicles` globally visible/readable to all users.
-- - Insert/Update allowed for both anon and authenticated (for client-side upsert).
-- - Delete is restricted to admin roles.
-- - If you later want organization scoping, add `organization_id` predicates to policies.
