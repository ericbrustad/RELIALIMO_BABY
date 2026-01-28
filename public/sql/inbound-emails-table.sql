-- Inbound Emails Table
-- Stores emails received via Resend webhook

CREATE TABLE IF NOT EXISTS public.inbound_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_email text NOT NULL,
  to_email text,
  subject text,
  body_text text,
  body_html text,
  headers jsonb,
  attachments jsonb,
  received_at timestamptz DEFAULT now(),
  processed boolean DEFAULT false,
  processed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_inbound_emails_from ON public.inbound_emails(from_email);
CREATE INDEX IF NOT EXISTS idx_inbound_emails_received ON public.inbound_emails(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_inbound_emails_processed ON public.inbound_emails(processed);

-- RLS policies
ALTER TABLE public.inbound_emails ENABLE ROW LEVEL SECURITY;

-- Only service role and authenticated admins can access
CREATE POLICY "inbound_emails_service_role"
ON public.inbound_emails
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "inbound_emails_admin_select"
ON public.inbound_emails
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
  )
);

-- Grant permissions
GRANT ALL ON public.inbound_emails TO service_role;
GRANT SELECT ON public.inbound_emails TO authenticated;

-- Optional: Support tickets table for email-based tickets
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id uuid REFERENCES public.inbound_emails(id),
  customer_email text NOT NULL,
  subject text,
  body text,
  status text DEFAULT 'new' CHECK (status IN ('new', 'open', 'pending', 'resolved', 'closed')),
  assigned_to uuid,
  priority text DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "support_tickets_service_role"
ON public.support_tickets
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "support_tickets_admin"
ON public.support_tickets
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_id = auth.uid() AND role IN ('admin', 'owner', 'dispatcher')
  )
);

GRANT ALL ON public.support_tickets TO service_role;
GRANT ALL ON public.support_tickets TO authenticated;
