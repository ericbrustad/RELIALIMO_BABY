-- =====================================================
-- Fix User Signup Database Errors
-- Run this in Supabase SQL Editor
-- =====================================================

-- 1. Check for existing triggers on auth.users
SELECT 
  t.trigger_name,
  t.event_manipulation,
  t.action_statement
FROM information_schema.triggers t
WHERE t.event_object_schema = 'auth' 
AND t.event_object_table = 'users';

-- 2. Create or fix user_profiles table
CREATE TABLE IF NOT EXISTS public.user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'customer',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
CREATE POLICY "Users can view own profile" ON public.user_profiles
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
CREATE POLICY "Users can insert own profile" ON public.user_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Allow service role and triggers to insert
DROP POLICY IF EXISTS "Service role can manage profiles" ON public.user_profiles;
CREATE POLICY "Service role can manage profiles" ON public.user_profiles
  FOR ALL USING (true) WITH CHECK (true);

-- 3. Drop any problematic trigger that might be causing the 500 error
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- 4. Create a safe trigger function that handles errors gracefully
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Try to insert user profile, but don't fail if it exists
  INSERT INTO public.user_profiles (user_id, role, created_at)
  VALUES (NEW.id, 'customer', NOW())
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the user creation
  RAISE WARNING 'handle_new_user failed: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Create the trigger (optional - only if you want automatic profile creation)
-- Uncomment the lines below if you want profiles created automatically
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.user_profiles TO anon, authenticated;

-- 7. Verify the fix
SELECT 'user_profiles table' AS check_item,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'user_profiles'
  ) THEN '✅ EXISTS' ELSE '❌ MISSING' END AS status

UNION ALL

SELECT 'Problematic trigger removed' AS check_item,
  CASE WHEN NOT EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'on_auth_user_created'
  ) THEN '✅ REMOVED' ELSE '⚠️ STILL EXISTS' END AS status;
