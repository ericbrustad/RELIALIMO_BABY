const AUTOMATION_STORAGE_KEY = 'relia_farmout_automation_settings';
const DEFAULT_AUTOMATION_SETTINGS = {
  dispatchIntervalMinutes: 15,  // 15 minutes between offers
  offerSpacingMinutes: 2,       // 2 minutes between processing queue items
  offerWindowStart: '08:00',    // 8 AM
  offerWindowEnd: '21:00',      // 9 PM
  driverCooldownHours: 24,      // 24-hour cooldown per driver
  onDemandThresholdHours: 2,    // Within 2 hours = on-demand
  driverPayPercentage: 70,      // 70% of total due
  prioritizeAvailableForOnDemand: true,
  sendSmsOffers: true,
  sendInAppOffers: true,
  notifyAdminOnExhausted: true,
  recipientEntries: '',
  recipients: []
};

const TERMINAL_FARMOUT_STATUSES = new Set([
  'assigned',
  'affiliate_assigned',
  'affiliate_driver_assigned',
  'declined',
  'completed',
  'cancelled',
  'cancelled_by_affiliate',
  'late_cancel',
  'late_cancelled',
  'no_show',
  'in_house'
]);

function normalizeKey(value) {
  if (value === undefined || value === null) {
    return '';
  }
  return value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/__+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function clamp(value, min, max, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.min(Math.max(numeric, min), max);
}

function formatMinutes(minutes) {
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}

function formatCountdown(msRemaining) {
  if (!Number.isFinite(msRemaining) || msRemaining <= 0) {
    return 'now';
  }
  const totalSeconds = Math.ceil(msRemaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) {
    return `${seconds}s`;
  }
  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
}

/**
 * Check if current time is within the offer window (8 AM - 9 PM)
 */
function isWithinOfferWindow(startTime = '08:00', endTime = '21:00') {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTimeMinutes = currentHour * 60 + currentMinute;
  
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  
  return currentTimeMinutes >= startMinutes && currentTimeMinutes <= endMinutes;
}

/**
 * Calculate minutes until next offer window opens
 */
function minutesUntilOfferWindow(startTime = '08:00') {
  const now = new Date();
  const [startHour, startMin] = startTime.split(':').map(Number);
  
  const nextWindow = new Date(now);
  nextWindow.setHours(startHour, startMin, 0, 0);
  
  if (now >= nextWindow) {
    // Window is today but already started or passed, try tomorrow
    nextWindow.setDate(nextWindow.getDate() + 1);
  }
  
  return Math.ceil((nextWindow - now) / 60000);
}

/**
 * Extract city from an address string
 */
function extractCity(address) {
  if (!address) return '';
  // Try to extract city from address (usually before state/zip)
  const parts = address.split(',').map(p => p.trim());
  if (parts.length >= 2) {
    return parts[parts.length - 2] || parts[0];
  }
  return parts[0] || '';
}

export class FarmoutAutomationService {
  constructor({ reservationManager, driverTracker, uiManager }) {
    this.reservationManager = reservationManager;
    this.driverTracker = driverTracker;
    this.uiManager = uiManager;
    this.settings = { ...DEFAULT_AUTOMATION_SETTINGS };
    this.jobs = new Map();
    this.controlsAttached = false;
    this.handleReservationEvent = this.handleReservationEvent.bind(this);
  }

  init() {
    this.loadSettings();
    this.attachSettingsControls();
    this.bootstrapReservations();
    window.addEventListener('reservationFarmoutUpdated', this.handleReservationEvent);
    
    // Listen for settings updates from the settings page
    window.addEventListener('farmoutSettingsUpdated', (e) => this.handleSettingsUpdate(e));
    
    // Listen for driver responses from driver portal or SMS
    window.addEventListener('farmoutDriverResponse', (e) => this.handleDriverResponseEvent(e));
    
    // Listen for incoming SMS (from webhook/backend)
    window.addEventListener('incomingSmsReceived', (e) => this.handleIncomingSms(e));
    
    // Listen for messages from iframes (driver portal)
    window.addEventListener('message', (e) => {
      if (e.data?.type === 'farmoutDriverResponse') {
        this.handleDriverResponse(
          e.data.reservationId,
          e.data.driverId,
          e.data.accepted,
          e.data.responseMethod || 'in_app'
        );
      }
    });
  }
  
  /**
   * Handle settings updates from the settings page
   */
  handleSettingsUpdate(event) {
    const newSettings = event.detail || {};
    console.log('[FarmoutAutomation] Settings updated:', newSettings);
    
    // Map the new settings format to our internal format
    this.settings = {
      ...this.settings,
      dispatchIntervalMinutes: newSettings.offer_timeout_minutes || 15,
      offerSpacingMinutes: newSettings.offer_spacing_minutes || 2,
      offerWindowStart: newSettings.offer_window_start || '08:00',
      offerWindowEnd: newSettings.offer_window_end || '21:00',
      driverCooldownHours: newSettings.driver_cooldown_hours || 24,
      onDemandThresholdHours: Math.ceil((newSettings.on_demand_threshold_minutes || 120) / 60),
      driverPayPercentage: newSettings.driver_pay_percentage || 70,
      prioritizeAvailableForOnDemand: newSettings.enable_on_demand_priority !== false,
      sendSmsOffers: newSettings.enable_sms_offers !== false,
      sendInAppOffers: newSettings.enable_in_app_offers !== false,
      notifyAdminOnExhausted: newSettings.enable_auto_escalation !== false,
      enableDriverRatingPriority: newSettings.enable_driver_rating_priority !== false,
      enableServiceAreaMatching: newSettings.enable_service_area_matching !== false,
      enableVehicleTypeMatching: newSettings.enable_vehicle_type_matching !== false,
      escalateAfterAttempts: newSettings.escalate_to_admin_after_attempts || 10,
      adminNotificationEmail: newSettings.admin_notification_email || '',
      adminNotificationSms: newSettings.admin_notification_sms || '',
      smsOfferTemplate: newSettings.sms_offer_template || '',
      smsConfirmationTemplate: newSettings.sms_confirmation_template || '',
      smsRejectionTemplate: newSettings.sms_rejection_template || '',
      smsExpiryTemplate: newSettings.sms_expiry_template || '',
      customOptions: newSettings.custom_options || []
    };
    
    this.saveSettings();
    this.refreshSettingsControls();
  }
  
  /**
   * Handle driver response events from the driver portal
   */
  handleDriverResponseEvent(event) {
    const { reservationId, driverId, accepted, responseMethod } = event.detail || {};
    if (reservationId && driverId !== undefined) {
      this.handleDriverResponse(reservationId, driverId, accepted, responseMethod);
    }
  }
  
  /**
   * Handle incoming SMS responses
   * Expected format: { from: '+1234567890', body: 'Y' or 'N' }
   */
  handleIncomingSms(event) {
    const { from, body } = event.detail || {};
    if (!from || !body) return;
    
    const normalizedBody = body.trim().toUpperCase();
    const isAccept = normalizedBody === 'Y' || normalizedBody === 'YES' || normalizedBody === 'ACCEPT';
    const isReject = normalizedBody === 'N' || normalizedBody === 'NO' || normalizedBody === 'DECLINE' || normalizedBody === 'REJECT';
    
    if (!isAccept && !isReject) {
      console.log('[FarmoutAutomation] Unrecognized SMS response:', body);
      return;
    }
    
    // Find the driver by phone number
    const driver = this.findDriverByPhone(from);
    if (!driver) {
      console.log('[FarmoutAutomation] Could not find driver for phone:', from);
      return;
    }
    
    // Find the pending offer for this driver
    const pendingOffer = this.findPendingOfferForDriver(driver.id);
    if (!pendingOffer) {
      console.log('[FarmoutAutomation] No pending offer for driver:', driver.id);
      return;
    }
    
    // Process the response
    this.handleDriverResponse(pendingOffer.reservationId, driver.id, isAccept, 'sms');
  }
  
  /**
   * Find driver by phone number
   */
  findDriverByPhone(phoneNumber) {
    const normalizedPhone = phoneNumber.replace(/\D/g, '').slice(-10); // Last 10 digits
    const allDrivers = this.driverTracker.getAllDrivers?.() || this.driverTracker.getAvailableDrivers?.() || [];
    
    return allDrivers.find(driver => {
      const driverPhone = (driver.phone || driver.cell_phone || driver.mobile || '').replace(/\D/g, '').slice(-10);
      return driverPhone === normalizedPhone;
    });
  }
  
  /**
   * Find pending offer for a driver
   */
  findPendingOfferForDriver(driverId) {
    // Check all active jobs for an offer to this driver
    for (const [reservationId, job] of this.jobs) {
      if (job.attemptedDriverIds.has(driverId) && job.status === 'running') {
        return { reservationId, job };
      }
    }
    
    // Also check localStorage pending offers
    try {
      const pendingOffers = JSON.parse(localStorage.getItem('pending_farmout_offers') || '{}');
      const driverOffers = pendingOffers[driverId] || [];
      if (driverOffers.length > 0) {
        return driverOffers[0]; // Return most recent offer
      }
    } catch (e) { /* ignore */ }
    
    return null;
  }

  dispose() {
    window.removeEventListener('reservationFarmoutUpdated', this.handleReservationEvent);
    this.jobs.forEach(job => {
      if (job.timeoutId) {
        clearTimeout(job.timeoutId);
      }
    });
    this.jobs.clear();
  }

  getSettings() {
    return { ...this.settings };
  }

  loadSettings() {
    try {
      const stored = localStorage.getItem(AUTOMATION_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.settings = {
          ...DEFAULT_AUTOMATION_SETTINGS,
          ...parsed,
          dispatchIntervalMinutes: clamp(parsed.dispatchIntervalMinutes, 1, 60, DEFAULT_AUTOMATION_SETTINGS.dispatchIntervalMinutes),
          recipientEntries: parsed.recipientEntries || '',
          recipients: Array.isArray(parsed.recipients) ? parsed.recipients : []
        };
      } else {
        this.settings = { ...DEFAULT_AUTOMATION_SETTINGS };
      }
    } catch (error) {
      console.warn('[FarmoutAutomationService] Unable to load settings, using defaults:', error);
      this.settings = { ...DEFAULT_AUTOMATION_SETTINGS };
    }
  }

  saveSettings() {
    try {
      const payload = {
        dispatchIntervalMinutes: this.settings.dispatchIntervalMinutes,
        recipientEntries: this.settings.recipientEntries,
        recipients: this.settings.recipients
      };
      localStorage.setItem(AUTOMATION_STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      console.warn('[FarmoutAutomationService] Unable to save settings:', error);
    }
  }

  updateSettings(partial) {
    this.settings = {
      ...this.settings,
      ...partial,
      dispatchIntervalMinutes: clamp(
        partial.dispatchIntervalMinutes ?? this.settings.dispatchIntervalMinutes,
        1,
        60,
        DEFAULT_AUTOMATION_SETTINGS.dispatchIntervalMinutes
      )
    };
    this.saveSettings();
    this.updateAutomationStatusDisplay();
  }

  attachSettingsControls() {
    if (this.controlsAttached) {
      this.refreshSettingsControls();
      return;
    }

    const intervalInput = document.getElementById('farmoutAutoInterval');
    const recipientsInput = document.getElementById('farmoutAdminRecipients');

    if (intervalInput) {
      intervalInput.value = this.settings.dispatchIntervalMinutes;
      intervalInput.addEventListener('change', () => {
        const nextValue = clamp(intervalInput.value, 1, 60, this.settings.dispatchIntervalMinutes);
        intervalInput.value = nextValue;
        this.updateSettings({ dispatchIntervalMinutes: nextValue });
        this.logAutomationEvent(null, `Auto-dispatch interval set to ${formatMinutes(nextValue)}.`);
      });
    }

    if (recipientsInput) {
      recipientsInput.value = this.settings.recipientEntries;
      recipientsInput.addEventListener('change', () => {
        this.applyRecipientEntries(recipientsInput.value);
        this.logAutomationEvent(null, `Escalation recipients updated (${this.settings.recipients.length} contact${this.settings.recipients.length === 1 ? '' : 's'}).`);
      });
    }

    this.controlsAttached = true;
    this.updateAutomationStatusDisplay();
  }

  refreshSettingsControls() {
    const intervalInput = document.getElementById('farmoutAutoInterval');
    if (intervalInput) {
      intervalInput.value = this.settings.dispatchIntervalMinutes;
    }
    const recipientsInput = document.getElementById('farmoutAdminRecipients');
    if (recipientsInput) {
      recipientsInput.value = this.settings.recipientEntries;
    }
  }

  applyRecipientEntries(entriesText) {
    const entries = (entriesText || '')
      .split(/\n|,/)
      .map(entry => entry.trim())
      .filter(Boolean);

    const recipients = entries.map(entry => this.resolveRecipientEntry(entry));
    this.settings.recipientEntries = entriesText || '';
    this.settings.recipients = recipients;
    this.saveSettings();
  }

  resolveRecipientEntry(entry) {
    const [identifierRaw, phoneRaw] = entry.split('|').map(part => part.trim());
    const identifier = identifierRaw || '';
    const phone = phoneRaw || '';
    const directoryMatch = this.lookupUserDirectory(identifier);

    return {
      identifier,
      email: directoryMatch?.email || (identifier.includes('@') ? identifier : ''),
      phone: directoryMatch?.phone || phone,
      userId: directoryMatch?.id || null
    };
  }

  lookupUserDirectory(identifier) {
    if (!identifier) {
      return null;
    }

    try {
      const directoryRaw = localStorage.getItem('relia_user_directory');
      if (!directoryRaw) {
        return null;
      }
      const directory = JSON.parse(directoryRaw);
      if (!Array.isArray(directory)) {
        return null;
      }
      const normalized = identifier.toLowerCase();
      return directory.find(entry => {
        if (!entry) return false;
        const { id, email } = entry;
        if (id && String(id).toLowerCase() === normalized) return true;
        if (email && email.toLowerCase() === normalized) return true;
        return false;
      }) || null;
    } catch (error) {
      console.warn('[FarmoutAutomationService] Unable to read user directory:', error);
      return null;
    }
  }

  bootstrapReservations() {
    const reservations = this.reservationManager.getAllReservations();
    reservations.forEach(reservation => {
      if (this.shouldAutoDispatch(reservation)) {
        this.ensureJob(reservation);
      }
    });
  }

  handleReservationEvent(event) {
    if (!event?.detail?.reservation) {
      return;
    }

    const { reservation, type, status, mode, driverInfo } = event.detail;
    if (!reservation) {
      return;
    }

    const canonicalMode = this.normalizeMode(mode || reservation.farmoutMode || reservation.farmout_mode);
    const canonicalStatus = this.normalizeStatus(status || reservation.farmoutStatus || reservation.farmout_status);
    const reservationId = String(reservation.id);

    if (type === 'farmoutDriverAssigned') {
      this.stopJob(reservationId, driverInfo ? `Driver ${driverInfo.name || driverInfo.id || ''} accepted. Auto-dispatch stopped.` : 'Driver accepted. Auto-dispatch stopped.');
      return;
    }

    if (type === 'farmoutDriverCleared') {
      if (canonicalMode === 'automatic' && !this.isTerminalStatus(canonicalStatus)) {
        this.ensureJob(reservation);
      }
      return;
    }

    if (type === 'farmoutModeChanged') {
      if (canonicalMode === 'automatic' && !this.isTerminalStatus(canonicalStatus)) {
        this.ensureJob(reservation);
      } else {
        this.stopJob(reservationId, 'Farm-out mode switched to manual.');
      }
      return;
    }

    if (type === 'farmoutStatusChanged' || type === 'reservationUpdated') {
      if (this.isTerminalStatus(canonicalStatus)) {
        this.stopJob(reservationId, `Farm-out status changed to ${canonicalStatus}.`);
      } else if (canonicalMode === 'automatic') {
        this.ensureJob(reservation);
      }
      return;
    }
  }

  shouldAutoDispatch(reservation) {
    const mode = this.normalizeMode(reservation?.farmoutMode || reservation?.farmout_mode);
    const status = this.normalizeStatus(reservation?.farmoutStatus || reservation?.farmout_status);
    if (mode !== 'automatic') {
      return false;
    }
    if (this.isTerminalStatus(status)) {
      return false;
    }
    return true;
  }

  ensureJob(reservation) {
    const reservationId = String(reservation.id);
    if (this.jobs.has(reservationId)) {
      this.updateAutomationStatusDisplay(reservationId);
      return;
    }

    // Check if we're within the offer window (8 AM - 9 PM)
    if (!isWithinOfferWindow(this.settings.offerWindowStart, this.settings.offerWindowEnd)) {
      const waitMinutes = minutesUntilOfferWindow(this.settings.offerWindowStart);
      this.logAutomationEvent(reservationId, `Outside offer hours. Queued for next window in ${waitMinutes} minutes.`);
      
      // Schedule to start when window opens
      const job = {
        reservationId,
        attemptedDriverIds: new Set(),
        driverCooldowns: new Map(),  // driver_id -> last_offered_timestamp
        prioritizedDriverList: [],
        currentDriverIndex: 0,
        status: 'queued',
        timeoutId: null,
        timeoutPurpose: 'window_wait',
        nextAttemptAt: Date.now() + (waitMinutes * 60000),
        lastAttemptAt: null
      };
      
      this.jobs.set(reservationId, job);
      job.timeoutId = window.setTimeout(() => {
        job.status = 'running';
        this.buildDriverPriorityList(job, reservation);
        this.sendNextOffer(job);
      }, waitMinutes * 60000);
      
      this.updateAutomationStatusDisplay(reservationId);
      return;
    }

    const job = {
      reservationId,
      attemptedDriverIds: new Set(),
      driverCooldowns: new Map(),  // driver_id -> last_offered_timestamp
      prioritizedDriverList: [],
      currentDriverIndex: 0,
      status: 'running',
      timeoutId: null,
      timeoutPurpose: null,
      nextAttemptAt: null,
      lastAttemptAt: null
    };

    this.jobs.set(reservationId, job);
    this.logAutomationEvent(reservationId, `Auto-dispatch activated with ${formatMinutes(this.settings.dispatchIntervalMinutes)} between offers.`);
    
    // Build prioritized driver list (try Supabase first, then local)
    this.buildDriverPriorityListAsync(job, reservation);
  }
  
  /**
   * Build driver priority list - tries Supabase first, falls back to local
   */
  async buildDriverPriorityListAsync(job, reservation) {
    const pickupLocation = reservation.pickupLocation || reservation.pickup_location || '';
    const pickupCity = extractCity(pickupLocation);
    const vehicleType = reservation.vehicleType || reservation.vehicle_type || '';
    const pickupDateTime = this.getPickupDateTime(reservation);
    const isOnDemand = pickupDateTime && (pickupDateTime - Date.now()) <= (this.settings.onDemandThresholdHours * 60 * 60 * 1000);
    
    // Try Supabase RPC first
    if (typeof supabase !== 'undefined') {
      try {
        const { data, error } = await supabase.rpc('get_prioritized_drivers_for_farmout', {
          p_reservation_id: reservation.id,
          p_pickup_city: pickupCity,
          p_vehicle_type: vehicleType,
          p_is_on_demand: isOnDemand,
          p_organization_id: this.getOrganizationId()
        });
        
        if (!error && data && data.length > 0) {
          job.prioritizedDriverList = data.map(d => ({
            id: d.driver_id,
            name: d.driver_name,
            phone: d.driver_phone,
            driver_rating: d.driver_rating,
            priority_score: d.priority_score,
            is_available: d.is_available,
            matches_service_area: d.matches_service_area,
            matches_vehicle_type: d.matches_vehicle_type
          }));
          
          this.logAutomationEvent(
            job.reservationId, 
            `📋 Found ${data.length} eligible drivers via database. Top driver: ${data[0]?.driver_name || 'Unknown'} (Score: ${data[0]?.priority_score || 0})`
          );
          
          this.sendNextOffer(job);
          return;
        }
      } catch (e) {
        console.log('[FarmoutAutomation] Supabase driver list failed, using local:', e);
      }
    }
    
    // Fall back to local driver list
    this.buildDriverPriorityList(job, reservation);
    this.sendNextOffer(job);
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
   * Build prioritized driver list based on:
   * 1. Driver rating (10 = best, goes first) - when enabled
   * 2. Service area match
   * 3. Vehicle type match
   * 4. For on-demand: available drivers first
   * 5. Alphabetical order for same rating/priority
   */
  buildDriverPriorityList(job, reservation) {
    const allDrivers = this.driverTracker.getAllDrivers?.() || this.driverTracker.getAvailableDrivers?.() || [];
    
    // Get reservation details for matching
    const pickupLocation = reservation.pickupLocation || reservation.pickup_location || '';
    const pickupCity = extractCity(pickupLocation);
    const vehicleType = reservation.vehicleType || reservation.vehicle_type || '';
    const affiliateId = reservation.affiliateId || reservation.affiliate_id;
    
    // Check if this is on-demand (within 2 hours)
    const pickupDateTime = this.getPickupDateTime(reservation);
    const isOnDemand = pickupDateTime && (pickupDateTime - Date.now()) <= (this.settings.onDemandThresholdHours * 60 * 60 * 1000);
    
    // Filter drivers
    let eligibleDrivers = allDrivers.filter(driver => {
      // Only active drivers
      if (driver.status !== 'active' && driver.status !== 'available') return false;
      
      // If affiliate is specified, only drivers from that affiliate
      if (affiliateId && driver.affiliate_id && driver.affiliate_id !== affiliateId) return false;
      
      // Check 24-hour cooldown
      const lastOffer = job.driverCooldowns.get(driver.id) || driver.last_farmout_offer_at;
      if (lastOffer) {
        const cooldownMs = this.settings.driverCooldownHours * 60 * 60 * 1000;
        if (Date.now() - new Date(lastOffer).getTime() < cooldownMs) return false;
      }
      
      return true;
    });
    
    // Check if driver rating priority is enabled via farmout automation settings toggle
    const ratingPriorityEnabled = this.settings.enableDriverRatingPriority !== false;
    
    // Score and sort drivers
    const scoredDrivers = eligibleDrivers.map(driver => {
      let score = 0;
      
      // Get driver rating (1-10, default 5)
      const rating = Math.max(1, Math.min(10, parseInt(driver.driver_rating || driver.rating || 5)));
      
      // Apply rating to score ONLY if rating priority is enabled
      if (ratingPriorityEnabled) {
        // Rating contributes the most significant part of the score (1000-10000)
        score += rating * 1000;
      }
      
      // Service area match bonus
      if (this.settings.enableServiceAreaMatching !== false) {
        const serviceAreas = driver.service_areas || [];
        if (Array.isArray(serviceAreas) && pickupCity) {
          const matchesArea = serviceAreas.some(area => 
            pickupCity.toLowerCase().includes(area.toLowerCase()) ||
            area.toLowerCase().includes(pickupCity.toLowerCase())
          );
          if (matchesArea) score += 500;
        }
      }
      
      // Vehicle type match bonus
      if (this.settings.enableVehicleTypeMatching !== false) {
        const preferredVehicles = driver.preferred_vehicle_types || [];
        if (Array.isArray(preferredVehicles) && vehicleType) {
          const matchesVehicle = preferredVehicles.some(v => 
            v.toLowerCase() === vehicleType.toLowerCase()
          );
          if (matchesVehicle) score += 300;
        }
      }
      
      // On-demand priority for available drivers
      if (isOnDemand && this.settings.prioritizeAvailableForOnDemand !== false) {
        if (driver.availability_status === 'available' || driver.status === 'available') {
          score += 100;
        }
      }
      
      return { driver, score, rating };
    });
    
    // Sort drivers: 
    // 1. By score (highest first) - includes rating if enabled
    // 2. By rating (highest first, 10->1) - for same-score drivers when rating priority enabled
    // 3. Alphabetically by name (A->Z) - for drivers with same rating
    scoredDrivers.sort((a, b) => {
      // Primary: Score (includes rating bonus if enabled)
      if (b.score !== a.score) return b.score - a.score;
      
      // Secondary: Direct rating comparison (10->1) when rating priority enabled
      if (ratingPriorityEnabled && b.rating !== a.rating) {
        return b.rating - a.rating;
      }
      
      // Tertiary: Alphabetical by name (A->Z)
      const nameA = (a.driver.name || a.driver.first_name || '').toLowerCase().trim();
      const nameB = (b.driver.name || b.driver.first_name || '').toLowerCase().trim();
      return nameA.localeCompare(nameB);
    });
    
    job.prioritizedDriverList = scoredDrivers.map(s => s.driver);
    job.currentDriverIndex = 0;
    
    const ratingInfo = ratingPriorityEnabled ? ' (Rating priority: ENABLED)' : ' (Rating priority: OFF)';
    this.logAutomationEvent(job.reservationId, `Found ${job.prioritizedDriverList.length} eligible drivers.${ratingInfo} ${isOnDemand ? '(On-demand priority)' : ''}`);
  }

  sendNextOffer(job) {
    const reservation = this.reservationManager.getReservationById(job.reservationId);
    if (!reservation) {
      this.stopJob(job.reservationId, 'Reservation no longer available.');
      return;
    }

    // Check if still within offer window
    if (!isWithinOfferWindow(this.settings.offerWindowStart, this.settings.offerWindowEnd)) {
      const waitMinutes = minutesUntilOfferWindow(this.settings.offerWindowStart);
      this.logAutomationEvent(job.reservationId, `Offer window closed. Resuming in ${waitMinutes} minutes.`);
      job.status = 'queued';
      job.timeoutPurpose = 'window_wait';
      job.nextAttemptAt = Date.now() + (waitMinutes * 60000);
      job.timeoutId = window.setTimeout(() => {
        job.status = 'running';
        this.sendNextOffer(job);
      }, waitMinutes * 60000);
      this.updateAutomationStatusDisplay(job.reservationId);
      return;
    }

    // Get next eligible driver from prioritized list
    const remainingDrivers = job.prioritizedDriverList.slice(job.currentDriverIndex)
      .filter(driver => !job.attemptedDriverIds.has(driver.id));

    if (remainingDrivers.length === 0) {
      // All drivers exhausted - check if we should restart after 24 hours
      this.scheduleEscalation(job);
      return;
    }

    const targetDriver = remainingDrivers[0];
    job.attemptedDriverIds.add(targetDriver.id);
    job.driverCooldowns.set(targetDriver.id, new Date().toISOString());
    job.currentDriverIndex++;
    job.lastAttemptAt = Date.now();

    // Build offer details
    const offerDetails = this.buildOfferDetails(reservation, targetDriver);
    
    // Send the offer
    this.sendOfferToDriver(job, reservation, targetDriver, offerDetails);

    if (typeof this.reservationManager.updateFarmoutStatus === 'function') {
      this.reservationManager.updateFarmoutStatus(job.reservationId, 'offered');
    }

    // Schedule next attempt in 15 minutes (or specified interval)
    if (remainingDrivers.length > 1) {
      this.scheduleNextAttempt(job, 'offer');
    } else {
      this.scheduleNextAttempt(job, 'escalate');
    }
  }

  /**
   * Build offer details to show driver (limited info until accepted)
   */
  buildOfferDetails(reservation, driver) {
    const pickupDate = reservation.pickupDate || reservation.pickup_date || reservation.puDate || '';
    const pickupTime = reservation.pickupTime || reservation.pickup_time || reservation.puTime || '';
    const pickupLocation = reservation.pickupLocation || reservation.pickup_location || '';
    const dropoffLocation = reservation.dropoffLocation || reservation.dropoff_location || '';
    const passengerName = reservation.passengerName || reservation.passenger_name || '';
    const firstName = passengerName.split(' ')[0] || 'Passenger';
    const paxCount = reservation.passengerCount || reservation.passenger_count || reservation.numPax || 1;
    const vehicleType = reservation.vehicleType || reservation.vehicle_type || '';
    const duration = reservation.duration || reservation.estimatedDuration || '';
    const distance = reservation.distance || reservation.estimatedDistance || '';
    const grandTotal = parseFloat(reservation.grandTotal || reservation.grand_total || 0);
    
    // Calculate driver pay (70% of total)
    const driverPay = (grandTotal * (this.settings.driverPayPercentage / 100)).toFixed(2);
    
    // Extract cities only (not full addresses)
    const pickupCity = extractCity(pickupLocation);
    const dropoffCity = extractCity(dropoffLocation);
    
    // Get special notes
    const notes = reservation.tripNotes || reservation.trip_notes || 
                  reservation.dispatchNotes || reservation.dispatch_notes || '';
    
    return {
      confirmationNumber: reservation.confirmationNumber || reservation.confirmation_number,
      pickupDate,
      pickupTime,
      pickupCity,
      dropoffCity,
      passengerFirstName: firstName,
      paxCount,
      vehicleType,
      duration,
      distance,
      driverPay,
      grandTotal,
      notes: notes.substring(0, 200),  // Limit notes length
      offeredAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + this.settings.dispatchIntervalMinutes * 60000).toISOString()
    };
  }

  /**
   * Send offer to driver via SMS and in-app notification
   */
  async sendOfferToDriver(job, reservation, driver, offerDetails) {
    const driverName = driver.name || driver.dispatch_display_name || 
                       `${driver.first_name || ''} ${driver.last_name || ''}`.trim() || 'Driver';
    const driverPhone = driver.phone || driver.cell_phone || driver.mobile;
    
    const ratingInfo = this.settings.enableDriverRatingPriority !== false 
      ? `(Rating: ${driver.driver_rating || 5}/10)` 
      : '(Rating priority OFF)';
    
    this.logAutomationEvent(
      job.reservationId,
      `🏠 Offer sent to ${driverName} ${ratingInfo}${driverPhone ? ` - ${driverPhone}` : ''}`
    );
    
    // Store offer in Supabase (primary) and localStorage (fallback)
    await this.storeOfferInSupabase(job.reservationId, driver.id, offerDetails);
    this.storePendingOffer(job.reservationId, driver.id, offerDetails);
    
    // Send SMS if enabled
    if (this.settings.sendSmsOffers && driverPhone) {
      await this.sendSmsOffer(driver, offerDetails);
    }
    
    // Dispatch in-app notification event
    if (this.settings.sendInAppOffers) {
      window.dispatchEvent(new CustomEvent('farmoutOfferSent', {
        detail: {
          reservationId: job.reservationId,
          driverId: driver.id,
          driverName,
          driverCompany: driver.company || driver.affiliate_name || '',
          dispatchIntervalMinutes: this.settings.dispatchIntervalMinutes,
          offerDetails
        }
      }));
    }
  }

  /**
   * Store offer in Supabase by updating reservation with current_offer fields
   */
  async storeOfferInSupabase(reservationId, driverId, offerDetails) {
    try {
      if (typeof supabase === 'undefined') {
        console.warn('[FarmoutAutomation] Supabase not available for storing offer');
        return;
      }
      
      const expiresAt = new Date(Date.now() + this.settings.dispatchIntervalMinutes * 60000);
      
      const { error } = await supabase
        .from('reservations')
        .update({
          farmout_status: 'offered',
          current_offer_driver_id: driverId,
          current_offer_sent_at: new Date().toISOString(),
          current_offer_expires_at: expiresAt.toISOString(),
          farmout_attempts: (offerDetails.attemptNumber || 0) + 1
        })
        .eq('id', reservationId);
      
      if (error) {
        console.warn('[FarmoutAutomation] Failed to store offer in Supabase:', error);
      } else {
        console.log('[FarmoutAutomation] Offer stored in Supabase for reservation:', reservationId);
      }
    } catch (e) {
      console.warn('[FarmoutAutomation] Error storing offer in Supabase:', e);
    }
  }

  /**
   * Store pending offer for driver portal to display (localStorage fallback)
   */
  storePendingOffer(reservationId, driverId, offerDetails) {
    try {
      const pendingOffers = JSON.parse(localStorage.getItem('pending_farmout_offers') || '{}');
      
      if (!pendingOffers[driverId]) {
        pendingOffers[driverId] = [];
      }
      
      // Remove any existing offer for this reservation
      pendingOffers[driverId] = pendingOffers[driverId].filter(o => o.reservationId !== reservationId);
      
      // Add new offer
      pendingOffers[driverId].push({
        reservationId,
        ...offerDetails,
        status: 'pending'
      });
      
      localStorage.setItem('pending_farmout_offers', JSON.stringify(pendingOffers));
    } catch (e) {
      console.warn('[FarmoutAutomation] Failed to store pending offer:', e);
    }
  }

  /**
   * Send SMS offer to driver using template with portal link
   */
  async sendSmsOffer(driver, offerDetails) {
    const phone = driver.phone || driver.cell_phone || driver.mobile;
    if (!phone) return;
    
    // Enhanced template with portal link
    const template = this.settings.smsOfferTemplate || 
      `🚗 New Trip Available!
📅 {pickup_date} at {pickup_time}
📍 From: {pickup_address}
📍 To: {dropoff_address}
💰 Payout: ${offerDetails.driverPay}
⏰ Expires in {timeout_minutes} min

Accept/Decline: {portal_link}`;
    
    const message = this.renderSmsTemplate(template, driver, offerDetails);
    
    try {
      // Try Supabase RPC first
      if (typeof supabase !== 'undefined') {
        try {
          const { data, error } = await supabase.rpc('render_sms_template', {
            p_template: template,
            p_reservation_id: offerDetails.reservationId,
            p_driver_id: driver.id,
            p_pay_amount: parseFloat(offerDetails.driverPay),
            p_timeout_minutes: this.settings.dispatchIntervalMinutes
          });
          
          if (!error && data) {
            // Send the rendered message
            await this.sendSms(phone, data, 'farmout_offer', driver.id);
            return;
          }
        } catch (e) {
          console.log('[FarmoutAutomation] Supabase template render failed, using local:', e);
        }
      }
      
      // Fall back to local rendering
      await this.sendSms(phone, message, 'farmout_offer', driver.id);
    } catch (e) {
      console.warn('[FarmoutAutomation] Failed to send SMS:', e);
    }
  }
  
  /**
   * Render SMS template with tags locally
   */
  renderSmsTemplate(template, driver, offerDetails) {
    if (!template) return '';
    
    let result = template;
    
    // Driver tags
    result = result.replace(/{driver_first_name}/g, driver.first_name || driver.name?.split(' ')[0] || 'Driver');
    result = result.replace(/{driver_name}/g, driver.name || `${driver.first_name || ''} ${driver.last_name || ''}`.trim() || 'Driver');
    result = result.replace(/{driver_last_name}/g, driver.last_name || '');
    
    // Offer details tags
    result = result.replace(/{pickup_city}/g, offerDetails.pickupCity || '');
    result = result.replace(/{dropoff_city}/g, offerDetails.dropoffCity || '');
    result = result.replace(/{pickup_date}/g, offerDetails.pickupDate || '');
    result = result.replace(/{pickup_time}/g, offerDetails.pickupTime || '');
    result = result.replace(/{pickup_address}/g, offerDetails.pickupAddress || offerDetails.pickupCity || '');
    result = result.replace(/{dropoff_address}/g, offerDetails.dropoffAddress || offerDetails.dropoffCity || '');
    result = result.replace(/{pay_amount}/g, offerDetails.driverPay || '0');
    result = result.replace(/{timeout_minutes}/g, String(this.settings.dispatchIntervalMinutes || 15));
    result = result.replace(/{passenger_name}/g, offerDetails.passengerFirstName || 'Passenger');
    result = result.replace(/{passenger_count}/g, String(offerDetails.paxCount || 1));
    result = result.replace(/{vehicle_type}/g, offerDetails.vehicleType || '');
    result = result.replace(/{reservation_id}/g, offerDetails.confirmationNumber || '');
    result = result.replace(/{trip_notes}/g, offerDetails.notes || '');
    
    // Generate driver portal link with offer parameters
    const portalSlug = driver.portal_slug || this.generatePortalSlug(driver.first_name, driver.last_name);
    const portalBaseUrl = window.location.origin || 'https://your-domain.com'; // Replace with actual domain
    const portalLink = `${portalBaseUrl}/${portalSlug}?offer=${offerDetails.reservationId}`;
    result = result.replace(/{portal_link}/g, portalLink);
    
    return result;
  }

  /**
   * Generate portal slug for driver (similar to driver-portal.js)
   */
  generatePortalSlug(firstName, lastName) {
    const first = (firstName || '').trim();
    const last = (lastName || '').trim();
    
    if (!first && !last) {
      return `driver-${Date.now()}`;
    }
    
    const slug = `${first}-${last}`.toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    
    return slug || `driver-${Date.now()}`;
  }
  
  /**
   * Send SMS via available service
   */
  async sendSms(phone, message, type, driverId) {
    // Use the SMS service if available
    if (window.smsService?.sendSms) {
      await window.smsService.sendSms(phone, message);
      this.logAutomationEvent(null, `📱 SMS sent to ${phone}`);
    } else {
      // Dispatch event for SMS handler
      window.dispatchEvent(new CustomEvent('sendSmsRequest', {
        detail: { to: phone, message, type, driverId }
      }));
    }
  }
  
  /**
   * Send confirmation SMS when driver accepts
   */
  async sendConfirmationSms(driver, reservation, offerDetails) {
    const phone = driver.phone || driver.cell_phone || driver.mobile;
    if (!phone) return;
    
    const template = this.settings.smsConfirmationTemplate ||
      'Confirmed! Trip #{reservation_id} on {pickup_date}. Pickup: {pickup_address} at {pickup_time}. Passenger: {passenger_name}. Full details in app.';
    
    const message = this.renderSmsTemplate(template, driver, {
      ...offerDetails,
      pickupAddress: reservation.pickupLocation || reservation.pickup_location || offerDetails.pickupCity
    });
    
    try {
      await this.sendSms(phone, message, 'farmout_confirm', driver.id);
    } catch (e) {
      console.warn('[FarmoutAutomation] Failed to send confirmation SMS:', e);
    }
  }
  
  /**
   * Send rejection SMS when driver declines
   */
  async sendRejectionSms(driver) {
    const phone = driver.phone || driver.cell_phone || driver.mobile;
    if (!phone) return;
    
    const template = this.settings.smsRejectionTemplate ||
      'No worries! The trip has been offered to another driver.';
    
    const message = this.renderSmsTemplate(template, driver, {});
    
    try {
      await this.sendSms(phone, message, 'farmout_reject', driver.id);
    } catch (e) {
      console.warn('[FarmoutAutomation] Failed to send rejection SMS:', e);
    }
  }
  
  /**
   * Send expiry SMS when offer times out
   */
  async sendExpirySms(driver, offerDetails) {
    const phone = driver.phone || driver.cell_phone || driver.mobile;
    if (!phone) return;
    
    const template = this.settings.smsExpiryTemplate ||
      'The offer for {pickup_city} to {dropoff_city} on {pickup_date} has expired.';
    
    const message = this.renderSmsTemplate(template, driver, offerDetails);
    
    try {
      await this.sendSms(phone, message, 'farmout_expire', driver.id);
    } catch (e) {
      console.warn('[FarmoutAutomation] Failed to send expiry SMS:', e);
    }
  }

  /**
   * Handle driver response (accept/reject)
   */
  handleDriverResponse(reservationId, driverId, accepted, responseMethod = 'in_app') {
    const job = this.jobs.get(String(reservationId));
    
    if (accepted) {
      this.logAutomationEvent(reservationId, `✅ Driver accepted via ${responseMethod}!`);
      
      // Stop the job
      this.stopJob(reservationId, 'Driver accepted the offer.');
      
      // Assign driver to reservation
      this.assignDriverToReservation(reservationId, driverId);
      
      // Send confirmation SMS
      this.sendAcceptanceConfirmation(driverId, reservationId);
      
      // Update farmout status
      if (typeof this.reservationManager.updateFarmoutStatus === 'function') {
        this.reservationManager.updateFarmoutStatus(reservationId, 'assigned');
      }
      
      // Dispatch event
      window.dispatchEvent(new CustomEvent('farmoutOfferAccepted', {
        detail: { reservationId, driverId, responseMethod }
      }));
    } else {
      this.logAutomationEvent(reservationId, `❌ Driver declined via ${responseMethod}.`);
      
      // Clear the pending offer
      this.clearPendingOffer(reservationId, driverId);
      
      // Dispatch event
      window.dispatchEvent(new CustomEvent('farmoutOfferDeclined', {
        detail: { reservationId, driverId, responseMethod }
      }));
      
      // If job is still running, it will continue to next driver on timeout
    }
  }

  /**
   * Assign driver to the reservation
   */
  async assignDriverToReservation(reservationId, driverId) {
    try {
      const driver = this.driverTracker.getDriverById?.(driverId);
      if (!driver) return;
      
      // Get driver's assigned vehicle
      const vehicleId = driver.assigned_vehicle_id;
      
      // Update reservation with driver and vehicle
      if (this.reservationManager.assignDriver) {
        await this.reservationManager.assignDriver(reservationId, driverId, vehicleId);
      }
      
      // Update database with assigned status
      if (this.reservationManager.updateReservation) {
        await this.reservationManager.updateReservation(reservationId, {
          assigned_driver_id: driverId,
          assigned_driver_name: driver.name || `${driver.first_name || ''} ${driver.last_name || ''}`.trim(),
          farmout_status: 'assigned',
          status: 'farm_out_assigned',
          driver_status: 'assigned'
        });
      }
      
      // Add to email queue for notification
      const reservation = this.reservationManager.getReservationById(reservationId);
      if (driver.email && window.driverEmailQueue && reservation) {
        window.driverEmailQueue.addToQueue(reservation, driver, 'assignment');
        this.logAutomationEvent(reservationId, `📧 Email queued for ${driver.name || 'driver'}`);
      }
      
      this.logAutomationEvent(reservationId, `✅ Driver and vehicle assigned - trip is now UPCOMING for driver.`);
    } catch (e) {
      console.error('[FarmoutAutomation] Failed to assign driver:', e);
    }
  }

  /**
   * Send acceptance confirmation to driver
   */
  async sendAcceptanceConfirmation(driverId, reservationId) {
    try {
      const driver = this.driverTracker.getDriverById?.(driverId);
      if (!driver) return;
      
      const phone = driver.phone || driver.cell_phone || driver.mobile;
      const reservation = this.reservationManager.getReservationById(reservationId);
      const confNumber = reservation?.confirmationNumber || reservation?.confirmation_number || reservationId;
      const portalLink = `${window.location.origin}/driver-portal.html`;
      
      const message = `Great! You've been assigned to reservation ${confNumber}. View details: ${portalLink}`;
      
      if (phone && window.smsService?.sendSms) {
        await window.smsService.sendSms(phone, message);
      }
    } catch (e) {
      console.warn('[FarmoutAutomation] Failed to send confirmation:', e);
    }
  }

  /**
   * Clear pending offer for a driver
   */
  clearPendingOffer(reservationId, driverId) {
    try {
      const pendingOffers = JSON.parse(localStorage.getItem('pending_farmout_offers') || '{}');
      if (pendingOffers[driverId]) {
        pendingOffers[driverId] = pendingOffers[driverId].filter(o => o.reservationId !== reservationId);
        localStorage.setItem('pending_farmout_offers', JSON.stringify(pendingOffers));
      }
    } catch (e) {
      console.warn('[FarmoutAutomation] Failed to clear pending offer:', e);
    }
  }

  /**
   * Get pickup datetime from reservation
   */
  getPickupDateTime(reservation) {
    const puDate = reservation.pickupDate || reservation.pickup_date || reservation.puDate;
    const puTime = reservation.pickupTime || reservation.pickup_time || reservation.puTime;
    
    if (!puDate) return null;
    
    try {
      const dateTimeStr = puTime ? `${puDate} ${puTime}` : puDate;
      return new Date(dateTimeStr).getTime();
    } catch {
      return null;
    }
  }

  scheduleNextAttempt(job, purpose) {
    if (job.timeoutId) {
      clearTimeout(job.timeoutId);
    }

    const intervalMs = Math.max(1, this.settings.dispatchIntervalMinutes) * 60000;
    job.timeoutPurpose = purpose;
    job.nextAttemptAt = Date.now() + intervalMs;
    job.timeoutId = window.setTimeout(() => {
      job.timeoutId = null;
      if (purpose === 'offer') {
        this.sendNextOffer(job);
      } else {
        this.handleEscalation(job);
      }
    }, intervalMs);

    this.updateAutomationStatusDisplay(job.reservationId);
  }

  scheduleEscalation(job) {
    if (job.attemptedDriverIds.size === 0) {
      this.logAutomationEvent(job.reservationId, 'No available drivers to contact. Escalating immediately.');
      this.handleEscalation(job);
      return;
    }

    this.logAutomationEvent(job.reservationId, 'All available drivers notified. Waiting before escalation.');
    this.scheduleNextAttempt(job, 'escalate');
  }

  handleEscalation(job) {
    const reservation = this.reservationManager.getReservationById(job.reservationId);
    const summary = this.describeReservation(reservation);

    if (this.settings.recipients.length === 0) {
      this.logAutomationEvent(job.reservationId, 'Escalation attempted but no admin/dispatch contacts are configured.');
    } else {
      this.settings.recipients.forEach(recipient => {
        const recipientLabel = recipient.email || recipient.phone || recipient.identifier || 'recipient';
        this.logAutomationEvent(job.reservationId, `Escalation sent to ${recipientLabel}. Trip requires manual attention. ${summary}`);
      });
    }

    window.dispatchEvent(
      new CustomEvent('farmoutEscalation', {
        detail: {
          reservation,
          recipients: this.settings.recipients,
          summary
        }
      })
    );

    this.stopJob(job.reservationId, 'Escalation triggered.');
  }

  stopJob(reservationId, reason) {
    const job = this.jobs.get(String(reservationId));
    if (!job) {
      this.updateAutomationStatusDisplay(reservationId);
      return;
    }

    if (job.timeoutId) {
      clearTimeout(job.timeoutId);
    }

    this.jobs.delete(String(reservationId));

    if (reason) {
      this.logAutomationEvent(reservationId, reason);
    }

    this.updateAutomationStatusDisplay(reservationId);
  }

  describeReservation(reservation) {
    if (!reservation) {
      return '';
    }
    const passenger = reservation.passengerName || reservation.passenger_name || 'Passenger';
    const pickupTime = reservation.pickupTime || reservation.pickup_time || '';
    const pickupDate = reservation.pickupDate || reservation.pickup_date || '';
    const pickup = reservation.pickupLocation || reservation.pickup_location || '';
    return `${passenger} — ${pickupDate} ${pickupTime} — ${pickup}`.trim();
  }

  normalizeMode(mode) {
    const normalized = normalizeKey(mode || 'manual');
    if (normalized === 'auto' || normalized === 'automatic_dispatch' || normalized === 'auto_dispatch') {
      return 'automatic';
    }
    if (normalized === 'automatic' || normalized === 'manual') {
      return normalized;
    }
    return normalized || 'manual';
  }

  normalizeStatus(status) {
    return normalizeKey(status || 'unassigned');
  }

  isTerminalStatus(status) {
    return TERMINAL_FARMOUT_STATUSES.has(status);
  }

  logAutomationEvent(reservationId, message) {
    if (!message) {
      return;
    }
    if (reservationId) {
      this.uiManager?.logFarmoutActivity?.(reservationId, message);
    } else {
      console.info('[FarmoutAutomation]', message);
    }
    this.updateAutomationStatusDisplay(reservationId);
  }

  updateAutomationStatusDisplay(reservationId = null) {
    const statusEl = document.getElementById('farmoutAutomationStatus');
    if (!statusEl) {
      return;
    }

    const selectedId = this.uiManager?.selectedFarmoutReservationId ? String(this.uiManager.selectedFarmoutReservationId) : null;
    if (reservationId && selectedId && String(reservationId) !== selectedId) {
      return;
    }

    if (!selectedId) {
      statusEl.textContent = 'Auto-dispatch inactive for this trip';
      return;
    }

    const job = this.jobs.get(selectedId);
    if (job) {
      const now = Date.now();
      const msRemaining = job.nextAttemptAt ? job.nextAttemptAt - now : 0;
      if (job.timeoutPurpose === 'offer') {
        statusEl.textContent = `Auto-dispatch active • next driver in ${formatCountdown(msRemaining)}`;
      } else if (job.timeoutPurpose === 'escalate') {
        statusEl.textContent = `Awaiting driver responses • escalation in ${formatCountdown(msRemaining)}`;
      } else {
        statusEl.textContent = 'Auto-dispatch active';
      }
      return;
    }

    const reservation = this.reservationManager.getReservationById(selectedId);
    const mode = this.normalizeMode(reservation?.farmoutMode || reservation?.farmout_mode);
    const status = this.normalizeStatus(reservation?.farmoutStatus || reservation?.farmout_status);
    if (mode === 'automatic' && !this.isTerminalStatus(status)) {
      statusEl.textContent = 'Auto-dispatch idle • awaiting next trigger';
    } else {
      statusEl.textContent = 'Auto-dispatch inactive for this trip';
    }
  }

  handleReservationSelected(reservation) {
    this.refreshSettingsControls();
    this.updateAutomationStatusDisplay(reservation?.id ? String(reservation.id) : null);
  }

  handleReservationCreated(reservation) {
    if (!reservation) {
      return;
    }
    if (this.shouldAutoDispatch(reservation)) {
      this.ensureJob(reservation);
    } else {
      this.updateAutomationStatusDisplay(reservation.id);
    }
  }
  
  /**
   * Static method to process incoming SMS from a webhook
   * This can be called from an API endpoint that receives Twilio webhook POSTs
   * 
   * Usage in a webhook handler:
   *   FarmoutAutomationService.processIncomingSms({ from: '+1234567890', body: 'Y' });
   */
  static processIncomingSms(smsData) {
    // Dispatch an event that the service listens for
    window.dispatchEvent(new CustomEvent('incomingSmsReceived', {
      detail: smsData
    }));
    console.log('[FarmoutAutomation] SMS webhook received:', smsData.from);
  }
  
  /**
   * Get all pending offers for admin dashboard
   */
  getPendingOffers() {
    const pending = [];
    for (const [reservationId, job] of this.jobs) {
      if (job.status === 'running' || job.status === 'queued') {
        pending.push({
          reservationId,
          status: job.status,
          attemptedDrivers: Array.from(job.attemptedDriverIds),
          currentDriverIndex: job.currentDriverIndex,
          totalDrivers: job.prioritizedDriverList.length,
          nextAttemptAt: job.nextAttemptAt
        });
      }
    }
    return pending;
  }
  
  /**
   * Get automation stats
   */
  getAutomationStats() {
    return {
      activeJobs: this.jobs.size,
      completedJobs: Array.from(this.jobs.values()).filter(j => j.status === 'completed').length,
      settings: { ...this.settings }
    };
  }
  
  /**
   * Manually trigger a driver response (for admin override)
   */
  adminOverrideAccept(reservationId, driverId) {
    this.handleDriverResponse(reservationId, driverId, true, 'admin_override');
  }
}
