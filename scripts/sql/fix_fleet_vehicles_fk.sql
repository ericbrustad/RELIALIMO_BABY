-- ============================================
-- FIX: Drop created_by/updated_by foreign key constraints
-- ============================================
-- These constraints reference auth.users which doesn't exist for
-- anonymous driver signups. Drop them to allow null values.
-- ============================================

ALTER TABLE public.fleet_vehicles DROP CONSTRAINT IF EXISTS fleet_vehicles_created_by_fkey;
ALTER TABLE public.fleet_vehicles DROP CONSTRAINT IF EXISTS fleet_vehicles_updated_by_fkey;

-- Verify the constraints are gone
SELECT conname FROM pg_constraint WHERE conrelid = 'public.fleet_vehicles'::regclass;
