-- Customer Portal Database Tables Migration
-- Run this in Supabase SQL Editor

-- =====================================================
-- PORTAL SETTINGS TABLE
-- Stores portal branding and configuration
-- =====================================================
CREATE TABLE IF NOT EXISTS portal_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    portal_type VARCHAR(20) NOT NULL CHECK (portal_type IN ('customer', 'driver')),
    
    -- Branding
    logo_url TEXT,
    header_text VARCHAR(255),
    primary_color VARCHAR(7) DEFAULT '#4f46e5',
    accent_color VARCHAR(7) DEFAULT '#818cf8',
    
    -- Messages
    welcome_message TEXT,
    thank_you_message TEXT DEFAULT 'Thank you for riding with us!',
    
    -- Links
    google_review_url TEXT,
    terms_url TEXT,
    privacy_url TEXT,
    
    -- Geofence Settings
    geofence_radius_meters INTEGER DEFAULT 25,
    auto_complete_enabled BOOLEAN DEFAULT true,
    
    -- Map Settings
    map_center_lat DECIMAL(10, 7),
    map_center_lng DECIMAL(10, 7),
    map_zoom_level INTEGER DEFAULT 10,
    service_radius_miles INTEGER DEFAULT 50,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create unique constraint for portal_type
CREATE UNIQUE INDEX IF NOT EXISTS idx_portal_settings_type ON portal_settings(portal_type);

-- Insert default settings if not exists
INSERT INTO portal_settings (portal_type, header_text, welcome_message)
VALUES 
    ('customer', 'RELIALIMO', 'Welcome to your personal booking portal'),
    ('driver', 'RELIALIMO Driver Portal', 'Welcome, Driver!')
ON CONFLICT (portal_type) DO NOTHING;

-- =====================================================
-- AIRPORTS TABLE
-- Airport list for booking pickups/dropoffs
-- =====================================================
CREATE TABLE IF NOT EXISTS airports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    code VARCHAR(10) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    city VARCHAR(100),
    state VARCHAR(50),
    country VARCHAR(50) DEFAULT 'USA',
    latitude DECIMAL(10, 7),
    longitude DECIMAL(10, 7),
    timezone VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert common airports
INSERT INTO airports (code, name, city, state, latitude, longitude, display_order) VALUES
    ('MSP', 'Minneapolis-St. Paul International Airport', 'Minneapolis', 'MN', 44.8848, -93.2223, 1),
    ('ORD', 'O''Hare International Airport', 'Chicago', 'IL', 41.9742, -87.9073, 2),
    ('MDW', 'Chicago Midway International Airport', 'Chicago', 'IL', 41.7868, -87.7522, 3),
    ('DTW', 'Detroit Metropolitan Airport', 'Detroit', 'MI', 42.2162, -83.3554, 4),
    ('MKE', 'General Mitchell International Airport', 'Milwaukee', 'WI', 42.9472, -87.8966, 5)
ON CONFLICT (code) DO NOTHING;

-- =====================================================
-- VEHICLE TYPES TABLE
-- Available vehicle types for booking
-- =====================================================
CREATE TABLE IF NOT EXISTS vehicle_types (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(10) DEFAULT '🚗',
    max_passengers INTEGER DEFAULT 4,
    max_luggage INTEGER DEFAULT 4,
    base_rate DECIMAL(10, 2),
    per_mile_rate DECIMAL(10, 2),
    per_hour_rate DECIMAL(10, 2),
    minimum_fare DECIMAL(10, 2),
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default vehicle types
INSERT INTO vehicle_types (name, description, icon, max_passengers, max_luggage, display_order) VALUES
    ('Sedan', 'Luxury sedan for up to 3 passengers', '🚗', 3, 3, 1),
    ('SUV', 'Premium SUV for up to 6 passengers', '🚙', 6, 6, 2),
    ('Executive Van', 'Spacious van for groups up to 10', '🚐', 10, 10, 3),
    ('Stretch Limo', 'Classic stretch limousine', '🚕', 8, 4, 4),
    ('Party Bus', 'Party bus for special events', '🚌', 20, 10, 5)
ON CONFLICT DO NOTHING;

-- =====================================================
-- CUSTOMER PASSENGERS TABLE
-- Saved passenger profiles for quick booking
-- =====================================================
CREATE TABLE IF NOT EXISTS customer_passengers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    account_id UUID NOT NULL,
    
    -- Passenger Info
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255),
    
    -- Preferences
    is_primary BOOLEAN DEFAULT false,
    notes TEXT,
    
    -- Metadata
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_customer_passengers_account ON customer_passengers(account_id);

-- =====================================================
-- CUSTOMER ADDRESSES TABLE
-- Saved addresses for quick booking
-- =====================================================
CREATE TABLE IF NOT EXISTS customer_addresses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    account_id UUID NOT NULL,
    
    -- Address Info
    label VARCHAR(100), -- "Home", "Office", etc.
    full_address TEXT NOT NULL,
    street VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(50),
    zip VARCHAR(20),
    country VARCHAR(50) DEFAULT 'USA',
    
    -- Location
    latitude DECIMAL(10, 7),
    longitude DECIMAL(10, 7),
    
    -- Type
    address_type VARCHAR(20) DEFAULT 'other', -- 'home', 'work', 'airport', 'other'
    is_favorite BOOLEAN DEFAULT false,
    
    -- Usage tracking
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    is_deleted BOOLEAN DEFAULT false, -- Soft delete
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_customer_addresses_account ON customer_addresses(account_id);
CREATE INDEX IF NOT EXISTS idx_customer_addresses_deleted ON customer_addresses(account_id, is_deleted);

