-- =====================================================
-- LOCAL AIRPORTS SETUP
-- Creates a local_airports table for storing airports relevant to
-- the company's service region based on company information.
-- 
-- This table stores airports discovered from the company's local region
-- with comprehensive metadata for flight tracking and customer UX.
--
-- USAGE:
-- - Auto-populates when organization's city/state changes
-- - Can be used as fallback when external airport API fails
-- - Can be set as exclusive source via use_local_airports_only setting
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS postgis;

-- =====================================================
-- LOCAL AIRPORTS TABLE
-- Airports specific to the organization's service region
-- =====================================================
CREATE TABLE IF NOT EXISTS public.local_airports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    
    -- Airport Identification
    iata_code VARCHAR(3) NOT NULL,               -- 3-letter IATA code (e.g., MSP, ORD)
    icao_code VARCHAR(4),                        -- 4-letter ICAO code (e.g., KMSP, KORD)
    faa_code VARCHAR(4),                         -- FAA identifier (may differ from IATA)
    
    -- Basic Info
    name VARCHAR(255) NOT NULL,                  -- Full airport name
    display_name VARCHAR(100),                   -- Short display name for UI
    city VARCHAR(100),
    state VARCHAR(50),
    country VARCHAR(50) DEFAULT 'USA',
    country_code VARCHAR(2) DEFAULT 'US',
    
    -- Location
    address TEXT,                                -- Street address for navigation
    latitude DECIMAL(10, 7),
    longitude DECIMAL(10, 7),
    elevation_ft INTEGER,                        -- Elevation in feet
    
    -- Timezone
    timezone VARCHAR(50),                        -- IANA timezone (e.g., 'America/Chicago')
    utc_offset_hours DECIMAL(4, 2),              -- UTC offset (e.g., -5.00, -6.00)
    observes_dst BOOLEAN DEFAULT true,           -- Does this airport observe DST?
    
    -- Airport Classification
    airport_type VARCHAR(50),                    -- 'large_airport', 'medium_airport', 'small_airport', 'heliport'
    is_international BOOLEAN DEFAULT false,
    is_hub BOOLEAN DEFAULT false,                -- Major hub airport
    
    -- Terminal Information
    terminals_count INTEGER,                     -- Number of terminals
    terminal_info JSONB,                         -- JSON with terminal details
    
    -- Ground Transportation
    pickup_instructions TEXT,                    -- Default pickup instructions for customers
    curbside_pickup_allowed BOOLEAN DEFAULT true,
    rideshare_pickup_location TEXT,              -- Where rideshare/limo pickup is designated
    parking_info JSONB,                          -- Parking options and locations
    
    -- Distance from Company
    distance_from_company_miles DECIMAL(10, 2),  -- Distance from company HQ
    drive_time_minutes INTEGER,                  -- Estimated drive time from company
    is_primary BOOLEAN DEFAULT false,            -- Primary airport for this company
    
    -- Fees and Requirements
    airport_fee DECIMAL(10, 2),                  -- Airport access/pickup fee
    minimum_wait_time_minutes INTEGER,           -- Minimum wait time for pickups
    
    -- Display Settings
    is_active BOOLEAN DEFAULT true,
    is_visible_customer_portal BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    icon VARCHAR(10) DEFAULT '✈️',
    
    -- Contact Information
    airport_phone VARCHAR(20),
    airport_website VARCHAR(255),
    
    -- Flight Data Integration
    supports_flight_tracking BOOLEAN DEFAULT true,
    flight_data_provider VARCHAR(50),            -- e.g., 'flightaware', 'flightradar24'
    
    -- Metadata
    source VARCHAR(50) DEFAULT 'manual',         -- 'manual', 'api', 'import'
    last_verified_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(organization_id, iata_code)
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_local_airports_org ON public.local_airports(organization_id);
CREATE INDEX IF NOT EXISTS idx_local_airports_iata ON public.local_airports(iata_code);
CREATE INDEX IF NOT EXISTS idx_local_airports_active ON public.local_airports(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_local_airports_location ON public.local_airports USING gist(
    ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
);

-- Enable RLS
ALTER TABLE public.local_airports ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "local_airports_select_org" ON public.local_airports
    FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "local_airports_insert_org" ON public.local_airports
    FOR INSERT
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM public.organization_members 
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'dispatcher')
        )
    );

