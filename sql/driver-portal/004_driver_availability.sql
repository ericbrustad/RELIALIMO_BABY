-- ============================================================================
-- 004: DRIVER AVAILABILITY SYSTEM
-- Calendar-based availability with recurring schedules
-- ============================================================================

-- ===========================================================================
-- DRIVER WEEKLY SCHEDULE (Recurring Defaults)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.driver_weekly_schedule (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
    
    -- Day of week (0 = Sunday, 6 = Saturday)
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
    
    -- Is available on this day?
    is_available BOOLEAN DEFAULT TRUE,
    
    -- Time windows (if available)
    start_time TIME, -- NULL means all day if is_available
    end_time TIME,
    
    -- Notes for this day
    notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(driver_id, day_of_week)
);

-- ===========================================================================
-- DRIVER AVAILABILITY EXCEPTIONS
-- Specific date overrides (vacations, sick days, extra availability)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.driver_availability_exceptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
    
    -- Exception date or range
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    
    -- Type of exception
    exception_type TEXT NOT NULL CHECK (exception_type IN (
        'unavailable',  -- Blocked off
        'available',    -- Override to be available
        'limited'       -- Available but with restrictions
    )),
    
    -- Time restrictions (for 'limited' type)
    start_time TIME,
    end_time TIME,
    
    -- Reason/notes
    reason TEXT,
    
    -- Approval (if company requires it)
    requires_approval BOOLEAN DEFAULT FALSE,
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMPTZ,
    approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_availability_exceptions_driver 
ON public.driver_availability_exceptions(driver_id);

CREATE INDEX IF NOT EXISTS idx_availability_exceptions_dates 
ON public.driver_availability_exceptions(driver_id, start_date, end_date);

-- ===========================================================================
-- DRIVER PREFERENCES
-- Driver work preferences (trip types, distances, etc.)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.driver_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE UNIQUE,
    
    -- Trip type preferences
    accepts_airport_trips BOOLEAN DEFAULT TRUE,
    accepts_hourly_trips BOOLEAN DEFAULT TRUE,
    accepts_point_to_point BOOLEAN DEFAULT TRUE,
    accepts_long_distance BOOLEAN DEFAULT TRUE,
    accepts_corporate BOOLEAN DEFAULT TRUE,
    accepts_events BOOLEAN DEFAULT TRUE,
    
    -- Distance preferences
    max_pickup_distance_miles INTEGER DEFAULT 50,
    max_trip_distance_miles INTEGER,
    
    -- Time preferences
    preferred_start_time TIME,
    preferred_end_time TIME,
    max_hours_per_day INTEGER DEFAULT 12,
    
    -- Vehicle preferences (if driver has multiple vehicles)
    preferred_vehicle_ids UUID[],
    
    -- Trip preferences
    min_trip_amount NUMERIC(10,2),
    prefers_cash_trips BOOLEAN DEFAULT FALSE,
    
    -- Notification preferences (for new trip alerts)
    notify_sms BOOLEAN DEFAULT TRUE,
    notify_email BOOLEAN DEFAULT TRUE,
    notify_push BOOLEAN DEFAULT TRUE,
    notify_portal BOOLEAN DEFAULT TRUE,
    
    -- Auto-accept settings
    auto_accept_assigned BOOLEAN DEFAULT FALSE,
    auto_accept_threshold_minutes INTEGER DEFAULT 30, -- Auto-accept if trip is > X minutes away
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================================================
-- AVAILABILITY CHECK FUNCTION
-- Check if driver is available for a specific date/time
-- ===========================================================================
CREATE OR REPLACE FUNCTION check_driver_availability(
    p_driver_id UUID,
    p_date DATE,
    p_start_time TIME DEFAULT NULL,
    p_end_time TIME DEFAULT NULL
)
RETURNS TABLE (
    is_available BOOLEAN,
    reason TEXT,
    available_start TIME,
    available_end TIME
) AS $$
DECLARE
    v_day_of_week INTEGER;
    v_weekly_schedule RECORD;
    v_exception RECORD;
BEGIN
    v_day_of_week := EXTRACT(DOW FROM p_date);
    
    -- Check for exceptions first (they override weekly schedule)
    SELECT * INTO v_exception
    FROM public.driver_availability_exceptions
    WHERE driver_id = p_driver_id
      AND p_date BETWEEN start_date AND end_date
      AND (approval_status = 'approved' OR NOT requires_approval)
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF FOUND THEN
        IF v_exception.exception_type = 'unavailable' THEN
            RETURN QUERY SELECT FALSE, v_exception.reason, NULL::TIME, NULL::TIME;
            RETURN;
        ELSIF v_exception.exception_type = 'available' THEN
            RETURN QUERY SELECT TRUE, 'Available (exception)'::TEXT, 
                v_exception.start_time, v_exception.end_time;
            RETURN;
        ELSIF v_exception.exception_type = 'limited' THEN
            RETURN QUERY SELECT TRUE, v_exception.reason, 
                v_exception.start_time, v_exception.end_time;
            RETURN;
        END IF;
    END IF;
    
    -- Check weekly schedule
    SELECT * INTO v_weekly_schedule
    FROM public.driver_weekly_schedule
    WHERE driver_id = p_driver_id
      AND day_of_week = v_day_of_week;
    
    IF FOUND THEN
        IF v_weekly_schedule.is_available THEN
            RETURN QUERY SELECT TRUE, 'Available (weekly schedule)'::TEXT,
                v_weekly_schedule.start_time, v_weekly_schedule.end_time;
        ELSE
            RETURN QUERY SELECT FALSE, 'Not available (weekly schedule)'::TEXT, 
                NULL::TIME, NULL::TIME;
        END IF;
        RETURN;
    END IF;
    
    -- No schedule found, assume available
    RETURN QUERY SELECT TRUE, 'Available (default)'::TEXT, NULL::TIME, NULL::TIME;
END;
$$ LANGUAGE plpgsql;

-- ===========================================================================
-- GET AVAILABLE DRIVERS FOR DATE/TIME
-- Returns list of available drivers for a given time slot
-- ===========================================================================
CREATE OR REPLACE FUNCTION get_available_drivers(
    p_date DATE,
    p_start_time TIME DEFAULT NULL,
    p_end_time TIME DEFAULT NULL,
    p_organization_id UUID DEFAULT NULL
)
RETURNS TABLE (
    driver_id UUID,
    driver_name TEXT,
    portal_slug TEXT,
    phone TEXT,
    available_start TIME,
    available_end TIME
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.id,
        (d.first_name || ' ' || d.last_name)::TEXT,
        d.portal_slug,
        d.phone_number,
        avail.available_start,
        avail.available_end
    FROM public.drivers d
    CROSS JOIN LATERAL check_driver_availability(d.id, p_date, p_start_time, p_end_time) avail
    WHERE avail.is_available = TRUE
      AND d.is_active = TRUE
      AND (p_organization_id IS NULL OR d.organization_id = p_organization_id)
    ORDER BY d.first_name, d.last_name;
END;
$$ LANGUAGE plpgsql;
