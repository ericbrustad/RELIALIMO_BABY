-- Check if affiliate_id column exists on drivers table
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'drivers' 
AND column_name IN ('affiliate_id', 'affiliate_name');