-- =====================================================
-- CUSTOMER PORTAL PREFILL ENHANCEMENT
-- Add home_address and preferred_airport to accounts
-- =====================================================

-- Add columns to accounts table for quick booking prefill
DO $$
BEGIN
    -- Home address (stored full address for quick prefill)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'accounts' AND column_name = 'home_address') THEN
        ALTER TABLE accounts ADD COLUMN home_address TEXT;
    END IF;

    -- Preferred pickup airport code (e.g., 'MSP', 'ORD')
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'accounts' AND column_name = 'preferred_pickup_airport') THEN
        ALTER TABLE accounts ADD COLUMN preferred_pickup_airport VARCHAR(10);
    END IF;

    -- Preferred dropoff airport code
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'accounts' AND column_name = 'preferred_dropoff_airport') THEN
        ALTER TABLE accounts ADD COLUMN preferred_dropoff_airport VARCHAR(10);
    END IF;

    -- Default passenger count
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'accounts' AND column_name = 'default_passenger_count') THEN
        ALTER TABLE accounts ADD COLUMN default_passenger_count INTEGER DEFAULT 1;
    END IF;

    -- Preferred vehicle type
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'accounts' AND column_name = 'preferred_vehicle_type') THEN
        ALTER TABLE accounts ADD COLUMN preferred_vehicle_type VARCHAR(50);
    END IF;

    -- Customer portal onboarding completed flag
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'accounts' AND column_name = 'onboarding_completed') THEN
        ALTER TABLE accounts ADD COLUMN onboarding_completed BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Also add is_visible column to customer_addresses if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'customer_addresses' AND column_name = 'is_visible') THEN
        ALTER TABLE customer_addresses ADD COLUMN is_visible BOOLEAN DEFAULT true;
    END IF;
END $$;

-- Add index for home address lookup
CREATE INDEX IF NOT EXISTS idx_accounts_home_address ON accounts(home_address) WHERE home_address IS NOT NULL;

-- =====================================================
-- DONE! Verify columns were added:
-- =====================================================
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'accounts' 
AND column_name IN ('home_address', 'preferred_pickup_airport', 'preferred_dropoff_airport', 
                    'default_passenger_count', 'preferred_vehicle_type', 'onboarding_completed');
