-- ============================================================================
-- 002: DRIVER SESSIONS & LOGIN HISTORY
-- Tracks driver logins for security and analytics
-- ============================================================================

-- ===========================================================================
-- DRIVER SESSIONS TABLE
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.driver_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    -- Session info
    access_token_hash TEXT, -- Store hash only, not actual token
    refresh_token_hash TEXT,
    expires_at TIMESTAMPTZ,
    
    -- Device/browser info
    user_agent TEXT,
    ip_address INET,
    device_type TEXT, -- 'mobile', 'tablet', 'desktop'
    browser TEXT,
    os TEXT,
    
    -- Location (if permitted)
    login_location JSONB, -- {lat, lng, city, country}
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    end_reason TEXT -- 'logout', 'expired', 'revoked', 'new_login'
);

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_driver_sessions_driver_id 
ON public.driver_sessions(driver_id);

CREATE INDEX IF NOT EXISTS idx_driver_sessions_active 
ON public.driver_sessions(driver_id, is_active) 
WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_driver_sessions_user_id 
ON public.driver_sessions(user_id);

-- ===========================================================================
-- DRIVER LOGIN HISTORY TABLE
-- Audit log of all login attempts
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.driver_login_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
    email TEXT NOT NULL,
    
    -- Attempt info
    success BOOLEAN NOT NULL,
    failure_reason TEXT, -- 'invalid_password', 'account_disabled', 'not_found'
    
    -- Device info
    user_agent TEXT,
    ip_address INET,
    
    -- Timestamp
    attempted_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for security monitoring (failed attempts)
CREATE INDEX IF NOT EXISTS idx_driver_login_history_email 
ON public.driver_login_history(email, attempted_at DESC);

CREATE INDEX IF NOT EXISTS idx_driver_login_history_ip 
ON public.driver_login_history(ip_address, attempted_at DESC);

-- ===========================================================================
-- FUNCTION: Update driver login stats
-- ===========================================================================
CREATE OR REPLACE FUNCTION update_driver_login_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.success = TRUE AND NEW.driver_id IS NOT NULL THEN
        UPDATE public.drivers 
        SET 
            portal_last_login = NOW(),
            portal_login_count = COALESCE(portal_login_count, 0) + 1
        WHERE id = NEW.driver_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_driver_login_stats ON public.driver_login_history;
CREATE TRIGGER trigger_driver_login_stats
    AFTER INSERT ON public.driver_login_history
    FOR EACH ROW
    EXECUTE FUNCTION update_driver_login_stats();

-- ===========================================================================
-- FUNCTION: End old sessions on new login
-- ===========================================================================
CREATE OR REPLACE FUNCTION end_old_driver_sessions()
RETURNS TRIGGER AS $$
BEGIN
    -- End any existing active sessions for this driver
    UPDATE public.driver_sessions 
    SET 
        is_active = FALSE,
        ended_at = NOW(),
        end_reason = 'new_login'
    WHERE driver_id = NEW.driver_id 
      AND is_active = TRUE 
      AND id != NEW.id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_end_old_sessions ON public.driver_sessions;
CREATE TRIGGER trigger_end_old_sessions
    AFTER INSERT ON public.driver_sessions
    FOR EACH ROW
    EXECUTE FUNCTION end_old_driver_sessions();

-- ===========================================================================
-- CLEANUP: Delete sessions older than 30 days
-- (Run this periodically via pg_cron or scheduled function)
-- ===========================================================================
-- DELETE FROM public.driver_sessions 
-- WHERE is_active = FALSE AND ended_at < NOW() - INTERVAL '30 days';

-- DELETE FROM public.driver_login_history 
-- WHERE attempted_at < NOW() - INTERVAL '90 days';
