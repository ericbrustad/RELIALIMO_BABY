-- Create a function to check auth triggers
CREATE OR REPLACE FUNCTION public.list_auth_user_triggers()
RETURNS TABLE (trigger_name text, trigger_table text, trigger_def text)
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT tgname::text, tgrelid::regclass::text, pg_get_triggerdef(oid) 
    FROM pg_trigger 
    WHERE tgrelid::regclass::text LIKE 'auth.%' AND NOT tgisinternal;
$$;

GRANT EXECUTE ON FUNCTION public.list_auth_user_triggers() TO authenticated, anon, service_role;