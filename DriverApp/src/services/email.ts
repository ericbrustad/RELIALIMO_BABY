/**
 * Email Service
 * Sends emails via the production API endpoint (/api/email-send)
 * which uses Resend API with credentials from environment
 */

// Production API base URL
const API_BASE_URL = 'https://relialimo.com';

interface EmailParams {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
}

interface EmailResponse {
  success: boolean;
  id?: string;
  error?: string;
}

/**
 * Send an email via the production API endpoint
 * This uses the same /api/email-send endpoint as the web driver-portal
 */
export async function sendEmail(params: EmailParams): Promise<EmailResponse> {
  try {
    console.log('[EmailService] Sending email to:', params.to);
    
    const response = await fetch(`${API_BASE_URL}/api/email-send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('[EmailService] Error:', data);
      return { success: false, error: data.error || 'Failed to send email' };
    }

    console.log('[EmailService] Email sent successfully, id:', data.messageId);
    return { success: true, id: data.messageId };
  } catch (error) {
    console.error('[EmailService] Exception:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Send OTP verification email
 */
export async function sendOtpEmail(email: string, code: string, firstName?: string): Promise<EmailResponse> {
  const name = firstName || 'Driver';
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verify Your Email</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td align="center" style="padding: 40px 0;">
            <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <!-- Header -->
              <tr>
                <td style="padding: 30px 40px; background-color: #1a1a2e; border-radius: 8px 8px 0 0;">
                  <h1 style="margin: 0; color: #c9a227; font-size: 24px; text-align: center;">RELIALIMO</h1>
                  <p style="margin: 5px 0 0; color: #ffffff; font-size: 14px; text-align: center;">Driver Portal</p>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 40px;">
                  <h2 style="margin: 0 0 20px; color: #333333; font-size: 20px;">Verify Your Email</h2>
                  <p style="margin: 0 0 20px; color: #666666; font-size: 16px; line-height: 1.5;">
                    Hi ${name},
                  </p>
                  <p style="margin: 0 0 30px; color: #666666; font-size: 16px; line-height: 1.5;">
                    Use the following code to verify your email address and complete your driver registration:
                  </p>
                  
                  <!-- OTP Code Box -->
                  <table role="presentation" style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td align="center">
                        <div style="background-color: #f8f9fa; border: 2px dashed #c9a227; border-radius: 8px; padding: 20px 40px; display: inline-block;">
                          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1a1a2e;">${code}</span>
                        </div>
                      </td>
                    </tr>
                  </table>
                  
                  <p style="margin: 30px 0 0; color: #999999; font-size: 14px; line-height: 1.5;">
                    This code will expire in 10 minutes. If you didn't request this code, you can safely ignore this email.
                  </p>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="padding: 20px 40px; background-color: #f8f9fa; border-radius: 0 0 8px 8px; border-top: 1px solid #eeeeee;">
                  <p style="margin: 0; color: #999999; font-size: 12px; text-align: center;">
                    © ${new Date().getFullYear()} RELIALIMO. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
  
  const text = `Hi ${name},\n\nYour RELIALIMO Driver Portal verification code is: ${code}\n\nThis code will expire in 10 minutes.\n\nIf you didn't request this code, you can safely ignore this email.`;
  
  return sendEmail({
    to: email,
    subject: 'Your RELIALIMO Driver Portal Verification Code',
    html,
    text,
  });
}
