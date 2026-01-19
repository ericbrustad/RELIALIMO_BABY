-- =====================================================
-- SUPABASE MIGRATION: Email Templates & Account Email Rules
-- Run this in Supabase SQL Editor
-- =====================================================

-- =====================================================
-- 1. EMAIL TEMPLATES TABLE
-- Stores reusable email templates for driver status notifications
-- =====================================================

CREATE TABLE IF NOT EXISTS email_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    trigger_event VARCHAR(50) NOT NULL,
    subject VARCHAR(500) NOT NULL,
    body_html TEXT NOT NULL,
    body_text TEXT,
    send_via_email BOOLEAN DEFAULT TRUE,
    send_via_sms BOOLEAN DEFAULT FALSE,
    sms_body VARCHAR(160),
    send_to_billing BOOLEAN DEFAULT TRUE,
    send_to_passenger BOOLEAN DEFAULT TRUE,
    send_to_booking_contact BOOLEAN DEFAULT FALSE,
    send_to_driver BOOLEAN DEFAULT FALSE,
    timing_offset_minutes INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    updated_by UUID
);

-- Add missing columns to existing email_templates table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'email_templates' AND column_name = 'organization_id') THEN
        ALTER TABLE email_templates ADD COLUMN organization_id UUID;
    END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_email_templates_org ON email_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_trigger ON email_templates(trigger_event);
CREATE INDEX IF NOT EXISTS idx_email_templates_active ON email_templates(is_active) WHERE is_active = TRUE;

-- =====================================================
-- 2. ACCOUNT EMAIL RULES TABLE
-- Per-account configuration of which driver status emails to receive
-- =====================================================

CREATE TABLE IF NOT EXISTS account_email_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    rule_driver_on_the_way BOOLEAN DEFAULT TRUE,
    rule_driver_arrived BOOLEAN DEFAULT TRUE,
    rule_passenger_on_board BOOLEAN DEFAULT TRUE,
    rule_passenger_dropped_off BOOLEAN DEFAULT TRUE,
    rule_driver_info_affiliate BOOLEAN DEFAULT FALSE,
    rule_reservation_confirmed BOOLEAN DEFAULT TRUE,
    rule_reservation_updated BOOLEAN DEFAULT TRUE,
    rule_reservation_cancelled BOOLEAN DEFAULT TRUE,
    rule_payment_received BOOLEAN DEFAULT TRUE,
    rule_invoice_sent BOOLEAN DEFAULT TRUE,
    rule_trip_reminder BOOLEAN DEFAULT TRUE,
    trip_reminder_hours_before INTEGER DEFAULT 24,
    prefer_email BOOLEAN DEFAULT TRUE,
    prefer_sms BOOLEAN DEFAULT FALSE,
    all_rules_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add missing columns to existing account_email_rules table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'account_email_rules' AND column_name = 'organization_id') THEN
        ALTER TABLE account_email_rules ADD COLUMN organization_id UUID;
    END IF;
END $$;

-- Unique constraint: one rule set per account
CREATE UNIQUE INDEX IF NOT EXISTS idx_account_email_rules_account 
ON account_email_rules(account_id);

-- Index for org lookup
CREATE INDEX IF NOT EXISTS idx_account_email_rules_org 
ON account_email_rules(organization_id);


-- =====================================================
-- 3. ADD EMAIL RULE FIELDS TO ACCOUNTS TABLE
-- Quick-access fields on the main accounts table
-- =====================================================

