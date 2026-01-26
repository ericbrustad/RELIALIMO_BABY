-- =====================================================
-- COMPANY MEMOS SETUP
-- Creates a company_memos table for storing memos/notifications
-- that can be displayed to different user types.
-- =====================================================

-- =====================================================
-- COMPANY MEMOS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.company_memos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    
    -- Memo Content
    memo_text TEXT NOT NULL,
    memo_to VARCHAR(100),                        -- Who the memo is for (description)
    
    -- Display Settings
    color VARCHAR(20) DEFAULT 'yellow',          -- red, yellow, green, blue, orange, purple
    priority VARCHAR(20) DEFAULT 'normal',       -- low, normal, high, urgent
    
    -- Notification Target
    notify_location VARCHAR(50) NOT NULL,        -- 'login', 'account-login', 'driver-login', 'dispatch-res'
    
    -- Show On Specific Pages
    show_dispatch_grid BOOLEAN DEFAULT false,
    show_reservation_form BOOLEAN DEFAULT false,
    show_customer_portal BOOLEAN DEFAULT false,
    show_driver_portal BOOLEAN DEFAULT false,
    
    -- Date Range for Display
    display_from DATE,                           -- Start showing from this date
    display_to DATE,                             -- Stop showing after this date
    due_date DATE,                               -- Due date for the memo task
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    is_pinned BOOLEAN DEFAULT false,             -- Pinned memos appear first
    is_dismissed BOOLEAN DEFAULT false,          -- For user-dismissible memos
    
    -- Metadata
    author VARCHAR(100),
    created_by UUID REFERENCES auth.users(id),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_company_memos_org ON public.company_memos(organization_id);
CREATE INDEX IF NOT EXISTS idx_company_memos_active ON public.company_memos(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_company_memos_notify ON public.company_memos(notify_location);
CREATE INDEX IF NOT EXISTS idx_company_memos_date ON public.company_memos(display_from, display_to);

-- Enable RLS
ALTER TABLE public.company_memos ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "company_memos_select_org" ON public.company_memos
    FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "company_memos_insert_org" ON public.company_memos
    FOR INSERT
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM public.organization_members 
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'dispatcher')
        )
    );

CREATE POLICY "company_memos_update_org" ON public.company_memos
    FOR UPDATE
    USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members 
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'dispatcher')
        )
    );

CREATE POLICY "company_memos_delete_org" ON public.company_memos
    FOR DELETE
    USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members 
            WHERE user_id = auth.uid()
            AND role = 'admin'
        )
    );

-- Also allow public read for portal-displayed memos (account/driver logins)
CREATE POLICY "company_memos_public_read" ON public.company_memos
    FOR SELECT
    USING (
        is_active = true
        AND (display_from IS NULL OR display_from <= CURRENT_DATE)
        AND (display_to IS NULL OR display_to >= CURRENT_DATE)
        AND notify_location IN ('account-login', 'driver-login')
    );

-- =====================================================
-- MEMO DISMISSALS TABLE
-- Tracks which users have dismissed which memos
-- =====================================================
CREATE TABLE IF NOT EXISTS public.memo_dismissals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    memo_id UUID REFERENCES public.company_memos(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    dismissed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(memo_id, user_id)
);

ALTER TABLE public.memo_dismissals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "memo_dismissals_own" ON public.memo_dismissals
    FOR ALL
    USING (user_id = auth.uid());

-- =====================================================
-- FUNCTION: Get active memos for a location
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_active_memos(
    p_organization_id UUID,
    p_location VARCHAR(50),
    p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    memo_text TEXT,
    memo_to VARCHAR(100),
    color VARCHAR(20),
    priority VARCHAR(20),
    notify_location VARCHAR(50),
    due_date DATE,
    author VARCHAR(100),
    is_pinned BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.id,
        m.memo_text,
        m.memo_to,
        m.color,
        m.priority,
        m.notify_location,
        m.due_date,
        m.author,
        m.is_pinned,
        m.created_at
    FROM public.company_memos m
    LEFT JOIN public.memo_dismissals d 
        ON m.id = d.memo_id AND d.user_id = p_user_id
    WHERE m.organization_id = p_organization_id
      AND m.is_active = true
      AND m.notify_location = p_location
      AND (m.display_from IS NULL OR m.display_from <= CURRENT_DATE)
      AND (m.display_to IS NULL OR m.display_to >= CURRENT_DATE)
      AND d.id IS NULL  -- Not dismissed by this user
    ORDER BY m.is_pinned DESC, m.priority DESC, m.created_at DESC;
END;
$$;

-- =====================================================
-- TRIGGER: Auto-update timestamps
-- =====================================================
CREATE OR REPLACE FUNCTION update_company_memos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_company_memos_updated_at ON public.company_memos;
CREATE TRIGGER update_company_memos_updated_at
    BEFORE UPDATE ON public.company_memos
    FOR EACH ROW
    EXECUTE FUNCTION update_company_memos_updated_at();

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE public.company_memos IS 'Company-wide memos/notifications for different user types';
COMMENT ON COLUMN public.company_memos.notify_location IS 'Where to show: login, account-login, driver-login, dispatch-res';
COMMENT ON COLUMN public.company_memos.color IS 'Display color: red, yellow, green, blue, orange, purple';
COMMENT ON FUNCTION public.get_active_memos IS 'Get active memos for a specific location, excluding dismissed ones';
