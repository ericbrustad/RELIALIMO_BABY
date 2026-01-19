-- Add form_snapshot column to reservations table
-- Run this in your Supabase SQL Editor
-- URL: https://supabase.com/dashboard/project/siumiadylwcrkaqsfwkj/sql

-- Add form_snapshot column to store complete reservation form data
-- This allows storing driver, fleet vehicle, service type, and all other form fields
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS form_snapshot jsonb;

-- Add fleet_vehicle_id column for direct fleet vehicle reference
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS fleet_vehicle_id uuid;

-- Add service_type column for explicit service type storage  
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS service_type text;

-- Add farm_option column to track in-house vs farm-out
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS farm_option text DEFAULT 'in-house';

-- Add a comment explaining the form_snapshot column
COMMENT ON COLUMN reservations.form_snapshot IS 'Complete form data snapshot for restoring all UI fields including driver, fleet vehicle, service type, costs, etc.';

COMMENT ON COLUMN reservations.farm_option IS 'Reservation type: in-house (own drivers) or farm-out (external drivers)';

-- Verify the columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'reservations' 
  AND column_name IN ('form_snapshot', 'fleet_vehicle_id', 'service_type', 'farm_option')
ORDER BY column_name;
