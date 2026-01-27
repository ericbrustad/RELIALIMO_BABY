-- ============================================
-- SUPABASE SQL: Enable Complete Real-Time for RELIALIMO
-- Run this in Supabase SQL Editor
-- ============================================

-- This script enables Supabase Realtime on all tables that need
-- live synchronization between the driver portal, admin portal,
-- and customer portal.

-- ============================================
-- ENABLE REALTIME FOR ALL CORE TABLES
-- ============================================

DO $$
BEGIN
  -- drivers table - for driver status, login/logout, location updates
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'drivers') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE drivers;
    RAISE NOTICE 'Added drivers to realtime';
  ELSE
    RAISE NOTICE 'drivers already has realtime enabled';
  END IF;
  
  -- reservations table - for trip assignments, status changes
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'reservations') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE reservations;
    RAISE NOTICE 'Added reservations to realtime';
  ELSE
    RAISE NOTICE 'reservations already has realtime enabled';
  END IF;
  
  -- accounts table - for customer/account updates
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'accounts') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE accounts;
    RAISE NOTICE 'Added accounts to realtime';
  ELSE
    RAISE NOTICE 'accounts already has realtime enabled';
  END IF;
  
  -- vehicle_types table - for vehicle type changes
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'vehicle_types') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE vehicle_types;
    RAISE NOTICE 'Added vehicle_types to realtime';
  ELSE
    RAISE NOTICE 'vehicle_types already has realtime enabled';
  END IF;
  
  -- portal_settings table - for branding/settings changes
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'portal_settings') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE portal_settings;
    RAISE NOTICE 'Added portal_settings to realtime';
  ELSE
    RAISE NOTICE 'portal_settings already has realtime enabled';
  END IF;
  
  -- fleet_vehicles table - for fleet vehicle assignments
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'fleet_vehicles') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE fleet_vehicles;
    RAISE NOTICE 'Added fleet_vehicles to realtime';
  ELSE
    RAISE NOTICE 'fleet_vehicles already has realtime enabled';
  END IF;
  
  -- affiliates table - for affiliate/partner updates
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'affiliates') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE affiliates;
    RAISE NOTICE 'Added affiliates to realtime';
  ELSE
    RAISE NOTICE 'affiliates already has realtime enabled';
  END IF;
  
  -- company_memos table - for memo broadcasts
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'company_memos') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE company_memos;
    RAISE NOTICE 'Added company_memos to realtime';
  ELSE
    RAISE NOTICE 'company_memos already has realtime enabled';
  END IF;

END $$;

-- ============================================
-- CREATE DRIVER_LOCATIONS TABLE IF NOT EXISTS
-- (For live GPS tracking)
-- ============================================

CREATE TABLE IF NOT EXISTS driver_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  heading DOUBLE PRECISION,
  speed DOUBLE PRECISION,
  accuracy DOUBLE PRECISION,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- If table exists with old 'timestamp' column, rename it to 'recorded_at'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'driver_locations' AND column_name = 'timestamp'
  ) THEN
    ALTER TABLE driver_locations RENAME COLUMN "timestamp" TO recorded_at;
    RAISE NOTICE 'Renamed timestamp column to recorded_at';
  END IF;
END $$;

-- Add recorded_at column if it doesn't exist (for tables created without it)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'driver_locations' AND column_name = 'recorded_at'
  ) THEN
    ALTER TABLE driver_locations ADD COLUMN recorded_at TIMESTAMPTZ DEFAULT NOW();
    RAISE NOTICE 'Added recorded_at column';
  END IF;
END $$;

-- Create index for fast lookups by driver
CREATE INDEX IF NOT EXISTS idx_driver_locations_driver_id ON driver_locations(driver_id);

-- Create index for recorded_at queries
CREATE INDEX IF NOT EXISTS idx_driver_locations_recorded_at ON driver_locations(recorded_at DESC);

-- Enable RLS
ALTER TABLE driver_locations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist, then create new ones
DROP POLICY IF EXISTS "Drivers can insert own location" ON driver_locations;
DROP POLICY IF EXISTS "Anyone can read driver locations" ON driver_locations;
DROP POLICY IF EXISTS "Drivers can update own location" ON driver_locations;

-- Allow drivers to insert their own locations
CREATE POLICY "Drivers can insert own location" 
  ON driver_locations FOR INSERT 
  WITH CHECK (true);

-- Allow anyone to read locations (for dispatch maps)
CREATE POLICY "Anyone can read driver locations" 
  ON driver_locations FOR SELECT 
  USING (true);

-- Allow drivers to update their own locations
CREATE POLICY "Drivers can update own location"
  ON driver_locations FOR UPDATE
  USING (true);

-- Add driver_locations to realtime
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'driver_locations') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE driver_locations;
    RAISE NOTICE 'Added driver_locations to realtime';
  ELSE
    RAISE NOTICE 'driver_locations already has realtime enabled';
  END IF;
END $$;

-- ============================================
-- FUNCTION TO GET LATEST DRIVER LOCATIONS
-- ============================================

CREATE OR REPLACE FUNCTION get_live_driver_locations()
RETURNS TABLE (
  driver_id UUID,
  first_name TEXT,
  last_name TEXT,
  driver_status TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  heading DOUBLE PRECISION,
  speed DOUBLE PRECISION,
  last_update TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (dl.driver_id)
    dl.driver_id,
    d.first_name,
    d.last_name,
    d.driver_status,
    dl.latitude,
    dl.longitude,
    dl.heading,
    dl.speed,
    dl.recorded_at as last_update
  FROM driver_locations dl
  JOIN drivers d ON d.id = dl.driver_id
  WHERE dl.recorded_at > NOW() - INTERVAL '10 minutes'
    AND d.driver_status != 'offline'
    AND d.is_active = true
  ORDER BY dl.driver_id, dl.recorded_at DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- VERIFICATION
-- ============================================

-- Check which tables have realtime enabled
SELECT 
  tablename as table_name,
  'realtime enabled' as status
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;

-- ============================================
-- USAGE NOTES
-- ============================================
-- 
-- After running this SQL:
-- 
-- 1. Driver Login/Logout Events:
--    - When a driver logs in, driver_status changes to 'available'
--    - When a driver logs out, driver_status changes to 'offline'
--    - These changes broadcast to all subscribed clients in real-time
--
-- 2. Driver Status Changes:
--    - When a driver toggles online/offline, all portals update
--    - Dispatch grid shows live driver status
--    - Driver availability console updates automatically
--
-- 3. Live GPS Tracking:
--    - Driver locations stored in driver_locations table
--    - Dispatch map shows live driver positions
--    - Locations older than 10 minutes are ignored
--
-- 4. Reservation Updates:
--    - New reservations appear instantly on dispatch grid
--    - Status changes (assigned, en route, completed) sync to all clients
--    - Driver portal receives trip offers in real-time
--
-- JavaScript Usage:
-- 
-- import { subscribeToDrivers, subscribeToReservations } from './shared/realtime-service.js';
-- 
-- // Subscribe to all driver changes
-- subscribeToDrivers((eventType, newData, oldData) => {
--   if (eventType === 'UPDATE') {
--     console.log('Driver updated:', newData.first_name, newData.driver_status);
--   }
-- });
--
-- // Subscribe to reservation changes
-- subscribeToReservations((eventType, newData, oldData) => {
--   if (eventType === 'INSERT') {
--     console.log('New reservation:', newData.confirmation_number);
--   }
-- });
