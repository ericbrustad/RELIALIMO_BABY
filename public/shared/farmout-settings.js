/**
 * Farmout Automation Settings Manager
 * Handles loading, saving, and UI interaction for farmout automation configuration
 */

class FarmoutSettingsManager {
    constructor() {
        this.settings = {};
        this.customOptions = [];
        this.activeTextarea = null;
        this.init();
    }

    async init() {
        await this.loadSettings();
        this.bindEvents();
        this.updateAllCharCounts();
        this.updateWindowPreview();
        this.updatePayPreview();
    }

    /**
     * Load settings from Supabase or localStorage
     */
    async loadSettings() {
        try {
            // Try Supabase first
            if (typeof supabase !== 'undefined') {
                const { data, error } = await supabase.rpc('get_farmout_settings', {
                    p_organization_id: this.getOrganizationId()
                });
                
                if (!error && data) {
                    this.settings = data;
                    this.applySettingsToUI(data);
                    return;
                }
            }
        } catch (e) {
            console.log('[FarmoutSettings] Supabase not available, using localStorage');
        }

        // Fall back to localStorage
        const stored = localStorage.getItem('farmout_settings');
        if (stored) {
            try {
                this.settings = JSON.parse(stored);
                this.applySettingsToUI(this.settings);
            } catch (e) {
                console.error('[FarmoutSettings] Error parsing stored settings:', e);
            }
        }
    }

    /**
     * Get organization ID from auth context
     */
    getOrganizationId() {
        try {
            const authData = JSON.parse(localStorage.getItem('relialimo_auth') || '{}');
            return authData.organizationId || null;
        } catch (e) {
            return null;
        }
    }

    /**
     * Apply settings to UI controls
     */
    applySettingsToUI(settings) {
        // Feature toggles
        this.setCheckbox('enableDriverRatingPriority', settings.enable_driver_rating_priority);
        this.setCheckbox('enableServiceAreaMatching', settings.enable_service_area_matching);
        this.setCheckbox('enableVehicleTypeMatching', settings.enable_vehicle_type_matching);
        this.setCheckbox('enableOnDemandPriority', settings.enable_on_demand_priority);
        this.setCheckbox('enableSmsOffers', settings.enable_sms_offers);
        this.setCheckbox('enableInAppOffers', settings.enable_in_app_offers);
        this.setCheckbox('enableAutoEscalation', settings.enable_auto_escalation);

        // Timing settings
        this.setValue('offerTimeoutMinutes', settings.offer_timeout_minutes);
        this.setValue('driverRetryCadenceMinutes', settings.driver_retry_cadence_minutes || settings.offer_timeout_minutes || 15);
        this.setValue('driverCooldownHours', settings.driver_cooldown_hours);
        this.setValue('offerSpacingMinutes', settings.offer_spacing_minutes);
        this.setValue('onDemandThresholdMinutes', settings.on_demand_threshold_minutes);
        this.setValue('escalateAfterAttempts', settings.escalate_to_admin_after_attempts);

        // Time window
        this.setValue('offerWindowStart', this.formatTimeForInput(settings.offer_window_start));
        this.setValue('offerWindowEnd', this.formatTimeForInput(settings.offer_window_end));

        // Pay settings
        this.setValue('driverPayPercentage', settings.driver_pay_percentage);

        // Admin notifications
        this.setValue('adminNotificationEmail', settings.admin_notification_email);
        this.setValue('adminNotificationSms', settings.admin_notification_sms);

        // SMS templates
        this.setValue('smsOfferTemplate', settings.sms_offer_template);
        this.setValue('smsConfirmationTemplate', settings.sms_confirmation_template);
        this.setValue('smsRejectionTemplate', settings.sms_rejection_template);
        this.setValue('smsExpiryTemplate', settings.sms_expiry_template);

        // Custom options
        if (settings.custom_options && Array.isArray(settings.custom_options)) {
            this.customOptions = settings.custom_options;
            this.renderCustomOptions();
        }
    }

