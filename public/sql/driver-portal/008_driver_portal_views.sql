-- ============================================================================
-- 008: DRIVER PORTAL VIEWS
-- Optimized views for common driver portal queries
-- Uses actual column names from drivers table
-- ============================================================================

-- Drop existing views first (they have different column structures)
DROP VIEW IF EXISTS public.v_driver_dashboard CASCADE;
DROP VIEW IF EXISTS public.v_driver_upcoming_trips CASCADE;
DROP VIEW IF EXISTS public.v_driver_trip_history CASCADE;
DROP VIEW IF EXISTS public.v_driver_earnings_summary CASCADE;
DROP VIEW IF EXISTS public.v_driver_availability_calendar CASCADE;
DROP VIEW IF EXISTS public.v_online_drivers CASCADE;

-- ===========================================================================
-- DRIVER DASHBOARD VIEW
-- Main view for driver portal dashboard
-- ===========================================================================
CREATE OR REPLACE VIEW public.v_driver_dashboard AS
SELECT 
    d.id AS driver_id,
    d.first_name,
    d.last_name,
    d.portal_slug,
    d.email,
    d.cell_phone AS phone_number,
    d.profile_photo_url,
    COALESCE(d.is_online, FALSE) AS is_online,
    d.last_online_at AS last_seen_at,
    d.rating,
    d.completed_trips AS trip_count,
    -- Profile completeness
    (
        CASE WHEN d.first_name IS NOT NULL THEN 15 ELSE 0 END +
        CASE WHEN d.last_name IS NOT NULL THEN 15 ELSE 0 END +
        CASE WHEN d.email IS NOT NULL THEN 15 ELSE 0 END +
        CASE WHEN d.cell_phone IS NOT NULL THEN 15 ELSE 0 END +
        CASE WHEN d.profile_photo_url IS NOT NULL THEN 20 ELSE 0 END +
        CASE WHEN d.license_number IS NOT NULL THEN 20 ELSE 0 END
    ) AS profile_completeness_pct,
    d.priority_score,
    d.driver_level,
    d.years_experience
FROM public.drivers d
WHERE COALESCE(d.is_active, TRUE) = TRUE;

-- ===========================================================================
-- DRIVER UPCOMING TRIPS VIEW
-- Shows upcoming/active trips for a driver
-- ===========================================================================
CREATE OR REPLACE VIEW public.v_driver_upcoming_trips AS
SELECT 
    r.id AS reservation_id,
    r.confirmation_number,
    r.assigned_driver_id AS driver_id,
    d.portal_slug,
    r.pickup_datetime,
    r.pickup_datetime::DATE AS trip_date,
    r.pickup_datetime::TIME AS trip_time,
    r.passenger_name,
    r.pu_address AS pickup_address,
    r.do_address AS dropoff_address,
    r.vehicle_type,
    r.status,
    r.driver_status,
    r.grand_total,
    r.payment_type,
    r.special_instructions,
    r.created_at,
    r.updated_at
FROM public.reservations r
JOIN public.drivers d ON d.id = r.assigned_driver_id
WHERE r.assigned_driver_id IS NOT NULL
  AND r.status NOT IN ('completed', 'cancelled', 'no_show')
ORDER BY r.pickup_datetime ASC;

-- ===========================================================================
-- DRIVER TRIP HISTORY VIEW
-- Completed trips for a driver
-- ===========================================================================
CREATE OR REPLACE VIEW public.v_driver_trip_history AS
SELECT 
    r.id AS reservation_id,
    r.confirmation_number,
    r.assigned_driver_id AS driver_id,
    d.portal_slug,
    r.pickup_datetime,
    r.pickup_datetime::DATE AS trip_date,
    r.passenger_name,
    r.pu_address AS pickup_address,
    r.do_address AS dropoff_address,
    r.vehicle_type,
    r.status,
    r.grand_total,
    r.payment_type,
    r.updated_at AS completed_at
FROM public.reservations r
JOIN public.drivers d ON d.id = r.assigned_driver_id
WHERE r.assigned_driver_id IS NOT NULL
  AND r.status = 'completed'
ORDER BY r.pickup_datetime DESC;

