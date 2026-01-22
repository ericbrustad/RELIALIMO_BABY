-- Setup separate organizations for Customers and Drivers
-- Run this in Supabase SQL Editor
-- https://supabase.com/dashboard/project/siumiadylwcrkaqsfwkj/sql/new

-- ===================================
-- 1. CREATE CUSTOMER AND DRIVER ORGANIZATIONS
-- ===================================

-- Create Customers organization (for all customer portal users)
INSERT INTO public.organizations (id, name)
VALUES (
  'c0000000-0000-0000-0000-000000000001',
  'ReliaLimo Customers'
)
ON CONFLICT (id) DO NOTHING;

-- Create Drivers organization (for all driver portal users)
INSERT INTO public.organizations (id, name)
VALUES (
  'd0000000-0000-0000-0000-000000000001',
  'ReliaLimo Drivers'
)
ON CONFLICT (id) DO NOTHING;

-- ===================================
-- 2. STORE ORG IDs FOR REFERENCE
-- ===================================
-- Customer Org ID: c0000000-0000-0000-0000-000000000001
-- Driver Org ID:   d0000000-0000-0000-0000-000000000001
-- Admin Org ID:    54eb6ce7-ba97-4198-8566-6ac075828160 (existing)

-- ===================================
-- 2.5 ADD user_id COLUMN TO ACCOUNTS IF MISSING (must be before policies)
-- ===================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'accounts' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.accounts ADD COLUMN user_id uuid REFERENCES auth.users(id);
    CREATE INDEX idx_accounts_user_id ON public.accounts(user_id);
  END IF;
END $$;

-- ===================================
-- 3. UPDATE RLS POLICIES FOR ACCOUNTS
-- ===================================

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "accounts_visible_in_org" ON public.accounts;
DROP POLICY IF EXISTS "accounts_insert_in_org" ON public.accounts;
DROP POLICY IF EXISTS "accounts_update_in_org" ON public.accounts;
DROP POLICY IF EXISTS "accounts_insert_any_authenticated" ON public.accounts;

-- Accounts SELECT: Users can see their own account OR accounts in their org
CREATE POLICY "accounts_select_policy"
ON public.accounts FOR SELECT TO authenticated
USING (
  -- User can see their own account (linked by user_id)
  user_id = auth.uid()
  -- OR user is in the same organization
  OR organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid()
  )
);

-- Accounts INSERT: Users can insert their own account
CREATE POLICY "accounts_insert_policy"
ON public.accounts FOR INSERT TO authenticated
WITH CHECK (
  -- Can only insert account linked to themselves
  user_id = auth.uid()
  -- OR user is admin in an org (can create accounts for others)
  OR organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  )
);

-- Accounts UPDATE: Users can update their own account
CREATE POLICY "accounts_update_policy"
ON public.accounts FOR UPDATE TO authenticated
USING (
  user_id = auth.uid()
  OR organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  )
)
WITH CHECK (
  user_id = auth.uid()
  OR organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  )
);

-- ===================================
-- 4. UPDATE RLS POLICIES FOR RESERVATIONS
-- ===================================

-- Drop existing policies
DROP POLICY IF EXISTS "reservations_visible_in_org" ON public.reservations;
DROP POLICY IF EXISTS "reservations_insert_in_org" ON public.reservations;
DROP POLICY IF EXISTS "reservations_insert_authenticated" ON public.reservations;
DROP POLICY IF EXISTS "reservations_insert_any_authenticated" ON public.reservations;
DROP POLICY IF EXISTS "reservations_update_in_org" ON public.reservations;
DROP POLICY IF EXISTS "reservations_update_any_authenticated" ON public.reservations;

-- Reservations SELECT: 
-- - Customers see their own bookings
-- - Drivers see their assigned trips
-- - Admins see all in their org
CREATE POLICY "reservations_select_policy"
ON public.reservations FOR SELECT TO authenticated
USING (
  -- Customer can see their own bookings
  booked_by_user_id = auth.uid()
  -- OR driver can see assigned trips
  OR assigned_driver_id IN (
    SELECT id FROM public.drivers WHERE user_id = auth.uid()
  )
  -- OR admin can see all in org
  OR organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid()
  )
);

-- Reservations INSERT: Customers can create their own bookings
CREATE POLICY "reservations_insert_policy"
ON public.reservations FOR INSERT TO authenticated
WITH CHECK (
  -- Customer booking for themselves
  booked_by_user_id = auth.uid()
  -- OR admin creating in their org
  OR organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid()
  )
);

-- Reservations UPDATE: 
-- - Customers can update their pending bookings
-- - Drivers can update status of assigned trips
-- - Admins can update any in org
CREATE POLICY "reservations_update_policy"
ON public.reservations FOR UPDATE TO authenticated
USING (
  -- Customer's own pending booking
  (booked_by_user_id = auth.uid() AND status IN ('pending', 'confirmed'))
  -- OR driver's assigned trip
  OR assigned_driver_id IN (
    SELECT id FROM public.drivers WHERE user_id = auth.uid()
  )
  -- OR admin in org
  OR organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  booked_by_user_id = auth.uid()
  OR assigned_driver_id IN (
    SELECT id FROM public.drivers WHERE user_id = auth.uid()
  )
  OR organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid()
  )
);

-- ===================================
-- 6. VERIFY SETUP
-- ===================================
SELECT 'Organizations' as table_name, id, name FROM public.organizations WHERE name IN ('ReliaLimo Customers', 'ReliaLimo Drivers');

SELECT 'Policies' as info, tablename, policyname, cmd 
FROM pg_policies 
WHERE tablename IN ('accounts', 'reservations')
ORDER BY tablename, policyname;
