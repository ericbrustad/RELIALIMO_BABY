-- Additional Customer Portal Tables Migration
-- Run this AFTER customer-portal-tables.sql

-- =====================================================
-- CONFIRMATION NUMBER SEQUENCE TABLE
-- Tracks confirmation numbers per admin/company
-- =====================================================
CREATE TABLE IF NOT EXISTS confirmation_sequences (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sequence_name VARCHAR(50) DEFAULT 'reservations',
    prefix VARCHAR(10) DEFAULT '',
    current_number INTEGER DEFAULT 10000,
    increment_by INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_sequence UNIQUE (sequence_name)
);

-- Insert default sequence if not exists
INSERT INTO confirmation_sequences (sequence_name, prefix, current_number)
VALUES ('reservations', '', 10000)
ON CONFLICT (sequence_name) DO NOTHING;

-- Function to get next confirmation number atomically
CREATE OR REPLACE FUNCTION get_next_confirmation_number(p_sequence_name VARCHAR DEFAULT 'reservations')
RETURNS VARCHAR AS $$
DECLARE
    v_prefix VARCHAR;
    v_number INTEGER;
    v_result VARCHAR;
BEGIN
    -- Update and return in single atomic query
    UPDATE confirmation_sequences
    SET current_number = current_number + increment_by,
        updated_at = NOW()
    WHERE sequence_name = p_sequence_name
    RETURNING prefix, current_number INTO v_prefix, v_number;
    
    -- If no row found, create default
    IF NOT FOUND THEN
        INSERT INTO confirmation_sequences (sequence_name, prefix, current_number)
        VALUES (p_sequence_name, '', 10001)
        RETURNING prefix, current_number INTO v_prefix, v_number;
    END IF;
    
    -- Build confirmation string
    IF v_prefix IS NOT NULL AND v_prefix != '' THEN
        v_result := v_prefix || v_number::VARCHAR;
    ELSE
        v_result := v_number::VARCHAR;
    END IF;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- CUSTOMER PORTAL BOOKING DEFAULTS TABLE
