/**
 * CompanySettingsUI.js
 * 
 * Handles the UI display and interaction for company settings in the my-office page.
 * Integrates CompanySettingsManager with HTML forms and provides save/load/import/export functionality.
 */

class CompanySettingsUI {
  constructor() {
    this.settingsManager = new CompanySettingsManager();
    this.formDirty = false;
    this.currentSettings = {};
    this.init();
  }

  /**
   * Initialize the settings UI
   */
  init() {
    this.loadSettings();
    this.setupEventListeners();
    this.renderSettingsTable();
  }

  /**
   * Load settings from manager and populate form
   */
  loadSettings() {
    this.currentSettings = this.settingsManager.getAllSettings();
    this.populateForm();
  }

  /**
   * Populate form inputs with current settings values
   */
  populateForm() {
    const categorySettings = this.settingsManager.getSettingsByCategory();

    Object.entries(categorySettings).forEach(([categoryKey, categoryData]) => {
      const category = categoryData.settings;
      
      Object.entries(category).forEach(([key, setting]) => {
        const inputId = `setting-${key}`;
        const input = document.getElementById(inputId);
        
        if (input && this.currentSettings[key] !== undefined) {
          const value = this.currentSettings[key];
          
          if (input.type === 'checkbox') {
            input.checked = value === true || value === 'yes' || value === 'true';
          } else if (input.type === 'number') {
            input.value = Number(value);
          } else {
            input.value = value;
          }

          // Remove dirty class on initial load
          input.classList.remove('input-dirty');
        }
      });
    });

    this.formDirty = false;
    this.updateSaveButtonState();
  }

  /**
   * Setup event listeners for form inputs and action buttons
   */
  setupEventListeners() {
    // Listen to all setting inputs for changes
    const inputs = document.querySelectorAll('[id^="setting-"]');
    inputs.forEach(input => {
      input.addEventListener('change', (e) => this.handleInputChange(e));
      input.addEventListener('input', (e) => this.handleInputChange(e));
    });

    // Setup category expand/collapse
    const categoryHeaders = document.querySelectorAll('.settings-category-header');
    categoryHeaders.forEach((header, index) => {
      header.addEventListener('click', () => {
        const category = header.closest('.settings-category');
        category.classList.toggle('expanded');
      });
      
      // Expand first category by default
      if (index === 0) {
        header.closest('.settings-category').classList.add('expanded');
      }
    });

    // Action buttons
    const saveBtn = document.getElementById('settings-save-btn');
    const resetBtn = document.getElementById('settings-reset-btn');
    const exportBtn = document.getElementById('settings-export-btn');
    const importBtn = document.getElementById('settings-import-btn');

    if (saveBtn) saveBtn.addEventListener('click', () => this.saveSettings());
    if (resetBtn) resetBtn.addEventListener('click', () => this.resetSettings());
    if (exportBtn) exportBtn.addEventListener('click', () => this.exportSettings());
    if (importBtn) importBtn.addEventListener('click', () => this.importSettings());
  }

  /**
   * Handle input change - mark form as dirty
   */
  handleInputChange(e) {
    const input = e.target;
    const originalValue = this.currentSettings[input.id.replace('setting-', '')];
    const currentValue = input.type === 'checkbox' ? input.checked : input.value;
    
    if (String(originalValue) !== String(currentValue)) {
      input.classList.add('input-dirty');
      this.formDirty = true;
    } else {
      input.classList.remove('input-dirty');
    }
    
    this.updateSaveButtonState();
  }

  /**
   * Update save button state based on form dirty status
   */
  updateSaveButtonState() {
    const saveBtn = document.getElementById('settings-save-btn');
    if (saveBtn) {
      saveBtn.disabled = !this.formDirty;
      saveBtn.style.opacity = this.formDirty ? '1' : '0.5';
    }
  }

  /**
   * Collect form data and save to manager
   */
  async saveSettings() {
    const formData = {};
    const inputs = document.querySelectorAll('[id^="setting-"]');
    
    inputs.forEach(input => {
      const key = input.id.replace('setting-', '');
      const value = input.type === 'checkbox' ? input.checked : input.value;
      formData[key] = value;
    });

    try {
      this.settingsManager.updateSettings(formData);
      const supabaseResult = await this.settingsManager.saveSettingsToSupabase();
      this.currentSettings = this.settingsManager.getAllSettings();
      this.populateForm();
      
      // Show success message reflecting remote/local status
      if (supabaseResult?.success) {
        this.showNotification('Settings saved locally and synced to cloud.', 'success');
      } else {
        this.showNotification('Settings saved locally. Cloud sync failed; try re-auth or retry.', 'warning');
      }
      this.formDirty = false;
      this.updateSaveButtonState();
    } catch (error) {
      this.showNotification('Error saving settings: ' + error.message, 'error');
    }
  }

