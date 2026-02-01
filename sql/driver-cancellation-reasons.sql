-- ============================================================
-- Driver Trip Cancellation Reasons Table
-- Stores reasons when a driver cancels a trip
-- ============================================================

-- Create the driver_trip_cancellations table
CREATE TABLE IF NOT EXISTS driver_trip_cancellations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id INTEGER NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
    driver_id UUID NOT NULL,
    reason TEXT NOT NULL,
    cancelled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    driver_name TEXT,
    driver_phone TEXT,
    passenger_name TEXT,
    pickup_address TEXT,
    dropoff_address TEXT,
    pickup_datetime TIMESTAMPTZ,
    confirmation_number TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_driver_trip_cancellations_reservation_id 
    ON driver_trip_cancellations(reservation_id);

CREATE INDEX IF NOT EXISTS idx_driver_trip_cancellations_driver_id 
    ON driver_trip_cancellations(driver_id);

CREATE INDEX IF NOT EXISTS idx_driver_trip_cancellations_cancelled_at 
    ON driver_trip_cancellations(cancelled_at DESC);

-- Add RLS policies
ALTER TABLE driver_trip_cancellations ENABLE ROW LEVEL SECURITY;

-- Drivers can insert their own cancellation records
CREATE POLICY "Drivers can insert their own cancellations"
    ON driver_trip_cancellations
    FOR INSERT
    WITH CHECK (auth.uid() = driver_id);

-- Drivers can view their own cancellation records
CREATE POLICY "Drivers can view their own cancellations"
    ON driver_trip_cancellations
    FOR SELECT
    USING (auth.uid() = driver_id);

-- Admin users can view all cancellations (assuming admin role check)
CREATE POLICY "Admins can view all cancellations"
    ON driver_trip_cancellations
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM drivers 
            WHERE drivers.user_id = auth.uid() 
            AND drivers.role = 'admin'
        )
    );

-- Also add a cancellation_reason column to reservations table for easy access
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'reservations' 
        AND column_name = 'cancellation_reason'
    ) THEN
        ALTER TABLE reservations ADD COLUMN cancellation_reason TEXT;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'reservations' 
        AND column_name = 'cancelled_by_driver_id'
    ) THEN
        ALTER TABLE reservations ADD COLUMN cancelled_by_driver_id UUID;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'reservations' 
        AND column_name = 'cancelled_at'
    ) THEN
        ALTER TABLE reservations ADD COLUMN cancelled_at TIMESTAMPTZ;
    END IF;
END $$;

-- Add comment for documentation
COMMENT ON TABLE driver_trip_cancellations IS 
    'Stores detailed records when drivers cancel trips, including the reason provided';
COMMENT ON COLUMN driver_trip_cancellations.reason IS 
    'The reason provided by the driver for cancelling the trip';
