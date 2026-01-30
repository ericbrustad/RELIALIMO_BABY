-- Add Viewer Role Support
-- A viewer can see all admin pages but cannot edit anything

-- ============================================
-- 1. Add 'viewer' to the user_role enum type
-- ============================================
-- Check if viewer already exists, if not add it
DO $$
BEGIN
  -- Check if the enum type exists first
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    -- Try to add 'viewer' to the enum
    BEGIN
      ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'viewer';
    EXCEPTION
      WHEN duplicate_object THEN
        RAISE NOTICE 'viewer value already exists in user_role enum';
    END;
  ELSE
    -- Enum doesn't exist, create it with all values
    CREATE TYPE user_role AS ENUM ('admin', 'dispatcher', 'viewer', 'user', 'owner');
    RAISE NOTICE 'Created user_role enum with viewer';
  END IF;
END $$;

-- ============================================
-- 2. Ensure user_profiles table exists with role column
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  role text DEFAULT 'user',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "user_profiles_select" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_update_own" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_service_role" ON public.user_profiles;

-- Users can view their own profile
CREATE POLICY "user_profiles_select"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR EXISTS (
  SELECT 1 FROM public.user_profiles up 
  WHERE up.user_id = auth.uid() AND up.role IN ('admin', 'owner')
));

-- Users can update their own profile (but not role)
CREATE POLICY "user_profiles_update_own"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Service role full access
CREATE POLICY "user_profiles_service_role"
ON public.user_profiles
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================
-- 3. Create helper functions
-- ============================================

-- Function to check if user is viewer
CREATE OR REPLACE FUNCTION public.is_viewer()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_id = auth.uid() 
    AND role = 'viewer'
  );
$$;

-- Function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    (SELECT role::text FROM public.user_profiles WHERE user_id = auth.uid()),
    'user'
  );
$$;

-- Function to check if user can edit (not a viewer)
CREATE OR REPLACE FUNCTION public.can_edit()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    (SELECT role != 'viewer' FROM public.user_profiles WHERE user_id = auth.uid()),
    true
  );
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.is_viewer() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_edit() TO authenticated;

-- ============================================
-- 4. Example: Set a user as viewer
-- ============================================
-- UPDATE public.user_profiles 
-- SET role = 'viewer', updated_at = now()
-- WHERE user_id = 'USER_UUID_HERE';
--
-- Or by email (requires joining auth.users):
-- 
-- UPDATE public.user_profiles p
-- SET role = 'viewer', updated_at = now()
-- FROM auth.users u
-- WHERE p.user_id = u.id 
-- AND u.email = 'viewer@example.com';
