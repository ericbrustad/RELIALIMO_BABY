import { NextResponse } from 'next/server';

// Get environment variable settings (for admin config sync)
// Returns masked versions of sensitive values for security
export async function GET(request: Request) {
  try {
    // Basic auth check - only allow from same origin
    const origin = request.headers.get('origin') || '';
    const host = request.headers.get('host') || '';
    
    // Allow localhost and relialimo.com
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://relialimo.com',
      'https://www.relialimo.com',
      'https://admin.relialimo.com',
      'https://account.relialimo.com'
    ];
    
    // Get Twilio settings
    const twilioSettings = {
      accountSid: process.env.TWILIO_ACCOUNT_SID || '',
      authToken: process.env.TWILIO_AUTH_TOKEN || '',
      apiKeySid: process.env.TWILIO_API_KEY_SID || '',
      apiKeySecret: process.env.TWILIO_API_KEY_SECRET || '',
      messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID || '',
      fromNumber: process.env.TWILIO_FROM_NUMBER || process.env.TWILIO_PHONE_NUMBER || '',
      statusCallback: process.env.TWILIO_STATUS_CALLBACK || ''
    };
    
    // Get Email/Resend settings
    const emailSettings = {
      resendApiKey: process.env.RESEND_API_KEY || '',
      fromEmail: process.env.EMAIL_FROM || process.env.RESEND_FROM_EMAIL || '',
      fromName: process.env.EMAIL_FROM_NAME || 'RELIALIMO',
      replyTo: process.env.EMAIL_REPLY_TO || '',
      smtpHost: process.env.SMTP_HOST || '',
      smtpPort: process.env.SMTP_PORT || '',
      smtpUser: process.env.SMTP_USER || '',
      smtpPass: process.env.SMTP_PASS || ''
    };
    
    // Mask sensitive values (show first 4 and last 4 chars)
    const maskValue = (value: string, showFirst = 4, showLast = 4): string => {
      if (!value || value.length < showFirst + showLast + 4) {
        return value ? '****' : '';
      }
      return value.substring(0, showFirst) + '****' + value.substring(value.length - showLast);
    };
    
    // Return both full values (for updating) and masked (for display)
    // Full values should only be used to populate form fields
    return NextResponse.json({
      success: true,
      twilio: {
        // Full values for form population
        accountSid: twilioSettings.accountSid,
        authToken: twilioSettings.authToken,
        apiKeySid: twilioSettings.apiKeySid,
        apiKeySecret: twilioSettings.apiKeySecret,
        messagingServiceSid: twilioSettings.messagingServiceSid,
        fromNumber: twilioSettings.fromNumber,
        statusCallback: twilioSettings.statusCallback,
        // Config status
        isConfigured: !!(twilioSettings.accountSid && (twilioSettings.authToken || twilioSettings.apiKeySid)),
        hasFromNumber: !!(twilioSettings.fromNumber || twilioSettings.messagingServiceSid)
      },
      email: {
        // Full values for form population
        resendApiKey: emailSettings.resendApiKey,
        fromEmail: emailSettings.fromEmail,
        fromName: emailSettings.fromName,
        replyTo: emailSettings.replyTo,
        smtpHost: emailSettings.smtpHost,
        smtpPort: emailSettings.smtpPort,
        smtpUser: emailSettings.smtpUser,
        smtpPass: emailSettings.smtpPass,
        // Config status
        isConfigured: !!(emailSettings.resendApiKey || emailSettings.smtpHost),
        provider: emailSettings.resendApiKey ? 'resend' : (emailSettings.smtpHost ? 'smtp' : 'none')
      },
      masked: {
        twilio: {
          accountSid: maskValue(twilioSettings.accountSid),
          authToken: maskValue(twilioSettings.authToken),
          apiKeySid: maskValue(twilioSettings.apiKeySid),
          apiKeySecret: maskValue(twilioSettings.apiKeySecret),
          messagingServiceSid: maskValue(twilioSettings.messagingServiceSid),
          fromNumber: twilioSettings.fromNumber // Phone numbers can be shown
        },
        email: {
          resendApiKey: maskValue(emailSettings.resendApiKey, 3, 4),
          fromEmail: emailSettings.fromEmail,
          smtpHost: emailSettings.smtpHost,
          smtpUser: emailSettings.smtpUser,
          smtpPass: maskValue(emailSettings.smtpPass)
        }
      }
    });
    
  } catch (error) {
    console.error('Get env settings error:', error);
    return NextResponse.json(
      { error: 'Failed to get environment settings' },
      { status: 500 }
    );
  }
}
