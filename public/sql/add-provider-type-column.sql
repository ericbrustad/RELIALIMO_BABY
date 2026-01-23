-- ============================================
-- Add Provider Type Column to Drivers and Accounts
-- For distinguishing In-House vs Affiliate
-- ============================================

-- Add provider_type column to drivers table
ALTER TABLE drivers 
ADD COLUMN IF NOT EXISTS provider_type TEXT DEFAULT 'in-house';

COMMENT ON COLUMN drivers.provider_type IS 'Provider type: in-house (company employee) or affiliate (external partner)';

-- Add provider_type column to accounts table (for admin/driver accounts)
ALTER TABLE accounts 
ADD COLUMN IF NOT EXISTS provider_type TEXT;

COMMENT ON COLUMN accounts.provider_type IS 'Provider type for admin/driver accounts: in-house or affiliate';

-- Create index for faster provider type lookups
CREATE INDEX IF NOT EXISTS idx_drivers_provider_type ON drivers (provider_type);
CREATE INDEX IF NOT EXISTS idx_accounts_provider_type ON accounts (provider_type) WHERE provider_type IS NOT NULL;

-- Set default for existing drivers without provider_type
UPDATE drivers SET provider_type = 'in-house' WHERE provider_type IS NULL;