DO $$ 
BEGIN
    -- Master email rules toggle
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'email_rules_enabled') THEN
        ALTER TABLE accounts ADD COLUMN email_rules_enabled BOOLEAN DEFAULT TRUE;
    END IF;
    
    -- SMS rules toggle
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'sms_rules_enabled') THEN
        ALTER TABLE accounts ADD COLUMN sms_rules_enabled BOOLEAN DEFAULT FALSE;
    END IF;
    
    -- Default email template for this account (optional override)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'default_email_template_id') THEN
        ALTER TABLE accounts ADD COLUMN default_email_template_id UUID REFERENCES email_templates(id);
    END IF;
    
    -- Financial Data fields (ensure all exist)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'post_method') THEN
        ALTER TABLE accounts ADD COLUMN post_method VARCHAR(50);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'post_terms') THEN
        ALTER TABLE accounts ADD COLUMN post_terms VARCHAR(100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'primary_agent_id') THEN
        ALTER TABLE accounts ADD COLUMN primary_agent_id UUID;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'secondary_agent_id') THEN
        ALTER TABLE accounts ADD COLUMN secondary_agent_id UUID;
    END IF;
    
    -- Credit Card fields (secure - consider encryption in production)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'cc_last_four') THEN
        ALTER TABLE accounts ADD COLUMN cc_last_four VARCHAR(4);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'cc_exp_month') THEN
        ALTER TABLE accounts ADD COLUMN cc_exp_month VARCHAR(2);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'cc_exp_year') THEN
        ALTER TABLE accounts ADD COLUMN cc_exp_year VARCHAR(4);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'cc_name_on_card') THEN
        ALTER TABLE accounts ADD COLUMN cc_name_on_card VARCHAR(255);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'cc_type') THEN
        ALTER TABLE accounts ADD COLUMN cc_type VARCHAR(20);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'cc_billing_address') THEN
        ALTER TABLE accounts ADD COLUMN cc_billing_address TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'cc_billing_city') THEN
        ALTER TABLE accounts ADD COLUMN cc_billing_city VARCHAR(100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'cc_billing_state') THEN
        ALTER TABLE accounts ADD COLUMN cc_billing_state VARCHAR(10);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'cc_billing_zip') THEN
        ALTER TABLE accounts ADD COLUMN cc_billing_zip VARCHAR(20);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'cc_billing_country') THEN
        ALTER TABLE accounts ADD COLUMN cc_billing_country VARCHAR(50) DEFAULT 'United States';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'cc_notes') THEN
        ALTER TABLE accounts ADD COLUMN cc_notes TEXT;
    END IF;
    
    -- Billing Contact fields
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'my_billing_contact_id') THEN
        ALTER TABLE accounts ADD COLUMN my_billing_contact_id UUID REFERENCES accounts(id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'employee_id') THEN
        ALTER TABLE accounts ADD COLUMN employee_id VARCHAR(50);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'vip_number') THEN
        ALTER TABLE accounts ADD COLUMN vip_number VARCHAR(50);
    END IF;
    
    -- Partner Preferences (Misc tab)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'groundxchange_id') THEN
        ALTER TABLE accounts ADD COLUMN groundxchange_id VARCHAR(100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'gnet_id') THEN
        ALTER TABLE accounts ADD COLUMN gnet_id VARCHAR(100);
    END IF;
    
    -- Name prefix (Misc tab)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'prefix') THEN
        ALTER TABLE accounts ADD COLUMN prefix VARCHAR(10);
    END IF;
    
    -- Customer logo
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'logo_url') THEN
        ALTER TABLE accounts ADD COLUMN logo_url TEXT;
    END IF;
    
END $$;


-- =====================================================
-- 4. ACCOUNT ADDRESSES TABLE
-- Multiple addresses per account (handle existing table)
-- =====================================================

-- Create table if it doesn't exist
CREATE TABLE IF NOT EXISTS account_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    address_type VARCHAR(50) NOT NULL DEFAULT 'primary',
    address_name VARCHAR(100),
    address_line1 TEXT NOT NULL,
    address_line2 TEXT,
    city VARCHAR(100),
    state VARCHAR(10),
    zip_code VARCHAR(20),
    country VARCHAR(50) DEFAULT 'United States',
    latitude NUMERIC,
    longitude NUMERIC,
    is_default BOOLEAN DEFAULT FALSE,
    is_verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add missing columns to existing table
