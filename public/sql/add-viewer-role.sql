-- Add Viewer Role Support
-- A viewer can see all admin pages but cannot edit anything

-- ============================================
-- 1. Add 'viewer' to the user_role enum type
-- ============================================
-- Check if viewer already exists, if not add it
DO $$
BEGIN
  -- Try to add 'viewer' to the enum
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'viewer';
EXCEPTION
  WHEN duplicate_object THEN
    -- Value already exists, ignore
    NULL;
  WHEN undefined_object THEN
    -- Enum doesn't exist, we'll handle this below
    NULL;
END $$;

-- If the enum doesn't exist at all, create it
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('admin', 'dispatcher', 'viewer', 'user', 'owner');
  END IF;
END $$;

-- ============================================
-- 2. Ensure user_profiles table has the role column
-- ============================================
-- Note: If role column uses the enum, it should now accept 'viewer'

-- ============================================
-- 3. Create or update a user to have viewer role
-- ============================================
-- To set a user as a viewer, run this with their user_id:
-- 
-- UPDATE public.user_profiles 
-- SET role = 'viewer' 
-- WHERE user_id = 'USER_UUID_HERE';
--
-- Or by email (requires joining auth.users):
-- 
-- UPDATE public.user_profiles p
-- SET role = 'viewer'
-- FROM auth.users u
-- WHERE p.user_id = u.id 
-- AND u.email = 'viewer@example.com';

-- ============================================
-- 3. Create a function to check if user is viewer
-- ============================================
CREATE OR REPLACE FUNCTION public.is_viewer()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_id = auth.uid() 
    AND role = 'viewer'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_viewer() TO authenticated;

-- ============================================
-- 4. Create a function to get user role
-- ============================================
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (SELECT role FROM public.user_profiles WHERE user_id = auth.uid()),
    'user'
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated;

-- ============================================
-- 5. Example: Create a viewer user
-- ============================================
-- First create the user in Supabase Auth, then run:
--
-- INSERT INTO public.user_profiles (user_id, role, created_at)
-- SELECT id, 'viewer', NOW()
-- FROM auth.users
-- WHERE email = 'viewer@yourcompany.com'
-- ON CONFLICT (user_id) DO UPDATE SET role = 'viewer';
