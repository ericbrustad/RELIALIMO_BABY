-- ============================================================================
-- ADD INSURANCE FIELDS TO FLEET_VEHICLES AND RENAME VEHICLES TO ECONOMY_VEHICLES
-- Run this in Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- PART 1: ADD INSURANCE FIELDS TO FLEET_VEHICLES
-- ============================================================================

-- Add insurance company name
ALTER TABLE public.fleet_vehicles 
ADD COLUMN IF NOT EXISTS insurance_company TEXT;

-- Add insurance policy number
ALTER TABLE public.fleet_vehicles 
ADD COLUMN IF NOT EXISTS insurance_policy_number TEXT;

-- Add index for insurance lookups
CREATE INDEX IF NOT EXISTS idx_fleet_vehicles_insurance ON public.fleet_vehicles(insurance_company);

COMMENT ON COLUMN public.fleet_vehicles.insurance_company IS 'Name of the vehicle insurance company';
COMMENT ON COLUMN public.fleet_vehicles.insurance_policy_number IS 'Insurance policy number';

-- ============================================================================
-- PART 2: RENAME VEHICLES TABLE TO ECONOMY_VEHICLES
-- This is for legacy/non-fleet vehicles used in economy pricing
-- ============================================================================

-- Rename the table
ALTER TABLE IF EXISTS public.vehicles RENAME TO economy_vehicles;

-- Update any foreign key constraints (if any reference vehicles)
-- Note: This will fail if there are FKs - you may need to drop/recreate them

-- Add insurance fields to economy_vehicles as well
ALTER TABLE public.economy_vehicles 
ADD COLUMN IF NOT EXISTS insurance_company TEXT;

ALTER TABLE public.economy_vehicles 
ADD COLUMN IF NOT EXISTS insurance_policy_number TEXT;

-- ============================================================================
-- OPTIONAL: Update any views or functions that reference 'vehicles'
-- ============================================================================

-- If you have views referencing 'vehicles', you'll need to recreate them
-- Example:
-- DROP VIEW IF EXISTS public.vehicle_summary;
-- CREATE VIEW public.vehicle_summary AS SELECT * FROM public.economy_vehicles;

-- ============================================================================
-- VERIFICATION QUERY
-- ============================================================================

-- Run this after to verify:
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name IN ('fleet_vehicles', 'economy_vehicles') 
-- AND column_name IN ('insurance_company', 'insurance_policy_number')
-- ORDER BY table_name, column_name;