DO $$ 
BEGIN
    -- Add organization_id if missing (nullable for backwards compatibility)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'account_addresses' AND column_name = 'organization_id') THEN
        ALTER TABLE account_addresses ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
    END IF;
    
    -- Add latitude if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'account_addresses' AND column_name = 'latitude') THEN
        ALTER TABLE account_addresses ADD COLUMN latitude NUMERIC;
    END IF;
    
    -- Add longitude if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'account_addresses' AND column_name = 'longitude') THEN
        ALTER TABLE account_addresses ADD COLUMN longitude NUMERIC;
    END IF;
    
    -- Add zip_code if missing (some schemas use 'zip' instead)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'account_addresses' AND column_name = 'zip_code') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'account_addresses' AND column_name = 'zip') THEN
            -- Rename zip to zip_code for consistency
            ALTER TABLE account_addresses RENAME COLUMN zip TO zip_code;
        ELSE
            ALTER TABLE account_addresses ADD COLUMN zip_code VARCHAR(20);
        END IF;
    END IF;
    
    -- Add use_count if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'account_addresses' AND column_name = 'use_count') THEN
        ALTER TABLE account_addresses ADD COLUMN use_count INTEGER DEFAULT 1;
    END IF;
    
    -- Add last_used_at if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'account_addresses' AND column_name = 'last_used_at') THEN
        ALTER TABLE account_addresses ADD COLUMN last_used_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_account_addresses_account ON account_addresses(account_id);
CREATE INDEX IF NOT EXISTS idx_account_addresses_type ON account_addresses(address_type);


-- =====================================================
-- 5. ACCOUNT BOOKING CONTACTS TABLE (Junction)
-- Links accounts to their booking contacts
-- =====================================================

CREATE TABLE IF NOT EXISTS account_booking_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    booking_contact_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    can_book BOOLEAN DEFAULT TRUE,
    can_view_billing BOOLEAN DEFAULT FALSE,
    can_modify BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add missing columns to existing account_booking_contacts table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'account_booking_contacts' AND column_name = 'organization_id') THEN
        ALTER TABLE account_booking_contacts ADD COLUMN organization_id UUID;
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_account_booking_contacts_unique 
ON account_booking_contacts(account_id, booking_contact_id);


-- =====================================================
-- 6. INSERT DEFAULT EMAIL TEMPLATES
-- These are organization-independent system defaults
-- =====================================================

