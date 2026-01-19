-- =====================================================
-- SUPABASE MIGRATION: Add extended account fields
-- Run this in Supabase SQL Editor
-- =====================================================

-- Add new columns to accounts table (if they don't exist)
-- Using DO block for conditional column addition

DO $$ 
BEGIN
    -- Department and Job Title
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'department') THEN
        ALTER TABLE accounts ADD COLUMN department TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'job_title') THEN
        ALTER TABLE accounts ADD COLUMN job_title TEXT;
    END IF;

    -- Address fields
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'address_line1') THEN
        ALTER TABLE accounts ADD COLUMN address_line1 TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'address_line2') THEN
        ALTER TABLE accounts ADD COLUMN address_line2 TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'city') THEN
        ALTER TABLE accounts ADD COLUMN city TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'state') THEN
        ALTER TABLE accounts ADD COLUMN state VARCHAR(10);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'zip') THEN
        ALTER TABLE accounts ADD COLUMN zip VARCHAR(20);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'country') THEN
        ALTER TABLE accounts ADD COLUMN country VARCHAR(10) DEFAULT 'US';
    END IF;

    -- Notes fields
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'internal_notes') THEN
        ALTER TABLE accounts ADD COLUMN internal_notes TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'trip_notes') THEN
        ALTER TABLE accounts ADD COLUMN trip_notes TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'notes_others') THEN
        ALTER TABLE accounts ADD COLUMN notes_others TEXT;
    END IF;

    -- Restrictions (stored as UUID arrays referencing drivers/vehicles tables)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'restricted_drivers') THEN
        ALTER TABLE accounts ADD COLUMN restricted_drivers UUID[] DEFAULT '{}';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'restricted_cars') THEN
        ALTER TABLE accounts ADD COLUMN restricted_cars UUID[] DEFAULT '{}';
    END IF;

    -- Source and Agreement
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'source') THEN
        ALTER TABLE accounts ADD COLUMN source TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'rental_agreement') THEN
        ALTER TABLE accounts ADD COLUMN rental_agreement TEXT;
    END IF;

    -- Account Settings
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'account_settings') THEN
        ALTER TABLE accounts ADD COLUMN account_settings VARCHAR(50) DEFAULT 'normal';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'web_access') THEN
        ALTER TABLE accounts ADD COLUMN web_access VARCHAR(50) DEFAULT 'allow';
    END IF;

    -- Account Type flags
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'is_billing_client') THEN
        ALTER TABLE accounts ADD COLUMN is_billing_client BOOLEAN DEFAULT FALSE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'is_passenger') THEN
        ALTER TABLE accounts ADD COLUMN is_passenger BOOLEAN DEFAULT FALSE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'is_booking_contact') THEN
        ALTER TABLE accounts ADD COLUMN is_booking_contact BOOLEAN DEFAULT FALSE;
    END IF;

    -- Address verification status
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'address_verified') THEN
        ALTER TABLE accounts ADD COLUMN address_verified BOOLEAN DEFAULT FALSE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'address_verified_at') THEN
        ALTER TABLE accounts ADD COLUMN address_verified_at TIMESTAMPTZ;
    END IF;

    -- Additional Phone Numbers
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'office_phone') THEN
        ALTER TABLE accounts ADD COLUMN office_phone VARCHAR(30);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'office_phone_ext') THEN
        ALTER TABLE accounts ADD COLUMN office_phone_ext VARCHAR(10);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'home_phone') THEN
        ALTER TABLE accounts ADD COLUMN home_phone VARCHAR(30);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'home_phone_ext') THEN
        ALTER TABLE accounts ADD COLUMN home_phone_ext VARCHAR(10);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'cell_phone_2') THEN
        ALTER TABLE accounts ADD COLUMN cell_phone_2 VARCHAR(30);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'cell_phone_3') THEN
        ALTER TABLE accounts ADD COLUMN cell_phone_3 VARCHAR(30);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'fax_1') THEN
        ALTER TABLE accounts ADD COLUMN fax_1 VARCHAR(30);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'fax_2') THEN
        ALTER TABLE accounts ADD COLUMN fax_2 VARCHAR(30);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'fax_3') THEN
        ALTER TABLE accounts ADD COLUMN fax_3 VARCHAR(30);
    END IF;

    -- Email Preferences (toggles for email types)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'email_pref_all') THEN
        ALTER TABLE accounts ADD COLUMN email_pref_all BOOLEAN DEFAULT TRUE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'email_pref_confirmation') THEN
        ALTER TABLE accounts ADD COLUMN email_pref_confirmation BOOLEAN DEFAULT TRUE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'email_pref_payment_receipt') THEN
        ALTER TABLE accounts ADD COLUMN email_pref_payment_receipt BOOLEAN DEFAULT TRUE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'email_pref_invoice') THEN
        ALTER TABLE accounts ADD COLUMN email_pref_invoice BOOLEAN DEFAULT TRUE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'email_pref_other') THEN
        ALTER TABLE accounts ADD COLUMN email_pref_other BOOLEAN DEFAULT TRUE;
    END IF;

END $$;