CREATE POLICY "local_airports_update_org" ON public.local_airports
    FOR UPDATE
    USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members 
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'dispatcher')
        )
    );

CREATE POLICY "local_airports_delete_org" ON public.local_airports
    FOR DELETE
    USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members 
            WHERE user_id = auth.uid()
            AND role = 'admin'
        )
    );

-- =====================================================
-- FUNCTION: Populate local airports based on company region
-- Uses company city/state to find nearby airports
-- =====================================================
CREATE OR REPLACE FUNCTION public.populate_local_airports_for_org(
    p_organization_id UUID,
    p_radius_miles INTEGER DEFAULT 100
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_org RECORD;
    v_count INTEGER := 0;
    v_center_point GEOMETRY;
BEGIN
    -- Get organization details
    SELECT * INTO v_org FROM public.organizations WHERE id = p_organization_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Organization not found: %', p_organization_id;
    END IF;
    
    -- For now, insert default major airports based on state
    -- In production, this would use a geocoding API to find airports within radius
    
    -- Clear existing non-primary airports for this org
    DELETE FROM public.local_airports 
    WHERE organization_id = p_organization_id 
    AND is_primary = false;
    
    -- Insert airports based on state
    CASE UPPER(COALESCE(v_org.state, ''))
        WHEN 'MN', 'MINNESOTA' THEN
            INSERT INTO public.local_airports (organization_id, iata_code, name, city, state, latitude, longitude, timezone, is_primary, sort_order)
            VALUES 
                (p_organization_id, 'MSP', 'Minneapolis-St. Paul International Airport', 'Minneapolis', 'MN', 44.8848, -93.2223, 'America/Chicago', true, 1),
                (p_organization_id, 'RST', 'Rochester International Airport', 'Rochester', 'MN', 43.9083, -92.5000, 'America/Chicago', false, 2),
                (p_organization_id, 'DLH', 'Duluth International Airport', 'Duluth', 'MN', 46.8422, -92.1936, 'America/Chicago', false, 3),
                (p_organization_id, 'STC', 'St. Cloud Regional Airport', 'St. Cloud', 'MN', 45.5467, -94.0597, 'America/Chicago', false, 4)
            ON CONFLICT (organization_id, iata_code) DO UPDATE SET updated_at = NOW();
            
        WHEN 'IL', 'ILLINOIS' THEN
            INSERT INTO public.local_airports (organization_id, iata_code, name, city, state, latitude, longitude, timezone, is_primary, sort_order)
            VALUES 
                (p_organization_id, 'ORD', 'O''Hare International Airport', 'Chicago', 'IL', 41.9742, -87.9073, 'America/Chicago', true, 1),
                (p_organization_id, 'MDW', 'Chicago Midway International Airport', 'Chicago', 'IL', 41.7868, -87.7522, 'America/Chicago', false, 2),
                (p_organization_id, 'RFD', 'Chicago Rockford International Airport', 'Rockford', 'IL', 42.1954, -89.0972, 'America/Chicago', false, 3)
            ON CONFLICT (organization_id, iata_code) DO UPDATE SET updated_at = NOW();
            
        WHEN 'WI', 'WISCONSIN' THEN
            INSERT INTO public.local_airports (organization_id, iata_code, name, city, state, latitude, longitude, timezone, is_primary, sort_order)
            VALUES 
                (p_organization_id, 'MKE', 'General Mitchell International Airport', 'Milwaukee', 'WI', 42.9472, -87.8966, 'America/Chicago', true, 1),
                (p_organization_id, 'MSN', 'Dane County Regional Airport', 'Madison', 'WI', 43.1399, -89.3375, 'America/Chicago', false, 2),
                (p_organization_id, 'GRB', 'Green Bay-Austin Straubel International Airport', 'Green Bay', 'WI', 44.4851, -88.1296, 'America/Chicago', false, 3)
            ON CONFLICT (organization_id, iata_code) DO UPDATE SET updated_at = NOW();
            
        WHEN 'MI', 'MICHIGAN' THEN
            INSERT INTO public.local_airports (organization_id, iata_code, name, city, state, latitude, longitude, timezone, is_primary, sort_order)
            VALUES 
                (p_organization_id, 'DTW', 'Detroit Metropolitan Airport', 'Detroit', 'MI', 42.2162, -83.3554, 'America/Detroit', true, 1),
                (p_organization_id, 'GRR', 'Gerald R. Ford International Airport', 'Grand Rapids', 'MI', 42.8808, -85.5228, 'America/Detroit', false, 2),
                (p_organization_id, 'FNT', 'Bishop International Airport', 'Flint', 'MI', 42.9654, -83.7436, 'America/Detroit', false, 3)
            ON CONFLICT (organization_id, iata_code) DO UPDATE SET updated_at = NOW();
            
        WHEN 'IA', 'IOWA' THEN
            INSERT INTO public.local_airports (organization_id, iata_code, name, city, state, latitude, longitude, timezone, is_primary, sort_order)
            VALUES 
                (p_organization_id, 'DSM', 'Des Moines International Airport', 'Des Moines', 'IA', 41.5339, -93.6631, 'America/Chicago', true, 1),
                (p_organization_id, 'CID', 'The Eastern Iowa Airport', 'Cedar Rapids', 'IA', 41.8847, -91.7108, 'America/Chicago', false, 2)
            ON CONFLICT (organization_id, iata_code) DO UPDATE SET updated_at = NOW();
            
        WHEN 'ND', 'NORTH DAKOTA' THEN
            INSERT INTO public.local_airports (organization_id, iata_code, name, city, state, latitude, longitude, timezone, is_primary, sort_order)
            VALUES 
                (p_organization_id, 'FAR', 'Hector International Airport', 'Fargo', 'ND', 46.9207, -96.8158, 'America/Chicago', true, 1),
                (p_organization_id, 'BIS', 'Bismarck Airport', 'Bismarck', 'ND', 46.7727, -100.7463, 'America/Chicago', false, 2)
            ON CONFLICT (organization_id, iata_code) DO UPDATE SET updated_at = NOW();
            
        WHEN 'SD', 'SOUTH DAKOTA' THEN
            INSERT INTO public.local_airports (organization_id, iata_code, name, city, state, latitude, longitude, timezone, is_primary, sort_order)
            VALUES 
                (p_organization_id, 'FSD', 'Sioux Falls Regional Airport', 'Sioux Falls', 'SD', 43.5820, -96.7418, 'America/Chicago', true, 1),
                (p_organization_id, 'RAP', 'Rapid City Regional Airport', 'Rapid City', 'SD', 44.0453, -103.0574, 'America/Denver', false, 2)
            ON CONFLICT (organization_id, iata_code) DO UPDATE SET updated_at = NOW();
            
        ELSE
            -- Default: Insert major US hubs that are commonly used
            INSERT INTO public.local_airports (organization_id, iata_code, name, city, state, latitude, longitude, timezone, sort_order)
            VALUES 
                (p_organization_id, 'ATL', 'Hartsfield-Jackson Atlanta International Airport', 'Atlanta', 'GA', 33.6407, -84.4277, 'America/New_York', 1),
                (p_organization_id, 'DFW', 'Dallas/Fort Worth International Airport', 'Dallas', 'TX', 32.8998, -97.0403, 'America/Chicago', 2),
                (p_organization_id, 'DEN', 'Denver International Airport', 'Denver', 'CO', 39.8561, -104.6737, 'America/Denver', 3),
                (p_organization_id, 'LAX', 'Los Angeles International Airport', 'Los Angeles', 'CA', 33.9425, -118.4081, 'America/Los_Angeles', 4),
                (p_organization_id, 'JFK', 'John F. Kennedy International Airport', 'New York', 'NY', 40.6413, -73.7781, 'America/New_York', 5)
            ON CONFLICT (organization_id, iata_code) DO UPDATE SET updated_at = NOW();
    END CASE;
    
    -- Get count of airports inserted
    SELECT COUNT(*) INTO v_count FROM public.local_airports WHERE organization_id = p_organization_id;
    
    RETURN v_count;
END;
$$;

-- =====================================================
-- TRIGGER: Auto-update timestamps
-- =====================================================
CREATE OR REPLACE FUNCTION update_local_airports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_local_airports_updated_at ON public.local_airports;
CREATE TRIGGER update_local_airports_updated_at
    BEFORE UPDATE ON public.local_airports
    FOR EACH ROW
    EXECUTE FUNCTION update_local_airports_updated_at();

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE public.local_airports IS 'Airports specific to each organization''s service region';
COMMENT ON COLUMN public.local_airports.iata_code IS 'Standard 3-letter IATA airport code';
COMMENT ON COLUMN public.local_airports.icao_code IS 'Standard 4-letter ICAO airport code';
COMMENT ON COLUMN public.local_airports.is_primary IS 'Primary airport for this organization''s region';
COMMENT ON COLUMN public.local_airports.distance_from_company_miles IS 'Calculated distance from company headquarters';
COMMENT ON COLUMN public.local_airports.airport_fee IS 'Per-trip fee for airport pickups/dropoffs';
COMMENT ON COLUMN public.local_airports.terminal_info IS 'JSON object with terminal-specific pickup instructions';
COMMENT ON FUNCTION public.populate_local_airports_for_org IS 'Populates local airports based on organization state/region';

-- =====================================================
-- TRIGGER: Auto-populate airports when organization info changes
-- Fires when city or state is updated on organizations table
-- =====================================================
CREATE OR REPLACE FUNCTION public.on_organization_location_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Only trigger if city or state actually changed
    IF (OLD.city IS DISTINCT FROM NEW.city) OR (OLD.state IS DISTINCT FROM NEW.state) THEN
        -- Log the change
        RAISE NOTICE 'Organization location changed for %: % % -> % %', 
            NEW.id, OLD.city, OLD.state, NEW.city, NEW.state;
        
        -- Populate local airports for this organization
        PERFORM public.populate_local_airports_for_org(NEW.id);
        
        -- Update the last_airports_refresh timestamp
        UPDATE public.organizations 
        SET updated_at = NOW()
        WHERE id = NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_org_location_change ON public.organizations;
CREATE TRIGGER trigger_org_location_change
    AFTER UPDATE OF city, state ON public.organizations
    FOR EACH ROW
    EXECUTE FUNCTION public.on_organization_location_change();

-- Also trigger on INSERT for new organizations
CREATE OR REPLACE FUNCTION public.on_organization_created()
RETURNS TRIGGER AS $$
BEGIN
    -- Populate local airports for new organization if they have location info
    IF NEW.city IS NOT NULL OR NEW.state IS NOT NULL THEN
        PERFORM public.populate_local_airports_for_org(NEW.id);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_org_created ON public.organizations;
CREATE TRIGGER trigger_org_created
    AFTER INSERT ON public.organizations
    FOR EACH ROW
    EXECUTE FUNCTION public.on_organization_created();

-- =====================================================
-- SETTINGS TABLE: Airport source preferences
-- Controls whether to use local airports exclusively
-- =====================================================
CREATE TABLE IF NOT EXISTS public.airport_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE UNIQUE,
    
    -- Source preferences
    use_local_airports_only BOOLEAN DEFAULT false,     -- If true, only use local_airports table
    fallback_to_local BOOLEAN DEFAULT true,            -- If true, fallback to local when API fails
    
    -- Refresh settings
    auto_refresh_on_location_change BOOLEAN DEFAULT true,
    last_refresh_at TIMESTAMP WITH TIME ZONE,
    refresh_source VARCHAR(50),                         -- 'auto', 'manual', 'api'
    
    -- Validation
    last_validated_at TIMESTAMP WITH TIME ZONE,
    is_validated BOOLEAN DEFAULT false,
    validation_notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.airport_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "airport_settings_org_access" ON public.airport_settings
    FOR ALL
    USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members 
            WHERE user_id = auth.uid()
        )
    );

