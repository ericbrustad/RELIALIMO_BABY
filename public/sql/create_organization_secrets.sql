-- Organization Secrets Table for RELIALIMO
-- Stores SMS (Twilio) and Email (SMTP) credentials securely per organization
-- Run this in your Supabase SQL Editor

-- Create the organization_secrets table
CREATE TABLE IF NOT EXISTS organization_secrets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Status flags
  sms_configured BOOLEAN DEFAULT FALSE,
  email_configured BOOLEAN DEFAULT FALSE,
  
  -- Twilio SMS Configuration
  twilio_account_sid TEXT,
  twilio_auth_token TEXT,
  twilio_api_key_sid TEXT,
  twilio_api_key_secret TEXT,
  twilio_messaging_service_sid TEXT,
  twilio_from_number TEXT,
  twilio_status_callback TEXT,
  
  -- Email/SMTP Configuration
  smtp_host TEXT,
  smtp_port INTEGER,
  smtp_user TEXT,
  smtp_pass TEXT,
  smtp_tls BOOLEAN DEFAULT TRUE,
  email_from_name TEXT,
  email_from_address TEXT,
  email_reply_to TEXT
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_org_secrets_org_id ON organization_secrets(organization_id);

-- Enable RLS (Row Level Security)
ALTER TABLE organization_secrets ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see/edit their own organization's secrets
CREATE POLICY "Users can view own org secrets"
  ON organization_secrets FOR SELECT
  USING (organization_id = (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can insert own org secrets"
  ON organization_secrets FOR INSERT
  WITH CHECK (organization_id = (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can update own org secrets"
  ON organization_secrets FOR UPDATE
  USING (organization_id = (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can delete own org secrets"
  ON organization_secrets FOR DELETE
  USING (organization_id = (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_org_secrets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trigger_org_secrets_updated_at ON organization_secrets;
CREATE TRIGGER trigger_org_secrets_updated_at
  BEFORE UPDATE ON organization_secrets
  FOR EACH ROW
  EXECUTE FUNCTION update_org_secrets_updated_at();

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON organization_secrets TO authenticated;

-- Comment on table
COMMENT ON TABLE organization_secrets IS 'Stores sensitive configuration (SMS/Email credentials) per organization with RLS protection';
