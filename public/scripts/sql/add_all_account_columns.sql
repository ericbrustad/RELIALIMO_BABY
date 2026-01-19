-- ============================================================
-- Add ALL Missing Columns to Accounts Table
-- Run this in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- These allow authenticated users to manage accounts
-- Also allows anon role for development/API key access
-- ============================================================

-- Enable RLS on accounts table (if not already enabled)
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them cleanly
DROP POLICY IF EXISTS "Allow authenticated users to select accounts" ON public.accounts;
DROP POLICY IF EXISTS "Allow authenticated users to insert accounts" ON public.accounts;
DROP POLICY IF EXISTS "Allow authenticated users to update accounts" ON public.accounts;
DROP POLICY IF EXISTS "Allow authenticated users to delete accounts" ON public.accounts;
DROP POLICY IF EXISTS "Allow anon to select accounts" ON public.accounts;
DROP POLICY IF EXISTS "Allow anon to insert accounts" ON public.accounts;
DROP POLICY IF EXISTS "Allow anon to update accounts" ON public.accounts;
DROP POLICY IF EXISTS "Allow anon to delete accounts" ON public.accounts;

-- SELECT policy - authenticated users can read all accounts
CREATE POLICY "Allow authenticated users to select accounts"
ON public.accounts
FOR SELECT
TO authenticated
USING (true);

-- INSERT policy - authenticated users can create accounts
CREATE POLICY "Allow authenticated users to insert accounts"
ON public.accounts
FOR INSERT
TO authenticated
WITH CHECK (true);

-- UPDATE policy - authenticated users can update accounts
CREATE POLICY "Allow authenticated users to update accounts"
ON public.accounts
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- DELETE policy - authenticated users can delete accounts
CREATE POLICY "Allow authenticated users to delete accounts"
ON public.accounts
FOR DELETE
TO authenticated
USING (true);

-- ANON role policies (for API key access / development)
CREATE POLICY "Allow anon to select accounts"
ON public.accounts
FOR SELECT
TO anon
USING (true);

CREATE POLICY "Allow anon to insert accounts"
ON public.accounts
FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "Allow anon to update accounts"
ON public.accounts
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow anon to delete accounts"
ON public.accounts
FOR DELETE
TO anon
USING (true);

-- ============================================================
-- COLUMN ADDITIONS
-- ============================================================

-- Organization ID (required for multi-tenant setup)
-- Make it nullable with no default so existing rows are not affected
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS organization_id UUID;

-- Core fields
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'individual';
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active';

-- Address fields
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS address_line1 TEXT;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS address_line2 TEXT;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS state VARCHAR(10);
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS zip VARCHAR(20);
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS country VARCHAR(10) DEFAULT 'US';

-- Department and Job Title
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS job_title TEXT;

-- Notes fields
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS internal_notes TEXT;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS trip_notes TEXT;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS notes_others TEXT;

-- Source and Agreement
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS rental_agreement TEXT;

-- Account Settings
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS account_settings VARCHAR(50) DEFAULT 'normal';
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS web_access VARCHAR(50) DEFAULT 'allow';

-- Account Type flags
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS is_billing_client BOOLEAN DEFAULT FALSE;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS is_passenger BOOLEAN DEFAULT FALSE;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS is_booking_contact BOOLEAN DEFAULT FALSE;

-- Address verification
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS address_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS address_verified_at TIMESTAMPTZ;

-- Phone fields
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS office_phone VARCHAR(30);
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS office_phone_ext VARCHAR(10);
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS home_phone VARCHAR(30);
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS home_phone_ext VARCHAR(10);
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS cell_phone_2 VARCHAR(30);
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS cell_phone_3 VARCHAR(30);
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS fax_1 VARCHAR(30);
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS fax_2 VARCHAR(30);
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS fax_3 VARCHAR(30);

-- Email preferences
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS email_pref_all BOOLEAN DEFAULT TRUE;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS email_pref_confirmation BOOLEAN DEFAULT TRUE;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS email_pref_payment_receipt BOOLEAN DEFAULT TRUE;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS email_pref_invoice BOOLEAN DEFAULT TRUE;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS email_pref_other BOOLEAN DEFAULT TRUE;

-- Restrictions (UUID arrays)
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS restricted_drivers UUID[] DEFAULT '{}';
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS restricted_cars UUID[] DEFAULT '{}';

-- Create indexes for commonly queried fields
CREATE INDEX IF NOT EXISTS idx_accounts_account_settings ON public.accounts(account_settings);
CREATE INDEX IF NOT EXISTS idx_accounts_city ON public.accounts(city);
CREATE INDEX IF NOT EXISTS idx_accounts_state ON public.accounts(state);
CREATE INDEX IF NOT EXISTS idx_accounts_zip ON public.accounts(zip);

-- Add comments for documentation
COMMENT ON COLUMN public.accounts.address_line1 IS 'Primary street address';
COMMENT ON COLUMN public.accounts.address_line2 IS 'Secondary address (apt, suite, etc.)';
COMMENT ON COLUMN public.accounts.city IS 'City name';
COMMENT ON COLUMN public.accounts.state IS 'State/Province code';
COMMENT ON COLUMN public.accounts.zip IS 'Postal/ZIP code';
COMMENT ON COLUMN public.accounts.country IS 'Country code (default: US)';
COMMENT ON COLUMN public.accounts.account_settings IS 'Account tier: normal, vip, or blocked';
COMMENT ON COLUMN public.accounts.web_access IS 'Web portal access: allow or deny';
COMMENT ON COLUMN public.accounts.is_billing_client IS 'Can be billed for trips';
COMMENT ON COLUMN public.accounts.is_passenger IS 'Is a passenger';
COMMENT ON COLUMN public.accounts.is_booking_contact IS 'Can book trips for others';

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Successfully added all missing columns to accounts table';
END $$;
