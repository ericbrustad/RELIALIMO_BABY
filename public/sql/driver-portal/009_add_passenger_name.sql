-- ============================================================================
-- 009: ADD PASSENGER_NAME TO RESERVATIONS
-- Adds the passenger_name column that the app expects but doesn't exist
-- ============================================================================

-- Add passenger_name column to reservations table
ALTER TABLE public.reservations 
ADD COLUMN IF NOT EXISTS passenger_name TEXT;

-- Add index for searching by passenger name
CREATE INDEX IF NOT EXISTS idx_reservations_passenger_name 
ON public.reservations(passenger_name);

-- Also add other commonly expected columns if they don't exist
ALTER TABLE public.reservations 
ADD COLUMN IF NOT EXISTS pu_address TEXT;

ALTER TABLE public.reservations 
ADD COLUMN IF NOT EXISTS do_address TEXT;

ALTER TABLE public.reservations 
ADD COLUMN IF NOT EXISTS vehicle_type TEXT;

ALTER TABLE public.reservations 
ADD COLUMN IF NOT EXISTS driver_status TEXT;

ALTER TABLE public.reservations 
ADD COLUMN IF NOT EXISTS grand_total NUMERIC(10,2);

ALTER TABLE public.reservations 
ADD COLUMN IF NOT EXISTS payment_type TEXT;

ALTER TABLE public.reservations 
ADD COLUMN IF NOT EXISTS special_instructions TEXT;

ALTER TABLE public.reservations 
ADD COLUMN IF NOT EXISTS pickup_datetime TIMESTAMPTZ;

-- Comment
COMMENT ON COLUMN public.reservations.passenger_name IS 'Full name of the passenger';
COMMENT ON COLUMN public.reservations.pu_address IS 'Pickup address';
COMMENT ON COLUMN public.reservations.do_address IS 'Drop-off address';
COMMENT ON COLUMN public.reservations.driver_status IS 'Driver-side status: pending, enroute, arrived, in_progress, completed';
