-- ============================================
-- ADD DRIVER STATUS COLUMNS TO RESERVATIONS
-- Run this in Supabase SQL Editor
-- https://supabase.com/dashboard/project/siumiadylwcrkaqsfwkj/sql
-- ============================================

-- Driver status for tracking trip progress
ALTER TABLE public.reservations 
ADD COLUMN IF NOT EXISTS driver_status TEXT;

COMMENT ON COLUMN reservations.driver_status IS 'Driver workflow status: enroute, arrived, waiting_at_pickup, passenger_onboard, done';

-- Timestamp for when driver departed
ALTER TABLE public.reservations 
ADD COLUMN IF NOT EXISTS departed_at TIMESTAMPTZ;

COMMENT ON COLUMN reservations.departed_at IS 'When driver started heading to pickup';

-- Timestamp for when driver arrived at pickup
ALTER TABLE public.reservations 
ADD COLUMN IF NOT EXISTS arrived_at TIMESTAMPTZ;

COMMENT ON COLUMN reservations.arrived_at IS 'When driver arrived at pickup location';

-- Timestamp for when passenger was picked up
ALTER TABLE public.reservations 
ADD COLUMN IF NOT EXISTS picked_up_at TIMESTAMPTZ;

COMMENT ON COLUMN reservations.picked_up_at IS 'When passenger got in the vehicle';

-- Timestamp for when trip was completed
ALTER TABLE public.reservations 
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

COMMENT ON COLUMN reservations.completed_at IS 'When trip was completed';

-- Create index for faster driver status queries
CREATE INDEX IF NOT EXISTS idx_reservations_driver_status 
ON public.reservations(driver_status) 
WHERE driver_status IS NOT NULL;

-- Verify columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'reservations' 
AND column_name IN ('driver_status', 'departed_at', 'arrived_at', 'picked_up_at', 'completed_at')
ORDER BY column_name;
