-- ============================================
-- Driver Payables System Setup
-- Run this in Supabase SQL Editor
-- ============================================

-- Create driver_payables table to track what drivers are owed
CREATE TABLE IF NOT EXISTS driver_payables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  total_trips INTEGER DEFAULT 0,
  total_amount DECIMAL(10,2) DEFAULT 0.00,
  paid_amount DECIMAL(10,2) DEFAULT 0.00,
  unpaid_amount DECIMAL(10,2) DEFAULT 0.00,
  last_trip_date TIMESTAMPTZ,
  last_payment_date TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(driver_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_driver_payables_driver ON driver_payables(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_payables_org ON driver_payables(organization_id);
CREATE INDEX IF NOT EXISTS idx_driver_payables_status ON driver_payables(status);

-- Create driver_payment_records table for payment history
CREATE TABLE IF NOT EXISTS driver_payment_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  payment_method VARCHAR(50),
  payment_reference VARCHAR(100),
  pay_period_start DATE,
  pay_period_end DATE,
  trips_count INTEGER DEFAULT 0,
  notes TEXT,
  paid_by VARCHAR(100),
  paid_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_driver_payments_driver ON driver_payment_records(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_payments_date ON driver_payment_records(paid_at);

-- Enable RLS
ALTER TABLE driver_payables ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_payment_records ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view driver payables" ON driver_payables;
DROP POLICY IF EXISTS "Users can update driver payables" ON driver_payables;
DROP POLICY IF EXISTS "Users can view payment records" ON driver_payment_records;
DROP POLICY IF EXISTS "Users can insert payment records" ON driver_payment_records;

-- Policies for driver_payables
CREATE POLICY "Users can view driver payables"
ON driver_payables FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM organization_members 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update driver payables"
ON driver_payables FOR ALL
USING (
  organization_id IN (
    SELECT organization_id FROM organization_members 
    WHERE user_id = auth.uid()
  )
);

-- Policies for driver_payment_records
CREATE POLICY "Users can view payment records"
ON driver_payment_records FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM organization_members 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert payment records"
ON driver_payment_records FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM organization_members 
    WHERE user_id = auth.uid()
  )
);

-- ============================================
-- TRIGGER: When a driver is added
-- ============================================
CREATE OR REPLACE FUNCTION on_driver_created()
RETURNS TRIGGER AS $$
BEGIN
  -- Create a payables record for the new driver
  INSERT INTO driver_payables (driver_id, organization_id, status)
  VALUES (NEW.id, NEW.organization_id, 'active')
  ON CONFLICT (driver_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_driver_created ON drivers;
CREATE TRIGGER trigger_driver_created
  AFTER INSERT ON drivers
  FOR EACH ROW
  EXECUTE FUNCTION on_driver_created();

-- ============================================
-- TRIGGER: When a driver is deleted
-- ============================================
CREATE OR REPLACE FUNCTION on_driver_deleted()
RETURNS TRIGGER AS $$
BEGIN
  -- Payables will be deleted automatically due to CASCADE
  -- But we log it for audit purposes
  RAISE NOTICE 'Driver % deleted, payables cascaded', OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_driver_deleted ON drivers;
CREATE TRIGGER trigger_driver_deleted
  BEFORE DELETE ON drivers
  FOR EACH ROW
  EXECUTE FUNCTION on_driver_deleted();

-- ============================================
-- TRIGGER: When a reservation is completed
-- ============================================
CREATE OR REPLACE FUNCTION on_reservation_completed()
RETURNS TRIGGER AS $$
DECLARE
  v_driver_pay DECIMAL(10,2);
  v_driver_id UUID;
  v_org_id UUID;
  v_pickup_dt TIMESTAMPTZ;
BEGIN
  -- Get driver_id from assigned_driver_id (the actual column name)
  v_driver_id := NEW.assigned_driver_id;
  
  -- Only process if status is 'completed' and has a driver
  IF NEW.status = 'completed' AND v_driver_id IS NOT NULL THEN
    -- Get organization
    v_org_id := NEW.organization_id;
    v_pickup_dt := COALESCE(NEW.pickup_datetime, NOW());
    
    -- Calculate driver pay (70% of grand_total)
    v_driver_pay := COALESCE(NEW.grand_total, 0) * 0.70;
    
    -- Update or insert driver payables
    INSERT INTO driver_payables (driver_id, organization_id, total_trips, total_amount, unpaid_amount, last_trip_date)
    VALUES (v_driver_id, v_org_id, 1, v_driver_pay, v_driver_pay, v_pickup_dt)
    ON CONFLICT (driver_id) DO UPDATE SET
      total_trips = driver_payables.total_trips + 1,
      total_amount = driver_payables.total_amount + v_driver_pay,
      unpaid_amount = driver_payables.unpaid_amount + v_driver_pay,
      last_trip_date = GREATEST(driver_payables.last_trip_date, v_pickup_dt),
      updated_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_reservation_completed ON reservations;
CREATE TRIGGER trigger_reservation_completed
  AFTER UPDATE ON reservations
  FOR EACH ROW
  EXECUTE FUNCTION on_reservation_completed();

-- Also trigger on INSERT if reservation is created as completed
DROP TRIGGER IF EXISTS trigger_reservation_insert_completed ON reservations;
CREATE TRIGGER trigger_reservation_insert_completed
  AFTER INSERT ON reservations
  FOR EACH ROW
  EXECUTE FUNCTION on_reservation_completed();

-- ============================================
-- TRIGGER: When a reservation is deleted
-- ============================================
CREATE OR REPLACE FUNCTION on_reservation_deleted()
RETURNS TRIGGER AS $$
DECLARE
  v_driver_pay DECIMAL(10,2);
  v_driver_id UUID;
BEGIN
  -- Get driver_id from assigned_driver_id
  v_driver_id := OLD.assigned_driver_id;
  
  -- Only process if the deleted reservation was completed and had a driver
  IF OLD.status = 'completed' AND v_driver_id IS NOT NULL THEN
    v_driver_pay := COALESCE(OLD.grand_total, 0) * 0.70;
    
    -- Subtract from driver payables
    UPDATE driver_payables SET
      total_trips = GREATEST(total_trips - 1, 0),
      total_amount = GREATEST(total_amount - v_driver_pay, 0),
      unpaid_amount = GREATEST(unpaid_amount - v_driver_pay, 0),
      updated_at = NOW()
    WHERE driver_id = v_driver_id;
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_reservation_deleted ON reservations;
CREATE TRIGGER trigger_reservation_deleted
  BEFORE DELETE ON reservations
  FOR EACH ROW
  EXECUTE FUNCTION on_reservation_deleted();

-- ============================================
-- TRIGGER: When a reservation driver is changed
-- ============================================
CREATE OR REPLACE FUNCTION on_reservation_driver_changed()
RETURNS TRIGGER AS $$
DECLARE
  v_driver_pay DECIMAL(10,2);
  v_old_driver_id UUID;
  v_new_driver_id UUID;
  v_org_id UUID;
  v_pickup_dt TIMESTAMPTZ;
BEGIN
  -- Get driver_id from assigned_driver_id
  v_old_driver_id := OLD.assigned_driver_id;
  v_new_driver_id := NEW.assigned_driver_id;
  
  -- Only process completed reservations with driver changes
  IF NEW.status = 'completed' AND v_old_driver_id IS DISTINCT FROM v_new_driver_id THEN
    v_org_id := NEW.organization_id;
    v_pickup_dt := COALESCE(NEW.pickup_datetime, NOW());
    v_driver_pay := COALESCE(NEW.grand_total, 0) * 0.70;
    
    -- Remove from old driver if exists
    IF v_old_driver_id IS NOT NULL THEN
      UPDATE driver_payables SET
        total_trips = GREATEST(total_trips - 1, 0),
        total_amount = GREATEST(total_amount - v_driver_pay, 0),
        unpaid_amount = GREATEST(unpaid_amount - v_driver_pay, 0),
        updated_at = NOW()
      WHERE driver_id = v_old_driver_id;
    END IF;
    
    -- Add to new driver if exists
    IF v_new_driver_id IS NOT NULL THEN
      INSERT INTO driver_payables (driver_id, organization_id, total_trips, total_amount, unpaid_amount, last_trip_date)
      VALUES (v_new_driver_id, v_org_id, 1, v_driver_pay, v_driver_pay, v_pickup_dt)
      ON CONFLICT (driver_id) DO UPDATE SET
        total_trips = driver_payables.total_trips + 1,
        total_amount = driver_payables.total_amount + v_driver_pay,
        unpaid_amount = driver_payables.unpaid_amount + v_driver_pay,
        last_trip_date = GREATEST(driver_payables.last_trip_date, v_pickup_dt),
        updated_at = NOW();
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_reservation_driver_changed ON reservations;
CREATE TRIGGER trigger_reservation_driver_changed
  AFTER UPDATE ON reservations
  FOR EACH ROW
  EXECUTE FUNCTION on_reservation_driver_changed();

-- ============================================
-- FUNCTION: Record a driver payment
-- ============================================
CREATE OR REPLACE FUNCTION record_driver_payment(
  p_driver_id UUID,
  p_amount DECIMAL(10,2),
  p_payment_method VARCHAR(50) DEFAULT 'check',
  p_payment_reference VARCHAR(100) DEFAULT NULL,
  p_pay_period_start DATE DEFAULT NULL,
  p_pay_period_end DATE DEFAULT NULL,
  p_trips_count INTEGER DEFAULT 0,
  p_notes TEXT DEFAULT NULL,
  p_paid_by VARCHAR(100) DEFAULT 'admin'
)
RETURNS UUID AS $$
DECLARE
  payment_id UUID;
  org_id UUID;
BEGIN
  -- Get organization from driver
  SELECT organization_id INTO org_id FROM drivers WHERE id = p_driver_id;
  
  -- Insert payment record
  INSERT INTO driver_payment_records (
    driver_id, organization_id, amount, payment_method, payment_reference,
    pay_period_start, pay_period_end, trips_count, notes, paid_by
  ) VALUES (
    p_driver_id, org_id, p_amount, p_payment_method, p_payment_reference,
    p_pay_period_start, p_pay_period_end, p_trips_count, p_notes, p_paid_by
  ) RETURNING id INTO payment_id;
  
  -- Update driver payables
  UPDATE driver_payables SET
    paid_amount = paid_amount + p_amount,
    unpaid_amount = GREATEST(unpaid_amount - p_amount, 0),
    last_payment_date = NOW(),
    updated_at = NOW()
  WHERE driver_id = p_driver_id;
  
  RETURN payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCTION: Initialize payables for existing drivers
-- (Run once to populate for existing drivers)
-- ============================================
CREATE OR REPLACE FUNCTION initialize_driver_payables()
RETURNS INTEGER AS $$
DECLARE
  inserted_count INTEGER := 0;
BEGIN
  -- Insert payables records for all drivers that don't have one
  INSERT INTO driver_payables (driver_id, organization_id, status)
  SELECT d.id, d.organization_id, 'active'
  FROM drivers d
  WHERE NOT EXISTS (
    SELECT 1 FROM driver_payables dp WHERE dp.driver_id = d.id
  );
  
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  
  -- Update trip counts from completed reservations
  -- Uses assigned_driver_id column from reservations table
  UPDATE driver_payables dp SET
    total_trips = COALESCE(stats.trip_count, 0),
    total_amount = COALESCE(stats.total_pay, 0),
    unpaid_amount = COALESCE(stats.total_pay, 0),
    last_trip_date = stats.last_trip
  FROM (
    SELECT 
      r.assigned_driver_id as the_driver_id,
      COUNT(*) as trip_count,
      SUM(COALESCE(r.grand_total, 0) * 0.70) as total_pay,
      MAX(r.pickup_datetime) as last_trip
    FROM reservations r
    WHERE r.status = 'completed' 
      AND r.assigned_driver_id IS NOT NULL
    GROUP BY r.assigned_driver_id
  ) stats
  WHERE dp.driver_id = stats.the_driver_id;
  
  RETURN inserted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Run initialization
SELECT initialize_driver_payables();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON driver_payables TO authenticated;
GRANT SELECT, INSERT ON driver_payment_records TO authenticated;
GRANT EXECUTE ON FUNCTION record_driver_payment TO authenticated;

COMMENT ON TABLE driver_payables IS 'Tracks unpaid amounts owed to each driver';
COMMENT ON TABLE driver_payment_records IS 'History of payments made to drivers';
COMMENT ON FUNCTION record_driver_payment IS 'Records a payment to a driver and updates their payables balance';
