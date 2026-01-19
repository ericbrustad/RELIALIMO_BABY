-- Debug RLS issue - Run this in Supabase SQL Editor
-- https://supabase.com/dashboard/project/siumiadylwcrkaqsfwkj/sql/new

-- 1. Check current user and their organization memberships
SELECT 
  'Current auth.uid()' as info,
  auth.uid() as user_id;

-- 2. Check organization_members table
SELECT 
  om.user_id,
  om.organization_id,
  o.name as org_name,
  au.email as user_email
FROM public.organization_members om
LEFT JOIN public.organizations o ON o.id = om.organization_id
LEFT JOIN auth.users au ON au.id = om.user_id
LIMIT 20;

-- 3. Check if RLS is enabled on reservations table
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename = 'reservations';

-- 4. Check existing policies on reservations
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'reservations';

-- 5. If no INSERT policy exists, this is the problem!
-- The fix below allows ANY authenticated user to insert (temporarily for testing)

-- ===================================
-- TEMPORARY FIX: Allow any authenticated user to insert
-- (Remove this later and use proper org-based policy)
-- ===================================
DROP POLICY IF EXISTS "reservations_insert_any_authenticated" ON public.reservations;

CREATE POLICY "reservations_insert_any_authenticated"
ON public.reservations FOR INSERT TO authenticated
WITH CHECK (true);

-- Also for accounts if needed
DROP POLICY IF EXISTS "accounts_insert_any_authenticated" ON public.accounts;

CREATE POLICY "accounts_insert_any_authenticated"
ON public.accounts FOR INSERT TO authenticated
WITH CHECK (true);

-- ===================================
-- ALSO ADD UPDATE/DELETE for any authenticated (temp fix)
-- ===================================
DROP POLICY IF EXISTS "reservations_update_any_authenticated" ON public.reservations;
CREATE POLICY "reservations_update_any_authenticated"
ON public.reservations FOR UPDATE TO authenticated
USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "reservations_delete_any_authenticated" ON public.reservations;
CREATE POLICY "reservations_delete_any_authenticated"
ON public.reservations FOR DELETE TO authenticated
USING (true);

-- Verify policies were created
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'reservations';
