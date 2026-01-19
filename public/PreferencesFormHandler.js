/**
 * PreferencesFormHandler.js
 * 
 * Handles the old company preferences form sections and syncs them with CompanySettingsManager.
 * This bridges the legacy form inputs with the new centralized settings system.
 */

class PreferencesFormHandler {
  constructor() {
    this.settingsManager = null;
    this.init();
  }

  /**
   * Initialize the handler
   */
  async init() {
    console.log('[PreferencesFormHandler] Initializing...');
    
    // Wait for CompanySettingsManager to be available (with timeout)
    let attempts = 0;
    const maxAttempts = 100; // 10 seconds
    
    while (!window.CompanySettingsManager && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
      if (attempts % 10 === 0) {
        console.log(`[PreferencesFormHandler] Waiting for CompanySettingsManager... (${attempts * 100}ms)`);
      }
    }

    if (window.CompanySettingsManager) {
      console.log('[PreferencesFormHandler] CompanySettingsManager found, creating instance');
      this.settingsManager = new window.CompanySettingsManager();
      this.setupEventListeners();
      console.log('[PreferencesFormHandler] Initialization complete - event listeners attached');
    } else {
      console.error('[PreferencesFormHandler] CompanySettingsManager not found after 10s timeout');
      console.log('[PreferencesFormHandler] Available globals:', Object.keys(window).filter(k => k.includes('Settings') || k.includes('Preferences')));
    }
  }

  /**
   * Setup event listeners for all preference update buttons
   */
  setupEventListeners() {
    const buttons = [
      'updateGeneralPrefsBtn',
      'updateFormsReportsPrefsBtn',
      'updateAccountsCalendarPrefsBtn',
      'updateReservationsPrefsBtn',
      'updateSettleReceivablesPrefsBtn'
    ];

    console.log('[PreferencesFormHandler] Setting up event listeners for', buttons.length, 'buttons');

    buttons.forEach(buttonId => {
      const btn = document.getElementById(buttonId);
      console.log(`[PreferencesFormHandler] Button "${buttonId}":`, btn ? 'FOUND' : 'NOT FOUND');
      
      if (btn) {
        btn.addEventListener('click', (e) => {
          console.log(`[PreferencesFormHandler] Clicked button: ${buttonId}`);
          e.preventDefault();
          this.handleUpdateClick(buttonId);
        });
        console.log(`[PreferencesFormHandler] Event listener attached to ${buttonId}`);
      }
    });
  }

  /**
   * Handle update button click
   */
  handleUpdateClick(buttonId) {
    console.log(`[PreferencesFormHandler] ========== HANDLE UPDATE CLICK FOR ${buttonId} ==========`);
    console.log(`[PreferencesFormHandler] Button: ${buttonId}`);
    
    try {
      const formData = this.collectFormData(buttonId);
      console.log(`[PreferencesFormHandler] ===== FORM DATA COLLECTED =====`);
      console.log(`[PreferencesFormHandler] Full formData object:`, formData);
      console.log(`[PreferencesFormHandler] defaultStartPage in formData?`, 'defaultStartPage' in formData);
      console.log(`[PreferencesFormHandler] defaultStartPage value:`, formData.defaultStartPage);
      
      if (Object.keys(formData).length === 0) {
        console.log('[PreferencesFormHandler] No form data collected');
        this.showNotification('No changes detected', 'info');
        return;
      }

      console.log('[PreferencesFormHandler] ===== UPDATING SETTINGS MANAGER =====');
      console.log('[PreferencesFormHandler] About to call updateSettings with:', formData);
      const updateResult = this.settingsManager.updateSettings(formData);
      console.log('[PreferencesFormHandler] updateSettings returned:', updateResult);
      
      // Verify settings were actually saved
      const verifyStartPage = this.settingsManager.getSetting('defaultStartPage');
      console.log('[PreferencesFormHandler] ===== VERIFICATION =====');
      console.log('[PreferencesFormHandler] Read back defaultStartPage from manager:', verifyStartPage);
      console.log('[PreferencesFormHandler] Settings successfully updated');
      
      // Log full settings
      const allSettings = this.settingsManager.getAllSettings();
      console.log('[PreferencesFormHandler] All current settings:', allSettings);
      
      this.showNotification('Preferences updated successfully!', 'success');
      
      // Also update the centralized settings UI if it exists
      if (window.companySettingsUI) {
        console.log('[PreferencesFormHandler] Reloading companySettingsUI');
        window.companySettingsUI.loadSettings();
      }
    } catch (error) {
      console.error('[PreferencesFormHandler] Error updating preferences:', error);
      this.showNotification('Error updating preferences: ' + error.message, 'error');
    }
  }

