-- ============================================
-- Fix Fleet & Driver Sync - Comprehensive Migration
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- PART 1: Fix fleet_vehicles status constraint
-- ============================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fleet_vehicles_status_check'
          AND conrelid = 'public.fleet_vehicles'::regclass
    ) THEN
        ALTER TABLE public.fleet_vehicles DROP CONSTRAINT fleet_vehicles_status_check;
        RAISE NOTICE 'Dropped existing fleet_vehicles_status_check constraint';
    END IF;
END $$;

ALTER TABLE public.fleet_vehicles
    ADD CONSTRAINT fleet_vehicles_status_check
    CHECK (status IN (
        'ACTIVE', 'AVAILABLE', 'IN_USE', 'MAINTENANCE', 
        'OUT_OF_SERVICE', 'INACTIVE', 'RETIRED',
        'active', 'available', 'in_use', 'maintenance',
        'out_of_service', 'inactive', 'retired'
    ));

ALTER TABLE public.fleet_vehicles 
    ALTER COLUMN status SET DEFAULT 'ACTIVE';

-- ============================================
-- PART 2: Ensure assigned_vehicle_id exists on drivers
-- ============================================

-- First, drop any old FK that might reference the wrong table (vehicles instead of fleet_vehicles)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'drivers_assigned_vehicle_id_fkey'
        AND table_name = 'drivers'
    ) THEN
        ALTER TABLE public.drivers DROP CONSTRAINT drivers_assigned_vehicle_id_fkey;
        RAISE NOTICE 'Dropped old drivers_assigned_vehicle_id_fkey constraint';
    END IF;
END $$;

-- Add the column if it doesn't exist
ALTER TABLE public.drivers 
ADD COLUMN IF NOT EXISTS assigned_vehicle_id UUID;

-- Add the correct FK to fleet_vehicles
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'drivers_fleet_vehicle_fkey'
        AND table_name = 'drivers'
    ) THEN
        ALTER TABLE public.drivers 
        ADD CONSTRAINT drivers_fleet_vehicle_fkey 
        FOREIGN KEY (assigned_vehicle_id) 
        REFERENCES public.fleet_vehicles(id) 
        ON DELETE SET NULL;
        RAISE NOTICE 'Added drivers_fleet_vehicle_fkey constraint';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Could not add FK - fleet_vehicles table may need more setup: %', SQLERRM;
END $$;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_drivers_assigned_vehicle ON public.drivers(assigned_vehicle_id);

-- ============================================
-- PART 3: RLS Policies for fleet_vehicles
-- ============================================

-- Enable RLS on fleet_vehicles
ALTER TABLE public.fleet_vehicles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them cleanly
DROP POLICY IF EXISTS "fleet_vehicles_select_policy" ON public.fleet_vehicles;
DROP POLICY IF EXISTS "fleet_vehicles_insert_policy" ON public.fleet_vehicles;
DROP POLICY IF EXISTS "fleet_vehicles_update_policy" ON public.fleet_vehicles;
DROP POLICY IF EXISTS "fleet_vehicles_delete_policy" ON public.fleet_vehicles;

-- Allow authenticated users full access
CREATE POLICY "fleet_vehicles_select_policy" ON public.fleet_vehicles
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "fleet_vehicles_insert_policy" ON public.fleet_vehicles
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "fleet_vehicles_update_policy" ON public.fleet_vehicles
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "fleet_vehicles_delete_policy" ON public.fleet_vehicles
    FOR DELETE TO authenticated USING (true);

-- ============================================
-- PART 4: RLS Policy for drivers update (assigned_vehicle_id)
-- ============================================

-- Ensure we can update drivers
DROP POLICY IF EXISTS "drivers_update_vehicle_policy" ON public.drivers;

-- Allow authenticated users to update driver's assigned_vehicle_id
CREATE POLICY "drivers_update_vehicle_policy" ON public.drivers
    FOR UPDATE TO authenticated
    USING (true)
    WITH CHECK (true);

-- ============================================
-- PART 5: Verify setup
-- ============================================

-- Show the columns on drivers related to vehicles
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'drivers' 
AND column_name IN ('assigned_vehicle_id', 'id', 'first_name', 'last_name');

-- Show RLS policies on fleet_vehicles
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'fleet_vehicles';

-- Show RLS policies on drivers
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'drivers';

DO $$
BEGIN
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Fleet & Driver Sync Migration Complete!';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Changes applied:';
    RAISE NOTICE '1. fleet_vehicles status constraint now accepts UI values';
    RAISE NOTICE '2. drivers.assigned_vehicle_id column ensured';
    RAISE NOTICE '3. FK from drivers to fleet_vehicles added';
    RAISE NOTICE '4. RLS policies for fleet_vehicles CRUD';
    RAISE NOTICE '5. RLS policy for drivers update';
    RAISE NOTICE '============================================';
END $$;