-- ===========================================================================
-- DRIVER EARNINGS SUMMARY VIEW
-- Aggregated earnings by period
-- ===========================================================================
CREATE OR REPLACE VIEW public.v_driver_earnings_summary AS
SELECT 
    e.driver_id,
    d.portal_slug,
    d.first_name,
    d.last_name,
    -- Today
    SUM(CASE WHEN e.earned_at::DATE = CURRENT_DATE THEN e.net_amount ELSE 0 END) AS earnings_today,
    COUNT(CASE WHEN e.earned_at::DATE = CURRENT_DATE THEN 1 END) AS trips_today,
    -- This week
    SUM(CASE WHEN e.earned_at::DATE >= date_trunc('week', CURRENT_DATE) THEN e.net_amount ELSE 0 END) AS earnings_this_week,
    COUNT(CASE WHEN e.earned_at::DATE >= date_trunc('week', CURRENT_DATE) THEN 1 END) AS trips_this_week,
    -- This month
    SUM(CASE WHEN e.earned_at::DATE >= date_trunc('month', CURRENT_DATE) THEN e.net_amount ELSE 0 END) AS earnings_this_month,
    COUNT(CASE WHEN e.earned_at::DATE >= date_trunc('month', CURRENT_DATE) THEN 1 END) AS trips_this_month,
    -- This year
    SUM(CASE WHEN e.earned_at::DATE >= date_trunc('year', CURRENT_DATE) THEN e.net_amount ELSE 0 END) AS earnings_this_year,
    COUNT(CASE WHEN e.earned_at::DATE >= date_trunc('year', CURRENT_DATE) THEN 1 END) AS trips_this_year,
    -- Pending
    SUM(CASE WHEN e.payout_status = 'pending' THEN e.net_amount ELSE 0 END) AS pending_earnings,
    COUNT(CASE WHEN e.payout_status = 'pending' THEN 1 END) AS pending_count,
    -- All time
    SUM(e.net_amount) AS total_earnings,
    COUNT(*) AS total_trips,
    AVG(e.net_amount) AS avg_earning_per_trip
FROM public.driver_earnings e
JOIN public.drivers d ON d.id = e.driver_id
GROUP BY e.driver_id, d.portal_slug, d.first_name, d.last_name;

-- ===========================================================================
-- DRIVER AVAILABILITY CALENDAR VIEW
-- Combined weekly schedule + exceptions for calendar display
-- ===========================================================================
CREATE OR REPLACE VIEW public.v_driver_availability_calendar AS
WITH date_series AS (
    SELECT generate_series(
        CURRENT_DATE,
        CURRENT_DATE + INTERVAL '60 days',
        INTERVAL '1 day'
    )::DATE AS calendar_date
),
driver_dates AS (
    SELECT 
        d.id AS driver_id,
        d.portal_slug,
        ds.calendar_date,
        EXTRACT(DOW FROM ds.calendar_date)::INTEGER AS day_of_week
    FROM public.drivers d
    CROSS JOIN date_series ds
    WHERE COALESCE(d.is_active, TRUE) = TRUE
)
SELECT 
    dd.driver_id,
    dd.portal_slug,
    dd.calendar_date,
    dd.day_of_week,
    COALESCE(
        ex.exception_type,
        CASE WHEN ws.is_available THEN 'available' ELSE 'unavailable' END,
        'available'
    ) AS availability_status,
    COALESCE(ex.start_time, ws.start_time) AS available_from,
    COALESCE(ex.end_time, ws.end_time) AS available_until,
    ex.reason AS exception_reason,
    ex.approval_status
FROM driver_dates dd
LEFT JOIN public.driver_weekly_schedule ws 
    ON ws.driver_id = dd.driver_id 
    AND ws.day_of_week = dd.day_of_week
LEFT JOIN public.driver_availability_exceptions ex 
    ON ex.driver_id = dd.driver_id 
    AND dd.calendar_date BETWEEN ex.start_date AND ex.end_date
    AND (ex.approval_status = 'approved' OR NOT ex.requires_approval);

-- ===========================================================================
-- ONLINE DRIVERS VIEW
-- Currently online drivers with location
-- ===========================================================================
CREATE OR REPLACE VIEW public.v_online_drivers AS
SELECT 
    d.id AS driver_id,
    d.first_name,
    d.last_name,
    d.portal_slug,
    d.cell_phone AS phone_number,
    d.profile_photo_url,
    d.rating,
    d.is_online,
    d.last_online_at AS last_seen_at,
    d.last_known_lat AS current_location_lat,
    d.last_known_lng AS current_location_lng,
    d.last_location_update AS current_location_updated_at,
    d.organization_id,
    d.priority_score,
    d.driver_level
FROM public.drivers d
WHERE COALESCE(d.is_online, FALSE) = TRUE
  AND COALESCE(d.is_active, TRUE) = TRUE
  AND d.last_online_at > NOW() - INTERVAL '15 minutes';

-- ===========================================================================
-- GRANT SELECT ON VIEWS
-- ===========================================================================
GRANT SELECT ON public.v_driver_dashboard TO authenticated;
GRANT SELECT ON public.v_driver_upcoming_trips TO authenticated;
GRANT SELECT ON public.v_driver_trip_history TO authenticated;
GRANT SELECT ON public.v_driver_earnings_summary TO authenticated;
GRANT SELECT ON public.v_driver_availability_calendar TO authenticated;
GRANT SELECT ON public.v_online_drivers TO authenticated;
