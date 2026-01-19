-- Add INSERT, UPDATE, DELETE policies for reservations table
-- Run this in Supabase SQL Editor (https://supabase.com/dashboard/project/siumiadylwcrkaqsfwkj/sql/new)

-- ===================================
-- DROP EXISTING POLICIES FIRST
-- ===================================
DROP POLICY IF EXISTS "reservations_insert_in_org" ON public.reservations;
DROP POLICY IF EXISTS "reservations_update_in_org" ON public.reservations;
DROP POLICY IF EXISTS "reservations_delete_in_org" ON public.reservations;
DROP POLICY IF EXISTS "accounts_insert_in_org" ON public.accounts;
DROP POLICY IF EXISTS "accounts_update_in_org" ON public.accounts;
DROP POLICY IF EXISTS "accounts_delete_in_org" ON public.accounts;

-- ===================================
-- INSERT POLICY
-- Allow authenticated users to insert reservations for their organization
-- ===================================
CREATE POLICY "reservations_insert_in_org"
ON public.reservations FOR INSERT TO authenticated
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid()
  )
);

-- ===================================
-- UPDATE POLICY  
-- Allow users to update reservations in their organization or ones they booked
-- ===================================
CREATE POLICY "reservations_update_in_org"
ON public.reservations FOR UPDATE TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid()
  )
  OR booked_by_user_id = auth.uid()
)
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid()
  )
  OR booked_by_user_id = auth.uid()
);

-- ===================================
-- DELETE POLICY
-- Allow users to delete reservations in their organization
-- ===================================
CREATE POLICY "reservations_delete_in_org"
ON public.reservations FOR DELETE TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid()
  )
);

-- ===================================
-- ALSO ADD POLICIES FOR ACCOUNTS TABLE (for creating new accounts with reservations)
-- ===================================

-- Check if accounts table has RLS enabled
-- ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

-- INSERT policy for accounts
CREATE POLICY "accounts_insert_in_org"
ON public.accounts FOR INSERT TO authenticated
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid()
  )
);

-- UPDATE policy for accounts
CREATE POLICY "accounts_update_in_org"
ON public.accounts FOR UPDATE TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid()
  )
);

-- DELETE policy for accounts
CREATE POLICY "accounts_delete_in_org"
ON public.accounts FOR DELETE TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid()
  )
);

-- ===================================
-- VERIFY: Check that policies were created
-- ===================================
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename IN ('reservations', 'accounts')
ORDER BY tablename, policyname;