  /**
   * Collect form data from the preference section
   */
  collectFormData(buttonId) {
    const formData = {};
    
    // Map button IDs to their section containers
    const sectionMap = {
      'updateGeneralPrefsBtn': 'general-prefs',
      'updateFormsReportsPrefsBtn': 'forms-reports-prefs',
      'updateAccountsCalendarPrefsBtn': 'accounts-calendar-prefs',
      'updateReservationsPrefsBtn': 'reservations-prefs',
      'updateSettleReceivablesPrefsBtn': 'settle-receivables-prefs'
    };

    const sectionId = sectionMap[buttonId];
    console.log(`[PreferencesFormHandler] Looking for section: ${sectionId}`);
    
    if (!sectionId) {
      console.warn(`[PreferencesFormHandler] No section mapped for button ${buttonId}`);
      return formData;
    }

    // Special field ID mappings for more reliable capture
    const fieldIdMap = {
      'myStartPage': 'defaultStartPage',
      'myTimeZone': 'defaultTimeZone'
    };

    // Try to get fields by ID first (for known fields)
    Object.entries(fieldIdMap).forEach(([fieldId, settingKey]) => {
      const element = document.getElementById(fieldId);
      if (element) {
        const value = element.value;
        formData[settingKey] = value;
        console.log(`[PreferencesFormHandler] ✅ Found by ID "${fieldId}": "${settingKey}" = "${value}"`);
      }
    });

    // If we got the startup page setting, log success and return
    if (formData.defaultStartPage) {
      console.log('[PreferencesFormHandler] ✅ Successfully collected defaultStartPage:', formData);
      return formData;
    }

    // Fallback: Try to get from form groups in the section
    const section = document.getElementById(sectionId);
    console.log(`[PreferencesFormHandler] Section found:`, section ? 'YES' : 'NO');
    
    if (!section) {
      console.warn(`[PreferencesFormHandler] Section ${sectionId} not found in DOM`);
      return formData;
    }

    // Special mapping for known field labels to correct setting keys
    const labelToKeyMap = {
      'my start page': 'defaultStartPage',
      'my time zone': 'defaultTimeZone',
      'default date format': 'defaultDateFormat',
      'default time format': 'defaultTimeFormat',
      'default reservation type': 'defaultReservationType'
    };

    // Collect form-group data
    const formGroups = section.querySelectorAll('.form-group');
    console.log(`[PreferencesFormHandler] Found ${formGroups.length} form groups in section`);
    
    formGroups.forEach((group, index) => {
      const label = group.querySelector('label');
      const input = group.querySelector('input, select, textarea');
      
      if (label && input) {
        // Get label text
        const labelText = label.textContent.trim();
        const labelLower = labelText.toLowerCase().replace(/:.*$/, '').trim();
        
        console.log(`[PreferencesFormHandler] Processing field ${index}:`, {
          rawLabel: labelText,
          cleanLabel: labelLower,
          inputType: input.tagName,
          inputValue: input.value
        });
        
        // Check if this label has a special mapping
        let key = labelToKeyMap[labelLower];
        
        // If not in special map, generate key from label text
        if (!key) {
          key = labelLower.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        }
        
        if (key && input && !formData[key]) {
          let value;
          if (input.type === 'checkbox') {
            value = input.checked;
          } else if (input.type === 'number') {
            value = parseFloat(input.value) || 0;
          } else {
            value = input.value;
          }
          
          formData[key] = value;
          console.log(`[PreferencesFormHandler] ✅ ADDED: "${labelLower}" -> key "${key}" = "${value}"`);
        }
      }
    });

    return formData;
  }

  /**
   * Show notification message
   */
  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `preferences-notification preferences-notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      background: ${type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : '#2196f3'};
      color: white;
      border-radius: 4px;
      z-index: 10000;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      animation: slideIn 0.3s ease;
      font-size: 13px;
      font-weight: 500;
    `;

    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
  }
}

// Initialize the handler when DOM is ready
console.log('[PreferencesFormHandler] Script loaded, readyState:', document.readyState);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('[PreferencesFormHandler] DOMContentLoaded event fired');
    window.preferencesFormHandler = new PreferencesFormHandler();
  });
} else {
  console.log('[PreferencesFormHandler] DOM already loaded, initializing now');
  window.preferencesFormHandler = new PreferencesFormHandler();
}
