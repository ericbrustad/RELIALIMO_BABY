-- =====================================================
-- SUPABASE MIGRATION: Create affiliates table with all fields
-- Run this in Supabase SQL Editor
-- =====================================================

-- First, create the affiliates table if it doesn't exist
CREATE TABLE IF NOT EXISTS affiliates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Company/Basic Info
    company_name TEXT,
    primary_address TEXT,
    address_line2 TEXT,
    city TEXT,
    state VARCHAR(10),
    zip VARCHAR(20),
    country VARCHAR(10) DEFAULT 'US',
    school TEXT,
    county_serviced TEXT[],
    tax_id_ssn TEXT,
    markets_serviced TEXT,
    
    -- Primary Contact Information
    first_name TEXT,
    last_name TEXT,
    phone VARCHAR(30),
    phone_ext VARCHAR(10),
    fax VARCHAR(30),
    fax_ext VARCHAR(10),
    email TEXT,
    website TEXT,
    
    -- Trip Ticket Preferences
    send_trip_email BOOLEAN DEFAULT FALSE,
    send_trip_sms BOOLEAN DEFAULT FALSE,
    send_trip_fax BOOLEAN DEFAULT FALSE,
    dont_send_auto_notifications BOOLEAN DEFAULT FALSE,
    
    -- Notes
    internal_notes TEXT,
    
    -- Settings
    status VARCHAR(20) DEFAULT 'ACTIVE',
    learned_priority VARCHAR(20),
    turnaround_monitor_code TEXT,
    
    -- Web Access
    web_username TEXT,
    web_password TEXT,
    
    -- Rental Agreement
    rental_agreement TEXT,
    
    -- Alternate Contact Information
    alt_first_name TEXT,
    alt_last_name TEXT,
    alt_phone VARCHAR(30),
    alt_phone_ext VARCHAR(10),
    alt_fax VARCHAR(30),
    alt_fax_ext VARCHAR(10),
    alt_cell_phone VARCHAR(30),
    alt_cell_provider VARCHAR(50),
    alt_email TEXT,
    alt_send_trip_email BOOLEAN DEFAULT FALSE,
    alt_send_trip_sms BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add new columns to affiliates table (if they don't exist - for existing tables)
-- Using DO block for conditional column addition

DO $$ 
BEGIN
    -- Company/Basic Info
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'affiliates' AND column_name = 'company_name') THEN
        ALTER TABLE affiliates ADD COLUMN company_name TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'affiliates' AND column_name = 'primary_address') THEN
        ALTER TABLE affiliates ADD COLUMN primary_address TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'affiliates' AND column_name = 'address_line2') THEN
        ALTER TABLE affiliates ADD COLUMN address_line2 TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'affiliates' AND column_name = 'city') THEN
        ALTER TABLE affiliates ADD COLUMN city TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'affiliates' AND column_name = 'state') THEN
        ALTER TABLE affiliates ADD COLUMN state VARCHAR(10);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'affiliates' AND column_name = 'zip') THEN
        ALTER TABLE affiliates ADD COLUMN zip VARCHAR(20);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'affiliates' AND column_name = 'country') THEN
        ALTER TABLE affiliates ADD COLUMN country VARCHAR(10) DEFAULT 'US';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'affiliates' AND column_name = 'school') THEN
        ALTER TABLE affiliates ADD COLUMN school TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'affiliates' AND column_name = 'county_serviced') THEN
        ALTER TABLE affiliates ADD COLUMN county_serviced TEXT[];
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'affiliates' AND column_name = 'tax_id_ssn') THEN
        ALTER TABLE affiliates ADD COLUMN tax_id_ssn TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'affiliates' AND column_name = 'markets_serviced') THEN
        ALTER TABLE affiliates ADD COLUMN markets_serviced TEXT;
    END IF;

    -- Primary Contact Information
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'affiliates' AND column_name = 'first_name') THEN
        ALTER TABLE affiliates ADD COLUMN first_name TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'affiliates' AND column_name = 'last_name') THEN
        ALTER TABLE affiliates ADD COLUMN last_name TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'affiliates' AND column_name = 'phone') THEN
        ALTER TABLE affiliates ADD COLUMN phone VARCHAR(30);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'affiliates' AND column_name = 'phone_ext') THEN
        ALTER TABLE affiliates ADD COLUMN phone_ext VARCHAR(10);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'affiliates' AND column_name = 'fax') THEN
        ALTER TABLE affiliates ADD COLUMN fax VARCHAR(30);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'affiliates' AND column_name = 'fax_ext') THEN
        ALTER TABLE affiliates ADD COLUMN fax_ext VARCHAR(10);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'affiliates' AND column_name = 'email') THEN
        ALTER TABLE affiliates ADD COLUMN email TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'affiliates' AND column_name = 'website') THEN
        ALTER TABLE affiliates ADD COLUMN website TEXT;
    END IF;

    -- Trip Ticket Preferences
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'affiliates' AND column_name = 'send_trip_email') THEN
        ALTER TABLE affiliates ADD COLUMN send_trip_email BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'affiliates' AND column_name = 'send_trip_sms') THEN
        ALTER TABLE affiliates ADD COLUMN send_trip_sms BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'affiliates' AND column_name = 'send_trip_fax') THEN
        ALTER TABLE affiliates ADD COLUMN send_trip_fax BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'affiliates' AND column_name = 'dont_send_auto_notifications') THEN
        ALTER TABLE affiliates ADD COLUMN dont_send_auto_notifications BOOLEAN DEFAULT FALSE;
    END IF;

    -- Notes
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'affiliates' AND column_name = 'internal_notes') THEN
        ALTER TABLE affiliates ADD COLUMN internal_notes TEXT;
    END IF;

    -- Settings
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'affiliates' AND column_name = 'status') THEN
        ALTER TABLE affiliates ADD COLUMN status VARCHAR(20) DEFAULT 'ACTIVE';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'affiliates' AND column_name = 'learned_priority') THEN
        ALTER TABLE affiliates ADD COLUMN learned_priority VARCHAR(20);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'affiliates' AND column_name = 'turnaround_monitor_code') THEN
        ALTER TABLE affiliates ADD COLUMN turnaround_monitor_code TEXT;
    END IF;

    -- Web Access
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'affiliates' AND column_name = 'web_username') THEN
        ALTER TABLE affiliates ADD COLUMN web_username TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'affiliates' AND column_name = 'web_password') THEN
        ALTER TABLE affiliates ADD COLUMN web_password TEXT;
    END IF;

    -- Rental Agreement
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'affiliates' AND column_name = 'rental_agreement') THEN
        ALTER TABLE affiliates ADD COLUMN rental_agreement TEXT;
    END IF;

    -- Alternate Contact Information
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'affiliates' AND column_name = 'alt_first_name') THEN
        ALTER TABLE affiliates ADD COLUMN alt_first_name TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'affiliates' AND column_name = 'alt_last_name') THEN
        ALTER TABLE affiliates ADD COLUMN alt_last_name TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'affiliates' AND column_name = 'alt_phone') THEN
        ALTER TABLE affiliates ADD COLUMN alt_phone VARCHAR(30);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'affiliates' AND column_name = 'alt_phone_ext') THEN
        ALTER TABLE affiliates ADD COLUMN alt_phone_ext VARCHAR(10);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'affiliates' AND column_name = 'alt_fax') THEN
        ALTER TABLE affiliates ADD COLUMN alt_fax VARCHAR(30);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'affiliates' AND column_name = 'alt_fax_ext') THEN
        ALTER TABLE affiliates ADD COLUMN alt_fax_ext VARCHAR(10);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'affiliates' AND column_name = 'alt_cell_phone') THEN
        ALTER TABLE affiliates ADD COLUMN alt_cell_phone VARCHAR(30);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'affiliates' AND column_name = 'alt_cell_provider') THEN
        ALTER TABLE affiliates ADD COLUMN alt_cell_provider VARCHAR(50);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'affiliates' AND column_name = 'alt_email') THEN
        ALTER TABLE affiliates ADD COLUMN alt_email TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'affiliates' AND column_name = 'alt_send_trip_email') THEN
        ALTER TABLE affiliates ADD COLUMN alt_send_trip_email BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'affiliates' AND column_name = 'alt_send_trip_sms') THEN
        ALTER TABLE affiliates ADD COLUMN alt_send_trip_sms BOOLEAN DEFAULT FALSE;
    END IF;

    -- Timestamps
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'affiliates' AND column_name = 'created_at') THEN
        ALTER TABLE affiliates ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'affiliates' AND column_name = 'updated_at') THEN
        ALTER TABLE affiliates ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;

