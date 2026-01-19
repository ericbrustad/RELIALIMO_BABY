-- =====================================================
-- ORGANIZATION CONTACT INFORMATION FIELDS MIGRATION
-- Run this in Supabase SQL Editor to add company info fields
-- =====================================================

-- Add additional contact and business information fields to organizations table
DO $$
BEGIN
    -- Street Address (more detailed)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'street_address') THEN
        ALTER TABLE organizations ADD COLUMN street_address TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'street_address_2') THEN
        ALTER TABLE organizations ADD COLUMN street_address_2 TEXT;
    END IF;

    -- EIN/Business Number
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'ein') THEN
        ALTER TABLE organizations ADD COLUMN ein VARCHAR(50);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'show_ein_on_docs') THEN
        ALTER TABLE organizations ADD COLUMN show_ein_on_docs BOOLEAN DEFAULT false;
    END IF;

    -- Secondary Phone
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'secondary_phone') THEN
        ALTER TABLE organizations ADD COLUMN secondary_phone VARCHAR(30);
    END IF;

    -- Fax
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'fax') THEN
        ALTER TABLE organizations ADD COLUMN fax VARCHAR(30);
    END IF;

    -- Email addresses (specialized)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'general_email') THEN
        ALTER TABLE organizations ADD COLUMN general_email VARCHAR(255);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'reservation_email') THEN
        ALTER TABLE organizations ADD COLUMN reservation_email VARCHAR(255);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'quote_email') THEN
        ALTER TABLE organizations ADD COLUMN quote_email VARCHAR(255);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'billing_email') THEN
        ALTER TABLE organizations ADD COLUMN billing_email VARCHAR(255);
    END IF;

    -- Logo URL (for storing uploaded logo path)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'logo_url') THEN
        ALTER TABLE organizations ADD COLUMN logo_url TEXT;
    END IF;

    RAISE NOTICE 'Organization contact fields migration completed successfully';
END $$;

-- Add comments for documentation
COMMENT ON COLUMN organizations.street_address IS 'Primary street address line 1';
COMMENT ON COLUMN organizations.street_address_2 IS 'Street address line 2 (suite, apt, etc.)';
COMMENT ON COLUMN organizations.ein IS 'EIN or Business Number for tax purposes';
COMMENT ON COLUMN organizations.show_ein_on_docs IS 'Whether to display EIN on trip sheets and invoices';
COMMENT ON COLUMN organizations.secondary_phone IS 'Secondary/alternate phone number';
COMMENT ON COLUMN organizations.fax IS 'Fax number';
COMMENT ON COLUMN organizations.general_email IS 'General company email address';
COMMENT ON COLUMN organizations.reservation_email IS 'Email for reservation-related communications';
COMMENT ON COLUMN organizations.quote_email IS 'Email for quote requests and responses';
COMMENT ON COLUMN organizations.billing_email IS 'Email for billing and invoicing';
COMMENT ON COLUMN organizations.logo_url IS 'URL or path to company logo image';

-- Verify existing columns that should already exist
-- The organizations table should already have: name, phone, email, address, city, state, postal_code, country, website
