-- ============================================================
-- Add account_settings column to accounts table
-- Run this in Supabase SQL Editor
-- ============================================================

-- Add account_settings column if it doesn't exist
ALTER TABLE public.accounts 
ADD COLUMN IF NOT EXISTS account_settings VARCHAR(50) DEFAULT 'normal';

-- Add comment for documentation
COMMENT ON COLUMN public.accounts.account_settings IS 'Account tier: normal, vip, or blocked';

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_accounts_account_settings ON public.accounts(account_settings);

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Successfully added account_settings column to accounts table';
END $$;
