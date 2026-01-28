import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Send email via Resend API
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { to, subject, html, text, reservationId, customerId, driverId, emailType } = body;
    
    if (!to || !subject) {
      return NextResponse.json(
        { error: 'Missing required fields: to, subject' },
        { status: 400 }
      );
    }
    
    // Get Resend API key from environment
    const resendApiKey = process.env.RESEND_API_KEY;
    
    if (!resendApiKey) {
      console.error('RESEND_API_KEY not configured');
      return NextResponse.json(
        { error: 'Email service not configured' },
        { status: 500 }
      );
    }

    const fromEmail = process.env.EMAIL_FROM || 'RELIALIMO <noreply@relialimo.com>';
    const toArray = Array.isArray(to) ? to : [to];
    
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: fromEmail,
        to: toArray,
        subject,
        html,
        text: text || stripHtml(html)
      })
    });
    
    const result = await response.json();
    
    // Log to outbound_emails table
    try {
      const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      
      if (supabaseUrl && supabaseServiceKey) {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        
        await supabase.from('outbound_emails').insert({
          to_email: toArray.join(', '),
          from_email: fromEmail,
          subject,
          body_text: text || stripHtml(html),
          body_html: html,
          status: response.ok ? 'sent' : 'failed',
          resend_id: result.id || null,
          error_message: response.ok ? null : (result.message || 'Unknown error'),
          reservation_id: reservationId || null,
          customer_id: customerId || null,
          driver_id: driverId || null,
          email_type: emailType || 'notification'
        });
      }
    } catch (logError) {
      console.warn('Failed to log outbound email:', logError);
      // Don't fail the request if logging fails
    }
    
    if (!response.ok) {
      console.error('Resend API error:', result);
      return NextResponse.json(
        { error: result.message || 'Failed to send email' },
        { status: response.status }
      );
    }
    
    console.log('✅ Email sent successfully:', result.id);
    
    return NextResponse.json({
      success: true,
      messageId: result.id
    });
    
  } catch (error) {
    console.error('Send email error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Simple HTML to text converter
function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
