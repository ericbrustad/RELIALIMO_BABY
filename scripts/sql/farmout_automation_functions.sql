-- ============================================
-- FARMOUT AUTOMATION: Supabase Functions
-- ============================================
-- These functions handle the heavy lifting for farmout automation
-- to reduce client-side processing.
-- ============================================

-- ============================================
-- 1. FARMOUT SETTINGS TABLE (if not exists)
-- ============================================
CREATE TABLE IF NOT EXISTS public.farmout_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id),
    
    -- Timing Settings
    offer_timeout_minutes INTEGER DEFAULT 15,
    driver_cooldown_hours INTEGER DEFAULT 24,
    offer_window_start TIME DEFAULT '08:00:00',
    offer_window_end TIME DEFAULT '21:00:00',
    offer_spacing_minutes INTEGER DEFAULT 2,
    on_demand_threshold_minutes INTEGER DEFAULT 120, -- 2 hours
    
    -- Pay Settings
    driver_pay_percentage NUMERIC(5,2) DEFAULT 70.00,
    
    -- Feature Toggles
    enable_driver_rating_priority BOOLEAN DEFAULT true,
    enable_service_area_matching BOOLEAN DEFAULT true,
    enable_vehicle_type_matching BOOLEAN DEFAULT true,
    enable_on_demand_priority BOOLEAN DEFAULT true,
    enable_sms_offers BOOLEAN DEFAULT true,
    enable_in_app_offers BOOLEAN DEFAULT true,
    enable_auto_escalation BOOLEAN DEFAULT true,
    
    -- SMS Settings
    sms_offer_template TEXT DEFAULT 'Hi {driver_first_name}, new trip available! {pickup_city} to {dropoff_city} on {pickup_date} at {pickup_time}. Pay: ${pay_amount}. Reply Y to accept or N to decline. Expires in {timeout_minutes} min.',
    sms_confirmation_template TEXT DEFAULT 'Confirmed! Trip #{reservation_id} on {pickup_date}. Pickup: {pickup_address} at {pickup_time}. Passenger: {passenger_name}. Full details in app.',
    sms_rejection_template TEXT DEFAULT 'No worries! The trip has been offered to another driver.',
    sms_expiry_template TEXT DEFAULT 'The offer for trip {pickup_city} to {dropoff_city} has expired.',
    
    -- Escalation Settings
    escalate_to_admin_after_attempts INTEGER DEFAULT 10,
    admin_notification_email TEXT,
    admin_notification_sms TEXT,
    
    -- Custom Options (JSONB for flexibility)
    custom_options JSONB DEFAULT '[]'::jsonb,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for organization lookup
CREATE INDEX IF NOT EXISTS idx_farmout_settings_org ON public.farmout_settings(organization_id);

-- ============================================
-- 2. SMS TEMPLATES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.sms_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id),
    template_name VARCHAR(100) NOT NULL,
    template_type VARCHAR(50) NOT NULL, -- 'farmout_offer', 'farmout_confirm', 'farmout_reject', 'farmout_expire', 'custom'
    template_body TEXT NOT NULL,
    available_tags JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. FUNCTION: Get Prioritized Drivers for Farmout
-- ============================================
-- Drop existing function first (return type changed from driver_rating to driver_level)
DROP FUNCTION IF EXISTS get_prioritized_drivers_for_farmout(uuid,text,text,boolean,uuid);

