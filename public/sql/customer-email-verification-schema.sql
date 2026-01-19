-- ============================================
-- Customer Email Verification Schema
-- Handles email verification tokens for customer accounts
-- ============================================

-- Create the email verifications table
CREATE TABLE IF NOT EXISTS public.customer_email_verifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  user_data JSONB,
  verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on token for fast lookups
CREATE INDEX IF NOT EXISTS idx_customer_email_verifications_token 
ON public.customer_email_verifications(token);

-- Create index on email for finding pending verifications
CREATE INDEX IF NOT EXISTS idx_customer_email_verifications_email 
ON public.customer_email_verifications(email);

-- Create index for cleanup of expired tokens
CREATE INDEX IF NOT EXISTS idx_customer_email_verifications_expires 
ON public.customer_email_verifications(expires_at) 
WHERE verified = FALSE;

-- Add comments
COMMENT ON TABLE public.customer_email_verifications IS 'Stores email verification tokens for customer account creation';
COMMENT ON COLUMN public.customer_email_verifications.token IS 'Unique verification token sent in email';
COMMENT ON COLUMN public.customer_email_verifications.user_data IS 'Additional user data stored with verification (first_name, last_name, portal_slug, etc)';
COMMENT ON COLUMN public.customer_email_verifications.expires_at IS 'Token expiration timestamp (24 hours from creation)';

-- Enable RLS
ALTER TABLE public.customer_email_verifications ENABLE ROW LEVEL SECURITY;

-- Allow anyone to create verification records (for signup flow)
CREATE POLICY "Anyone can create email verifications"
  ON public.customer_email_verifications
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Allow reading verifications by token (for verification callback)
CREATE POLICY "Anyone can read verifications by token"
  ON public.customer_email_verifications
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Allow updating verification status
CREATE POLICY "Anyone can update verification status"
  ON public.customer_email_verifications
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================
-- Add email verification columns to accounts table
-- ============================================

-- Add email_verified column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'accounts' 
    AND column_name = 'email_verified'
  ) THEN
    ALTER TABLE public.accounts ADD COLUMN email_verified BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Add email_verified_at column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'accounts' 
    AND column_name = 'email_verified_at'
  ) THEN
    ALTER TABLE public.accounts ADD COLUMN email_verified_at TIMESTAMPTZ;
  END IF;
END $$;

-- Add onboarding columns if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'accounts' 
    AND column_name = 'onboarding_complete'
  ) THEN
    ALTER TABLE public.accounts ADD COLUMN onboarding_complete BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'accounts' 
    AND column_name = 'onboarding_completed_at'
  ) THEN
    ALTER TABLE public.accounts ADD COLUMN onboarding_completed_at TIMESTAMPTZ;
  END IF;
END $$;

-- Add home airport columns if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'accounts' 
    AND column_name = 'home_airport'
  ) THEN
    ALTER TABLE public.accounts ADD COLUMN home_airport TEXT;
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'accounts' 
    AND column_name = 'home_airport_name'
  ) THEN
    ALTER TABLE public.accounts ADD COLUMN home_airport_name TEXT;
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'accounts' 
    AND column_name = 'home_coordinates'
  ) THEN
    ALTER TABLE public.accounts ADD COLUMN home_coordinates JSONB;
  END IF;
END $$;

-- Add payment method columns if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'accounts' 
    AND column_name = 'has_payment_method'
  ) THEN
    ALTER TABLE public.accounts ADD COLUMN has_payment_method BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'accounts' 
    AND column_name = 'payment_method_last4'
  ) THEN
    ALTER TABLE public.accounts ADD COLUMN payment_method_last4 TEXT;
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'accounts' 
    AND column_name = 'payment_method_type'
  ) THEN
    ALTER TABLE public.accounts ADD COLUMN payment_method_type TEXT;
  END IF;
END $$;

-- Add comments for new columns
COMMENT ON COLUMN public.accounts.email_verified IS 'Whether the customer email has been verified';
COMMENT ON COLUMN public.accounts.onboarding_complete IS 'Whether the customer has completed the onboarding flow';
COMMENT ON COLUMN public.accounts.home_airport IS 'Preferred home airport code (e.g., MSP, LAX)';
COMMENT ON COLUMN public.accounts.home_coordinates IS 'Home address coordinates for map display';

-- ============================================
-- Cleanup function for expired tokens
-- ============================================
CREATE OR REPLACE FUNCTION cleanup_expired_email_verifications()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.customer_email_verifications
  WHERE expires_at < NOW() AND verified = FALSE;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION cleanup_expired_email_verifications IS 'Removes expired email verification tokens';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Customer email verification schema created successfully';
END $$;
