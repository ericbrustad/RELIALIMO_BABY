-- Fix RLS to allow customer portal users to create reservations
-- Run this in Supabase SQL Editor
-- https://supabase.com/dashboard/project/siumiadylwcrkaqsfwkj/sql/new

-- ===================================
-- DROP OLD RESTRICTIVE POLICY
-- ===================================
DROP POLICY IF EXISTS "reservations_insert_in_org" ON public.reservations;

-- ===================================
-- NEW INSERT POLICY
-- Allow authenticated users to insert reservations if:
-- 1. They are a member of the organization, OR
-- 2. They are booking for themselves (booked_by_user_id = their user id)
-- ===================================
CREATE POLICY "reservations_insert_authenticated"
ON public.reservations FOR INSERT TO authenticated
WITH CHECK (
  -- Organization members can insert for their org
  organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid()
  )
  -- OR user is booking for themselves (customer portal)
  OR booked_by_user_id = auth.uid()
);

-- ===================================
-- VERIFY POLICY WAS CREATED
-- ===================================
SELECT 
  policyname, 
  cmd, 
  with_check 
FROM pg_policies 
WHERE tablename = 'reservations' AND policyname = 'reservations_insert_authenticated';

-- ===================================
-- TEST: Check if current user can insert
-- ===================================
-- SELECT auth.uid() as current_user_id;
