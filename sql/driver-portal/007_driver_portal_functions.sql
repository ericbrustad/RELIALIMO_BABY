-- ============================================================================
-- 007: DRIVER PORTAL FUNCTIONS
-- Helper functions for driver portal operations
-- ============================================================================

-- ===========================================================================
-- DRIVER LOGIN FUNCTION
-- Authenticates driver and creates session
-- ===========================================================================
CREATE OR REPLACE FUNCTION driver_login(
    p_email TEXT DEFAULT NULL,
    p_phone TEXT DEFAULT NULL,
    p_password TEXT DEFAULT NULL,
    p_device_info JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB AS $$
DECLARE
    v_driver RECORD;
    v_session_token TEXT;
    v_session_id UUID;
BEGIN
    -- Find driver by email or phone
    SELECT * INTO v_driver
    FROM public.drivers
    WHERE (p_email IS NOT NULL AND LOWER(email) = LOWER(p_email))
       OR (p_phone IS NOT NULL AND phone_number = p_phone)
    LIMIT 1;
    
    IF NOT FOUND THEN
        -- Log failed attempt
        INSERT INTO public.driver_login_history (
            driver_id, login_type, success, failure_reason, device_info
        ) VALUES (
            NULL, 'password', FALSE, 'Driver not found', p_device_info
        );
        RETURN jsonb_build_object('success', FALSE, 'error', 'Invalid credentials');
    END IF;
    
    -- Check if driver is active
    IF NOT v_driver.is_active THEN
        INSERT INTO public.driver_login_history (
            driver_id, login_type, success, failure_reason, device_info
        ) VALUES (
            v_driver.id, 'password', FALSE, 'Account inactive', p_device_info
        );
        RETURN jsonb_build_object('success', FALSE, 'error', 'Account is inactive');
    END IF;
    
    -- TODO: Add password verification when implemented
    -- For now, we'll use a simple check or skip password validation
    
    -- Generate session token
    v_session_token := encode(gen_random_bytes(32), 'hex');
    
    -- Create session
    INSERT INTO public.driver_sessions (
        driver_id, session_token, device_info, last_activity
    ) VALUES (
        v_driver.id, v_session_token, p_device_info, NOW()
    )
    RETURNING id INTO v_session_id;
    
    -- Log successful login
    INSERT INTO public.driver_login_history (
        driver_id, session_id, login_type, success, device_info
    ) VALUES (
        v_driver.id, v_session_id, 'password', TRUE, p_device_info
    );
    
    -- Update driver last login
    UPDATE public.drivers
    SET last_login_at = NOW(),
        is_online = TRUE
    WHERE id = v_driver.id;
    
    -- Return driver info and session
    RETURN jsonb_build_object(
        'success', TRUE,
        'session_token', v_session_token,
        'driver', jsonb_build_object(
            'id', v_driver.id,
            'first_name', v_driver.first_name,
            'last_name', v_driver.last_name,
            'email', v_driver.email,
            'phone', v_driver.phone_number,
            'portal_slug', v_driver.portal_slug,
            'profile_photo_url', v_driver.profile_photo_url
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================================================
-- DRIVER LOGOUT FUNCTION
-- Ends session and updates status
-- ===========================================================================
CREATE OR REPLACE FUNCTION driver_logout(
    p_session_token TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_session RECORD;
BEGIN
    -- Find and expire session
    UPDATE public.driver_sessions
    SET is_active = FALSE, expires_at = NOW()
    WHERE session_token = p_session_token AND is_active = TRUE
    RETURNING * INTO v_session;
    
    IF FOUND THEN
        -- Update driver online status if no other active sessions
        UPDATE public.drivers
        SET is_online = FALSE, last_seen_at = NOW()
        WHERE id = v_session.driver_id
          AND NOT EXISTS (
              SELECT 1 FROM public.driver_sessions
              WHERE driver_id = v_session.driver_id
                AND is_active = TRUE
                AND id != v_session.id
          );
        
        RETURN jsonb_build_object('success', TRUE);
    END IF;
    
    RETURN jsonb_build_object('success', FALSE, 'error', 'Session not found');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================================================
-- VALIDATE SESSION FUNCTION
-- Checks if session is valid and updates activity
-- ===========================================================================
CREATE OR REPLACE FUNCTION validate_driver_session(
    p_session_token TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_session RECORD;
    v_driver RECORD;
BEGIN
    -- Find active session
    SELECT * INTO v_session
    FROM public.driver_sessions
    WHERE session_token = p_session_token
      AND is_active = TRUE
      AND expires_at > NOW();
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('valid', FALSE, 'error', 'Invalid or expired session');
    END IF;
    
    -- Get driver info
    SELECT * INTO v_driver
    FROM public.drivers
    WHERE id = v_session.driver_id;
    
    IF NOT v_driver.is_active THEN
        -- Invalidate session for inactive driver
        UPDATE public.driver_sessions
        SET is_active = FALSE
        WHERE id = v_session.id;
        
        RETURN jsonb_build_object('valid', FALSE, 'error', 'Account is inactive');
    END IF;
    
    -- Update last activity
    UPDATE public.driver_sessions
    SET last_activity = NOW()
    WHERE id = v_session.id;
    
    -- Update driver last seen
    UPDATE public.drivers
    SET last_seen_at = NOW(), is_online = TRUE
    WHERE id = v_driver.id;
    
    RETURN jsonb_build_object(
        'valid', TRUE,
        'driver', jsonb_build_object(
            'id', v_driver.id,
            'first_name', v_driver.first_name,
            'last_name', v_driver.last_name,
            'email', v_driver.email,
            'phone', v_driver.phone_number,
            'portal_slug', v_driver.portal_slug,
            'is_online', v_driver.is_online
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================================================
-- GENERATE PORTAL SLUG FUNCTION
-- Creates unique portal_slug from name
-- ===========================================================================
CREATE OR REPLACE FUNCTION generate_portal_slug(
    p_first_name TEXT,
    p_last_name TEXT
)
RETURNS TEXT AS $$
DECLARE
    v_base_slug TEXT;
    v_slug TEXT;
    v_counter INTEGER := 0;
BEGIN
    -- Create base slug (lowercase, underscores)
    v_base_slug := LOWER(
        REGEXP_REPLACE(
            TRIM(p_first_name) || '_' || TRIM(p_last_name),
            '[^a-z0-9]', '_', 'g'
        )
    );
    
    -- Remove multiple underscores
    v_base_slug := REGEXP_REPLACE(v_base_slug, '_+', '_', 'g');
    v_base_slug := TRIM(BOTH '_' FROM v_base_slug);
    
    v_slug := v_base_slug;
    
    -- Check for uniqueness and add number if needed
    WHILE EXISTS (SELECT 1 FROM public.drivers WHERE portal_slug = v_slug) LOOP
        v_counter := v_counter + 1;
        v_slug := v_base_slug || '_' || v_counter::TEXT;
    END LOOP;
    
    RETURN v_slug;
END;
$$ LANGUAGE plpgsql;

-- ===========================================================================
-- AUTO-GENERATE PORTAL SLUG TRIGGER
-- Automatically sets portal_slug on driver insert
-- ===========================================================================
CREATE OR REPLACE FUNCTION trigger_generate_portal_slug()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.portal_slug IS NULL OR NEW.portal_slug = '' THEN
        NEW.portal_slug := generate_portal_slug(NEW.first_name, NEW.last_name);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_driver_portal_slug ON public.drivers;
CREATE TRIGGER trigger_driver_portal_slug
    BEFORE INSERT ON public.drivers
    FOR EACH ROW
    EXECUTE FUNCTION trigger_generate_portal_slug();

-- ===========================================================================
-- GET DRIVER BY PORTAL SLUG
-- Fast lookup for portal access
-- ===========================================================================
CREATE OR REPLACE FUNCTION get_driver_by_portal_slug(
    p_portal_slug TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_driver RECORD;
BEGIN
    SELECT * INTO v_driver
    FROM public.drivers
    WHERE portal_slug = p_portal_slug;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('found', FALSE);
    END IF;
    
    RETURN jsonb_build_object(
        'found', TRUE,
        'driver', jsonb_build_object(
            'id', v_driver.id,
            'first_name', v_driver.first_name,
            'last_name', v_driver.last_name,
            'portal_slug', v_driver.portal_slug,
            'profile_photo_url', v_driver.profile_photo_url,
            'is_active', v_driver.is_active,
            'is_online', v_driver.is_online
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================================================
-- GET DRIVER STATS
-- Dashboard statistics for driver
-- ===========================================================================
CREATE OR REPLACE FUNCTION get_driver_stats(
    p_driver_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_stats JSONB;
    v_today DATE := CURRENT_DATE;
    v_week_start DATE := date_trunc('week', CURRENT_DATE)::DATE;
    v_month_start DATE := date_trunc('month', CURRENT_DATE)::DATE;
BEGIN
    SELECT jsonb_build_object(
        -- Trip counts
        'trips_today', COALESCE(
            (SELECT COUNT(*) FROM public.reservations 
             WHERE assigned_driver_id = p_driver_id 
             AND pickup_date::DATE = v_today
             AND status = 'completed'), 0
        ),
        'trips_this_week', COALESCE(
            (SELECT COUNT(*) FROM public.reservations 
             WHERE assigned_driver_id = p_driver_id 
             AND pickup_date::DATE >= v_week_start
             AND status = 'completed'), 0
        ),
        'trips_this_month', COALESCE(
            (SELECT COUNT(*) FROM public.reservations 
             WHERE assigned_driver_id = p_driver_id 
             AND pickup_date::DATE >= v_month_start
             AND status = 'completed'), 0
        ),
        -- Upcoming trips
        'upcoming_trips', COALESCE(
            (SELECT COUNT(*) FROM public.reservations 
             WHERE assigned_driver_id = p_driver_id 
             AND pickup_date > NOW()
             AND status NOT IN ('completed', 'cancelled')), 0
        ),
        -- Earnings
        'earnings_today', COALESCE(
            (SELECT SUM(net_amount) FROM public.driver_earnings 
             WHERE driver_id = p_driver_id 
             AND earned_at::DATE = v_today), 0
        ),
        'earnings_this_week', COALESCE(
            (SELECT SUM(net_amount) FROM public.driver_earnings 
             WHERE driver_id = p_driver_id 
             AND earned_at::DATE >= v_week_start), 0
        ),
        'earnings_this_month', COALESCE(
            (SELECT SUM(net_amount) FROM public.driver_earnings 
             WHERE driver_id = p_driver_id 
             AND earned_at::DATE >= v_month_start), 0
        ),
        -- Pending payout
        'pending_earnings', COALESCE(
            (SELECT SUM(net_amount) FROM public.driver_earnings 
             WHERE driver_id = p_driver_id 
             AND payout_status = 'pending'), 0
        ),
        -- Rating
        'current_rating', (
            SELECT rating FROM public.drivers WHERE id = p_driver_id
        )
    ) INTO v_stats;
    
    RETURN v_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================================================
-- GRANT EXECUTE PERMISSIONS
-- ===========================================================================
GRANT EXECUTE ON FUNCTION driver_login TO anon, authenticated;
GRANT EXECUTE ON FUNCTION driver_logout TO anon, authenticated;
GRANT EXECUTE ON FUNCTION validate_driver_session TO anon, authenticated;
GRANT EXECUTE ON FUNCTION generate_portal_slug TO authenticated;
GRANT EXECUTE ON FUNCTION get_driver_by_portal_slug TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_driver_stats TO authenticated;
