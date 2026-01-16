-- Fix registration issues: add missing columns and clean up test data
-- Run this in Supabase SQL Editor

-- 1. Add ALL missing columns to fleet_vehicles for driver registration
-- Core fields
ALTER TABLE public.fleet_vehicles ADD COLUMN IF NOT EXISTS color TEXT;
ALTER TABLE public.fleet_vehicles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.fleet_vehicles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'AVAILABLE';
ALTER TABLE public.fleet_vehicles ADD COLUMN IF NOT EXISTS passenger_capacity INTEGER;

-- Permit & DOT fields
ALTER TABLE public.fleet_vehicles ADD COLUMN IF NOT EXISTS limo_permit_number TEXT;
ALTER TABLE public.fleet_vehicles ADD COLUMN IF NOT EXISTS permit_expiration_month INTEGER;
ALTER TABLE public.fleet_vehicles ADD COLUMN IF NOT EXISTS permit_expiration_year INTEGER;
ALTER TABLE public.fleet_vehicles ADD COLUMN IF NOT EXISTS us_dot_number TEXT;

-- Insurance fields
ALTER TABLE public.fleet_vehicles ADD COLUMN IF NOT EXISTS insurance_company TEXT;
ALTER TABLE public.fleet_vehicles ADD COLUMN IF NOT EXISTS insurance_policy_number TEXT;

-- 2. Clean up test data (orphan records from failed registrations)
-- Delete all fleet_vehicles (test data)
DELETE FROM public.fleet_vehicles;

-- Delete all drivers (test data)
DELETE FROM public.drivers;

-- (Optional) Delete test affiliates created during registration testing
-- Uncomment if you want to clean these too:
-- DELETE FROM public.affiliates WHERE company_name LIKE '%Test%';

-- 3. Verify cleanup
SELECT 'Drivers remaining:' as check, COUNT(*) as count FROM public.drivers
UNION ALL
SELECT 'Vehicles remaining:' as check, COUNT(*) as count FROM public.fleet_vehicles;
