-- ============================================================================
-- 001: DRIVER PORTAL CORE SCHEMA
-- Ensures all driver portal fields exist
-- Run this FIRST in Supabase SQL Editor
-- ============================================================================

-- ===========================================================================
-- PORTAL SLUG (Unique URL: driver.relialimo.com/{portal_slug})
-- ===========================================================================
ALTER TABLE public.drivers 
ADD COLUMN IF NOT EXISTS portal_slug TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_drivers_portal_slug 
ON public.drivers(portal_slug) 
WHERE portal_slug IS NOT NULL;

COMMENT ON COLUMN public.drivers.portal_slug IS 'Unique URL slug for driver portal: driver.relialimo.com/{portal_slug}';

-- ===========================================================================
-- PROFILE FIELDS
-- ===========================================================================
ALTER TABLE public.drivers 
ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;

ALTER TABLE public.drivers 
ADD COLUMN IF NOT EXISTS bio TEXT;

ALTER TABLE public.drivers 
ADD COLUMN IF NOT EXISTS years_experience TEXT;

ALTER TABLE public.drivers 
ADD COLUMN IF NOT EXISTS languages JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.drivers 
ADD COLUMN IF NOT EXISTS specialties JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.drivers 
ADD COLUMN IF NOT EXISTS certifications JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.drivers 
ADD COLUMN IF NOT EXISTS availability_preferences JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.drivers 
ADD COLUMN IF NOT EXISTS service_areas TEXT;

-- ===========================================================================
-- PORTAL SETTINGS (JSON blob for UI preferences)
-- ===========================================================================
ALTER TABLE public.drivers 
ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.drivers.settings IS 'JSON: {notifications, navigation, tripPreferences, privacy, theme}';

-- ===========================================================================
-- COMPANY LINK (for drivers who work for a company)
-- ===========================================================================
ALTER TABLE public.drivers 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.affiliates(id) ON DELETE SET NULL;

ALTER TABLE public.drivers 
ADD COLUMN IF NOT EXISTS company_role TEXT DEFAULT 'driver'; -- driver, owner, admin

-- ===========================================================================
-- ONLINE/OFFLINE STATUS FOR DISPATCH
-- ===========================================================================
ALTER TABLE public.drivers 
ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT FALSE;

ALTER TABLE public.drivers 
ADD COLUMN IF NOT EXISTS last_online_at TIMESTAMPTZ;

ALTER TABLE public.drivers 
ADD COLUMN IF NOT EXISTS current_location JSONB; -- {lat, lng, accuracy, updated_at}

-- ===========================================================================
-- RATING & PRIORITY (for dispatch sorting)
-- ===========================================================================
ALTER TABLE public.drivers 
ADD COLUMN IF NOT EXISTS rating NUMERIC(3,2) DEFAULT 5.00;

ALTER TABLE public.drivers 
ADD COLUMN IF NOT EXISTS total_trips INTEGER DEFAULT 0;

ALTER TABLE public.drivers 
ADD COLUMN IF NOT EXISTS completed_trips INTEGER DEFAULT 0;

ALTER TABLE public.drivers 
ADD COLUMN IF NOT EXISTS cancelled_trips INTEGER DEFAULT 0;

ALTER TABLE public.drivers 
ADD COLUMN IF NOT EXISTS priority_score INTEGER DEFAULT 50; -- 0-100

-- ===========================================================================
-- PORTAL ACCESS TRACKING
-- ===========================================================================
ALTER TABLE public.drivers 
ADD COLUMN IF NOT EXISTS portal_enabled BOOLEAN DEFAULT TRUE;

ALTER TABLE public.drivers 
ADD COLUMN IF NOT EXISTS portal_last_login TIMESTAMPTZ;

ALTER TABLE public.drivers 
ADD COLUMN IF NOT EXISTS portal_login_count INTEGER DEFAULT 0;

-- ===========================================================================
-- GENERATE SLUGS FOR EXISTING DRIVERS
-- ===========================================================================
UPDATE public.drivers 
SET portal_slug = LOWER(
  REGEXP_REPLACE(COALESCE(first_name, ''), '[^a-zA-Z0-9]', '', 'g') || '_' ||
  REGEXP_REPLACE(COALESCE(last_name, ''), '[^a-zA-Z0-9]', '', 'g')
)
WHERE portal_slug IS NULL 
  AND first_name IS NOT NULL 
  AND last_name IS NOT NULL;

-- ===========================================================================
-- VERIFICATION
-- ===========================================================================
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'drivers' 
  AND column_name IN (
    'portal_slug', 'profile_photo_url', 'bio', 'settings', 
    'is_online', 'rating', 'portal_enabled', 'company_id'
  )
ORDER BY column_name;
