import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Resend Inbound Email Webhook
 * 
 * This endpoint receives incoming emails from Resend.
 * 
 * Setup in Resend Dashboard:
 * 1. Go to resend.com/domains
 * 2. Add your domain (e.g., mail.relialimo.com)
 * 3. Configure MX records as instructed
 * 4. Go to Webhooks and add: https://your-domain.com/api/email-webhook
 * 5. Select "email.received" event
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    
    console.log('📧 Inbound email received:', JSON.stringify(payload, null, 2));
    
    // Resend inbound email payload structure
    const {
      type,
      data
    } = payload;

    // Only process email.received events
    if (type !== 'email.received') {
      return NextResponse.json({ message: 'Event type ignored' }, { status: 200 });
    }

    const {
      from,
      to,
      subject,
      text,
      html,
      headers,
      attachments
    } = data;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Store the email in a database table
    const { data: savedEmail, error } = await supabase
      .from('inbound_emails')
      .insert({
        from_email: from,
        to_email: Array.isArray(to) ? to.join(', ') : to,
        subject: subject,
        body_text: text,
        body_html: html,
        headers: headers,
        attachments: attachments,
        received_at: new Date().toISOString(),
        processed: false
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to save inbound email:', error);
      return NextResponse.json({ error: 'Failed to save email' }, { status: 500 });
    }

    console.log(`✅ Email saved with ID: ${savedEmail.id}`);

    // Process the email based on recipient or subject
    await processInboundEmail(supabase, savedEmail);

    return NextResponse.json({ 
      success: true, 
      message: 'Email received and processed',
      emailId: savedEmail.id 
    });

  } catch (error) {
    console.error('Email webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

/**
 * Process inbound emails based on content
 */
async function processInboundEmail(supabase: any, email: any) {
  const toAddress = (email.to_email || '').toLowerCase();
  const subject = (email.subject || '').toLowerCase();
  const fromEmail = (email.from_email || '').toLowerCase();

  // Example: Handle support emails
  if (toAddress.includes('support@') || toAddress.includes('help@')) {
    console.log('📩 Support email received from:', fromEmail);
    // Create a support ticket, notify team, etc.
    await supabase
      .from('support_tickets')
      .insert({
        email_id: email.id,
        customer_email: fromEmail,
        subject: email.subject,
        body: email.body_text,
        status: 'new',
        created_at: new Date().toISOString()
      });
  }

  // Example: Handle reservation replies
  if (subject.includes('re:') && subject.includes('reservation')) {
    console.log('📩 Reservation reply from:', fromEmail);
    // Extract confirmation number, update reservation, etc.
  }

  // Example: Handle driver responses
  if (toAddress.includes('dispatch@') || toAddress.includes('drivers@')) {
    console.log('📩 Driver/dispatch email from:', fromEmail);
    // Process driver communication
  }

  // Mark as processed
  await supabase
    .from('inbound_emails')
    .update({ processed: true })
    .eq('id', email.id);
}

// Verify Resend webhook signature (optional but recommended)
export async function verifyWebhookSignature(request: NextRequest): Promise<boolean> {
  const signature = request.headers.get('resend-signature');
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  
  if (!webhookSecret || !signature) {
    return true; // Skip verification if not configured
  }

  // Implement signature verification here
  // See: https://resend.com/docs/webhooks
  return true;
}
