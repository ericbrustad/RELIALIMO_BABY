-- =====================================================
-- Fix Missing Columns and Views
-- Run this in Supabase SQL Editor to fix schema issues
-- =====================================================

-- 1. Add missing dispatch_display_name column to drivers table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'drivers' 
    AND column_name = 'dispatch_display_name'
  ) THEN
    ALTER TABLE drivers ADD COLUMN dispatch_display_name TEXT;
    RAISE NOTICE 'Added dispatch_display_name column to drivers table';
  ELSE
    RAISE NOTICE 'dispatch_display_name column already exists';
  END IF;
END $$;

-- 2. Fix v_saved_rate_schemes view - use scheme_name instead of name
DROP VIEW IF EXISTS v_saved_rate_schemes CASCADE;

CREATE OR REPLACE VIEW v_saved_rate_schemes AS
SELECT 
  s.id AS scheme_id,
  s.organization_id,
  s.name AS scheme_name,  -- This is what the view should expose
  s.rate_type,
  s.source_vehicle_type_id,
  vt.name AS source_vehicle_type_name,
  (SELECT COUNT(*) FROM saved_rate_scheme_entries e WHERE e.scheme_id = s.id) AS entry_count,
  s.created_at
FROM saved_rate_schemes s
LEFT JOIN vehicle_types vt ON vt.id = s.source_vehicle_type_id
ORDER BY s.name ASC;

-- Grant access to the view
GRANT SELECT ON v_saved_rate_schemes TO anon, authenticated;

-- 3. Create vehicles view pointing to fleet_vehicles for backward compatibility
-- (Some older code references 'vehicles' table instead of 'fleet_vehicles')
DROP VIEW IF EXISTS vehicles CASCADE;

CREATE OR REPLACE VIEW vehicles AS
SELECT 
  id,
  organization_id,
  unit_number,
  veh_disp_name,
  veh_title,
  vehicle_type,
  vehicle_type_id,
  make,
  model,
  year,
  license_plate,
  vin,
  capacity,
  passenger_capacity,
  status,
  color,
  is_active,
  assigned_driver_id,
  assigned_at,
  notes,
  metadata,
  created_by,
  updated_by,
  created_at,
  updated_at,
  -- Aliases for backward compatibility
  vehicle_type AS veh_type,
  passenger_capacity AS capacity_pax
FROM fleet_vehicles;

-- Grant access to the view  
GRANT SELECT ON vehicles TO anon, authenticated;

-- 4. Create service_types table if it doesn't exist
CREATE TABLE IF NOT EXISTS service_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  status TEXT DEFAULT 'ACTIVE',
  pricing_modes JSONB DEFAULT '[]',
  custom_label TEXT,
  agreement TEXT,
  default_label TEXT,
  sort_order INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID
);

-- Enable RLS on service_types
ALTER TABLE service_types ENABLE ROW LEVEL SECURITY;

-- RLS policies for service_types
DROP POLICY IF EXISTS "Anyone can view service types" ON service_types;
CREATE POLICY "Anyone can view service types" ON service_types FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can manage service types" ON service_types;
CREATE POLICY "Authenticated users can manage service types" ON service_types 
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Insert default service types if table is empty
INSERT INTO service_types (name, code, status, sort_order)
SELECT * FROM (VALUES
  ('Point to Point', 'P2P', 'ACTIVE', 10),
  ('Hourly / As Directed', 'HOURLY', 'ACTIVE', 20),
  ('Airport Transfer', 'AIRPORT', 'ACTIVE', 30),
  ('Wedding', 'WEDDING', 'ACTIVE', 40),
  ('Special Event', 'EVENT', 'ACTIVE', 50),
  ('Corporate', 'CORP', 'ACTIVE', 60)
) AS v(name, code, status, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM service_types LIMIT 1)
ON CONFLICT DO NOTHING;

-- 5. Verify the fixes
SELECT 'dispatch_display_name column' AS check_item, 
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'drivers' 
    AND column_name = 'dispatch_display_name'
  ) THEN '✅ EXISTS' ELSE '❌ MISSING' END AS status

UNION ALL

SELECT 'v_saved_rate_schemes view' AS check_item,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.views 
    WHERE table_schema = 'public' 
    AND table_name = 'v_saved_rate_schemes'
  ) THEN '✅ EXISTS' ELSE '❌ MISSING' END AS status

UNION ALL

SELECT 'vehicles view' AS check_item,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.views 
    WHERE table_schema = 'public' 
    AND table_name = 'vehicles'
  ) THEN '✅ EXISTS' ELSE '❌ MISSING' END AS status

UNION ALL

SELECT 'service_types table' AS check_item,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'service_types'
  ) THEN '✅ EXISTS' ELSE '❌ MISSING' END AS status;
