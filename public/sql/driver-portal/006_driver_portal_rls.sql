-- ============================================================================
-- 006: ROW LEVEL SECURITY (RLS) POLICIES
-- Secure driver portal data access
-- ============================================================================

-- ===========================================================================
-- ENABLE RLS ON ALL DRIVER PORTAL TABLES
-- ===========================================================================
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_login_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_weekly_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_availability_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_public_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_vehicles ENABLE ROW LEVEL SECURITY;

-- ===========================================================================
-- HELPER FUNCTION: Get current driver ID from JWT/session
-- ===========================================================================
CREATE OR REPLACE FUNCTION get_current_driver_id()
RETURNS UUID AS $$
BEGIN
    -- Try to get from JWT claim first
    RETURN COALESCE(
        (current_setting('request.jwt.claims', true)::json->>'driver_id')::UUID,
        NULL
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================================================
-- HELPER FUNCTION: Check if current user is admin
-- ===========================================================================
CREATE OR REPLACE FUNCTION is_admin_user()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN COALESCE(
        (current_setting('request.jwt.claims', true)::json->>'role')::TEXT = 'admin',
        FALSE
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================================================
-- DRIVERS TABLE POLICIES
-- ===========================================================================
-- Drivers can read their own record
DROP POLICY IF EXISTS drivers_select_own ON public.drivers;
CREATE POLICY drivers_select_own ON public.drivers
    FOR SELECT
    USING (
        id = get_current_driver_id()
        OR is_admin_user()
        OR auth.role() = 'service_role'
    );

-- Drivers can update their own record (limited fields)
DROP POLICY IF EXISTS drivers_update_own ON public.drivers;
CREATE POLICY drivers_update_own ON public.drivers
    FOR UPDATE
    USING (id = get_current_driver_id() OR is_admin_user())
    WITH CHECK (id = get_current_driver_id() OR is_admin_user());

-- Service role and admins can insert
DROP POLICY IF EXISTS drivers_insert_admin ON public.drivers;
CREATE POLICY drivers_insert_admin ON public.drivers
    FOR INSERT
    WITH CHECK (is_admin_user() OR auth.role() = 'service_role');

-- ===========================================================================
-- DRIVER SESSIONS POLICIES
-- ===========================================================================
DROP POLICY IF EXISTS sessions_select_own ON public.driver_sessions;
CREATE POLICY sessions_select_own ON public.driver_sessions
    FOR SELECT
    USING (driver_id = get_current_driver_id() OR is_admin_user());

DROP POLICY IF EXISTS sessions_insert_own ON public.driver_sessions;
CREATE POLICY sessions_insert_own ON public.driver_sessions
    FOR INSERT
    WITH CHECK (driver_id = get_current_driver_id() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS sessions_update_own ON public.driver_sessions;
CREATE POLICY sessions_update_own ON public.driver_sessions
    FOR UPDATE
    USING (driver_id = get_current_driver_id() OR is_admin_user());

DROP POLICY IF EXISTS sessions_delete_own ON public.driver_sessions;
CREATE POLICY sessions_delete_own ON public.driver_sessions
    FOR DELETE
    USING (driver_id = get_current_driver_id() OR is_admin_user());

-- ===========================================================================
-- DRIVER PAYMENT METHODS POLICIES
-- Highly sensitive - strict access
-- ===========================================================================
DROP POLICY IF EXISTS payment_select_own ON public.driver_payment_methods;
CREATE POLICY payment_select_own ON public.driver_payment_methods
    FOR SELECT
    USING (driver_id = get_current_driver_id() OR is_admin_user());

DROP POLICY IF EXISTS payment_insert_own ON public.driver_payment_methods;
CREATE POLICY payment_insert_own ON public.driver_payment_methods
    FOR INSERT
    WITH CHECK (driver_id = get_current_driver_id());

DROP POLICY IF EXISTS payment_update_own ON public.driver_payment_methods;
CREATE POLICY payment_update_own ON public.driver_payment_methods
    FOR UPDATE
    USING (driver_id = get_current_driver_id());

DROP POLICY IF EXISTS payment_delete_own ON public.driver_payment_methods;
CREATE POLICY payment_delete_own ON public.driver_payment_methods
    FOR DELETE
    USING (driver_id = get_current_driver_id());

-- ===========================================================================
-- DRIVER EARNINGS POLICIES
-- ===========================================================================
DROP POLICY IF EXISTS earnings_select_own ON public.driver_earnings;
CREATE POLICY earnings_select_own ON public.driver_earnings
    FOR SELECT
    USING (driver_id = get_current_driver_id() OR is_admin_user());

-- Only service role can insert/update earnings
DROP POLICY IF EXISTS earnings_insert_admin ON public.driver_earnings;
CREATE POLICY earnings_insert_admin ON public.driver_earnings
    FOR INSERT
    WITH CHECK (is_admin_user() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS earnings_update_admin ON public.driver_earnings;
CREATE POLICY earnings_update_admin ON public.driver_earnings
    FOR UPDATE
    USING (is_admin_user() OR auth.role() = 'service_role');

-- ===========================================================================
-- DRIVER AVAILABILITY POLICIES
-- ===========================================================================
DROP POLICY IF EXISTS schedule_select_own ON public.driver_weekly_schedule;
CREATE POLICY schedule_select_own ON public.driver_weekly_schedule
    FOR SELECT
    USING (driver_id = get_current_driver_id() OR is_admin_user());

DROP POLICY IF EXISTS schedule_insert_own ON public.driver_weekly_schedule;
CREATE POLICY schedule_insert_own ON public.driver_weekly_schedule
    FOR INSERT
    WITH CHECK (driver_id = get_current_driver_id());

DROP POLICY IF EXISTS schedule_update_own ON public.driver_weekly_schedule;
CREATE POLICY schedule_update_own ON public.driver_weekly_schedule
    FOR UPDATE
    USING (driver_id = get_current_driver_id());

DROP POLICY IF EXISTS schedule_delete_own ON public.driver_weekly_schedule;
CREATE POLICY schedule_delete_own ON public.driver_weekly_schedule
    FOR DELETE
    USING (driver_id = get_current_driver_id());

-- Availability Exceptions
DROP POLICY IF EXISTS exceptions_select_own ON public.driver_availability_exceptions;
CREATE POLICY exceptions_select_own ON public.driver_availability_exceptions
    FOR SELECT
    USING (driver_id = get_current_driver_id() OR is_admin_user());

DROP POLICY IF EXISTS exceptions_insert_own ON public.driver_availability_exceptions;
CREATE POLICY exceptions_insert_own ON public.driver_availability_exceptions
    FOR INSERT
    WITH CHECK (driver_id = get_current_driver_id());

DROP POLICY IF EXISTS exceptions_update_own ON public.driver_availability_exceptions;
CREATE POLICY exceptions_update_own ON public.driver_availability_exceptions
    FOR UPDATE
    USING (driver_id = get_current_driver_id() OR is_admin_user());

DROP POLICY IF EXISTS exceptions_delete_own ON public.driver_availability_exceptions;
CREATE POLICY exceptions_delete_own ON public.driver_availability_exceptions
    FOR DELETE
    USING (driver_id = get_current_driver_id());

-- ===========================================================================
-- DRIVER PREFERENCES POLICIES
-- ===========================================================================
DROP POLICY IF EXISTS prefs_select_own ON public.driver_preferences;
CREATE POLICY prefs_select_own ON public.driver_preferences
    FOR SELECT
    USING (driver_id = get_current_driver_id() OR is_admin_user());

DROP POLICY IF EXISTS prefs_insert_own ON public.driver_preferences;
CREATE POLICY prefs_insert_own ON public.driver_preferences
    FOR INSERT
    WITH CHECK (driver_id = get_current_driver_id());

DROP POLICY IF EXISTS prefs_update_own ON public.driver_preferences;
CREATE POLICY prefs_update_own ON public.driver_preferences
    FOR UPDATE
    USING (driver_id = get_current_driver_id());

-- ===========================================================================
-- PUBLIC PROFILE POLICIES
-- Public profiles are readable by anyone when is_public = true
-- ===========================================================================
DROP POLICY IF EXISTS public_profile_select ON public.driver_public_profile;
CREATE POLICY public_profile_select ON public.driver_public_profile
    FOR SELECT
    USING (
        is_public = TRUE  -- Anyone can view public profiles
        OR driver_id = get_current_driver_id()  -- Owner can view own
        OR is_admin_user()
    );

DROP POLICY IF EXISTS public_profile_insert_own ON public.driver_public_profile;
CREATE POLICY public_profile_insert_own ON public.driver_public_profile
    FOR INSERT
    WITH CHECK (driver_id = get_current_driver_id());

DROP POLICY IF EXISTS public_profile_update_own ON public.driver_public_profile;
CREATE POLICY public_profile_update_own ON public.driver_public_profile
    FOR UPDATE
    USING (driver_id = get_current_driver_id());

-- ===========================================================================
-- TESTIMONIALS POLICIES
-- ===========================================================================
DROP POLICY IF EXISTS testimonials_select ON public.driver_testimonials;
CREATE POLICY testimonials_select ON public.driver_testimonials
    FOR SELECT
    USING (
        is_public = TRUE  -- Public testimonials visible to all
        OR driver_id = get_current_driver_id()
        OR is_admin_user()
    );

DROP POLICY IF EXISTS testimonials_update_own ON public.driver_testimonials;
CREATE POLICY testimonials_update_own ON public.driver_testimonials
    FOR UPDATE
    USING (driver_id = get_current_driver_id());

-- ===========================================================================
-- VEHICLES POLICIES
-- ===========================================================================
DROP POLICY IF EXISTS vehicles_select ON public.driver_vehicles;
CREATE POLICY vehicles_select ON public.driver_vehicles
    FOR SELECT
    USING (driver_id = get_current_driver_id() OR is_admin_user());

DROP POLICY IF EXISTS vehicles_insert_own ON public.driver_vehicles;
CREATE POLICY vehicles_insert_own ON public.driver_vehicles
    FOR INSERT
    WITH CHECK (driver_id = get_current_driver_id() OR is_admin_user());

DROP POLICY IF EXISTS vehicles_update_own ON public.driver_vehicles;
CREATE POLICY vehicles_update_own ON public.driver_vehicles
    FOR UPDATE
    USING (driver_id = get_current_driver_id() OR is_admin_user());

DROP POLICY IF EXISTS vehicles_delete_own ON public.driver_vehicles;
CREATE POLICY vehicles_delete_own ON public.driver_vehicles
    FOR DELETE
    USING (driver_id = get_current_driver_id() OR is_admin_user());

-- ===========================================================================
-- GRANT PERMISSIONS
-- ===========================================================================
GRANT SELECT ON public.v_driver_public_profiles TO anon, authenticated;
GRANT EXECUTE ON FUNCTION check_driver_availability TO authenticated;
GRANT EXECUTE ON FUNCTION get_available_drivers TO authenticated;
