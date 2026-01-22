-- ============================================
-- Fleet Vehicles RLS Policies
-- Allow authenticated users to manage fleet vehicles
-- ============================================

-- Enable RLS on fleet_vehicles if not already enabled
ALTER TABLE fleet_vehicles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them cleanly
DROP POLICY IF EXISTS "Allow authenticated users to view fleet vehicles" ON fleet_vehicles;
DROP POLICY IF EXISTS "Allow authenticated users to insert fleet vehicles" ON fleet_vehicles;
DROP POLICY IF EXISTS "Allow authenticated users to update fleet vehicles" ON fleet_vehicles;
DROP POLICY IF EXISTS "Allow authenticated users to delete fleet vehicles" ON fleet_vehicles;

-- SELECT policy - authenticated users can view all fleet vehicles
CREATE POLICY "Allow authenticated users to view fleet vehicles"
ON fleet_vehicles FOR SELECT
TO authenticated
USING (true);

-- INSERT policy - authenticated users can create fleet vehicles
CREATE POLICY "Allow authenticated users to insert fleet vehicles"
ON fleet_vehicles FOR INSERT
TO authenticated
WITH CHECK (true);

-- UPDATE policy - authenticated users can update fleet vehicles
CREATE POLICY "Allow authenticated users to update fleet vehicles"
ON fleet_vehicles FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- DELETE policy - authenticated users can delete fleet vehicles
CREATE POLICY "Allow authenticated users to delete fleet vehicles"
ON fleet_vehicles FOR DELETE
TO authenticated
USING (true);

-- Also ensure drivers table has proper RLS policies for updates
-- (needed for assigning vehicles to drivers)
DROP POLICY IF EXISTS "Allow authenticated users to update drivers" ON drivers;
CREATE POLICY "Allow authenticated users to update drivers"
ON drivers FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- ============================================
-- Add missing columns if they don't exist
-- ============================================

-- Add veh_disp_name column for vehicle display name
ALTER TABLE fleet_vehicles 
ADD COLUMN IF NOT EXISTS veh_disp_name TEXT;

-- Add veh_title column for vehicle title
ALTER TABLE fleet_vehicles 
ADD COLUMN IF NOT EXISTS veh_title TEXT;

-- Add passenger_capacity if missing
ALTER TABLE fleet_vehicles 
ADD COLUMN IF NOT EXISTS passenger_capacity INTEGER DEFAULT 4;

-- Verify the table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'fleet_vehicles'
ORDER BY ordinal_position;
