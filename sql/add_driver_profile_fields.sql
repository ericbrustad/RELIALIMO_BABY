-- Add profile fields to drivers table
-- Run this in Supabase SQL Editor

-- Profile photo
ALTER TABLE public.drivers 
ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;

-- Bio and experience
ALTER TABLE public.drivers 
ADD COLUMN IF NOT EXISTS bio TEXT;

ALTER TABLE public.drivers 
ADD COLUMN IF NOT EXISTS years_experience TEXT;

-- Multi-select fields stored as JSON arrays
ALTER TABLE public.drivers 
ADD COLUMN IF NOT EXISTS languages JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.drivers 
ADD COLUMN IF NOT EXISTS specialties JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.drivers 
ADD COLUMN IF NOT EXISTS certifications JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.drivers 
ADD COLUMN IF NOT EXISTS availability JSONB DEFAULT '[]'::jsonb;

-- Service areas preference
ALTER TABLE public.drivers 
ADD COLUMN IF NOT EXISTS service_areas TEXT;

-- Settings (payment methods, navigation prefs, notifications, etc.)
ALTER TABLE public.drivers 
ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;

-- Verify columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'drivers' 
  AND column_name IN ('profile_photo_url', 'bio', 'years_experience', 'languages', 'specialties', 'certifications', 'availability', 'service_areas', 'settings')
ORDER BY column_name;
