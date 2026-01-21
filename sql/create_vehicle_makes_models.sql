-- =====================================================
-- Vehicle Makes and Models Tables
-- Creates database-driven make/model dropdowns
-- =====================================================

-- Function to generate deterministic slugs
-- Lowercase, spaces -> hyphens, remove apostrophes/commas/periods, collapse multiple hyphens
CREATE OR REPLACE FUNCTION generate_slug(input_text TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN LOWER(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        REGEXP_REPLACE(
          REGEXP_REPLACE(input_text, '['',.]+', '', 'g'),  -- Remove apostrophes, commas, periods
          '\s+', '-', 'g'                                   -- Spaces to hyphens
        ),
        '[^a-z0-9-]', '', 'gi'                             -- Keep only alphanumerics and hyphens
      ),
      '-+', '-', 'g'                                        -- Collapse multiple hyphens
    )
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Vehicle Makes Table
CREATE TABLE IF NOT EXISTS vehicle_makes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT,
  slug TEXT,
  logo_url TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vehicle Models Table
CREATE TABLE IF NOT EXISTS vehicle_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  make_id UUID REFERENCES vehicle_makes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  display_name TEXT,
  slug TEXT,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(make_id, name)
);

-- Add slug columns if they don't exist (for existing tables)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicle_makes' AND column_name = 'slug') THEN
    ALTER TABLE vehicle_makes ADD COLUMN slug TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicle_models' AND column_name = 'slug') THEN
    ALTER TABLE vehicle_models ADD COLUMN slug TEXT;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_vehicle_makes_name ON vehicle_makes(name);