CREATE OR REPLACE FUNCTION get_prioritized_drivers_for_farmout(
    p_reservation_id UUID,
    p_pickup_city TEXT DEFAULT NULL,
    p_vehicle_type TEXT DEFAULT NULL,
    p_is_on_demand BOOLEAN DEFAULT false,
    p_organization_id UUID DEFAULT NULL
)
RETURNS TABLE (
    driver_id UUID,
    driver_name TEXT,
    driver_phone TEXT,
    driver_level INTEGER,
    priority_score INTEGER,
    is_available BOOLEAN,
    matches_service_area BOOLEAN,
    matches_vehicle_type BOOLEAN,
    last_offer_at TIMESTAMPTZ,
    cooldown_expires_at TIMESTAMPTZ
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_settings RECORD;
    v_cooldown_hours INTEGER;
BEGIN
    -- Get settings
    SELECT * INTO v_settings FROM farmout_settings 
    WHERE organization_id = p_organization_id 
    LIMIT 1;
    
    v_cooldown_hours := COALESCE(v_settings.driver_cooldown_hours, 24);
    
    RETURN QUERY
    WITH driver_scores AS (
        SELECT 
            d.id,
            COALESCE(d.first_name || ' ' || d.last_name, d.name, 'Unknown') as full_name,
            COALESCE(d.cell_phone, d.phone, d.mobile) as phone,
            COALESCE(NULLIF(d.driver_level, '')::INTEGER, 5) as level,
            COALESCE(d.availability_status, 'available') as avail_status,
            d.service_areas,
            d.preferred_vehicle_types,
            d.last_farmout_offer_at,
            
            -- Check service area match
            CASE 
                WHEN p_pickup_city IS NULL THEN true
                WHEN d.service_areas IS NULL THEN true
                WHEN d.service_areas ? p_pickup_city THEN true
                WHEN EXISTS (
                    SELECT 1 FROM jsonb_array_elements_text(d.service_areas) elem 
                    WHERE LOWER(elem) = LOWER(p_pickup_city)
                ) THEN true
                ELSE false
            END as area_match,
            
            -- Check vehicle type match
            CASE 
                WHEN p_vehicle_type IS NULL THEN true
                WHEN d.preferred_vehicle_types IS NULL THEN true
                WHEN d.preferred_vehicle_types ? p_vehicle_type THEN true
                WHEN EXISTS (
                    SELECT 1 FROM jsonb_array_elements_text(d.preferred_vehicle_types) elem 
                    WHERE LOWER(elem) = LOWER(p_vehicle_type)
                ) THEN true
                ELSE false
            END as vehicle_match,
            
            -- Check if in cooldown
            CASE 
                WHEN d.last_farmout_offer_at IS NULL THEN false
                WHEN d.last_farmout_offer_at + (v_cooldown_hours || ' hours')::interval > NOW() THEN true
                ELSE false
            END as in_cooldown
            
        FROM drivers d
        WHERE d.is_active = true
        AND (p_organization_id IS NULL OR d.organization_id = p_organization_id)
    )
    SELECT 
        ds.id as driver_id,
        ds.full_name as driver_name,
        ds.phone as driver_phone,
        ds.level as driver_level,
        -- Calculate priority score (higher = better)
        (
            (ds.level * 10) +  -- Level 1-10: 10-100 points
            (CASE WHEN ds.area_match THEN 50 ELSE 0 END) +  -- Service area match: 50 points
            (CASE WHEN ds.vehicle_match THEN 30 ELSE 0 END) +  -- Vehicle match: 30 points
            (CASE WHEN ds.avail_status = 'available' THEN 20 ELSE 0 END) +  -- Available: 20 points
            (CASE WHEN p_is_on_demand AND ds.avail_status = 'available' THEN 50 ELSE 0 END)  -- On-demand bonus: 50 points
        )::INTEGER as priority_score,
        (ds.avail_status = 'available' AND NOT ds.in_cooldown) as is_available,
        ds.area_match as matches_service_area,
        ds.vehicle_match as matches_vehicle_type,
        ds.last_farmout_offer_at as last_offer_at,
        CASE 
            WHEN ds.last_farmout_offer_at IS NOT NULL 
            THEN ds.last_farmout_offer_at + (v_cooldown_hours || ' hours')::interval
            ELSE NULL
        END as cooldown_expires_at
    FROM driver_scores ds
    WHERE NOT ds.in_cooldown  -- Exclude drivers in cooldown
    ORDER BY 
        priority_score DESC,
        ds.level DESC,
        ds.full_name ASC;
END;
$$;

-- ============================================
-- 4. FUNCTION: Create Farmout Offer
-- ============================================
CREATE OR REPLACE FUNCTION create_farmout_offer(
    p_reservation_id UUID,
    p_driver_id UUID,
    p_pay_amount NUMERIC,
    p_offer_details JSONB DEFAULT '{}'::jsonb,
    p_timeout_minutes INTEGER DEFAULT 15
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_offer_id UUID;
BEGIN
    -- Insert the offer
    INSERT INTO farmout_offers (
        reservation_id,
        driver_id,
        offer_status,
        pay_offered,
        offer_details,
        expires_at,
        created_at
    ) VALUES (
        p_reservation_id,
        p_driver_id,
        'pending',
        p_pay_amount,
        p_offer_details,
        NOW() + (p_timeout_minutes || ' minutes')::interval,
        NOW()
    )
    RETURNING id INTO v_offer_id;
    
    -- Update driver's last offer timestamp
    UPDATE drivers 
    SET last_farmout_offer_at = NOW()
    WHERE id = p_driver_id;
    
    RETURN v_offer_id;
END;
$$;

-- ============================================
-- 5. FUNCTION: Process Driver Response
-- ============================================
CREATE OR REPLACE FUNCTION process_farmout_response(
    p_offer_id UUID,
    p_accepted BOOLEAN,
    p_response_method TEXT DEFAULT 'in_app'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_offer RECORD;
    v_result JSONB;
BEGIN
    -- Get the offer
    SELECT * INTO v_offer FROM farmout_offers WHERE id = p_offer_id;
    
    IF v_offer IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Offer not found');
    END IF;
    
    -- Check if already responded
    IF v_offer.offer_status != 'pending' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Offer already processed', 'status', v_offer.offer_status);
    END IF;
    
    -- Check if expired
    IF v_offer.expires_at < NOW() THEN
        UPDATE farmout_offers SET offer_status = 'expired' WHERE id = p_offer_id;
        RETURN jsonb_build_object('success', false, 'error', 'Offer has expired');
    END IF;
    
    IF p_accepted THEN
        -- Accept the offer
        UPDATE farmout_offers 
        SET offer_status = 'accepted',
            responded_at = NOW(),
            response_method = p_response_method
        WHERE id = p_offer_id;
        
        -- Update the reservation
        UPDATE reservations 
        SET driver_id = v_offer.driver_id,
            farmout_status = 'assigned',
            updated_at = NOW()
        WHERE id = v_offer.reservation_id;
        
        -- Expire any other pending offers for this reservation
        UPDATE farmout_offers 
        SET offer_status = 'expired'
        WHERE reservation_id = v_offer.reservation_id 
        AND id != p_offer_id 
        AND offer_status = 'pending';
        
        v_result := jsonb_build_object(
            'success', true, 
            'action', 'accepted',
            'driver_id', v_offer.driver_id,
            'reservation_id', v_offer.reservation_id
        );
    ELSE
        -- Reject the offer
        UPDATE farmout_offers 
        SET offer_status = 'rejected',
            responded_at = NOW(),
            response_method = p_response_method
        WHERE id = p_offer_id;
        
        v_result := jsonb_build_object(
            'success', true, 
            'action', 'rejected',
            'driver_id', v_offer.driver_id,
            'reservation_id', v_offer.reservation_id
        );
    END IF;
    
    RETURN v_result;
END;
$$;

-- ============================================
-- 6. FUNCTION: Check and Expire Old Offers
-- ============================================
CREATE OR REPLACE FUNCTION expire_old_farmout_offers()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE farmout_offers 
    SET offer_status = 'expired'
    WHERE offer_status = 'pending' 
    AND expires_at < NOW();
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- ============================================
-- 7. FUNCTION: Get Farmout Settings
-- ============================================
CREATE OR REPLACE FUNCTION get_farmout_settings(p_organization_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_settings RECORD;
BEGIN
    SELECT * INTO v_settings 
    FROM farmout_settings 
    WHERE organization_id = p_organization_id 
    OR (p_organization_id IS NULL AND organization_id IS NULL)
    LIMIT 1;
    
    IF v_settings IS NULL THEN
        -- Return defaults
        RETURN jsonb_build_object(
            'offer_timeout_minutes', 15,
            'driver_cooldown_hours', 24,
            'offer_window_start', '08:00',
            'offer_window_end', '21:00',
            'offer_spacing_minutes', 2,
            'on_demand_threshold_minutes', 120,
            'driver_pay_percentage', 70.00,
            'enable_driver_rating_priority', true,
            'enable_service_area_matching', true,
            'enable_vehicle_type_matching', true,
            'enable_on_demand_priority', true,
            'enable_sms_offers', true,
            'enable_in_app_offers', true,
            'enable_auto_escalation', true,
            'escalate_to_admin_after_attempts', 10,
            'sms_offer_template', 'Hi {driver_first_name}, new trip available! {pickup_city} to {dropoff_city} on {pickup_date} at {pickup_time}. Pay: ${pay_amount}. Reply Y to accept or N to decline. Expires in {timeout_minutes} min.',
            'sms_confirmation_template', 'Confirmed! Trip #{reservation_id} on {pickup_date}. Pickup: {pickup_address} at {pickup_time}. Passenger: {passenger_name}. Full details in app.',
            'custom_options', '[]'::jsonb
        );
    END IF;
    
    RETURN to_jsonb(v_settings);
END;
$$;

-- ============================================
-- 8. FUNCTION: Save Farmout Settings
-- ============================================
CREATE OR REPLACE FUNCTION save_farmout_settings(
    p_organization_id UUID,
    p_settings JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO farmout_settings (
        organization_id,
        offer_timeout_minutes,
        driver_cooldown_hours,
        offer_window_start,
        offer_window_end,
        offer_spacing_minutes,
        on_demand_threshold_minutes,
        driver_pay_percentage,
        enable_driver_rating_priority,
        enable_service_area_matching,
        enable_vehicle_type_matching,
        enable_on_demand_priority,
        enable_sms_offers,
        enable_in_app_offers,
        enable_auto_escalation,
        escalate_to_admin_after_attempts,
        admin_notification_email,
        admin_notification_sms,
        sms_offer_template,
        sms_confirmation_template,
        sms_rejection_template,
        sms_expiry_template,
        custom_options,
        updated_at
    ) VALUES (
        p_organization_id,
        COALESCE((p_settings->>'offer_timeout_minutes')::INTEGER, 15),
        COALESCE((p_settings->>'driver_cooldown_hours')::INTEGER, 24),
        COALESCE((p_settings->>'offer_window_start')::TIME, '08:00:00'),
        COALESCE((p_settings->>'offer_window_end')::TIME, '21:00:00'),
        COALESCE((p_settings->>'offer_spacing_minutes')::INTEGER, 2),
        COALESCE((p_settings->>'on_demand_threshold_minutes')::INTEGER, 120),
        COALESCE((p_settings->>'driver_pay_percentage')::NUMERIC, 70.00),
        COALESCE((p_settings->>'enable_driver_rating_priority')::BOOLEAN, true),
        COALESCE((p_settings->>'enable_service_area_matching')::BOOLEAN, true),
        COALESCE((p_settings->>'enable_vehicle_type_matching')::BOOLEAN, true),
        COALESCE((p_settings->>'enable_on_demand_priority')::BOOLEAN, true),
        COALESCE((p_settings->>'enable_sms_offers')::BOOLEAN, true),
        COALESCE((p_settings->>'enable_in_app_offers')::BOOLEAN, true),
        COALESCE((p_settings->>'enable_auto_escalation')::BOOLEAN, true),
        COALESCE((p_settings->>'escalate_to_admin_after_attempts')::INTEGER, 10),
        p_settings->>'admin_notification_email',
        p_settings->>'admin_notification_sms',
        p_settings->>'sms_offer_template',
        p_settings->>'sms_confirmation_template',
        p_settings->>'sms_rejection_template',
        p_settings->>'sms_expiry_template',
        COALESCE(p_settings->'custom_options', '[]'::jsonb),
        NOW()
    )
    ON CONFLICT (organization_id) 
    DO UPDATE SET
        offer_timeout_minutes = EXCLUDED.offer_timeout_minutes,
        driver_cooldown_hours = EXCLUDED.driver_cooldown_hours,
        offer_window_start = EXCLUDED.offer_window_start,
        offer_window_end = EXCLUDED.offer_window_end,
        offer_spacing_minutes = EXCLUDED.offer_spacing_minutes,
        on_demand_threshold_minutes = EXCLUDED.on_demand_threshold_minutes,
        driver_pay_percentage = EXCLUDED.driver_pay_percentage,
        enable_driver_rating_priority = EXCLUDED.enable_driver_rating_priority,
        enable_service_area_matching = EXCLUDED.enable_service_area_matching,
        enable_vehicle_type_matching = EXCLUDED.enable_vehicle_type_matching,
        enable_on_demand_priority = EXCLUDED.enable_on_demand_priority,
        enable_sms_offers = EXCLUDED.enable_sms_offers,
        enable_in_app_offers = EXCLUDED.enable_in_app_offers,
        enable_auto_escalation = EXCLUDED.enable_auto_escalation,
        escalate_to_admin_after_attempts = EXCLUDED.escalate_to_admin_after_attempts,
        admin_notification_email = EXCLUDED.admin_notification_email,
        admin_notification_sms = EXCLUDED.admin_notification_sms,
        sms_offer_template = EXCLUDED.sms_offer_template,
        sms_confirmation_template = EXCLUDED.sms_confirmation_template,
        sms_rejection_template = EXCLUDED.sms_rejection_template,
        sms_expiry_template = EXCLUDED.sms_expiry_template,
        custom_options = EXCLUDED.custom_options,
        updated_at = NOW()
    RETURNING id INTO v_id;
    
    RETURN jsonb_build_object('success', true, 'id', v_id);
END;
$$;

-- ============================================
-- 9. FUNCTION: Render SMS Template with Tags
-- ============================================
CREATE OR REPLACE FUNCTION render_sms_template(
    p_template TEXT,
    p_reservation_id UUID,
    p_driver_id UUID DEFAULT NULL,
    p_pay_amount NUMERIC DEFAULT NULL,
    p_timeout_minutes INTEGER DEFAULT 15
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_reservation RECORD;
    v_driver RECORD;
    v_result TEXT;
BEGIN
    -- Get reservation data
    SELECT * INTO v_reservation FROM reservations WHERE id = p_reservation_id;
    
    -- Get driver data if provided
    IF p_driver_id IS NOT NULL THEN
        SELECT * INTO v_driver FROM drivers WHERE id = p_driver_id;
    END IF;
    
    v_result := p_template;
    
    -- Replace reservation tags
    IF v_reservation IS NOT NULL THEN
        v_result := REPLACE(v_result, '{reservation_id}', COALESCE(v_reservation.id::TEXT, ''));
        v_result := REPLACE(v_result, '{pickup_city}', COALESCE(
            SPLIT_PART(v_reservation.pickup_address, ',', 2),
            SPLIT_PART(v_reservation.pickup_address, ',', 1),
            ''
        ));
        v_result := REPLACE(v_result, '{dropoff_city}', COALESCE(
            SPLIT_PART(v_reservation.dropoff_address, ',', 2),
            SPLIT_PART(v_reservation.dropoff_address, ',', 1),
            ''
        ));
        v_result := REPLACE(v_result, '{pickup_address}', COALESCE(v_reservation.pickup_address, ''));
        v_result := REPLACE(v_result, '{dropoff_address}', COALESCE(v_reservation.dropoff_address, ''));
        v_result := REPLACE(v_result, '{pickup_date}', COALESCE(TO_CHAR(v_reservation.pickup_date, 'MM/DD/YYYY'), ''));
        v_result := REPLACE(v_result, '{pickup_time}', COALESCE(v_reservation.pickup_time, ''));
        v_result := REPLACE(v_result, '{passenger_name}', COALESCE(v_reservation.passenger_name, v_reservation.passenger_first_name || ' ' || v_reservation.passenger_last_name, ''));
        v_result := REPLACE(v_result, '{passenger_count}', COALESCE(v_reservation.passengers::TEXT, '1'));
        v_result := REPLACE(v_result, '{vehicle_type}', COALESCE(v_reservation.vehicle_type, ''));
        v_result := REPLACE(v_result, '{trip_notes}', COALESCE(v_reservation.special_instructions, v_reservation.notes, ''));
    END IF;
    
    -- Replace driver tags
    IF v_driver IS NOT NULL THEN
        v_result := REPLACE(v_result, '{driver_first_name}', COALESCE(v_driver.first_name, SPLIT_PART(v_driver.name, ' ', 1), ''));
        v_result := REPLACE(v_result, '{driver_last_name}', COALESCE(v_driver.last_name, '', ''));
        v_result := REPLACE(v_result, '{driver_name}', COALESCE(v_driver.first_name || ' ' || v_driver.last_name, v_driver.name, ''));
    END IF;
    
    -- Replace other tags
    v_result := REPLACE(v_result, '{pay_amount}', COALESCE(p_pay_amount::TEXT, '0'));
    v_result := REPLACE(v_result, '{timeout_minutes}', COALESCE(p_timeout_minutes::TEXT, '15'));
    
    RETURN v_result;
END;
$$;

-- ============================================
-- 10. Add unique constraint for upsert
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'farmout_settings_organization_id_key'
    ) THEN
        ALTER TABLE farmout_settings ADD CONSTRAINT farmout_settings_organization_id_key UNIQUE (organization_id);
    END IF;
END $$;

-- ============================================
-- 11. Insert default SMS templates
-- ============================================
INSERT INTO sms_templates (template_name, template_type, template_body, available_tags, is_active)
VALUES 
(
    'Farmout Offer',
    'farmout_offer',
    'Hi {driver_first_name}, new trip available! {pickup_city} to {dropoff_city} on {pickup_date} at {pickup_time}. Pay: ${pay_amount}. Reply Y to accept or N to decline. Expires in {timeout_minutes} min.',
    '["driver_first_name", "driver_name", "pickup_city", "dropoff_city", "pickup_date", "pickup_time", "pay_amount", "timeout_minutes", "vehicle_type", "passenger_count"]'::jsonb,
    true
),
(
    'Offer Accepted Confirmation',
    'farmout_confirm',
    'Confirmed! Trip #{reservation_id} on {pickup_date}. Pickup: {pickup_address} at {pickup_time}. Passenger: {passenger_name}. Full details in app.',
    '["reservation_id", "pickup_date", "pickup_time", "pickup_address", "dropoff_address", "passenger_name", "vehicle_type", "trip_notes"]'::jsonb,
    true
),
(
    'Offer Rejected',
    'farmout_reject',
    'No worries! The trip has been offered to another driver.',
    '["driver_first_name"]'::jsonb,
    true
),
(
    'Offer Expired',
    'farmout_expire',
    'The offer for {pickup_city} to {dropoff_city} on {pickup_date} has expired.',
    '["pickup_city", "dropoff_city", "pickup_date", "pickup_time"]'::jsonb,
    true
)
ON CONFLICT DO NOTHING;

-- ============================================
-- DONE! Run this script in Supabase SQL Editor.
-- ============================================
