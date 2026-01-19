import { NextResponse } from 'next/server';

// Send email via Resend API
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { to, subject, html, text } = body;
    
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
    
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'RELIALIMO <noreply@relialimo.com>',
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        text: text || stripHtml(html)
      })
    });
    
    const result = await response.json();
    
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
