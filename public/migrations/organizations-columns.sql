-- =====================================================
-- ORGANIZATIONS TABLE COLUMNS
-- Add all required columns for company info sync
-- =====================================================

-- Add columns to organizations table
DO $$
BEGIN
    -- Basic info
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'organizations' AND column_name = 'name') THEN
        ALTER TABLE organizations ADD COLUMN name TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'organizations' AND column_name = 'street_address') THEN
        ALTER TABLE organizations ADD COLUMN street_address TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'organizations' AND column_name = 'street_address_2') THEN
        ALTER TABLE organizations ADD COLUMN street_address_2 TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'organizations' AND column_name = 'city') THEN
        ALTER TABLE organizations ADD COLUMN city TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'organizations' AND column_name = 'state') THEN
        ALTER TABLE organizations ADD COLUMN state TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'organizations' AND column_name = 'postal_code') THEN
        ALTER TABLE organizations ADD COLUMN postal_code TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'organizations' AND column_name = 'country') THEN
        ALTER TABLE organizations ADD COLUMN country TEXT DEFAULT 'US';
    END IF;

    -- Business info
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'organizations' AND column_name = 'ein') THEN
        ALTER TABLE organizations ADD COLUMN ein TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'organizations' AND column_name = 'show_ein_on_docs') THEN
        ALTER TABLE organizations ADD COLUMN show_ein_on_docs BOOLEAN DEFAULT false;
    END IF;

    -- Phone numbers
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'organizations' AND column_name = 'phone') THEN
        ALTER TABLE organizations ADD COLUMN phone TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'organizations' AND column_name = 'secondary_phone') THEN
        ALTER TABLE organizations ADD COLUMN secondary_phone TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'organizations' AND column_name = 'fax') THEN
        ALTER TABLE organizations ADD COLUMN fax TEXT;
    END IF;

    -- Emails
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'organizations' AND column_name = 'email') THEN
        ALTER TABLE organizations ADD COLUMN email TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'organizations' AND column_name = 'general_email') THEN
        ALTER TABLE organizations ADD COLUMN general_email TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'organizations' AND column_name = 'reservation_email') THEN
        ALTER TABLE organizations ADD COLUMN reservation_email TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'organizations' AND column_name = 'quote_email') THEN
        ALTER TABLE organizations ADD COLUMN quote_email TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'organizations' AND column_name = 'billing_email') THEN
        ALTER TABLE organizations ADD COLUMN billing_email TEXT;
    END IF;

    -- Website
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'organizations' AND column_name = 'website') THEN
        ALTER TABLE organizations ADD COLUMN website TEXT;
    END IF;

    -- Location
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'organizations' AND column_name = 'latitude') THEN
        ALTER TABLE organizations ADD COLUMN latitude NUMERIC;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'organizations' AND column_name = 'longitude') THEN
        ALTER TABLE organizations ADD COLUMN longitude NUMERIC;
    END IF;

    -- Legacy compatibility
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'organizations' AND column_name = 'address') THEN
        ALTER TABLE organizations ADD COLUMN address TEXT;
    END IF;

    -- Timestamps
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'organizations' AND column_name = 'created_at') THEN
        ALTER TABLE organizations ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'organizations' AND column_name = 'updated_at') THEN
        ALTER TABLE organizations ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- =====================================================
-- DONE! Verify columns were added:
-- =====================================================
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'organizations'
ORDER BY ordinal_position;
