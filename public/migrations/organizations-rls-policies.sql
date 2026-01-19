-- =====================================================
-- ORGANIZATIONS TABLE RLS POLICIES
-- Allow authenticated users to manage organization data
-- =====================================================

-- Enable RLS on organizations table (if not already enabled)
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Allow authenticated users to view organizations" ON organizations;
DROP POLICY IF EXISTS "Allow authenticated users to insert organizations" ON organizations;
DROP POLICY IF EXISTS "Allow authenticated users to update organizations" ON organizations;
DROP POLICY IF EXISTS "Allow authenticated users to delete organizations" ON organizations;
DROP POLICY IF EXISTS "organizations_select_policy" ON organizations;
DROP POLICY IF EXISTS "organizations_insert_policy" ON organizations;
DROP POLICY IF EXISTS "organizations_update_policy" ON organizations;
DROP POLICY IF EXISTS "organizations_delete_policy" ON organizations;

-- Create policies for authenticated users
-- SELECT: Allow all authenticated users to view
CREATE POLICY "organizations_select_policy" ON organizations
    FOR SELECT
    TO authenticated
    USING (true);

-- INSERT: Allow authenticated users to insert
CREATE POLICY "organizations_insert_policy" ON organizations
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- UPDATE: Allow authenticated users to update
CREATE POLICY "organizations_update_policy" ON organizations
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- DELETE: Allow authenticated users to delete
CREATE POLICY "organizations_delete_policy" ON organizations
    FOR DELETE
    TO authenticated
    USING (true);

-- Also allow anon users to read (for public-facing features)
DROP POLICY IF EXISTS "organizations_anon_select_policy" ON organizations;
CREATE POLICY "organizations_anon_select_policy" ON organizations
    FOR SELECT
    TO anon
    USING (true);

-- =====================================================
-- DONE! Verify policies:
-- =====================================================
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'organizations';
