-- Add airport_fee column to reservations table for MAC/Baggage handling fee
-- This is a $15 fee automatically applied to airport pickups and dropoffs

-- Add the airport_fee column
ALTER TABLE reservations 
ADD COLUMN IF NOT EXISTS airport_fee DECIMAL(10,2) DEFAULT 0;

-- Add comment to document the column
COMMENT ON COLUMN reservations.airport_fee IS 'MAC (Metropolitan Airports Commission) and baggage handling fee. Automatically applied to airport pickups/dropoffs. Default $15.';

-- Update existing airport trips to add the fee (optional - run if you want to retroactively apply)
-- Uncomment the following if you want to apply $15 to existing airport trips:
-- UPDATE reservations 
-- SET airport_fee = 15.00 
-- WHERE (
--   service_type IN ('from-airport', 'to-airport') 
--   OR pickup_airport IS NOT NULL 
--   OR dropoff_airport IS NOT NULL
-- ) AND airport_fee = 0;

-- Create an index for querying airport trips
CREATE INDEX IF NOT EXISTS idx_reservations_airport_fee 
ON reservations (airport_fee) 
WHERE airport_fee > 0;

-- Grant appropriate permissions
GRANT SELECT, UPDATE ON reservations TO authenticated;
