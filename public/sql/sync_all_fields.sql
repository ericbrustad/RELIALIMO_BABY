-- =====================================================
-- SUPABASE MIGRATION: Sync all fields for Drivers, Affiliates, Vehicle Types, Vehicles
-- Run this in the Supabase SQL editor to ensure all columns used in the app exist
-- =====================================================

-- ============================================================================
-- DRIVERS TABLE - Add missing columns
-- ============================================================================

DO $$
BEGIN
    -- is_active: Boolean flag for employment status (mirrors status = 'ACTIVE')
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'is_active') THEN
        ALTER TABLE public.drivers ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
        -- Sync existing records
        UPDATE public.drivers SET is_active = (status = 'ACTIVE');
    END IF;

    -- driver_status: Availability status for dispatch (available, enroute, arrived, passenger_onboard, busy, offline)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'driver_status') THEN
        ALTER TABLE public.drivers ADD COLUMN driver_status TEXT DEFAULT 'available';
    END IF;

    -- affiliate_id: Link to affiliates table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'affiliate_id') THEN
        ALTER TABLE public.drivers ADD COLUMN affiliate_id UUID REFERENCES public.affiliates(id) ON DELETE SET NULL;
    END IF;

    -- affiliate_name: Cached affiliate company name for display
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'affiliate_name') THEN
        ALTER TABLE public.drivers ADD COLUMN affiliate_name TEXT;
    END IF;

    -- tlc_license_number: Ensure this column exists (replaces legacy tlc_license)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'tlc_license_number') THEN
        ALTER TABLE public.drivers ADD COLUMN tlc_license_number TEXT;
    END IF;

    -- password_hash: For driver portal login (separate from Supabase Auth)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'password_hash') THEN
        ALTER TABLE public.drivers ADD COLUMN password_hash TEXT;
    END IF;

    -- Rename legacy tlc_license to tlc_license_number if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'tlc_license')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'tlc_license_number') THEN
        ALTER TABLE public.drivers RENAME COLUMN tlc_license TO tlc_license_number;
    END IF;

    RAISE NOTICE 'Drivers table columns synchronized';
END $$;

-- Create index for affiliate lookups
CREATE INDEX IF NOT EXISTS drivers_affiliate_idx ON public.drivers (affiliate_id);
CREATE INDEX IF NOT EXISTS drivers_status_idx ON public.drivers (status);
CREATE INDEX IF NOT EXISTS drivers_driver_status_idx ON public.drivers (driver_status);

-- ============================================================================
-- AFFILIATES TABLE - Add missing columns  
-- ============================================================================

DO $$
BEGIN
    -- associated_driver_ids: Array of driver UUIDs linked to this affiliate
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' AND table_name = 'affiliates' AND column_name = 'associated_driver_ids') THEN
        ALTER TABLE public.affiliates ADD COLUMN associated_driver_ids UUID[] DEFAULT ARRAY[]::UUID[];
    END IF;

    -- associated_vehicle_type_ids: Array of vehicle type UUIDs this affiliate can service
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' AND table_name = 'affiliates' AND column_name = 'associated_vehicle_type_ids') THEN
        ALTER TABLE public.affiliates ADD COLUMN associated_vehicle_type_ids UUID[] DEFAULT ARRAY[]::UUID[];
    END IF;

    -- is_active: Boolean convenience flag
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' AND table_name = 'affiliates' AND column_name = 'is_active') THEN
        ALTER TABLE public.affiliates ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
        UPDATE public.affiliates SET is_active = (status = 'ACTIVE');
    END IF;

    RAISE NOTICE 'Affiliates table columns synchronized';
END $$;

-- ============================================================================
-- VEHICLE_TYPES TABLE - Add missing columns
-- ============================================================================

DO $$
BEGIN
    -- service_type: Legacy single service type field (for backward compatibility)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' AND table_name = 'vehicle_types' AND column_name = 'service_type') THEN
        ALTER TABLE public.vehicle_types ADD COLUMN service_type TEXT;
    END IF;

    -- rates: JSONB field for storing rate matrices inline (alternative to separate tables)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' AND table_name = 'vehicle_types' AND column_name = 'rates') THEN
        ALTER TABLE public.vehicle_types ADD COLUMN rates JSONB DEFAULT '{}'::JSONB;
    END IF;

    -- active: Legacy boolean field (some code may still use this)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' AND table_name = 'vehicle_types' AND column_name = 'active') THEN
        ALTER TABLE public.vehicle_types ADD COLUMN active BOOLEAN DEFAULT TRUE;
        UPDATE public.vehicle_types SET active = (status = 'ACTIVE');
    END IF;

    RAISE NOTICE 'Vehicle types table columns synchronized';
END $$;

-- ============================================================================
-- VEHICLES (FLEET) TABLE - Add missing columns
-- ============================================================================