-- =====================================================
-- TRIP FEEDBACK TABLE
-- Customer ratings, tips, and reviews
-- =====================================================
CREATE TABLE IF NOT EXISTS trip_feedback (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    reservation_id BIGINT NOT NULL,
    account_id UUID,
    driver_id BIGINT,
    
    -- Rating
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    
    -- Tip
    tip_amount DECIMAL(10, 2) DEFAULT 0,
    tip_percentage INTEGER,
    
    -- Review
    review_text TEXT,
    review_submitted_to_google BOOLEAN DEFAULT false,
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'completed', 'skipped'
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_trip_feedback_reservation ON trip_feedback(reservation_id);
CREATE INDEX IF NOT EXISTS idx_trip_feedback_driver ON trip_feedback(driver_id);

-- =====================================================
-- DRIVER LOCATIONS TABLE
-- Real-time driver location tracking
-- =====================================================
CREATE TABLE IF NOT EXISTS driver_locations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    driver_id BIGINT NOT NULL,
    reservation_id BIGINT,
    
    -- Location
    latitude DECIMAL(10, 7) NOT NULL,
    longitude DECIMAL(10, 7) NOT NULL,
    accuracy DECIMAL(6, 2), -- meters
    heading DECIMAL(5, 2), -- degrees
    speed DECIMAL(6, 2), -- km/h
    
    -- Status
    status VARCHAR(50), -- 'en_route', 'arrived', 'in_progress', etc.
    
    -- Metadata
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_driver_locations_driver ON driver_locations(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_locations_reservation ON driver_locations(reservation_id);
CREATE INDEX IF NOT EXISTS idx_driver_locations_time ON driver_locations(recorded_at DESC);

-- Cleanup old locations (keep last 24 hours)
-- Run this periodically via cron or scheduled function
-- DELETE FROM driver_locations WHERE recorded_at < NOW() - INTERVAL '24 hours';

-- =====================================================
-- CUSTOMER PREFERENCES TABLE
-- Customer portal preferences
-- =====================================================
CREATE TABLE IF NOT EXISTS customer_preferences (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    account_id UUID NOT NULL UNIQUE,
    
    -- Notification Preferences
    sms_notifications BOOLEAN DEFAULT true,
    email_notifications BOOLEAN DEFAULT true,
    push_notifications BOOLEAN DEFAULT true,
    
    -- Tracking Preferences
    show_driver_tracking BOOLEAN DEFAULT true,
    auto_open_tracking BOOLEAN DEFAULT true,
    
    -- Payment Preferences
    default_tip_percentage INTEGER DEFAULT 20,
    save_payment_method BOOLEAN DEFAULT false,
    
    -- Display Preferences
    dark_mode BOOLEAN DEFAULT true,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_customer_preferences_account ON customer_preferences(account_id);

-- =====================================================
-- RLS POLICIES (Row Level Security)
-- =====================================================

-- Enable RLS on tables
ALTER TABLE customer_passengers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_feedback ENABLE ROW LEVEL SECURITY;

-- Note: You'll need to create appropriate policies based on your auth setup
-- Example policy for customer_passengers:
-- CREATE POLICY "Users can view their own passengers"
--     ON customer_passengers FOR SELECT
--     USING (auth.uid() = account_id);

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to update 'updated_at' timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to all tables
CREATE TRIGGER update_portal_settings_updated_at
    BEFORE UPDATE ON portal_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_airports_updated_at
    BEFORE UPDATE ON airports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vehicle_types_updated_at
    BEFORE UPDATE ON vehicle_types
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customer_passengers_updated_at
    BEFORE UPDATE ON customer_passengers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customer_addresses_updated_at
    BEFORE UPDATE ON customer_addresses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trip_feedback_updated_at
    BEFORE UPDATE ON trip_feedback
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customer_preferences_updated_at
    BEFORE UPDATE ON customer_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- VIEWS (Optional)
-- =====================================================

-- View for active airports with formatted display
CREATE OR REPLACE VIEW v_active_airports AS
SELECT 
    id,
    code,
    name,
    city || ', ' || state AS location,
    latitude,
    longitude
FROM airports
WHERE is_active = true
ORDER BY display_order, name;

-- View for active vehicle types
CREATE OR REPLACE VIEW v_active_vehicle_types AS
SELECT 
    id,
    name,
    description,
    icon,
    max_passengers,
    max_luggage,
    base_rate,
    per_mile_rate
FROM vehicle_types
WHERE is_active = true
ORDER BY display_order, name;

-- =====================================================
-- GRANT PERMISSIONS (adjust based on your needs)
-- =====================================================
-- GRANT SELECT ON v_active_airports TO authenticated;
-- GRANT SELECT ON v_active_vehicle_types TO authenticated;
-- GRANT ALL ON customer_passengers TO authenticated;
-- GRANT ALL ON customer_addresses TO authenticated;
-- GRANT ALL ON customer_preferences TO authenticated;
-- GRANT INSERT, SELECT ON trip_feedback TO authenticated;
-- GRANT SELECT ON portal_settings TO authenticated;
