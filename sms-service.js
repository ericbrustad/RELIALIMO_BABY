// Global SMS Service for RELIALIMO
// Handles SMS sending via server endpoint to avoid CORS issues with Twilio API

class SMSService {
  constructor() {
    this.baseUrl = window.location.origin;
    this.providers = this.loadProviders();
  }

  loadProviders() {
    try {
      const raw = localStorage.getItem('smsProviders');
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.warn('Failed to load SMS providers:', e);
      return [];
    }
  }

  getDefaultProvider() {
    return this.providers.find(p => p.isDefault) || this.providers[0] || null;
  }

  async sendSms(to, message, options = {}) {
    const provider = options.provider || this.getDefaultProvider();
    
    if (!to || !message) {
      throw new Error('SMS requires both "to" and "message" parameters');
    }

    if (!provider) {
      throw new Error('No SMS provider configured');
    }

    const formattedPhone = this.formatPhoneNumber(to);
    console.log(`[SMSService] Sending SMS to ${formattedPhone}: ${message.substring(0, 50)}...`);

    try {
      // Use server endpoint to avoid CORS issues
      const response = await fetch(`${this.baseUrl}/api/sms-send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: formattedPhone,
          body: message
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`SMS API error: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      console.log(`[SMSService] SMS sent successfully:`, result);
      return result;

    } catch (error) {
      console.error('[SMSService] Failed to send SMS:', error);
      
      // Fallback: try direct Twilio API (may fail due to CORS)
      if (provider.type === 'twilio') {
        return await this.sendViaTwilioDirect(to, message, provider);
      }
      
      throw error;
    }
  }

  async sendViaTwilioDirect(to, message, provider) {
    console.log('[SMSService] Attempting direct Twilio API call (may fail due to CORS)');
    
    const auth = provider.useApiKey 
      ? `${provider.apiKeySid}:${provider.apiKeySecret}`
      : `${provider.accountSid}:${provider.authToken}`;

    const params = new URLSearchParams();
    params.append('To', to);
    params.append('Body', message);
    
    if (provider.messagingServiceSid) {
      params.append('MessagingServiceSid', provider.messagingServiceSid);
    } else if (provider.fromNumber) {
      params.append('From', provider.fromNumber);
    }

    if (provider.statusCallbackUrl) {
      params.append('StatusCallback', provider.statusCallbackUrl);
    }

    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${provider.accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(auth),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Twilio API error: ${response.status} ${errorText}`);
    }

    return await response.json();
  }

  // Helper method to send test SMS
  async sendTestSms(to, message = 'Test message from RELIALIMO SMS Service') {
    return await this.sendSms(to, message);
  }

  // Format phone number for SMS (basic US formatting)
  formatPhoneNumber(phone) {
    if (!phone) return '';
    
    // Remove all non-digits
    const digits = phone.replace(/\D/g, '');
    
    // Add +1 if it's a US number without country code
    if (digits.length === 10) {
      return `+1${digits}`;
    }
    
    // Add + if missing
    if (digits.length > 10 && !phone.startsWith('+')) {
      return `+${digits}`;
    }
    
    return phone;
  }
}

// Initialize global SMS service
window.smsService = new SMSService();

console.log('🔧 SMS Service initialized and available at window.smsService');

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SMSService;
}