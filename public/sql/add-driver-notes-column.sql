-- Add driver_notes column to reservations table
-- This column stores notes from the driver about the trip

-- Add the column if it doesn't exist
ALTER TABLE public.reservations 
ADD COLUMN IF NOT EXISTS driver_notes TEXT;

-- Add comment
COMMENT ON COLUMN public.reservations.driver_notes IS 'Notes entered by the driver after completing a trip';

-- Also add other commonly needed driver-related columns if missing
ALTER TABLE public.reservations 
ADD COLUMN IF NOT EXISTS driver_tip DECIMAL(10,2);

ALTER TABLE public.reservations 
ADD COLUMN IF NOT EXISTS driver_tolls DECIMAL(10,2);

ALTER TABLE public.reservations 
ADD COLUMN IF NOT EXISTS driver_parking DECIMAL(10,2);

ALTER TABLE public.reservations 
ADD COLUMN IF NOT EXISTS driver_extras DECIMAL(10,2);

ALTER TABLE public.reservations 
ADD COLUMN IF NOT EXISTS driver_extra_stops INTEGER;

COMMENT ON COLUMN public.reservations.driver_tip IS 'Tip received by driver for this trip';
COMMENT ON COLUMN public.reservations.driver_tolls IS 'Toll expenses for this trip';
COMMENT ON COLUMN public.reservations.driver_parking IS 'Parking expenses for this trip';
COMMENT ON COLUMN public.reservations.driver_extras IS 'Other extra charges for this trip';
COMMENT ON COLUMN public.reservations.driver_extra_stops IS 'Number of extra stops made during the trip';
