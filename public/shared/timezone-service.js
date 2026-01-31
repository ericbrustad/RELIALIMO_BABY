/**
 * Global Timezone Service
 * Provides consistent timezone handling across all apps (admin, customer, driver)
 * Syncs with organization settings in Supabase
 */

const TimezoneService = {
  // Cache the timezone to avoid repeated DB calls
  _cachedTimezone: null,
  _cacheExpiry: null,
  _cacheDurationMs: 5 * 60 * 1000, // 5 minutes
  
  // Common US timezones with display names
  TIMEZONES: [
    { value: 'America/New_York', label: 'Eastern Time (ET)', offset: -5 },
    { value: 'America/Chicago', label: 'Central Time (CT)', offset: -6 },
    { value: 'America/Denver', label: 'Mountain Time (MT)', offset: -7 },
    { value: 'America/Phoenix', label: 'Arizona Time (AZ)', offset: -7 },
    { value: 'America/Los_Angeles', label: 'Pacific Time (PT)', offset: -8 },
    { value: 'America/Anchorage', label: 'Alaska Time (AK)', offset: -9 },
    { value: 'Pacific/Honolulu', label: 'Hawaii Time (HI)', offset: -10 },
    { value: 'UTC', label: 'UTC (Coordinated Universal Time)', offset: 0 }
  ],
  
  /**
   * Get the organization's timezone from Supabase
   * @returns {Promise<string>} IANA timezone string (e.g., 'America/Chicago')
   */
  async getOrganizationTimezone() {
    // Check cache first
    if (this._cachedTimezone && this._cacheExpiry && Date.now() < this._cacheExpiry) {
      return this._cachedTimezone;
    }
    
    // Check localStorage for faster initial load
    const cachedTz = localStorage.getItem('organization_timezone');
    if (cachedTz) {
      this._cachedTimezone = cachedTz;
      this._cacheExpiry = Date.now() + this._cacheDurationMs;
    }
    
    try {
      const supabase = window.supabase || window.supabaseClient;
      if (!supabase) {
        console.warn('[TimezoneService] Supabase not available, using default');
        return this._cachedTimezone || 'America/Chicago';
      }
      
      // Get organization ID
      const orgId = window.ENV?.ORGANIZATION_ID || 
                   localStorage.getItem('relia_organization_id') ||
                   '54eb6ce7-ba97-4198-8566-6ac075828160';
      
      const { data, error } = await supabase
        .from('organizations')
        .select('timezone')
        .eq('id', orgId)
        .single();
      
      if (error) {
        console.error('[TimezoneService] Error fetching timezone:', error);
        return this._cachedTimezone || 'America/Chicago';
      }
      
      const timezone = data?.timezone || 'America/Chicago';
      
      // Update cache
      this._cachedTimezone = timezone;
      this._cacheExpiry = Date.now() + this._cacheDurationMs;
      localStorage.setItem('organization_timezone', timezone);
      
      console.log('[TimezoneService] Organization timezone:', timezone);
      return timezone;
    } catch (err) {
      console.error('[TimezoneService] Error:', err);
      return this._cachedTimezone || 'America/Chicago';
    }
  },
  
  /**
   * Set the organization's timezone in Supabase
   * @param {string} timezone - IANA timezone string
   * @returns {Promise<boolean>} Success status
   */
  async setOrganizationTimezone(timezone) {
    try {
      const supabase = window.supabase || window.supabaseClient;
      if (!supabase) {
        console.error('[TimezoneService] Supabase not available');
        return false;
      }
      
      const orgId = window.ENV?.ORGANIZATION_ID || 
                   localStorage.getItem('relia_organization_id') ||
                   '54eb6ce7-ba97-4198-8566-6ac075828160';
      
      const { error } = await supabase
        .from('organizations')
        .update({ timezone, updated_at: new Date().toISOString() })
        .eq('id', orgId);
      
      if (error) {
        console.error('[TimezoneService] Error setting timezone:', error);
        return false;
      }
      
      // Update cache
      this._cachedTimezone = timezone;
      this._cacheExpiry = Date.now() + this._cacheDurationMs;
      localStorage.setItem('organization_timezone', timezone);
      
      // Broadcast change to all tabs/windows
      window.postMessage({ type: 'timezoneChanged', timezone }, '*');
      localStorage.setItem('timezone_updated', Date.now().toString());
      
      console.log('[TimezoneService] Timezone updated to:', timezone);
      return true;
    } catch (err) {
      console.error('[TimezoneService] Error:', err);
      return false;
    }
  },
  
  /**
   * Parse a datetime string as local time in the organization's timezone
   * This treats the stored datetime as a literal "wall clock" time
   * @param {string} dateString - ISO datetime string from database
   * @returns {Date} JavaScript Date object representing local time
   */
  parseAsLocalTime(dateString) {
    if (!dateString) return null;
    
    // Strip timezone offset like +00:00 or Z to prevent conversion
    const stripped = dateString.replace(/[+-]\d{2}:\d{2}$/, '').replace(/Z$/, '');
    
    // Parse components manually
    const [datePart, timePart] = stripped.split('T');
    if (datePart && timePart) {
      const [year, month, day] = datePart.split('-').map(Number);
      const [hours, minutes, seconds] = timePart.split(':').map(n => parseInt(n) || 0);
      return new Date(year, month - 1, day, hours, minutes, seconds);
    }
    if (datePart) {
      const [year, month, day] = datePart.split('-').map(Number);
      return new Date(year, month - 1, day);
    }
    
    // Fallback
    return new Date(dateString);
  },
  
  /**
   * Format a datetime for storage (without timezone suffix)
   * @param {Date} date - JavaScript Date object
   * @returns {string} ISO string without timezone (e.g., "2026-01-31T13:59:00")
   */
  formatForStorage(date) {
    if (!date) return null;
    const pad = (n) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  },
  
  /**
   * Format date for display
   * @param {string|Date} dateString - Date to format
   * @param {Object} options - Intl.DateTimeFormat options
   * @returns {string} Formatted date string
   */
  formatDate(dateString, options = {}) {
    const date = typeof dateString === 'string' ? this.parseAsLocalTime(dateString) : dateString;
    if (!date) return '';
    
    const defaultOptions = { month: '2-digit', day: '2-digit', year: 'numeric' };
    return date.toLocaleDateString('en-US', { ...defaultOptions, ...options });
  },
  
  /**
   * Format time for display (12-hour format)
   * @param {string|Date} dateString - Date to format
   * @returns {string} Formatted time string (e.g., "1:59 PM")
   */
  formatTime(dateString) {
    const date = typeof dateString === 'string' ? this.parseAsLocalTime(dateString) : dateString;
    if (!date) return '';
    
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  },
  
  /**
   * Format date and time together
   * @param {string|Date} dateString - Date to format
   * @returns {string} Formatted datetime string
   */
  formatDateTime(dateString) {
    return `${this.formatDate(dateString)} ${this.formatTime(dateString)}`;
  },
  
  /**
   * Get timezone display label
   * @param {string} timezone - IANA timezone string
   * @returns {string} Display label
   */
  getTimezoneLabel(timezone) {
    const tz = this.TIMEZONES.find(t => t.value === timezone);
    return tz ? tz.label : timezone;
  },
  
  /**
   * Render timezone selector HTML
   * @param {string} selectedTimezone - Currently selected timezone
   * @param {string} selectId - HTML id for the select element
   * @returns {string} HTML string
   */
  renderTimezoneSelector(selectedTimezone, selectId = 'timezoneSelect') {
    const options = this.TIMEZONES.map(tz => 
      `<option value="${tz.value}" ${tz.value === selectedTimezone ? 'selected' : ''}>${tz.label}</option>`
    ).join('');
    
    return `
      <select id="${selectId}" class="form-control timezone-select">
        ${options}
      </select>
    `;
  },
  
  /**
   * Initialize timezone selector with change handler
   * @param {string} selectId - HTML id of the select element
   */
  async initTimezoneSelector(selectId = 'timezoneSelect') {
    const select = document.getElementById(selectId);
    if (!select) return;
    
    // Load current timezone
    const currentTz = await this.getOrganizationTimezone();
    select.value = currentTz;
    
    // Add change handler
    select.addEventListener('change', async (e) => {
      const newTimezone = e.target.value;
      const success = await this.setOrganizationTimezone(newTimezone);
      if (success) {
        // Show success notification
        if (window.showToast) {
          window.showToast(`Timezone updated to ${this.getTimezoneLabel(newTimezone)}`, 'success');
        } else {
          alert(`Timezone updated to ${this.getTimezoneLabel(newTimezone)}`);
        }
        // Trigger UI refresh
        window.dispatchEvent(new CustomEvent('timezoneUpdated', { detail: { timezone: newTimezone } }));
      } else {
        // Revert selection on failure
        select.value = currentTz;
        if (window.showToast) {
          window.showToast('Failed to update timezone', 'error');
        } else {
          alert('Failed to update timezone');
        }
      }
    });
  },
  
  /**
   * Listen for timezone changes from other tabs/windows
   */
  listenForChanges() {
    // Listen for localStorage changes (cross-tab)
    window.addEventListener('storage', (e) => {
      if (e.key === 'timezone_updated') {
        // Clear cache to force refresh
        this._cachedTimezone = null;
        this._cacheExpiry = null;
        // Reload timezone
        this.getOrganizationTimezone().then(tz => {
          window.dispatchEvent(new CustomEvent('timezoneUpdated', { detail: { timezone: tz } }));
        });
      }
    });
    
    // Listen for postMessage (same tab)
    window.addEventListener('message', (e) => {
      if (e.data?.type === 'timezoneChanged') {
        this._cachedTimezone = e.data.timezone;
        this._cacheExpiry = Date.now() + this._cacheDurationMs;
      }
    });
  }
};

// Auto-initialize listener
if (typeof window !== 'undefined') {
  TimezoneService.listenForChanges();
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TimezoneService;
}

// Also make available globally
if (typeof window !== 'undefined') {
  window.TimezoneService = TimezoneService;
}