END $$;

-- =====================================================
-- Create indexes for commonly searched fields
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_affiliates_company_name ON affiliates(company_name);
CREATE INDEX IF NOT EXISTS idx_affiliates_city ON affiliates(city);
CREATE INDEX IF NOT EXISTS idx_affiliates_state ON affiliates(state);
CREATE INDEX IF NOT EXISTS idx_affiliates_status ON affiliates(status);
CREATE INDEX IF NOT EXISTS idx_affiliates_email ON affiliates(email);

-- =====================================================
-- Add comments for documentation
-- =====================================================

COMMENT ON COLUMN affiliates.company_name IS 'Affiliate company/business name';
COMMENT ON COLUMN affiliates.primary_address IS 'Primary street address';
COMMENT ON COLUMN affiliates.address_line2 IS 'Secondary address line (suite, unit, etc.)';
COMMENT ON COLUMN affiliates.city IS 'City name';
COMMENT ON COLUMN affiliates.state IS 'State/Province abbreviation';
COMMENT ON COLUMN affiliates.zip IS 'ZIP or postal code';
COMMENT ON COLUMN affiliates.country IS 'Country code (US, CA, etc.)';
COMMENT ON COLUMN affiliates.school IS 'Associated school (if applicable)';
COMMENT ON COLUMN affiliates.county_serviced IS 'Array of counties this affiliate services';
COMMENT ON COLUMN affiliates.tax_id_ssn IS 'Tax ID or SSN (encrypted)';
COMMENT ON COLUMN affiliates.markets_serviced IS 'Description of markets serviced';
COMMENT ON COLUMN affiliates.first_name IS 'Primary contact first name';
COMMENT ON COLUMN affiliates.last_name IS 'Primary contact last name';
COMMENT ON COLUMN affiliates.phone IS 'Primary contact phone';
COMMENT ON COLUMN affiliates.phone_ext IS 'Primary contact phone extension';
COMMENT ON COLUMN affiliates.fax IS 'Primary contact fax';
COMMENT ON COLUMN affiliates.fax_ext IS 'Primary contact fax extension';
COMMENT ON COLUMN affiliates.email IS 'Primary contact email';
COMMENT ON COLUMN affiliates.website IS 'Affiliate website URL';
COMMENT ON COLUMN affiliates.send_trip_email IS 'Send trip tickets via email';
COMMENT ON COLUMN affiliates.send_trip_sms IS 'Send trip tickets via SMS';
COMMENT ON COLUMN affiliates.send_trip_fax IS 'Send trip tickets via fax';
COMMENT ON COLUMN affiliates.dont_send_auto_notifications IS 'Disable automatic notifications';
COMMENT ON COLUMN affiliates.internal_notes IS 'Private internal notes';
COMMENT ON COLUMN affiliates.status IS 'Affiliate status: ACTIVE or INACTIVE';
COMMENT ON COLUMN affiliates.learned_priority IS 'Priority level: High, Medium, Low';
COMMENT ON COLUMN affiliates.turnaround_monitor_code IS 'Code for turnaround monitoring';
COMMENT ON COLUMN affiliates.web_username IS 'Web portal username';
COMMENT ON COLUMN affiliates.web_password IS 'Web portal password (should be hashed)';
COMMENT ON COLUMN affiliates.rental_agreement IS 'Selected rental agreement type';
COMMENT ON COLUMN affiliates.alt_first_name IS 'Alternate contact first name';
COMMENT ON COLUMN affiliates.alt_last_name IS 'Alternate contact last name';
COMMENT ON COLUMN affiliates.alt_phone IS 'Alternate contact phone';
COMMENT ON COLUMN affiliates.alt_phone_ext IS 'Alternate contact phone extension';
COMMENT ON COLUMN affiliates.alt_fax IS 'Alternate contact fax';
COMMENT ON COLUMN affiliates.alt_fax_ext IS 'Alternate contact fax extension';
COMMENT ON COLUMN affiliates.alt_cell_phone IS 'Alternate contact cell phone';
COMMENT ON COLUMN affiliates.alt_cell_provider IS 'Alternate contact cell provider';
COMMENT ON COLUMN affiliates.alt_email IS 'Alternate contact email';
COMMENT ON COLUMN affiliates.alt_send_trip_email IS 'Send trip tickets to alternate via email';
COMMENT ON COLUMN affiliates.alt_send_trip_sms IS 'Send trip tickets to alternate via SMS';

-- =====================================================
-- Enable RLS and create policies
-- =====================================================

ALTER TABLE affiliates ENABLE ROW LEVEL SECURITY;

-- Simple policy: Allow all operations for authenticated users
-- You can replace these with organization-based policies later
DROP POLICY IF EXISTS "Authenticated users can view affiliates" ON affiliates;
CREATE POLICY "Authenticated users can view affiliates" ON affiliates
    FOR SELECT
    USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can insert affiliates" ON affiliates;
CREATE POLICY "Authenticated users can insert affiliates" ON affiliates
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can update affiliates" ON affiliates;
CREATE POLICY "Authenticated users can update affiliates" ON affiliates
    FOR UPDATE
    USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can delete affiliates" ON affiliates;
CREATE POLICY "Authenticated users can delete affiliates" ON affiliates
    FOR DELETE
    USING (auth.role() = 'authenticated');

-- =====================================================
-- Verify the changes
-- =====================================================

SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns 
WHERE table_name = 'affiliates' 
ORDER BY ordinal_position;