-- =====================================================
-- MIGRATION: Convert JSONB to UUID[] if already exists
-- (Safe to run - only converts if old format exists)
-- =====================================================

DO $$
BEGIN
    -- Check if restricted_drivers exists as JSONB and convert to UUID[]
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'accounts' 
        AND column_name = 'restricted_drivers' 
        AND data_type = 'jsonb'
    ) THEN
        -- Create temp column
        ALTER TABLE accounts ADD COLUMN restricted_drivers_new UUID[] DEFAULT '{}';
        
        -- Migrate data (extract UUIDs from JSONB array)
        UPDATE accounts 
        SET restricted_drivers_new = (
            SELECT ARRAY(
                SELECT (elem::text)::uuid 
                FROM jsonb_array_elements(restricted_drivers) AS elem
                WHERE elem::text <> 'null' AND elem::text <> '""'
            )
        )
        WHERE restricted_drivers IS NOT NULL AND jsonb_array_length(restricted_drivers) > 0;
        
        -- Drop old column and rename new
        ALTER TABLE accounts DROP COLUMN restricted_drivers;
        ALTER TABLE accounts RENAME COLUMN restricted_drivers_new TO restricted_drivers;
    END IF;
    
    -- Check if restricted_cars exists as JSONB and convert to UUID[]
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'accounts' 
        AND column_name = 'restricted_cars' 
        AND data_type = 'jsonb'
    ) THEN
        -- Create temp column
        ALTER TABLE accounts ADD COLUMN restricted_cars_new UUID[] DEFAULT '{}';
        
        -- Migrate data (extract UUIDs from JSONB array)
        UPDATE accounts 
        SET restricted_cars_new = (
            SELECT ARRAY(
                SELECT (elem::text)::uuid 
                FROM jsonb_array_elements(restricted_cars) AS elem
                WHERE elem::text <> 'null' AND elem::text <> '""'
            )
        )
        WHERE restricted_cars IS NOT NULL AND jsonb_array_length(restricted_cars) > 0;
        
        -- Drop old column and rename new
        ALTER TABLE accounts DROP COLUMN restricted_cars;
        ALTER TABLE accounts RENAME COLUMN restricted_cars_new TO restricted_cars;
    END IF;
END $$;

-- =====================================================
-- Create indexes for commonly searched fields
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_accounts_city ON accounts(city);
CREATE INDEX IF NOT EXISTS idx_accounts_state ON accounts(state);
CREATE INDEX IF NOT EXISTS idx_accounts_zip ON accounts(zip);
CREATE INDEX IF NOT EXISTS idx_accounts_source ON accounts(source);
CREATE INDEX IF NOT EXISTS idx_accounts_account_settings ON accounts(account_settings);
CREATE INDEX IF NOT EXISTS idx_accounts_is_billing_client ON accounts(is_billing_client) WHERE is_billing_client = TRUE;
CREATE INDEX IF NOT EXISTS idx_accounts_is_passenger ON accounts(is_passenger) WHERE is_passenger = TRUE;

-- Index for array containment queries (e.g., find accounts restricted from driver X)
CREATE INDEX IF NOT EXISTS idx_accounts_restricted_drivers ON accounts USING GIN(restricted_drivers);
CREATE INDEX IF NOT EXISTS idx_accounts_restricted_cars ON accounts USING GIN(restricted_cars);

-- =====================================================
-- Create helper functions for restriction lookups
-- =====================================================

