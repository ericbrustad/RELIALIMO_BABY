-- ============================================
-- Company Memos Table Setup
-- Run this in Supabase SQL Editor
-- ============================================

-- Create the company_memos table
CREATE TABLE IF NOT EXISTS company_memos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  memo_text TEXT NOT NULL,
  memo_to TEXT,
  color VARCHAR(20) DEFAULT 'yellow',
  priority VARCHAR(20) DEFAULT 'normal',
  notify_location VARCHAR(50) DEFAULT 'login',
  show_dispatch_grid BOOLEAN DEFAULT FALSE,
  show_reservation_form BOOLEAN DEFAULT FALSE,
  show_customer_portal BOOLEAN DEFAULT FALSE,
  show_driver_portal BOOLEAN DEFAULT FALSE,
  display_from DATE,
  display_to DATE,
  due_date DATE,
  author VARCHAR(100) DEFAULT 'admin',
  is_active BOOLEAN DEFAULT TRUE,
  is_pinned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_company_memos_org ON company_memos(organization_id);
CREATE INDEX IF NOT EXISTS idx_company_memos_location ON company_memos(notify_location);
CREATE INDEX IF NOT EXISTS idx_company_memos_active ON company_memos(is_active);
CREATE INDEX IF NOT EXISTS idx_company_memos_dates ON company_memos(display_from, display_to);

-- Enable RLS
ALTER TABLE company_memos ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first (safe to run multiple times)
DROP POLICY IF EXISTS "Users can read org memos" ON company_memos;
DROP POLICY IF EXISTS "Public can read portal memos" ON company_memos;
DROP POLICY IF EXISTS "Admins can insert memos" ON company_memos;
DROP POLICY IF EXISTS "Admins can update memos" ON company_memos;
DROP POLICY IF EXISTS "Admins can delete memos" ON company_memos;

-- Policy: Users can read memos for their organization
CREATE POLICY "Users can read org memos"
ON company_memos FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM organization_members 
    WHERE user_id = auth.uid()
  )
);

-- Policy: Public can read account-login and driver-login memos (for portal access)
CREATE POLICY "Public can read portal memos"
ON company_memos FOR SELECT
USING (
  notify_location IN ('account-login', 'driver-login')
  AND is_active = TRUE
);

-- Policy: Organization admins can insert memos
CREATE POLICY "Admins can insert memos"
ON company_memos FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM organization_members 
    WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
  )
);

-- Policy: Organization admins can update memos
CREATE POLICY "Admins can update memos"
ON company_memos FOR UPDATE
USING (
  organization_id IN (
    SELECT organization_id FROM organization_members 
    WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
  )
);

-- Policy: Organization admins can delete memos
CREATE POLICY "Admins can delete memos"
ON company_memos FOR DELETE
USING (
  organization_id IN (
    SELECT organization_id FROM organization_members 
    WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
  )
);

-- Create memo_dismissals table to track dismissed memos per user
CREATE TABLE IF NOT EXISTS memo_dismissals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memo_id UUID REFERENCES company_memos(id) ON DELETE CASCADE,
  user_id UUID,
  dismissed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(memo_id, user_id)
);

-- Enable RLS on memo_dismissals
ALTER TABLE memo_dismissals ENABLE ROW LEVEL SECURITY;

-- Drop existing policies on memo_dismissals
DROP POLICY IF EXISTS "Users can read own dismissals" ON memo_dismissals;
DROP POLICY IF EXISTS "Users can insert own dismissals" ON memo_dismissals;

-- Policy: Users can read their own dismissals
CREATE POLICY "Users can read own dismissals"
ON memo_dismissals FOR SELECT
USING (user_id = auth.uid() OR user_id IS NULL);

-- Policy: Users can insert their own dismissals
CREATE POLICY "Users can insert own dismissals"
ON memo_dismissals FOR INSERT
WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_company_memos_updated_at ON company_memos;
CREATE TRIGGER update_company_memos_updated_at
  BEFORE UPDATE ON company_memos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Grant access for anon key (needed for portal access without auth)
GRANT SELECT ON company_memos TO anon;
GRANT SELECT, INSERT ON memo_dismissals TO anon;

COMMENT ON TABLE company_memos IS 'Company memos/notifications for different portals';
COMMENT ON COLUMN company_memos.notify_location IS 'Where to show: login, account-login, driver-login, dispatch-res';
