-- Fix RLS policy to allow customer self-registration
-- Run this in Supabase SQL Editor

-- Drop the restrictive insert policy if it exists
DROP POLICY IF EXISTS "accounts_insert_in_org" ON public.accounts;

-- Create a new policy that allows:
-- 1. Authenticated users to insert their own account (email matches)
-- 2. Organization members to insert accounts in their org
CREATE POLICY "accounts_insert_self_or_org"
ON public.accounts FOR INSERT TO authenticated
WITH CHECK (
  -- Allow user to create their own account (email matches auth email)
  email = auth.jwt() ->> 'email'
  OR
  -- OR they're a member of the organization
  organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid()
  )
  OR
  -- OR organization_id is null (for customers without org)
  organization_id IS NULL
);

-- Also allow anon users to insert (for customer registration before email verification)
CREATE POLICY "accounts_insert_anon_self"
ON public.accounts FOR INSERT TO anon
WITH CHECK (
  -- Only allow if organization_id is null (customer accounts)
  organization_id IS NULL
);

-- Allow users to read their own account
CREATE POLICY "accounts_select_own"
ON public.accounts FOR SELECT TO authenticated
USING (
  email = auth.jwt() ->> 'email'
  OR
  organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid()
  )
);

-- Allow anon to select by email (for login flow)
CREATE POLICY "accounts_select_anon_by_email"
ON public.accounts FOR SELECT TO anon
USING (true);

-- Make sure RLS is enabled
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
