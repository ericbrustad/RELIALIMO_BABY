-- Add farmout automation columns to reservations table
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/siumiadylwcrkaqsfwkj/sql

-- Farmout status tracking
ALTER TABLE reservations 
ADD COLUMN IF NOT EXISTS farmout_status TEXT DEFAULT 'none';

COMMENT ON COLUMN reservations.farmout_status IS 'Farmout automation status: none, pending, searching, offered, assigned, declined, exhausted, cancelled';

-- Farmout mode (manual vs automatic)
ALTER TABLE reservations 
ADD COLUMN IF NOT EXISTS farmout_mode TEXT DEFAULT 'manual';

COMMENT ON COLUMN reservations.farmout_mode IS 'Farmout mode: manual (dispatcher controls) or automatic (system auto-offers to drivers)';

-- Driver assignment for farmout
ALTER TABLE reservations 
ADD COLUMN IF NOT EXISTS assigned_driver_id UUID REFERENCES drivers(id);

ALTER TABLE reservations 
ADD COLUMN IF NOT EXISTS assigned_driver_name TEXT;

-- Farmout offer tracking
ALTER TABLE reservations 
ADD COLUMN IF NOT EXISTS current_offer_driver_id UUID REFERENCES drivers(id);

ALTER TABLE reservations 
ADD COLUMN IF NOT EXISTS current_offer_sent_at TIMESTAMPTZ;

ALTER TABLE reservations 
ADD COLUMN IF NOT EXISTS current_offer_expires_at TIMESTAMPTZ;

-- Farmout history
ALTER TABLE reservations 
ADD COLUMN IF NOT EXISTS farmout_attempts INTEGER DEFAULT 0;

ALTER TABLE reservations 
ADD COLUMN IF NOT EXISTS farmout_declined_drivers UUID[] DEFAULT '{}';

ALTER TABLE reservations 
ADD COLUMN IF NOT EXISTS farmout_notes TEXT;

-- Create index for farmout queries
CREATE INDEX IF NOT EXISTS idx_reservations_farmout_status 
ON reservations(farmout_status) 
WHERE farmout_status IS NOT NULL AND farmout_status != 'none';

CREATE INDEX IF NOT EXISTS idx_reservations_assigned_driver 
ON reservations(assigned_driver_id) 
WHERE assigned_driver_id IS NOT NULL;

-- Verify columns were added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'reservations' 
AND column_name LIKE '%farmout%' OR column_name LIKE '%assigned_driver%'
ORDER BY column_name;
