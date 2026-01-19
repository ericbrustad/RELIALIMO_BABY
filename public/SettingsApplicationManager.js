/**
 * Settings Application Manager
 * 
 * Applies company preferences settings throughout the application.
 * This is the central hub that reads settings from CompanySettingsManager
 * and applies them to various components, UI elements, and business logic.
 */

class SettingsApplicationManager {
  constructor() {
    this.settingsManager = null;
    this.init();
  }

  /**
   * Initialize and apply all settings
   */
  async init() {
    console.log('[SettingsApplicationManager] Initializing...');
    
    // Wait for CompanySettingsManager to be available
    let attempts = 0;
    const maxAttempts = 100;
    
    while (!window.CompanySettingsManager && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    if (window.CompanySettingsManager) {
      this.settingsManager = new window.CompanySettingsManager();
      console.log('[SettingsApplicationManager] CompanySettingsManager loaded');
      
      // Apply all settings
      this.applyAllSettings();
      
      // Listen for setting updates
      this.listenForSettingChanges();
    } else {
      console.warn('[SettingsApplicationManager] CompanySettingsManager not available');
    }
  }

  /**
   * Apply all settings to the application
   */
  applyAllSettings() {
    console.log('[SettingsApplicationManager] Applying all settings...');
    
    // Company Info
    this.applyCompanyInfo();
    
    // Financial Settings
    this.applyFinancialSettings();
    
    // Reservation Settings
    this.applyReservationSettings();
    
    // Communication Settings
    this.applyCommunicationSettings();
    
    // System Settings
    this.applySystemSettings();
    
    // Vehicle Settings
    this.applyVehicleSettings();
    
    console.log('[SettingsApplicationManager] All settings applied');
  }

  /**
   * Apply company information settings
   */
  applyCompanyInfo() {
    try {
      const companyName = this.settingsManager.getSetting('companyName');
      const companyPhone = this.settingsManager.getSetting('companyPhone');
      const companyEmail = this.settingsManager.getSetting('companyEmail');
      const companyWebsite = this.settingsManager.getSetting('companyWebsite');
      const companyAddress = this.settingsManager.getSetting('companyAddress');
      const companyCity = this.settingsManager.getSetting('companyCity');
      const companyState = this.settingsManager.getSetting('companyState');
      const companyZip = this.settingsManager.getSetting('companyZip');
      const tickerSearchCity = (this.settingsManager.getSetting('tickerSearchCity') || '').toString();
      const localRegionParts = tickerSearchCity.split(',').map(p => p.trim()).filter(Boolean);
      const localCity = localRegionParts[0] || companyCity;
      const localState = localRegionParts[1] || companyState;

      // Update global company info (if used by modules)
      window.COMPANY_INFO = {
        name: companyName,
        phone: companyPhone,
        email: companyEmail,
        website: companyWebsite,
        address: companyAddress,
        city: companyCity,
        state: companyState,
        zip: companyZip
      };

      // Publish a simple city/state tuple for modules needing a default region
      window.LOCAL_CITY_STATE = {
        city: localCity || '',
        state: localState || ''
      };

      console.log('[SettingsApplicationManager] Company info applied:', window.COMPANY_INFO);

      // Update page title if company name is set
      if (companyName && companyName !== 'Your Company Name') {
        document.title = companyName + ' - Limo Reservation System';
      }

      // Update any visible company name elements
      const companyNameElements = document.querySelectorAll('[data-company-name]');
      companyNameElements.forEach(el => {
        el.textContent = companyName;
      });

      // Update header/footer with company info
      this.updateCompanyDisplayElements(companyName, companyPhone, companyEmail);
    } catch (error) {
      console.error('[SettingsApplicationManager] Error applying company info:', error);
    }
  }

  /**
   * Apply financial settings
   */
  applyFinancialSettings() {
    try {
      const defaultCurrency = this.settingsManager.getSetting('defaultCurrency') || 'USD';
      const defaultTaxRate = this.settingsManager.getSetting('defaultTaxRate') || 0;
      const minimumReservationAmount = this.settingsManager.getSetting('minimumReservationAmount') || 0;
      const acceptCreditCards = this.settingsManager.getSetting('acceptCreditCards');
      const acceptCash = this.settingsManager.getSetting('acceptCash');
      const acceptCheck = this.settingsManager.getSetting('acceptCheck');
      const acceptOnlinePayment = this.settingsManager.getSetting('acceptOnlinePayment');

      // Set global financial config
      window.FINANCIAL_CONFIG = {
        currency: defaultCurrency,
        currencySymbol: this.getCurrencySymbol(defaultCurrency),
        taxRate: defaultTaxRate / 100, // Convert to decimal
        minimumAmount: minimumReservationAmount,
        paymentMethods: {
          creditCard: acceptCreditCards,
          cash: acceptCash,
          check: acceptCheck,
          online: acceptOnlinePayment
        }
      };

      console.log('[SettingsApplicationManager] Financial settings applied:', window.FINANCIAL_CONFIG);

      // Update CostCalculator if it exists
      if (window.CostCalculator && window.CostCalculator.prototype) {
        // Settings will be read dynamically from this config
      }

      // Update payment method UI
      this.updatePaymentMethodsUI(window.FINANCIAL_CONFIG.paymentMethods);

      // Update currency display
      this.updateCurrencyDisplay(defaultCurrency);

    } catch (error) {
      console.error('[SettingsApplicationManager] Error applying financial settings:', error);
    }
  }

  /**
   * Apply reservation settings
   */
  applyReservationSettings() {
    try {
      const requirePaymentUpfront = this.settingsManager.getSetting('requirePaymentUpfront');
      const requireAdvanceReservation = this.settingsManager.getSetting('requireAdvanceReservation') || 0;
      const cancellationPolicyHours = this.settingsManager.getSetting('cancellationPolicyHours') || 2;
      const noShowFeePercent = this.settingsManager.getSetting('noShowFeePercent') || 50;
      const maxPassengersPerVehicle = this.settingsManager.getSetting('maxPassengersPerVehicle') || 6;

      // Set global reservation config
      window.RESERVATION_CONFIG = {
        requirePaymentUpfront,
        requireAdvanceReservationHours: requireAdvanceReservation,
        cancellationPolicyHours,
        noShowFeePercent,
        maxPassengers: maxPassengersPerVehicle
      };

      console.log('[SettingsApplicationManager] Reservation settings applied:', window.RESERVATION_CONFIG);

      // Update ReservationManager if it exists
      if (window.ReservationManager) {
        // Will use these settings when creating/validating reservations
      }

      // Update UI prompts/messages about payment requirements
      this.updatePaymentPrompts(requirePaymentUpfront);

    } catch (error) {
      console.error('[SettingsApplicationManager] Error applying reservation settings:', error);
    }
  }

  /**
   * Apply communication settings
   */
  applyCommunicationSettings() {
    try {
      const sendConfirmationEmail = this.settingsManager.getSetting('sendConfirmationEmail');
      const sendReminderSMS = this.settingsManager.getSetting('sendReminderSMS');
      const sendReceiptEmail = this.settingsManager.getSetting('sendReceiptEmail');
      const automaticInvoicing = this.settingsManager.getSetting('automaticInvoicing');
      const invoiceDueDate = this.settingsManager.getSetting('invoiceDueDate') || 30;

      // Set global communication config
      window.COMMUNICATION_CONFIG = {
        sendConfirmationEmail,
        sendReminderSMS,
        sendReceiptEmail,
        automaticInvoicing,
        invoiceDueDays: invoiceDueDate
      };

      console.log('[SettingsApplicationManager] Communication settings applied:', window.COMMUNICATION_CONFIG);

      // Update UI elements that show email/SMS preferences
      this.updateCommunicationPreferencesUI(window.COMMUNICATION_CONFIG);

    } catch (error) {
      console.error('[SettingsApplicationManager] Error applying communication settings:', error);
    }
  }

  /**
   * Apply system settings
   */
  applySystemSettings() {
    try {
      const maintenanceMode = this.settingsManager.getSetting('maintenanceMode');
      const enableAnalytics = this.settingsManager.getSetting('enableAnalytics');
      const enableReporting = this.settingsManager.getSetting('enableReporting');
      const dataBackupFrequency = this.settingsManager.getSetting('dataBackupFrequency') || 'daily';

      // Set global system config
      window.SYSTEM_CONFIG = {
        maintenanceMode,
        analyticsEnabled: enableAnalytics,
        reportingEnabled: enableReporting,
        backupFrequency: dataBackupFrequency
      };

      console.log('[SettingsApplicationManager] System settings applied:', window.SYSTEM_CONFIG);

      // If maintenance mode is enabled, show a banner
      if (maintenanceMode) {
        this.showMaintenanceModeBanner();
      }

      // Hide reporting features if disabled
      if (!enableReporting) {
        this.hideReportingFeatures();
      }

    } catch (error) {
      console.error('[SettingsApplicationManager] Error applying system settings:', error);
    }
  }

  /**
   * Apply vehicle settings
   */
  applyVehicleSettings() {
    try {
      const defaultVehicleType = this.settingsManager.getSetting('defaultVehicleType');
      const requireDriverLicense = this.settingsManager.getSetting('requireDriverLicense');
      const requireInsurance = this.settingsManager.getSetting('requireInsurance');
      const insuranceMinimum = this.settingsManager.getSetting('insuranceMinimum') || 1000000;

      // Set global vehicle config
      window.VEHICLE_CONFIG = {
        defaultType: defaultVehicleType,
        requireDriverLicense,
        requireInsurance,
        insuranceMinimum
      };

      console.log('[SettingsApplicationManager] Vehicle settings applied:', window.VEHICLE_CONFIG);

      // Update vehicle-related form validations
      this.updateVehicleValidations(window.VEHICLE_CONFIG);

    } catch (error) {
      console.error('[SettingsApplicationManager] Error applying vehicle settings:', error);
    }
  }

  /**
   * Listen for setting changes and reapply
   */
  listenForSettingChanges() {
    // Create a periodic check for setting updates
    window.addEventListener('settingsUpdated', () => {
      console.log('[SettingsApplicationManager] Settings updated, reapplying...');
      this.applyAllSettings();
    });
  }

  /**
   * Update company display elements with company info
   */
  updateCompanyDisplayElements(name, phone, email) {
    // Update elements with data attributes
    const headerCompanyName = document.querySelector('[data-section="company-name"]');
    if (headerCompanyName) headerCompanyName.textContent = name;

    const headerCompanyPhone = document.querySelector('[data-section="company-phone"]');
    if (headerCompanyPhone) headerCompanyPhone.textContent = phone;

    const headerCompanyEmail = document.querySelector('[data-section="company-email"]');
    if (headerCompanyEmail) headerCompanyEmail.textContent = email;
  }

  /**
   * Update payment methods UI based on enabled methods
   */
  updatePaymentMethodsUI(paymentMethods) {
    // Hide/show payment method options based on settings
    const paymentSelects = document.querySelectorAll('[data-payment-method]');
    paymentSelects.forEach(select => {
      const method = select.dataset.paymentMethod;
      if (!paymentMethods[method]) {
        select.style.display = 'none';
      } else {
        select.style.display = '';
      }
    });
  }

  /**
   * Update currency display format
   */
  updateCurrencyDisplay(currency) {
    // Update any currency displays
    const currencyElements = document.querySelectorAll('[data-currency]');
    currencyElements.forEach(el => {
      el.dataset.currency = currency;
    });
  }

  /**
   * Update payment upfront prompts
   */
  updatePaymentPrompts(requireUpfront) {
    if (requireUpfront) {
      const paymentPrompts = document.querySelectorAll('[data-payment-prompt]');
      paymentPrompts.forEach(el => {
        el.textContent = 'Payment required upfront for this reservation';
      });
    }
  }

  /**
   * Update communication preferences UI
   */
  updateCommunicationPreferencesUI(config) {
    // Update checkboxes for communication preferences
    const confirmEmailCheckbox = document.querySelector('[data-setting="sendConfirmationEmail"]');
    if (confirmEmailCheckbox) confirmEmailCheckbox.checked = config.sendConfirmationEmail;

    const reminderSmsCheckbox = document.querySelector('[data-setting="sendReminderSMS"]');
    if (reminderSmsCheckbox) reminderSmsCheckbox.checked = config.sendReminderSMS;

    const receiptEmailCheckbox = document.querySelector('[data-setting="sendReceiptEmail"]');
    if (receiptEmailCheckbox) receiptEmailCheckbox.checked = config.sendReceiptEmail;
  }

  /**
   * Show maintenance mode banner
   */
  showMaintenanceModeBanner() {
    const banner = document.createElement('div');
    banner.className = 'maintenance-banner';
    banner.textContent = '🔧 System is in Maintenance Mode - Some features may be unavailable';
    banner.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: #ff9800;
      color: white;
      padding: 15px;
      text-align: center;
      font-weight: bold;
      z-index: 10000;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    `;
    document.body.insertBefore(banner, document.body.firstChild);
  }

  /**
   * Hide reporting features if disabled
   */
  hideReportingFeatures() {
    const reportingNav = document.querySelector('[data-section="reports"]');
    if (reportingNav) {
      reportingNav.style.display = 'none';
    }
  }

  /**
   * Update vehicle validations
   */
  updateVehicleValidations(config) {
    // These will be checked when adding/selecting vehicles
    window.VEHICLE_VALIDATION_RULES = {
      driverLicense: config.requireDriverLicense,
      insurance: config.requireInsurance,
      insuranceMinimum: config.insuranceMinimum
    };
  }

  /**
   * Get currency symbol
   */
  getCurrencySymbol(currency) {
    const symbols = {
      'USD': '$',
      'EUR': '€',
      'GBP': '£',
      'CAD': '$',
      'AUD': '$',
      'JPY': '¥',
      'CNY': '¥'
    };
    return symbols[currency] || currency;
  }
}

// Make globally available
window.SettingsApplicationManager = SettingsApplicationManager;

// Auto-initialize on DOMContentLoaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.settingsApplicationManager = new SettingsApplicationManager();
  });
} else {
  window.settingsApplicationManager = new SettingsApplicationManager();
}
