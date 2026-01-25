-- ============================================
-- Fix RLS for customer_addresses and customer_passengers
-- Allows customer portal users to save their addresses/passengers
-- Run this in Supabase SQL Editor
-- ============================================

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "customer_addresses_insert" ON public.customer_addresses;
DROP POLICY IF EXISTS "customer_addresses_select" ON public.customer_addresses;
DROP POLICY IF EXISTS "customer_addresses_update" ON public.customer_addresses;
DROP POLICY IF EXISTS "customer_addresses_delete" ON public.customer_addresses;

DROP POLICY IF EXISTS "customer_passengers_insert" ON public.customer_passengers;
DROP POLICY IF EXISTS "customer_passengers_select" ON public.customer_passengers;
DROP POLICY IF EXISTS "customer_passengers_update" ON public.customer_passengers;
DROP POLICY IF EXISTS "customer_passengers_delete" ON public.customer_passengers;

-- ============================================
-- customer_addresses policies
-- Uses account_id column (links to accounts table)
-- ============================================

-- Allow authenticated users to insert addresses for their accounts
CREATE POLICY "customer_addresses_insert"
ON public.customer_addresses FOR INSERT TO authenticated
WITH CHECK (
  account_id IN (SELECT id FROM public.accounts WHERE user_id = auth.uid())
);

-- Allow users to read addresses for their accounts
CREATE POLICY "customer_addresses_select"
ON public.customer_addresses FOR SELECT TO authenticated
USING (
  account_id IN (SELECT id FROM public.accounts WHERE user_id = auth.uid())
);

-- Allow users to update addresses for their accounts
CREATE POLICY "customer_addresses_update"
ON public.customer_addresses FOR UPDATE TO authenticated
USING (
  account_id IN (SELECT id FROM public.accounts WHERE user_id = auth.uid())
);

-- Allow users to delete addresses for their accounts
CREATE POLICY "customer_addresses_delete"
ON public.customer_addresses FOR DELETE TO authenticated
USING (
  account_id IN (SELECT id FROM public.accounts WHERE user_id = auth.uid())
);

-- ============================================
-- customer_passengers policies
-- Uses account_id column (links to accounts table)
-- ============================================

-- Allow authenticated users to insert passengers for their accounts
CREATE POLICY "customer_passengers_insert"
ON public.customer_passengers FOR INSERT TO authenticated
WITH CHECK (
  account_id IN (SELECT id FROM public.accounts WHERE user_id = auth.uid())
);

-- Allow users to read passengers for their accounts
CREATE POLICY "customer_passengers_select"
ON public.customer_passengers FOR SELECT TO authenticated
USING (
  account_id IN (SELECT id FROM public.accounts WHERE user_id = auth.uid())
);

-- Allow users to update passengers for their accounts
CREATE POLICY "customer_passengers_update"
ON public.customer_passengers FOR UPDATE TO authenticated
USING (
  account_id IN (SELECT id FROM public.accounts WHERE user_id = auth.uid())
);

-- Allow users to delete passengers for their accounts
CREATE POLICY "customer_passengers_delete"
ON public.customer_passengers FOR DELETE TO authenticated
USING (
  account_id IN (SELECT id FROM public.accounts WHERE user_id = auth.uid())
);

-- ============================================
-- Verify policies
-- ============================================
SELECT schemaname, tablename, policyname, cmd 
FROM pg_policies 
WHERE tablename IN ('customer_addresses', 'customer_passengers');