INSERT INTO email_templates (
    organization_id, name, description, trigger_event, subject, body_html, body_text,
    send_to_billing, send_to_passenger, is_default, is_active
) VALUES 
(
    NULL,
    'Driver On The Way',
    'Notification when driver has started heading to pickup',
    'driver_on_the_way',
    'Your driver is on the way - Reservation #{{confirmation_number}}',
    '<h2>Your Driver is On The Way!</h2>
    <p>Hello {{passenger_name}},</p>
    <p>Your driver <strong>{{driver_name}}</strong> is now heading to your pickup location.</p>
    <p><strong>Pickup:</strong> {{pickup_address}}</p>
    <p><strong>Vehicle:</strong> {{vehicle_description}}</p>
    <p><strong>Estimated Arrival:</strong> {{estimated_arrival}}</p>
    <p>Thank you for choosing us!</p>',
    'Your driver {{driver_name}} is on the way to {{pickup_address}}. ETA: {{estimated_arrival}}',
    TRUE, TRUE, TRUE, TRUE
),
(
    NULL,
    'Driver Arrived',
    'Notification when driver has arrived at pickup location',
    'driver_arrived',
    'Your driver has arrived - Reservation #{{confirmation_number}}',
    '<h2>Your Driver Has Arrived!</h2>
    <p>Hello {{passenger_name}},</p>
    <p>Your driver <strong>{{driver_name}}</strong> has arrived at the pickup location.</p>
    <p><strong>Location:</strong> {{pickup_address}}</p>
    <p><strong>Vehicle:</strong> {{vehicle_description}}</p>
    <p>Please proceed to meet your driver.</p>',
    'Your driver {{driver_name}} has arrived at {{pickup_address}}. Vehicle: {{vehicle_description}}',
    TRUE, TRUE, TRUE, TRUE
),
(
    NULL,
    'Passenger On Board',
    'Confirmation when passenger has been picked up',
    'passenger_on_board',
    'Trip in progress - Reservation #{{confirmation_number}}',
    '<h2>Your Trip is Underway</h2>
    <p>Hello,</p>
    <p>This is to confirm that the passenger has been picked up.</p>
    <p><strong>Pickup Time:</strong> {{pickup_time}}</p>
    <p><strong>Destination:</strong> {{dropoff_address}}</p>
    <p><strong>Driver:</strong> {{driver_name}}</p>',
    'Passenger picked up at {{pickup_time}}. Heading to {{dropoff_address}}. Driver: {{driver_name}}',
    TRUE, FALSE, TRUE, TRUE
),
(
    NULL,
    'Passenger Dropped Off',
    'Confirmation when passenger has been dropped off',
    'passenger_dropped_off',
    'Trip completed - Reservation #{{confirmation_number}}',
    '<h2>Trip Completed Successfully</h2>
    <p>Hello {{passenger_name}},</p>
    <p>Your trip has been completed.</p>
    <p><strong>Drop-off:</strong> {{dropoff_address}}</p>
    <p><strong>Drop-off Time:</strong> {{dropoff_time}}</p>
    <p><strong>Driver:</strong> {{driver_name}}</p>
    <p>Thank you for riding with us! We hope to see you again.</p>',
    'Trip completed. Dropped off at {{dropoff_address}} at {{dropoff_time}}. Thank you for choosing us!',
    TRUE, TRUE, TRUE, TRUE
),
(
    NULL,
    'Driver Info for Affiliate (3hr)',
    'Driver information sent to affiliate 3 hours before off-network pickup',
    'driver_info_affiliate',
    'Driver Assignment - Reservation #{{confirmation_number}}',
    '<h2>Driver Assignment Notification</h2>
    <p>The following driver has been assigned to your reservation:</p>
    <p><strong>Driver:</strong> {{driver_name}}</p>
    <p><strong>Phone:</strong> {{driver_phone}}</p>
    <p><strong>Vehicle:</strong> {{vehicle_description}}</p>
    <p><strong>License Plate:</strong> {{license_plate}}</p>
    <p><strong>Pickup Time:</strong> {{pickup_datetime}}</p>
    <p><strong>Pickup Location:</strong> {{pickup_address}}</p>',
    'Driver: {{driver_name}}, Phone: {{driver_phone}}, Vehicle: {{vehicle_description}}, Plate: {{license_plate}}',
    TRUE, FALSE, TRUE, TRUE
)
ON CONFLICT DO NOTHING;


-- =====================================================
-- 7. RLS POLICIES (Permissive for authenticated users)
-- =====================================================

-- Enable RLS
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_email_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_booking_contacts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (for re-running)
DROP POLICY IF EXISTS "email_templates_select" ON email_templates;
DROP POLICY IF EXISTS "email_templates_insert" ON email_templates;
DROP POLICY IF EXISTS "email_templates_update" ON email_templates;
DROP POLICY IF EXISTS "email_templates_delete" ON email_templates;
DROP POLICY IF EXISTS "account_email_rules_all" ON account_email_rules;
DROP POLICY IF EXISTS "account_addresses_all" ON account_addresses;
DROP POLICY IF EXISTS "account_booking_contacts_all" ON account_booking_contacts;

-- Email Templates: Any authenticated user can CRUD
CREATE POLICY "authenticated_select_email_templates" ON email_templates
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "authenticated_insert_email_templates" ON email_templates
    FOR INSERT TO authenticated
    WITH CHECK (true);

CREATE POLICY "authenticated_update_email_templates" ON email_templates
    FOR UPDATE TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "authenticated_delete_email_templates" ON email_templates
    FOR DELETE TO authenticated
    USING (true);

-- Account Email Rules: Any authenticated user can CRUD
CREATE POLICY "authenticated_select_account_email_rules" ON account_email_rules
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "authenticated_insert_account_email_rules" ON account_email_rules
    FOR INSERT TO authenticated
    WITH CHECK (true);

