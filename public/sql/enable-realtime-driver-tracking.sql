-- ============================================
-- SUPABASE SQL: Enable Real-Time Driver Tracking
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Enable Realtime on the drivers table
-- This allows the app to receive instant updates when driver locations change
ALTER PUBLICATION supabase_realtime ADD TABLE drivers;

-- 2. Create a function for drivers to update their location
-- This is called from the driver portal/app when GPS coordinates change
CREATE OR REPLACE FUNCTION update_driver_location(
  p_driver_id UUID,
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_status TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  UPDATE drivers
  SET 
    last_known_lat = p_lat,
    last_known_lng = p_lng,
    last_location_update = NOW(),
    is_online = TRUE,
    driver_status = COALESCE(p_status, driver_status)
  WHERE id = p_driver_id;
  
  SELECT json_build_object(
    'success', true,
    'driver_id', p_driver_id,
    'lat', p_lat,
    'lng', p_lng,
    'updated_at', NOW()
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;

-- 3. Create a function to set driver offline after inactivity
-- This can be called by a scheduled job or trigger
CREATE OR REPLACE FUNCTION set_inactive_drivers_offline()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE drivers
  SET is_online = FALSE
  WHERE is_online = TRUE
    AND last_location_update < NOW() - INTERVAL '5 minutes';
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- 4. Create index for faster location queries
CREATE INDEX IF NOT EXISTS idx_drivers_location 
ON drivers (last_known_lat, last_known_lng) 
WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_drivers_online 
ON drivers (is_online, driver_status) 
WHERE is_active = TRUE;

-- 5. Grant execute permissions (for anon/authenticated users)
GRANT EXECUTE ON FUNCTION update_driver_location TO authenticated;
GRANT EXECUTE ON FUNCTION set_inactive_drivers_offline TO service_role;

-- 6. (Optional) Create a cron job to mark inactive drivers offline
-- Requires pg_cron extension - run every minute
-- SELECT cron.schedule('mark-drivers-offline', '* * * * *', 'SELECT set_inactive_drivers_offline()');

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check if realtime is enabled
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';

-- View drivers with GPS data
SELECT id, first_name, last_name, last_known_lat, last_known_lng, 
       last_location_update, is_online, driver_status
FROM drivers 
WHERE last_known_lat IS NOT NULL 
ORDER BY last_location_update DESC;
