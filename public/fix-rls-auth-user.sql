-- FIX RLS FOR AUTHENTICATED USERS
-- This script allows any authenticated user to insert/update/delete reservations
-- Run this in Supabase SQL Editor

-- =============================================
-- STEP 1: Drop existing policies on reservations
-- =============================================
DROP POLICY IF EXISTS "insert_reservation" ON public.reservations;
DROP POLICY IF EXISTS "update_reservation" ON public.reservations;
DROP POLICY IF EXISTS "delete_reservation" ON public.reservations;
DROP POLICY IF EXISTS "select_reservation" ON public.reservations;
DROP POLICY IF EXISTS "reservations_insert" ON public.reservations;
DROP POLICY IF EXISTS "reservations_update" ON public.reservations;
DROP POLICY IF EXISTS "reservations_delete" ON public.reservations;
DROP POLICY IF EXISTS "reservations_select" ON public.reservations;
DROP POLICY IF EXISTS "Allow authenticated users to insert reservations" ON public.reservations;
DROP POLICY IF EXISTS "Allow authenticated users to update reservations" ON public.reservations;
DROP POLICY IF EXISTS "Allow authenticated users to delete reservations" ON public.reservations;

-- =============================================
-- STEP 2: Create permissive policies for authenticated users
-- =============================================

-- SELECT: Any authenticated user can view reservations
CREATE POLICY "authenticated_select_reservations" ON public.reservations
    FOR SELECT
    TO authenticated
    USING (true);

-- INSERT: Any authenticated user can insert reservations
CREATE POLICY "authenticated_insert_reservations" ON public.reservations
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- UPDATE: Any authenticated user can update reservations
CREATE POLICY "authenticated_update_reservations" ON public.reservations
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- DELETE: Any authenticated user can delete reservations
CREATE POLICY "authenticated_delete_reservations" ON public.reservations
    FOR DELETE
    TO authenticated
    USING (true);

-- =============================================
-- STEP 3: Also fix accounts table
-- =============================================
DROP POLICY IF EXISTS "insert_account" ON public.accounts;
DROP POLICY IF EXISTS "update_account" ON public.accounts;
DROP POLICY IF EXISTS "delete_account" ON public.accounts;
DROP POLICY IF EXISTS "select_account" ON public.accounts;
DROP POLICY IF EXISTS "accounts_insert" ON public.accounts;
DROP POLICY IF EXISTS "accounts_update" ON public.accounts;
DROP POLICY IF EXISTS "accounts_delete" ON public.accounts;
DROP POLICY IF EXISTS "accounts_select" ON public.accounts;
DROP POLICY IF EXISTS "Allow authenticated users to insert accounts" ON public.accounts;
DROP POLICY IF EXISTS "Allow authenticated users to update accounts" ON public.accounts;
DROP POLICY IF EXISTS "Allow authenticated users to delete accounts" ON public.accounts;

CREATE POLICY "authenticated_select_accounts" ON public.accounts
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "authenticated_insert_accounts" ON public.accounts
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "authenticated_update_accounts" ON public.accounts
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "authenticated_delete_accounts" ON public.accounts
    FOR DELETE
    TO authenticated
    USING (true);

-- =============================================
-- STEP 4: Verify RLS is enabled on both tables
-- =============================================
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

-- =============================================
-- STEP 5: Check policies were created
-- =============================================
SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename IN ('reservations', 'accounts')
ORDER BY tablename, policyname;
