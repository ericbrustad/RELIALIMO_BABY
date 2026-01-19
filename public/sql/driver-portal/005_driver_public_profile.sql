-- ============================================================================
-- 005: DRIVER PUBLIC PROFILE
-- Shareable public profile for drivers (optional feature)
-- ============================================================================

-- ===========================================================================
-- DRIVER PUBLIC PROFILE SETTINGS
-- Controls what's visible on public profile page
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.driver_public_profile (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE UNIQUE,
    
    -- Profile enabled?
    is_public BOOLEAN DEFAULT FALSE,
    
    -- Custom URL (separate from portal_slug for public sharing)
    public_slug TEXT UNIQUE,
    
    -- Display info
    display_name TEXT, -- Override for public (vs. legal name)
    tagline TEXT, -- "Professional chauffeur serving NYC since 2015"
    bio TEXT,
    
    -- Profile photo (separate from ID photo)
    profile_photo_url TEXT,
    cover_photo_url TEXT,
    
    -- What to show
    show_rating BOOLEAN DEFAULT TRUE,
    show_trip_count BOOLEAN DEFAULT TRUE,
    show_years_experience BOOLEAN DEFAULT TRUE,
    show_vehicle_info BOOLEAN DEFAULT TRUE,
    show_languages BOOLEAN DEFAULT FALSE,
    show_certifications BOOLEAN DEFAULT FALSE,
    show_service_areas BOOLEAN DEFAULT FALSE,
    
    -- Languages spoken
    languages TEXT[], -- ['English', 'Spanish', 'French']
    
    -- Certifications to display
    certifications JSONB DEFAULT '[]'::jsonb,
    -- [{name: 'CDL Class B', issued: '2020-01-01', expires: '2025-01-01'}]
    
    -- Service areas
    service_areas TEXT[], -- ['NYC', 'Long Island', 'Westchester']
    
    -- Social links (optional)
    social_links JSONB DEFAULT '{}'::jsonb,
    -- {linkedin: '...', instagram: '...'}
    
    -- Contact preferences (for public inquiries)
    allow_direct_contact BOOLEAN DEFAULT FALSE,
    contact_email TEXT,
    contact_phone TEXT,
    
    -- SEO
    meta_title TEXT,
    meta_description TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for public lookups
CREATE INDEX IF NOT EXISTS idx_public_profile_slug 
ON public.driver_public_profile(public_slug) 
WHERE is_public = TRUE;

-- ===========================================================================
-- DRIVER TESTIMONIALS
-- Reviews/testimonials for public profile
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.driver_testimonials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
    
    -- From reservation or manual
    reservation_id UUID REFERENCES public.reservations(id),
    
    -- Testimonial content
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    testimonial_text TEXT,
    
    -- Attribution
    client_name TEXT, -- "John D." or "Anonymous"
    client_company TEXT,
    trip_type TEXT, -- "Airport Transfer", "Corporate Event"
    trip_date DATE,
    
    -- Display settings
    is_approved BOOLEAN DEFAULT FALSE, -- Driver must approve
    is_public BOOLEAN DEFAULT FALSE, -- Show on public profile
    is_featured BOOLEAN DEFAULT FALSE, -- Highlight on profile
    
    -- Timestamps
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    approved_at TIMESTAMPTZ
);

-- Index
CREATE INDEX IF NOT EXISTS idx_testimonials_driver 
ON public.driver_testimonials(driver_id) 
WHERE is_public = TRUE;

-- ===========================================================================
-- DRIVER VEHICLES (For public display)
-- Vehicles driver operates
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.driver_vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
    
    -- Vehicle info
    vehicle_type TEXT, -- 'sedan', 'suv', 'van', 'limo', 'bus'
    make TEXT,
    model TEXT,
    year INTEGER,
    color TEXT,
    
    -- Features
    features TEXT[], -- ['Leather', 'WiFi', 'Water', 'Phone Chargers']
    passenger_capacity INTEGER,
    luggage_capacity INTEGER,
    
    -- Photos
    photos JSONB DEFAULT '[]'::jsonb, -- Array of photo URLs
    
    -- Status
    is_primary BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- For company tracking
    license_plate TEXT,
    vin TEXT,
    
    -- Insurance/registration
    registration_expires DATE,
    insurance_expires DATE,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_driver_vehicles_driver 
ON public.driver_vehicles(driver_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_driver_vehicles_primary 
ON public.driver_vehicles(driver_id) 
WHERE is_primary = TRUE;

-- ===========================================================================
-- PUBLIC PROFILE VIEW (For fast lookups)
-- Calculates trip_count dynamically from reservations table
-- ===========================================================================
CREATE OR REPLACE VIEW public.v_driver_public_profiles AS
SELECT 
    pp.public_slug,
    pp.display_name,
    pp.tagline,
    pp.bio,
    pp.profile_photo_url,
    pp.cover_photo_url,
    pp.languages,
    pp.service_areas,
    pp.social_links,
    pp.allow_direct_contact,
    pp.contact_email,
    -- Stats (only if enabled)
    -- Rating: try column first, fall back to calculated average
    CASE WHEN pp.show_rating THEN 
        COALESCE(
            (SELECT AVG(t.rating)::NUMERIC(3,2) FROM public.driver_testimonials t 
             WHERE t.driver_id = d.id AND t.rating IS NOT NULL),
            0
        )
    END as rating,
    -- Trip count: calculated from completed reservations
    CASE WHEN pp.show_trip_count THEN 
        (SELECT COUNT(*) FROM public.reservations r 
         WHERE r.assigned_driver_id = d.id 
         AND r.status = 'completed')::INTEGER
    END as trip_count,
    CASE WHEN pp.show_years_experience THEN 
        EXTRACT(YEAR FROM AGE(NOW(), d.created_at))::INTEGER 
    END as years_on_platform,
    -- Certifications
    CASE WHEN pp.show_certifications THEN pp.certifications END as certifications,
    -- Featured testimonials
    (
        SELECT jsonb_agg(jsonb_build_object(
            'rating', t.rating,
            'text', t.testimonial_text,
            'client_name', t.client_name,
            'trip_type', t.trip_type
        ))
        FROM public.driver_testimonials t
        WHERE t.driver_id = d.id 
          AND t.is_public = TRUE 
          AND t.is_featured = TRUE
        LIMIT 5
    ) as featured_testimonials,
    -- Primary vehicle
    CASE WHEN pp.show_vehicle_info THEN (
        SELECT jsonb_build_object(
            'type', v.vehicle_type,
            'make', v.make,
            'model', v.model,
            'year', v.year,
            'features', v.features,
            'photos', v.photos
        )
        FROM public.driver_vehicles v
        WHERE v.driver_id = d.id AND v.is_primary = TRUE
        LIMIT 1
    ) END as primary_vehicle
FROM public.driver_public_profile pp
JOIN public.drivers d ON d.id = pp.driver_id
WHERE pp.is_public = TRUE;