  /**
   * Reset settings to last saved state
   */
  resetSettings() {
    if (this.formDirty) {
      if (confirm('You have unsaved changes. Discard them?')) {
        this.loadSettings();
        this.showNotification('Settings reset to last saved state', 'info');
      }
    } else {
      this.showNotification('No unsaved changes', 'info');
    }
  }

  /**
   * Reset to default settings
   */
  resetToDefaults() {
    if (confirm('Reset all settings to defaults? This cannot be undone.')) {
      try {
        this.settingsManager.resetToDefaults();
        this.currentSettings = this.settingsManager.getAllSettings();
        this.populateForm();
        this.showNotification('Settings reset to defaults!', 'success');
      } catch (error) {
        this.showNotification('Error: ' + error.message, 'error');
      }
    }
  }

  /**
   * Export settings as JSON file
   */
  exportSettings() {
    try {
      const exported = this.settingsManager.exportSettings();
      const blob = new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `company-settings-${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
      this.showNotification('Settings exported successfully!', 'success');
    } catch (error) {
      this.showNotification('Error exporting settings: ' + error.message, 'error');
    }
  }

  /**
   * Import settings from JSON file
   */
  importSettings() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const imported = JSON.parse(event.target.result);
            if (confirm('Import these settings? Current settings will be overwritten.')) {
              this.settingsManager.importSettings(imported);
              this.currentSettings = this.settingsManager.getAllSettings();
              this.populateForm();
              this.showNotification('Settings imported successfully!', 'success');
            }
          } catch (error) {
            this.showNotification('Error importing settings: ' + error.message, 'error');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  }

  /**
   * Render comprehensive settings table
   */
  renderSettingsTable() {
    const container = document.getElementById('settings-table-container');
    if (!container) return;

    const categorySettings = this.settingsManager.getSettingsByCategory();
    let html = '';

    Object.entries(categorySettings).forEach(([categoryKey, categoryData]) => {
      html += this.renderCategory(categoryKey, categoryData);
    });

    container.innerHTML = html;
    
    // Re-setup event listeners after rendering
    setTimeout(() => this.setupEventListeners(), 0);
  }

  /**
   * Render a single settings category
   */
  renderCategory(categoryKey, categoryData) {
    const settings = categoryData.settings;
    let html = `
      <div class="settings-category" data-category="${categoryKey}">
        <div class="settings-category-header">
          <h3>${categoryData.label}</h3>
        </div>
        <div class="settings-category-content">
          <div class="settings-grid">
    `;

    Object.entries(settings).forEach(([settingKey, setting]) => {
      html += this.renderSettingField(settingKey, setting);
    });

    html += `
          </div>
        </div>
      </div>
    `;

    return html;
  }

  /**
   * Render a single setting field
   */
  renderSettingField(key, setting) {
    const inputId = `setting-${key}`;
    const value = this.currentSettings[key] || setting.default || '';

    let fieldHtml = `
      <div class="settings-field">
        <label for="${inputId}">${setting.label}</label>
    `;

    // Render appropriate input type
    switch (setting.type) {
      case 'text':
      case 'email':
      case 'tel':
      case 'url':
        fieldHtml += `<input type="${setting.type}" id="${inputId}" class="form-control settings-input" value="${this.escapeHtml(value)}" />`;
        break;

      case 'number':
        fieldHtml += `<input type="number" id="${inputId}" class="form-control settings-input" value="${value}" min="${setting.min || 0}" max="${setting.max || ''}" />`;
        break;

      case 'checkbox':
        const checked = value === true || value === 'yes' || value === 'true' ? 'checked' : '';
        fieldHtml += `<input type="checkbox" id="${inputId}" class="form-control settings-input" ${checked} />`;
        break;

      case 'select':
        fieldHtml += `
          <select id="${inputId}" class="form-control settings-input">
            ${setting.options.map(opt => 
              `<option value="${opt.value}" ${opt.value === value ? 'selected' : ''}>${opt.label}</option>`
            ).join('')}
          </select>
        `;
        break;

      case 'textarea':
        fieldHtml += `<textarea id="${inputId}" class="form-control settings-input" rows="4">${this.escapeHtml(value)}</textarea>`;
        break;

      default:
        fieldHtml += `<input type="text" id="${inputId}" class="form-control settings-input" value="${this.escapeHtml(value)}" />`;
    }

    if (setting.description) {
      fieldHtml += `<small class="settings-description">${setting.description}</small>`;
    }

    fieldHtml += `</div>`;
    return fieldHtml;
  }

  /**
   * Show notification message
   */
  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `settings-notification settings-notification-${type}`;
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
    `;

    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
  }

  /**
   * Escape HTML special characters
   */
  escapeHtml(text) {
    if (!text) return '';
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
  }
}

// Make class globally available
window.CompanySettingsUI = CompanySettingsUI;

// Initialize UI when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.companySettingsUI = new CompanySettingsUI();
  });
} else {
  window.companySettingsUI = new CompanySettingsUI();
}
