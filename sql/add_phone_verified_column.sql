-- Add phone_verified column to accounts table
-- Run this in the Supabase SQL Editor

-- Add phone_verified column if it doesn't exist
ALTER TABLE accounts 
ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE;

-- Add comment
COMMENT ON COLUMN accounts.phone_verified IS 'Whether the phone number has been verified via OTP';

-- Create index for querying verified accounts
CREATE INDEX IF NOT EXISTS idx_accounts_phone_verified 
ON accounts(phone_verified) 
WHERE phone_verified = true;

-- Update existing accounts with verified phone numbers (optional)
-- Uncomment if you want to mark existing accounts as verified
-- UPDATE accounts SET phone_verified = true WHERE phone IS NOT NULL AND phone != '';

SELECT 'phone_verified column added successfully' as status;