CREATE INDEX IF NOT EXISTS idx_vehicle_makes_slug ON vehicle_makes(slug);
CREATE INDEX IF NOT EXISTS idx_vehicle_makes_active ON vehicle_makes(is_active);
CREATE INDEX IF NOT EXISTS idx_vehicle_models_make_id ON vehicle_models(make_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_models_slug ON vehicle_models(slug);
CREATE INDEX IF NOT EXISTS idx_vehicle_models_active ON vehicle_models(is_active);

-- Enable RLS
ALTER TABLE vehicle_makes ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_models ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can view vehicle makes" ON vehicle_makes;
DROP POLICY IF EXISTS "Anyone can view vehicle models" ON vehicle_models;
DROP POLICY IF EXISTS "Authenticated users can insert makes" ON vehicle_makes;
DROP POLICY IF EXISTS "Authenticated users can insert models" ON vehicle_models;

-- RLS Policies - Everyone can read makes/models
CREATE POLICY "Anyone can view vehicle makes" ON vehicle_makes FOR SELECT USING (true);
CREATE POLICY "Anyone can view vehicle models" ON vehicle_models FOR SELECT USING (true);

-- Only authenticated users can insert/update (for "Other" custom entries)
CREATE POLICY "Authenticated users can insert makes" ON vehicle_makes 
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can insert models" ON vehicle_models 
  FOR INSERT TO authenticated WITH CHECK (true);

-- =====================================================
-- Insert Vehicle Makes
-- =====================================================
INSERT INTO vehicle_makes (name, display_name, sort_order) VALUES
  ('Audi', 'Audi', 10),
  ('Battisti', 'Battisti', 20),
  ('Bentley', 'Bentley', 30),
  ('BMW', 'BMW', 40),
  ('Cadillac', 'Cadillac', 50),
  ('Chevrolet', 'Chevrolet', 60),
  ('Chrysler', 'Chrysler', 70),
  ('Dodge', 'Dodge', 80),
  ('Executive Coach Builders', 'Executive Coach Builders', 90),
  ('Ford', 'Ford', 100),
  ('Freightliner', 'Freightliner', 110),
  ('GMC', 'GMC', 120),
  ('Grech', 'Grech', 130),
  ('Infiniti', 'Infiniti', 140),
  ('International', 'International', 150),
  ('Jaguar', 'Jaguar', 160),
  ('Land Rover', 'Land Rover', 170),
  ('Lexus', 'Lexus', 180),
  ('Lincoln', 'Lincoln', 190),
  ('MCI', 'MCI', 200),
  ('Mercedes-Benz', 'Mercedes-Benz', 210),
  ('Porsche', 'Porsche', 220),
  ('Prevost', 'Prevost', 230),
  ('Range Rover', 'Range Rover', 240),
  ('Rolls-Royce', 'Rolls-Royce', 250),
  ('Sprinter', 'Mercedes Sprinter', 260),
  ('Tesla', 'Tesla', 270),
  ('Tiffany', 'Tiffany', 280),
  ('Toyota', 'Toyota', 290),
  ('Van Hool', 'Van Hool', 300),
  ('Volvo', 'Volvo', 310)
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- Insert Vehicle Models (by Make)
-- =====================================================

-- Audi
INSERT INTO vehicle_models (make_id, name, display_name, sort_order)
SELECT m.id, v.name, v.name, v.sort_order
FROM vehicle_makes m
CROSS JOIN (VALUES 
  ('A8', 1), ('A8L', 2), ('Q7', 3), ('Q8', 4), ('e-tron', 5)
) AS v(name, sort_order)
WHERE m.name = 'Audi'
ON CONFLICT (make_id, name) DO NOTHING;

-- Battisti
INSERT INTO vehicle_models (make_id, name, display_name, sort_order)
SELECT m.id, v.name, v.name, v.sort_order
FROM vehicle_makes m
CROSS JOIN (VALUES 
  ('Custom Sedan', 1), ('Custom SUV', 2), ('Custom Sprinter', 3)
) AS v(name, sort_order)
WHERE m.name = 'Battisti'
ON CONFLICT (make_id, name) DO NOTHING;

-- Bentley
INSERT INTO vehicle_models (make_id, name, display_name, sort_order)
SELECT m.id, v.name, v.name, v.sort_order
FROM vehicle_makes m
CROSS JOIN (VALUES 
  ('Flying Spur', 1), ('Bentayga', 2), ('Continental GT', 3), ('Mulsanne', 4)
) AS v(name, sort_order)
WHERE m.name = 'Bentley'
ON CONFLICT (make_id, name) DO NOTHING;

-- BMW
INSERT INTO vehicle_models (make_id, name, display_name, sort_order)
SELECT m.id, v.name, v.name, v.sort_order
FROM vehicle_makes m
CROSS JOIN (VALUES 
  ('7 Series', 1), ('740i', 2), ('750i', 3), ('X7', 4), ('X5', 5), ('i7', 6)
) AS v(name, sort_order)
WHERE m.name = 'BMW'
ON CONFLICT (make_id, name) DO NOTHING;

-- Cadillac
INSERT INTO vehicle_models (make_id, name, display_name, sort_order)
SELECT m.id, v.name, v.name, v.sort_order
FROM vehicle_makes m
CROSS JOIN (VALUES 
  ('Escalade', 1), ('Escalade ESV', 2), ('CT6', 3), ('XTS', 4), ('XT5', 5), ('XT6', 6), ('Lyriq', 7), ('DTS', 8), ('CTS', 9)
) AS v(name, sort_order)
WHERE m.name = 'Cadillac'
ON CONFLICT (make_id, name) DO NOTHING;

-- Chevrolet
INSERT INTO vehicle_models (make_id, name, display_name, sort_order)
SELECT m.id, v.name, v.name, v.sort_order
FROM vehicle_makes m
CROSS JOIN (VALUES 
  ('Suburban', 1), ('Tahoe', 2), ('Express', 3), ('Express 2500', 4), ('Express 3500', 5), ('Traverse', 6), ('Silverado', 7)
) AS v(name, sort_order)
WHERE m.name = 'Chevrolet'
ON CONFLICT (make_id, name) DO NOTHING;

-- Chrysler
INSERT INTO vehicle_models (make_id, name, display_name, sort_order)
SELECT m.id, v.name, v.name, v.sort_order
FROM vehicle_makes m
CROSS JOIN (VALUES 
  ('300', 1), ('300C', 2), ('Pacifica', 3), ('Town & Country', 4), ('Voyager', 5)
) AS v(name, sort_order)
WHERE m.name = 'Chrysler'
ON CONFLICT (make_id, name) DO NOTHING;

-- Dodge
INSERT INTO vehicle_models (make_id, name, display_name, sort_order)
SELECT m.id, v.name, v.name, v.sort_order
FROM vehicle_makes m
CROSS JOIN (VALUES 
  ('Durango', 1), ('Grand Caravan', 2), ('Charger', 3), ('Ram ProMaster', 4)
) AS v(name, sort_order)
WHERE m.name = 'Dodge'
ON CONFLICT (make_id, name) DO NOTHING;

-- Executive Coach Builders
INSERT INTO vehicle_models (make_id, name, display_name, sort_order)
SELECT m.id, v.name, v.name, v.sort_order
FROM vehicle_makes m
CROSS JOIN (VALUES 
  ('Sprinter Executive', 1), ('Mobile Office', 2), ('Luxury Van', 3)
) AS v(name, sort_order)
WHERE m.name = 'Executive Coach Builders'
ON CONFLICT (make_id, name) DO NOTHING;

-- Ford
INSERT INTO vehicle_models (make_id, name, display_name, sort_order)
SELECT m.id, v.name, v.name, v.sort_order
FROM vehicle_makes m
CROSS JOIN (VALUES 
  ('Expedition', 1), ('Expedition MAX', 2), ('Explorer', 3), ('Transit', 4), ('Transit 350', 5), ('E-350', 6), ('E-450', 7), ('F-550', 8), ('Excursion', 9)
) AS v(name, sort_order)
WHERE m.name = 'Ford'
ON CONFLICT (make_id, name) DO NOTHING;

-- Freightliner
INSERT INTO vehicle_models (make_id, name, display_name, sort_order)
SELECT m.id, v.name, v.name, v.sort_order
FROM vehicle_makes m
CROSS JOIN (VALUES 
  ('M2', 1), ('S2C', 2), ('Party Bus Chassis', 3)
) AS v(name, sort_order)
WHERE m.name = 'Freightliner'
ON CONFLICT (make_id, name) DO NOTHING;

-- GMC
INSERT INTO vehicle_models (make_id, name, display_name, sort_order)
SELECT m.id, v.name, v.name, v.sort_order
FROM vehicle_makes m
CROSS JOIN (VALUES 
  ('Yukon', 1), ('Yukon XL', 2), ('Savana', 3), ('Savana 2500', 4), ('Savana 3500', 5), ('Sierra', 6), ('Acadia', 7)
) AS v(name, sort_order)
WHERE m.name = 'GMC'
ON CONFLICT (make_id, name) DO NOTHING;

-- Grech
INSERT INTO vehicle_models (make_id, name, display_name, sort_order)
SELECT m.id, v.name, v.name, v.sort_order
FROM vehicle_makes m
CROSS JOIN (VALUES 
  ('GM33', 1), ('GM40', 2), ('Limo Bus', 3)
) AS v(name, sort_order)
WHERE m.name = 'Grech'
ON CONFLICT (make_id, name) DO NOTHING;

-- Infiniti
INSERT INTO vehicle_models (make_id, name, display_name, sort_order)
SELECT m.id, v.name, v.name, v.sort_order
FROM vehicle_makes m
CROSS JOIN (VALUES 
  ('QX80', 1), ('QX60', 2), ('QX56', 3), ('Q70L', 4)
) AS v(name, sort_order)
WHERE m.name = 'Infiniti'
ON CONFLICT (make_id, name) DO NOTHING;

-- International
INSERT INTO vehicle_models (make_id, name, display_name, sort_order)
SELECT m.id, v.name, v.name, v.sort_order
FROM vehicle_makes m
CROSS JOIN (VALUES 
  ('3200', 1), ('3400', 2), ('Party Bus Chassis', 3)
) AS v(name, sort_order)
WHERE m.name = 'International'
ON CONFLICT (make_id, name) DO NOTHING;

-- Jaguar
INSERT INTO vehicle_models (make_id, name, display_name, sort_order)
SELECT m.id, v.name, v.name, v.sort_order
FROM vehicle_makes m
CROSS JOIN (VALUES 
  ('XJ', 1), ('XJL', 2), ('F-Pace', 3), ('I-Pace', 4)
) AS v(name, sort_order)
WHERE m.name = 'Jaguar'
ON CONFLICT (make_id, name) DO NOTHING;

-- Land Rover
INSERT INTO vehicle_models (make_id, name, display_name, sort_order)
SELECT m.id, v.name, v.name, v.sort_order
FROM vehicle_makes m
CROSS JOIN (VALUES 
  ('Range Rover', 1), ('Range Rover Sport', 2), ('Defender', 3), ('Discovery', 4)
) AS v(name, sort_order)
WHERE m.name = 'Land Rover'
ON CONFLICT (make_id, name) DO NOTHING;

-- Lexus
INSERT INTO vehicle_models (make_id, name, display_name, sort_order)
SELECT m.id, v.name, v.name, v.sort_order
FROM vehicle_makes m
CROSS JOIN (VALUES 
  ('LS 460', 1), ('LS 500', 2), ('LX 570', 3), ('LX 600', 4), ('GX 460', 5), ('ES 350', 6)
) AS v(name, sort_order)
WHERE m.name = 'Lexus'
ON CONFLICT (make_id, name) DO NOTHING;

-- Lincoln
INSERT INTO vehicle_models (make_id, name, display_name, sort_order)
SELECT m.id, v.name, v.name, v.sort_order
FROM vehicle_makes m
CROSS JOIN (VALUES 
  ('Navigator', 1), ('Navigator L', 2), ('MKT', 3), ('MKS', 4), ('Continental', 5), ('Town Car', 6), ('Aviator', 7)
) AS v(name, sort_order)
WHERE m.name = 'Lincoln'
ON CONFLICT (make_id, name) DO NOTHING;

-- MCI
INSERT INTO vehicle_models (make_id, name, display_name, sort_order)
SELECT m.id, v.name, v.name, v.sort_order
FROM vehicle_makes m
CROSS JOIN (VALUES 
  ('J4500', 1), ('D4500', 2), ('D45 CRT LE', 3)
) AS v(name, sort_order)
WHERE m.name = 'MCI'
ON CONFLICT (make_id, name) DO NOTHING;

-- Mercedes-Benz
INSERT INTO vehicle_models (make_id, name, display_name, sort_order)
SELECT m.id, v.name, v.name, v.sort_order
FROM vehicle_makes m
CROSS JOIN (VALUES 
  ('S-Class', 1), ('S550', 2), ('S560', 3), ('S580', 4), ('Maybach', 5), ('E-Class', 6), ('GLS', 7), ('GLE', 8), ('V-Class', 9), ('Sprinter', 10), ('Metris', 11)
) AS v(name, sort_order)
WHERE m.name = 'Mercedes-Benz'
ON CONFLICT (make_id, name) DO NOTHING;

-- Porsche
INSERT INTO vehicle_models (make_id, name, display_name, sort_order)
SELECT m.id, v.name, v.name, v.sort_order
FROM vehicle_makes m
CROSS JOIN (VALUES 
  ('Panamera', 1), ('Cayenne', 2), ('Taycan', 3)
) AS v(name, sort_order)
WHERE m.name = 'Porsche'
ON CONFLICT (make_id, name) DO NOTHING;

-- Prevost
INSERT INTO vehicle_models (make_id, name, display_name, sort_order)
SELECT m.id, v.name, v.name, v.sort_order
FROM vehicle_makes m
CROSS JOIN (VALUES 
  ('H3-45', 1), ('X3-45', 2), ('Entertainer Coach', 3)
) AS v(name, sort_order)
WHERE m.name = 'Prevost'
ON CONFLICT (make_id, name) DO NOTHING;

-- Range Rover
INSERT INTO vehicle_models (make_id, name, display_name, sort_order)
SELECT m.id, v.name, v.name, v.sort_order
FROM vehicle_makes m
CROSS JOIN (VALUES 
  ('Autobiography', 1), ('Sport', 2), ('Velar', 3), ('Evoque', 4), ('LWB', 5)
) AS v(name, sort_order)
WHERE m.name = 'Range Rover'
ON CONFLICT (make_id, name) DO NOTHING;

-- Rolls-Royce
INSERT INTO vehicle_models (make_id, name, display_name, sort_order)
SELECT m.id, v.name, v.name, v.sort_order
FROM vehicle_makes m
CROSS JOIN (VALUES 
  ('Phantom', 1), ('Ghost', 2), ('Cullinan', 3), ('Dawn', 4), ('Wraith', 5)
) AS v(name, sort_order)
WHERE m.name = 'Rolls-Royce'
ON CONFLICT (make_id, name) DO NOTHING;

-- Sprinter
INSERT INTO vehicle_models (make_id, name, display_name, sort_order)
SELECT m.id, v.name, v.name, v.sort_order
FROM vehicle_makes m
CROSS JOIN (VALUES 
  ('2500', 1), ('3500', 2), ('4500', 3), ('Executive', 4), ('Limo', 5), ('Party Bus', 6)
) AS v(name, sort_order)
WHERE m.name = 'Sprinter'
ON CONFLICT (make_id, name) DO NOTHING;

-- Tesla
INSERT INTO vehicle_models (make_id, name, display_name, sort_order)
SELECT m.id, v.name, v.name, v.sort_order
FROM vehicle_makes m
CROSS JOIN (VALUES 
  ('Model S', 1), ('Model X', 2), ('Model Y', 3), ('Model 3', 4)
) AS v(name, sort_order)
WHERE m.name = 'Tesla'
ON CONFLICT (make_id, name) DO NOTHING;

-- Tiffany
INSERT INTO vehicle_models (make_id, name, display_name, sort_order)
SELECT m.id, v.name, v.name, v.sort_order
FROM vehicle_makes m
CROSS JOIN (VALUES 
  ('Town Car', 1), ('Sprinter Conversion', 2), ('Executive Van', 3)
) AS v(name, sort_order)
WHERE m.name = 'Tiffany'
ON CONFLICT (make_id, name) DO NOTHING;

-- Toyota
INSERT INTO vehicle_models (make_id, name, display_name, sort_order)
SELECT m.id, v.name, v.name, v.sort_order
FROM vehicle_makes m
CROSS JOIN (VALUES 
  ('Sequoia', 1), ('Land Cruiser', 2), ('Sienna', 3), ('Highlander', 4)
) AS v(name, sort_order)
WHERE m.name = 'Toyota'
ON CONFLICT (make_id, name) DO NOTHING;

-- Van Hool
INSERT INTO vehicle_models (make_id, name, display_name, sort_order)
SELECT m.id, v.name, v.name, v.sort_order
FROM vehicle_makes m
CROSS JOIN (VALUES 
  ('CX35', 1), ('CX45', 2), ('TX', 3)
) AS v(name, sort_order)
WHERE m.name = 'Van Hool'
ON CONFLICT (make_id, name) DO NOTHING;

-- Volvo
INSERT INTO vehicle_models (make_id, name, display_name, sort_order)
SELECT m.id, v.name, v.name, v.sort_order
FROM vehicle_makes m
CROSS JOIN (VALUES 
  ('S90', 1), ('XC90', 2), ('XC60', 3)
) AS v(name, sort_order)
WHERE m.name = 'Volvo'
ON CONFLICT (make_id, name) DO NOTHING;

-- =====================================================
-- Update slugs and image URLs
-- =====================================================

-- Update make slugs using the generate_slug function
UPDATE vehicle_makes
SET slug = generate_slug(name)
WHERE slug IS NULL OR slug = '';

-- Update model slugs using the generate_slug function
UPDATE vehicle_models
SET slug = generate_slug(name)
WHERE slug IS NULL OR slug = '';

-- Update image_url to use Supabase storage public URLs
-- Pattern: https://siumiadylwcrkaqsfwkj.supabase.co/storage/v1/object/public/images/vehicles/models/{make_slug}/{model_slug}.jpg
UPDATE vehicle_models vm
SET image_url = 'https://siumiadylwcrkaqsfwkj.supabase.co/storage/v1/object/public/images/vehicles/models/' || m.slug || '/' || vm.slug || '.jpg'
FROM vehicle_makes m
WHERE vm.make_id = m.id;

-- =====================================================
-- Verify counts
-- =====================================================
SELECT 'Vehicle Makes' as table_name, COUNT(*) as count FROM vehicle_makes
UNION ALL
SELECT 'Vehicle Models' as table_name, COUNT(*) as count FROM vehicle_models;

-- Show sample slugs and image_urls for verification
SELECT 
  m.name as make_name, 
  m.slug as make_slug,
  vm.name as model_name, 
  vm.slug as model_slug,
  vm.image_url
FROM vehicle_models vm
JOIN vehicle_makes m ON vm.make_id = m.id
WHERE m.name IN ('Mercedes-Benz', 'Range Rover', 'MCI', 'Rolls-Royce')
ORDER BY m.name, vm.sort_order
LIMIT 15;
