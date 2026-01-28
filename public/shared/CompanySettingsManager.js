/**
 * Company Settings Manager
 * Manages all company settings, preferences, and configurations
 */

class CompanySettingsManager {
  constructor() {
    this.settings = {};
    this.settingsKey = 'relia_company_settings';
    this.listeners = new Set();
    this.loadSettings();
    this.setupStorageListener();
  }

  /**
   * Setup listener for cross-tab/window synchronization
   */
  setupStorageListener() {
    window.addEventListener('storage', (e) => {
      if (e.key === this.settingsKey) {
        console.log('[CompanySettingsManager] Settings changed in another tab, reloading...');
        this.loadSettings();
        this.notifyListeners();
      }
    });
  }

  /**
   * Subscribe to settings changes
   * @param {Function} callback - Called when settings change with (newSettings, changedKeys)
   * @returns {Function} Unsubscribe function
   */
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Notify all listeners of settings change
   */
  notifyListeners(changedKeys = []) {
    const settings = this.getAllSettings();
    this.listeners.forEach(callback => {
      try {
        callback(settings, changedKeys);
      } catch (err) {
        console.error('[CompanySettingsManager] Listener error:', err);
      }
    });
    
    // Dispatch a custom event for components that don't use subscribe
    window.dispatchEvent(new CustomEvent('companySettingsChanged', {
      detail: { settings, changedKeys }
    }));
  }