-- Admin-configurable defaults for customer bookings
-- =====================================================
CREATE TABLE IF NOT EXISTS customer_booking_defaults (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    setting_type VARCHAR(20) DEFAULT 'string', -- 'string', 'number', 'boolean', 'json'
    description TEXT,
    display_order INTEGER DEFAULT 0,
    is_editable BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default booking settings
INSERT INTO customer_booking_defaults (setting_key, setting_value, setting_type, description, display_order) VALUES
    -- Assignment Defaults
    ('default_assignment_type', 'unassigned', 'string', 'Default driver assignment: unassigned, in-house, farm-out', 1),
    ('default_affiliate', 'in-house', 'string', 'Default affiliate for new bookings', 2),
    
    -- Vehicle Defaults
    ('default_vehicle_type', 'Black SUV', 'string', 'Default vehicle type for new bookings', 3),
    ('available_vehicle_types', '["Black SUV", "Sedan", "Executive SUV", "Sprinter Van", "Stretch Limo", "Party Bus", "Coach Bus"]', 'json', 'Vehicle types available for booking', 4),
    
    -- Service Defaults
    ('default_service_type', 'Point to Point', 'string', 'Default service type', 5),
    ('available_service_types', '["Point to Point", "Hourly", "Airport Transfer", "Wedding", "Special Event", "Corporate"]', 'json', 'Service types available for booking', 6),
    
    -- Pricing
    ('show_pricing', 'false', 'boolean', 'Show pricing estimates to customers', 7),
    ('require_payment', 'false', 'boolean', 'Require payment at time of booking', 8),
    
    -- Confirmation
    ('confirmation_prefix', '', 'string', 'Prefix for confirmation numbers (e.g., RL)', 9),
    ('auto_confirm', 'true', 'boolean', 'Automatically confirm customer bookings', 10),
    
    -- Notifications
    ('send_confirmation_sms', 'true', 'boolean', 'Send SMS confirmation to customer', 11),
    ('send_confirmation_email', 'true', 'boolean', 'Send email confirmation to customer', 12),
    
    -- Flight Tracking
    ('require_flight_number_pickup', 'true', 'boolean', 'Require flight number for airport pickups', 13),
    ('require_flight_number_dropoff', 'false', 'boolean', 'Require flight number for airport dropoffs', 14),
    ('verify_flight_via_api', 'true', 'boolean', 'Verify flight numbers via FlightAware API', 15),
    
    -- Geofencing
    ('geofence_arrival_meters', '50', 'number', 'Geofence radius for driver arrival (meters)', 16),
    ('geofence_dropoff_meters', '25', 'number', 'Geofence radius for trip completion (meters)', 17),
    
    -- Thank You Screen
    ('enable_tips', 'true', 'boolean', 'Allow tips at end of trip', 18),
    ('default_tip_options', '[15, 18, 20, 25]', 'json', 'Tip percentage options', 19),
    ('enable_google_review', 'true', 'boolean', 'Show Google review prompt at end of trip', 20),
    ('google_review_url', '', 'string', 'Google Business review URL', 21),
    ('thank_you_message', 'Thank you for riding with us! See you next time.', 'string', 'Message shown after trip completion', 22)
ON CONFLICT (setting_key) DO NOTHING;

-- Trigger for updated_at
CREATE TRIGGER update_customer_booking_defaults_updated_at
    BEFORE UPDATE ON customer_booking_defaults
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_confirmation_sequences_updated_at
    BEFORE UPDATE ON confirmation_sequences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ADD BILLING/PASSENGER RELATIONSHIP COLUMNS
-- Link passengers to their billing accounts properly
-- =====================================================

-- Add relationship column to customer_passengers if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'customer_passengers' 
                   AND column_name = 'relationship') THEN
        ALTER TABLE customer_passengers ADD COLUMN relationship VARCHAR(50) DEFAULT 'self';
    END IF;
END $$;

-- Add billing_name to customer_passengers if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'customer_passengers' 
                   AND column_name = 'billing_name') THEN
        ALTER TABLE customer_passengers ADD COLUMN billing_name VARCHAR(200);
    END IF;
END $$;

-- =====================================================
-- ADD SOFT DELETE AND VISIBILITY COLUMNS
-- =====================================================

-- Ensure is_visible column exists for addresses
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'customer_addresses' 
                   AND column_name = 'is_visible') THEN
        ALTER TABLE customer_addresses ADD COLUMN is_visible BOOLEAN DEFAULT true;
    END IF;
END $$;

-- Ensure is_visible column exists for passengers
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'customer_passengers' 
                   AND column_name = 'is_visible') THEN
        ALTER TABLE customer_passengers ADD COLUMN is_visible BOOLEAN DEFAULT true;
    END IF;
END $$;

-- =====================================================
-- VIEW: Active addresses for dropdown
-- Only shows addresses not deleted by user
-- =====================================================
CREATE OR REPLACE VIEW v_customer_addresses_dropdown AS
SELECT 
    id,
    account_id,
    label,
    full_address,
    address_type,
    is_favorite,
    usage_count,
    CASE 
        WHEN label IS NOT NULL AND label != '' 
        THEN label || ' - ' || SUBSTRING(full_address, 1, 50)
        ELSE full_address 
    END AS display_text
FROM customer_addresses
WHERE is_deleted = false 
  AND (is_visible = true OR is_visible IS NULL)
ORDER BY is_favorite DESC, usage_count DESC, last_used_at DESC NULLS LAST;

-- =====================================================
-- VIEW: Active passengers for dropdown
-- Shows self first, then sorted by usage
-- =====================================================
CREATE OR REPLACE VIEW v_customer_passengers_dropdown AS
SELECT 
    id,
    account_id,
    first_name,
    last_name,
    first_name || ' ' || last_name AS full_name,
    phone,
    email,
    is_primary,
    relationship,
    notes,
    usage_count,
    CASE 
        WHEN is_primary = true THEN 'Self'
        WHEN relationship = 'self' THEN 'Self'
        ELSE first_name || ' ' || last_name 
    END AS display_text
