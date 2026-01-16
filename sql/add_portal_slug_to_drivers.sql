-- ============================================================================
-- ADD PORTAL SLUG TO DRIVERS TABLE
-- Enables driver-specific URLs: driver.relialimo.com/first_name_last_name
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Add portal_slug column for unique driver URLs
ALTER TABLE public.drivers 
ADD COLUMN IF NOT EXISTS portal_slug TEXT;

-- Create unique index to prevent duplicate slugs
CREATE UNIQUE INDEX IF NOT EXISTS idx_drivers_portal_slug 
ON public.drivers(portal_slug) 
WHERE portal_slug IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.drivers.portal_slug IS 'Unique URL slug for driver portal: driver.relialimo.com/{portal_slug}';

-- ============================================================================
-- OPTIONAL: Generate slugs for existing drivers
-- ============================================================================

-- Update existing drivers with generated slugs (first_name_last_name format)
UPDATE public.drivers 
SET portal_slug = LOWER(
  REGEXP_REPLACE(COALESCE(first_name, ''), '[^a-zA-Z0-9]', '', 'g') || '_' ||
  REGEXP_REPLACE(COALESCE(last_name, ''), '[^a-zA-Z0-9]', '', 'g')
)
WHERE portal_slug IS NULL 
  AND first_name IS NOT NULL 
  AND last_name IS NOT NULL;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- SELECT id, first_name, last_name, portal_slug FROM public.drivers LIMIT 10;
