/**
 * SystemSettingsSync.js
 * Syncs system settings between localStorage (fast) and Supabase (persistent)
 * 
 * Usage:
 *   await SystemSettingsSync.init(organizationId);
 *   await SystemSettingsSync.saveSmsProviders(providers);
 *   const providers = await SystemSettingsSync.getSmsProviders();
 */

const SystemSettingsSync = {
  organizationId: null,
  supabase: null,
  initialized: false,
  
  // Setting categories and their localStorage keys
  SETTINGS_MAP: {
    sms: {
      localStorage: 'smsProviders',
      category: 'sms',
      key: 'providers'
    },
    email: {
      localStorage: 'emailSettings',
      category: 'email', 
      key: 'smtp_config'
    },
    emailConfig: {
      localStorage: 'emailSettingsConfig',
      category: 'email',
      key: 'full_config'
    },
    company: {
      localStorage: 'relia_company_settings',
      category: 'company',
      key: 'general'
    }
  },
  
  /**
   * Initialize the sync manager
   */
  async init(orgId = null) {
    if (this.initialized && this.organizationId === orgId) {
      return true;
    }
    
    // Get Supabase client
    if (window.supabase) {
      this.supabase = window.supabase;
    } else if (window.getSupabaseClient) {
      this.supabase = await window.getSupabaseClient();
    }
    
    if (!this.supabase) {
      console.warn('[SystemSettingsSync] Supabase not available, using localStorage only');
      return false;
    }
    
    // Get organization ID
    this.organizationId = orgId || this._getOrganizationId();
    
    if (!this.organizationId) {
      console.warn('[SystemSettingsSync] No organization ID, using localStorage only');
      return false;
    }
    
    this.initialized = true;
    console.log('[SystemSettingsSync] Initialized for org:', this.organizationId);
    
    // Sync from Supabase to localStorage on init
    await this.pullAllSettings();
    
    return true;
  },
  
  /**
   * Get organization ID from various sources
   */
  _getOrganizationId() {
    // Try ENV first
    if (window.ENV?.ORGANIZATION_ID) {
      return window.ENV.ORGANIZATION_ID;
    }
    
    // Try localStorage
    const stored = localStorage.getItem('organization_id');
    if (stored) return stored;
    
    // Try company settings
    try {
      const settings = JSON.parse(localStorage.getItem('relia_company_settings') || '{}');
      if (settings.organization_id) return settings.organization_id;
    } catch (e) {}
    
    return null;
  },
  
  /**
   * Pull all settings from Supabase to localStorage
   * Only overwrites if Supabase has actual configured values (not null/empty)
   */
  async pullAllSettings() {
    if (!this.supabase || !this.organizationId) return;
    
    try {
      const { data, error } = await this.supabase
        .from('system_settings')
        .select('setting_category, setting_key, setting_value')
        .eq('organization_id', this.organizationId);
      
      if (error) {
        console.error('[SystemSettingsSync] Pull error:', error);
        return;
      }
      
      if (!data || data.length === 0) {
        console.log('[SystemSettingsSync] No settings in Supabase, pushing localStorage');
        await this.pushAllSettings();
        return;
      }
      
      // Update localStorage from Supabase - but only if Supabase has valid data
      for (const row of data) {
        const mapping = Object.values(this.SETTINGS_MAP).find(
          m => m.category === row.setting_category && m.key === row.setting_key
        );
        
        if (mapping && row.setting_value) {
          // Check if the Supabase value is actually configured (not all nulls)
          const supabaseValue = row.setting_value;
          const localRaw = localStorage.getItem(mapping.localStorage);
          
          // For email settings, check if Supabase has real SMTP config
          if (mapping.category === 'email') {
            const hasValidSmtp = supabaseValue?.smtpHost?.length > 3 || 
                                 supabaseValue?.fromEmail?.includes('@');
            
            if (!hasValidSmtp && localRaw) {
              // Supabase has empty/null email config, keep localStorage values
              console.log(`[SystemSettingsSync] Skipping ${mapping.localStorage} - Supabase has empty config, keeping local`);
              continue;
            }
          }
          
          // For SMS settings, check if Supabase has real provider config
          if (mapping.category === 'sms') {
            const providers = Array.isArray(supabaseValue) ? supabaseValue : [];
            const hasValidSms = providers.some(p => 
              p?.accountSid?.startsWith('AC') || p?.messagingServiceSid?.startsWith('MG')
            );
            
            if (!hasValidSms && localRaw) {
              // Supabase has empty SMS config, keep localStorage values
              console.log(`[SystemSettingsSync] Skipping ${mapping.localStorage} - Supabase has empty config, keeping local`);
              continue;
            }
          }
          
          localStorage.setItem(mapping.localStorage, JSON.stringify(supabaseValue));
          console.log(`[SystemSettingsSync] Pulled ${mapping.localStorage}`);
        }
      }
      
      console.log('[SystemSettingsSync] Pulled', data.length, 'settings from Supabase');
    } catch (e) {
      console.error('[SystemSettingsSync] Pull failed:', e);
    }
  },
  
  /**
   * Push all localStorage settings to Supabase
   */
  async pushAllSettings() {
    if (!this.supabase || !this.organizationId) return;
    
    for (const [name, mapping] of Object.entries(this.SETTINGS_MAP)) {
      const raw = localStorage.getItem(mapping.localStorage);
      if (raw) {
        try {
          const value = JSON.parse(raw);
          await this._upsertSetting(mapping.category, mapping.key, value);
          console.log(`[SystemSettingsSync] Pushed ${name}`);
        } catch (e) {
          console.error(`[SystemSettingsSync] Failed to push ${name}:`, e);
        }
      }
    }
  },
  
  /**
   * Upsert a single setting to Supabase
   */
  async _upsertSetting(category, key, value) {
    if (!this.supabase || !this.organizationId) return;
    
    const { error } = await this.supabase
      .from('system_settings')
      .upsert({
        organization_id: this.organizationId,
        setting_category: category,
        setting_key: key,
        setting_value: value
      }, {
        onConflict: 'organization_id,setting_category,setting_key'
      });
    
    if (error) {
      console.error(`[SystemSettingsSync] Upsert error for ${category}/${key}:`, error);
      throw error;
    }
  },
  
  /**
   * Get a setting (localStorage first, then Supabase)
   */
  async getSetting(settingName) {
    const mapping = this.SETTINGS_MAP[settingName];
    if (!mapping) {
      console.warn(`[SystemSettingsSync] Unknown setting: ${settingName}`);
      return null;
    }
    
    // Try localStorage first (fast)
    const raw = localStorage.getItem(mapping.localStorage);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch (e) {}
    }
    
    // Fall back to Supabase
    if (this.supabase && this.organizationId) {
      try {
        const { data, error } = await this.supabase
          .from('system_settings')
          .select('setting_value')
          .eq('organization_id', this.organizationId)
          .eq('setting_category', mapping.category)
          .eq('setting_key', mapping.key)
          .single();
        
        if (data?.setting_value) {
          // Update localStorage
          localStorage.setItem(mapping.localStorage, JSON.stringify(data.setting_value));
          return data.setting_value;
        }
      } catch (e) {
        console.error(`[SystemSettingsSync] Get ${settingName} failed:`, e);
      }
    }
    
    return null;
  },
  
  /**
   * Save a setting (both localStorage and Supabase)
   */
  async saveSetting(settingName, value) {
    const mapping = this.SETTINGS_MAP[settingName];
    if (!mapping) {
      console.warn(`[SystemSettingsSync] Unknown setting: ${settingName}`);
      return false;
    }
    
    // Always save to localStorage
    localStorage.setItem(mapping.localStorage, JSON.stringify(value));
    
    // Also save to Supabase if available
    if (this.supabase && this.organizationId) {
      try {
        await this._upsertSetting(mapping.category, mapping.key, value);
        console.log(`[SystemSettingsSync] Saved ${settingName} to Supabase`);
      } catch (e) {
        console.error(`[SystemSettingsSync] Failed to save ${settingName} to Supabase:`, e);
        // Still return true since localStorage worked
      }
    }
    
    return true;
  },
  
  // =====================================================
  // Convenience methods for specific settings
  // =====================================================
  
  async getSmsProviders() {
    return await this.getSetting('sms') || [];
  },
  
  async saveSmsProviders(providers) {
    return await this.saveSetting('sms', providers);
  },
  
  async getEmailSettings() {
    return await this.getSetting('email') || {};
  },
  
  async saveEmailSettings(settings) {
    return await this.saveSetting('email', settings);
  },
  
  async getEmailConfig() {
    return await this.getSetting('emailConfig') || {};
  },
  
  async saveEmailConfig(config) {
    return await this.saveSetting('emailConfig', config);
  },
  
  async getCompanySettings() {
    return await this.getSetting('company') || {};
  },
  
  async saveCompanySettings(settings) {
    return await this.saveSetting('company', settings);
  }
};

// Auto-initialize when Supabase is ready
if (typeof window !== 'undefined') {
  window.SystemSettingsSync = SystemSettingsSync;
  
  // Try to init after a short delay to let Supabase load
  setTimeout(() => {
    if (!SystemSettingsSync.initialized) {
      SystemSettingsSync.init().catch(e => {
        console.warn('[SystemSettingsSync] Auto-init failed:', e);
      });
    }
  }, 2000);
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SystemSettingsSync;
}