DO $$
BEGIN
    -- veh_type: Alternative field name for vehicle type (display name)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' AND table_name = 'vehicles' AND column_name = 'veh_type') THEN
        ALTER TABLE public.vehicles ADD COLUMN veh_type TEXT;
    END IF;

    -- veh_pax_capacity: Alternative field name for passenger capacity
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' AND table_name = 'vehicles' AND column_name = 'veh_pax_capacity') THEN
        ALTER TABLE public.vehicles ADD COLUMN veh_pax_capacity INTEGER;
    END IF;

    -- veh_disp_name: Display name for vehicle (Year Make Model)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' AND table_name = 'vehicles' AND column_name = 'veh_disp_name') THEN
        ALTER TABLE public.vehicles ADD COLUMN veh_disp_name TEXT;
    END IF;

    -- features: Array of feature strings (WiFi, Leather Seats, etc.)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' AND table_name = 'vehicles' AND column_name = 'features') THEN
        ALTER TABLE public.vehicles ADD COLUMN features TEXT[] DEFAULT ARRAY[]::TEXT[];
    END IF;

    -- vehicle_type: Text field for vehicle type name (alternative to vehicle_type_id)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' AND table_name = 'vehicles' AND column_name = 'vehicle_type') THEN
        ALTER TABLE public.vehicles ADD COLUMN vehicle_type TEXT;
    END IF;

    -- registration_expiration: Alternative field name for registration_expires_on
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' AND table_name = 'vehicles' AND column_name = 'registration_expiration') THEN
        ALTER TABLE public.vehicles ADD COLUMN registration_expiration DATE;
    END IF;

    -- insurance_expiration: Alternative field name for insurance_expires_on
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' AND table_name = 'vehicles' AND column_name = 'insurance_expiration') THEN
        ALTER TABLE public.vehicles ADD COLUMN insurance_expiration DATE;
    END IF;

    -- is_active: Boolean convenience flag
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' AND table_name = 'vehicles' AND column_name = 'is_active') THEN
        ALTER TABLE public.vehicles ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
        UPDATE public.vehicles SET is_active = (status = 'ACTIVE');
    END IF;

    RAISE NOTICE 'Vehicles table columns synchronized';
END $$;

-- ============================================================================
-- SYNC TRIGGERS: Keep is_active in sync with status
-- ============================================================================

-- Drivers: Sync is_active with status
CREATE OR REPLACE FUNCTION sync_driver_is_active()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        NEW.is_active := (NEW.status = 'ACTIVE');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_driver_is_active_trigger ON public.drivers;
CREATE TRIGGER sync_driver_is_active_trigger
    BEFORE UPDATE ON public.drivers
    FOR EACH ROW
    EXECUTE FUNCTION sync_driver_is_active();

-- Affiliates: Sync is_active with status
CREATE OR REPLACE FUNCTION sync_affiliate_is_active()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        NEW.is_active := (NEW.status = 'ACTIVE');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_affiliate_is_active_trigger ON public.affiliates;
CREATE TRIGGER sync_affiliate_is_active_trigger
    BEFORE UPDATE ON public.affiliates
    FOR EACH ROW
    EXECUTE FUNCTION sync_affiliate_is_active();

-- Vehicle Types: Sync active with status
CREATE OR REPLACE FUNCTION sync_vehicle_type_active()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        NEW.active := (NEW.status = 'ACTIVE');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_vehicle_type_active_trigger ON public.vehicle_types;
CREATE TRIGGER sync_vehicle_type_active_trigger
    BEFORE UPDATE ON public.vehicle_types
    FOR EACH ROW
    EXECUTE FUNCTION sync_vehicle_type_active();

-- Vehicles: Sync is_active with status
CREATE OR REPLACE FUNCTION sync_vehicle_is_active()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        NEW.is_active := (NEW.status = 'ACTIVE');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_vehicle_is_active_trigger ON public.vehicles;
CREATE TRIGGER sync_vehicle_is_active_trigger
    BEFORE UPDATE ON public.vehicles
    FOR EACH ROW
    EXECUTE FUNCTION sync_vehicle_is_active();

-- ============================================================================
-- VERIFY: Show all columns for each table
-- ============================================================================

SELECT 'DRIVERS' as table_name, column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'drivers'
ORDER BY ordinal_position;

SELECT 'AFFILIATES' as table_name, column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'affiliates'
ORDER BY ordinal_position;

SELECT 'VEHICLE_TYPES' as table_name, column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'vehicle_types'
ORDER BY ordinal_position;

SELECT 'VEHICLES' as table_name, column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'vehicles'
ORDER BY ordinal_position;

-- ============================================================================
-- RLS POLICIES: Allow driver registration from anonymous users
-- ============================================================================

-- Enable RLS on drivers table (if not already enabled)
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

-- Allow anonymous users to INSERT new driver records (for registration)
DROP POLICY IF EXISTS drivers_anon_insert ON public.drivers;
CREATE POLICY drivers_anon_insert ON public.drivers
    FOR INSERT
    TO anon
    WITH CHECK (true);

-- Allow anonymous users to SELECT drivers (needed to check email uniqueness)
DROP POLICY IF EXISTS drivers_anon_select ON public.drivers;
CREATE POLICY drivers_anon_select ON public.drivers
    FOR SELECT
    TO anon
    USING (true);

-- Allow authenticated users full access to drivers
DROP POLICY IF EXISTS drivers_auth_all ON public.drivers;
CREATE POLICY drivers_auth_all ON public.drivers
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Same for affiliates table (needed for company matching during registration)
ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS affiliates_anon_select ON public.affiliates;
CREATE POLICY affiliates_anon_select ON public.affiliates
    FOR SELECT
    TO anon
    USING (true);

DROP POLICY IF EXISTS affiliates_anon_insert ON public.affiliates;
CREATE POLICY affiliates_anon_insert ON public.affiliates
    FOR INSERT
    TO anon
    WITH CHECK (true);

DROP POLICY IF EXISTS affiliates_auth_all ON public.affiliates;
CREATE POLICY affiliates_auth_all ON public.affiliates
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- RLS for vehicles table (needed for driver registration vehicle creation)
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vehicles_anon_select ON public.vehicles;
CREATE POLICY vehicles_anon_select ON public.vehicles
    FOR SELECT
    TO anon
    USING (true);

DROP POLICY IF EXISTS vehicles_anon_insert ON public.vehicles;
CREATE POLICY vehicles_anon_insert ON public.vehicles
    FOR INSERT
    TO anon
    WITH CHECK (true);

DROP POLICY IF EXISTS vehicles_auth_all ON public.vehicles;
CREATE POLICY vehicles_auth_all ON public.vehicles
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- ✅ All table columns have been synchronized!
