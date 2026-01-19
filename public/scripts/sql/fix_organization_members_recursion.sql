-- ============================================
-- FIX: Infinite Recursion in organization_members RLS Policy
-- ============================================
-- This script fixes the "infinite recursion detected in policy for relation organization_members" error.
-- The problem: RLS policies on organization_members table reference the table itself,
-- creating a circular dependency when Postgres evaluates the policy.
-- 
-- The fix: Use simple policies that only check auth.uid() directly,
-- without querying organization_members table.
-- ============================================

-- Step 1: Drop ALL existing policies on organization_members
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'organization_members' 
        AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.organization_members', pol.policyname);
        RAISE NOTICE 'Dropped policy: %', pol.policyname;
    END LOOP;
END $$;

-- Step 2: Ensure RLS is enabled
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- Step 3: Create simple, non-recursive policies
-- These policies use auth.uid() directly WITHOUT querying organization_members

-- SELECT: Users can see their own membership records
CREATE POLICY "org_members_select_own"
ON public.organization_members
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- INSERT: Users can create their own membership records
CREATE POLICY "org_members_insert_own"
ON public.organization_members
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- UPDATE: Users can update their own membership records
CREATE POLICY "org_members_update_own"
ON public.organization_members
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- DELETE: Users can delete their own membership records
CREATE POLICY "org_members_delete_own"
ON public.organization_members
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- ANON: Allow all access for anon (development mode)
-- Remove or restrict this policy in production!
CREATE POLICY "org_members_anon_access"
ON public.organization_members
FOR ALL
TO anon
USING (true)
WITH CHECK (true);

-- Step 4: Verify policies were created
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'organization_members'
ORDER BY policyname;

-- ============================================
-- DONE! The infinite recursion should now be fixed.
-- ============================================
