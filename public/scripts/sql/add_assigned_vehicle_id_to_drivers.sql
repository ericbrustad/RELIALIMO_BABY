-- ============================================
-- FIX: Add missing assigned_vehicle_id column to drivers table
-- ============================================
-- This column is needed to link drivers to their assigned fleet vehicles
-- ============================================

-- Step 1: Add assigned_vehicle_id column to drivers table
ALTER TABLE public.drivers 
ADD COLUMN IF NOT EXISTS assigned_vehicle_id UUID REFERENCES public.fleet_vehicles(id);

-- Step 2: Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_drivers_assigned_vehicle ON public.drivers(assigned_vehicle_id);

-- Step 3: Verify the column was added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'drivers' 
AND column_name = 'assigned_vehicle_id';

-- ============================================
-- DONE! Run this in Supabase SQL Editor.
-- ============================================