FROM customer_passengers
WHERE (is_visible = true OR is_visible IS NULL)
ORDER BY is_primary DESC, relationship = 'self' DESC, usage_count DESC, last_used_at DESC NULLS LAST;

-- =====================================================
-- FUNCTION: Get or create passenger
-- Used when booking to auto-add new passengers
-- =====================================================
CREATE OR REPLACE FUNCTION upsert_customer_passenger(
    p_account_id UUID,
    p_first_name VARCHAR,
    p_last_name VARCHAR,
    p_phone VARCHAR DEFAULT NULL,
    p_email VARCHAR DEFAULT NULL,
    p_is_primary BOOLEAN DEFAULT false,
    p_relationship VARCHAR DEFAULT 'other'
)
RETURNS UUID AS $$
DECLARE
    v_passenger_id UUID;
BEGIN
    -- Try to find existing passenger
    SELECT id INTO v_passenger_id
    FROM customer_passengers
    WHERE account_id = p_account_id
      AND LOWER(first_name) = LOWER(p_first_name)
      AND LOWER(last_name) = LOWER(p_last_name)
    LIMIT 1;
    
    IF v_passenger_id IS NOT NULL THEN
        -- Update existing passenger
        UPDATE customer_passengers
        SET usage_count = usage_count + 1,
            last_used_at = NOW(),
            phone = COALESCE(p_phone, phone),
            email = COALESCE(p_email, email),
            is_visible = true
        WHERE id = v_passenger_id;
    ELSE
        -- Insert new passenger
        INSERT INTO customer_passengers (account_id, first_name, last_name, phone, email, is_primary, relationship, usage_count, last_used_at)
        VALUES (p_account_id, p_first_name, p_last_name, p_phone, p_email, p_is_primary, p_relationship, 1, NOW())
        RETURNING id INTO v_passenger_id;
    END IF;
    
    RETURN v_passenger_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCTION: Get or create address
-- Used when booking to auto-add new addresses
-- =====================================================
CREATE OR REPLACE FUNCTION upsert_customer_address(
    p_account_id UUID,
    p_full_address TEXT,
    p_label VARCHAR DEFAULT NULL,
    p_address_type VARCHAR DEFAULT 'other',
    p_latitude DECIMAL DEFAULT NULL,
    p_longitude DECIMAL DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_address_id UUID;
BEGIN
    -- Try to find existing address (case-insensitive match)
    SELECT id INTO v_address_id
    FROM customer_addresses
    WHERE account_id = p_account_id
      AND LOWER(full_address) = LOWER(p_full_address)
    LIMIT 1;
    
    IF v_address_id IS NOT NULL THEN
        -- Update existing address
        UPDATE customer_addresses
        SET usage_count = usage_count + 1,
            last_used_at = NOW(),
            is_deleted = false,
            is_visible = true,
            latitude = COALESCE(p_latitude, latitude),
            longitude = COALESCE(p_longitude, longitude)
        WHERE id = v_address_id;
    ELSE
        -- Insert new address
        INSERT INTO customer_addresses (account_id, full_address, label, address_type, latitude, longitude, usage_count, last_used_at)
        VALUES (p_account_id, p_full_address, p_label, p_address_type, p_latitude, p_longitude, 1, NOW())
        RETURNING id INTO v_address_id;
    END IF;
    
    RETURN v_address_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_customer_passengers_name 
    ON customer_passengers(account_id, LOWER(first_name), LOWER(last_name));

CREATE INDEX IF NOT EXISTS idx_customer_addresses_address 
    ON customer_addresses(account_id, LOWER(full_address));

-- =====================================================
-- Done! Additional tables created successfully
-- =====================================================