CREATE POLICY "authenticated_update_account_email_rules" ON account_email_rules
    FOR UPDATE TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "authenticated_delete_account_email_rules" ON account_email_rules
    FOR DELETE TO authenticated
    USING (true);

-- Account Addresses: Any authenticated user can CRUD
CREATE POLICY "authenticated_select_account_addresses" ON account_addresses
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "authenticated_insert_account_addresses" ON account_addresses
    FOR INSERT TO authenticated
    WITH CHECK (true);

CREATE POLICY "authenticated_update_account_addresses" ON account_addresses
    FOR UPDATE TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "authenticated_delete_account_addresses" ON account_addresses
    FOR DELETE TO authenticated
    USING (true);

-- Account Booking Contacts: Any authenticated user can CRUD
CREATE POLICY "authenticated_select_account_booking_contacts" ON account_booking_contacts
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "authenticated_insert_account_booking_contacts" ON account_booking_contacts
    FOR INSERT TO authenticated
    WITH CHECK (true);

CREATE POLICY "authenticated_update_account_booking_contacts" ON account_booking_contacts
    FOR UPDATE TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "authenticated_delete_account_booking_contacts" ON account_booking_contacts
    FOR DELETE TO authenticated
    USING (true);


-- =====================================================
-- 8. HELPER FUNCTIONS
-- =====================================================

-- Get email rules for an account (creates default if not exists)
CREATE OR REPLACE FUNCTION get_or_create_account_email_rules(p_account_id UUID, p_org_id UUID)
RETURNS account_email_rules AS $$
DECLARE
    v_rules account_email_rules;
BEGIN
    -- Try to get existing rules
    SELECT * INTO v_rules FROM account_email_rules WHERE account_id = p_account_id;
    
    -- If not found, create default rules
    IF NOT FOUND THEN
        INSERT INTO account_email_rules (account_id, organization_id)
        VALUES (p_account_id, p_org_id)
        RETURNING * INTO v_rules;
    END IF;
    
    RETURN v_rules;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get templates for a trigger event
CREATE OR REPLACE FUNCTION get_templates_for_event(p_org_id UUID, p_event VARCHAR)
RETURNS SETOF email_templates AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM email_templates
    WHERE (organization_id = p_org_id OR organization_id IS NULL)
    AND trigger_event = p_event
    AND is_active = TRUE
    ORDER BY 
        CASE WHEN organization_id = p_org_id THEN 0 ELSE 1 END,  -- Org templates first
        created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =====================================================
-- 9. COMMENTS
-- =====================================================

COMMENT ON TABLE email_templates IS 'Email templates for automated notifications based on driver status and events';
COMMENT ON TABLE account_email_rules IS 'Per-account toggle settings for which automated emails to receive';
COMMENT ON TABLE account_addresses IS 'Multiple addresses associated with an account';
COMMENT ON TABLE account_booking_contacts IS 'Junction table linking accounts to their booking contacts';

COMMENT ON COLUMN accounts.email_rules_enabled IS 'Master toggle for all automated email notifications';
COMMENT ON COLUMN accounts.sms_rules_enabled IS 'Master toggle for all automated SMS notifications';
COMMENT ON COLUMN accounts.post_method IS 'Billing method: invoice, statement, cc';
COMMENT ON COLUMN accounts.post_terms IS 'Payment terms e.g. Net 30';
COMMENT ON COLUMN accounts.groundxchange_id IS 'GroundXchange partner ID';
COMMENT ON COLUMN accounts.gnet_id IS 'GNet partner ID';


-- =====================================================
-- 10. VERIFY
-- =====================================================

SELECT 'email_templates' as table_name, count(*) as row_count FROM email_templates
UNION ALL
SELECT 'account_email_rules', count(*) FROM account_email_rules
UNION ALL
SELECT 'account_addresses', count(*) FROM account_addresses
UNION ALL
SELECT 'account_booking_contacts', count(*) FROM account_booking_contacts;
