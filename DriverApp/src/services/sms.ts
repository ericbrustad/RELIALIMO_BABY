/**
 * SMS Service
 * Sends SMS via the production API endpoint (/api/sms-send)
 * which uses Twilio with credentials from environment
 */

// Production API base URL
const API_BASE_URL = 'https://relialimo.com';

interface SmsResponse {
  success: boolean;
  sid?: string;
  error?: string;
}

/**
 * Send an SMS via the production API endpoint
 */
export async function sendSms(to: string, message: string): Promise<SmsResponse> {
  try {
    console.log('[SmsService] Sending SMS to:', to);
    
    const response = await fetch(`${API_BASE_URL}/api/sms-send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ to, body: message }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('[SmsService] Error:', data);
      return { success: false, error: data.error || 'Failed to send SMS' };
    }

    console.log('[SmsService] SMS sent successfully, sid:', data.sid);
    return { success: true, sid: data.sid };
  } catch (error) {
    console.error('[SmsService] Exception:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Send OTP verification SMS
 */
export async function sendOtpSms(phone: string, code: string): Promise<SmsResponse> {
  const message = `Your RELIALIMO Driver Portal verification code is: ${code}. This code expires in 5 minutes.`;
  return sendSms(phone, message);
}
