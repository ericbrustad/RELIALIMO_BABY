-- ============================================================================
-- RLS POLICIES FOR DRIVER PORTAL REGISTRATION
-- Run this in Supabase SQL Editor to allow anonymous driver registration
-- ============================================================================

-- DRIVERS TABLE
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS drivers_anon_insert ON public.drivers;
CREATE POLICY drivers_anon_insert ON public.drivers
    FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS drivers_anon_select ON public.drivers;
CREATE POLICY drivers_anon_select ON public.drivers
    FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS drivers_auth_all ON public.drivers;
CREATE POLICY drivers_auth_all ON public.drivers
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- AFFILIATES TABLE
ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS affiliates_anon_select ON public.affiliates;
CREATE POLICY affiliates_anon_select ON public.affiliates
    FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS affiliates_anon_insert ON public.affiliates;
CREATE POLICY affiliates_anon_insert ON public.affiliates
    FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS affiliates_auth_all ON public.affiliates;
CREATE POLICY affiliates_auth_all ON public.affiliates
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- VEHICLES TABLE
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vehicles_anon_select ON public.vehicles;
CREATE POLICY vehicles_anon_select ON public.vehicles
    FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS vehicles_anon_insert ON public.vehicles;
CREATE POLICY vehicles_anon_insert ON public.vehicles
    FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS vehicles_auth_all ON public.vehicles;
CREATE POLICY vehicles_auth_all ON public.vehicles
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Verify policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd 
FROM pg_policies 
WHERE tablename IN ('drivers', 'affiliates', 'vehicles')
ORDER BY tablename, policyname;
