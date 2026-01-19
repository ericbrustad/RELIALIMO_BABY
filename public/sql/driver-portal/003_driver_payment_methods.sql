-- ============================================================================
-- 003: DRIVER PAYMENT METHODS
-- Encrypted storage for driver payment info (Zelle, Venmo, Cash App, Bank)
-- ============================================================================

-- ===========================================================================
-- DRIVER PAYMENT METHODS TABLE
-- Stores encrypted payment credentials
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.driver_payment_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
    
    -- Payment method type
    method_type TEXT NOT NULL CHECK (method_type IN ('zelle', 'venmo', 'cashapp', 'bank', 'paypal', 'check')),
    
    -- Is this the preferred method?
    is_primary BOOLEAN DEFAULT FALSE,
    is_enabled BOOLEAN DEFAULT TRUE,
    
    -- Method-specific data (encrypted in app, stored as JSONB)
    -- Zelle: {email_or_phone, account_name}
    -- Venmo: {username}
    -- CashApp: {cashtag}
    -- Bank: {bank_name, routing_last4, account_last4, account_type}
    encrypted_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- For display purposes (not sensitive)
    display_name TEXT, -- "Zelle - j***@email.com", "Venmo - @joh***"
    
    -- Verification
    is_verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMPTZ,
    verification_method TEXT, -- 'micro_deposit', 'manual', 'instant'
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_driver_payment_methods_driver 
ON public.driver_payment_methods(driver_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_driver_payment_primary 
ON public.driver_payment_methods(driver_id) 
WHERE is_primary = TRUE;

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_payment_method_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_payment_updated_at ON public.driver_payment_methods;
CREATE TRIGGER trigger_payment_updated_at
    BEFORE UPDATE ON public.driver_payment_methods
    FOR EACH ROW
    EXECUTE FUNCTION update_payment_method_timestamp();

-- ===========================================================================
-- DRIVER EARNINGS TABLE
-- Track driver earnings per trip for payout
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.driver_earnings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
    reservation_id UUID REFERENCES public.reservations(id) ON DELETE SET NULL,
    
    -- Earning details
    earning_type TEXT NOT NULL CHECK (earning_type IN ('trip', 'bonus', 'tip', 'reimbursement', 'adjustment')),
    description TEXT,
    
    -- Amounts
    gross_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    deductions NUMERIC(10,2) DEFAULT 0,
    net_amount NUMERIC(10,2) GENERATED ALWAYS AS (gross_amount - COALESCE(deductions, 0)) STORED,
    
    -- Trip details (if applicable)
    trip_date DATE,
    trip_pickup TEXT,
    trip_dropoff TEXT,
    
    -- Payout tracking
    payout_status TEXT DEFAULT 'pending' CHECK (payout_status IN ('pending', 'processing', 'paid', 'failed')),
    payout_id UUID, -- Reference to payouts table
    paid_at TIMESTAMPTZ,
    payment_method_id UUID REFERENCES public.driver_payment_methods(id),
    
    -- Timestamps
    earned_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_driver_earnings_driver 
ON public.driver_earnings(driver_id);

CREATE INDEX IF NOT EXISTS idx_driver_earnings_status 
ON public.driver_earnings(driver_id, payout_status);

CREATE INDEX IF NOT EXISTS idx_driver_earnings_reservation 
ON public.driver_earnings(reservation_id);

-- ===========================================================================
-- DRIVER PAYOUTS TABLE
-- Batch payouts to drivers
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.driver_payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
    payment_method_id UUID REFERENCES public.driver_payment_methods(id),
    
    -- Payout details
    amount NUMERIC(10,2) NOT NULL,
    earnings_count INTEGER DEFAULT 0, -- Number of earnings included
    period_start DATE,
    period_end DATE,
    
    -- Status tracking
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    status_message TEXT,
    
    -- External reference (for payment processor tracking)
    external_reference TEXT,
    processor TEXT, -- 'manual', 'stripe', 'paypal'
    
    -- Timestamps
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    -- Who initiated
    initiated_by UUID REFERENCES auth.users(id),
    notes TEXT
);

-- Index
CREATE INDEX IF NOT EXISTS idx_driver_payouts_driver 
ON public.driver_payouts(driver_id, status);