    /**
     * Collect settings from UI
     */
    collectSettingsFromUI() {
        return {
            // Feature toggles
            enable_driver_rating_priority: this.getCheckbox('enableDriverRatingPriority'),
            enable_service_area_matching: this.getCheckbox('enableServiceAreaMatching'),
            enable_vehicle_type_matching: this.getCheckbox('enableVehicleTypeMatching'),
            enable_on_demand_priority: this.getCheckbox('enableOnDemandPriority'),
            enable_sms_offers: this.getCheckbox('enableSmsOffers'),
            enable_in_app_offers: this.getCheckbox('enableInAppOffers'),
            enable_auto_escalation: this.getCheckbox('enableAutoEscalation'),

            // Timing settings
            offer_timeout_minutes: parseInt(this.getValue('offerTimeoutMinutes')) || 15,
            driver_cooldown_hours: parseInt(this.getValue('driverCooldownHours')) || 24,
            offer_spacing_minutes: parseInt(this.getValue('offerSpacingMinutes')) || 2,
            on_demand_threshold_minutes: parseInt(this.getValue('onDemandThresholdMinutes')) || 120,
            escalate_to_admin_after_attempts: parseInt(this.getValue('escalateAfterAttempts')) || 10,

            // Time window
            offer_window_start: this.getValue('offerWindowStart') || '08:00',
            offer_window_end: this.getValue('offerWindowEnd') || '21:00',

            // Pay settings
            driver_pay_percentage: parseFloat(this.getValue('driverPayPercentage')) || 70,

            // Admin notifications
            admin_notification_email: this.getValue('adminNotificationEmail') || '',
            admin_notification_sms: this.getValue('adminNotificationSms') || '',

            // SMS templates
            sms_offer_template: this.getValue('smsOfferTemplate') || '',
            sms_confirmation_template: this.getValue('smsConfirmationTemplate') || '',
            sms_rejection_template: this.getValue('smsRejectionTemplate') || '',
            sms_expiry_template: this.getValue('smsExpiryTemplate') || '',

            // Custom options
            custom_options: this.customOptions
        };
    }

    /**
     * Save settings to Supabase and localStorage
     */
    async saveSettings() {
        const settings = this.collectSettingsFromUI();
        this.settings = settings;

        // Always save to localStorage
        localStorage.setItem('farmout_settings', JSON.stringify(settings));

        // Dispatch event for FarmoutAutomationService
        window.dispatchEvent(new CustomEvent('farmoutSettingsUpdated', { detail: settings }));

        // Try to save to Supabase
        try {
            if (typeof supabase !== 'undefined') {
                const { data, error } = await supabase.rpc('save_farmout_settings', {
                    p_organization_id: this.getOrganizationId(),
                    p_settings: settings
                });

                if (error) {
                    console.error('[FarmoutSettings] Supabase save error:', error);
                    this.showToast('Settings saved locally (database sync failed)', 'warning');
                    return;
                }
            }
        } catch (e) {
            console.log('[FarmoutSettings] Supabase not available, saved to localStorage only');
        }

        this.showToast('Settings saved successfully!', 'success');
    }

    /**
     * Set Driver Retry Cadence with acknowledgment
     */
    async setRetryCadence() {
        const input = document.getElementById('driverRetryCadenceMinutes');
        const ackEl = document.getElementById('retryCadenceAck');
        const valueEl = document.getElementById('retryCadenceValue');
        
        if (!input) return;
        
        const minutes = parseInt(input.value, 10);
        if (isNaN(minutes) || minutes < 1 || minutes > 120) {
            this.showToast('Please enter a value between 1 and 120 minutes', 'error');
            return;
        }
        
        // Save this specific setting
        this.settings.driver_retry_cadence_minutes = minutes;
        
        // Also update the dispatch interval in localStorage for FarmoutAutomationService
        try {
            const automationSettings = JSON.parse(localStorage.getItem('relia_farmout_automation_settings') || '{}');
            automationSettings.dispatchIntervalMinutes = minutes;
            localStorage.setItem('relia_farmout_automation_settings', JSON.stringify(automationSettings));
        } catch (e) {
            console.warn('[FarmoutSettings] Could not update automation settings:', e);
        }
        
        // Save to localStorage/Supabase
        localStorage.setItem('farmout_settings', JSON.stringify(this.settings));
        
        // Dispatch event for FarmoutAutomationService
        window.dispatchEvent(new CustomEvent('farmoutSettingsUpdated', { 
            detail: { ...this.settings, offer_timeout_minutes: minutes }
        }));
        
        // Show acknowledgment
        if (ackEl && valueEl) {
            valueEl.textContent = minutes;
            ackEl.style.display = 'flex';
            
            // Hide after 5 seconds
            setTimeout(() => {
                ackEl.style.display = 'none';
            }, 5000);
        }
        
        this.showToast(`Driver retry cadence set to ${minutes} minutes`, 'success');
    }

