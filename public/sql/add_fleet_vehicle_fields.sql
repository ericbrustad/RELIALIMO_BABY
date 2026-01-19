-- ============================================================================
-- ADD: Missing columns to fleet_vehicles table
-- ============================================================================
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Add insurance expiration date
ALTER TABLE public.fleet_vehicles 
ADD COLUMN IF NOT EXISTS insurance_expiration DATE;

-- Add insurance expiration month/year (like permit expiration)
ALTER TABLE public.fleet_vehicles 
ADD COLUMN IF NOT EXISTS insurance_expiration_month INTEGER;

ALTER TABLE public.fleet_vehicles 
ADD COLUMN IF NOT EXISTS insurance_expiration_year INTEGER;

-- Add insurance contact
ALTER TABLE public.fleet_vehicles 
ADD COLUMN IF NOT EXISTS insurance_contact TEXT;

-- Add registration expiration
ALTER TABLE public.fleet_vehicles 
ADD COLUMN IF NOT EXISTS registration_expiration DATE;

-- Add mileage tracking
ALTER TABLE public.fleet_vehicles 
ADD COLUMN IF NOT EXISTS mileage INTEGER;

ALTER TABLE public.fleet_vehicles 
ADD COLUMN IF NOT EXISTS next_service_miles INTEGER;

-- Add service dates
ALTER TABLE public.fleet_vehicles 
ADD COLUMN IF NOT EXISTS last_service_date DATE;

ALTER TABLE public.fleet_vehicles 
ADD COLUMN IF NOT EXISTS next_service_date DATE;

-- Add service notes
ALTER TABLE public.fleet_vehicles 
ADD COLUMN IF NOT EXISTS service_notes TEXT;

-- Add internal notes
ALTER TABLE public.fleet_vehicles 
ADD COLUMN IF NOT EXISTS internal_notes TEXT;

-- Add garaged location
ALTER TABLE public.fleet_vehicles 
ADD COLUMN IF NOT EXISTS garaged_location TEXT;

-- Add features array
ALTER TABLE public.fleet_vehicles 
ADD COLUMN IF NOT EXISTS features TEXT[];

-- Verify columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'fleet_vehicles' 
ORDER BY ordinal_position;
