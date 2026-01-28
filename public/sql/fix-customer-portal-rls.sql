-- Fix RLS policies for customer portal tables
-- These tables need INSERT permission for authenticated users

-- ============================================
-- customer_addresses table
-- ============================================
-- Drop existing restrictive policies
DROP POLICY IF EXISTS "customer_addresses_insert" ON public.customer_addresses;
DROP POLICY IF EXISTS "customer_addresses_select" ON public.customer_addresses;
DROP POLICY IF EXISTS "customer_addresses_update" ON public.customer_addresses;
DROP POLICY IF EXISTS "customer_addresses_delete" ON public.customer_addresses;
DROP POLICY IF EXISTS "customer_addresses_anon" ON public.customer_addresses;
DROP POLICY IF EXISTS "customer_addresses_service_role" ON public.customer_addresses;
DROP POLICY IF EXISTS "Allow authenticated insert" ON public.customer_addresses;
DROP POLICY IF EXISTS "Allow authenticated select" ON public.customer_addresses;
DROP POLICY IF EXISTS "Allow service role full access" ON public.customer_addresses;

-- Enable RLS
ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert their own addresses
CREATE POLICY "customer_addresses_insert"
ON public.customer_addresses
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to select addresses
CREATE POLICY "customer_addresses_select"
ON public.customer_addresses
FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to update their own addresses
CREATE POLICY "customer_addresses_update"
ON public.customer_addresses
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow service role full access
CREATE POLICY "customer_addresses_service_role"
ON public.customer_addresses
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Allow anon users full access (for customer portal)
CREATE POLICY "customer_addresses_anon"
ON public.customer_addresses
FOR ALL
TO anon
USING (true)
WITH CHECK (true);

-- ============================================
-- customer_passengers table
-- ============================================
-- Drop existing restrictive policies
DROP POLICY IF EXISTS "customer_passengers_insert" ON public.customer_passengers;
DROP POLICY IF EXISTS "customer_passengers_select" ON public.customer_passengers;
DROP POLICY IF EXISTS "customer_passengers_update" ON public.customer_passengers;
DROP POLICY IF EXISTS "customer_passengers_delete" ON public.customer_passengers;
DROP POLICY IF EXISTS "customer_passengers_anon" ON public.customer_passengers;
DROP POLICY IF EXISTS "customer_passengers_service_role" ON public.customer_passengers;
DROP POLICY IF EXISTS "Allow authenticated insert" ON public.customer_passengers;
DROP POLICY IF EXISTS "Allow authenticated select" ON public.customer_passengers;
DROP POLICY IF EXISTS "Allow service role full access" ON public.customer_passengers;

-- Enable RLS
ALTER TABLE public.customer_passengers ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert passengers
CREATE POLICY "customer_passengers_insert"
ON public.customer_passengers
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to select passengers
CREATE POLICY "customer_passengers_select"
ON public.customer_passengers
FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to update passengers
CREATE POLICY "customer_passengers_update"
ON public.customer_passengers
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow service role full access
CREATE POLICY "customer_passengers_service_role"
ON public.customer_passengers
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Allow anon users full access (for customer portal)
CREATE POLICY "customer_passengers_anon"
ON public.customer_passengers
FOR ALL
TO anon
USING (true)
WITH CHECK (true);

-- ============================================
-- Also grant table permissions
-- ============================================
GRANT SELECT, INSERT, UPDATE ON public.customer_addresses TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.customer_passengers TO authenticated;
GRANT ALL ON public.customer_addresses TO service_role;
GRANT ALL ON public.customer_passengers TO service_role;

-- Grant access to anon for public portal access
GRANT SELECT, INSERT, UPDATE ON public.customer_addresses TO anon;
GRANT SELECT, INSERT, UPDATE ON public.customer_passengers TO anon;