    /**
     * Reset to default settings
     */
    resetToDefaults() {
        if (!confirm('Are you sure you want to reset all settings to defaults?')) {
            return;
        }

        const defaults = {
            enable_driver_rating_priority: true,
            enable_service_area_matching: true,
            enable_vehicle_type_matching: true,
            enable_on_demand_priority: true,
            enable_sms_offers: true,
            enable_in_app_offers: true,
            enable_auto_escalation: true,
            offer_timeout_minutes: 15,
            driver_retry_cadence_minutes: 15,
            driver_cooldown_hours: 24,
            offer_spacing_minutes: 2,
            on_demand_threshold_minutes: 120,
            escalate_to_admin_after_attempts: 10,
            offer_window_start: '08:00',
            offer_window_end: '21:00',
            driver_pay_percentage: 70,
            admin_notification_email: '',
            admin_notification_sms: '',
            sms_offer_template: 'Hi {driver_first_name}, new trip available! {pickup_city} to {dropoff_city} on {pickup_date} at {pickup_time}. Pay: ${pay_amount}. Reply Y to accept or N to decline. Details: {trip_request_url} - Expires in {timeout_minutes} min.',
            sms_confirmation_template: 'Confirmed! Trip #{reservation_id} on {pickup_date}. Pickup: {pickup_address} at {pickup_time}. Passenger: {passenger_name}. Full details in app.',
            sms_rejection_template: 'No worries! The trip has been offered to another driver.',
            sms_expiry_template: 'The offer for {pickup_city} to {dropoff_city} on {pickup_date} has expired.',
            custom_options: []
        };

        this.applySettingsToUI(defaults);
        this.customOptions = [];
        this.renderCustomOptions();
        this.updateAllCharCounts();
        this.updateWindowPreview();
        this.updatePayPreview();
        this.showToast('Settings reset to defaults', 'success');
    }

