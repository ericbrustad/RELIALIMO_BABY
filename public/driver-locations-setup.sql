-- ============================================
-- Driver Locations Table Setup
-- For Live GPS Tracking
-- Run this in Supabase SQL Editor
-- ============================================

-- Drop existing objects first (clean slate)
DROP TRIGGER IF EXISTS trigger_location_history ON driver_locations;
DROP TRIGGER IF EXISTS trigger_set_location_org ON driver_locations;
DROP FUNCTION IF EXISTS log_location_to_history();
DROP FUNCTION IF EXISTS set_location_org_from_driver();
DROP TABLE IF EXISTS driver_location_history;
DROP TABLE IF EXISTS driver_locations;

-- Create driver_locations table for real-time GPS tracking
CREATE TABLE driver_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  latitude DECIMAL(10,7) NOT NULL,
  longitude DECIMAL(10,7) NOT NULL,
  heading DECIMAL(5,2),
  speed DECIMAL(6,2),
  accuracy DECIMAL(6,2),
  altitude DECIMAL(8,2),
  is_moving BOOLEAN DEFAULT false,
  battery_level INTEGER,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(driver_id)
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_driver_locations_driver ON driver_locations(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_locations_updated ON driver_locations(updated_at DESC);

-- Enable RLS
ALTER TABLE driver_locations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view driver locations" ON driver_locations;
DROP POLICY IF EXISTS "Users can update driver locations" ON driver_locations;
DROP POLICY IF EXISTS "Drivers can update own location" ON driver_locations;
DROP POLICY IF EXISTS "Anyone can insert driver locations" ON driver_locations;
DROP POLICY IF EXISTS "All users can view driver locations" ON driver_locations;
DROP POLICY IF EXISTS "All users can manage driver locations" ON driver_locations;

-- Simple policy: authenticated users can view all locations
CREATE POLICY "All users can view driver locations"
ON driver_locations FOR SELECT
TO authenticated
USING (true);

-- Simple policy: authenticated users can insert/update locations
CREATE POLICY "All users can manage driver locations"
ON driver_locations FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- ============================================
-- Create location history table (optional, for tracking routes)
-- ============================================
CREATE TABLE IF NOT EXISTS driver_location_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  latitude DECIMAL(10,7) NOT NULL,
  longitude DECIMAL(10,7) NOT NULL,
  heading DECIMAL(5,2),
  speed DECIMAL(6,2),
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_driver_loc_history_driver ON driver_location_history(driver_id, recorded_at DESC);

-- Enable RLS on history
ALTER TABLE driver_location_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view location history" ON driver_location_history;
DROP POLICY IF EXISTS "All users can view location history" ON driver_location_history;

CREATE POLICY "All users can view location history"
ON driver_location_history FOR SELECT
TO authenticated
USING (true);

-- ============================================
-- TRIGGER: Log location changes to history
-- ============================================
CREATE OR REPLACE FUNCTION log_location_to_history()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if driver is moving and position changed
  IF NEW.is_moving = true THEN
    INSERT INTO driver_location_history (
      driver_id, latitude, longitude, heading, speed
    ) VALUES (
      NEW.driver_id, NEW.latitude, NEW.longitude, NEW.heading, NEW.speed
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_location_history ON driver_locations;
CREATE TRIGGER trigger_location_history
  AFTER INSERT OR UPDATE ON driver_locations
  FOR EACH ROW
  EXECUTE FUNCTION log_location_to_history();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON driver_locations TO authenticated;
GRANT SELECT ON driver_location_history TO authenticated;

COMMENT ON TABLE driver_locations IS 'Real-time GPS locations for drivers';
COMMENT ON TABLE driver_location_history IS 'Historical GPS breadcrumb trail for route tracking';
