-- ============================================
-- ADD DRIVER RATING AND FARMOUT OFFERS TABLES
-- ============================================
-- This script adds the driver rating system and farmout offer tracking

-- ============================================
-- PART 1: Add driver_rating column to drivers
-- ============================================

-- Add rating column (1-10, default 5)
ALTER TABLE public.drivers 
ADD COLUMN IF NOT EXISTS driver_rating INTEGER DEFAULT 5 
CHECK (driver_rating >= 1 AND driver_rating <= 10);

-- Add affiliate_id column if not exists (for affiliate company association)
ALTER TABLE public.drivers 
ADD COLUMN IF NOT EXISTS affiliate_id UUID REFERENCES public.affiliates(id);

-- Add service areas column (JSONB array of service area names/codes)
ALTER TABLE public.drivers 
ADD COLUMN IF NOT EXISTS service_areas JSONB DEFAULT '[]'::jsonb;

-- Add preferred vehicle types (JSONB array)
ALTER TABLE public.drivers 
ADD COLUMN IF NOT EXISTS preferred_vehicle_types JSONB DEFAULT '[]'::jsonb;

-- Add availability status for quick checks
ALTER TABLE public.drivers 
ADD COLUMN IF NOT EXISTS availability_status TEXT DEFAULT 'available' 
CHECK (availability_status IN ('available', 'busy', 'offline', 'on_trip'));

-- Add last offer timestamp to track 24-hour cooldown
ALTER TABLE public.drivers 
ADD COLUMN IF NOT EXISTS last_farmout_offer_at TIMESTAMPTZ;

-- ============================================
-- PART 2: Create farmout_offers table
-- ============================================

CREATE TABLE IF NOT EXISTS public.farmout_offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Reservation reference
    reservation_id UUID NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
    confirmation_number TEXT,
    
    -- Driver reference
    driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
    
    -- Offer details
    offer_status TEXT NOT NULL DEFAULT 'pending' 
        CHECK (offer_status IN ('pending', 'sent', 'accepted', 'rejected', 'expired', 'cancelled')),
    
    -- Timing
    offered_at TIMESTAMPTZ DEFAULT NOW(),
    responded_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,  -- 15 minutes after offered_at
    
    -- Communication
    sms_sent BOOLEAN DEFAULT FALSE,
    sms_sent_at TIMESTAMPTZ,
    in_app_shown BOOLEAN DEFAULT FALSE,
    
    -- Response
    response_method TEXT CHECK (response_method IN ('sms', 'in_app', 'auto_expired')),
    
    -- Offer content snapshot (what was shown to driver)
    offer_details JSONB DEFAULT '{}'::jsonb,
    
    -- Pay offered (70% of total)
    pay_offered DECIMAL(10,2),
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_farmout_offers_reservation ON public.farmout_offers(reservation_id);
CREATE INDEX IF NOT EXISTS idx_farmout_offers_driver ON public.farmout_offers(driver_id);
CREATE INDEX IF NOT EXISTS idx_farmout_offers_status ON public.farmout_offers(offer_status);
CREATE INDEX IF NOT EXISTS idx_farmout_offers_expires ON public.farmout_offers(expires_at) WHERE offer_status = 'pending';

-- ============================================
-- PART 3: Create farmout_queue table
-- ============================================
-- Queue for reservations waiting to be offered (overnight, etc.)

