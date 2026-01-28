-- Outbound Emails Table
-- Logs all emails sent via the system

CREATE TABLE IF NOT EXISTS public.outbound_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email text NOT NULL,
  from_email text,
  subject text,
  body_text text,
  body_html text,
  status text DEFAULT 'sent' CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'bounced')),
  resend_id text,
  error_message text,
  reservation_id integer,
  customer_id uuid,
  driver_id integer,
  email_type text, -- 'confirmation', 'invoice', 'notification', 'marketing', etc.
  sent_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Indexes for quick lookups
CREATE INDEX IF NOT EXISTS idx_outbound_emails_to ON public.outbound_emails(to_email);
CREATE INDEX IF NOT EXISTS idx_outbound_emails_sent ON public.outbound_emails(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_outbound_emails_status ON public.outbound_emails(status);
CREATE INDEX IF NOT EXISTS idx_outbound_emails_reservation ON public.outbound_emails(reservation_id);
CREATE INDEX IF NOT EXISTS idx_outbound_emails_type ON public.outbound_emails(email_type);

-- RLS policies
ALTER TABLE public.outbound_emails ENABLE ROW LEVEL SECURITY;

-- Only service role and authenticated admins can access
CREATE POLICY "outbound_emails_service_role"
ON public.outbound_emails
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "outbound_emails_admin_select"
ON public.outbound_emails
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_id = auth.uid() AND role IN ('admin', 'owner', 'dispatcher')
  )
);

-- Grant permissions
GRANT ALL ON public.outbound_emails TO service_role;
GRANT SELECT ON public.outbound_emails TO authenticated;