-- Function to get driver display name for dropdown
CREATE OR REPLACE FUNCTION get_drivers_for_dropdown(org_id UUID)
RETURNS TABLE(id UUID, display_name TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.id,
        CONCAT(d.first_name, ' ', d.last_name, 
            CASE WHEN d.badge_id IS NOT NULL THEN ' (' || d.badge_id || ')' ELSE '' END
        ) AS display_name
    FROM drivers d
    WHERE d.organization_id = org_id
    AND d.status = 'ACTIVE'
    ORDER BY d.last_name, d.first_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get vehicles for dropdown  
CREATE OR REPLACE FUNCTION get_vehicles_for_dropdown(org_id UUID)
RETURNS TABLE(id UUID, display_name TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        v.id,
        CONCAT(
            COALESCE(v.year::text, ''), ' ',
            COALESCE(v.make, ''), ' ', 
            COALESCE(v.model, ''),
            CASE WHEN v.license_plate IS NOT NULL THEN ' [' || v.license_plate || ']' ELSE '' END
        ) AS display_name
    FROM vehicles v
    WHERE v.organization_id = org_id
    AND v.status IN ('AVAILABLE', 'IN_USE')
    ORDER BY v.year DESC, v.make, v.model;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get restricted driver names for an account
CREATE OR REPLACE FUNCTION get_restricted_driver_names(driver_ids UUID[])
RETURNS TEXT AS $$
BEGIN
    RETURN (
        SELECT STRING_AGG(CONCAT(d.first_name, ' ', d.last_name), ', ')
        FROM drivers d
        WHERE d.id = ANY(driver_ids)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get restricted vehicle names for an account
CREATE OR REPLACE FUNCTION get_restricted_vehicle_names(vehicle_ids UUID[])
RETURNS TEXT AS $$
BEGIN
    RETURN (
        SELECT STRING_AGG(
            CONCAT(COALESCE(v.year::text, ''), ' ', COALESCE(v.make, ''), ' ', COALESCE(v.model, '')),
            ', '
        )
        FROM vehicles v
        WHERE v.id = ANY(vehicle_ids)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Create view for accounts with resolved restrictions
-- =====================================================

CREATE OR REPLACE VIEW accounts_with_restrictions AS
SELECT 
    a.*,
    get_restricted_driver_names(a.restricted_drivers) AS restricted_driver_names,
    get_restricted_vehicle_names(a.restricted_cars) AS restricted_vehicle_names
FROM accounts a;

-- =====================================================
-- Add comments for documentation
-- =====================================================

COMMENT ON COLUMN accounts.department IS 'Department within the company';
COMMENT ON COLUMN accounts.job_title IS 'Job title of the account holder';
COMMENT ON COLUMN accounts.address_line1 IS 'Primary street address';
COMMENT ON COLUMN accounts.address_line2 IS 'Secondary address line (apt, suite, etc.)';
COMMENT ON COLUMN accounts.city IS 'City name';
COMMENT ON COLUMN accounts.state IS 'State/Province abbreviation (e.g., MN, CA, ON)';
COMMENT ON COLUMN accounts.zip IS 'ZIP or postal code';
COMMENT ON COLUMN accounts.country IS 'Country code (US, CA, etc.)';
COMMENT ON COLUMN accounts.internal_notes IS 'Private notes visible only to staff';
COMMENT ON COLUMN accounts.trip_notes IS 'Preferences and trip-related notes';
COMMENT ON COLUMN accounts.notes_others IS 'Notes visible to others/drivers';
COMMENT ON COLUMN accounts.restricted_drivers IS 'Array of driver UUIDs this account cannot use (references drivers.id)';
COMMENT ON COLUMN accounts.restricted_cars IS 'Array of vehicle UUIDs this account cannot use (references vehicles.id)';
COMMENT ON COLUMN accounts.source IS 'How the account was acquired (website, referral, etc.)';
COMMENT ON COLUMN accounts.rental_agreement IS 'Type of rental agreement (standard, corporate, vip, custom)';
COMMENT ON COLUMN accounts.account_settings IS 'Account tier: normal, vip, or blocked';
COMMENT ON COLUMN accounts.web_access IS 'Web portal access: allow, deny, or limited';
COMMENT ON COLUMN accounts.is_billing_client IS 'Whether this account is a billing client';
COMMENT ON COLUMN accounts.is_passenger IS 'Whether this account is a passenger';
COMMENT ON COLUMN accounts.is_booking_contact IS 'Whether this account is a booking contact';
COMMENT ON COLUMN accounts.address_verified IS 'Whether the address has been verified';
COMMENT ON COLUMN accounts.address_verified_at IS 'When the address was last verified';
COMMENT ON COLUMN accounts.office_phone IS 'Office phone number';
COMMENT ON COLUMN accounts.office_phone_ext IS 'Office phone extension';
COMMENT ON COLUMN accounts.home_phone IS 'Home phone number';
COMMENT ON COLUMN accounts.home_phone_ext IS 'Home phone extension';
COMMENT ON COLUMN accounts.cell_phone_2 IS 'Secondary cell phone';
COMMENT ON COLUMN accounts.cell_phone_3 IS 'Tertiary cell phone';
COMMENT ON COLUMN accounts.fax_1 IS 'Primary fax number';
COMMENT ON COLUMN accounts.fax_2 IS 'Secondary fax number';
COMMENT ON COLUMN accounts.fax_3 IS 'Tertiary fax number';
COMMENT ON COLUMN accounts.email_pref_all IS 'Receive all email types';
COMMENT ON COLUMN accounts.email_pref_confirmation IS 'Receive confirmation emails';
COMMENT ON COLUMN accounts.email_pref_payment_receipt IS 'Receive payment receipt emails';
COMMENT ON COLUMN accounts.email_pref_invoice IS 'Receive invoice emails';
COMMENT ON COLUMN accounts.email_pref_other IS 'Receive other email types';

COMMENT ON FUNCTION get_drivers_for_dropdown IS 'Returns active drivers for organization in dropdown-friendly format';
COMMENT ON FUNCTION get_vehicles_for_dropdown IS 'Returns available vehicles for organization in dropdown-friendly format';
COMMENT ON FUNCTION get_restricted_driver_names IS 'Converts driver UUID array to comma-separated names';
COMMENT ON FUNCTION get_restricted_vehicle_names IS 'Converts vehicle UUID array to comma-separated descriptions';
COMMENT ON VIEW accounts_with_restrictions IS 'Accounts view with resolved driver/vehicle restriction names';

-- =====================================================
-- Update RLS policies if needed (optional)
-- =====================================================

-- Ensure the existing RLS policy covers new columns
-- No changes needed if policy is on entire row

-- =====================================================
-- Verify the changes
-- =====================================================

SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns 
WHERE table_name = 'accounts' 
ORDER BY ordinal_position;