-- =====================================================
-- FUNCTION: Get airports for organization
-- Returns local airports, with fallback logic
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_airports_for_org(
    p_organization_id UUID,
    p_force_local BOOLEAN DEFAULT false
)
RETURNS TABLE (
    id UUID,
    iata_code VARCHAR(3),
    icao_code VARCHAR(4),
    name VARCHAR(255),
    display_name VARCHAR(100),
    city VARCHAR(100),
    state VARCHAR(50),
    country VARCHAR(50),
    latitude DECIMAL(10, 7),
    longitude DECIMAL(10, 7),
    timezone VARCHAR(50),
    is_international BOOLEAN,
    is_primary BOOLEAN,
    airport_fee DECIMAL(10, 2),
    pickup_instructions TEXT,
    sort_order INTEGER,
    source VARCHAR(20)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_use_local BOOLEAN;
    v_fallback BOOLEAN;
BEGIN
    -- Check settings
    SELECT 
        COALESCE(use_local_airports_only, false),
        COALESCE(fallback_to_local, true)
    INTO v_use_local, v_fallback
    FROM public.airport_settings
    WHERE organization_id = p_organization_id;
    
    -- If no settings found, use defaults
    IF NOT FOUND THEN
        v_use_local := false;
        v_fallback := true;
    END IF;
    
    -- Return local airports if forced or setting is enabled
    IF p_force_local OR v_use_local THEN
        RETURN QUERY
        SELECT 
            la.id,
            la.iata_code,
            la.icao_code,
            la.name,
            la.display_name,
            la.city,
            la.state,
            la.country,
            la.latitude,
            la.longitude,
            la.timezone,
            la.is_international,
            la.is_primary,
            la.airport_fee,
            la.pickup_instructions,
            la.sort_order,
            'local'::VARCHAR(20) as source
        FROM public.local_airports la
        WHERE la.organization_id = p_organization_id
          AND la.is_active = true
        ORDER BY la.is_primary DESC, la.sort_order ASC, la.name ASC;
    ELSE
        -- Return local airports as fallback source
        -- (JavaScript will try external API first, then call this)
        RETURN QUERY
        SELECT 
            la.id,
            la.iata_code,
            la.icao_code,
            la.name,
            la.display_name,
            la.city,
            la.state,
            la.country,
            la.latitude,
            la.longitude,
            la.timezone,
            la.is_international,
            la.is_primary,
            la.airport_fee,
            la.pickup_instructions,
            la.sort_order,
            'local_fallback'::VARCHAR(20) as source
        FROM public.local_airports la
        WHERE la.organization_id = p_organization_id
          AND la.is_active = true
        ORDER BY la.is_primary DESC, la.sort_order ASC, la.name ASC;
    END IF;
END;
$$;

-- =====================================================
-- FUNCTION: Validate and refresh local airports
-- Can be called manually or via cron
-- =====================================================
CREATE OR REPLACE FUNCTION public.refresh_local_airports(
    p_organization_id UUID,
    p_source VARCHAR(50) DEFAULT 'manual'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INTEGER;
    v_result JSONB;
BEGIN
    -- Repopulate airports
    v_count := public.populate_local_airports_for_org(p_organization_id);
    
    -- Update settings
    INSERT INTO public.airport_settings (organization_id, last_refresh_at, refresh_source)
    VALUES (p_organization_id, NOW(), p_source)
    ON CONFLICT (organization_id) DO UPDATE SET
        last_refresh_at = NOW(),
        refresh_source = p_source,
        updated_at = NOW();
    
    -- Build result
    v_result := jsonb_build_object(
        'success', true,
        'airports_count', v_count,
        'refreshed_at', NOW(),
        'source', p_source,
        'organization_id', p_organization_id
    );
    
    RETURN v_result;
END;
$$;

-- =====================================================
-- EXAMPLE: Populate airports for an organization
-- =====================================================
-- SELECT populate_local_airports_for_org('your-org-uuid-here');
-- SELECT refresh_local_airports('your-org-uuid-here', 'manual');
-- SELECT * FROM get_airports_for_org('your-org-uuid-here');

-- =====================================================
-- VIEW: Active local airports with organization info
-- =====================================================
CREATE OR REPLACE VIEW public.v_local_airports AS
SELECT 
    la.*,
    o.name as organization_name,
    o.city as company_city,
    o.state as company_state,
    ast.use_local_airports_only,
    ast.fallback_to_local,
    ast.last_refresh_at,
    ast.is_validated
FROM public.local_airports la
JOIN public.organizations o ON la.organization_id = o.id
LEFT JOIN public.airport_settings ast ON la.organization_id = ast.organization_id
WHERE la.is_active = true
ORDER BY la.is_primary DESC, la.sort_order ASC, la.name ASC;

COMMENT ON VIEW public.v_local_airports IS 'View of active local airports with organization details and settings';