    /**
     * Bind all event listeners
     */
    bindEvents() {
        // Save button
        document.getElementById('saveSettings')?.addEventListener('click', () => this.saveSettings());

        // Reset button
        document.getElementById('resetDefaults')?.addEventListener('click', () => this.resetToDefaults());

        // Driver Retry Cadence Set button
        document.getElementById('setRetryCadence')?.addEventListener('click', () => this.setRetryCadence());

        // Time window changes
        document.getElementById('offerWindowStart')?.addEventListener('change', () => this.updateWindowPreview());
        document.getElementById('offerWindowEnd')?.addEventListener('change', () => this.updateWindowPreview());

        // Pay percentage changes
        document.getElementById('driverPayPercentage')?.addEventListener('input', () => this.updatePayPreview());

        // SMS template character counts
        ['smsOfferTemplate', 'smsConfirmationTemplate', 'smsRejectionTemplate', 'smsExpiryTemplate'].forEach(id => {
            const textarea = document.getElementById(id);
            if (textarea) {
                textarea.addEventListener('input', () => this.updateCharCount(id));
                textarea.addEventListener('focus', () => { this.activeTextarea = textarea; });
            }
        });

        // Tag clicks
        document.getElementById('tagList')?.addEventListener('click', (e) => {
            if (e.target.classList.contains('tag')) {
                this.insertTag(e.target.dataset.tag);
            }
        });

        // Custom options
        document.getElementById('addCustomOption')?.addEventListener('click', () => this.openCustomOptionModal());
        document.getElementById('closeModal')?.addEventListener('click', () => this.closeCustomOptionModal());
        document.getElementById('cancelCustomOption')?.addEventListener('click', () => this.closeCustomOptionModal());
        document.getElementById('saveCustomOption')?.addEventListener('click', () => this.saveCustomOption());
        document.getElementById('customOptionType')?.addEventListener('change', (e) => this.handleOptionTypeChange(e.target.value));

        // Modal backdrop click
        document.getElementById('customOptionModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'customOptionModal') {
                this.closeCustomOptionModal();
            }
        });
    }

    /**
     * Insert a tag at cursor position in active textarea
     */
    insertTag(tag) {
        if (!this.activeTextarea) {
            this.showToast('Click on a template field first', 'error');
            return;
        }

        const textarea = this.activeTextarea;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;

        textarea.value = text.substring(0, start) + tag + text.substring(end);
        textarea.selectionStart = textarea.selectionEnd = start + tag.length;
        textarea.focus();

        // Trigger input event for character count update
        textarea.dispatchEvent(new Event('input'));
    }

    /**
     * Update character count for a template textarea
     */
    updateCharCount(textareaId) {
        const textarea = document.getElementById(textareaId);
        const countEl = document.getElementById(textareaId.replace('sms', '').replace('Template', 'CharCount').toLowerCase() + 'CharCount')
            || document.getElementById(textareaId.replace('Template', 'CharCount').replace('sms', '').charAt(0).toLowerCase() + textareaId.replace('Template', 'CharCount').replace('sms', '').slice(1));
        
        // Try different ID patterns
        const countIds = [
            textareaId.replace('sms', '').replace('Template', 'CharCount').toLowerCase(),
            textareaId.replace('Template', 'CharCount')
        ];

        let countElement = null;
        for (const id of countIds) {
            countElement = document.querySelector(`[id$="CharCount"]`);
            if (countElement && countElement.closest('.template-group')?.querySelector(`#${textareaId}`)) {
                break;
            }
        }

        // Find count element by looking at parent
        const parent = textarea?.closest('.template-group');
        countElement = parent?.querySelector('.char-count');

        if (textarea && countElement) {
            const length = textarea.value.length;
            const max = 160;
            countElement.textContent = `${length}/${max}`;
            
            countElement.classList.remove('warning', 'danger');
            if (length > 160) {
                countElement.classList.add('danger');
            } else if (length > 140) {
                countElement.classList.add('warning');
            }
        }
    }

    /**
     * Update all character counts
     */
    updateAllCharCounts() {
        ['smsOfferTemplate', 'smsConfirmationTemplate', 'smsRejectionTemplate', 'smsExpiryTemplate'].forEach(id => {
            this.updateCharCount(id);
        });
    }

    /**
     * Update the visual offer window preview
     */
    updateWindowPreview() {
        const start = this.getValue('offerWindowStart') || '08:00';
        const end = this.getValue('offerWindowEnd') || '21:00';

        const startMinutes = this.timeToMinutes(start);
        const endMinutes = this.timeToMinutes(end);
        const totalMinutes = 24 * 60;

        const startPercent = (startMinutes / totalMinutes) * 100;
        const endPercent = (endMinutes / totalMinutes) * 100;
        const widthPercent = endPercent - startPercent;

        const activeBar = document.getElementById('windowActiveBar');
        if (activeBar) {
            activeBar.style.marginLeft = `${startPercent}%`;
            activeBar.style.width = `${Math.max(0, widthPercent)}%`;
        }
    }

    /**
     * Update the pay preview example
     */
    updatePayPreview() {
        const percentage = parseFloat(this.getValue('driverPayPercentage')) || 70;
        const exampleTrip = 200;
        const driverPay = (exampleTrip * percentage / 100).toFixed(0);

        const payAmount = document.getElementById('payPreviewAmount');
        if (payAmount) {
            payAmount.textContent = `$${driverPay} driver pay`;
        }
    }

    /**
     * Open custom option modal
     */
    openCustomOptionModal() {
        document.getElementById('customOptionModal')?.classList.remove('hidden');
        document.getElementById('customOptionKey').value = '';
        document.getElementById('customOptionLabel').value = '';
        document.getElementById('customOptionType').value = 'number';
        document.getElementById('customOptionDefault').value = '';
        document.getElementById('customOptionSelectOptions').value = '';
        this.handleOptionTypeChange('number');
    }

    /**
     * Close custom option modal
     */
    closeCustomOptionModal() {
        document.getElementById('customOptionModal')?.classList.add('hidden');
    }

    /**
     * Handle option type change to show/hide relevant fields
     */
    handleOptionTypeChange(type) {
        const defaultGroup = document.getElementById('customOptionDefaultGroup');
        const selectGroup = document.getElementById('customOptionSelectGroup');

        if (type === 'select') {
            selectGroup?.classList.remove('hidden');
        } else {
            selectGroup?.classList.add('hidden');
        }
    }

    /**
     * Save a custom option
     */
    saveCustomOption() {
        const key = document.getElementById('customOptionKey')?.value?.trim();
        const label = document.getElementById('customOptionLabel')?.value?.trim();
        const type = document.getElementById('customOptionType')?.value;
        const defaultValue = document.getElementById('customOptionDefault')?.value?.trim();
        const selectOptions = document.getElementById('customOptionSelectOptions')?.value?.trim();

        if (!key || !label) {
            this.showToast('Key and Label are required', 'error');
            return;
        }

        // Validate key format
        if (!/^[a-z][a-z0-9_]*$/.test(key)) {
            this.showToast('Key must start with letter and contain only lowercase letters, numbers, and underscores', 'error');
            return;
        }

        // Check for duplicate key
        if (this.customOptions.some(opt => opt.key === key)) {
            this.showToast('An option with this key already exists', 'error');
            return;
        }

        const option = {
            key,
            label,
            type,
            value: type === 'boolean' ? false : (defaultValue || ''),
            options: type === 'select' ? selectOptions.split(',').map(o => o.trim()).filter(Boolean) : []
        };

        this.customOptions.push(option);
        this.renderCustomOptions();
        this.closeCustomOptionModal();
        this.showToast('Custom option added', 'success');
    }

    /**
     * Render custom options list
     */
    renderCustomOptions() {
        const container = document.getElementById('customOptionsList');
        if (!container) return;

        container.innerHTML = '';

        this.customOptions.forEach((option, index) => {
            const item = document.createElement('div');
            item.className = 'custom-option-item';
            item.innerHTML = `
                <span class="option-label">${option.label}</span>
                ${this.renderCustomOptionInput(option, index)}
                <button type="button" class="delete-option" data-index="${index}" title="Delete">×</button>
            `;
            container.appendChild(item);
        });

        // Bind delete buttons
        container.querySelectorAll('.delete-option').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.deleteCustomOption(index);
            });
        });

        // Bind input changes
        container.querySelectorAll('.custom-option-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const index = parseInt(e.target.dataset.index);
                const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
                this.customOptions[index].value = value;
            });
        });
    }

    /**
     * Render input for a custom option
     */
    renderCustomOptionInput(option, index) {
        switch (option.type) {
            case 'boolean':
                return `<input type="checkbox" class="custom-option-input" data-index="${index}" ${option.value ? 'checked' : ''}>`;
            case 'select':
                const options = option.options.map(o => 
                    `<option value="${o}" ${option.value === o ? 'selected' : ''}>${o}</option>`
                ).join('');
                return `<select class="custom-option-input" data-index="${index}">${options}</select>`;
            case 'text':
                return `<input type="text" class="custom-option-input" data-index="${index}" value="${option.value || ''}">`;
            case 'number':
            default:
                return `<input type="number" class="custom-option-input" data-index="${index}" value="${option.value || ''}">`;
        }
    }

    /**
     * Delete a custom option
     */
    deleteCustomOption(index) {
        if (confirm('Delete this custom option?')) {
            this.customOptions.splice(index, 1);
            this.renderCustomOptions();
        }
    }

    /**
     * Show toast notification
     */
    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        const toastMessage = document.getElementById('toastMessage');

        if (toast && toastMessage) {
            toast.className = `toast ${type}`;
            toastMessage.textContent = message;
            toast.classList.remove('hidden');

            setTimeout(() => {
                toast.classList.add('hidden');
            }, 3000);
        }
    }

    // Utility methods
    setValue(id, value) {
        const el = document.getElementById(id);
        if (el && value !== undefined && value !== null) {
            el.value = value;
        }
    }

    getValue(id) {
        return document.getElementById(id)?.value || '';
    }

    setCheckbox(id, checked) {
        const el = document.getElementById(id);
        if (el) {
            el.checked = checked !== false;
        }
    }

    getCheckbox(id) {
        return document.getElementById(id)?.checked || false;
    }

    formatTimeForInput(timeStr) {
        if (!timeStr) return '08:00';
        // Handle various formats: "08:00:00", "08:00", "8:00"
        const match = timeStr.match(/(\d{1,2}):(\d{2})/);
        if (match) {
            return `${match[1].padStart(2, '0')}:${match[2]}`;
        }
        return '08:00';
    }

    timeToMinutes(timeStr) {
        const [hours, minutes] = (timeStr || '00:00').split(':').map(Number);
        return (hours * 60) + (minutes || 0);
    }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    window.farmoutSettingsManager = new FarmoutSettingsManager();
});
