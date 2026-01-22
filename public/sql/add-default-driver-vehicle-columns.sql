-- ============================================
-- Add Default Driver and Vehicle Type Columns
-- For customer portal booking assignment
-- ============================================

-- Add columns to drivers table for default driver selection
ALTER TABLE drivers 
ADD COLUMN IF NOT EXISTS is_default_driver BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN drivers.is_default_driver IS 'When true, this driver is a default for In-House reservation assignments from customer portal';

-- Add columns to vehicle_types table for app defaults and capacity
ALTER TABLE vehicle_types
ADD COLUMN IF NOT EXISTS is_app_default BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS show_in_app BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS passenger_capacity INTEGER DEFAULT 4,
ADD COLUMN IF NOT EXISTS base_rate DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS per_mile_rate DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS per_hour_rate DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS minimum_charge DECIMAL(10,2);

COMMENT ON COLUMN vehicle_types.is_app_default IS 'When true, this vehicle type is the default selection in the customer app';
COMMENT ON COLUMN vehicle_types.show_in_app IS 'When true, this vehicle type is shown in the customer app';
COMMENT ON COLUMN vehicle_types.passenger_capacity IS 'Maximum number of passengers this vehicle can accommodate';
COMMENT ON COLUMN vehicle_types.base_rate IS 'Base rate for this vehicle type';
COMMENT ON COLUMN vehicle_types.per_mile_rate IS 'Rate per mile for this vehicle type';
COMMENT ON COLUMN vehicle_types.per_hour_rate IS 'Hourly rate for this vehicle type';
COMMENT ON COLUMN vehicle_types.minimum_charge IS 'Minimum charge for this vehicle type';

-- Add columns to reservations for farm mode
ALTER TABLE reservations
ADD COLUMN IF NOT EXISTS farm_mode TEXT,
ADD COLUMN IF NOT EXISTS farm_status TEXT;

COMMENT ON COLUMN reservations.farm_mode IS 'Farm-out mode: manual or automatic';
COMMENT ON COLUMN reservations.farm_status IS 'Farm-out status: unassigned, offered, accepted, declined';

-- Create index for faster default driver lookups
CREATE INDEX IF NOT EXISTS idx_drivers_default ON drivers (is_default_driver) WHERE is_default_driver = TRUE;

-- Create index for faster app vehicle type lookups
CREATE INDEX IF NOT EXISTS idx_vehicle_types_app_default ON vehicle_types (is_app_default) WHERE is_app_default = TRUE;
CREATE INDEX IF NOT EXISTS idx_vehicle_types_show_in_app ON vehicle_types (show_in_app) WHERE show_in_app = TRUE;

-- Ensure only one vehicle type can be the app default (function and trigger)
CREATE OR REPLACE FUNCTION enforce_single_app_default_vehicle()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_app_default = TRUE THEN
    UPDATE vehicle_types SET is_app_default = FALSE WHERE id != NEW.id AND is_app_default = TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ensure_single_app_default_vehicle ON vehicle_types;
CREATE TRIGGER ensure_single_app_default_vehicle
  BEFORE INSERT OR UPDATE ON vehicle_types
  FOR EACH ROW
  WHEN (NEW.is_app_default = TRUE)
  EXECUTE FUNCTION enforce_single_app_default_vehicle();
