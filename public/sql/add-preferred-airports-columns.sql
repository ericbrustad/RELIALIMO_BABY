-- ============================================
-- Add Preferred Airports and FBOs Columns
-- For storing multiple airport selections from onboarding
-- ============================================

-- Add customer onboarding related columns to accounts table
ALTER TABLE accounts 
ADD COLUMN IF NOT EXISTS preferred_airports JSONB DEFAULT '[]'::JSONB,
ADD COLUMN IF NOT EXISTS preferred_fbos JSONB DEFAULT '[]'::JSONB,
ADD COLUMN IF NOT EXISTS home_coordinates JSONB,
ADD COLUMN IF NOT EXISTS home_airport TEXT,
ADD COLUMN IF NOT EXISTS home_airport_name TEXT,
ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS address_line1 TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS state VARCHAR(10),
ADD COLUMN IF NOT EXISTS zip VARCHAR(20);

COMMENT ON COLUMN accounts.preferred_airports IS 'JSON array of preferred airports selected during onboarding. Each has: code, name, city, state, latitude, longitude';
COMMENT ON COLUMN accounts.preferred_fbos IS 'JSON array of preferred FBOs (Fixed Base Operators) selected during onboarding. Each has: code, name, city, latitude, longitude';
COMMENT ON COLUMN accounts.home_coordinates IS 'JSON object with lat/lng of customer home address';
COMMENT ON COLUMN accounts.home_airport IS 'Primary home airport code (e.g. MSP)';
COMMENT ON COLUMN accounts.home_airport_name IS 'Primary home airport full name';
COMMENT ON COLUMN accounts.onboarding_complete IS 'Whether customer has completed the onboarding flow';
COMMENT ON COLUMN accounts.onboarding_completed_at IS 'Timestamp when onboarding was completed';

-- Create index for faster airport lookups
CREATE INDEX IF NOT EXISTS idx_accounts_preferred_airports ON accounts USING GIN (preferred_airports);

-- Optional: Add a view for easy querying of customers with airport preferences
CREATE OR REPLACE VIEW customer_airport_preferences AS
SELECT 
  a.id,
  a.first_name,
  a.last_name,
  a.email,
  a.home_airport,
  a.home_airport_name,
  a.home_coordinates,
  a.preferred_airports,
  a.preferred_fbos,
  jsonb_array_length(COALESCE(a.preferred_airports, '[]'::jsonb)) as airport_count,
  jsonb_array_length(COALESCE(a.preferred_fbos, '[]'::jsonb)) as fbo_count
FROM accounts a
WHERE a.status = 'active';

COMMENT ON VIEW customer_airport_preferences IS 'View showing customer airport and FBO preferences for booking optimization';
