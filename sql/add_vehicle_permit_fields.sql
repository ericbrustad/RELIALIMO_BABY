-- ============================================================================
-- ADD LIMO PERMIT & DOT FIELDS TO VEHICLES/FLEET_VEHICLES TABLES
-- Run this in Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- FLEET_VEHICLES TABLE (primary table for driver portal)
-- ============================================================================

-- Add limo permit number
ALTER TABLE public.fleet_vehicles 
ADD COLUMN IF NOT EXISTS limo_permit_number TEXT;

-- Add permit expiration (month and year separately for easier display)
ALTER TABLE public.fleet_vehicles 
ADD COLUMN IF NOT EXISTS permit_expiration_month INTEGER CHECK (permit_expiration_month >= 1 AND permit_expiration_month <= 12);

ALTER TABLE public.fleet_vehicles 
ADD COLUMN IF NOT EXISTS permit_expiration_year INTEGER CHECK (permit_expiration_year >= 2020 AND permit_expiration_year <= 2100);

-- Add US DOT number
ALTER TABLE public.fleet_vehicles 
ADD COLUMN IF NOT EXISTS us_dot_number TEXT;

-- Add indexes for common lookups
CREATE INDEX IF NOT EXISTS idx_fleet_vehicles_permit ON public.fleet_vehicles(limo_permit_number);
CREATE INDEX IF NOT EXISTS idx_fleet_vehicles_dot ON public.fleet_vehicles(us_dot_number);

-- ============================================================================
-- VEHICLES TABLE (legacy/backup - also add for consistency)
-- ============================================================================

-- Add limo permit number
ALTER TABLE public.vehicles 
ADD COLUMN IF NOT EXISTS limo_permit_number TEXT;

-- Add permit expiration (month and year separately for easier display)
ALTER TABLE public.vehicles 
ADD COLUMN IF NOT EXISTS permit_expiration_month INTEGER CHECK (permit_expiration_month >= 1 AND permit_expiration_month <= 12);

ALTER TABLE public.vehicles 
ADD COLUMN IF NOT EXISTS permit_expiration_year INTEGER CHECK (permit_expiration_year >= 2020 AND permit_expiration_year <= 2100);

-- Add US DOT number
ALTER TABLE public.vehicles 
ADD COLUMN IF NOT EXISTS us_dot_number TEXT;

-- Add indexes for common lookups
CREATE INDEX IF NOT EXISTS idx_vehicles_permit ON public.vehicles(limo_permit_number);
CREATE INDEX IF NOT EXISTS idx_vehicles_dot ON public.vehicles(us_dot_number);

-- ============================================================================
-- OPTIONAL: Add driver location tracking fields
-- ============================================================================

-- Add location tracking columns to drivers (for location permission feature)
ALTER TABLE public.drivers 
ADD COLUMN IF NOT EXISTS location_enabled BOOLEAN DEFAULT false;

ALTER TABLE public.drivers 
ADD COLUMN IF NOT EXISTS last_known_lat DECIMAL(10, 8);

ALTER TABLE public.drivers 
ADD COLUMN IF NOT EXISTS last_known_lng DECIMAL(11, 8);

ALTER TABLE public.drivers 
ADD COLUMN IF NOT EXISTS last_location_update TIMESTAMPTZ;

-- ============================================================================
-- VERIFY
-- ============================================================================
SELECT 'Fleet vehicles columns added:' AS info;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'fleet_vehicles' 
AND column_name IN ('limo_permit_number', 'permit_expiration_month', 'permit_expiration_year', 'us_dot_number')
ORDER BY column_name;

SELECT 'Vehicles columns added:' AS info;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'vehicles' 
AND column_name IN ('limo_permit_number', 'permit_expiration_month', 'permit_expiration_year', 'us_dot_number')
ORDER BY column_name;

SELECT 'Drivers location columns added:' AS info;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'drivers' 
AND column_name IN ('location_enabled', 'last_known_lat', 'last_known_lng', 'last_location_update')
ORDER BY column_name;