CREATE TABLE IF NOT EXISTS public.farmout_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Reservation reference
    reservation_id UUID NOT NULL UNIQUE REFERENCES public.reservations(id) ON DELETE CASCADE,
    confirmation_number TEXT,
    
    -- Queue status
    queue_status TEXT NOT NULL DEFAULT 'queued' 
        CHECK (queue_status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')),
    
    -- Priority (based on pickup time)
    priority INTEGER DEFAULT 0,
    pickup_datetime TIMESTAMPTZ,
    
    -- Processing
    current_driver_index INTEGER DEFAULT 0,  -- Which driver we're on in the priority list
    attempt_count INTEGER DEFAULT 0,
    last_attempt_at TIMESTAMPTZ,
    next_attempt_at TIMESTAMPTZ,
    
    -- Driver priority list (ordered by rating, service area, etc.)
    driver_priority_list JSONB DEFAULT '[]'::jsonb,
    
    -- Drivers who have already been offered (with timestamps)
    offered_drivers JSONB DEFAULT '{}'::jsonb,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Index for queue processing
CREATE INDEX IF NOT EXISTS idx_farmout_queue_status ON public.farmout_queue(queue_status);
CREATE INDEX IF NOT EXISTS idx_farmout_queue_next_attempt ON public.farmout_queue(next_attempt_at) 
    WHERE queue_status IN ('queued', 'processing');

-- ============================================
-- PART 4: Create farmout_settings table
-- ============================================

CREATE TABLE IF NOT EXISTS public.farmout_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID,
    
    -- Timing settings
    offer_window_start TIME DEFAULT '08:00:00',  -- 8 AM
    offer_window_end TIME DEFAULT '21:00:00',    -- 9 PM
    offer_timeout_minutes INTEGER DEFAULT 15,
    offer_spacing_minutes INTEGER DEFAULT 2,
    driver_cooldown_hours INTEGER DEFAULT 24,
    
    -- On-demand settings
    on_demand_threshold_hours INTEGER DEFAULT 2,  -- Within 2 hours = on-demand
    prioritize_available_for_on_demand BOOLEAN DEFAULT TRUE,
    
    -- Pay settings
    driver_pay_percentage DECIMAL(5,2) DEFAULT 70.00,  -- 70% of total
    
    -- Notification settings
    send_sms_offers BOOLEAN DEFAULT TRUE,
    send_in_app_offers BOOLEAN DEFAULT TRUE,
    notify_admin_on_exhausted BOOLEAN DEFAULT TRUE,
    
    -- SMS templates
    sms_offer_template TEXT DEFAULT 'New trip offer! {pickup_date} {pickup_time}, {pickup_city} to {dropoff_city}. {pax_count} pax, {vehicle_type}. Est. {duration}. Pay: ${pay_amount}. Reply Y to accept, N to decline.',
    sms_accepted_template TEXT DEFAULT 'Great! You''ve been assigned to reservation {conf_number}. View details: {portal_link}',
    sms_rejected_template TEXT DEFAULT 'No problem. We''ll offer this trip to another driver.',
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default settings if not exists
INSERT INTO public.farmout_settings (id)
SELECT gen_random_uuid()
WHERE NOT EXISTS (SELECT 1 FROM public.farmout_settings);

-- ============================================
-- PART 5: RLS Policies
-- ============================================

-- Enable RLS
ALTER TABLE public.farmout_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farmout_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farmout_settings ENABLE ROW LEVEL SECURITY;

-- Farmout offers policies
CREATE POLICY "farmout_offers_anon_all" ON public.farmout_offers FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "farmout_offers_auth_all" ON public.farmout_offers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Farmout queue policies
CREATE POLICY "farmout_queue_anon_all" ON public.farmout_queue FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "farmout_queue_auth_all" ON public.farmout_queue FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Farmout settings policies
CREATE POLICY "farmout_settings_anon_all" ON public.farmout_settings FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "farmout_settings_auth_all" ON public.farmout_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- PART 6: Update trigger for updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_farmout_offers_updated_at ON public.farmout_offers;
CREATE TRIGGER update_farmout_offers_updated_at
    BEFORE UPDATE ON public.farmout_offers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_farmout_queue_updated_at ON public.farmout_queue;
CREATE TRIGGER update_farmout_queue_updated_at
    BEFORE UPDATE ON public.farmout_queue
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- DONE!
-- ============================================
SELECT 'Driver rating and farmout offer tables created successfully!' as result;
