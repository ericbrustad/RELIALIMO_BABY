-- Add Viewer Role Support
-- A viewer can see all admin pages but cannot edit anything

-- ============================================
-- 1. Ensure user_profiles table has the role column
-- ============================================
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS role text DEFAULT 'user';

-- Add check constraint for valid roles
ALTER TABLE public.user_profiles 
DROP CONSTRAINT IF EXISTS valid_user_role;

ALTER TABLE public.user_profiles 
ADD CONSTRAINT valid_user_role 
CHECK (role IN ('admin', 'dispatcher', 'viewer', 'user', 'owner'));

-- ============================================
-- 2. Create or update a user to have viewer role
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
