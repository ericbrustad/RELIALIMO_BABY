-- ============================================
-- FARMOUT OFFERS TABLE
-- Tracks pending/accepted/declined trip offers to drivers
-- ============================================

-- Create the farmout_offers table
CREATE TABLE IF NOT EXISTS farmout_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'cancelled')),
  driver_pay DECIMAL(10,2),
  offer_method TEXT DEFAULT 'sms' CHECK (offer_method IN ('sms', 'email', 'push', 'portal')),
  expires_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  decline_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_farmout_offers_reservation ON farmout_offers(reservation_id);
CREATE INDEX IF NOT EXISTS idx_farmout_offers_driver ON farmout_offers(driver_id);
CREATE INDEX IF NOT EXISTS idx_farmout_offers_status ON farmout_offers(status);
CREATE INDEX IF NOT EXISTS idx_farmout_offers_pending ON farmout_offers(driver_id, status) WHERE status = 'pending';

-- Enable RLS
ALTER TABLE farmout_offers ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (you can restrict later)
DROP POLICY IF EXISTS "Allow all farmout_offers operations" ON farmout_offers;
CREATE POLICY "Allow all farmout_offers operations" ON farmout_offers FOR ALL USING (true);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_farmout_offers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS farmout_offers_updated_at ON farmout_offers;
CREATE TRIGGER farmout_offers_updated_at
  BEFORE UPDATE ON farmout_offers
  FOR EACH ROW
  EXECUTE FUNCTION update_farmout_offers_updated_at();

-- Enable realtime
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'farmout_offers') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE farmout_offers;
    RAISE NOTICE 'Added farmout_offers to realtime';
  END IF;
END $$;

-- ============================================
-- ADD farmout_status COLUMN TO RESERVATIONS
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'reservations' AND column_name = 'farmout_status'
  ) THEN
    ALTER TABLE reservations ADD COLUMN farmout_status TEXT DEFAULT NULL;
    RAISE NOTICE 'Added farmout_status column to reservations';
  END IF;
END $$;

-- ============================================
-- ACTIVITY LOG TABLE (if not exists)
-- ============================================

CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  user_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_entity ON activity_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_action ON activity_log(action);
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log(created_at DESC);

-- ============================================
-- FUNCTION: Create farmout offer
-- ============================================

CREATE OR REPLACE FUNCTION create_farmout_offer(
  p_reservation_id UUID,
  p_driver_id UUID,
  p_driver_pay DECIMAL,
  p_offer_method TEXT DEFAULT 'sms',
  p_expires_minutes INT DEFAULT 15
)
RETURNS UUID AS $$
DECLARE
  v_offer_id UUID;
BEGIN
  -- Cancel any existing pending offers for this reservation
  UPDATE farmout_offers 
  SET status = 'cancelled', updated_at = NOW()
  WHERE reservation_id = p_reservation_id AND status = 'pending';
  
  -- Create new offer
  INSERT INTO farmout_offers (
    reservation_id, 
    driver_id, 
    driver_pay, 
    offer_method,
    expires_at,
    status
  ) VALUES (
    p_reservation_id,
    p_driver_id,
    p_driver_pay,
    p_offer_method,
    NOW() + (p_expires_minutes || ' minutes')::INTERVAL,
    'pending'
  ) RETURNING id INTO v_offer_id;
  
  -- Update reservation farmout_status
  UPDATE reservations 
  SET farmout_status = 'offered'
  WHERE id = p_reservation_id;
  
  RETURN v_offer_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- USAGE NOTES
-- ============================================
-- 
-- When sending a farmout offer:
-- 
-- SELECT create_farmout_offer(
--   'reservation-uuid',
--   'driver-uuid',
--   45.00,          -- driver pay
--   'sms',          -- offer method
--   15              -- expires in 15 minutes
-- );
--
-- The SMS webhook at /api/sms-webhook will:
-- 1. Receive the driver's Y/N reply
-- 2. Find the pending offer for that driver
-- 3. Update the offer status to accepted/declined
-- 4. Assign the driver to the reservation (if accepted)
-- 5. Send a confirmation SMS back to the driver
