/**
 * SecureSettingsManager.js
 * Manages secure storage of sensitive configuration like SMS and Email credentials.
 * - Saves to Supabase (organization-scoped)
 * - Provides downloadable .env file for backup
 * - Falls back to encrypted localStorage
 */

const SecureSettingsManager = {
  SUPABASE_TABLE: 'organization_secrets',
  LOCAL_BACKUP_KEY: 'secure_settings_backup',
  
  /**
   * Get the current organization ID
   */
  getOrgId() {
    return localStorage.getItem('organization_id') || window.ENV?.FORCE_VEHICLE_ORG_ID;
  },
  
  /**
   * Simple encryption for localStorage backup (not for production-grade security)
   * Uses base64 + character shift for obfuscation
   */
  obfuscate(text) {
    if (!text) return '';
    const shifted = text.split('').map((c, i) => 
      String.fromCharCode(c.charCodeAt(0) + (i % 7) + 1)
    ).join('');
    return btoa(shifted);
  },
  
  /**
   * Reverse the obfuscation
   */
  deobfuscate(encoded) {
    if (!encoded) return '';
    try {
      const shifted = atob(encoded);
      return shifted.split('').map((c, i) => 
        String.fromCharCode(c.charCodeAt(0) - (i % 7) - 1)
      ).join('');
    } catch (e) {
      return '';
    }
  },
  
  /**
   * Get current SMS settings from localStorage
   */
  getSmsSettings() {
    try {
      const raw = localStorage.getItem('smsProviders');
      if (!raw) return null;
      const providers = JSON.parse(raw);
      return providers.find(p => p.isDefault) || providers[0] || null;
    } catch (e) {
      return null;
    }
  },
  
  /**
   * Get current Email settings from localStorage
   */
  getEmailSettings() {
    try {
      const raw = localStorage.getItem('emailSettings');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  },
  
  /**
   * Validate SMS configuration is complete
   */
  isSmsConfigured() {
    const sms = this.getSmsSettings();
    if (!sms) return false;
    
    const hasAccountSid = sms.accountSid?.startsWith('AC') && sms.accountSid.length > 10;
    const hasAuth = sms.authToken?.length > 10 || (sms.apiKeySid?.length > 5 && sms.apiKeySecret?.length > 10);
    const hasSender = sms.fromNumber?.length >= 10 || sms.messagingServiceSid?.startsWith('MG');
    
    return hasAccountSid && hasAuth && hasSender;
  },
  
  /**
   * Validate Email configuration is complete
   */
  isEmailConfigured() {
    const email = this.getEmailSettings();
    if (!email) return false;
    
    const hasSmtp = email.smtpHost?.length > 3;
    const hasPort = email.smtpPort > 0;
    const hasFrom = email.fromEmail?.includes('@');
    
    return hasSmtp && hasPort && hasFrom;
  },
  
  /**
   * Save secrets to Supabase
   */
  async saveToSupabase() {
    const orgId = this.getOrgId();
    if (!orgId) {
      console.warn('[SecureSettings] No organization ID found');
      return { success: false, error: 'No organization ID' };
    }
    
    if (!window.supabase) {
      console.warn('[SecureSettings] Supabase client not available');
      return { success: false, error: 'Supabase not initialized' };
    }
    
    const sms = this.getSmsSettings();
    const email = this.getEmailSettings();
    
    const secrets = {
      organization_id: orgId,
      updated_at: new Date().toISOString(),
      sms_configured: this.isSmsConfigured(),
      email_configured: this.isEmailConfigured(),
      // SMS Settings
      twilio_account_sid: sms?.accountSid || null,
      twilio_auth_token: sms?.authToken || null,
      twilio_api_key_sid: sms?.apiKeySid || null,
      twilio_api_key_secret: sms?.apiKeySecret || null,
      twilio_messaging_service_sid: sms?.messagingServiceSid || null,
      twilio_from_number: sms?.fromNumber || null,
      twilio_status_callback: sms?.statusCallbackUrl || null,
      // Email Settings
      smtp_host: email?.smtpHost || null,
      smtp_port: email?.smtpPort || null,
      smtp_user: email?.smtpUser || null,
      smtp_pass: email?.smtpPass || null,
      smtp_tls: email?.tls || false,
      email_from_name: email?.fromName || null,
      email_from_address: email?.fromEmail || null,
      email_reply_to: email?.replyTo || null
    };
    
    try {
      // Upsert to Supabase
      const { data, error } = await window.supabase
        .from(this.SUPABASE_TABLE)
        .upsert(secrets, { onConflict: 'organization_id' })
        .select();
      
      if (error) {
        // Table might not exist - create local backup
        console.warn('[SecureSettings] Supabase save failed, using local backup:', error.message);
        this.saveLocalBackup(secrets);
        return { success: false, error: error.message, localBackup: true };
      }
      
      console.log('[SecureSettings] Saved to Supabase successfully');
      return { success: true, data };
    } catch (e) {
      console.error('[SecureSettings] Error saving to Supabase:', e);
      this.saveLocalBackup(secrets);
      return { success: false, error: e.message, localBackup: true };
    }
  },
  
  /**
   * Save obfuscated backup to localStorage
   */
  saveLocalBackup(secrets) {
    const backup = {
      ...secrets,
      twilio_auth_token: this.obfuscate(secrets.twilio_auth_token),
      twilio_api_key_secret: this.obfuscate(secrets.twilio_api_key_secret),
      smtp_pass: this.obfuscate(secrets.smtp_pass),
      backup_date: new Date().toISOString()
    };
    localStorage.setItem(this.LOCAL_BACKUP_KEY, JSON.stringify(backup));
    console.log('[SecureSettings] Local backup saved');
  },
  
  /**
   * Load secrets from Supabase
   */
  async loadFromSupabase() {
    const orgId = this.getOrgId();
    if (!orgId || !window.supabase) return null;
    
    try {
      const { data, error } = await window.supabase
        .from(this.SUPABASE_TABLE)
        .select('*')
        .eq('organization_id', orgId)
        .single();
      
      if (error) return null;
      return data;
    } catch (e) {
      return null;
    }
  },
  
  /**
   * Generate .env file content
   */
  generateEnvContent() {
    const sms = this.getSmsSettings();
    const email = this.getEmailSettings();
    const orgId = this.getOrgId();
    
    const lines = [
      '# RELIALIMO Environment Configuration',
      `# Generated: ${new Date().toISOString()}`,
      `# Organization: ${orgId || 'Not Set'}`,
      '',
      '# ===== Twilio SMS Configuration =====',
      `TWILIO_ACCOUNT_SID=${sms?.accountSid || ''}`,
      `TWILIO_AUTH_TOKEN=${sms?.authToken || ''}`,
      `TWILIO_API_KEY_SID=${sms?.apiKeySid || ''}`,
      `TWILIO_API_KEY_SECRET=${sms?.apiKeySecret || ''}`,
      `TWILIO_MESSAGING_SERVICE_SID=${sms?.messagingServiceSid || ''}`,
      `TWILIO_FROM_NUMBER=${sms?.fromNumber || ''}`,
      `TWILIO_STATUS_CALLBACK=${sms?.statusCallbackUrl || ''}`,
      '',
      '# ===== Email/SMTP Configuration =====',
      `SMTP_HOST=${email?.smtpHost || ''}`,
      `SMTP_PORT=${email?.smtpPort || ''}`,
      `SMTP_USER=${email?.smtpUser || ''}`,
      `SMTP_PASS=${email?.smtpPass || ''}`,
      `SMTP_TLS=${email?.tls ? 'true' : 'false'}`,
      `EMAIL_FROM_NAME=${email?.fromName || ''}`,
      `EMAIL_FROM_ADDRESS=${email?.fromEmail || ''}`,
      `EMAIL_REPLY_TO=${email?.replyTo || ''}`,
      '',
      '# ===== Supabase Configuration =====',
      `SUPABASE_URL=${window.ENV?.SUPABASE_URL || ''}`,
      `SUPABASE_ANON_KEY=${window.ENV?.SUPABASE_ANON_KEY || ''}`,
      '',
      '# ===== Google Maps =====',
      `GOOGLE_MAPS_API_KEY=${window.ENV?.GOOGLE_MAPS_API_KEY || ''}`,
      ''
    ];
    
    return lines.join('\n');
  },
  
  /**
   * Download .env file
   */
  downloadEnvFile() {
    const content = this.generateEnvContent();
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `.env.relialimo.${new Date().toISOString().split('T')[0]}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log('[SecureSettings] .env file downloaded');
    return true;
  },
  
  /**
   * Save settings securely (to Supabase + local backup)
   * Called when SMS or Email settings are saved
   */
  async saveSecurely() {
    const smsOk = this.isSmsConfigured();
    const emailOk = this.isEmailConfigured();
    
    if (!smsOk && !emailOk) {
      console.log('[SecureSettings] Nothing to save - no valid configuration');
      return { saved: false, reason: 'No valid configuration' };
    }
    
    // Try Supabase first
    const result = await this.saveToSupabase();
    
    // Always create local backup
    const secrets = {
      sms: this.getSmsSettings(),
      email: this.getEmailSettings(),
      sms_configured: smsOk,
      email_configured: emailOk
    };
    this.saveLocalBackup(secrets);
    
    return {
      saved: true,
      supabase: result.success,
      localBackup: true,
      smsConfigured: smsOk,
      emailConfigured: emailOk
    };
  },
  
  /**
   * Get configuration status summary
   */
  getStatus() {
    return {
      sms: {
        configured: this.isSmsConfigured(),
        settings: this.getSmsSettings()
      },
      email: {
        configured: this.isEmailConfigured(),
        settings: this.getEmailSettings()
      },
      orgId: this.getOrgId()
    };
  }
};

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.SecureSettingsManager = SecureSettingsManager;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SecureSettingsManager;
}
