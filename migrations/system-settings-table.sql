-- System Settings Table Migration
-- Stores SMS, Email, and other system configuration in Supabase
-- This replaces localStorage for cross-browser/device sync

-- =====================================================
-- SYSTEM SETTINGS TABLE
-- Key-value store for all system configuration
-- =====================================================
CREATE TABLE IF NOT EXISTS system_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    setting_category VARCHAR(50) NOT NULL, -- 'sms', 'email', 'company', 'portal', etc.
    setting_key VARCHAR(100) NOT NULL,
    setting_value JSONB, -- Store complex settings as JSON
    is_encrypted BOOLEAN DEFAULT false, -- Flag for sensitive data (auth tokens, etc.)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id),
    
    -- Unique constraint per org + category + key
    CONSTRAINT unique_org_setting UNIQUE (organization_id, setting_category, setting_key)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_system_settings_org_category 
    ON system_settings(organization_id, setting_category);

CREATE INDEX IF NOT EXISTS idx_system_settings_lookup 
    ON system_settings(organization_id, setting_category, setting_key);

-- Enable RLS
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can read settings for their organization
CREATE POLICY "Users can read org settings" ON system_settings
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM organization_members 
            WHERE user_id = auth.uid()
        )
    );

-- Only admins can insert/update/delete settings
CREATE POLICY "Admins can manage settings" ON system_settings
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM organization_members 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_system_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.updated_by = auth.uid();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS update_system_settings_updated_at ON system_settings;
CREATE TRIGGER update_system_settings_updated_at
    BEFORE UPDATE ON system_settings
    FOR EACH ROW EXECUTE FUNCTION update_system_settings_timestamp();

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Get a setting value
CREATE OR REPLACE FUNCTION get_system_setting(
    p_org_id UUID,
    p_category VARCHAR,
    p_key VARCHAR
)
RETURNS JSONB AS $$
DECLARE
    v_value JSONB;
BEGIN
    SELECT setting_value INTO v_value
    FROM system_settings
    WHERE organization_id = p_org_id
      AND setting_category = p_category
      AND setting_key = p_key;
    
    RETURN v_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Upsert a setting
CREATE OR REPLACE FUNCTION upsert_system_setting(
    p_org_id UUID,
    p_category VARCHAR,
    p_key VARCHAR,
    p_value JSONB,
    p_encrypted BOOLEAN DEFAULT false
)
RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO system_settings (organization_id, setting_category, setting_key, setting_value, is_encrypted, created_by)
    VALUES (p_org_id, p_category, p_key, p_value, p_encrypted, auth.uid())
    ON CONFLICT (organization_id, setting_category, setting_key)
    DO UPDATE SET 
        setting_value = p_value,
        is_encrypted = p_encrypted,
        updated_at = NOW(),
        updated_by = auth.uid()
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get all settings for a category
CREATE OR REPLACE FUNCTION get_settings_by_category(
    p_org_id UUID,
    p_category VARCHAR
)
RETURNS TABLE (setting_key VARCHAR, setting_value JSONB) AS $$
BEGIN
    RETURN QUERY
    SELECT ss.setting_key, ss.setting_value
    FROM system_settings ss
    WHERE ss.organization_id = p_org_id
      AND ss.setting_category = p_category;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Done! System settings table created successfully
-- =====================================================
