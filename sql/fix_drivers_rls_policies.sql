-- ============================================================================
-- FIX: Add UPDATE and SELECT RLS policies for drivers table
-- ============================================================================
-- The driver portal needs to update driver records after registration
-- (e.g., to set assigned_vehicle_id and profile data)
-- Run this in Supabase SQL Editor to enable driver updates
-- ============================================================================

-- Allow anon to select drivers (needed for login check and profile viewing)
DROP POLICY IF EXISTS drivers_anon_select ON public.drivers;
CREATE POLICY drivers_anon_select ON public.drivers
    FOR SELECT TO anon USING (true);

-- Allow anon to update drivers (needed for profile updates and vehicle assignment)
DROP POLICY IF EXISTS drivers_anon_update ON public.drivers;
CREATE POLICY drivers_anon_update ON public.drivers
    FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- Allow anon to delete drivers (for account deletion)
DROP POLICY IF EXISTS drivers_anon_delete ON public.drivers;
CREATE POLICY drivers_anon_delete ON public.drivers
    FOR DELETE TO anon USING (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drivers TO anon, authenticated;

-- Verify policies are in place
SELECT schemaname, tablename, policyname, permissive, roles, cmd 
FROM pg_policies 
WHERE tablename = 'drivers';
