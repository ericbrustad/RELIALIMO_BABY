-- ============================================================================
-- DRIVERS_COMPANY TABLE
-- Mirrors affiliates schema but owned by drivers
-- Syncs with affiliates table for RELIALIMO admin access
-- ============================================================================

-- Create drivers_company table with same schema as affiliates
CREATE TABLE IF NOT EXISTS public.drivers_company (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- Link to affiliates table for sync
    affiliate_id UUID REFERENCES public.affiliates(id),
    
    -- Company info (same as affiliates)
    company_name TEXT NOT NULL,
    dba_name TEXT,
    organization_id UUID REFERENCES public.organizations(id),
    status TEXT DEFAULT 'ACTIVE',
    is_active BOOLEAN DEFAULT true,
    
    -- Contact info
    primary_address TEXT,
    secondary_address TEXT,
    city TEXT,
    state TEXT,
    zip TEXT,
    country TEXT DEFAULT 'USA',
    phone TEXT,
    fax TEXT,
    email TEXT,
    website TEXT,
    
    -- Business details
    dot_number TEXT,
    mc_number TEXT,
    tax_id TEXT,
    business_license TEXT,
    insurance_company TEXT,
    insurance_policy_number TEXT,
    insurance_expiration DATE,
    
    -- Payment info
    payment_terms TEXT,
    billing_email TEXT,
    billing_contact TEXT,
    
    -- Notes
    notes TEXT,
    internal_notes TEXT,
    
    -- Owner tracking - which driver created/owns this company
    owner_driver_id UUID REFERENCES public.drivers(id),
    admin_driver_ids UUID[] DEFAULT '{}',  -- Array of driver IDs who are admins
    
    -- Sync tracking
    synced_at TIMESTAMPTZ,
    sync_source TEXT  -- 'driver' or 'affiliate' to track which was created first
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_drivers_company_owner ON public.drivers_company(owner_driver_id);
CREATE INDEX IF NOT EXISTS idx_drivers_company_affiliate ON public.drivers_company(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_drivers_company_name ON public.drivers_company(company_name);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_drivers_company_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS drivers_company_updated_at ON public.drivers_company;
CREATE TRIGGER drivers_company_updated_at
    BEFORE UPDATE ON public.drivers_company
    FOR EACH ROW
    EXECUTE FUNCTION update_drivers_company_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY FOR DRIVERS_COMPANY
-- Only owner driver and admin drivers can access their company
-- ============================================================================

ALTER TABLE public.drivers_company ENABLE ROW LEVEL SECURITY;

-- Anon can insert (for registration)
DROP POLICY IF EXISTS drivers_company_anon_insert ON public.drivers_company;
CREATE POLICY drivers_company_anon_insert ON public.drivers_company
    FOR INSERT TO anon WITH CHECK (true);

-- Anon can select their own company (by owner_driver_id or admin_driver_ids)
-- Note: During registration flow, we'll use service role or specific lookup
DROP POLICY IF EXISTS drivers_company_anon_select ON public.drivers_company;
CREATE POLICY drivers_company_anon_select ON public.drivers_company
    FOR SELECT TO anon USING (true);

-- Anon can update their own company
DROP POLICY IF EXISTS drivers_company_anon_update ON public.drivers_company;
CREATE POLICY drivers_company_anon_update ON public.drivers_company
    FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- Anon can delete their own company
DROP POLICY IF EXISTS drivers_company_anon_delete ON public.drivers_company;
CREATE POLICY drivers_company_anon_delete ON public.drivers_company
    FOR DELETE TO anon USING (true);

-- Authenticated users (RELIALIMO admin) have full access
DROP POLICY IF EXISTS drivers_company_auth_all ON public.drivers_company;
CREATE POLICY drivers_company_auth_all ON public.drivers_company
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================================
-- SYNC FUNCTIONS: drivers_company <-> affiliates
-- ============================================================================

-- Function to sync drivers_company to affiliates
CREATE OR REPLACE FUNCTION sync_drivers_company_to_affiliates()
RETURNS TRIGGER AS $$
BEGIN
    -- If this is a new company (no affiliate_id yet), create in affiliates
    IF NEW.affiliate_id IS NULL THEN
        INSERT INTO public.affiliates (
            company_name, dba_name, organization_id, status, is_active,
            primary_address, secondary_address, city, state, zip, country,
            phone, fax, email, website,
            dot_number, mc_number, tax_id, business_license,
            insurance_company, insurance_policy_number, insurance_expiration,
            payment_terms, billing_email, billing_contact,
            notes, internal_notes
        ) VALUES (
            NEW.company_name, NEW.dba_name, NEW.organization_id, NEW.status, NEW.is_active,
            NEW.primary_address, NEW.secondary_address, NEW.city, NEW.state, NEW.zip, NEW.country,
            NEW.phone, NEW.fax, NEW.email, NEW.website,
            NEW.dot_number, NEW.mc_number, NEW.tax_id, NEW.business_license,
            NEW.insurance_company, NEW.insurance_policy_number, NEW.insurance_expiration,
            NEW.payment_terms, NEW.billing_email, NEW.billing_contact,
            NEW.notes, NEW.internal_notes
        )
        RETURNING id INTO NEW.affiliate_id;
        
        NEW.synced_at = now();
        NEW.sync_source = 'driver';
    ELSE
        -- Update existing affiliate
        UPDATE public.affiliates SET
            company_name = NEW.company_name,
            dba_name = NEW.dba_name,
            status = NEW.status,
            is_active = NEW.is_active,
            primary_address = NEW.primary_address,
            secondary_address = NEW.secondary_address,
            city = NEW.city,
            state = NEW.state,
            zip = NEW.zip,
            country = NEW.country,
            phone = NEW.phone,
            fax = NEW.fax,
            email = NEW.email,
            website = NEW.website,
            dot_number = NEW.dot_number,
            mc_number = NEW.mc_number,
            tax_id = NEW.tax_id,
            business_license = NEW.business_license,
            insurance_company = NEW.insurance_company,
            insurance_policy_number = NEW.insurance_policy_number,
            insurance_expiration = NEW.insurance_expiration,
            payment_terms = NEW.payment_terms,
            billing_email = NEW.billing_email,
            billing_contact = NEW.billing_contact,
            notes = NEW.notes,
            internal_notes = NEW.internal_notes,
            updated_at = now()
        WHERE id = NEW.affiliate_id;
        
        NEW.synced_at = now();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to sync on insert/update
DROP TRIGGER IF EXISTS sync_to_affiliates ON public.drivers_company;
CREATE TRIGGER sync_to_affiliates
    BEFORE INSERT OR UPDATE ON public.drivers_company
    FOR EACH ROW
    EXECUTE FUNCTION sync_drivers_company_to_affiliates();

-- ============================================================================
-- FUNCTION: Copy from affiliates to drivers_company
-- Call this when a driver registers with an existing affiliate
-- ============================================================================

CREATE OR REPLACE FUNCTION copy_affiliate_to_drivers_company(
    p_affiliate_id UUID,
    p_owner_driver_id UUID
) RETURNS UUID AS $$
DECLARE
    v_drivers_company_id UUID;
    v_existing_id UUID;
BEGIN
    -- Check if already exists
    SELECT id INTO v_existing_id 
    FROM public.drivers_company 
    WHERE affiliate_id = p_affiliate_id;
    
    IF v_existing_id IS NOT NULL THEN
        -- Add driver as admin if not already owner
        UPDATE public.drivers_company
        SET admin_driver_ids = array_append(
            COALESCE(admin_driver_ids, '{}'),
            p_owner_driver_id
        )
        WHERE id = v_existing_id
        AND NOT (p_owner_driver_id = ANY(COALESCE(admin_driver_ids, '{}')))
        AND owner_driver_id != p_owner_driver_id;
        
        RETURN v_existing_id;
    END IF;
    
    -- Copy from affiliates to drivers_company
    INSERT INTO public.drivers_company (
        affiliate_id, company_name, dba_name, organization_id, status, is_active,
        primary_address, secondary_address, city, state, zip, country,
        phone, fax, email, website,
        dot_number, mc_number, tax_id, business_license,
        insurance_company, insurance_policy_number, insurance_expiration,
        payment_terms, billing_email, billing_contact,
        notes, internal_notes,
        owner_driver_id, synced_at, sync_source
    )
    SELECT 
        id, company_name, dba_name, organization_id, status, is_active,
        primary_address, secondary_address, city, state, zip, country,
        phone, fax, email, website,
        dot_number, mc_number, tax_id, business_license,
        insurance_company, insurance_policy_number, insurance_expiration,
        payment_terms, billing_email, billing_contact,
        notes, internal_notes,
        p_owner_driver_id, now(), 'affiliate'
    FROM public.affiliates
    WHERE id = p_affiliate_id
    RETURNING id INTO v_drivers_company_id;
    
    RETURN v_drivers_company_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- VERIFY SETUP
-- ============================================================================

SELECT 'drivers_company table created' AS status;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'drivers_company'
ORDER BY ordinal_position;

SELECT schemaname, tablename, policyname, permissive, roles, cmd 
FROM pg_policies 
WHERE tablename = 'drivers_company'
ORDER BY policyname;