  /**
   * Default settings template
   */
  getDefaultSettings() {
    return {
      // General Settings
      companyName: 'Your Company Name',
      companyPhone: '',
      companyEmail: '',
      companyWebsite: '',
      companyAddress: '',
      companyCity: '',
      companyState: '',
      companyZip: '',
      
      // Business Settings
      businessType: 'Transportation',
      yearsInBusiness: new Date().getFullYear(),
      licenseNumber: '',
      insuranceProvider: '',
      insuranceNumber: '',
      
      // Startup Page Setting (used by main.js for navigation)
      defaultStartPage: 'reservations',
      defaultCurrency: 'USD',
      defaultTaxRate: 0,
      minimumReservationAmount: 0,
      acceptCreditCards: true,
      acceptCash: true,
      acceptCheck: false,
      acceptOnlinePayment: true,
      tickerSearchCity: '',
      
      // Vehicle Settings
      defaultVehicleType: 'Sedan',
      requireDriverLicense: true,
      requireInsurance: true,
      insuranceMinimum: 1000000,
      
      // Reservation Settings
      requirePaymentUpfront: false,
      requireAdvanceReservation: 0, // hours
      cancellationPolicyHours: 2,
      noShowFeePercent: 50,
      maxPassengersPerVehicle: 6,
      confirmationStartNumber: 100000,
      lastUsedConfirmationNumber: null,
      defaultReservationSortBy: 'date', // date, confirmation_number, price
      defaultReservationSortOrder: 'desc', // asc, desc
      
      // Account Settings
      accountStartNumber: 30000,
      lastUsedAccountNumber: null,
      
      // Communication Settings
      sendConfirmationEmail: true,
      sendReminderSMS: false,
      sendReceiptEmail: true,
      automaticInvoicing: true,
      invoiceDueDate: 30, // days
      
      // System Settings
      maintenanceMode: false,
      enableAnalytics: true,
      enableReporting: true,
      dataBackupFrequency: 'daily', // daily, weekly, monthly
      
      // Advanced Settings
      apiKeysEnabled: false,
      webhooksEnabled: false,
      thirdPartyIntegrations: [],
      customBranding: false,
      
      // Timestamps
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Load settings from storage
   */
  loadSettings() {
    try {
      const stored = localStorage.getItem(this.settingsKey);
      if (stored) {
        this.settings = JSON.parse(stored);
        
        // MIGRATION: Clean up legacy settings and migrate old keys to new ones
        const legacyKeyMap = {
          'my-start-page': 'defaultStartPage',
          'my-time-zone': 'defaultTimeZone',
          'default-currency': 'defaultCurrency',
          'default-date-format-block-offset': 'defaultDateFormat',
          'default-time-format-block-offset': 'defaultTimeFormat'
        };
        
        let needsSave = false;
        for (const [legacyKey, newKey] of Object.entries(legacyKeyMap)) {
          if (this.settings[legacyKey] && !this.settings[newKey]) {
            // Migrate: copy legacy value to new key if new key doesn't exist
            this.settings[newKey] = this.settings[legacyKey];
            needsSave = true;
            console.log(`[CompanySettingsManager] Migrated ${legacyKey} → ${newKey}`);
          }
          // Always remove legacy key to clean up
          if (this.settings[legacyKey]) {
            delete this.settings[legacyKey];
            needsSave = true;
          }
        }
        
        if (needsSave) {
          console.log('[CompanySettingsManager] Legacy keys cleaned up, re-saving');
          this.saveSettings();
        }
      } else {
        this.settings = this.getDefaultSettings();
        this.saveSettings();
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      this.settings = this.getDefaultSettings();
    }
  }

  /**
   * Save settings to storage
   */
  saveSettings(changedKeys = []) {
    try {
      console.log('[CompanySettingsManager] ===== SAVING SETTINGS =====');
      
      this.settings.updatedAt = new Date().toISOString();
      const jsonString = JSON.stringify(this.settings);
      
      localStorage.setItem(this.settingsKey, jsonString);
      console.log('[CompanySettingsManager] ✅ Saved to localStorage');
      
      // Notify all listeners of the change
      this.notifyListeners(changedKeys);
      
      return true;
    } catch (error) {
      console.error('[CompanySettingsManager] ❌ Error saving settings:', error);
      return false;
    }
  }

  async saveSettingsToSupabase() {
    try {
      const apiModule = await import('./api-service.js');
      if (typeof apiModule.saveCompanySettings !== 'function') {
        console.warn('[CompanySettingsManager] Supabase save unavailable');
        return { success: false, error: 'Supabase save unavailable' };
      }

      const result = await apiModule.saveCompanySettings(this.settings);
      if (!result?.success) {
        console.warn('[CompanySettingsManager] Supabase save failed:', result?.error?.message || result?.error);
      }
      return result;
    } catch (error) {
      console.warn('[CompanySettingsManager] Supabase save threw:', error?.message || error);
      return { success: false, error };
    }
  }

  /**
   * Get a specific setting
   */
  getSetting(key) {
    return this.settings[key];
  }

  /**
   * Set a specific setting
   */
  setSetting(key, value) {
    this.settings[key] = value;
    return this.saveSettings([key]);
  }

  /**
   * Update multiple settings at once
   */
  updateSettings(updates) {
    console.log('[CompanySettingsManager] updateSettings called with:', Object.keys(updates));
    const changedKeys = Object.keys(updates);
    this.settings = { ...this.settings, ...updates };
    const saveResult = this.saveSettings(changedKeys);
    console.log('[CompanySettingsManager] Save result:', saveResult);
    return saveResult;
  }

  /**
   * Get all settings
   */
  getAllSettings() {
    return { ...this.settings };
  }

  /**
   * Reset to defaults
   */
  resetToDefaults() {
    if (confirm('Are you sure you want to reset all settings to defaults? This cannot be undone.')) {
      this.settings = this.getDefaultSettings();
      return this.saveSettings();
    }
    return false;
  }

  /**
   * Export settings as JSON
   */
  exportSettings() {
    const dataStr = JSON.stringify(this.settings, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `company-settings-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Import settings from JSON
   */
  importSettings(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const imported = JSON.parse(e.target.result);
          this.settings = { ...this.settings, ...imported };
          this.saveSettings();
          resolve(true);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  /**
   * Get settings grouped by category
   */
  getSettingsByCategory() {
    return {
      general: {
        label: 'General Company Info',
        settings: {
          companyName: { label: 'Company Name', type: 'text', default: '' },
          companyPhone: { label: 'Phone Number', type: 'tel', default: '' },
          companyEmail: { label: 'Email Address', type: 'email', default: '' },
          companyWebsite: { label: 'Website', type: 'url', default: '' },
          companyAddress: { label: 'Address', type: 'text', default: '' },
          companyCity: { label: 'City', type: 'text', default: '' },
          companyState: { label: 'State', type: 'text', default: '' },
          companyZip: { label: 'ZIP Code', type: 'text', default: '' }
        }
      },
      business: {
        label: 'Business Information',
        settings: {
          businessType: { label: 'Business Type', type: 'text', default: '' },
          yearsInBusiness: { label: 'Years in Business', type: 'number', default: 0, min: 0 },
          licenseNumber: { label: 'License Number', type: 'text', default: '' },
          insuranceProvider: { label: 'Insurance Provider', type: 'text', default: '' },
          insuranceNumber: { label: 'Insurance Policy Number', type: 'text', default: '' }
        }
      },
      financial: {
        label: 'Financial Settings',
        settings: {
          defaultCurrency: { 
            label: 'Currency', 
            type: 'select', 
            default: 'USD',
            options: [
              { value: 'USD', label: 'US Dollar (USD)' },
              { value: 'EUR', label: 'Euro (EUR)' },
              { value: 'GBP', label: 'British Pound (GBP)' },
              { value: 'CAD', label: 'Canadian Dollar (CAD)' },
              { value: 'AUD', label: 'Australian Dollar (AUD)' }
            ]
          },
          defaultTaxRate: { label: 'Default Tax Rate (%)', type: 'number', default: 0, min: 0, max: 100 },
          minimumReservationAmount: { label: 'Minimum Reservation Amount ($)', type: 'number', default: 0, min: 0 },
          acceptCreditCards: { label: 'Accept Credit Cards', type: 'checkbox', default: true },
          acceptCash: { label: 'Accept Cash', type: 'checkbox', default: true },
          acceptCheck: { label: 'Accept Checks', type: 'checkbox', default: false },
          acceptOnlinePayment: { label: 'Accept Online Payments', type: 'checkbox', default: true }
        }
      },
      vehicles: {
        label: 'Vehicle Settings',
        settings: {
          defaultVehicleType: { label: 'Default Vehicle Type', type: 'text', default: 'Sedan' },
          requireDriverLicense: { label: 'Require Driver License', type: 'checkbox', default: true },
          requireInsurance: { label: 'Require Insurance', type: 'checkbox', default: true },
          insuranceMinimum: { label: 'Insurance Minimum ($)', type: 'number', default: 1000000, min: 0 }
        }
      },
      reservations: {
        label: 'Reservation Settings',
        settings: {
          confirmationStartNumber: { 
            label: 'Confirmation # Starts With', 
            type: 'number', 
            default: 20000, 
            min: 1,
            description: 'Starting number for new reservation confirmation numbers'
          },
          accountStartNumber: { 
            label: 'Account # Starts With', 
            type: 'number', 
            default: 5000, 
            min: 1,
            description: 'Starting number for new customer account numbers'
          },
          defaultReservationSortBy: {
            label: 'Default Sort Reservations By',
            type: 'select',
            default: 'date',
            description: 'Default column to sort reservations list by',
            options: [
              { value: 'date', label: 'PU Date' },
              { value: 'confirmation_number', label: 'Confirmation Number' },
              { value: 'price', label: 'Price' }
            ]
          },
          defaultReservationSortOrder: {
            label: 'Default Sort Order',
            type: 'select',
            default: 'desc',
            description: 'Default sort direction for reservations list',
            options: [
              { value: 'asc', label: 'Ascending (oldest/lowest first)' },
              { value: 'desc', label: 'Descending (newest/highest first)' }
            ]
          },
          enableReservationViewMode: {
            label: 'Enable View Mode for current reservations',
            type: 'checkbox',
            default: true,
            description: 'When off, current reservations open editable by default for admins/dispatch.'
          },
          requirePaymentUpfront: { label: 'Require Payment Upfront', type: 'checkbox', default: false },
          requireAdvanceReservation: { label: 'Require Advance Reservation (hours)', type: 'number', default: 0, min: 0 },
          cancellationPolicyHours: { label: 'Cancellation Policy (hours)', type: 'number', default: 2, min: 0 },
          noShowFeePercent: { label: 'No-Show Fee (%)', type: 'number', default: 50, min: 0, max: 100 },
          maxPassengersPerVehicle: { label: 'Max Passengers Per Vehicle', type: 'number', default: 6, min: 1, max: 20 }
        }
      },
      communication: {
        label: 'Communication Settings',
        settings: {
          sendConfirmationEmail: { label: 'Send Confirmation Email', type: 'checkbox', default: true },
          sendReminderSMS: { label: 'Send Reminder SMS', type: 'checkbox', default: false },
          sendReceiptEmail: { label: 'Send Receipt Email', type: 'checkbox', default: true },
          automaticInvoicing: { label: 'Automatic Invoicing', type: 'checkbox', default: true },
          invoiceDueDate: { label: 'Invoice Due Date (days)', type: 'number', default: 30, min: 1, max: 365 }
        }
      },
      system: {
        label: 'System Settings',
        settings: {
          maintenanceMode: { label: 'Maintenance Mode', type: 'checkbox', default: false },
          enableAnalytics: { label: 'Enable Analytics', type: 'checkbox', default: true },
          enableReporting: { label: 'Enable Reporting', type: 'checkbox', default: true },
          dataBackupFrequency: { 
            label: 'Data Backup Frequency', 
            type: 'select', 
            default: 'daily',
            options: [
              { value: 'daily', label: 'Daily' },
              { value: 'weekly', label: 'Weekly' },
              { value: 'monthly', label: 'Monthly' }
            ]
          }
        }
      }
    };
  }
}

// Make class globally available
window.CompanySettingsManager = CompanySettingsManager;
