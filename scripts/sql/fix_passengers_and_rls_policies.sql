-- ============================================
-- FIX PASSENGERS TABLE & RLS POLICY RECURSION
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- PART 1: ADD MISSING COLUMNS TO PASSENGERS TABLE
-- ============================================

-- Add altContactName column if it doesn't exist
DO $$ BEGIN
  ALTER TABLE public.passengers ADD COLUMN IF NOT EXISTS "altContactName" TEXT;
  RAISE NOTICE 'Added altContactName column';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'altContactName column already exists or error: %', SQLERRM;
END $$;

-- Add altContactPhone column if it doesn't exist
DO $$ BEGIN
  ALTER TABLE public.passengers ADD COLUMN IF NOT EXISTS "altContactPhone" TEXT;
  RAISE NOTICE 'Added altContactPhone column';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'altContactPhone column already exists or error: %', SQLERRM;
END $$;

-- Add organization_id column if it doesn't exist
DO $$ BEGIN
  ALTER TABLE public.passengers ADD COLUMN IF NOT EXISTS organization_id UUID;
  RAISE NOTICE 'Added organization_id column';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'organization_id column already exists or error: %', SQLERRM;
END $$;

-- Add notes column if it doesn't exist
DO $$ BEGIN
  ALTER TABLE public.passengers ADD COLUMN IF NOT EXISTS notes TEXT;
  RAISE NOTICE 'Added notes column';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'notes column already exists or error: %', SQLERRM;
END $$;

-- Add standard fields if they don't exist
DO $$ BEGIN
  ALTER TABLE public.passengers ADD COLUMN IF NOT EXISTS "firstName" TEXT;
  ALTER TABLE public.passengers ADD COLUMN IF NOT EXISTS "lastName" TEXT;
  ALTER TABLE public.passengers ADD COLUMN IF NOT EXISTS phone TEXT;
  ALTER TABLE public.passengers ADD COLUMN IF NOT EXISTS email TEXT;
  ALTER TABLE public.passengers ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
  ALTER TABLE public.passengers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
  RAISE NOTICE 'Added/verified standard passenger columns';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error adding standard columns: %', SQLERRM;
END $$;


-- ============================================
-- PART 2: FIX ORGANIZATION_MEMBERS RLS POLICIES
-- The infinite recursion happens when RLS policies
-- on organization_members reference themselves
-- ============================================

-- First, drop existing policies on organization_members to prevent recursion
DROP POLICY IF EXISTS "Users can view their organization memberships" ON public.organization_members;
DROP POLICY IF EXISTS "Users can view organization members" ON public.organization_members;
DROP POLICY IF EXISTS "organization_members_select" ON public.organization_members;
DROP POLICY IF EXISTS "organization_members_insert" ON public.organization_members;
DROP POLICY IF EXISTS "organization_members_update" ON public.organization_members;
DROP POLICY IF EXISTS "organization_members_delete" ON public.organization_members;
DROP POLICY IF EXISTS "Allow authenticated select" ON public.organization_members;
DROP POLICY IF EXISTS "Allow anon select" ON public.organization_members;
DROP POLICY IF EXISTS "Allow all access" ON public.organization_members;

-- Create simple non-recursive policies for organization_members
-- Use auth.uid() directly without querying organization_members
CREATE POLICY "organization_members_authenticated_select"
ON public.organization_members
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "organization_members_authenticated_insert"
ON public.organization_members
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "organization_members_authenticated_update"
ON public.organization_members
FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "organization_members_authenticated_delete"
ON public.organization_members
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Allow anon access for development (can restrict later)
CREATE POLICY "organization_members_anon_all"
ON public.organization_members
FOR ALL
TO anon
USING (true)
WITH CHECK (true);


