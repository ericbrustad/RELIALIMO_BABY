-- Drop the problematic customer user trigger
DROP TRIGGER IF EXISTS on_auth_user_created_customer ON auth.users;

-- Check if the function exists and drop it too
DROP FUNCTION IF EXISTS handle_new_customer_user();
DROP FUNCTION IF EXISTS public.handle_new_customer_user();

-- Verify no more triggers
SELECT tgname, tgrelid::regclass::text
FROM pg_trigger 
WHERE tgrelid::regclass::text = 'auth.users' AND NOT tgisinternal;