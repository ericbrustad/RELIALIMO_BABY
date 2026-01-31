-- ============================================
-- ADD FAVORITE AIRPORTS COLUMN TO ACCOUNTS
-- Run this in Supabase SQL Editor
-- ============================================

-- Add favorite_airports column to accounts table
ALTER TABLE public.accounts 
ADD COLUMN IF NOT EXISTS favorite_airports TEXT[];

COMMENT ON COLUMN accounts.favorite_airports IS 'Array of airport codes that customer has marked as favorites';

-- Verify column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'accounts' 
AND column_name = 'favorite_airports';