-- ============================================
-- PART 3: FIX ACCOUNT_ADDRESSES RLS POLICIES
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "account_addresses_select" ON public.account_addresses;
DROP POLICY IF EXISTS "account_addresses_insert" ON public.account_addresses;
DROP POLICY IF EXISTS "account_addresses_update" ON public.account_addresses;
DROP POLICY IF EXISTS "account_addresses_delete" ON public.account_addresses;
DROP POLICY IF EXISTS "Allow authenticated access" ON public.account_addresses;
DROP POLICY IF EXISTS "Allow anon access" ON public.account_addresses;
DROP POLICY IF EXISTS "Users can manage account addresses" ON public.account_addresses;

-- Enable RLS on account_addresses if not already enabled
ALTER TABLE public.account_addresses ENABLE ROW LEVEL SECURITY;

-- Create simple policies that don't cause recursion
-- For authenticated users - allow all operations
CREATE POLICY "account_addresses_authenticated_all"
ON public.account_addresses
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- For anon users - allow all operations (for development)
CREATE POLICY "account_addresses_anon_all"
ON public.account_addresses
FOR ALL
TO anon
USING (true)
WITH CHECK (true);


-- ============================================
-- PART 4: FIX PASSENGERS RLS POLICIES
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "passengers_select" ON public.passengers;
DROP POLICY IF EXISTS "passengers_insert" ON public.passengers;
DROP POLICY IF EXISTS "passengers_update" ON public.passengers;
DROP POLICY IF EXISTS "passengers_delete" ON public.passengers;
DROP POLICY IF EXISTS "Allow authenticated access" ON public.passengers;
DROP POLICY IF EXISTS "Allow anon access" ON public.passengers;

-- Enable RLS on passengers
ALTER TABLE public.passengers ENABLE ROW LEVEL SECURITY;

-- Create simple non-recursive policies
CREATE POLICY "passengers_authenticated_all"
ON public.passengers
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "passengers_anon_all"
ON public.passengers
FOR ALL
TO anon
USING (true)
WITH CHECK (true);


-- ============================================
-- PART 5: FIX BOOKING_AGENTS RLS POLICIES
-- ============================================

-- Create table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.booking_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "firstName" TEXT,
  "lastName" TEXT,
  phone TEXT,
  email TEXT,
  notes TEXT,
  organization_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Drop existing policies
DROP POLICY IF EXISTS "booking_agents_select" ON public.booking_agents;
DROP POLICY IF EXISTS "booking_agents_insert" ON public.booking_agents;
DROP POLICY IF EXISTS "booking_agents_update" ON public.booking_agents;
DROP POLICY IF EXISTS "booking_agents_delete" ON public.booking_agents;
DROP POLICY IF EXISTS "Allow authenticated access" ON public.booking_agents;
DROP POLICY IF EXISTS "Allow anon access" ON public.booking_agents;

-- Enable RLS
ALTER TABLE public.booking_agents ENABLE ROW LEVEL SECURITY;

-- Create simple policies
CREATE POLICY "booking_agents_authenticated_all"
ON public.booking_agents
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "booking_agents_anon_all"
ON public.booking_agents
FOR ALL
TO anon
USING (true)
WITH CHECK (true);


-- ============================================
-- PART 6: CREATE INDEX FOR FASTER LOOKUPS
-- ============================================

CREATE INDEX IF NOT EXISTS idx_passengers_organization ON public.passengers(organization_id);
CREATE INDEX IF NOT EXISTS idx_passengers_name ON public.passengers("lastName", "firstName");
CREATE INDEX IF NOT EXISTS idx_account_addresses_account ON public.account_addresses(account_id);
CREATE INDEX IF NOT EXISTS idx_booking_agents_organization ON public.booking_agents(organization_id);


-- ============================================
-- VERIFICATION
-- ============================================

-- Check passengers table structure
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'passengers'
ORDER BY ordinal_position;

-- Check RLS policies
SELECT 
  schemaname,
  tablename, 
  policyname, 
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE schemaname = 'public'
  AND tablename IN ('passengers', 'organization_members', 'account_addresses', 'booking_agents')
ORDER BY tablename, policyname;

-- Done!
SELECT '✅ Migration complete! Passengers table and RLS policies fixed.' as status;
