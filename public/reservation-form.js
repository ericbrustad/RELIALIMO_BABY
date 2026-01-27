import { AccountManager } from './AccountManager.js';
import { CostCalculator } from './CostCalculator.js';
import { googleMapsService } from './GoogleMapsService.js';
import { AirlineService } from './AirlineService.js';
import { AffiliateService } from './AffiliateService.js';
import { fetchDrivers, setupAPI, listDriverNames, listActiveVehiclesLight, listActiveVehicleTypes, fetchVehicleTypes, fetchActiveVehicles, fetchFleetVehicles } from './api-service.js';
import './CompanySettingsManager.js';
import supabaseDb from './supabase-db.js';
import { wireMainNav } from './navigation.js';
import { loadServiceTypes, SERVICE_TYPES_STORAGE_KEY } from './service-types-store.js';
import { LocalAirportsService } from './LocalAirportsService.js';

// Use Supabase-only database (no localStorage)
const db = supabaseDb;

const FARMOUT_STATUS_ALIASES = {
  '': '',
  farm_out_unassigned: 'unassigned',
  farmout_unassigned: 'unassigned',
  created_farm_out_unassigned: 'unassigned',
  created_farmout_unassigned: 'unassigned',
  farm_out_assigned: 'assigned',
  farmout_assigned: 'assigned',
  created_farm_out_assigned: 'assigned',
  created_farmout_assigned: 'assigned',
  farm_out_offered: 'offered',
  farmout_offered: 'offered',
  farm_out_declined: 'declined',
  farmout_declined: 'declined',
  farm_out_completed: 'completed',
  farmout_completed: 'completed',
  done: 'completed',
  en_route: 'enroute',
  enroute: 'enroute',
  passenger_on_board: 'passenger_onboard',
  passenger_on_boarded: 'passenger_onboard',
  passenger_on_boarding: 'passenger_onboard',
  inhouse: 'in_house',
  'in-house': 'in_house',
  in_house_dispatch: 'in_house'
};

const FARMOUT_STATUS_LABELS = {
  unassigned: 'Farm-out Unassigned',
  farm_out_unassigned: 'Farm-out Unassigned',
  farmout_unassigned: 'Farm-out Unassigned',
  offered: 'Farm-out Offered',
  assigned: 'Farm-out Assigned',
  farm_out_assigned: 'Farm-out Assigned',
  farmout_assigned: 'Farm-out Assigned',
  declined: 'Farm-out Declined',
  enroute: 'Farm-out En Route',
  en_route: 'Farm-out En Route',
  arrived: 'Farm-out Arrived',
  passenger_onboard: 'Passenger On Board',
  passenger_on_board: 'Passenger On Board',
  completed: 'Farm-out Completed',
  in_house: 'In-house Dispatch',
  inhouse: 'In-house Dispatch',
  offered_to_affiliate: 'Offered to Affiliate',
  affiliate_assigned: 'Affiliate Assigned',
  affiliate_driver_assigned: 'Affiliate Driver Assigned',
  driver_en_route: 'Driver En Route',
  on_the_way: 'Driver On The Way',
  driver_waiting_at_pickup: 'Driver Waiting at Pickup',
  waiting_at_pickup: 'Waiting at Pickup',
  driver_circling: 'Driver Circling',
  customer_in_car: 'Customer In Car',
  driving_passenger: 'Driving Passenger',
  cancelled: 'Farm-out Cancelled',
  cancelled_by_affiliate: 'Cancelled by Affiliate',
  late_cancel: 'Late Cancel',
  late_cancelled: 'Late Cancelled',
  no_show: 'No Show',
  covid19_cancellation: 'COVID-19 Cancellation',
  done: 'Trip Done'
};

function normalizeFarmoutKey(value) {
  return value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/__+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function canonicalizeFarmoutStatus(status) {
  if (!status) {
    return '';
  }
  const normalized = normalizeFarmoutKey(status);
  const alias = FARMOUT_STATUS_ALIASES[normalized];
  return alias || normalized;
}

function canonicalizeFarmoutMode(mode) {
  if (!mode) {
    return 'manual';
  }
  const normalized = normalizeFarmoutKey(mode);
  if (normalized === 'auto' || normalized === 'auto_dispatch' || normalized === 'automatic_dispatch') {
    return 'automatic';
  }
  if (normalized === 'automatic' || normalized === 'manual') {
    return normalized;
  }
  return normalized || 'manual';
}

function formatFarmoutStatus(status) {
  const canonical = canonicalizeFarmoutStatus(status);
  if (!canonical) {
    return FARMOUT_STATUS_LABELS.unassigned;
  }

  if (Object.prototype.hasOwnProperty.call(FARMOUT_STATUS_LABELS, canonical)) {
    return FARMOUT_STATUS_LABELS[canonical];
  }

  return canonical
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

const RESERVATION_DRAFT_KEY = 'relia_reservation_draft';

// Global function to create a new reservation
function createNewReservation() {
  // Send message to parent to clear conf and reload
  const targetWindow = window.top || window.parent || window;
  if (targetWindow === window) {
    const timestamp = Date.now();
    window.location.href = `reservation-form.html?_new=${timestamp}`;
    return;
  }
  targetWindow.postMessage({
    action: 'newReservation'
  }, '*');
}

// Expose for inline onclick handlers
window.createNewReservation = createNewReservation;

class ReservationForm {
  constructor() {
    this.accountManager = new AccountManager();
    this.costCalculator = new CostCalculator();
    this.googleMapsService = googleMapsService;
    this.localCityState = this.getLocalCityStateString();
    this.localBiasCoords = null;
    this.airlineService = new AirlineService();
    this.affiliateService = new AffiliateService();
    const SettingsCtor = window.CompanySettingsManager;
    if (SettingsCtor) {
      this.companySettingsManager = new SettingsCtor();
    } else {
      console.warn('⚠️ CompanySettingsManager not available; confirmation settings will use defaults');
      this.companySettingsManager = null;
    }
    this.pendingAccountNumber = null;
    this.stops = [];
    this.selectedAirline = null;
    this.selectedFlight = null;
    this.selectedAffiliate = null;

    this.isViewMode = this.detectViewMode();
    this.viewModeApplied = false;
    this.viewModeReady = false;
    this.viewConfNumber = null;

    this.isEditMode = false;
    this.editConfNumber = null;
    this.createdDateTime = null;
    this.dateTimeInterval = null;
    this.dateTimeFrozen = false;
    this.vehicleTypeRates = {};
    this.latestRouteSummary = null;
    
    // Driver-Vehicle assignment mappings for auto-selection
    this.driverToVehicleMap = {}; // driver.id -> vehicle.id
    this.vehicleToDriverMap = {}; // vehicle.id -> driver.id
    this.driversData = []; // Full driver data with assigned_vehicle_id
    this.vehiclesData = []; // Full vehicle data with assigned_driver_id
    
    this.init();
  }

  getLocalCityStateString() {
    try {
      // Prefer explicit company city/state from settings, fallback to ticker search city, then global local city/state
      const settings = JSON.parse(localStorage.getItem('relia_company_settings') || '{}');

      const companyCityStateZip = [settings.companyCity, settings.companyState, settings.companyZip]
        .map(part => (part || '').toString().trim())
        .filter(Boolean)
        .join(', ');
      if (companyCityStateZip) return companyCityStateZip;

      const tickerCity = (settings.tickerSearchCity || '').toString();
      const tickerParts = tickerCity.split(',').map(p => p.trim()).filter(Boolean);
      if (tickerParts.length) return tickerParts.join(', ');

      if (window.LOCAL_CITY_STATE && (window.LOCAL_CITY_STATE.city || window.LOCAL_CITY_STATE.state)) {
        const { city, state } = window.LOCAL_CITY_STATE;
        return [city, state].filter(Boolean).join(', ');
      }

      return '';
    } catch (e) {
      console.warn('⚠️ Failed to read local city/state from settings:', e);
      return '';
    }
  }

  refreshLocalBiasFromSettings() {
    try {
      // Re-read company city/state/zip so address bias follows latest settings
      const updated = this.getLocalCityStateString();
      this.localCityState = updated;
      this.localBiasCoords = null; // force re-geocode on next lookup

      if (updated) {
        // Warm the bias lookup in the background; ignore failures
        this.ensureLocalBiasCoords().catch(() => {});
      }
    } catch (e) {
      console.warn('⚠️ [ReservationForm] Failed to refresh local bias from settings:', e);
    }
  }

  async ensureLocalBiasCoords() {
    if (this.localBiasCoords || !this.localCityState) return this.localBiasCoords;
    try {
      const geo = await this.googleMapsService.geocodeAddress(this.localCityState);
      if (geo?.latitude && geo?.longitude) {
        this.localBiasCoords = { latitude: geo.latitude, longitude: geo.longitude };
      }
    } catch (e) {
      console.warn('⚠️ Failed to geocode local city/state for bias:', e);
    }
    return this.localBiasCoords;
  }

  detectViewMode() {
    try {
      // Check if user is admin or dispatcher - they should never be in view mode
      const userRole = this.getUserRole();
      if (userRole) {
        const normalizedRole = userRole.toLowerCase();
        if (normalizedRole === 'admin' || normalizedRole === 'dispatcher' || normalizedRole === 'dispatch') {
          console.log('👤 [ReservationForm] View mode disabled for', normalizedRole, 'user');
          return false;
        }
      }
      
      // Any authenticated staff member should have edit access (not view mode)
      if (this.isAuthenticatedStaff()) {
        console.log('👤 [ReservationForm] View mode disabled for authenticated staff');
        return false;
      }

      const settingValue = this.companySettingsManager?.getSetting?.('enableReservationViewMode');
      if (settingValue === false || settingValue === 'false' || settingValue === '0') {
        return false;
      }

      if (window.RELIA_VIEW_MODE === true || window.RELIA_VIEW_MODE === 'true') {
        return true;
      }

      const datasetValue = window.frameElement?.dataset?.viewMode;
      if (datasetValue) {
        const normalized = datasetValue.toString().toLowerCase();
        if (['1', 'true', 'view', 'readonly', 'read', 'yes', 'y'].includes(normalized)) {
          return true;
        }
        if (['0', 'false', 'no', 'n'].includes(normalized)) {
          return false;
        }
      }

      const params = new URLSearchParams(window.location.search || '');
      const modeParam = params.get('mode') || params.get('viewMode');
      if (modeParam) {
        const normalized = modeParam.toString().toLowerCase();
        if (['view', 'readonly', 'read', 'ro', '1', 'true'].includes(normalized)) {
          return true;
        }
      }
    } catch (error) {
      console.warn('⚠️ [ReservationForm] detectViewMode error:', error);
    }
    return false;
  }

  /**
   * Get the current user's role from session/localStorage
   * Also checks for known admin user IDs
   */
  getUserRole() {
    try {
      // Known admin user IDs - always have admin access
      const ADMIN_USER_IDS = [
        '99d34cd5-a593-4362-9846-db7167276592' // Eric - primary admin
      ];

      // Check localStorage for session
      const sessionRaw = localStorage.getItem('supabase_session');
      if (sessionRaw) {
        const session = JSON.parse(sessionRaw);
        const user = session?.user;
        if (user) {
          // Check if user ID is in the known admin list
          if (user.id && ADMIN_USER_IDS.includes(user.id)) {
            console.log('👤 [ReservationForm] Known admin user detected:', user.id);
            return 'admin';
          }
          
          // Check role in various locations
          const role = user.role || user.user_metadata?.role || user.app_metadata?.role;
          if (role) {
            return role;
          }
          
          // If user is authenticated (has valid session), treat as staff with edit access
          // This is a fallback - authenticated users should have edit access
          if (user.id && session.access_token) {
            console.log('👤 [ReservationForm] Authenticated user detected, granting edit access:', user.email || user.id);
            return 'dispatch'; // Give dispatch-level access to authenticated users
          }
        }
      }
      
      // Fallback: check window.currentUser if set
      if (window.currentUser) {
        if (window.currentUser.id && ADMIN_USER_IDS.includes(window.currentUser.id)) {
          return 'admin';
        }
        return window.currentUser.role || window.currentUser.user_metadata?.role || window.currentUser.app_metadata?.role || null;
      }
    } catch (e) {
      console.warn('⚠️ [ReservationForm] getUserRole error:', e);
    }
    return null;
  }

  /**
   * Check if the current user is an authenticated staff member
   */
  isAuthenticatedStaff() {
    try {
      const sessionRaw = localStorage.getItem('supabase_session');
      if (sessionRaw) {
        const session = JSON.parse(sessionRaw);
        // If there's a valid access token and user, they're authenticated staff
        if (session?.access_token && session?.user?.id) {
          return true;
        }
      }
    } catch (e) {
      console.warn('⚠️ [ReservationForm] isAuthenticatedStaff error:', e);
    }
    return false;
  }

  prepareViewModeShell() {
    document.body.classList.add('view-mode');
    document.body.dataset.viewMode = 'true';

    if (!this.viewConfNumber) {
      const fromDataset = window.frameElement?.dataset?.confNumber;
      if (fromDataset) {
        this.viewConfNumber = fromDataset;
      }
    }

    const attention = document.querySelector('.attention-warning');
    if (attention) {
      attention.classList.add('view-mode-banner');
      attention.innerHTML = '<strong>VIEW MODE:</strong> Loading reservation details...';
    }

    const closeBtn = document.getElementById('closeFormBtn');
    if (closeBtn) {
      closeBtn.style.display = 'inline-block';
      closeBtn.disabled = false;
      closeBtn.classList.add('view-mode-allow');
    }

    const newReservationBtn = document.querySelector('button[onclick="createNewReservation()"]');
    if (newReservationBtn) {
      newReservationBtn.classList.add('view-mode-allow');
      if (!newReservationBtn.id) {
        newReservationBtn.id = 'newReservationBtn';
      }
    }
  }

  finalizeViewMode() {
    if (!this.isViewMode || this.viewModeApplied) {
      return;
    }

    this.viewModeApplied = true;
    document.body.classList.add('view-mode-ready');

    const attention = document.querySelector('.attention-warning');
    if (attention) {
      attention.innerHTML = '<strong>VIEW MODE:</strong> This reservation is read-only. Click "Edit Reservation" to make changes.';
      attention.classList.add('view-mode-banner-active');
    }

    const headerButtons = document.querySelector('.header-content > div:last-child');
    if (headerButtons && !document.getElementById('editReservationBtn')) {
      const editBtn = document.createElement('button');
      editBtn.id = 'editReservationBtn';
      editBtn.textContent = '✏️ Edit Reservation';
      editBtn.style.cssText = 'padding: 8px 16px; background: rgba(255,255,255,0.3); color: white; border: 1px solid rgba(255,255,255,0.5); border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: bold;';
      editBtn.classList.add('view-mode-allow');
      editBtn.addEventListener('click', () => this.triggerEditMode());
      headerButtons.insertBefore(editBtn, headerButtons.firstChild);
    }

    const closeBtn = document.getElementById('closeFormBtn');
    if (closeBtn) {
      closeBtn.style.display = 'inline-block';
      closeBtn.disabled = false;
      closeBtn.classList.add('view-mode-allow');
    }

    const inputs = document.querySelectorAll('input, textarea');
    inputs.forEach((field) => {
      if (field.type === 'hidden') {
        return;
      }
      if (field.type === 'checkbox' || field.type === 'radio') {
        field.disabled = true;
      } else {
        field.setAttribute('readonly', 'readonly');
      }
      field.classList.add('view-mode-field');
    });

    document.querySelectorAll('select').forEach((select) => {
      select.disabled = true;
      select.classList.add('view-mode-field');
    });

    document.querySelectorAll('button').forEach((btn) => {
      if (btn.classList.contains('view-mode-allow')) {
        return;
      }
      const isNewReservation = btn.getAttribute('onclick') === 'createNewReservation()';
      if (isNewReservation) {
        btn.classList.add('view-mode-allow');
        return;
      }
      btn.disabled = true;
      btn.classList.add('view-mode-disabled-button');
    });

    const selectorsToHide = [
      '#saveBtn',
      '#saveReservationBtn',
      '#deleteBtn',
      '#deleteReservationBtn',
      '#createStopBtn',
      '#clearStopBtn',
      '.btn-edit',
      '.btn-remove',
      '.btn-save',
      '.btn-add'
    ];
    selectorsToHide.forEach((selector) => {
      document.querySelectorAll(selector).forEach((el) => {
        el.style.display = 'none';
      });
    });

    const addressEntryCard = document.querySelector('.address-entry-card');
    if (addressEntryCard) {
      addressEntryCard.style.display = 'none';
    }

    document.body.dataset.viewModeReady = 'true';
    this.viewModeReady = true;
    window.dispatchEvent(new Event('reliaReservationViewReady'));
  }

  triggerEditMode() {
    const targetWindow = window.top || window.parent || window;
    const conf = this.viewConfNumber || this.editConfNumber || this.getConfFromUrl();
    if (!conf) {
      console.warn('⚠️ [ReservationForm] No confirmation number available for edit request');
      return;
    }
    targetWindow.postMessage({
      action: 'editReservation',
      conf
    }, '*');
  }

  async init() {
    console.log('🚀 ReservationForm initializing...');
    await this.loadServiceTypesIntoDropdown();
    console.log('✅ this keyword available:', !!this);
    console.log('👀 [ReservationForm] View mode enabled:', this.isViewMode);
    if (this.isViewMode) {
      this.prepareViewModeShell();
    }
    
    try {
      // Check if radio buttons exist
      const radioButtons = document.querySelectorAll('input[name="locationType"]');
      console.log('📻 Found location type radio buttons:', radioButtons.length);
      radioButtons.forEach(rb => {
        console.log('  - Radio button:', rb.id, rb.value);
      });
      
      // Detect edit mode (?conf=...)
      const conf = this.getConfFromUrl();
      console.log('🔍 [ReservationForm] getConfFromUrl result:', conf);
      if (conf) {
        this.isEditMode = true;
        this.editConfNumber = conf;
        this.viewConfNumber = conf;
        console.log('✅ [ReservationForm] Edit mode enabled for conf:', conf);
      } else {
        console.log('ℹ️ [ReservationForm] No conf in URL, creating new reservation');
      }

      // Initialize confirmation number
      await this.initializeConfirmationNumber();
      console.log('✅ initializeConfirmationNumber complete');
      
      // Check authentication status
      await this.checkAuthenticationStatus();
      console.log('✅ Authentication check complete');

      // Start waiting for Supabase session in background but do NOT block loading reference data
      // This allows anonymous/public reads (e.g., vehicle_types) to load immediately while session
      // hydrating continues in parallel.
      this.waitForAuthSession('loadReferenceData').catch(() => {});

      await this.loadReferenceData();
      console.log('✅ Driver/vehicle reference data loaded');
      // Refresh address bias using the latest company location
      this.refreshLocalBiasFromSettings();
      
      this.setupEventListeners();
      console.log('✅ setupEventListeners complete');

      // Warn if leaving with unsaved changes
      window.addEventListener('beforeunload', (e) => {
        if (this.dirty) {
          e.preventDefault();
          e.returnValue = '';
        }
      });
      
      this.initializeCostCalculations();
      console.log('✅ initializeCostCalculations complete');
      
      this.initializeDateTime();
      console.log('✅ initializeDateTime complete');
      
      this.setupTabSwitching();
      console.log('✅ setupTabSwitching complete');

      // Ensure location label reflects latest copy even if HTML is cached
      const locationLabel = document.querySelector('.address-entry label');
      if (locationLabel) locationLabel.textContent = 'Location Description/ Name';

      // Initialize eFarm Status as blank (not in farmout table by default)
      this.updateEFarmStatus('');
      this.setFarmoutModeSelect('manual');

      // Make Stored Routing rows movable
      try {
        this.setupStoredRoutingDragAndDrop();
      } catch (e) {
        console.warn('⚠️ setupStoredRoutingDragAndDrop failed:', e);
      }

      // Listen for Account saves (popup or iframe) so we can return and fill Billing Account#
      window.addEventListener('message', async (event) => {
        // Handle account saves
        if (event?.data?.action !== 'relia:accountSaved') return;
        const accountId = (event.data.accountId || event.data.accountNumber || '').toString().trim();
        if (!accountId) return;
        
        console.log('📥 Received accountSaved message:', event.data);

        const billingAccountSearch = document.getElementById('billingAccountSearch');
        if (billingAccountSearch) {
          billingAccountSearch.value = accountId;
        }

        // Refresh accounts from database to get the new/updated account
        try {
          const freshAccounts = await db.getAllAccounts();
          const account = freshAccounts?.find(a => 
            (a?.account_number ?? a?.id)?.toString() === accountId || 
            (a?.id ?? '').toString() === accountId ||
            (a?.id ?? '').toString() === event.data.accountId
          );
          
          if (account) {
            console.log('✅ Found saved account:', account.account_number, account.company_name);
            this.useExistingAccount(account);
          } else {
            console.log('⚠️ Account not found in refreshed list, setting display only');
            this.setBillingAccountNumberDisplay(accountId);
          }
        } catch (e) {
          console.error('❌ Error refreshing accounts after save:', e);
          this.setBillingAccountNumberDisplay(accountId);
        }

        // If we returned via same-window redirect, also clear the return URL
        try { localStorage.removeItem('relia_return_to_reservation_url'); } catch { /* ignore */ }
        try { window.focus(); } catch { /* ignore */ }
      });

      // Check if we returned from accounts page with a new account
      await this.checkForNewAccountFromReturn();

      // Restore existing reservation or apply a draft copy
      if (this.isEditMode && this.editConfNumber) {
        await this.loadExistingReservation(this.editConfNumber);
      } else {
        this.applyReservationDraftIfPresent();
        this.applyCompanyStateDefault();
      }
      
      console.log('✅ ReservationForm.init() finished successfully');
      
      // Check for test parameters and auto-fill if present
      this.checkForTestData();
    } catch (error) {
      console.error('❌ Error during init:', error);
    }
  }

  /**
   * Check URL for newAccountId parameter (from same-window account creation return)
   * and load that account into the billing section
   */
  async checkForNewAccountFromReturn() {
    try {
      const params = new URLSearchParams(window.location.search);
      const newAccountId = params.get('newAccountId');
      
      if (!newAccountId) return;
      
      console.log('📥 Found newAccountId from return:', newAccountId);
      
      // Clean up the URL by removing the parameter
      const url = new URL(window.location.href);
      url.searchParams.delete('newAccountId');
      window.history.replaceState({}, '', url.toString());
      
      // Fetch fresh accounts and find the new one
      const freshAccounts = await db.getAllAccounts();
      const account = freshAccounts?.find(a => 
        (a?.account_number ?? a?.id)?.toString() === newAccountId || 
        (a?.id ?? '').toString() === newAccountId
      );
      
      if (account) {
        console.log('✅ Found new account from return:', account.account_number, account.company_name);
        this.useExistingAccount(account);
      } else {
        console.log('⚠️ New account not found, setting search field only');
        const billingAccountSearch = document.getElementById('billingAccountSearch');
        if (billingAccountSearch) {
          billingAccountSearch.value = newAccountId;
        }
        this.setBillingAccountNumberDisplay(newAccountId);
      }
    } catch (e) {
      console.error('❌ Error checking for new account from return:', e);
    }
  }

  applyCompanyStateDefault() {
    try {
      this.refreshLocalBiasFromSettings();
      if (this.isEditMode) return;

      const stateSelect = document.getElementById('state');
      if (!stateSelect) return;
      const current = (stateSelect.value || '').trim();
      if (current) return; // respect existing/draft value

      const settings = JSON.parse(localStorage.getItem('relia_company_settings') || '{}');
      const companyState = (settings.companyState || '').toString().trim().toUpperCase();
      if (!companyState) return;

      const match = Array.from(stateSelect.options).find(opt => opt.value.toUpperCase() === companyState);
      if (match) {
        stateSelect.value = match.value;
        console.log('[ReservationForm] Applied company default state to address form:', companyState);
      }
    } catch (e) {
      console.warn('⚠️ [ReservationForm] Failed to apply company state default:', e);
    }
  }

  setBillingAccountNumberDisplay(value) {
    const el = document.getElementById('billingAccountNumberDisplay');
    if (!el) return;
    el.textContent = (value ?? '').toString().trim();
  }

  updateBillingAccountNumberDisplay(account) {
    const accountNumber = (account?.account_number || account?.id || '').toString().trim();
    this.setBillingAccountNumberDisplay(accountNumber);
  }

  tryResolveBillingAccountAndUpdateDisplay() {
    const input = document.getElementById('billingAccountSearch');
    if (!input) return;
    const raw = (input.value || '').toString().trim();
    if (!raw) {
      this.setBillingAccountNumberDisplay('');
      return;
    }

    // Extract leading account number if the field contains "12345 - Name"
    const candidate = raw.split('-')[0]?.trim() || raw;

    try {
      const account = db.getAllAccounts()?.find(a => {
        const id = (a?.id ?? '').toString();
        const acct = (a?.account_number ?? '').toString();
        return id === candidate || acct === candidate;
      });
      if (account) {
        this.updateBillingAccountNumberDisplay(account);
        return;
      }
    } catch {
      // ignore
    }

    // If we can't resolve the account, show the candidate (still useful when user manually typed it)
    this.setBillingAccountNumberDisplay(candidate);
  }
  
  async loadReferenceData() {
    // Load drivers & vehicles in parallel (faster and prevents one failure from blocking the other).
    const results = await Promise.allSettled([
      this.loadDrivers(),
      this.loadVehicleTypes()
    ]);

    const rejected = results.filter(r => r.status === 'rejected');
    if (rejected.length) {
      console.warn('⚠️ One or more reference loads failed:', rejected.map(r => r.reason));
    }
  }

  async loadDrivers() {
    const primary = document.getElementById('driverSelect');
    const secondary = document.getElementById('secondaryDriverSelect');

    const render = (el, opts) => {
      if (!el) return;
      if (!opts || !opts.length) {
        el.innerHTML = '<option value="">-- No drivers found --</option>';
        return;
      }
      el.innerHTML = '<option value="">-- Select Driver --</option>' + opts
        .map(o => `<option value="${o.value}">${o.label}</option>`)
        .join('');
    };

    const isActive = (d) => {
      const flag = (d?.status || d?.driver_status || '').toString().trim().toUpperCase();
      if (!flag) return true; // treat empty as active
      return ['Y', 'YES', 'ACTIVE', 'TRUE', 'T', '1'].includes(flag);
    };

    const buildOptions = (list) => {
      return Array.isArray(list) && list.length
        ? list
            .filter(isActive)
            .map(d => {
              const name = (d.dispatch_display_name || [d.first_name, d.last_name].filter(Boolean).join(' ')).trim() || 'Unnamed Driver';
              return { value: d.id || name, label: name, assigned_vehicle_id: d.assigned_vehicle_id || null };
            })
        : [];
    };

    // Build driver-to-vehicle mapping
    const buildDriverVehicleMap = (list) => {
      if (!Array.isArray(list)) return;
      this.driversData = list.filter(isActive);
      this.driverToVehicleMap = {};
      this.driversData.forEach(d => {
        if (d.id && d.assigned_vehicle_id) {
          this.driverToVehicleMap[d.id] = d.assigned_vehicle_id;
        }
      });
      console.log('[loadDrivers] Built driver-to-vehicle map:', Object.keys(this.driverToVehicleMap).length, 'mappings');
    };

    try {
      await setupAPI();
      // Start session hydration in background but do not block driver loading so anon/public reads can work
      this.waitForAuthSession('drivers').catch(() => {});
      const driversRaw = await listDriverNames({ limit: 200, offset: 0 });
      buildDriverVehicleMap(driversRaw);
      let options = buildOptions(driversRaw);
      let source = 'listDriverNames';

      if (!options.length) {
        try {
          const fallbackDrivers = await fetchDrivers();
          buildDriverVehicleMap(fallbackDrivers);
          const fallbackOptions = buildOptions(fallbackDrivers);
          if (fallbackOptions.length) {
            options = fallbackOptions;
            source = 'fetchDrivers';
          }
        } catch (fallbackErr) {
          console.warn('⚠️ fetchDrivers fallback failed:', fallbackErr);
        }
      }

      render(primary, options);
      render(secondary, options);

      console.log('[loadDrivers] option counts', { count: options.length, source });
    } catch (error) {
      console.error('❌ Error loading drivers:', error);

      try {
        const fallbackDrivers = await fetchDrivers();
        buildDriverVehicleMap(fallbackDrivers);
        const fallbackOptions = buildOptions(fallbackDrivers);
        if (fallbackOptions.length) {
          render(primary, fallbackOptions);
          render(secondary, fallbackOptions);
          console.log('[loadDrivers] recovered with fetchDrivers fallback', { count: fallbackOptions.length });
          return;
        }
      } catch (fallbackErr) {
        console.warn('⚠️ Driver fallback failed after error:', fallbackErr);
      }

      if (primary) primary.innerHTML = '<option value="">-- Error loading drivers --</option>';
      if (secondary) secondary.innerHTML = '<option value="">-- Error loading drivers --</option>';
    }
  }

  async loadVehicleTypes() {
    const primaryCar = document.getElementById('carSelect');
    const secondaryCar = document.getElementById('secondaryCarSelect');
    const vehicleTypeSelect = document.getElementById('vehicleTypeRes');

    const render = (el, options, placeholder = '-- Select Vehicle Type --') => {
      if (!el) return;
      if (!options.length) {
        el.innerHTML = '<option value="">-- No vehicle types found --</option>';
        return;
      }
      el.innerHTML = `<option value="">${placeholder}</option>` + options
        .map(o => `<option value="${o.value}">${o.label}</option>`)
        .join('');
    };

    try {
      await setupAPI();

      // Start session hydration in background but do not block vehicle/vehicle-type loading
      this.waitForAuthSession('vehicleTypes').catch(() => {});

      let vehicles = [];
      try {
        vehicles = await listActiveVehiclesLight({ limit: 200, offset: 0 });
      } catch (err) {
        console.warn('⚠️ listActiveVehiclesLight failed; continuing with vehicle types only:', err);
      }

      if (!vehicles || !vehicles.length) {
        try {
          vehicles = await fetchActiveVehicles({ includeInactive: false });
          console.log('[loadVehicleTypes] used fetchActiveVehicles fallback', { count: Array.isArray(vehicles) ? vehicles.length : 0 });
        } catch (err) {
          console.warn('⚠️ fetchActiveVehicles fallback failed:', err);
        }
      }

      const normalizeVehicleTypeName = (name) => {
        if (!name) return '';
        return name.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
      };

      // Prefer full vehicle types (with rates) when available; fall back to lightweight list
      let vehicleTypes = [];
      try {
        vehicleTypes = await fetchVehicleTypes({ includeInactive: false });
      } catch (e) {
        console.warn('⚠️ fetchVehicleTypes failed, falling back to listActiveVehicleTypes:', e);
      }
      if (!Array.isArray(vehicleTypes) || !vehicleTypes.length) {
        vehicleTypes = await listActiveVehicleTypes({ limit: 200, offset: 0 });
      }

      // Filter to active only (defensive in case data is cached/legacy)
      const isActive = (v) => {
        const flag = (v?.veh_active || v?.status || '').toString().trim().toUpperCase();
        if (!flag) return true; // treat empty as active
        return ['Y', 'YES', 'ACTIVE', 'TRUE', 'T', '1'].includes(flag);
      };

      const activeVehicles = Array.isArray(vehicles) ? vehicles.filter(isActive) : [];

      // Keep active vehicles available for driver->vehicle mapping
      this.activeVehicles = activeVehicles;
      this.vehicleIdToVehicle = {};
      this.activeVehicles.forEach(v => { if (v && v.id) this.vehicleIdToVehicle[v.id] = v; });
      const typeOptionsFromTable = Array.isArray(vehicleTypes) && vehicleTypes.length
        ? vehicleTypes.map(t => {
            const name = normalizeVehicleTypeName(t.name || t.code || 'Vehicle Type');
            return {
              value: name, // Use name as value so it's human-readable when saved
              label: name,
              id: t.id, // Keep ID for rate lookups
              raw: t
            };
          })
        : [];

      const typeOptionsFallback = activeVehicles.length
        ? Array.from(new Set(activeVehicles.map(v => v.veh_type || v.veh_disp_name || v.veh_title || 'Vehicle')))
            .map(t => {
              const label = normalizeVehicleTypeName(t);
              return { value: label, label };
            })
        : [];

      const mergedOptions = [];
      const seen = new Set();
      const pushUnique = (arr) => {
        arr.forEach((o) => {
          const key = normalizeVehicleTypeName(o.label || o.value || '').toLowerCase();
          if (!key || seen.has(key)) return;
          seen.add(key);
          mergedOptions.push({ value: o.value || o.label, label: o.label || o.value || 'Vehicle Type', raw: o.raw });
        });
      };

      pushUnique(typeOptionsFromTable);
      pushUnique(typeOptionsFallback);

      // If still empty and we had a valid session, surface a clear warning instead of seeding a fake "Vehicle" entry.
      if (!mergedOptions.length && session) {
        const message = '-- No vehicle types found (check organization membership or data) --';
        render(vehicleTypeSelect, [], message);
        render(primaryCar, [], message);
        render(secondaryCar, [], message);
        return;
      }

      // Offline/unauthenticated safety net: seed a minimal list only when no data AND no session was available.
      if (!mergedOptions.length) {
        const defaultSeedTypes = ['Sedan', 'SUV', 'Sprinter', 'Van', 'Bus', 'Mini Coach', 'Motorcoach', 'Stretch Limo'];
        defaultSeedTypes.forEach((t) => mergedOptions.push({ value: t, label: t }));
      }

      // Capture rate metadata for downstream cost application
      this.vehicleTypeRates = {};
      // Store full vehicle type data for service type filtering
      this.allVehicleTypeOptions = mergedOptions;
      typeOptionsFromTable.forEach((opt) => {
        const rates = opt.raw?.rates || opt.raw?.metadata?.rates || null;
        if (opt.value && rates && Object.keys(rates).length > 0) {
          this.vehicleTypeRates[opt.value] = rates;
        }
      });

      const typeOptions = mergedOptions.map(({ value, label }) => ({ value, label }));

      render(primaryCar, typeOptions);
      render(secondaryCar, typeOptions);
      render(vehicleTypeSelect, typeOptions);
      
      // Setup service type filter for vehicle types
      this.setupVehicleTypeFiltering();

      console.log('[loadVehicleTypes] option counts', {
        vehicleTypeOptions: typeOptions.length,
        vehicleTypeSelectOptions: vehicleTypeSelect?.options?.length || 0,
        primaryCarOptions: primaryCar?.options?.length || 0,
        secondaryCarOptions: secondaryCar?.options?.length || 0,
        sample: typeOptions.slice(0, 5)
      });

      if (vehicleTypeSelect && !vehicleTypeSelect.dataset.boundPricing) {
        vehicleTypeSelect.addEventListener('change', () => {
          this.applyVehicleTypePricing();
          this.updateRateConfigDisplay();
        });
        vehicleTypeSelect.dataset.boundPricing = 'true';
      }

      // Apply rates after initial load if a value is already present
      this.applyVehicleTypePricing();
      
      // Update rate config display with vehicle type data
      this.updateRateConfigDisplay();

      // --- Load fleet vehicles and render the "Vehicle Assigned" dropdown ---
      try {
        let fleetVehicles = [];
        try {
          fleetVehicles = await fetchFleetVehicles();
        } catch (e) {
          console.warn('⚠️ fetchFleetVehicles failed, falling back to activeVehicles if available:', e);
        }
        if (!Array.isArray(fleetVehicles) || !fleetVehicles.length) {
          fleetVehicles = Array.isArray(this.activeVehicles) ? this.activeVehicles : [];
        }
        this.fleetVehicles = fleetVehicles;
        this.fleetVehicleIdToVehicle = {};
        // Build vehicle-to-driver map for auto-selecting driver when fleet vehicle is chosen
        this.vehicleToDriverMap = {};
        (fleetVehicles || []).forEach(v => { 
          if (v && v.id) {
            this.fleetVehicleIdToVehicle[v.id] = v;
            // Map vehicle ID to assigned driver ID
            if (v.assigned_driver_id) {
              this.vehicleToDriverMap[v.id] = v.assigned_driver_id;
            }
          }
        });
        console.log('[loadVehicles] Built vehicle-to-driver map:', Object.keys(this.vehicleToDriverMap).length, 'mappings');

        // Format label: Prioritize veh_title (Year Make Model), fallback to components
        const formatFleetLabel = (v) => {
          if (!v) return 'Unnamed Vehicle';
          const parts = [];
          // Use veh_title first (pre-built Year Make Model), then fallback to components
          const displayName = v.veh_title || v.veh_disp_name || [v.year, v.make, v.model].filter(Boolean).join(' ');
          if (displayName) parts.push(displayName);
          if (v.unit_number && !parts.includes(v.unit_number)) parts.unshift(v.unit_number);
          if (v.license_plate) parts.push(`(${v.license_plate})`);
          return parts.join(' ') || 'Unnamed Vehicle';
        };

        const fleetOptions = (fleetVehicles || []).map(v => ({ value: v.id, label: formatFleetLabel(v), raw: v }));

        const renderFleet = (el, options, placeholder = '-- Select Fleet Vehicle --') => {
          if (!el) return;
          if (!options.length) {
            el.innerHTML = `<option value="">${placeholder}</option>`;
            return;
          }
          el.innerHTML = `<option value="">${placeholder}</option>` + options.map(o => `<option value="${o.value}">${o.label}</option>`).join('');
        };

        renderFleet(primaryCar, fleetOptions, '-- Select Fleet Vehicle --');
        renderFleet(secondaryCar, fleetOptions, '-- Select Fleet Vehicle --');

      } catch (fleetErr) {
        console.warn('⚠️ Failed to load fleet vehicles:', fleetErr);
      }

      console.log(`✅ Loaded ${typeOptions.length} vehicle types (remote:${typeOptionsFromTable.length}, fallback:${typeOptionsFallback.length})`);
    } catch (error) {
      console.error('❌ Error loading vehicles:', error);
      if (primaryCar) primaryCar.innerHTML = '<option value="">-- Error loading vehicle types --</option>';
      if (secondaryCar) secondaryCar.innerHTML = '<option value="">-- Error loading vehicle types --</option>';
      if (vehicleTypeSelect) vehicleTypeSelect.innerHTML = '<option value="">-- Error loading vehicle types --</option>';
    }
  }

  getConfirmationNumberSettings() {
    try {
      const settings = this.companySettingsManager?.getAllSettings?.() || {};
      const startRaw = settings.confirmationStartNumber;
      const lastUsedRaw = settings.lastUsedConfirmationNumber;
      const startNumber = Math.max(parseInt(startRaw, 10) || 0, 1) || 100000;
      const lastUsedNumber = parseInt(lastUsedRaw, 10);

      return {
        startNumber,
        lastUsedNumber: Number.isFinite(lastUsedNumber) && lastUsedNumber > 0 ? lastUsedNumber : null
      };
    } catch (error) {
      console.warn('⚠️ Could not read confirmation settings, using defaults', error);
      return { startNumber: 100000, lastUsedNumber: null };
    }
  }

  async computeNextConfirmationNumber() {
    try {
      // Import and use the database function to get max confirmation number
      const { getNextConfirmationNumber } = await import('./supabase-db.js');
      const nextNumber = await getNextConfirmationNumber();
      
      if (Number.isFinite(nextNumber) && nextNumber > 0) {
        this.pendingConfirmationNumber = nextNumber;
        return nextNumber;
      }
    } catch (error) {
      console.warn('⚠️ Database lookup failed, using local settings:', error);
    }
    
    // Fallback to local settings if database lookup fails
    const { startNumber, lastUsedNumber } = this.getConfirmationNumberSettings();
    let candidate = Number.isFinite(lastUsedNumber) ? lastUsedNumber + 1 : startNumber;

    if (!Number.isFinite(candidate) || candidate <= 0) {
      candidate = startNumber || 100000;
    }

    this.pendingConfirmationNumber = candidate;
    return candidate;
  }

  updateLastUsedConfirmationNumber(confNumber) {
    if (!this.companySettingsManager?.updateSettings) return;

    const parsedConf = parseInt(confNumber, 10);
    if (!Number.isFinite(parsedConf)) return;

    const { startNumber } = this.getConfirmationNumberSettings();
    const normalizedStart = Number.isFinite(startNumber) && startNumber > 0 ? startNumber : 100000;
    const normalizedLastUsed = Math.max(parsedConf, normalizedStart - 1);

    this.companySettingsManager.updateSettings({
      confirmationStartNumber: normalizedStart,
      lastUsedConfirmationNumber: normalizedLastUsed
    });
  }

  async initializeConfirmationNumber() {
    const confNumberField = document.getElementById('confNumber') || document.getElementById('confirmation-number');
    if (confNumberField) {
      const confFromUrl = this.getConfFromUrl();
      if (confFromUrl) {
        confNumberField.value = confFromUrl;
        confNumberField.setAttribute('readonly', 'true');
        console.log('🔢 Confirmation number loaded from URL:', confFromUrl);
        return;
      }

      // Show loading state while getting confirmation number
      confNumberField.value = 'Loading...';
      confNumberField.setAttribute('readonly', 'true');
      confNumberField.style.color = '#999';

      try {
        const nextConfNumber = await this.computeNextConfirmationNumber();
        const fallbackNumber = 100000;
        const finalNumber = Number.isFinite(nextConfNumber) && nextConfNumber > 0 ? nextConfNumber : fallbackNumber;
        confNumberField.value = finalNumber;
        confNumberField.style.color = '#333';
        console.log('🔢 Confirmation number set successfully:', finalNumber);
      } catch (e) {
        const fallbackNumber = 100000;
        confNumberField.value = fallbackNumber;
        confNumberField.style.color = '#333';
        console.warn('⚠️ Failed to compute next confirmation number, using fallback:', e);
      }
    }
  }

  async checkAuthenticationStatus() {
    try {
      console.log('🔐 Checking authentication status...');
      
      // Import the API service
      const { setupAPI, getSupabaseClient } = await import('./api-service.js');
      
      // Try to setup API and check authentication
      await setupAPI();
      const client = getSupabaseClient();
      
      if (client) {
        // First try current session
        const { data: sessionData } = await client.auth.getSession();
        const existingUser = sessionData?.session?.user;

        // If no user in session, attempt silent refresh
        let refreshedUser = null;
        if (!existingUser) {
          try {
            const { data: refreshed } = await client.auth.refreshSession();
            refreshedUser = refreshed?.session?.user || null;
          } catch (refreshErr) {
            console.warn('⚠️ Silent refresh failed:', refreshErr?.message || refreshErr);
          }
        }

        const { data: { user }, error: userError } = await client.auth.getUser();
        const authUser = existingUser || refreshedUser || user;
        
        if (userError && !authUser) {
          console.warn('⚠️ Authentication error:', userError.message);
          
          // Check if it's a permission error we can bypass for development
          if (userError.message && userError.message.includes('permission denied')) {
            console.log('🔧 Using development bypass for user permission error');
            console.log('✅ Development mode - allowing reservation creation without full authentication');
            return true;
          }
          
          this.showAuthWarning('Authentication error: ' + userError.message);
          return false;
        }
        
        if (!authUser) {
          console.warn('⚠️ User not authenticated');
          
          // Development bypass: Allow saving without authentication for localhost
          if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
            console.log('🔧 Development bypass: allowing reservation creation on localhost without authentication');
            return true;
          }

          // If embedded within the same origin as the main app, trust the parent session
          if (this.isEmbeddedSameOrigin()) {
            console.log('🔧 Embedded same-origin: trusting parent auth session for reservation form');
            return true;
          }
          
          this.showAuthWarning('You are not logged in. Please log in to save reservations.');
          return false;
        }
        
        console.log('✅ User authenticated:', authUser.email || authUser.id);
        
        // Check organization membership
        const { data: membershipList, error: membershipError } = await client
          .from('organization_members')
          .select('organization_id')
          .eq('user_id', authUser.id);

        const membership = Array.isArray(membershipList) && membershipList.length ? membershipList[0] : null;
        
        if (membershipError || !membership?.organization_id) {
          console.warn('⚠️ User not in organization:', membershipError?.message);
          
          // Development bypass: Allow saving without organization membership
          console.log('🔧 Using development bypass for organization membership');
          console.log('✅ Development mode - allowing reservation creation without organization');
          return true; // Allow to proceed in development
        }
        
        console.log('✅ Organization membership confirmed:', membership.organization_id);

        // Populate reservation metadata
        this.applyReservationMeta(authUser);
        return true;
      } else {
        console.warn('⚠️ Supabase client not available');
        this.showAuthWarning('Database connection not available. Please refresh the page.');
        return false;
      }
    } catch (error) {
      console.error('❌ Authentication check failed:', error);
      this.showAuthWarning('Authentication check failed: ' + error.message);
      return false;
    }
  }

  async waitForAuthSession(reason = 'auth') {
    const timeoutMs = 5000;
    const start = Date.now();
    try {
      const { getSupabaseClient } = await import('./api-service.js');
      const client = getSupabaseClient();
      if (!client) return null;

      // Fast path: existing session
      const { data: initial } = await client.auth.getSession();
      if (initial?.session) {
        this.activeSession = initial.session;
        return initial.session;
      }

      // Wait for SIGNED_IN or TOKEN_REFRESHED
      let settled = false;
      return await new Promise((resolve) => {
        let cleanup = null;
        const timer = setTimeout(() => {
          settled = true;
          resolve(null);
        }, timeoutMs);

        const listener = client.auth.onAuthStateChange((event, session) => {
          if (!session || settled) return;
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            settled = true;
            clearTimeout(timer);
            cleanup?.();
            this.activeSession = session;
            resolve(session);
          }
        });

        // Normalize unsubscribe across real supabase-js (subscription object) and local mock (function)
        cleanup = typeof listener === 'function'
          ? listener
          : typeof listener?.subscription?.unsubscribe === 'function'
            ? () => listener.subscription.unsubscribe()
            : typeof listener?.unsubscribe === 'function'
              ? () => listener.unsubscribe()
              : null;
      });
    } finally {
      const elapsed = Date.now() - start;
      console.log(`⏱️ waitForAuthSession (${reason}) finished in ${elapsed}ms`);
    }
  }

  applyReservationMeta(authUser) {
    try {
      if (!authUser) return;
      const resBy = document.getElementById('resBy');
      if (resBy && authUser.email) {
        resBy.value = authUser.email;
      }
      // Date/Time is already initialized to now in initializeDateTime()
    } catch (e) {
      console.warn('⚠️ Failed to apply reservation meta:', e);
    }
  }

  isEmbeddedSameOrigin() {
    try {
      if (window.top === window) return false;
      return window.top.location.origin === window.location.origin;
    } catch (e) {
      return false;
    }
  }

  showAuthWarning(message) {
    // Create or update warning message in the form
    let warningDiv = document.getElementById('authWarning');
    if (!warningDiv) {
      warningDiv = document.createElement('div');
      warningDiv.id = 'authWarning';
      warningDiv.style.cssText = `
        background: #fffaf0;
        border: 1px solid #ffe4b5;
        color: #8a6d3b;
        padding: 6px 8px;
        border-radius: 4px;
        margin: 6px 0 10px;
        font-size: 12px;
        line-height: 1.3;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      `;
      
      // Insert at top of form
      const form = document.querySelector('.reservation-form') || document.querySelector('#app');
      if (form && form.firstChild) {
        form.insertBefore(warningDiv, form.firstChild);
      }
    }
    
    warningDiv.innerHTML = `
      <span style="font-size: 18px;">⚠️</span>
      <span><strong>Authentication Issue:</strong> ${message}</span>
    `;
  }

  initializeDateTime() {
    const field = document.getElementById('resDateTime');
    if (!field) return;

    // If already populated (loaded record), freeze and stop any timer
    if (field.value && field.value.trim()) {
      this.createdDateTime = field.value.trim();
      this.dateTimeFrozen = true;
      if (this.dateTimeInterval) {
        clearInterval(this.dateTimeInterval);
        this.dateTimeInterval = null;
      }
      return;
    }

    // Live-update until saved; then freeze
    const updateNow = () => {
      if (this.dateTimeFrozen) return;
      const now = new Date();
      const dateTimeString = now.toLocaleString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
      this.createdDateTime = dateTimeString;
      field.value = dateTimeString;
    };

    updateNow();
    this.dateTimeInterval = setInterval(updateNow, 30000);
  }

  setupTabSwitching() {
    // Billing tabs
    document.querySelectorAll('.billing-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = tab.getAttribute('data-billing-tab');
        
        document.querySelectorAll('.billing-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.billing-tab-content').forEach(c => c.classList.remove('active'));
        
        tab.classList.add('active');
        
        if (tabName === 'account') {
          document.getElementById('accountTab').classList.add('active');
        } else if (tabName === 'payment') {
          document.getElementById('paymentTab').classList.add('active');
        }
      });
    });

    // Cost tabs
    document.querySelectorAll('.cost-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.cost-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.cost-tab-content').forEach(c => c.classList.remove('active'));
        
        tab.classList.add('active');
        const tabName = tab.dataset.tab;
        document.getElementById(`${tabName}CostTab`).classList.add('active');
      });
    });

    // Assignment tabs
    document.querySelectorAll('.assignment-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.assignment-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.assignment-content').forEach(c => c.classList.remove('active'));
        
        tab.classList.add('active');
        const tabName = tab.dataset.tab;
        document.getElementById(`${tabName}Assignment`).classList.add('active');
      });
    });
  }

  setupEventListeners() {
    console.log('🔧 Setting up event listeners...');
    
    // Setup rate section iframe communication
    this.setupRateSectionIframe();
    
    // Back button (removed from UI but keeping check)
    const backBtn = document.getElementById('backBtn');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        window.location.href = 'index.html';
      });
    }

    // Save buttons
    const topSaveBtn = document.querySelector('.btn-save') || document.getElementById('saveBtn');
    if (topSaveBtn) {
      topSaveBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.saveReservation({ sourceButton: topSaveBtn });
      });
    }

    const bottomSaveBtn = document.getElementById('saveReservationBtn');
    if (bottomSaveBtn) {
      bottomSaveBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.saveReservation({ sourceButton: bottomSaveBtn });
      });
    }

    // More menu actions
    const moreBtn = document.getElementById('moreActionsBtn');
    const moreMenu = document.getElementById('moreActionsDropdown');
    if (moreBtn && moreMenu && !moreBtn.dataset.bound) {
      moreBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const isOpen = moreMenu.style.display === 'block';
        moreMenu.style.display = isOpen ? 'none' : 'block';
      });
      document.addEventListener('click', (e) => {
        if (!moreMenu.contains(e.target) && e.target !== moreBtn) {
          moreMenu.style.display = 'none';
        }
      });
      const deleteBtn = document.getElementById('deleteReservationBtn');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
          e.preventDefault();
          moreMenu.style.display = 'none';
          this.deleteReservationWithConfirm();
        });
      }
      moreBtn.dataset.bound = '1';
    }

    // Main navigation buttons
    wireMainNav();

    // View buttons (window-actions)
    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = e.target.dataset.action;
        
        if (action === 'user-view') {
          window.location.href = 'index.html?view=user';
        } else if (action === 'driver-view') {
          window.location.href = 'index.html?view=driver';
        } else if (action === 'reservations') {
          window.location.href = 'reservations-list.html';
        } else if (action === 'farm-out') {
          window.location.href = 'index.html?view=reservations';
        } else if (action === 'new-reservation') {
          window.location.href = 'reservation-form.html';
        }
      });
    });

    // Action buttons
    const paymentsBtn = document.querySelector('.btn-payments');
    if (paymentsBtn) {
      paymentsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.openBillingPaymentTab();
      });
    }

    const printBtn = document.querySelector('.btn-print');
    if (printBtn) {
      printBtn.addEventListener('click', (e) => {
        e.preventDefault();
        window.print();
      });
    }

    // Auto-derive spot/garage times from pickup
    const puTimeEl = document.getElementById('puTime');
    const puDateEl = document.getElementById('puDate');
    [puTimeEl, puDateEl].forEach(el => {
      if (!el) return;
      el.addEventListener('change', () => this.updateTimesFromPickup());
      el.addEventListener('input', () => this.updateTimesFromPickup());
    });

    // Keep DO Time updated when duration changes
    const durationEl = document.getElementById('duration');
    if (durationEl) {
      ['change', 'input'].forEach(evt => {
        durationEl.addEventListener(evt, () => this.updateDropoffFromDuration());
      });
    }

    const copyBtn = document.querySelector('.btn-copy-action');
    if (copyBtn) {
      copyBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.copyToDraftAndNavigate('copy');
      });
    }

    const roundTripBtn = document.querySelector('.btn-roundtrip');
    if (roundTripBtn) {
      roundTripBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.copyToDraftAndNavigate('roundtrip');
      });
    }

    const emailBtn = document.querySelector('.btn-email');
    if (emailBtn) {
      emailBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.composeEmail();
      });
    }

    // Safety wrapper for DOM access
    const safeAddListener = (id, event, callback) => {
      const elem = document.getElementById(id);
      if (elem) {
        elem.addEventListener(event, callback);
        console.log(`✅ Listener attached to ${id}`);
      } else {
        console.warn(`⚠️ Element ${id} not found, skipping listener`);
      }
    };

    const eFarmOutSelect = document.getElementById('eFarmOut');
    if (eFarmOutSelect) {
      const normalizeModeSelection = (value) => {
        const canonical = canonicalizeFarmoutMode(value || 'manual');
        eFarmOutSelect.value = canonical;
        eFarmOutSelect.dataset.canonical = canonical;
      };
      normalizeModeSelection(eFarmOutSelect.value);
      eFarmOutSelect.addEventListener('change', (event) => {
        normalizeModeSelection(event.target.value);
        
        // AUTO FARMOUT MODE: When eFarmOut is set to "automatic", instantly apply farmout settings
        const selectedValue = canonicalizeFarmoutMode(event.target.value);
        
        // Persist mode change to database if editing existing reservation
        const reservationId = this.currentReservationId || window.currentReservationId;
        if (reservationId && typeof window.updateReservation === 'function') {
          console.log(`📋 Persisting farmout_mode=${selectedValue} to database for reservation ${reservationId}`);
          window.updateReservation(reservationId, {
            farmout_mode: selectedValue
          }).then(() => {
            // Dispatch event to update farmout table immediately
            document.dispatchEvent(new CustomEvent('farmoutModeChanged', {
              detail: { reservationId, mode: selectedValue }
            }));
          }).catch(err => console.warn('Failed to persist farmout mode:', err));
        } else {
          // Still dispatch event for UI updates even without DB save
          document.dispatchEvent(new CustomEvent('farmoutModeChanged', {
            detail: { reservationId, mode: selectedValue }
          }));
        }
        
        if (selectedValue === 'automatic') {
          console.log('🏠 eFarmOut set to AUTOMATIC - applying farmout settings instantly...');
          
          // 1. Select the "Farm-out" radio button FIRST
          const farmOutRadio = document.querySelector('input[name="farmOption"][value="farm-out"]');
          if (farmOutRadio) {
            farmOutRadio.checked = true;
            // Don't dispatch change event yet - we'll update everything together
          }
          
          // 2. Set the Status dropdown to "Farm-out Unassigned"
          const resStatusSelect = document.getElementById('resStatus');
          if (resStatusSelect) {
            resStatusSelect.value = 'farm_out_unassigned';
            // Don't dispatch change event - we'll handle the update directly
          }
          
          // 3. Update eFarmStatus display to show "Farm-out Unassigned"
          this.updateEFarmStatus('farmout_unassigned');
          
          // 4. Persist ALL farmout fields to database together
          const reservationIdForAuto = this.currentReservationId || window.currentReservationId;
          if (reservationIdForAuto && typeof window.updateReservation === 'function') {
            console.log(`📋 Persisting automatic farmout settings to database for reservation ${reservationIdForAuto}`);
            window.updateReservation(reservationIdForAuto, {
              farmout_mode: 'automatic',
              farmout_status: 'farmout_unassigned',
              farm_option: 'farm-out',
              status: 'farm_out_unassigned'
            }).then(() => {
              console.log('✅ Automatic farmout settings persisted successfully');
              document.dispatchEvent(new CustomEvent('farmoutModeChanged', {
                detail: { reservationId: reservationIdForAuto, mode: 'automatic', status: 'farmout_unassigned' }
              }));
            }).catch(err => console.warn('Failed to persist automatic farmout settings:', err));
          }
        } else if (selectedValue === 'manual') {
          console.log('🏠 eFarmOut set to MANUAL - applying farmout settings instantly...');
          
          // 1. Select the "Farm-out" radio button FIRST
          const farmOutRadio = document.querySelector('input[name="farmOption"][value="farm-out"]');
          if (farmOutRadio) {
            farmOutRadio.checked = true;
          }
          
          // 2. Set the Status dropdown to "Farm-out Unassigned"
          const resStatusSelect = document.getElementById('resStatus');
          if (resStatusSelect) {
            resStatusSelect.value = 'farm_out_unassigned';
          }
          
          // 3. Update eFarmStatus display to show "Farm-out Unassigned"
          this.updateEFarmStatus('farmout_unassigned');
          
          // 4. Persist ALL farmout fields to database together
          const reservationIdForManual = this.currentReservationId || window.currentReservationId;
          if (reservationIdForManual && typeof window.updateReservation === 'function') {
            console.log(`📋 Persisting manual farmout settings to database for reservation ${reservationIdForManual}`);
            window.updateReservation(reservationIdForManual, {
              farmout_mode: 'manual',
              farmout_status: 'farmout_unassigned',
              farm_option: 'farm-out',
              status: 'farm_out_unassigned'
            }).then(() => {
              console.log('✅ Manual farmout settings persisted successfully');
              document.dispatchEvent(new CustomEvent('farmoutModeChanged', {
                detail: { reservationId: reservationIdForManual, mode: 'manual', status: 'farmout_unassigned' }
              }));
            }).catch(err => console.warn('Failed to persist manual farmout settings:', err));
          }
        }
      });
    }
    
    // Farm Option radio buttons - update eFarm Status when changed
    const farmOptionRadios = document.querySelectorAll('input[name="farmOption"]');
    farmOptionRadios.forEach(radio => {
      radio.addEventListener('change', () => {
        // When switching farm options, update status accordingly
        const isFarmOut = radio.value === 'farm-out';
        const statusInput = document.getElementById('eFarmStatus');
        const currentCanonical = statusInput?.dataset?.canonical || '';
        
        if (isFarmOut) {
          // Switching TO farmout - set farmout_unassigned if not already a farmout status
          const farmoutStatuses = ['farmout_unassigned', 'farmout_assigned', 'offered'];
          if (!farmoutStatuses.includes(currentCanonical)) {
            this.updateEFarmStatus('farmout_unassigned');
          } else {
            this.updateEFarmStatus(currentCanonical);
          }
        } else {
          // Switching AWAY from farmout - clear to blank (in-house/farm-in)
          this.updateEFarmStatus('');
        }
      });
    });
    
    // Status dropdown - auto-clear driver/vehicle when set to unassigned
    // Also reset to in-house if status changes to non-farmout while in farmout mode
    const resStatusSelect = document.getElementById('resStatus');
    if (resStatusSelect && !resStatusSelect.dataset.boundUnassigned) {
      resStatusSelect.dataset.boundUnassigned = 'true';
      resStatusSelect.addEventListener('change', (e) => {
        const selectedValue = (e.target.value || '').toLowerCase().replace(/[\s-]/g, '_');
        const isUnassigned = selectedValue === 'unassigned' || 
                             selectedValue.includes('unassigned') ||
                             selectedValue === 'farm_out_unassigned' ||
                             selectedValue === 'farmout_unassigned';
        
        // Check if this is a farmout status
        const isFarmoutStatus = selectedValue === 'farm_out_assigned' ||
                                selectedValue === 'farmout_assigned' ||
                                selectedValue === 'farm_out_unassigned' ||
                                selectedValue === 'farmout_unassigned';
        
        // Check if currently in farmout mode
        const farmOutRadio = document.querySelector('input[name="farmOption"][value="farm-out"]');
        const isCurrentlyFarmout = farmOutRadio && farmOutRadio.checked;
        
        // If in farmout mode and status is NOT a farmout status, reset to in-house
        if (isCurrentlyFarmout && !isFarmoutStatus) {
          console.log('📋 Status changed to non-farmout - switching to In-house and clearing farmout fields');
          
          // Switch to in-house radio
          const inHouseRadio = document.querySelector('input[name="farmOption"][value="in-house"]');
          if (inHouseRadio) {
            inHouseRadio.checked = true;
            inHouseRadio.dispatchEvent(new Event('change', { bubbles: true }));
          }
          
          // Clear eFarmOut dropdown (manual/automatic)
          const eFarmOutSelect = document.getElementById('eFarmOut');
          if (eFarmOutSelect) {
            eFarmOutSelect.value = '';
          }
          
          // Clear affiliate
          const affiliateInput = document.getElementById('affiliate');
          if (affiliateInput) {
            affiliateInput.value = '';
          }
          
          // Clear driver select
          const driverSelect = document.getElementById('driverSelect');
          if (driverSelect) {
            driverSelect.value = '';
          }
          
          // Clear fleet vehicle select
          const fleetVehicleSelect = document.getElementById('fleetVehicleSelect');
          if (fleetVehicleSelect) {
            fleetVehicleSelect.value = '';
          }
          
          // Clear any hidden driver ID inputs
          const driverIdInput = document.getElementById('driverId');
          if (driverIdInput) {
            driverIdInput.value = '';
          }
        }
        
        // If status is a farmout status and NOT currently in farmout mode, switch to farm-out
        if (isFarmoutStatus && !isCurrentlyFarmout) {
          console.log('📋 Status changed to farmout status - switching to Farm-out mode');
          const farmOutRadio = document.querySelector('input[name="farmOption"][value="farm-out"]');
          if (farmOutRadio) {
            farmOutRadio.checked = true;
            farmOutRadio.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
        
        if (isUnassigned) {
          console.log('📋 Status set to unassigned - clearing driver and vehicle');
          
          // Clear driver select
          const driverSelect = document.getElementById('driverSelect');
          if (driverSelect) {
            driverSelect.value = '';
          }
          
          // Clear fleet vehicle select
          const fleetVehicleSelect = document.getElementById('fleetVehicleSelect');
          if (fleetVehicleSelect) {
            fleetVehicleSelect.value = '';
          }
          
          // Also clear any hidden driver ID inputs
          const driverIdInput = document.getElementById('driverId');
          if (driverIdInput) {
            driverIdInput.value = '';
          }
        }
      });
    }
    
    // Copy passenger info button
    safeAddListener('copyPassengerBtn', 'click', () => {
      this.copyPassengerInfo();
    });

    // Create stop button
    // Bind exactly once to prevent duplicate rows (some browsers fire multiple handlers when mixing inline + JS).
    const createStopBtn = document.getElementById('createStopBtn');
    if (createStopBtn) {
      // Skip binding if already bound via JS or if there's an inline onclick handler
      if (!createStopBtn.dataset.bound && !createStopBtn.getAttribute('onclick')) {
        createStopBtn.dataset.bound = 'true';
        createStopBtn.addEventListener('click', async (e) => {
          e.stopPropagation(); // Prevent bubbling but allow default
          console.log('🔘 CREATE button clicked (JS handler)!');

          if (typeof window.handleCreateStop === 'function') {
            console.log('🚀 Calling handleCreateStop...');
            window.handleCreateStop();
          } else {
            console.log('⚠️ handleCreateStop not available, using fallback');
            await this.createAddressRow();
          }

          // Recompute route metrics after any stop change
          try {
            await this.updateTripMetricsFromStops();
          } catch (err) {
            console.warn('⚠️ Failed to update route metrics after stop change:', err);
          }

          // Safety: ensure the button returns to CREATE even if two handlers ever slipped in.
          setTimeout(() => {
            if (createStopBtn.textContent && createStopBtn.textContent.toLowerCase().includes('added')) {
              createStopBtn.textContent = 'CREATE';
              createStopBtn.style.background = '';
              createStopBtn.style.color = '';
            }
          }, 1800);
        });
        console.log('✅ Listener attached to createStopBtn');
      }
    } else {
      console.warn('⚠️ Element createStopBtn not found, skipping listener');
    }

    // Auto-select vehicle when a driver is chosen (based on assigned_driver_id in fleet_vehicles)
    // If driver is cleared, clear the vehicle too
    try {
      const driverSelect = document.getElementById('driverSelect');
      const carSelect = document.getElementById('carSelect');
      if (driverSelect && carSelect && !driverSelect.dataset.boundVehicle) {
        driverSelect.dataset.boundVehicle = 'true';
        driverSelect.addEventListener('change', async (e) => {
          const driverId = e.target.value;
          
          // If driver is cleared, clear the vehicle
          if (!driverId) {
            console.log('[driverSelect] Driver cleared - clearing vehicle');
            carSelect.value = '';
            return;
          }
          
          // Recalculate garage times based on new driver's address
          this.updateGarageTimesFromDriver();
          
          // Find all fleet vehicles assigned to this driver
          const matchingVehicles = (this.fleetVehicles || []).filter(v => 
            v && v.assigned_driver_id === driverId
          );
          
          if (matchingVehicles.length === 0) {
            console.log('[driverSelect] No vehicles assigned to driver:', driverId);
            return;
          }
          
          if (matchingVehicles.length === 1) {
            // Single vehicle - auto-select it
            const veh = matchingVehicles[0];
            carSelect.value = veh.id;
            console.log('[driverSelect] Auto-selected vehicle:', veh.id, veh.veh_title || veh.make + ' ' + veh.model);
          } else {
            // Multiple vehicles - ask user which one to use
            console.log('[driverSelect] Multiple vehicles for driver:', matchingVehicles.length);
            
            const vehicleOptions = matchingVehicles.map((v, i) => {
              const label = v.veh_title || [v.year, v.make, v.model].filter(Boolean).join(' ') || 'Vehicle';
              const plate = v.license_plate ? ` (${v.license_plate})` : '';
              return `${i + 1}. ${label}${plate}`;
            }).join('\n');
            
            const promptMsg = `This driver has ${matchingVehicles.length} vehicles assigned. Which one should be used?\n\n${vehicleOptions}\n\nEnter number (1-${matchingVehicles.length}) or Cancel:`;
            const choice = prompt(promptMsg);
            
            if (choice && !isNaN(parseInt(choice))) {
              const idx = parseInt(choice) - 1;
              if (idx >= 0 && idx < matchingVehicles.length) {
                carSelect.value = matchingVehicles[idx].id;
                console.log('[driverSelect] User selected vehicle:', matchingVehicles[idx].id);
              }
            }
          }
        });
      }
    } catch (err) {
      console.warn('⚠️ Failed to attach driver->vehicle listener:', err);
    }

    // Auto-select driver when a fleet vehicle with an assigned driver is chosen
    try {
      const carSelect = document.getElementById('carSelect');
      const driverSelect = document.getElementById('driverSelect');
      if (carSelect && driverSelect && !carSelect.dataset.boundDriver) {
        carSelect.dataset.boundDriver = 'true';
        carSelect.addEventListener('change', (e) => {
          const vehicleId = e.target.value;
          if (!vehicleId) return;
          
          const assignedDriverId = this.vehicleToDriverMap && this.vehicleToDriverMap[vehicleId];
          if (!assignedDriverId) {
            console.log('[carSelect] No assigned driver for vehicle:', vehicleId);
            return;
          }
          
          // Check if this driver exists in the dropdown
          const driverOption = driverSelect.querySelector(`option[value="${assignedDriverId}"]`);
          if (driverOption) {
            driverSelect.value = assignedDriverId;
            // Trigger change event so any dependent logic fires
            driverSelect.dispatchEvent(new Event('change', { bubbles: true }));
            console.log('[carSelect] Auto-selected driver for vehicle', vehicleId, '->', assignedDriverId);
          } else {
            console.log('[carSelect] Assigned driver not in dropdown:', assignedDriverId);
          }
        });
      }
    } catch (err) {
      console.warn('⚠️ Failed to attach vehicle->driver listener:', err);
    }

    // Location type radio buttons
    const radioButtons = document.querySelectorAll('input[name="locationType"]');
    if (radioButtons && radioButtons.length > 0) {
      radioButtons.forEach(radio => {
        radio.addEventListener('change', (e) => {
          console.log('🔘 Location type changed to:', e.target.value);
          this.handleLocationTypeChange(e.target.value);
        });
      });
    }

    // Account search - Billing Accounts section
    const billingAccountInput = document.getElementById('billingAccountSearch');
    if (billingAccountInput) {
      billingAccountInput.addEventListener('input', (e) => {
        this.searchAccounts(e.target.value);
      });

      billingAccountInput.addEventListener('focus', () => {
        this.tryResolveBillingAccountAndUpdateDisplay();
      });

      // Auto-fill other billing fields when account is selected
      billingAccountInput.addEventListener('blur', () => {
        this.tryResolveBillingAccountAndUpdateDisplay();
        const suggestions = document.getElementById('accountSuggestions');
        if (suggestions) {
          setTimeout(() => {
            suggestions.classList.remove('active');
          }, 200);
        }
      });

      billingAccountInput.addEventListener('input', () => {
        this.dirty = true;
      });
    }

    // Passenger account search - Multiple fields
    const passengerFirstNameEl = document.getElementById('passengerFirstName');
    if (passengerFirstNameEl) {
      passengerFirstNameEl.addEventListener('input', (e) => {
        this.searchAccountsForPassenger(e.target.value);
        this.dirty = true;
      });
      
      passengerFirstNameEl.addEventListener('blur', () => {
        const suggestions = document.getElementById('passengerSuggestions');
        if (suggestions) {
          setTimeout(() => {
            if (!suggestions.dataset.hovering) {
              suggestions.classList.remove('active');
            }
          }, 250);
        }
      });
    }

    // Also add search to passenger last name field
    const passengerLastNameEl = document.getElementById('passengerLastName');
    if (passengerLastNameEl) {
      passengerLastNameEl.addEventListener('input', (e) => {
        this.searchAccountsForPassenger(e.target.value);
        this.dirty = true;
      });
      
      passengerLastNameEl.addEventListener('blur', () => {
        const suggestions = document.getElementById('passengerSuggestions');
        if (suggestions) {
          setTimeout(() => {
            if (!suggestions.dataset.hovering) {
              suggestions.classList.remove('active');
            }
          }, 250);
        }
      });
    }

    // Also add search to passenger phone field
    const passengerPhoneEl = document.getElementById('passengerPhone');
    if (passengerPhoneEl) {
      passengerPhoneEl.addEventListener('input', (e) => {
        this.searchAccountsForPassenger(e.target.value);
        this.dirty = true;
      });
      
      passengerPhoneEl.addEventListener('blur', () => {
        const suggestions = document.getElementById('passengerSuggestions');
        if (suggestions) {
          setTimeout(() => {
            if (!suggestions.dataset.hovering) {
              suggestions.classList.remove('active');
            }
          }, 250);
        }
      });
    }

    // Booking Agent account search - First Name field
    const bookingFirstNameEl = document.getElementById('bookedByFirstName');
    if (bookingFirstNameEl) {
      bookingFirstNameEl.addEventListener('input', (e) => {
        this.searchAccountsForBookingAgent(e.target.value);
      });
      
      bookingFirstNameEl.addEventListener('blur', () => {
        const suggestions = document.getElementById('bookingAgentSuggestions');
        if (suggestions) {
          setTimeout(() => {
            suggestions.classList.remove('active');
          }, 200);
        }
      });
    }

    // Billing autofill (3+ chars) from Accounts DB for ANY billing field
    // Company field only searches company names
    const billingCompanyEl = document.getElementById('billingCompany');
    if (billingCompanyEl) {
      billingCompanyEl.addEventListener('input', (e) => {
        this.searchAccountsByCompany(e.target.value);
      });
      billingCompanyEl.addEventListener('blur', () => {
        const suggestions = document.getElementById('accountSuggestions');
        if (!suggestions) return;
        setTimeout(() => suggestions.classList.remove('active'), 200);
      });
    }
    
    // Other billing fields search across all fields
    ['billingFirstName', 'billingLastName', 'billingPhone', 'billingEmail'].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', (e) => {
        this.searchAccounts(e.target.value);
      });
      el.addEventListener('blur', () => {
        const suggestions = document.getElementById('accountSuggestions');
        if (!suggestions) return;
        setTimeout(() => suggestions.classList.remove('active'), 200);
      });
    });

    // Passenger + Booking Agent autofill (3+ chars)
    this.setupPassengerDbAutocomplete();
    this.setupBookingAgentDbAutocomplete();

    // Setup consolidated routing panel
    try {
      this.setupRoutingPanel();
    } catch (e) {
      console.warn('⚠️ setupRoutingPanel failed:', e);
    }

    // Setup address autocomplete for initial stops
    try {
      this.setupAddressAutocomplete();
    } catch (e) {
      console.warn('⚠️ setupAddressAutocomplete failed:', e);
    }

    // Setup location name POI search
    try {
      this.setupLocationNameSearch();
    } catch (e) {
      console.warn('⚠️ setupLocationNameSearch failed:', e);
    }

    // Setup notes tabs
    try {
      this.setupNotesTabs();
    } catch (e) {
      console.warn('⚠️ setupNotesTabs failed:', e);
    }

    // Cost calculation inputs
    try {
      this.setupCostCalculationListeners();
    } catch (e) {
      console.warn('⚠️ setupCostCalculationListeners failed:', e);
    }

    // Add Account button
    const addAccountBtn = document.getElementById('addAccountBtn');
    if (addAccountBtn) {
      addAccountBtn.addEventListener('click', () => {
        this.openAddContactModal();
      });
    }

    // Clear Billing Account button
    const clearBillingAccountBtn = document.getElementById('clearBillingAccountBtn');
    if (clearBillingAccountBtn) {
      clearBillingAccountBtn.addEventListener('click', () => {
        this.clearBillingAccount();
      });
    }

    // Create Account button
    const createAccountBtn = document.getElementById('createAccountBtn');
    console.log('🔍 Looking for createAccountBtn:', createAccountBtn);
    if (createAccountBtn) {
      createAccountBtn.addEventListener('click', () => {
        console.log('✅ Create Account button clicked!');
        this.createAccountFromBilling();
      });
      console.log('✅ Create Account button listener attached');
    }

    // Copy Passenger Info checkbox
    const copyPassengerCheckbox = document.getElementById('copyPassengerInfoCheckbox');
    if (copyPassengerCheckbox) {
      copyPassengerCheckbox.addEventListener('change', () => {
        if (copyPassengerCheckbox.checked) {
          this.copyPassengerToBilling();
        }
      });
    }

    // Clear Passenger button
    const clearPassengerBtn = document.getElementById('clearPassengerBtn');
    if (clearPassengerBtn) {
      clearPassengerBtn.addEventListener('click', () => {
        this.clearPassenger();
      });
    }

    // Copy Billing to Passenger button
    const copyBillingToPassengerBtn = document.getElementById('copyBillingToPassengerBtn');
    if (copyBillingToPassengerBtn) {
      copyBillingToPassengerBtn.addEventListener('click', () => {
        this.copyBillingToPassenger();
      });
    }

    // Clear Booking Agent button
    const clearBookingAgentBtn = document.getElementById('clearBookingAgentBtn');
    if (clearBookingAgentBtn) {
      clearBookingAgentBtn.addEventListener('click', () => {
        this.clearBookingAgent();
      });
    }

    // Copy Billing to Booking Agent button
    const copyBillingToBookingBtn = document.getElementById('copyBillingToBookingBtn');
    if (copyBillingToBookingBtn) {
      copyBillingToBookingBtn.addEventListener('click', () => {
        this.copyBillingToBooking();
      });
    }
    
    // Show Booking Agent button (Add Booking Agent link)
    const showBookingAgentBtn = document.getElementById('showBookingAgentBtn');
    if (showBookingAgentBtn) {
      showBookingAgentBtn.addEventListener('click', () => {
        this.showBookingAgentSection();
      });
    }
    
    // Booking Agent section toggle (expand/collapse)
    this.setupBookingAgentToggle();
    
    // Setup phone and email validation for all contact sections
    this.setupPhoneEmailValidation();
    
    // Auto-detect when passenger/booking matches billing
    this.setupMatchDetection();

    // Add Contact Modal
    const safeModalBind = (id, handler, eventName = 'click') => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener(eventName, handler);
      } else {
        console.warn(`⚠️ Element ${id} not found for modal binding`);
      }
    };

    safeModalBind('closeContactModal', () => this.closeAddContactModal());
    safeModalBind('cancelContact', () => this.closeAddContactModal());
    safeModalBind('saveContact', () => this.saveNewContact());
    safeModalBind('addContactModal', (e) => {
      if (e.target.id === 'addContactModal') {
        this.closeAddContactModal();
      }
    }, 'click');

    // Modal close
    safeModalBind('closeModal', () => this.closeModal());
    safeModalBind('cancelAccount', () => this.closeModal());
    safeModalBind('createAccount', () => this.createNewAccount());
    safeModalBind('accountModal', (e) => {
      if (e.target.id === 'accountModal') {
        this.closeModal();
      }
    }, 'click');

    // Affiliate search and modal
    this.setupAffiliateSearch();

    safeModalBind('openAffiliateListBtn', () => {
      this.openAffiliateModal();
    });

    safeModalBind('closeAffiliateModal', () => {
      this.closeAffiliateModal();
    });

    safeModalBind('closeAffiliateListBtn', () => {
      this.closeAffiliateModal();
    });

    safeModalBind('affiliateModal', (e) => {
      if (e.target.id === 'affiliateModal') {
        this.closeAffiliateModal();
      }
    }, 'click');
  }

  setupStoredRoutingDragAndDrop() {
    const tableBody = document.getElementById('addressTableBody');
    if (!tableBody) return;

    const ensureDraggable = (row) => {
      if (!row || row.nodeType !== 1) return;
      if (row.classList.contains('empty-row')) return;
      row.setAttribute('draggable', 'true');
      if (!row.style.cursor) row.style.cursor = 'move';
    };

    tableBody.querySelectorAll('tr').forEach(ensureDraggable);

    // Ensure new rows added later (via handleCreateStop) become draggable
    const observer = new MutationObserver((mutations) => {
      mutations.forEach(m => {
        (m.addedNodes || []).forEach(node => {
          if (node && node.nodeType === 1 && node.tagName === 'TR') {
            ensureDraggable(node);
          }
        });
      });
    });
    observer.observe(tableBody, { childList: true });

    let draggingRow = null;

    const getDragAfterElement = (container, y) => {
      const draggableElements = [...container.querySelectorAll('tr[draggable="true"]:not(.dragging)')];

      return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
          return { offset, element: child };
        }
        return closest;
      }, { offset: Number.NEGATIVE_INFINITY, element: null }).element;
    };

    tableBody.addEventListener('dragstart', (e) => {
      const row = e.target?.closest?.('tr');
      if (!row || row.classList.contains('empty-row')) return;
      ensureDraggable(row);
      draggingRow = row;
      row.classList.add('dragging');
      try {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', row.dataset.stopId || row.id || '');
      } catch {
        // ignore
      }
    });

    tableBody.addEventListener('dragend', () => {
      if (draggingRow) draggingRow.classList.remove('dragging');
      draggingRow = null;
    });

    tableBody.addEventListener('dragover', (e) => {
      if (!draggingRow) return;
      e.preventDefault();
      const afterElement = getDragAfterElement(tableBody, e.clientY);
      if (afterElement == null) {
        tableBody.appendChild(draggingRow);
      } else {
        tableBody.insertBefore(draggingRow, afterElement);
      }
    });
  }

  setupAffiliateSearch() {
    const affiliateInput = document.getElementById('affiliate');
    const suggestionsContainer = document.getElementById('affiliateSuggestions');
    
    // Skip if elements don't exist (e.g., in confirmed-reservation view)
    if (!affiliateInput || !suggestionsContainer) {
      console.log('ℹ️ [ReservationForm] Affiliate search elements not found, skipping setup');
      return;
    }
    
    let debounceTimer;

    affiliateInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      const query = e.target.value;

      if (query.length < 2) {
        suggestionsContainer.classList.remove('active');
        return;
      }

      debounceTimer = setTimeout(async () => {
        const results = await this.affiliateService.searchAffiliates(query);
        this.showAffiliateSuggestions(results);
      }, 200);
    });

    affiliateInput.addEventListener('blur', () => {
      setTimeout(() => suggestionsContainer.classList.remove('active'), 200);
    });
  }

  showAffiliateSuggestions(affiliates) {
    const container = document.getElementById('affiliateSuggestions');

    if (!affiliates || affiliates.length === 0) {
      container.classList.remove('active');
      return;
    }

    container.innerHTML = affiliates.map(affiliate => `
      <div class="affiliate-suggestion-item" data-id="${affiliate.id}">
        <span class="affiliate-company">${affiliate.company}</span>
        <span class="affiliate-contact">${affiliate.contact} • ${affiliate.phone}</span>
        <span class="affiliate-location">${affiliate.location}</span>
      </div>
    `).join('');

    container.querySelectorAll('.affiliate-suggestion-item').forEach(item => {
      item.addEventListener('click', async () => {
        const affiliateId = item.dataset.id;
        const affiliate = await this.affiliateService.getAffiliateById(affiliateId);
        this.selectAffiliate(affiliate);
      });
    });

    container.classList.add('active');
  }

  selectAffiliate(affiliate) {
    this.selectedAffiliate = affiliate;
    document.getElementById('affiliate').value = affiliate.company;
    document.getElementById('affiliateSuggestions').classList.remove('active');
    
    // Update eFarm status when affiliate is selected
    this.updateEFarmStatus('PENDING');
  }

  updateEFarmStatus(status) {
    const statusInput = document.getElementById('eFarmStatus');
    if (!statusInput) {
      return;
    }
    
    // Check if farmOption is set to farm-out (radio button)
    const farmOutRadio = document.querySelector('input[name="farmOption"][value="farm-out"]');
    const isFarmOut = farmOutRadio?.checked || false;
    
    // Canonicalize the status
    const canonical = canonicalizeFarmoutStatus(status) || '';
    
    // Determine if in farmout table based on:
    // 1. Farm-out radio is selected, OR
    // 2. Status explicitly indicates farmout (offered, farmout_*, etc.)
    const explicitFarmoutStatuses = ['offered', 'farmout_unassigned', 'farmout_assigned', 'farm_out_unassigned', 'farm_out_assigned'];
    const rawStatusLower = (status || '').toString().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const isExplicitFarmout = explicitFarmoutStatuses.some(s => rawStatusLower.includes(s.replace(/_/g, ''))) || 
                               rawStatusLower.includes('farmout') || 
                               rawStatusLower.includes('farm_out') ||
                               canonical === 'offered';
    
    const isInFarmoutTable = isFarmOut || isExplicitFarmout;
    
    if (isInFarmoutTable && canonical) {
      // Reservation IS in farmout reservations - green background with status text
      const label = formatFarmoutStatus(canonical);
      statusInput.value = label;
      statusInput.dataset.canonical = canonical;
      statusInput.style.backgroundColor = 'rgba(34, 197, 94, 0.3)'; // Green opaque
      statusInput.style.borderColor = '#22c55e';
      statusInput.style.color = '#166534';
      statusInput.style.fontWeight = '600';
    } else {
      // Reservation is NOT in farmout reservations - blank
      statusInput.value = '';
      statusInput.dataset.canonical = '';
      statusInput.style.backgroundColor = '';
      statusInput.style.borderColor = '';
      statusInput.style.color = '';
      statusInput.style.fontWeight = '';
    }
  }

  setFarmoutModeSelect(mode) {
    const select = document.getElementById('eFarmOut');
    if (!select) {
      return;
    }
    const canonical = canonicalizeFarmoutMode(mode || 'manual');
    select.value = canonical;
    select.dataset.canonical = canonical;
  }

  pickFirstCanonicalStatus(values = []) {
    for (const value of values) {
      if (!value && value !== 0) {
        continue;
      }
      const canonical = canonicalizeFarmoutStatus(value);
      if (canonical) {
        return canonical;
      }
    }
    return null;
  }

  pickFirstCanonicalMode(values = []) {
    for (const value of values) {
      if (!value && value !== 0) {
        continue;
      }
      const canonical = canonicalizeFarmoutMode(value);
      if (canonical) {
        return canonical;
      }
    }
    return canonicalizeFarmoutMode('manual');
  }

  applyFarmoutSnapshotDetails(details) {
    if (!details || typeof details !== 'object') {
      this.updateEFarmStatus('');
      this.setFarmoutModeSelect('manual');
      return;
    }

    const canonicalStatus = this.pickFirstCanonicalStatus([
      details.farmoutStatusCanonical,
      details.eFarmStatus,
      details.efarmStatus
    ]) || '';
    this.updateEFarmStatus(canonicalStatus);

    const canonicalMode = this.pickFirstCanonicalMode([
      details.eFarmOut,
      details.farmoutMode
    ]) || 'manual';
    this.setFarmoutModeSelect(canonicalMode);
  }

  syncFarmoutDisplayFromRecord(record) {
    if (!record || typeof record !== 'object') {
      this.updateEFarmStatus('');
      this.setFarmoutModeSelect('manual');
      return;
    }

    // First, set the farmOption radio based on farmout_mode
    const canonicalMode = this.pickFirstCanonicalMode([
      record.farmoutMode,
      record.farmout_mode,
      record.efarm_out_selection,
      record.eFarmOut,
      record.form_snapshot?.details?.eFarmOut,
      record.form_snapshot?.details?.farmoutMode
    ]) || 'manual';
    this.setFarmoutModeSelect(canonicalMode);
    
    // Also set the farmOption radio button based on mode
    const isFarmoutMode = canonicalMode === 'farm_out' || canonicalMode === 'manual' || canonicalMode === 'automatic';
    const farmOption = record.form_snapshot?.details?.farmOption || record.farmOption || '';
    const farmOutRadio = document.querySelector('input[name="farmOption"][value="farm-out"]');
    const inHouseRadio = document.querySelector('input[name="farmOption"][value="in-house"]');
    
    if (farmOption === 'farm-out' || (isFarmoutMode && farmOption !== 'in-house' && farmOption !== 'farm-in')) {
      if (farmOutRadio) farmOutRadio.checked = true;
    } else {
      if (inHouseRadio) inHouseRadio.checked = true;
    }

    // Now get the raw status (before canonicalization) to preserve farmout prefix
    const rawStatus = record.farmoutStatus || 
                      record.farmout_status || 
                      record.efarm_status ||
                      record.form_snapshot?.details?.farmoutStatusCanonical ||
                      record.form_snapshot?.details?.eFarmStatus ||
                      record.form_snapshot?.details?.efarmStatus ||
                      '';
    this.updateEFarmStatus(rawStatus);
  }

  async openAffiliateModal() {
    const modal = document.getElementById('affiliateModal');
    const modalSearchInput = document.getElementById('affiliateModalSearch');
    
    // Populate affiliate list
    const allAffiliates = await this.affiliateService.getAllAffiliates();
    this.populateAffiliateList(allAffiliates);
    
    // Setup search in modal
    let debounceTimer;
    modalSearchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      const query = e.target.value;
      
      debounceTimer = setTimeout(async () => {
        const results = query.length >= 2 
          ? await this.affiliateService.searchAffiliates(query)
          : await this.affiliateService.getAllAffiliates();
        this.populateAffiliateList(results);
      }, 200);
    });
    
    modal.classList.add('active');
  }

  populateAffiliateList(affiliates) {
    const tbody = document.getElementById('affiliateListBody');
    
    if (!affiliates || affiliates.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">No affiliates found</td></tr>';
      return;
    }

    tbody.innerHTML = affiliates.map(affiliate => `
      <tr>
        <td>${affiliate.company}</td>
        <td>${affiliate.contact}</td>
        <td>${affiliate.phone}</td>
        <td>${affiliate.email}</td>
        <td>${affiliate.location}</td>
        <td>
          <button class="btn-select" data-id="${affiliate.id}">Select</button>
        </td>
      </tr>
    `).join('');

    // Add click handlers for select buttons
    tbody.querySelectorAll('.btn-select').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const affiliateId = e.target.dataset.id;
        const affiliate = await this.affiliateService.getAffiliateById(affiliateId);
        this.selectAffiliate(affiliate);
        this.closeAffiliateModal();
      });
    });
  }

  closeAffiliateModal() {
    document.getElementById('affiliateModal').classList.remove('active');
  }

  handleLocationTypeChange(locationType) {
    console.log('📍 handleLocationTypeChange called with:', locationType);
    
    // Hide all dropdowns
    document.getElementById('storedAddressDropdown').style.display = 'none';
    document.getElementById('airportDropdown').style.display = 'none';
    document.getElementById('fboDropdown').style.display = 'none';

    // Show the selected dropdown
    if (locationType === 'stored') {
      console.log('Showing stored address dropdown');
      document.getElementById('storedAddressDropdown').style.display = 'block';
    } else if (locationType === 'airport') {
      console.log('Showing airport dropdown and setting up autocomplete');
      document.getElementById('airportDropdown').style.display = 'block';
      this.setupAirlineAutocomplete();
    } else if (locationType === 'fbo') {
      console.log('Showing FBO dropdown');
      document.getElementById('fboDropdown').style.display = 'block';
    }
  }

  setupAirlineAutocomplete() {
    const airportSearch = document.getElementById('airportSearch');
    const airportSuggestions = document.getElementById('airportSuggestions');
    const airportSelect = document.getElementById('airportSelect');
    const airlineSection = document.getElementById('airlineSection');
    const airlineSearch = document.getElementById('airlineSearch');
    const airlineSuggestions = document.getElementById('airlineSuggestions');
    const flightNumberInput = document.getElementById('flightNumber');
    const flightSuggestions = document.getElementById('flightSuggestions');

    console.log('✈️ Airport search setup initiated');
    console.log('airportSearch element:', airportSearch);
    console.log('airportSuggestions element:', airportSuggestions);

    // Setup airport search with autocomplete
    if (airportSearch) {
      let airportDebounceTimer;
      
      airportSearch.addEventListener('input', (e) => {
        console.log('🔤 Airport search input:', e.target.value);
        clearTimeout(airportDebounceTimer);
        const query = e.target.value;
        
        if (query.length < 1) {
          airportSuggestions?.classList.remove('active');
          return;
        }
        
        airportDebounceTimer = setTimeout(async () => {
          console.log('🔍 Searching airports for:', query);
          await this.searchAirportsList(query);
        }, 200);
      });

      airportSearch.addEventListener('blur', () => {
        console.log('✈️ Airport search blur');
        setTimeout(() => airportSuggestions?.classList.remove('active'), 200);
      });
      
      console.log('✅ Airport search listeners attached');
    } else {
      console.error('❌ airportSearch element not found!');
    }

    // Show airline section when airport is selected
    airportSelect.addEventListener('change', (e) => {
      if (e.target.value) {
        airlineSection.style.display = 'block';
      } else {
        airlineSection.style.display = 'none';
      }
    });

    // Airline search autocomplete
    let airlineDebounceTimer;
    airlineSearch.addEventListener('input', (e) => {
      clearTimeout(airlineDebounceTimer);
      const query = e.target.value;
      
      if (query.length < 1) {
        airlineSuggestions.classList.remove('active');
        return;
      }
      
      airlineDebounceTimer = setTimeout(() => {
        const results = this.airlineService.searchAirlines(query);
        this.showAirlineSuggestions(results);
      }, 200);
    });

    airlineSearch.addEventListener('blur', () => {
      setTimeout(() => airlineSuggestions.classList.remove('active'), 200);
    });

    // Flight number input
    flightNumberInput.addEventListener('input', async (e) => {
      const flightNum = e.target.value.trim();
      
      if (!this.selectedAirline || !flightNum) {
        flightSuggestions.classList.remove('active');
        return;
      }

      // Auto-search when flight number has 3+ digits
      if (flightNum.length >= 3) {
        await this.searchFlight(this.selectedAirline.code, flightNum);
      }
    });

    flightNumberInput.addEventListener('blur', () => {
      setTimeout(() => flightSuggestions.classList.remove('active'), 200);
    });
  }

  showAirlineSuggestions(airlines) {
    const container = document.getElementById('airlineSuggestions');
    
    if (!airlines || airlines.length === 0) {
      container.classList.remove('active');
      return;
    }

    container.innerHTML = airlines.map(airline => `
      <div class="airline-suggestion-item" data-code="${airline.code}">
        <span class="airline-code">${airline.code}</span>
        <span class="airline-name">${airline.name}</span>
      </div>
    `).join('');

    container.querySelectorAll('.airline-suggestion-item').forEach(item => {
      item.addEventListener('click', () => {
        const code = item.dataset.code;
        const airline = this.airlineService.getAirlineByCode(code);
        this.selectAirline(airline);
        container.classList.remove('active');
      });
    });

    container.classList.add('active');
  }

  async searchAirportsList(query) {
    try {
      console.log('📍 searchAirportsList called with query:', query);
      const { searchAirports } = await import('./api-service.js');
      console.log('✅ searchAirports function imported');
      
      // Get organization ID for local airport lookup
      const organizationId = window.currentOrganizationId || this.organizationId;
      
      // searchAirports now includes LocalAirportsService fallback
      const airports = await searchAirports(query, organizationId);
      console.log('✅ Airports found:', airports);
      
      // If no results from API, try local airports directly
      if ((!airports || airports.length === 0) && organizationId) {
        console.log('📍 Trying local airports fallback');
        const localAirports = await LocalAirportsService.searchLocalAirports(query, organizationId);
        if (localAirports && localAirports.length > 0) {
          const formatted = localAirports.map(a => LocalAirportsService.formatAirport(a));
          console.log('✅ Local airports found:', formatted);
          this.showAirportSuggestions(formatted);
          return;
        }
      }
      
      this.showAirportSuggestions(airports);
    } catch (error) {
      console.error('❌ Airport search error:', error);
      
      // Try local airports as last resort fallback
      try {
        const organizationId = window.currentOrganizationId || this.organizationId;
        if (organizationId) {
          const localAirports = await LocalAirportsService.searchLocalAirports(query, organizationId);
          if (localAirports && localAirports.length > 0) {
            const formatted = localAirports.map(a => LocalAirportsService.formatAirport(a));
            console.log('✅ Fallback to local airports:', formatted);
            this.showAirportSuggestions(formatted);
            return;
          }
        }
      } catch (fallbackError) {
        console.error('❌ Local airport fallback also failed:', fallbackError);
      }
      
      // Show error message only if all fallbacks fail
      const container = document.getElementById('airportSuggestions');
      if (container) {
        container.innerHTML = '<div class="airport-suggestion-item" style="color: red;">Error searching airports. Please try again.</div>';
        container.classList.add('active');
      }
    }
  }

  showAirportSuggestions(airports) {
    const container = document.getElementById('airportSuggestions');
    
    if (!airports || airports.length === 0) {
      container.classList.remove('active');
      return;
    }

    container.innerHTML = airports.slice(0, 8).map(airport => `
      <div class="airport-suggestion-item" data-code="${airport.code}">
        <span class="airport-code">${airport.code}</span>
        <span class="airport-name">${airport.name}</span>
        <span class="airport-city">${airport.city}, ${airport.state || airport.country}</span>
      </div>
    `).join('');

    container.querySelectorAll('.airport-suggestion-item').forEach(item => {
      item.addEventListener('click', () => {
        const code = item.dataset.code;
        const airportName = item.querySelector('.airport-name').textContent;
        this.selectAirport(code, airportName);
      });
    });

    container.classList.add('active');
  }

  selectAirport(code, name) {
    document.getElementById('airportSearch').value = `${code} - ${name}`;
    document.getElementById('airportSelect').value = code;
    document.getElementById('airportSuggestions').classList.remove('active');
    
    // Show airline section
    document.getElementById('airlineSection').style.display = 'block';
    
    // Focus on airline search
    setTimeout(() => {
      document.getElementById('airlineSearch').focus();
    }, 100);
  }

  selectAirline(airline) {
    this.selectedAirline = airline;
    document.getElementById('airlineSearch').value = `${airline.code} - ${airline.name}`;
    document.getElementById('airlineCode').value = airline.code;
    document.getElementById('airlineName').value = airline.name;
    
    // Focus on flight number input
    document.getElementById('flightNumber').focus();
  }

  async searchFlight(airlineCode, flightNumber) {
    try {
      const flightData = await this.airlineService.searchFlights(airlineCode, flightNumber);
      this.populateFlightData(flightData);
    } catch (error) {
      console.error('Flight search error:', error);
    }
  }

  populateFlightData(flightData) {
    document.getElementById('terminalGate').value = `${flightData.terminal} / ${flightData.gate}`;
    document.getElementById('flightStatus').value = flightData.status.toUpperCase();
    document.getElementById('scheduledArrival').value = flightData.scheduledArrival;
    document.getElementById('estimatedArrival').value = flightData.estimatedArrival;
    document.getElementById('originAirport').value = flightData.origin;

    // Show success indicator
    const indicator = document.getElementById('flightStatusIndicator');
    indicator.style.display = 'flex';
    
    // Add status color
    const statusInput = document.getElementById('flightStatus');
    statusInput.style.color = flightData.status === 'on-time' ? '#155724' : 
                              flightData.status === 'delayed' ? '#856404' : '#721c24';
    statusInput.style.fontWeight = '600';

    setTimeout(() => {
      indicator.style.display = 'none';
    }, 3000);
  }

  async createAddressRow() {
    // Get form values - use currentStopType from routing panel or fallback to radio buttons
    const radioBtn = document.querySelector('input[name="stopType"]:checked');
    const stopType = radioBtn ? radioBtn.value : (this.currentStopType || 'pickup');
    const locationName = document.getElementById('locationName').value || 'N/A';
    const address1 = document.getElementById('address1').value;
    const address2 = document.getElementById('address2').value;
    const city = document.getElementById('city').value;
    const state = document.getElementById('state').value;
    const zipCode = document.getElementById('zipCode').value;
    const timeIn = document.getElementById('timeIn').value || 'N/A';

    // Validate required fields
    if (!address1 && !locationName) {
      alert('Please enter a location name or address.');
      return;
    }

    // Check if we should verify the address
    if (address1 && address1.length > 3) {
      // Search for similar addresses (Google Places, biased to local city/state)
      const biasCoords = await this.ensureLocalBiasCoords();
      const effectiveQuery = this.localCityState ? `${address1} ${this.localCityState}` : address1;
      const suggestions = await this.googleMapsService.searchAddresses(effectiveQuery, {
        country: 'US',
        locationBias: biasCoords
      });
      
      if (suggestions && suggestions.length > 0) {
        // Show confirmation modal
        const confirmed = await this.showAddressConfirmation(suggestions, {
          locationName,
          address1,
          address2,
          city,
          state,
          zipCode,
          timeIn,
          stopType
        });

        if (!confirmed) {
          return; // User cancelled
        }
      }
    }

    // Build full address string
    let fullAddress = address1;
    if (address2) fullAddress += `, ${address2}`;
    if (city) fullAddress += `, ${city}`;
    if (state) fullAddress += ` ${state}`;
    if (zipCode) fullAddress += ` ${zipCode}`;

    // Get table body
    const tableBody = document.getElementById('addressTableBody');
    
    // Remove empty message row if it exists
    const emptyRow = tableBody.querySelector('.empty-row');
    if (emptyRow) {
      emptyRow.remove();
    }

    // Create new row
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><span class="stop-type-badge ${stopType}">${stopType}</span></td>
      <td>${locationName}</td>
      <td>${fullAddress}</td>
      <td>${timeIn}</td>
      <td><button class="btn-remove" onclick="const row=this.closest('tr'); row?.remove(); window.reservationForm?.updateTripMetricsFromStops?.();">Remove</button></td>
    `;

    // Persist metadata for downstream calculations
    row.dataset.stopType = stopType;
    row.dataset.locationName = locationName;
    row.dataset.address1 = address1;
    row.dataset.address2 = address2;
    row.dataset.city = city;
    row.dataset.state = state;
    row.dataset.zipCode = zipCode;
    row.dataset.fullAddress = fullAddress;
    row.dataset.timeIn = timeIn;

    tableBody.appendChild(row);

    // Clear form fields
    this.clearAddressForm();

    // Show success feedback
    const createBtn = document.getElementById('createStopBtn');
    const originalText = createBtn.textContent;
    createBtn.textContent = '✓ Added!';
    createBtn.style.background = '#28a745';
    
    setTimeout(() => {
      createBtn.textContent = originalText;
      createBtn.style.background = '';
    }, 1500);

    this.updateTripMetricsFromStops().catch(err => console.warn('⚠️ Unable to update trip metrics:', err));
  }

  clearAddressForm() {
    document.getElementById('locationName').value = '';
    document.getElementById('address1').value = '';
    document.getElementById('address2').value = '';
    document.getElementById('city').value = '';
    document.getElementById('state').value = '';
    document.getElementById('zipCode').value = '';
    const locationNotes = document.getElementById('locationNotes');
    if (locationNotes) locationNotes.value = '';
    const locationPhone = document.getElementById('locationPhone');
    if (locationPhone) locationPhone.value = '';
    document.getElementById('timeIn').value = '';
    
    // Reset stop type radio if it exists
    const pickupRadio = document.querySelector('input[name="stopType"][value="pickup"]');
    if (pickupRadio) pickupRadio.checked = true;

    // Close the entry card
    const entryCard = document.getElementById('addressEntryCard');
    if (entryCard) entryCard.style.display = 'none';
  }

  showAddressConfirmation(suggestions, customData) {
    return new Promise((resolve) => {
      const modal = document.getElementById('addressConfirmModal');
      const listContainer = document.getElementById('addressConfirmList');
      const customPreview = document.getElementById('customAddressPreview');

      // Build custom address preview
      let customText = `${customData.locationName}\n${customData.address1}`;
      if (customData.address2) customText += `, ${customData.address2}`;
      if (customData.city) customText += `\n${customData.city}`;
      if (customData.state) customText += `, ${customData.state}`;
      if (customData.zipCode) customText += ` ${customData.zipCode}`;
      customPreview.textContent = customText;

      // Populate suggestions
      listContainer.innerHTML = suggestions.slice(0, 5).map((suggestion, index) => `
        <label class="address-option-item">
          <input type="radio" name="addressChoice" value="${index}" />
          <div class="address-option-content">
            <strong>${suggestion.description || suggestion.name}</strong>
            <div class="address-details">${suggestion.address || suggestion.description}</div>
          </div>
        </label>
      `).join('');

      // Show modal
      modal.classList.add('active');

      // Handle confirmation
      const confirmBtn = document.getElementById('confirmAddressSelection');
      const cancelBtn = document.getElementById('cancelAddressConfirm');
      const closeBtn = document.getElementById('closeAddressConfirmModal');

      const handleConfirm = () => {
        const selectedRadio = document.querySelector('input[name="addressChoice"]:checked');
        
        if (selectedRadio.value === 'custom') {
          // Use custom text - do nothing, fields are already set
          cleanup();
          resolve(true);
        } else {
          // Use suggested address
          const suggestionIndex = parseInt(selectedRadio.value);
          const selectedAddress = suggestions[suggestionIndex];
          
          // Update form fields with selected address
          this.selectAddress(document.getElementById('address1'), selectedAddress);
          cleanup();
          resolve(true);
        }
      };

      const handleCancel = () => {
        cleanup();
        resolve(false);
      };

      const cleanup = () => {
        modal.classList.remove('active');
        confirmBtn.removeEventListener('click', handleConfirm);
        cancelBtn.removeEventListener('click', handleCancel);
        closeBtn.removeEventListener('click', handleCancel);
      };

      confirmBtn.addEventListener('click', handleConfirm);
      cancelBtn.addEventListener('click', handleCancel);
      closeBtn.addEventListener('click', handleCancel);
    });
  }

  copyPassengerInfo() {
    // Get passenger information
    const passengerFirstName = document.getElementById('passengerFirstName').value;
    const passengerLastName = document.getElementById('passengerLastName').value;
    const passengerPhone = document.getElementById('passengerPhone').value;
    const passengerEmail = document.getElementById('passengerEmail').value;

    if (!passengerFirstName || !passengerLastName) {
      alert('Please enter passenger name first.');
      return;
    }

    // Copy to Booked By section (not Billing Accounts section)
    document.getElementById('bookedByFirstName').value = passengerFirstName;
    document.getElementById('bookedByLastName').value = passengerLastName;
    document.getElementById('bookedByPhone').value = passengerPhone;
    document.getElementById('bookedByEmail').value = passengerEmail;

    // Visual feedback
    const copyBtn = document.getElementById('copyPassengerBtn');
    const originalText = copyBtn.textContent;
    copyBtn.textContent = '✓ Copied!';
    copyBtn.style.background = '#28a745';
    
    setTimeout(() => {
      copyBtn.textContent = originalText;
      copyBtn.style.background = '';
    }, 2000);
  }

  useExistingAccount(account) {
    console.log('📝 useExistingAccount called with:', account);
    console.log('🏢 Account company_name:', account.company_name);
    
    // Populate Billing Accounts section with existing account (using db field names)
    const acctNum = account.account_number || account.id;
    document.getElementById('billingAccountSearch').value = acctNum;
    document.getElementById('billingCompany').value = account.company_name || '';
    document.getElementById('billingFirstName').value = account.first_name || '';
    document.getElementById('billingLastName').value = account.last_name || '';
    
    const billingPhoneField = document.getElementById('billingPhone');
    if (billingPhoneField) {
      billingPhoneField.value = account.phone || account.cell_phone || '';
      console.log('✅ Set billing phone to:', billingPhoneField.value);
    } else {
      console.warn('⚠️ billingPhone field not found');
    }
    
    document.getElementById('billingEmail').value = account.email || '';
    
    console.log('✅ Set billingCompany to:', document.getElementById('billingCompany').value);

    // Cross-fill passenger fields ONLY if account is marked as passenger
    if (account.is_passenger) {
      const passengerFirstName = document.getElementById('passengerFirstName');
      const passengerLastName = document.getElementById('passengerLastName');
      const passengerPhone = document.getElementById('passengerPhone');
      const passengerEmail = document.getElementById('passengerEmail');
      
      let crossFilledFields = [];
      
      if (passengerFirstName && !passengerFirstName.value && account.first_name) {
        passengerFirstName.value = account.first_name;
        crossFilledFields.push('First Name');
      }
      if (passengerLastName && !passengerLastName.value && account.last_name) {
        passengerLastName.value = account.last_name;
        crossFilledFields.push('Last Name');
      }
      if (passengerPhone && !passengerPhone.value && (account.phone || account.cell_phone)) {
        passengerPhone.value = account.phone || account.cell_phone || '';
        crossFilledFields.push('Phone');
        console.log('✅ Cross-filled passenger phone:', passengerPhone.value);
      } else if (!passengerPhone) {
        console.warn('⚠️ passengerPhone element not found during cross-fill');
      }
      if (passengerEmail && !passengerEmail.value && account.email) {
        passengerEmail.value = account.email;
        crossFilledFields.push('Email');
      }

      // Show notification if cross-filling occurred
      if (crossFilledFields.length > 0) {
        this.showCrossFillingNotification('billing', 'passenger', crossFilledFields, account);
      }
    }

    // Cross-fill booking agent fields ONLY if account is marked as booking contact
    if (account.is_booking_contact) {
      const bookingFirstName = document.getElementById('bookedByFirstName');
      const bookingLastName = document.getElementById('bookedByLastName');
      const bookingPhone = document.getElementById('bookedByPhone');
      const bookingEmail = document.getElementById('bookedByEmail');
      
      let crossFilledBookingFields = [];
      
      if (!bookingFirstName.value && account.first_name) {
        bookingFirstName.value = account.first_name;
        crossFilledBookingFields.push('First Name');
      }
      if (!bookingLastName.value && account.last_name) {
        bookingLastName.value = account.last_name;
        crossFilledBookingFields.push('Last Name');
      }
      if (!bookingPhone.value && account.phone) {
        bookingPhone.value = account.phone;
        crossFilledBookingFields.push('Phone');
      }
      if (!bookingEmail.value && account.email) {
        bookingEmail.value = account.email;
        crossFilledBookingFields.push('Email');
      }

      // Show notification if cross-filling occurred
      if (crossFilledBookingFields.length > 0) {
        this.showCrossFillingNotification('billing', 'booking agent', crossFilledBookingFields, account);
      }
      
      // Show booking agent section since we have data
      this.updateBookingAgentVisibility();
    }

    this.updateBillingAccountNumberDisplay(account);

    this.closeModal();
  }

  useAccountForPassenger(account) {
    // Populate Passenger section with selected account
    document.getElementById('passengerFirstName').value = account.first_name || '';
    document.getElementById('passengerLastName').value = account.last_name || '';
    
    const passengerPhoneField = document.getElementById('passengerPhone');
    if (passengerPhoneField) {
      passengerPhoneField.value = account.phone || account.cell_phone || '';
      console.log('✅ Set passenger phone to:', passengerPhoneField.value);
    } else {
      console.warn('⚠️ passengerPhone field not found');
    }
    
    document.getElementById('passengerEmail').value = account.email || '';

    // Cross-fill billing fields ONLY if account is marked as billing client
    if (account.is_billing_client) {
      const billingAccountSearch = document.getElementById('billingAccountSearch');
      const billingCompany = document.getElementById('billingCompany');
      const billingFirstName = document.getElementById('billingFirstName');
      const billingLastName = document.getElementById('billingLastName');
      const billingPhone = document.getElementById('billingPhone');
      const billingEmail = document.getElementById('billingEmail');
      
      let crossFilledFields = [];
      
      if (billingAccountSearch && !billingAccountSearch.value) {
        const acctNum = account.account_number || account.id;
        billingAccountSearch.value = acctNum;
        crossFilledFields.push('Account Search');
      }
      if (billingCompany && !billingCompany.value && account.company_name) {
        billingCompany.value = account.company_name;
        crossFilledFields.push('Company');
      }
      if (billingFirstName && !billingFirstName.value && account.first_name) {
        billingFirstName.value = account.first_name;
        crossFilledFields.push('First Name');
      }
      if (billingLastName && !billingLastName.value && account.last_name) {
        billingLastName.value = account.last_name;
        crossFilledFields.push('Last Name');
      }
      if (billingPhone && !billingPhone.value && (account.phone || account.cell_phone)) {
        billingPhone.value = account.phone || account.cell_phone || '';
        crossFilledFields.push('Phone');
        console.log('✅ Cross-filled billing phone:', billingPhone.value);
      } else if (!billingPhone) {
        console.warn('⚠️ billingPhone element not found during cross-fill');
      }
      if (billingEmail && !billingEmail.value && account.email) {
        billingEmail.value = account.email;
        crossFilledFields.push('Email');
      }

      // Show notification if cross-filling occurred
      if (crossFilledFields.length > 0) {
        this.showCrossFillingNotification('passenger', 'billing', crossFilledFields, account);
      }

      // Update billing account display if billing was filled
      if (!billingAccountSearch.dataset.originalValue) {
        this.updateBillingAccountNumberDisplay(account);
      }
    }

    // Cross-fill booking agent fields ONLY if account is marked as booking contact
    if (account.is_booking_contact) {
      const bookingFirstName = document.getElementById('bookedByFirstName');
      const bookingLastName = document.getElementById('bookedByLastName');
      const bookingPhone = document.getElementById('bookedByPhone');
      const bookingEmail = document.getElementById('bookedByEmail');
      
      let crossFilledBookingFields = [];
      
      if (!bookingFirstName.value && account.first_name) {
        bookingFirstName.value = account.first_name;
        crossFilledBookingFields.push('First Name');
      }
      if (!bookingLastName.value && account.last_name) {
        bookingLastName.value = account.last_name;
        crossFilledBookingFields.push('Last Name');
      }
      if (!bookingPhone.value && account.phone) {
        bookingPhone.value = account.phone;
        crossFilledBookingFields.push('Phone');
      }
      if (!bookingEmail.value && account.email) {
        bookingEmail.value = account.email;
        crossFilledBookingFields.push('Email');
      }

      // Show notification if cross-filling occurred
      if (crossFilledBookingFields.length > 0) {
        this.showCrossFillingNotification('passenger', 'booking agent', crossFilledBookingFields, account);
      }
      
      // Show booking agent section since we have data
      this.updateBookingAgentVisibility();
    }
  }

  showCrossFillingNotification(sourceSection, targetSection, fields, account = null) {
    // Create or reuse notification element
    let notification = document.getElementById('crossFillNotification');
    if (!notification) {
      notification = document.createElement('div');
      notification.id = 'crossFillNotification';
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #28a745;
        color: white;
        padding: 12px 16px;
        border-radius: 4px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        z-index: 1000;
        font-size: 14px;
        max-width: 350px;
        transform: translateX(100%);
        transition: transform 0.3s ease;
      `;
      document.body.appendChild(notification);
    }

    const fieldsList = fields.length > 3 
      ? `${fields.slice(0, 3).join(', ')} and ${fields.length - 3} more`
      : fields.join(', ');

    // Add account type info if available
    let accountTypeInfo = '';
    if (account) {
      const types = [];
      if (account.is_billing_client) types.push('Billing');
      if (account.is_passenger) types.push('Passenger');
      if (account.is_booking_contact) types.push('Booking');
      if (types.length > 0) {
        accountTypeInfo = `<br><small>Account types: ${types.join(', ')}</small>`;
      }
    }

    notification.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 16px;">✓</span>
        <div>
          <strong>Auto-filled from ${sourceSection}:</strong><br>
          ${fieldsList} copied to ${targetSection}${accountTypeInfo}
        </div>
      </div>
    `;

    // Animate in
    notification.style.transform = 'translateX(0)';

    // Auto-hide after 5 seconds (increased for more info)
    setTimeout(() => {
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (notification && notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 5000);
  }

  showSaveNotification(message) {
    let toast = document.getElementById('reservationSaveNotification');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'reservationSaveNotification';
      toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #2b7a0b;
        color: #fff;
        padding: 12px 16px;
        border-radius: 4px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        z-index: 1000;
        font-size: 14px;
        opacity: 0;
        transition: opacity 0.2s ease;
      `;
      document.body.appendChild(toast);
    }
    toast.textContent = message || 'Saved';
    toast.style.opacity = '1';
    setTimeout(() => {
      toast.style.opacity = '0';
    }, 2000);
  }

  /**
   * Auto Farmout Mode: If enabled, automatically set farmout options after save
   * - Selects "Farm-out" radio option
   * - Sets farmout status to "unassigned"
   * - Sets farmout mode to "automatic"
   * - Saves again to persist the farmout settings
   */
  async applyAutoFarmoutIfEnabled() {
    // Check if auto farmout mode is enabled (from localStorage)
    const isAutoFarmoutEnabled = localStorage.getItem('autoFarmoutMode') === 'true';
    
    if (!isAutoFarmoutEnabled) {
      return; // Auto farmout mode not enabled, skip
    }
    
    // Check if this reservation is already marked as farm-out
    const farmOutRadio = document.querySelector('input[name="farmOption"][value="farm-out"]');
    if (farmOutRadio?.checked) {
      console.log('🏠 Auto Farmout: Already set to farm-out, skipping');
      return;
    }
    
    console.log('🏠 Auto Farmout Mode: Automatically setting farmout options...');
    
    try {
      // 1. Select the "Farm-out" radio option
      if (farmOutRadio) {
        farmOutRadio.checked = true;
        farmOutRadio.dispatchEvent(new Event('change', { bubbles: true }));
      }
      
      // 2. Set the Status dropdown to "Farm-out Unassigned"
      const resStatusSelect = document.getElementById('resStatus');
      if (resStatusSelect) {
        resStatusSelect.value = 'farm_out_unassigned';
        resStatusSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
      
      // 3. Set farmout status display to "Farm-out Unassigned"
      const eFarmStatusInput = document.getElementById('eFarmStatus') || document.getElementById('efarmStatus');
      if (eFarmStatusInput) {
        eFarmStatusInput.value = 'Farm-out Unassigned';
        eFarmStatusInput.dataset.canonical = 'unassigned';
        // Update the visual styling
        this.updateEFarmStatus('unassigned');
      }
      
      // 4. Set farmout mode to "automatic"
      const eFarmOutSelect = document.getElementById('eFarmOut');
      if (eFarmOutSelect) {
        // Find the automatic option
        const autoOption = Array.from(eFarmOutSelect.options).find(opt => 
          opt.value.toLowerCase().includes('auto') || 
          opt.text.toLowerCase().includes('auto')
        );
        if (autoOption) {
          eFarmOutSelect.value = autoOption.value;
        } else {
          // Try setting directly to 'automatic'
          eFarmOutSelect.value = 'automatic';
        }
        eFarmOutSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
      
      // Show notification
      this.showAutoFarmoutNotification();
      
      // 4. Save again to persist the farmout settings
      console.log('🏠 Auto Farmout: Saving farmout settings...');
      
      // Small delay to let UI update
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Get the reservation ID from the database by confirmation number
      const confField = document.getElementById('confNumber') || document.getElementById('confirmation-number');
      const currentConfNumber = confField?.value?.trim();
      
      if (currentConfNumber && currentConfNumber !== 'NEW') {
        // Find the reservation by confirmation number to get its ID
        const allReservations = await db.getAllReservations();
        const reservation = allReservations.find(r => 
          r.confirmation_number === currentConfNumber || 
          r.confirmationNumber === currentConfNumber
        );
        
        if (reservation && reservation.id) {
          // Import updateReservation directly from api-service
          const { updateReservation } = await import('./api-service.js');
          await updateReservation(reservation.id, {
            farm_option: 'farm-out',
            farmout_status: 'unassigned',
            farmout_mode: 'automatic',
            // Clear any assigned driver/vehicle since this is now farmed out
            assigned_driver_id: null,
            assigned_driver_name: null,
            fleet_vehicle_id: null,
            driver_status: null,
            status: 'farmout unassigned'
          });
          
          // Also clear the UI fields for driver and vehicle
          const driverField = document.getElementById('assignedDriver') || document.getElementById('driver');
          const vehicleField = document.getElementById('assignedVehicle') || document.getElementById('vehicle');
          if (driverField) driverField.value = '';
          if (vehicleField) vehicleField.value = '';
          
          console.log('✅ Auto Farmout: Farmout settings saved, driver/vehicle cleared');
        } else {
          console.warn('🏠 Auto Farmout: Could not find reservation ID, settings applied locally only');
        }
      }
      
    } catch (error) {
      console.error('❌ Auto Farmout: Error applying farmout settings:', error);
    }
  }
  
  showAutoFarmoutNotification() {
    let toast = document.getElementById('autoFarmoutNotification');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'autoFarmoutNotification';
      toast.style.cssText = `
        position: fixed;
        bottom: 70px;
        right: 20px;
        background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
        color: #fff;
        padding: 12px 16px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(34, 197, 94, 0.4);
        z-index: 1001;
        font-size: 14px;
        font-weight: 600;
        opacity: 0;
        transition: opacity 0.3s ease;
        display: flex;
        align-items: center;
        gap: 8px;
      `;
      document.body.appendChild(toast);
    }
    toast.innerHTML = '<span style="font-size: 18px;">🏠</span> Automatically Farmed Out';
    toast.style.opacity = '1';
    setTimeout(() => {
      toast.style.opacity = '0';
    }, 3000);
  }

  async createNewAccount(passengerInfo) {
    console.log('🆕 createNewAccount called');
    
    // Get data from modal form fields
    const modal = document.getElementById('accountModal');
    if (!modal) {
      console.error('❌ Account modal not found');
      alert('Error: Account modal not found');
      return;
    }
    
    const firstName = modal.querySelector('#accountFirstName')?.value?.trim() || '';
    const lastName = modal.querySelector('#accountLastName')?.value?.trim() || '';
    const company = modal.querySelector('#accountCompany')?.value?.trim() || '';
    const phone = modal.querySelector('#accountPhone')?.value?.trim() || '';
    const email = modal.querySelector('#accountEmail')?.value?.trim() || '';

    console.log('📝 Form data:', { firstName, lastName, company, phone, email });

    // Validate required fields
    if (!firstName || !lastName || !email) {
      alert('First Name, Last Name, and Email are required.');
      return;
    }

    // Get next account number using db module (use cached value when available)
    console.log('📊 Getting next account number, pendingAccountNumber:', this.pendingAccountNumber);
    const nextAccountNumber = this.pendingAccountNumber || await db.getNextAccountNumber();
    console.log('📊 Next account number:', nextAccountNumber);
    
    if (!nextAccountNumber) {
      alert('Unable to determine the next account number. Please try again.');
      return;
    }
    
    // Get organization_id for multi-tenant support
    const organizationId = window.ENV?.ORGANIZATION_ID || localStorage.getItem('relia_organization_id') || null;
    console.log('🏢 Organization ID:', organizationId);
    
    // Prepare account data for db module with proper field mappings
    // Note: Do NOT set 'id' - Supabase auto-generates UUIDs for new accounts
    const accountData = {
      account_number: nextAccountNumber.toString(),
      organization_id: organizationId,
      first_name: firstName,
      last_name: lastName,
      company_name: company,
      phone: phone,
      cell_phone: phone, // Map phone to cell_phone (Cellular Phone 1)
      email: email,
      type: 'individual',
      status: 'active',
      created_at: new Date().toISOString()
    };

    console.log('💾 Saving account:', accountData);

    // Save account using db module (now syncs to Supabase)
    const saved = await db.saveAccount(accountData);
    console.log('💾 Save result:', saved);
    
    if (!saved || !saved.success) {
      console.error('❌ Failed to save account:', saved);
      alert('Error saving account: ' + (saved?.error || 'Unknown error'));
      return;
    }

    // Note: Counter is incremented in supabase-db.js saveAccount() on success

    // Clear cached pending number now that it has been used
    this.pendingAccountNumber = null;

    // Update billing account search field with account number and make readonly
    const billingAccountSearch = document.getElementById('billingAccountSearch');
    billingAccountSearch.value = `${nextAccountNumber} - ${company || `${firstName} ${lastName}`}`;
    billingAccountSearch.setAttribute('readonly', true);
    billingAccountSearch.style.backgroundColor = '#f5f5f5';
    billingAccountSearch.style.cursor = 'not-allowed';

    // Immediately populate billing info on the reservation form
    this.setBillingAccountNumberDisplay(nextAccountNumber.toString());
    
    // Fill in the billing fields from the new account
    const billingCompany = document.getElementById('billingCompany');
    const billingFirstName = document.getElementById('billingFirstName');
    const billingLastName = document.getElementById('billingLastName');
    const billingPhone = document.getElementById('billingPhone');
    const billingEmail = document.getElementById('billingEmail');
    
    if (billingCompany) billingCompany.value = company;
    if (billingFirstName) billingFirstName.value = firstName;
    if (billingLastName) billingLastName.value = lastName;
    if (billingPhone) billingPhone.value = phone;
    if (billingEmail) billingEmail.value = email;

    this.closeModal();
    
    // Show success message
    alert(`✅ Account #${nextAccountNumber} created successfully!\n\nBilling information has been populated on the form.`);

    // Store account info for reference (but don't navigate away)
    const savedId = saved.account?.id || saved.id || nextAccountNumber.toString();
    localStorage.setItem('currentAccountId', savedId);
    localStorage.setItem('currentAccountNumber', nextAccountNumber.toString());
    
    console.log(`✅ Account #${nextAccountNumber} created and populated on reservation form`);
  }

  closeModal() {
    document.getElementById('accountModal').classList.remove('active');
  }

  clearBillingAccount() {
    const billingAccountSearch = document.getElementById('billingAccountSearch');
    if (billingAccountSearch) {
      billingAccountSearch.value = '';
      billingAccountSearch.removeAttribute('readonly');
      billingAccountSearch.style.backgroundColor = '';
      billingAccountSearch.style.cursor = '';
    }

    ['billingCompany', 'billingFirstName', 'billingLastName', 'billingPhone', 'billingEmail'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

    this.setBillingAccountNumberDisplay('');

    const suggestions = document.getElementById('accountSuggestions');
    if (suggestions) {
      suggestions.classList.remove('active');
      suggestions.innerHTML = '';
    }
  }

  clearPassenger() {
    ['passengerFirstName', 'passengerLastName', 'passengerPhone', 'passengerEmail', 'altContactName', 'altContactPhone'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

    const suggestions = document.getElementById('passengerSuggestions');
    if (suggestions) {
      suggestions.classList.remove('active');
      suggestions.innerHTML = '';
    }
  }

  clearBookingAgent() {
    ['bookedByFirstName', 'bookedByLastName', 'bookedByPhone', 'bookedByEmail'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

    const suggestions = document.getElementById('bookingAgentSuggestions');
    if (suggestions) {
      suggestions.classList.remove('active');
      suggestions.innerHTML = '';
    }

    // Hide booking agent section when cleared
    this.updateBookingAgentVisibility();
  }

  /**
   * Show/hide the Booking Agent section based on:
   * 1. Whether any booking agent fields have data
   * 2. Whether the billing account has booking agent requirement
   */
  updateBookingAgentVisibility(forceShow = false) {
    const section = document.getElementById('bookingAgentSection');
    const addLink = document.getElementById('addBookingAgentLink');
    if (!section) return;

    // Check if any booking agent field has data
    const hasBookingAgentData = ['bookedByFirstName', 'bookedByLastName', 'bookedByPhone', 'bookedByEmail']
      .some(id => {
        const el = document.getElementById(id);
        return el && el.value && el.value.trim().length > 0;
      });

    // Show if forced, has data, or account requires it
    const shouldShow = forceShow || hasBookingAgentData || this.accountRequiresBookingAgent;
    section.style.display = shouldShow ? 'block' : 'none';
    
    // Hide/show the "Add Booking Agent" link inversely
    if (addLink) {
      addLink.style.display = shouldShow ? 'none' : 'block';
    }
    
    console.log(`📋 Booking Agent section: ${shouldShow ? 'visible' : 'hidden'} (forceShow=${forceShow}, hasData=${hasBookingAgentData}, accountReq=${this.accountRequiresBookingAgent})`);
  }

  /**
   * Show the booking agent section (e.g., when user clicks a button to add one)
   */
  showBookingAgentSection() {
    this.updateBookingAgentVisibility(true);
    // Focus the first field
    setTimeout(() => {
      const firstField = document.getElementById('bookedByFirstName');
      if (firstField) firstField.focus();
    }, 100);
  }

  /**
   * Setup the booking agent section expand/collapse toggle
   */
  setupBookingAgentToggle() {
    const section = document.getElementById('bookingAgentSection');
    const header = document.getElementById('bookingAgentHeader');
    const toggleBtn = document.getElementById('bookingAgentToggleBtn');
    const content = document.getElementById('bookingAgentContent');
    
    if (!section || !header) return;
    
    const toggleCollapse = (e) => {
      // Don't collapse if clicking buttons (copy, clear)
      if (e.target.closest('.btn-icon') || e.target.closest('#copyBillingToBookingBtn') || e.target.closest('#clearBookingAgentBtn')) {
        return;
      }
      
      section.classList.toggle('collapsed');
      console.log('📋 Booking Agent section toggled:', section.classList.contains('collapsed') ? 'collapsed' : 'expanded');
    };
    
    header.addEventListener('click', toggleCollapse);
    
    if (toggleBtn) {
      toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        section.classList.toggle('collapsed');
      });
    }
  }

  /**
   * Setup phone and email validation for billing, passenger, and booking sections
   */
  setupPhoneEmailValidation() {
    // Phone fields to validate
    const phoneFields = [
      'billingPhone',
      'passengerPhone',
      'bookedByPhone',
      'altContactPhone'
    ];
    
    // Email fields to validate
    const emailFields = [
      'billingEmail',
      'passengerEmail',
      'bookedByEmail'
    ];
    
    // Phone validation regex (supports various formats)
    const phoneRegex = /^[\+]?[(]?[0-9]{1,3}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,4}[-\s\.]?[0-9]{1,9}$/;
    const phoneDigitsMin = 10; // Minimum 10 digits for US phone
    const defaultCountryCode = '+1'; // USA default
    
    // Email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    // Format phone number as +1 (XXX) XXX-XXXX (USA default, international support)
    const formatPhone = (value) => {
      let digits = value.replace(/\D/g, '');
      // If 10 digits, assume USA and add +1
      if (digits.length === 10) {
        return `${defaultCountryCode} (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
      }
      // If 11 digits starting with 1, format as USA
      else if (digits.length === 11 && digits[0] === '1') {
        return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
      }
      // If more than 11 digits, likely international
      else if (digits.length > 11) {
        if (digits.startsWith('1')) {
          return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 11)}${digits.length > 11 ? ' ext. ' + digits.slice(11) : ''}`;
        }
        return '+' + digits.replace(/(\d{1,3})(\d{3})(\d{3})(\d+)/, '$1 $2 $3 $4').trim();
      }
      return value;
    };
    
    // Validate and style phone field
    const validatePhone = (el) => {
      const value = el.value.trim();
      if (!value) {
        el.classList.remove('invalid', 'valid');
        return true; // Empty is ok (not required unless marked required)
      }
      
      const digits = value.replace(/\D/g, '');
      const isValid = digits.length >= phoneDigitsMin && phoneRegex.test(value);
      
      el.classList.toggle('invalid', !isValid);
      el.classList.toggle('valid', isValid);
      
      return isValid;
    };
    
    // Validate and style email field
    const validateEmail = (el) => {
      const value = el.value.trim();
      if (!value) {
        el.classList.remove('invalid', 'valid');
        return true; // Empty is ok (not required unless marked required)
      }
      
      const isValid = emailRegex.test(value);
      
      el.classList.toggle('invalid', !isValid);
      el.classList.toggle('valid', isValid);
      
      return isValid;
    };
    
    // Setup phone field listeners
    phoneFields.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      
      el.addEventListener('blur', () => {
        // Format on blur
        const formatted = formatPhone(el.value);
        if (formatted !== el.value) {
          el.value = formatted;
        }
        validatePhone(el);
      });
      
      el.addEventListener('input', () => {
        // Only validate on input, don't format mid-typing
        validatePhone(el);
      });
    });
    
    // Setup email field listeners
    emailFields.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      
      el.addEventListener('blur', () => {
        validateEmail(el);
      });
      
      el.addEventListener('input', () => {
        validateEmail(el);
      });
    });
    
    console.log('✅ Phone/email validation setup complete');
  }

  copyBillingToPassenger() {
    const firstName = document.getElementById('billingFirstName')?.value || '';
    const lastName = document.getElementById('billingLastName')?.value || '';
    const phone = document.getElementById('billingPhone')?.value || '';
    const email = document.getElementById('billingEmail')?.value || '';

    document.getElementById('passengerFirstName').value = firstName;
    document.getElementById('passengerLastName').value = lastName;
    document.getElementById('passengerPhone').value = phone;
    document.getElementById('passengerEmail').value = email;

    console.log('📋 Copied billing info to passenger');
  }

  copyBillingToBooking() {
    const firstName = document.getElementById('billingFirstName')?.value || '';
    const lastName = document.getElementById('billingLastName')?.value || '';
    const phone = document.getElementById('billingPhone')?.value || '';
    const email = document.getElementById('billingEmail')?.value || '';

    document.getElementById('bookedByFirstName').value = firstName;
    document.getElementById('bookedByLastName').value = lastName;
    document.getElementById('bookedByPhone').value = phone;
    document.getElementById('bookedByEmail').value = email;

    // Show booking agent section since we now have data
    this.updateBookingAgentVisibility();

    console.log('📋 Copied billing info to booking agent');
  }

  // Add Contact Modal Methods
  openAddContactModal() {
    const modal = document.getElementById('addContactModal');
    // Clear form
    document.getElementById('contactCompany').value = '';
    document.getElementById('contactFirstName').value = '';
    document.getElementById('contactLastName').value = '';
    document.getElementById('contactPhone').value = '';
    document.getElementById('contactEmail').value = '';
    document.getElementById('contactAddress').value = '';
    document.getElementById('contactCity').value = '';
    document.getElementById('contactState').value = '';
    document.getElementById('contactZip').value = '';
    document.getElementById('contactCountry').value = 'United States';
    document.getElementById('contactNotes').value = '';
    modal.classList.add('active');
  }

  closeAddContactModal() {
    document.getElementById('addContactModal').classList.remove('active');
  }

  openAddAccountModal() {
    const modal = document.getElementById('accountModal');
    const modalBody = document.getElementById('modalBody');
    
    // Build account form in modal
    modalBody.innerHTML = `
      <div class="form-section">
        <div class="form-group">
          <label>Account Number</label>
          <input type="text" id="accountNumberPreview" class="form-control" placeholder="Fetching next account number..." readonly />
        </div>

        <div class="form-row-2">
          <div class="form-group">
            <label>First Name *</label>
            <input type="text" id="accountFirstName" class="form-control" placeholder="First name" required />
          </div>
          <div class="form-group">
            <label>Last Name *</label>
            <input type="text" id="accountLastName" class="form-control" placeholder="Last name" required />
          </div>
        </div>
        
        <div class="form-group">
          <label>Company Name</label>
          <input type="text" id="accountCompany" class="form-control" placeholder="Company name (optional)" />
        </div>
        
        <div class="form-row-2">
          <div class="form-group">
            <label>Phone</label>
            <input type="text" id="accountPhone" class="form-control" placeholder="Phone number" />
          </div>
          <div class="form-group">
            <label>Email *</label>
            <input type="email" id="accountEmail" class="form-control" placeholder="Email address" required />
          </div>
        </div>
      </div>
    `;
    
    this.prefillAccountNumberForModal();
    modal.classList.add('active');
  }

  async prefillAccountNumberForModal() {
    const acctField = document.getElementById('accountNumberPreview');
    if (!acctField) return;

    acctField.value = '';
    acctField.placeholder = 'Fetching next account number...';

    try {
      const nextNum = await db.getNextAccountNumber();
      if (!nextNum) throw new Error('No account number returned');

      const numStr = nextNum.toString();
      this.pendingAccountNumber = nextNum;
      acctField.value = numStr;
      acctField.placeholder = '';
    } catch (e) {
      console.warn('⚠️ Failed to fetch next account number for modal:', e);
      this.pendingAccountNumber = null;
      acctField.placeholder = 'Will be assigned on save';
    }
  }

  saveNewContact() {
    // Validate required fields
    const firstName = document.getElementById('contactFirstName').value.trim();
    const lastName = document.getElementById('contactLastName').value.trim();

    if (!firstName || !lastName) {
      alert('First name and last name are required.');
      return;
    }

    // Build contact data (using db schema field names)
    const contactData = {
      first_name: firstName,
      last_name: lastName,
      company_name: document.getElementById('contactCompany').value.trim(),
      phone: document.getElementById('contactPhone').value.trim(),
      email: document.getElementById('contactEmail').value.trim(),
      address1: document.getElementById('contactAddress').value.trim(),
      city: document.getElementById('contactCity').value.trim(),
      state_prov: document.getElementById('contactState').value.trim(),
      zip_post: document.getElementById('contactZip').value.trim(),
      country: document.getElementById('contactCountry').value.trim(),
      notes_private: document.getElementById('contactNotes').value.trim(),
      type: 'individual',
      status: 'active'
    };

    // Save to db
    try {
      const saved = db.saveAccount(contactData);
      console.log('✅ Contact saved:', saved);

      // Close modal
      this.closeAddContactModal();

      // Auto-populate the account field
      const displayName = `${firstName} ${lastName}${contactData.company_name ? ' - ' + contactData.company_name : ''}`;
      document.getElementById('billingAccountSearch').value = displayName;
      
      // Also populate billing fields
      document.getElementById('billingFirstName').value = firstName;
      document.getElementById('billingLastName').value = lastName;
      document.getElementById('billingCompany').value = contactData.company_name;
      document.getElementById('billingPhone').value = contactData.phone;
      document.getElementById('billingEmail').value = contactData.email;

      // Show success feedback
      alert(`Contact "${firstName} ${lastName}" saved successfully!`);
    } catch (error) {
      console.error('Error saving contact:', error);
      alert('Error saving contact: ' + error.message);
    }
  }

  copyPassengerToBilling() {
    console.log('🚀 copyPassengerToBilling() called');
    
    try {
      // Get passenger data
      const firstName = document.getElementById('passengerFirstName')?.value?.trim() || '';
      const lastName = document.getElementById('passengerLastName')?.value?.trim() || '';
      const phone = document.getElementById('passengerPhone')?.value?.trim() || '';
      const email = document.getElementById('passengerEmail')?.value?.trim() || '';

      console.log('📝 Passenger data:', { firstName, lastName, phone, email });

      if (!firstName && !lastName && !phone && !email) {
        console.warn('⚠️ No passenger data to copy');
        return;
      }

      // Copy passenger → billing fields
      const billingFirstName = document.getElementById('billingFirstName');
      const billingLastName = document.getElementById('billingLastName');
      const billingPhone = document.getElementById('billingPhone');
      const billingEmail = document.getElementById('billingEmail');
      const billingAccountSearch = document.getElementById('billingAccountSearch');

      if (billingFirstName && firstName) billingFirstName.value = firstName;
      if (billingLastName && lastName) billingLastName.value = lastName;
      if (billingPhone && phone) billingPhone.value = phone;
      if (billingEmail && email) billingEmail.value = email;
      if (billingAccountSearch && (firstName || lastName)) {
        billingAccountSearch.value = `${firstName} ${lastName}`.trim();
      }

      console.log('✅ Passenger → Billing fields copied');
    } catch (error) {
      console.error('❌ Error in copyPassengerToBilling:', error);
    }
  }

  setupMatchDetection() {
    // Watch for changes in billing, passenger, and booking fields
    const billingFields = ['billingFirstName', 'billingLastName', 'billingEmail'];
    const passengerFields = ['passengerFirstName', 'passengerLastName', 'passengerEmail'];
    const bookingFields = ['bookedByFirstName', 'bookedByLastName', 'bookedByEmail'];
    
    const checkMatches = () => {
      // Check if passenger matches billing
      const passengerMatches = billingFields.every((field, index) => {
        const billingValue = document.getElementById(field)?.value?.toLowerCase().trim() || '';
        const passengerField = passengerFields[index];
        const passengerValue = document.getElementById(passengerField)?.value?.toLowerCase().trim() || '';
        return billingValue && passengerValue && billingValue === passengerValue;
      });
      
      // Check if booking agent matches billing
      const bookingMatches = billingFields.every((field, index) => {
        const billingValue = document.getElementById(field)?.value?.toLowerCase().trim() || '';
        const bookingField = bookingFields[index];
        const bookingValue = document.getElementById(bookingField)?.value?.toLowerCase().trim() || '';
        return billingValue && bookingValue && billingValue === bookingValue;
      });
      
      // Log matches for debugging
      if (passengerMatches) {
        console.log('✅ Passenger matches billing');
      }
      if (bookingMatches) {
        console.log('✅ Booking agent matches billing');
      }
      
      // Store match status for use during save
      this.passengerMatchesBilling = passengerMatches;
      this.bookingMatchesBilling = bookingMatches;
    };
    
    // Add listeners to all relevant fields
    [...billingFields, ...passengerFields, ...bookingFields].forEach(fieldId => {
      const field = document.getElementById(fieldId);
      if (field) {
        field.addEventListener('blur', checkMatches);
        field.addEventListener('change', checkMatches);
      }
    });
  }

  async createAccountFromBilling() {
    console.log('🚀 createAccountFromBilling() called');
    
    // Check if we're in localhost development mode
    const isLocalhost = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1' ||
                       window.location.protocol === 'file:';
    
    if (isLocalhost) {
      console.log('🔧 Development mode detected - bypassing Supabase authentication');
    }
    
    try {
      // Collect billing section fields
      const firstNameEl = document.getElementById('billingFirstName');
      const lastNameEl = document.getElementById('billingLastName');
      const phoneEl = document.getElementById('billingPhone');
      const emailEl = document.getElementById('billingEmail');
      const companyEl = document.getElementById('billingCompany');
      
      console.log('🔍 Found billing elements:', {
        firstNameEl: !!firstNameEl,
        lastNameEl: !!lastNameEl,
        phoneEl: !!phoneEl,
        emailEl: !!emailEl,
        companyEl: !!companyEl
      });
      
      const firstName = firstNameEl?.value?.trim() || '';
      const lastName = lastNameEl?.value?.trim() || '';
      const phone = phoneEl?.value?.trim() || '';
      const email = emailEl?.value?.trim() || '';
      const company = companyEl?.value?.trim() || '';

      console.log('📝 Collected billing values:', {
        firstName,
        lastName,
        phone,
        email,
        company
      });

      // Determine which tickers should be checked
      const passengerHasInfo = [
        document.getElementById('passengerFirstName')?.value?.trim(),
        document.getElementById('passengerLastName')?.value?.trim(),
        document.getElementById('passengerPhone')?.value?.trim(),
        document.getElementById('passengerEmail')?.value?.trim()
      ].some(v => !!v);

      const bookingHasInfo = [
        document.getElementById('bookedByFirstName')?.value?.trim(),
        document.getElementById('bookedByLastName')?.value?.trim(),
        document.getElementById('bookedByPhone')?.value?.trim(),
        document.getElementById('bookedByEmail')?.value?.trim()
      ].some(v => !!v);

      // Collect any address-like fields on the reservation form (if present)
      const contactAddress1 = document.getElementById('contactAddress')?.value?.trim() || '';
      const contactCity = document.getElementById('contactCity')?.value?.trim() || '';
      const contactState = document.getElementById('contactState')?.value?.trim() || '';
      const contactZip = document.getElementById('contactZip')?.value?.trim() || '';
      const contactCountry = document.getElementById('contactCountry')?.value?.trim() || '';

      const address1 = document.getElementById('address1')?.value?.trim() || '';
      const address2 = document.getElementById('address2')?.value?.trim() || '';
      const city = document.getElementById('city')?.value?.trim() || '';
      const state = document.getElementById('state')?.value?.trim() || '';
      const zip = document.getElementById('zipCode')?.value?.trim() || '';
      const country = document.getElementById('country')?.value?.trim() || '';

      const draftAddress1 = contactAddress1 || address1;
      const draftCity = contactCity || city;
      const draftState = contactState || state;
      const draftZip = contactZip || zip;
      const draftCountry = contactCountry || country;
      const draftAddress2 = address2;

      console.log('📝 Billing → Account draft:', {
        firstName,
        lastName,
        phone,
        email,
        company,
        draftAddress1,
        draftAddress2,
        draftCity,
        draftState,
        draftZip,
        draftCountry
      });

      if ((!firstName || !lastName) && !company) {
        console.warn('⚠️ Insufficient billing information for account creation');
        alert('Please enter Billing First/Last Name or Company before creating an account.');
        return;
      }

      console.log('✅ Billing information validation passed');

      // Store draft for Accounts page to apply (Account # is assigned on SAVE in accounts)
      const draft = {
        first_name: firstName,
        last_name: lastName,
        company_name: company,
        phone: phone,
        cell_phone: phone,
        email: email,
        type: 'individual',
        status: 'active',
        types: {
          billing: true,
          passenger: passengerHasInfo,
          booking: bookingHasInfo
        },
        address: {
          address_type: 'billing',
          address_name: 'Billing',
          address_line1: draftAddress1,
          address_line2: draftAddress2,
          city: draftCity,
          state: draftState,
          zip: draftZip,
          country: draftCountry
        }
      };

      console.log('💾 Storing account draft:', draft);
      localStorage.setItem('relia_account_draft', JSON.stringify(draft));
      
      // Verify the draft was stored
      const storedDraft = localStorage.getItem('relia_account_draft');
      console.log('✅ Draft stored successfully:', !!storedDraft);
      if (storedDraft) {
        console.log('📋 Stored draft content:', storedDraft.substring(0, 100) + '...');
      }

      // Remember where to return if popup isn't available
      try {
        localStorage.setItem('relia_return_to_reservation_url', window.location.href);
        console.log('🔗 Stored return URL:', window.location.href);
      } catch (e) {
        console.warn('⚠️ Failed to store return URL:', e);
      }

      // Open Accounts in a popup (preferred). Fallback to same window.
      const url = 'accounts.html?mode=new&from=reservation';
      console.log('🌐 Opening accounts page:', url);
      
      // Try popup first
      const popup = window.open(url, 'ReliaAccounts', 'width=1200,height=900,resizable=yes,scrollbars=yes');
      
      if (popup && popup !== window) {
        console.log('✅ Popup opened successfully');
        try { 
          popup.focus(); 
          console.log('✅ Popup focused');
        } catch (e) { 
          console.warn('⚠️ Failed to focus popup:', e);
        }
      } else {
        // Popup was blocked or failed - open in same window
        console.log('⚠️ Popup blocked or failed, opening in same window');
        alert('Account page will open in the same window. You can return to this reservation using the browser back button.');
        window.location.href = url;
      }
    } catch (error) {
      console.error('❌ Error in createAccountFromBilling:', error);
      console.error('❌ Error stack:', error.stack);
      alert('Error creating account: ' + error.message);
    }
  }

  copyPassengerToBillingAndOpenAccounts() {
    console.log('🚀 copyPassengerToBillingAndOpenAccounts() called');
    
    try {
      // Get passenger data
      const firstName = document.getElementById('passengerFirstName')?.value?.trim() || '';
      const lastName = document.getElementById('passengerLastName')?.value?.trim() || '';
      const phone = document.getElementById('passengerPhone')?.value?.trim() || '';
      const email = document.getElementById('passengerEmail')?.value?.trim() || '';

      console.log('📝 Passenger data:', { firstName, lastName, phone, email });

      if (!firstName || !lastName) {
        console.warn('⚠️ Passenger first and last name required');
        return;
      }

      // Step 1: Copy passenger → billing fields
      const billingFirstName = document.getElementById('billingFirstName');
      const billingLastName = document.getElementById('billingLastName');
      const billingPhone = document.getElementById('billingPhone');
      const billingEmail = document.getElementById('billingEmail');
      const billingAccountSearch = document.getElementById('billingAccountSearch');
      const billingCompany = document.getElementById('billingCompany');

      if (!billingFirstName || !billingLastName) {
        console.error('❌ Billing fields not found in DOM!');
        return;
      }

      billingFirstName.value = firstName;
      billingLastName.value = lastName;
      billingPhone.value = phone;
      billingEmail.value = email;
      billingAccountSearch.value = `${firstName} ${lastName}`;

      console.log('✅ Passenger → Billing fields copied');

      // Step 2: Stash draft account for Accounts page to prefill
      const draft = {
        first_name: firstName,
        last_name: lastName,
        company_name: billingCompany?.value?.trim() || '',
        phone: phone,
        email: email,
        type: 'individual',
        status: 'active'
      };

      localStorage.setItem('relia_account_draft', JSON.stringify(draft));
      console.log('✅ Account draft saved to localStorage:', draft);

      // Step 3: Show success feedback and open Accounts page
      const btn = document.getElementById('copyPassengerToAccountBtn');
      if (btn) {
        const originalText = btn.textContent;
        btn.textContent = '✓ Opening Accounts...';
        btn.style.background = '#28a745';
        btn.style.color = 'white';
        btn.disabled = true;

        // Open Accounts page after brief delay
        setTimeout(() => {
          console.log('🌐 Navigating to accounts.html');
          window.location.href = 'accounts.html?mode=new';
        }, 800);
      }
    } catch (error) {
      console.error('❌ Error in copyPassengerToBillingAndOpenAccounts:', error);
    }
  }

  async searchAccounts(query) {
    const container = document.getElementById('accountSuggestions');
    if (!container) return;
    if (!query || query.length < 2) {
      container.classList.remove('active');
      return;
    }

    try {
      const results = await db.searchAccounts(query);
      if (!results || results.length === 0) {
        container.classList.remove('active');
        return;
      }

      container.innerHTML = results.map(account => `
        <div class="suggestion-item" data-account-id="${account.id}">
          <strong>${account.account_number || ''}</strong> - ${account.first_name || ''} ${account.last_name || ''} ${account.company_name ? '<span class="company-tag">' + account.company_name + '</span>' : ''}
        </div>
      `).join('');

      container.classList.add('active');

      container.querySelectorAll('.suggestion-item').forEach(item => {
        item.addEventListener('click', async () => {
          const accountId = item.dataset.accountId;
          let account = results.find(r => String(r.id) === String(accountId));
          if (!account) {
            account = await db.getAccountById(accountId);
          }
          if (account) {
            this.useExistingAccount(account);
            container.classList.remove('active');
          }
        });
      });
    } catch (error) {
      console.error('❌ searchAccounts failed:', error);
      container.classList.remove('active');
    }
  }

  async searchAccountsForPassenger(query, sourceField = null) {
    const container = document.getElementById('passengerSuggestions');
    if (!container) return;
    if (!query || query.length < 2) {
      container.classList.remove('active');
      return;
    }

    try {
      // Prevent dropdown flicker from overlapping local passenger autocomplete
      container.dataset.locked = 'accounts';
      // Track hover to prevent flicker on blur
      if (!container.dataset.hoverBound) {
        container.addEventListener('mouseenter', () => { container.dataset.hovering = '1'; });
        container.addEventListener('mouseleave', () => { delete container.dataset.hovering; });
        container.dataset.hoverBound = '1';
      }

      const results = await db.searchAccounts(query);
      if (!results || results.length === 0) {
        container.classList.remove('active');
        return;
      }

      container.innerHTML = results.map(account => `
        <div class="suggestion-item" data-account-id="${account.id}">
          <strong>${account.account_number || ''}</strong> - ${account.first_name || ''} ${account.last_name || ''} ${account.company_name ? '<span class="company-tag">' + account.company_name + '</span>' : ''}
        </div>
      `).join('');

      container.classList.add('active');

      container.querySelectorAll('.suggestion-item').forEach(item => {
        item.addEventListener('click', async () => {
          const accountId = item.dataset.accountId;
          let account = results.find(r => String(r.id) === String(accountId));
          if (!account) {
            account = await db.getAccountById(accountId);
          }
          if (account) {
            this.useAccountForPassenger(account);
            container.classList.remove('active');
          }
        });
      });
    } catch (error) {
      console.error('❌ searchAccountsForPassenger failed:', error);
      container.classList.remove('active');
    } finally {
      delete container.dataset.locked;
    }
  }

  async searchAccountsForBookingAgent(query, sourceField = null) {
    const container = document.getElementById('bookingAgentSuggestions');
    if (!container) return;
    if (!query || query.length < 2) {
      container.classList.remove('active');
      return;
    }

    try {
      const results = await db.searchAccounts(query);
      if (!results || results.length === 0) {
        container.classList.remove('active');
        return;
      }

      container.innerHTML = results.map(account => `
        <div class="suggestion-item" data-account-id="${account.id}">
          <strong>${account.account_number || ''}</strong> - ${account.first_name || ''} ${account.last_name || ''} ${account.company_name ? '<span class="company-tag">' + account.company_name + '</span>' : ''}
        </div>
      `).join('');

      container.classList.add('active');

      container.querySelectorAll('.suggestion-item').forEach(item => {
        item.addEventListener('click', async () => {
          const accountId = item.dataset.accountId;
          let account = results.find(r => String(r.id) === String(accountId));
          if (!account) {
            account = await db.getAccountById(accountId);
          }
          if (account) {
            this.useAccountForBookingAgent(account);
            container.classList.remove('active');
          }
        });
      });
    } catch (error) {
      console.error('❌ searchAccountsForBookingAgent failed:', error);
      container.classList.remove('active');
    }
  }

  useAccountForBookingAgent(account) {
    // Populate Booking Agent section with selected account
    document.getElementById('bookedByFirstName').value = account.first_name || '';
    document.getElementById('bookedByLastName').value = account.last_name || '';
    document.getElementById('bookedByPhone').value = account.phone || account.cell_phone || '';
    document.getElementById('bookedByEmail').value = account.email || '';

    // Show the booking agent section since we now have data
    this.updateBookingAgentVisibility();

    // Cross-fill billing fields ONLY if account is marked as billing client
    if (account.is_billing_client) {
      const billingAccountSearch = document.getElementById('billingAccountSearch');
      const billingCompany = document.getElementById('billingCompany');
      const billingFirstName = document.getElementById('billingFirstName');
      const billingLastName = document.getElementById('billingLastName');
      const billingPhone = document.getElementById('billingPhone');
      const billingEmail = document.getElementById('billingEmail');
      
      let crossFilledFields = [];
      
      if (!billingAccountSearch.value) {
        const acctNum = account.account_number || account.id;
        billingAccountSearch.value = `${acctNum} - ${account.first_name} ${account.last_name}`;
        crossFilledFields.push('Account Search');
      }
      if (!billingCompany.value && account.company_name) {
        billingCompany.value = account.company_name;
        crossFilledFields.push('Company');
      }
      if (!billingFirstName.value && account.first_name) {
        billingFirstName.value = account.first_name;
        crossFilledFields.push('First Name');
      }
      if (!billingLastName.value && account.last_name) {
        billingLastName.value = account.last_name;
        crossFilledFields.push('Last Name');
      }
      if (!billingPhone.value && account.phone) {
        billingPhone.value = account.phone;
        crossFilledFields.push('Phone');
      }
      if (!billingEmail.value && account.email) {
        billingEmail.value = account.email;
        crossFilledFields.push('Email');
      }

      // Show notification if cross-filling occurred
      if (crossFilledFields.length > 0) {
        this.showCrossFillingNotification('booking agent', 'billing', crossFilledFields, account);
      }

      // Update billing account display if billing was filled
      if (!billingAccountSearch.dataset.originalValue) {
        this.updateBillingAccountNumberDisplay(account);
      }
    }

    // Cross-fill passenger fields ONLY if account is marked as passenger
    if (account.is_passenger) {
      const passengerFirstName = document.getElementById('passengerFirstName');
      const passengerLastName = document.getElementById('passengerLastName');
      const passengerPhone = document.getElementById('passengerPhone');
      const passengerEmail = document.getElementById('passengerEmail');
      
      let crossFilledPassengerFields = [];
      
      if (!passengerFirstName.value && account.first_name) {
        passengerFirstName.value = account.first_name;
        crossFilledPassengerFields.push('First Name');
      }
      if (!passengerLastName.value && account.last_name) {
        passengerLastName.value = account.last_name;
        crossFilledPassengerFields.push('Last Name');
      }
      if (!passengerPhone.value && account.phone) {
        passengerPhone.value = account.phone;
        crossFilledPassengerFields.push('Phone');
      }
      if (!passengerEmail.value && account.email) {
        passengerEmail.value = account.email;
        crossFilledPassengerFields.push('Email');
      }

      // Show notification if cross-filling occurred
      if (crossFilledPassengerFields.length > 0) {
        this.showCrossFillingNotification('booking agent', 'passenger', crossFilledPassengerFields, account);
      }
    }
  }

  async searchAccountsByCompany(query) {
    const container = document.getElementById('accountSuggestions');
    if (!container) return;
    if (!query || query.length < 2) {
      container.classList.remove('active');
      return;
    }

    try {
      const results = await db.searchAccountsByCompany(query);
      if (!results || results.length === 0) {
        container.classList.remove('active');
        return;
      }

      container.innerHTML = results.map(account => `
        <div class="suggestion-item" data-account-id="${account.id}">
          ${account.company_name} (${account.first_name || ''} ${account.last_name || ''})
        </div>
      `).join('');

      container.classList.add('active');

      container.querySelectorAll('.suggestion-item').forEach(item => {
        item.addEventListener('click', async () => {
          const accountId = item.dataset.accountId;
          const account = await db.getAccountById(accountId);
          if (account) {
            this.useExistingAccount(account);
            container.classList.remove('active');
          }
        });
      });
    } catch (error) {
      console.error('❌ searchAccountsByCompany failed:', error);
      container.classList.remove('active');
    }
  }

  setupPassengerDbAutocomplete() {
    this.setupDbAutocomplete({
      fieldIds: ['passengerFirstName', 'passengerLastName', 'passengerPhone', 'passengerEmail'],
      containerId: 'passengerSuggestions',
      minChars: 3,
      searchFn: (query) => (db.searchPassengers(query) || []).slice(0, 10),
      renderItem: (p) => {
        const firstName = p.firstName || p.first_name || '';
        const lastName = p.lastName || p.last_name || '';
        const email = p.email || '';
        const phone = p.phone || '';
        const label = `${firstName} ${lastName}`.trim() || '(Unnamed)';
        const meta = [email, phone].filter(Boolean).join(' • ');
        return `${label}${meta ? ` <span style="color:#666;font-size:12px;">${meta}</span>` : ''}`;
      },
      onSelect: (p) => {
        document.getElementById('passengerFirstName').value = p.firstName || p.first_name || '';
        document.getElementById('passengerLastName').value = p.lastName || p.last_name || '';
        document.getElementById('passengerPhone').value = p.phone || '';
        document.getElementById('passengerEmail').value = p.email || '';
      }
    });
  }

  setupBookingAgentDbAutocomplete() {
    this.setupDbAutocomplete({
      fieldIds: ['bookedByFirstName', 'bookedByLastName', 'bookedByPhone', 'bookedByEmail'],
      containerId: 'bookingAgentSuggestions',
      minChars: 3,
      searchFn: (query) => (db.searchBookingAgents(query) || []).slice(0, 10),
      renderItem: (a) => {
        const firstName = a.firstName || a.first_name || '';
        const lastName = a.lastName || a.last_name || '';
        const email = a.email || '';
        const phone = a.phone || '';
        const label = `${firstName} ${lastName}`.trim() || '(Unnamed)';
        const meta = [email, phone].filter(Boolean).join(' • ');
        return `${label}${meta ? ` <span style="color:#666;font-size:12px;">${meta}</span>` : ''}`;
      },
      onSelect: (a) => {
        document.getElementById('bookedByFirstName').value = a.firstName || a.first_name || '';
        document.getElementById('bookedByLastName').value = a.lastName || a.last_name || '';
        document.getElementById('bookedByPhone').value = a.phone || '';
        document.getElementById('bookedByEmail').value = a.email || '';
      }
    });
  }

  setupDbAutocomplete({ fieldIds, containerId, minChars, searchFn, renderItem, onSelect }) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const isLocked = () => container.dataset.locked === 'accounts';

    let debounceTimer;
    const hide = () => {
      if (isLocked()) return;
      container.classList.remove('active');
      container.innerHTML = '';
    };

    const showResults = (results) => {
      if (isLocked()) return;
      if (!results || results.length === 0) {
        hide();
        return;
      }

      container.innerHTML = results.map((item, idx) => {
        const html = renderItem(item);
        return `<div class="suggestion-item" data-index="${idx}">${html}</div>`;
      }).join('');
      container.classList.add('active');

      container.querySelectorAll('.suggestion-item').forEach(el => {
        el.addEventListener('click', () => {
          const idx = parseInt(el.dataset.index, 10);
          const picked = results[idx];
          if (!picked) return;
          onSelect(picked);
          hide();
        });
      });
    };

    const handleInput = (value) => {
      if (isLocked()) return;
      const query = (value || '').toString().trim();
      if (query.length < minChars) {
        hide();
        return;
      }

      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        try {
          showResults(searchFn(query));
        } catch (e) {
          console.warn('⚠️ Autocomplete search failed:', e);
          hide();
        }
      }, 120);
    };

    fieldIds.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', (e) => handleInput(e.target.value));
      el.addEventListener('blur', () => setTimeout(hide, 200));
      el.addEventListener('focus', (e) => handleInput(e.target.value));
    });
  }

  /**
   * Setup the consolidated routing panel with quick-add buttons and tabbed entry form
   */
  setupRoutingPanel() {
    const panel = document.querySelector('.routing-panel');
    if (!panel) return;

    // Current stop type being added
    this.currentStopType = 'pickup';

    // Quick action buttons
    const addPickupBtn = document.getElementById('addPickupBtn');
    const addDropoffBtn = document.getElementById('addDropoffBtn');
    const addStopBtn = document.getElementById('addStopBtn');
    const addWaitBtn = document.getElementById('addWaitBtn');

    const openEntryForm = (type) => {
      this.currentStopType = type;
      const card = document.getElementById('addressEntryCard');
      const label = document.getElementById('entryTypeLabel');
      
      const labels = {
        pickup: '📍 Adding: Pick-up',
        dropoff: '🎯 Adding: Drop-off',
        stop: '⏸️ Adding: Stop',
        wait: '⏱️ Adding: Wait'
      };
      
      if (label) label.textContent = labels[type] || 'Adding Location';
      if (card) {
        card.style.display = 'block';
        // Focus the location name field
        setTimeout(() => {
          const locationInput = document.getElementById('locationName');
          if (locationInput) locationInput.focus();
        }, 100);
      }
    };

    if (addPickupBtn) addPickupBtn.addEventListener('click', () => openEntryForm('pickup'));
    if (addDropoffBtn) addDropoffBtn.addEventListener('click', () => openEntryForm('dropoff'));
    if (addStopBtn) addStopBtn.addEventListener('click', () => openEntryForm('stop'));
    if (addWaitBtn) addWaitBtn.addEventListener('click', () => openEntryForm('wait'));

    // Close/Cancel buttons
    const closeEntryBtn = document.getElementById('closeEntryBtn');
    const cancelEntryBtn = document.getElementById('cancelEntryBtn');

    const closeEntryForm = () => {
      const card = document.getElementById('addressEntryCard');
      if (card) card.style.display = 'none';
      this.clearAddressEntryForm();
    };

    if (closeEntryBtn) closeEntryBtn.addEventListener('click', closeEntryForm);
    if (cancelEntryBtn) cancelEntryBtn.addEventListener('click', closeEntryForm);

    // Location type tabs
    const tabs = document.querySelectorAll('.location-tab');
    const panels = {
      search: document.getElementById('panelSearch'),
      stored: document.getElementById('panelStored'),
      airport: document.getElementById('panelAirport'),
      fbo: document.getElementById('panelFBO')
    };

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const type = tab.dataset.type;
        
        // Update active tab
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // Show correct panel
        Object.entries(panels).forEach(([key, panelEl]) => {
          if (panelEl) panelEl.style.display = key === type ? 'block' : 'none';
        });
      });
    });

    // Airport search handler
    const airportSearch = document.getElementById('airportSearch');
    if (airportSearch) {
      let debounceTimer;
      airportSearch.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          if (typeof window.handleAirportSearch === 'function') {
            window.handleAirportSearch(e.target.value);
          }
        }, 200);
      });
    }

    console.log('✅ Routing panel setup complete');
  }

  /**
   * Clear the address entry form fields
   */
  clearAddressEntryForm() {
    const fields = [
      'locationName', 'address1', 'address2', 'city', 'zipCode', 
      'locationNotes', 'timeIn', 'airportSearch', 'airlineSearch',
      'flightNumber', 'storedTimeIn', 'fboTimeIn'
    ];
    fields.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    
    // Reset state dropdown
    const stateEl = document.getElementById('state');
    if (stateEl) stateEl.selectedIndex = 0;
    
    // Reset country dropdown
    const countryEl = document.getElementById('country');
    if (countryEl) countryEl.value = 'US';

    // Hide airline section
    const airlineSection = document.getElementById('airlineSection');
    if (airlineSection) airlineSection.style.display = 'none';
  }

  setupNotesTabs() {
    const tabs = document.querySelectorAll('.notes-tab');
    const panels = document.querySelectorAll('.notes-panel');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;

        // Remove active class from all tabs and panels
        tabs.forEach(t => t.classList.remove('active'));
        panels.forEach(p => p.classList.remove('active'));

        // Add active class to clicked tab and corresponding panel
        tab.classList.add('active');
        if (tabName === 'trip') {
          document.getElementById('tripNotesPanel').classList.add('active');
        } else if (tabName === 'billpax') {
          document.getElementById('billPaxNotesPanel').classList.add('active');
        }
      });
    });
  }

  setupLocationNameSearch() {
    const locationNameInput = document.getElementById('locationName');
    const suggestionsContainer = document.getElementById('locationNameSuggestions');
    let debounceTimer;

    locationNameInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      const query = e.target.value;

      if (query.length < 3) {
        suggestionsContainer.classList.remove('active');
        return;
      }

      debounceTimer = setTimeout(async () => {
        await this.searchLocationPOI(query);
      }, 300);
    });

    locationNameInput.addEventListener('blur', () => {
      setTimeout(() => suggestionsContainer.classList.remove('active'), 200);
    });
  }

  async searchLocationPOI(query) {
    try {
      const results = [];
      const bias = await this.ensureLocalBiasCoords();

      // 1. Address autocomplete (includes addresses AND businesses/landmarks)
      try {
        const addressHits = await this.googleMapsService.searchAddresses(query, {
          locationBias: bias,
          includeBusinessesAndLandmarks: true,
          country: 'US'
        });
        console.log('📬 Raw address hits from searchAddresses:', addressHits);
        if (Array.isArray(addressHits)) {
          results.push(...addressHits.map(hit => {
            console.log('📍 Mapping hit:', hit);
            return {
              name: hit.mainText || hit.description || '',
              address: hit.secondaryText || hit.description || hit.mainText || '',
              fullDescription: hit.description || '',
              category: 'Address',
              placeId: hit.placeId,
              context: {}
            };
          }));
        }
      } catch (e) {
        console.warn('⚠️ Google address search failed:', e);
      }

      // 2. Business/establishment search for richer results
      try {
        const googleHits = await this.googleMapsService.searchBusinesses(query, {
          location: bias ? { latitude: bias.latitude, longitude: bias.longitude } : null,
          radius: 25000, // 25km default local radius
          type: 'establishment'
        });
        if (Array.isArray(googleHits)) {
          results.push(...googleHits.map(hit => ({
            name: hit.name,
            address: hit.address,
            category: (hit.types || [])[0] || 'Business',
            placeId: hit.placeId,
            context: {
              city: hit.addressComponents?.city,
              state: hit.addressComponents?.state,
              zipcode: hit.addressComponents?.postalCode
            }
          })));
        }
      } catch (e) {
        console.warn('⚠️ Google business search failed:', e);
      }

      // De-dupe by name+address
      const seen = new Set();
      const deduped = results.filter(r => {
        const key = `${r.name}__${r.address}`.toUpperCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      this.showLocationSuggestions(deduped);
    } catch (error) {
      console.error('POI search error:', error);
    }
  }

  showLocationSuggestions(results) {
    const container = document.getElementById('locationNameSuggestions');

    if (!results || results.length === 0) {
      container.classList.remove('active');
      return;
    }

    container.innerHTML = results.map((result, index) => `
      <div class="location-suggestion-item" data-index="${index}">
        <span class="poi-name">${result.name}</span>
        <span class="poi-address">${result.address}</span>
        ${result.category ? `<span class="poi-category">${result.category}</span>` : ''}
      </div>
    `).join('');

    container.querySelectorAll('.location-suggestion-item').forEach((item, index) => {
      item.addEventListener('click', async () => {
        console.log('🔘 Clicked suggestion index:', index, 'data:', results[index]);
        try {
          await this.selectLocationPOI(results[index]);
        } catch (e) {
          console.error('❌ Error in selectLocationPOI:', e);
        }
      });
    });

    container.classList.add('active');
  }

  async selectLocationPOI(poiData) {
    console.log('📍 selectLocationPOI called with:', poiData);
    console.log('📍 this.googleMapsService:', this.googleMapsService);
    console.log('📍 this.googleMapsService?.getPlaceDetails:', typeof this.googleMapsService?.getPlaceDetails);
    
    // Fill location name
    document.getElementById('locationName').value = poiData.name;
    
    // If we have a placeId, fetch details to get full address info
    if (poiData.placeId) {
      // Try to get the service - it might be on 'this' or globally available
      const mapsService = this.googleMapsService || window.googleMapsService;
      console.log('📍 mapsService:', mapsService);
      
      if (mapsService?.getPlaceDetails) {
        try {
          console.log('🔍 Fetching place details for placeId:', poiData.placeId);
          const details = await mapsService.getPlaceDetails(poiData.placeId);
          console.log('📋 Place details received:', details);
          
          if (details) {
            if (details.address) {
              poiData.address = details.address;
              console.log('📍 Full address:', details.address);
            }
            if (details.addressComponents) {
              console.log('📦 Address components:', details.addressComponents);
              poiData.context = {
                streetNumber: details.addressComponents.streetNumber || '',
                streetName: details.addressComponents.streetName || '',
                city: details.addressComponents.city,
                state: details.addressComponents.state,
                stateCode: details.addressComponents.state,
                zipcode: details.addressComponents.postalCode
              };
              console.log('📦 Mapped context:', poiData.context);
            } else {
              console.warn('⚠️ No address components in place details');
            }
          } else {
            console.warn('⚠️ No details returned from getPlaceDetails');
          }
        } catch (e) {
          console.error('❌ Failed to fetch Google place details for POI:', e);
        }
      } else {
        console.warn('⚠️ getPlaceDetails not available on mapsService');
      }
    } else {
      console.warn('⚠️ No placeId in poiData');
    }
    
    // Build street address from components if available, otherwise parse from formatted address
    let streetAddress = '';
    if (poiData.context?.streetNumber || poiData.context?.streetName) {
      streetAddress = `${poiData.context.streetNumber} ${poiData.context.streetName}`.trim();
      console.log('🏠 Built street address from components:', streetAddress);
    } else if (poiData.address) {
      // Extract street address (first part before comma)
      streetAddress = poiData.address.split(',')[0].trim();
      console.log('🏠 Parsed street address from formatted address:', streetAddress);
    }
    
    document.getElementById('address1').value = streetAddress;
    
    if (poiData.context) {
      if (poiData.context.city) {
        console.log('🏙️ Setting city to:', poiData.context.city);
        document.getElementById('city').value = poiData.context.city;
      }
      if (poiData.context.state || poiData.context.stateCode) {
        const stateInput = document.getElementById('state');
        const stateCode = poiData.context.stateCode || poiData.context.state;
        console.log('🗺️ Setting state to:', stateCode);
        
        // Try to match by value first, then by text
        let matched = false;
        const stateOptions = stateInput.querySelectorAll('option');
        stateOptions.forEach(option => {
          if (option.value.toUpperCase() === stateCode?.toUpperCase() || 
              option.text.toUpperCase() === stateCode?.toUpperCase()) {
            stateInput.value = option.value;
            matched = true;
          }
        });
        if (!matched && stateCode) {
          // If no match, set value directly (may create new entry)
          stateInput.value = stateCode;
        }
      }
      if (poiData.context.zipcode) {
        console.log('📮 Setting zipCode to:', poiData.context.zipcode);
        document.getElementById('zipCode').value = poiData.context.zipcode;
      }
    } else {
      console.warn('⚠️ No context available to populate city/state/zip');
    }

    document.getElementById('locationNameSuggestions').classList.remove('active');
  }

  setupAddressAutocomplete() {
    const addressInputs = document.querySelectorAll('.address-input');
    
    addressInputs.forEach(input => {
      let debounceTimer;
      
      input.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        const query = e.target.value;
        
        if (query.length < 3) {
          this.hideAddressSuggestions(input);
          return;
        }
        
        debounceTimer = setTimeout(async () => {
          await this.searchAddress(input, query);
        }, 300);
      });

      input.addEventListener('blur', () => {
        setTimeout(() => this.hideAddressSuggestions(input), 200);
      });
    });
  }

  async searchAddress(inputElement, query) {
    try {
      const biasCoords = await this.ensureLocalBiasCoords();
      const effectiveQuery = this.localCityState ? `${query} ${this.localCityState}` : query;
      const googleResults = await this.googleMapsService.searchAddresses(effectiveQuery, {
        country: 'US',
        locationBias: biasCoords,
        includeBusinessesAndLandmarks: true
      });

      let results = googleResults || [];

      // If no address hits, try landmarks/POI to catch business names and venues
      if (!results.length && this.googleMapsService.searchLandmarks) {
        const landmarkResults = await this.googleMapsService.searchLandmarks(effectiveQuery, {
          location: biasCoords,
          radius: 8000
        });
        results = landmarkResults || [];
      }

      // Prefer results matching the company state/city
      if (results.length && this.localCityState) {
        const parts = this.localCityState.split(',').map(p => p.trim()).filter(Boolean);
        const cityHint = (parts[0] || '').toUpperCase();
        const stateHint = (parts[1] || '').toUpperCase();
        const score = (r) => {
          const text = (r.description || r.mainText || '').toUpperCase();
          let s = 0;
          if (stateHint && text.includes(stateHint)) s += 2;
          if (cityHint && text.includes(cityHint)) s += 1;
          return s;
        };
        results = results.slice().sort((a, b) => score(b) - score(a));
      }

      // Normalize Google results to match existing UI expectations
      const normalized = (results || []).map(result => ({
        name: result.description || result.mainText || '',
        address: result.description || '',
        context: {},
        placeId: result.placeId
      }));

      this.showAddressSuggestions(inputElement, normalized);
    } catch (error) {
      console.error('Address search error:', error);
    }
  }

  showAddressSuggestions(inputElement, results) {
    const suggestionsContainer = inputElement.parentElement.querySelector('.address-suggestions');
    
    if (!results || results.length === 0) {
      this.hideAddressSuggestions(inputElement);
      return;
    }

    suggestionsContainer.innerHTML = results.map((result, index) => `
      <div class="address-suggestion-item" data-index="${index}">
        <div class="suggestion-main">${result.name || result.address}</div>
        <div class="suggestion-secondary">${result.address}</div>
      </div>
    `).join('');

    // Add click handlers
    suggestionsContainer.querySelectorAll('.address-suggestion-item').forEach((item, index) => {
      item.addEventListener('click', () => {
        this.selectAddress(inputElement, results[index]);
      });
    });

    suggestionsContainer.classList.add('active');
  }

  hideAddressSuggestions(inputElement) {
    const suggestionsContainer = inputElement.parentElement.querySelector('.address-suggestions');
    if (suggestionsContainer) {
      suggestionsContainer.classList.remove('active');
    }
  }

  async selectAddress(inputElement, addressData) {
    // Fill in the address field - use the street address only
    const streetAddress = (addressData.address || '').split(',')[0].trim();
    inputElement.value = streetAddress;
    
    // Fill in location name with full address for clarity
    const locationNameInput = document.getElementById('locationName');
    if (locationNameInput) {
      locationNameInput.value = addressData.name || addressData.address;
    }

    // If we have a placeId from Google, fetch details to populate context and lat/lng
    if (!addressData.context && addressData.placeId && this.googleMapsService?.getPlaceDetails) {
      try {
        const details = await this.googleMapsService.getPlaceDetails(addressData.placeId);
        if (details?.addressComponents) {
          addressData.context = {
            city: details.addressComponents.city,
            state: details.addressComponents.state,
            stateCode: details.addressComponents.state,
            stateName: details.addressComponents.stateName,
            zipcode: details.addressComponents.postalCode,
            country: details.addressComponents.country,
            countryCode: details.addressComponents.countryCode
          };
        }
        // Capture latitude/longitude from Google Places
        if (details?.latitude && details?.longitude) {
          addressData.latitude = details.latitude;
          addressData.longitude = details.longitude;
          console.log('📍 Captured coordinates:', details.latitude, details.longitude);
        }
        if (details?.name && !addressData.name) {
          addressData.name = details.name;
        }
        if (details?.address && !addressData.address) {
          addressData.address = details.address;
        }
      } catch (e) {
        console.warn('⚠️ Failed to fetch Google place details:', e);
      }
    }

    // Store lat/lng in hidden fields for stop creation
    const latField = document.getElementById('locationLat');
    const lngField = document.getElementById('locationLng');
    if (latField && addressData.latitude) latField.value = addressData.latitude;
    if (lngField && addressData.longitude) lngField.value = addressData.longitude;

    // Fill in city, state, zip if available
    if (addressData.context) {
      if (addressData.context.city) {
        const cityInput = document.getElementById('city');
        if (cityInput) cityInput.value = addressData.context.city;
      }
      if (addressData.context.state) {
        const stateInput = document.getElementById('state');
        if (stateInput) {
          // Try to match state abbreviation
          const stateOptions = stateInput.querySelectorAll('option');
          stateOptions.forEach(option => {
            const stateCode = addressData.context.stateCode || addressData.context.state;
            const stateName = addressData.context.stateName || addressData.context.state;
            if (option.value === stateCode || option.text === stateCode || option.text === stateName) {
              stateInput.value = option.value;
            }
          });
        }
      }
      if (addressData.context.zipcode) {
        const zipInput = document.getElementById('zipCode');
        if (zipInput) zipInput.value = addressData.context.zipcode;
      }
      if (addressData.context.country) {
        const countryInput = document.getElementById('country');
        if (countryInput) {
          const cc = (addressData.context.countryCode || addressData.context.country || '').toUpperCase();
          if (cc === 'US' || addressData.context.country === 'United States') countryInput.value = 'US';
          else if (cc === 'CA' || addressData.context.country === 'Canada') countryInput.value = 'CA';
          else if (cc === 'MX' || addressData.context.country === 'Mexico') countryInput.value = 'MX';
        }
      }
    }

    this.hideAddressSuggestions(inputElement);
  }

  async calculateRoute() {
    return this.updateTripMetricsFromStops();
  }

  updateTimesFromPickup() {
    const puDate = document.getElementById('puDate')?.value || '';
    const puTime = document.getElementById('puTime')?.value || '';
    if (!puTime) return;

    const formatTime = (dateStr, timeStr, offsetMinutes) => {
      const baseDate = dateStr || new Date().toISOString().slice(0, 10);
      const d = new Date(`${baseDate}T${timeStr}`);
      if (Number.isNaN(d.getTime())) return null;
      d.setMinutes(d.getMinutes() + offsetMinutes);
      const hh = `${d.getHours()}`.padStart(2, '0');
      const mm = `${d.getMinutes()}`.padStart(2, '0');
      return `${hh}:${mm}`;
    };

    // Spot Time = PU Time - 15 minutes
    const spot = formatTime(puDate, puTime, -15);
    if (spot) {
      const spotEl = document.getElementById('spotTime');
      if (spotEl) spotEl.value = spot;
    }

    // Update DO Time based on pickup + trip duration
    this.updateDropoffFromDuration();

    // Calculate garage times based on driver address (async operation)
    this.updateGarageTimesFromDriver();
  }

  /**
   * Get the selected driver's full address for routing calculations
   * @returns {string|null} Full address string or null if not available
   */
  getSelectedDriverAddress() {
    const driverSelect = document.getElementById('driverSelect');
    const driverId = driverSelect?.value;
    if (!driverId || !this.driversData) return null;

    const driver = this.driversData.find(d => d.id === driverId);
    if (!driver) return null;

    // Build full address from driver's address components
    const parts = [
      driver.primary_address,
      driver.city,
      driver.state,
      driver.postal_code
    ].filter(Boolean);

    if (parts.length < 2) {
      console.log('[getSelectedDriverAddress] Driver has incomplete address:', driver.first_name, driver.last_name);
      return null;
    }

    const fullAddress = parts.join(', ');
    console.log('[getSelectedDriverAddress] Driver address:', fullAddress);
    return fullAddress;
  }

  /**
   * Calculate and update Garage Out and Garage In times based on driver location
   * - Garage Out = PU Time - 15 min (spot time) - duration from driver address to pickup
   * - Garage In = DO Time + duration from dropoff to driver address
   */
  async updateGarageTimesFromDriver() {
    const puDate = document.getElementById('puDate')?.value || '';
    const puTime = document.getElementById('puTime')?.value || '';
    const doTime = document.getElementById('doTime')?.value || '';
    
    if (!puTime) return;

    const formatTimeOffset = (dateStr, timeStr, offsetMinutes) => {
      const baseDate = dateStr || new Date().toISOString().slice(0, 10);
      const d = new Date(`${baseDate}T${timeStr}`);
      if (Number.isNaN(d.getTime())) return null;
      d.setMinutes(d.getMinutes() + offsetMinutes);
      const hh = `${d.getHours()}`.padStart(2, '0');
      const mm = `${d.getMinutes()}`.padStart(2, '0');
      return `${hh}:${mm}`;
    };

    const driverAddress = this.getSelectedDriverAddress();
    const stops = this.getStops ? this.getStops() : [];
    
    // Get pickup and dropoff addresses
    const pickupStop = stops.find(s => (s.stopType || s.type || '').toLowerCase() === 'pickup') || stops[0];
    const dropoffStop = [...stops].reverse().find(s => (s.stopType || s.type || '').toLowerCase() === 'dropoff') || stops[stops.length - 1];
    
    const pickupAddress = pickupStop?.fullAddress || pickupStop?.address || pickupStop?.address1;
    const dropoffAddress = dropoffStop?.fullAddress || dropoffStop?.address || dropoffStop?.address1;

    // Default offsets if we can't calculate from driver address
    let garOutOffsetMinutes = -30; // Default: 30 min before pickup (15 spot + 15 travel)
    let garInOffsetMinutes = 15;   // Default: 15 min after dropoff

    // If we have driver address and Google Maps, calculate actual travel times
    if (driverAddress && this.googleMapsService && pickupAddress) {
      try {
        // Calculate duration from driver's address to pickup
        const toPickupRoute = await this.googleMapsService.getRouteSummary({
          origin: driverAddress,
          destination: pickupAddress
        });
        
        if (toPickupRoute?.durationSeconds) {
          const travelMinutes = Math.ceil(toPickupRoute.durationSeconds / 60);
          // Garage Out = Pickup Time - 15 min (spot) - travel time from driver to pickup
          garOutOffsetMinutes = -(15 + travelMinutes);
          console.log(`[updateGarageTimesFromDriver] Driver to pickup: ${travelMinutes} min, Garage Out offset: ${garOutOffsetMinutes} min`);
        }
      } catch (err) {
        console.warn('[updateGarageTimesFromDriver] Failed to calculate driver->pickup route:', err);
      }
    }

    // Calculate Garage Out Time
    const garOut = formatTimeOffset(puDate, puTime, garOutOffsetMinutes);
    if (garOut) {
      const garOutEl = document.getElementById('garOutTime');
      if (garOutEl) garOutEl.value = garOut;
    }

    // Calculate Garage In Time based on DO Time + return travel
    if (doTime && driverAddress && this.googleMapsService && dropoffAddress) {
      try {
        // Calculate duration from dropoff to driver's address
        const fromDropoffRoute = await this.googleMapsService.getRouteSummary({
          origin: dropoffAddress,
          destination: driverAddress
        });
        
        if (fromDropoffRoute?.durationSeconds) {
          const returnMinutes = Math.ceil(fromDropoffRoute.durationSeconds / 60);
          const garIn = formatTimeOffset(puDate, doTime, returnMinutes);
          console.log(`[updateGarageTimesFromDriver] Dropoff to driver: ${returnMinutes} min`);
          if (garIn) {
            const garInEl = document.getElementById('garInTime');
            if (garInEl) garInEl.value = garIn;
          }
        }
      } catch (err) {
        console.warn('[updateGarageTimesFromDriver] Failed to calculate dropoff->driver route:', err);
        // Fall back to default
        const garIn = formatTimeOffset(puDate, doTime || puTime, garInOffsetMinutes);
        if (garIn) {
          const garInEl = document.getElementById('garInTime');
          if (garInEl) garInEl.value = garIn;
        }
      }
    } else if (doTime) {
      // No driver address, use default offset from DO time
      const garIn = formatTimeOffset(puDate, doTime, garInOffsetMinutes);
      if (garIn) {
        const garInEl = document.getElementById('garInTime');
        if (garInEl) garInEl.value = garIn;
      }
    }
  }

  updateDropoffFromDuration() {
    const puDate = document.getElementById('puDate')?.value;
    const puTime = document.getElementById('puTime')?.value;
    const durationVal = document.getElementById('duration')?.value;

    if (!puDate || !puTime || durationVal === undefined || durationVal === null) return;

    const durationHours = parseFloat(durationVal);
    if (Number.isNaN(durationHours)) return;

    const start = new Date(`${puDate}T${puTime}`);
    if (Number.isNaN(start.getTime())) return;

    const minutesToAdd = Math.round(durationHours * 60);
    const end = new Date(start.getTime() + minutesToAdd * 60000);
    const hh = `${end.getHours()}`.padStart(2, '0');
    const mm = `${end.getMinutes()}`.padStart(2, '0');

    const doTimeEl = document.getElementById('doTime');
    if (doTimeEl) doTimeEl.value = `${hh}:${mm}`;
  }

  async updateTripMetricsFromStops() {
    const routeInfo = document.getElementById('routeInfo');
    const distanceEl = document.getElementById('routeDistance');
    const durationEl = document.getElementById('routeDuration');
    const inlineDistance = document.getElementById('routeDistanceInline');
    const inlineDuration = document.getElementById('routeDurationInline');
    const directionsEl = document.getElementById('routeDirections');
    const perHourQty = document.getElementById('hourQty');
    const secondaryPerMileQty = document.getElementById('secondaryPerMileQty');
    const secondaryPerHourQty = document.getElementById('secondaryPerHourQty');

    const resetRouteUi = () => {
      if (routeInfo) routeInfo.style.display = 'none';
      if (distanceEl) distanceEl.textContent = '-';
      if (durationEl) durationEl.textContent = '-';
      if (inlineDistance) inlineDistance.textContent = '-';
      if (inlineDuration) inlineDuration.textContent = '-';
      if (directionsEl) directionsEl.innerHTML = '';
      this.latestRouteSummary = null;
    };

    const stops = this.getStops();
    console.log('📍 [updateTripMetricsFromStops] All stops:', stops);
    const stopsWithAddress = Array.isArray(stops)
      ? stops.filter(s => s && (s.fullAddress || s.address || s.address1))
      : [];
    console.log('📍 [updateTripMetricsFromStops] Stops with address:', stopsWithAddress.length);

    // Require a pick-up and a drop-off; intermediate stops are optional
    const pickupStop = stopsWithAddress.find(s => {
      const t = (s.stopType || s.type || '').toLowerCase();
      return t === 'pickup';
    }) || stopsWithAddress[0];

    const dropoffStop = [...stopsWithAddress].reverse().find(s => {
      const t = (s.stopType || s.type || '').toLowerCase();
      return t === 'dropoff';
    }) || stopsWithAddress[stopsWithAddress.length - 1];

    console.log('📍 [updateTripMetricsFromStops] pickupStop:', pickupStop);
    console.log('📍 [updateTripMetricsFromStops] dropoffStop:', dropoffStop);

    if (!pickupStop || !dropoffStop || pickupStop === dropoffStop) {
      console.log('⚠️ [updateTripMetricsFromStops] Need both pickup and dropoff, resetting UI');
      resetRouteUi();
      return;
    }

    const origin = pickupStop.fullAddress || pickupStop.address || pickupStop.address1;
    const destination = dropoffStop.fullAddress || dropoffStop.address || dropoffStop.address1;
    const waypointStops = stopsWithAddress
      .filter(s => s !== pickupStop && s !== dropoffStop)
      .map(s => s.fullAddress || s.address || s.address1)
      .filter(Boolean);

    console.log('📍 [updateTripMetricsFromStops] origin:', origin);
    console.log('📍 [updateTripMetricsFromStops] destination:', destination);

    if (!origin || !destination) {
      console.log('⚠️ [updateTripMetricsFromStops] Missing origin or destination');
      resetRouteUi();
      return;
    }

    let summary;
    try {
      console.log('🚀 [updateTripMetricsFromStops] Calling getRouteSummary...');
      console.log('📍 [updateTripMetricsFromStops] googleMapsService:', this.googleMapsService);
      
      if (!this.googleMapsService) {
        console.error('❌ [updateTripMetricsFromStops] googleMapsService is not initialized!');
        resetRouteUi();
        return;
      }
      
      if (typeof this.googleMapsService.getRouteSummary !== 'function') {
        console.error('❌ [updateTripMetricsFromStops] getRouteSummary is not a function!');
        resetRouteUi();
        return;
      }
      
      summary = await this.googleMapsService.getRouteSummary({ origin, destination, waypoints: waypointStops });
      console.log('📦 [updateTripMetricsFromStops] Route summary:', summary);
    } catch (e) {
      console.error('❌ [updateTripMetricsFromStops] Directions lookup failed:', e);
      resetRouteUi();
      return;
    }

    if (!summary) {
      console.log('⚠️ [updateTripMetricsFromStops] No summary returned');
      resetRouteUi();
      return;
    }

    console.log('✅ [updateTripMetricsFromStops] Got route - distance:', summary.distanceText, 'duration:', summary.durationText);

    if (routeInfo) routeInfo.style.display = 'block';

    if (distanceEl) distanceEl.textContent = summary.distanceText;
    if (durationEl) durationEl.textContent = summary.durationText;
    if (inlineDistance) inlineDistance.textContent = summary.distanceText;
    if (inlineDuration) inlineDuration.textContent = summary.durationText;

    const distanceMiles = summary.distanceMeters ? summary.distanceMeters / 1609.344 : null;
    const durationHours = summary.durationSeconds ? summary.durationSeconds / 3600 : null;

    const shouldOverwrite = (input) => {
      if (!input) return false;
      const current = (input.value || '').trim();
      return current === '' || current === '0' || current === '0.0' || current === '0.00' || current === '1' || input.dataset.autofilled === 'route';
    };

    // Update main duration field from route calculation
    if (durationHours !== null) {
      const mainDurationEl = document.getElementById('duration');
      if (mainDurationEl && shouldOverwrite(mainDurationEl)) {
        mainDurationEl.value = durationHours.toFixed(2);
        mainDurationEl.dataset.autofilled = 'route';
        // This will trigger DO time update
        this.updateDropoffFromDuration();
      }
      if (perHourQty && shouldOverwrite(perHourQty)) {
        perHourQty.value = durationHours.toFixed(2);
        perHourQty.dataset.autofilled = 'route';
      }
      if (secondaryPerHourQty && shouldOverwrite(secondaryPerHourQty)) {
        secondaryPerHourQty.value = durationHours.toFixed(2);
        secondaryPerHourQty.dataset.autofilled = 'route';
      }
    }

    if (distanceMiles !== null && secondaryPerMileQty && shouldOverwrite(secondaryPerMileQty)) {
      secondaryPerMileQty.value = distanceMiles.toFixed(1);
      secondaryPerMileQty.dataset.autofilled = 'route';
    }

    if (directionsEl) {
      if (summary.steps && summary.steps.length) {
        directionsEl.innerHTML = summary.steps.map((step, index) => {
          const detail = [step.distance, step.duration].filter(Boolean).join(' • ');
          const detailHtml = detail ? ` <span class="step-distance">(${detail})</span>` : '';
          return `
      <div class="direction-step">
        <strong>${index + 1}.</strong> ${step.instruction}${detailHtml}
      </div>`;
        }).join('');
      } else {
        directionsEl.innerHTML = '<div class="direction-step">No directions available.</div>';
      }
    }

    this.latestRouteSummary = {
      ...summary,
      miles: summary.distanceMeters ? summary.distanceMeters / 1609.344 : 0,
      hours: summary.durationSeconds ? summary.durationSeconds / 3600 : 0
    };

    // Send distance/duration/passengers directly to rate section iframe
    if (this.rateSectionFrame && this.rateSectionReady) {
      const miles = this.latestRouteSummary.miles || 0;
      const hours = this.latestRouteSummary.hours || 0;
      const passengers = parseFloat(document.getElementById('numPax')?.value) || 1;
      
      // Calculate trip hours from PU time to DO time
      const tripHours = this.calculateTripHours();
      
      this.rateSectionFrame.contentWindow.postMessage({
        type: 'setRouteData',
        data: { miles, hours, passengers, tripHours }
      }, '*');
    }

    // Trigger rate recalculation now that we have distance
    this.updateRateConfigDisplay();

    // Keep spot/garage times aligned after any pickup time edits
    this.updateTimesFromPickup();

    // Re-apply vehicle type pricing now that distance is known
    this.applyVehicleTypePricing();
  }

  applyVehicleTypePricing() {
    try {
      const vehicleTypeId = document.getElementById('vehicleTypeRes')?.value || '';
      if (!vehicleTypeId) {
        return;
      }

      const rates = this.vehicleTypeRates?.[vehicleTypeId];
      if (!rates) {
        this.calculateCosts();
        return;
      }

      const getNum = (val) => {
        const num = parseFloat(val);
        return Number.isFinite(num) ? num : 0;
      };

      // Fields that should always show 2 decimal places (currency/rates)
      const rateFields = [
        'flatRate', 'hourRate', 'unitRate', 'mileRate', 'passRate', 'waitRate',
        'overtimeRate', 'extraPassRate', 'deadMileRate', 'minFare', 'ppBaseFare',
        'distBaseFare', 'gratuityRate', 'fuelRate', 'discountRate', 'surfaceRate',
        'baseRate', 'adminRate', 'stopsRate'
      ];

      const setIfEmpty = (id, value) => {
        if (value === undefined || value === null) return;
        const el = document.getElementById(id);
        if (!el) return;
        const current = getNum(el.value);
        if (!el.value || current === 0) {
          // Format rate fields with 2 decimal places
          if (rateFields.includes(id)) {
            const numVal = parseFloat(value);
            el.value = Number.isFinite(numVal) ? numVal.toFixed(2) : value;
          } else {
            el.value = value;
          }
        }
      };

      const durationHours = getNum(document.getElementById('duration')?.value);
      const passengerCount = getNum(document.getElementById('numPax')?.value || document.getElementById('passQty')?.value);

      if (rates.perHour) {
        const hourRate = getNum(rates.perHour.baseRate)
          || getNum(rates.perHour.asLow)
          || getNum(rates.perHour.rateSchedules && rates.perHour.rateSchedules[0]?.ratePerHour)
          || getNum(rates.perHour.hoursRange && rates.perHour.hoursRange.ratePerHour);
        if (hourRate) {
          setIfEmpty('hourRate', hourRate.toString());
        }
        // Also set overtime and wait time rates if available
        const overtimeRate = getNum(rates.perHour.overtimeRate);
        if (overtimeRate) {
          setIfEmpty('overtimeRate', overtimeRate.toString());
        }
        const waitTimeRate = getNum(rates.perHour.waitTimeRate);
        if (waitTimeRate) {
          setIfEmpty('waitRate', waitTimeRate.toString());
        }
        if (durationHours) {
          setIfEmpty('hourQty', durationHours.toFixed(2));
        }
      }

      if (rates.perPassenger) {
        const basePassRate = getNum(rates.perPassenger.ratePerPassenger)
          || getNum(rates.perPassenger.baseRate)
          || getNum(rates.perPassenger.tiers && rates.perPassenger.tiers[0]?.rate);
        if (basePassRate) {
          setIfEmpty('passRate', basePassRate.toString());
        }
        // Set extra passenger rate
        const extraPassRate = getNum(rates.perPassenger.extraPassengerRate);
        if (extraPassRate) {
          setIfEmpty('extraPassRate', extraPassRate.toString());
        }
        // Set per-passenger base fare
        const ppBaseFare = getNum(rates.perPassenger.baseFare);
        if (ppBaseFare) {
          setIfEmpty('ppBaseFare', ppBaseFare.toString());
        }
        if (passengerCount) {
          setIfEmpty('passQty', passengerCount.toString());
        }
      }

      if (rates.distance) {
        const miles = this.latestRouteSummary?.miles;
        const includedMiles = getNum(rates.distance.includedMiles);
        const billableMiles = miles !== undefined && miles !== null
          ? Math.max(0, miles - includedMiles)
          : null;

        const mileRate = getNum(rates.distance.ratePerMile)
          || getNum(rates.distance.basePerMile)
          || getNum(rates.distance.tiers && rates.distance.tiers[0]?.rate);
        if (mileRate) {
          setIfEmpty('mileRate', mileRate.toString());
        }

        if (billableMiles !== null) {
          const mileQtyEl = document.getElementById('mileQty');
          if (mileQtyEl) {
            mileQtyEl.value = billableMiles.toFixed(1);
          }
        }

        const minimumFare = getNum(rates.distance.minimumFare);
        if (minimumFare) {
          setIfEmpty('flatQty', '1');
          setIfEmpty('flatRate', minimumFare.toString());
          setIfEmpty('minFare', minimumFare.toString());
        }
        
        // Set base fare for distance
        const distBaseFare = getNum(rates.distance.baseFare);
        if (distBaseFare) {
          setIfEmpty('distBaseFare', distBaseFare.toString());
        }
        
        // Set dead mile rate
        const deadMileRate = getNum(rates.distance.deadMileRate);
        if (deadMileRate) {
          setIfEmpty('deadMileRate', deadMileRate.toString());
        }
      }

      this.calculateCosts();
      
      // Store the current vehicle type data
      const vehicleTypeData = {
        id: vehicleTypeId,
        rates: rates
      };
      this.currentVehicleType = vehicleTypeData;
      
      // Send rates to iframe if available
      if (this.rateSectionReady) {
        this.sendVehicleRatesToIframe(vehicleTypeData);
      }
    } catch (error) {
      console.warn('[ReservationForm] applyVehicleTypePricing failed:', error);
    }
  }

  displayRouteInfo(route) {
    const routeInfo = document.getElementById('routeInfo');
    const distanceEl = document.getElementById('routeDistance');
    const durationEl = document.getElementById('routeDuration');
    const directionsEl = document.getElementById('routeDirections');
    const inlineDistance = document.getElementById('routeDistanceInline');
    const inlineDuration = document.getElementById('routeDurationInline');

    distanceEl.textContent = route.distance;
    durationEl.textContent = route.duration;
    if (inlineDistance) inlineDistance.textContent = route.distance;
    if (inlineDuration) inlineDuration.textContent = route.duration;

    // Display turn-by-turn directions
    directionsEl.innerHTML = route.steps.map((step, index) => `
      <div class="direction-step">
        <strong>${index + 1}.</strong> ${step.instruction}
        <span class="step-distance">(${step.distance})</span>
      </div>
    `).join('');

    routeInfo.style.display = 'block';
  }

  addStop() {
    const container = document.getElementById('stopsContainer');
    const stopIndex = document.querySelectorAll('.stop-row').length;
    const stopRow = document.createElement('div');
    stopRow.className = 'stop-row';
    stopRow.dataset.stopIndex = stopIndex;
    stopRow.innerHTML = `
      <div class="form-group-inline">
        <label>Type</label>
        <select class="form-control stop-type">
          <option value="pickup">Pick-up</option>
          <option value="dropoff">Drop-off</option>
          <option value="stop" selected>Stop</option>
        </select>
      </div>
      <div class="form-group-inline">
        <label>Location Description / Name</label>
        <input type="text" class="form-control location-name" placeholder="Location name" readonly />
      </div>
      <div class="form-group-inline">
        <label>Address 1</label>
        <input type="text" class="form-control address-input" placeholder="Start typing address..." />
        <div class="address-suggestions"></div>
      </div>
    `;
    container.appendChild(stopRow);

    // Keep internal stops array in sync for any route/calc features
    this.stops.push(null);
    
    // Setup autocomplete for the new input
    const newInput = stopRow.querySelector('.address-input');
    let debounceTimer;
    
    newInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      const query = e.target.value;
      
      if (query.length < 3) {
        this.hideAddressSuggestions(newInput);
        return;
      }
      
      debounceTimer = setTimeout(async () => {
        await this.searchAddress(newInput, query);
      }, 300);
    });

    newInput.addEventListener('blur', () => {
      setTimeout(() => this.hideAddressSuggestions(newInput), 200);
    });

    this.updateTripMetricsFromStops().catch(() => {});
  }

  setupCostCalculationListeners() {
    // All cost input fields
    const costInputs = [
      'flatQty', 'flatRate',
      'hourQty', 'hourRate',
      'unitQty', 'unitRate',
      'otQty', 'otRate',
      'stopsQty', 'stopsRate',
      'gratuityQty',
      'fuelQty',
      'discountQty',
      'passQty', 'passRate',
      'mileQty', 'mileRate',
      'surfaceQty',
      'baseRateQty',
      'adminQty', 'adminRate'
    ];

    // Rate fields that should always display 2 decimal places
    const rateFields = [
      'flatRate', 'hourRate', 'unitRate', 'otRate', 'stopsRate',
      'passRate', 'mileRate', 'adminRate', 'gratuityQty', 'fuelQty',
      'discountQty', 'surfaceQty', 'baseRateQty'
    ];

    costInputs.forEach(inputId => {
      const input = document.getElementById(inputId);
      if (input) {
        input.addEventListener('input', () => {
          this.calculateCosts();
        });
        
        // Format rate fields to 2 decimal places on blur
        if (rateFields.includes(inputId)) {
          input.addEventListener('blur', () => {
            const val = parseFloat(input.value);
            if (Number.isFinite(val)) {
              input.value = val.toFixed(2);
            }
          });
        }
      }
    });

    // Setup rate config panel
    this.setupRateConfigPanel();
  }

  /**
   * Setup the rate configuration panel toggle and rate updates
   */
  setupRateConfigPanel() {
    const toggleBtn = document.getElementById('toggleRateConfig');
    const body = document.getElementById('rateConfigBody');

    if (toggleBtn && body) {
      toggleBtn.addEventListener('click', () => {
        const isCollapsed = body.classList.toggle('collapsed');
        toggleBtn.classList.toggle('collapsed', isCollapsed);
        toggleBtn.textContent = isCollapsed ? '▶' : '▼';
      });
    }

    // Listen for service type and vehicle type changes - rates applied automatically
    const serviceTypeEl = document.getElementById('serviceType');
    const vehicleTypeEl = document.getElementById('vehicleTypeRes');
    const numPaxEl = document.getElementById('numPax');
    const puTimeEl = document.getElementById('puTime');
    const doTimeEl = document.getElementById('doTime');
    const puDateEl = document.getElementById('puDate');
    const doDateEl = document.getElementById('doDate');

    if (serviceTypeEl) {
      serviceTypeEl.addEventListener('change', () => this.updateRateConfigDisplay());
    }
    if (vehicleTypeEl) {
      vehicleTypeEl.addEventListener('change', () => this.updateRateConfigDisplay());
    }
    // Update rates when passenger count changes (for per-passenger pricing)
    if (numPaxEl) {
      numPaxEl.addEventListener('change', () => this.updateRateConfigDisplay());
      numPaxEl.addEventListener('input', () => this.updateRateConfigDisplay());
    }
    // Update rates when PU/DO times change (for hourly pricing)
    if (puTimeEl) {
      puTimeEl.addEventListener('change', () => this.updateRateConfigDisplay());
    }
    if (doTimeEl) {
      doTimeEl.addEventListener('change', () => this.updateRateConfigDisplay());
      doTimeEl.addEventListener('input', () => this.updateRateConfigDisplay());
    }
    if (puDateEl) {
      puDateEl.addEventListener('change', () => this.updateRateConfigDisplay());
    }
    if (doDateEl) {
      doDateEl.addEventListener('change', () => this.updateRateConfigDisplay());
    }

    // Initial update
    this.updateRateConfigDisplay();
  }

  /**
   * Setup vehicle type filtering based on service type selection
   * Vehicle types can have service_type_tags that associate them with specific services
   */
  setupVehicleTypeFiltering() {
    const serviceTypeEl = document.getElementById('serviceType');
    const vehicleTypeEl = document.getElementById('vehicleTypeRes');
    
    if (!serviceTypeEl || !vehicleTypeEl) return;
    
    // Store current value before filtering
    const currentValue = vehicleTypeEl.value;
    
    // Listen for service type changes
    serviceTypeEl.addEventListener('change', () => {
      this.filterVehicleTypesByServiceType();
    });
    
    // Initial filter
    this.filterVehicleTypesByServiceType();
    
    // Restore value if still valid
    if (currentValue) {
      const optionExists = Array.from(vehicleTypeEl.options).some(o => o.value === currentValue);
      if (optionExists) vehicleTypeEl.value = currentValue;
    }
  }

  /**
   * Filter vehicle type dropdown based on selected service type
   * Shows all if no service type selected or if vehicle type has no service restrictions
   */
  filterVehicleTypesByServiceType() {
    const serviceTypeEl = document.getElementById('serviceType');
    const vehicleTypeEl = document.getElementById('vehicleTypeRes');
    
    if (!vehicleTypeEl || !this.allVehicleTypeOptions) return;
    
    const selectedServiceType = serviceTypeEl?.value || '';
    const currentValue = vehicleTypeEl.value;
    
    // Normalize service type tags helper
    const normalizeTag = (tag) => {
      if (!tag) return '';
      return tag.toString().toLowerCase().trim().replace(/^st:/i, '');
    };
    
    // Filter vehicle types
    const filteredOptions = this.allVehicleTypeOptions.filter(opt => {
      // Get service type tags from the raw data
      const tags = opt.raw?.service_type_tags || opt.raw?.metadata?.service_type_tags || [];
      
      // If no tags or empty, show for all service types
      if (!Array.isArray(tags) || tags.length === 0) {
        return true;
      }
      
      // If no service type selected, show all
      if (!selectedServiceType) {
        return true;
      }
      
      // Check if any tag matches the selected service type
      const normalizedSelected = normalizeTag(selectedServiceType);
      return tags.some(tag => normalizeTag(tag) === normalizedSelected);
    });
    
    // Re-render the dropdown
    const placeholder = filteredOptions.length ? '-- Select Vehicle Type --' : '-- No vehicles for this service --';
    vehicleTypeEl.innerHTML = `<option value="">${placeholder}</option>` + 
      filteredOptions.map(o => `<option value="${o.value}">${o.label}</option>`).join('');
    
    // Try to restore current value if still in filtered list
    const valueStillExists = filteredOptions.some(o => o.value === currentValue);
    if (valueStillExists) {
      vehicleTypeEl.value = currentValue;
    } else if (filteredOptions.length === 1) {
      // Auto-select if only one option
      vehicleTypeEl.value = filteredOptions[0].value;
      this.applyVehicleTypePricing();
    }
    
    // Trigger rate update
    this.updateRateConfigDisplay();
  }

  /**
   * Update rate configuration based on selected service and vehicle types
   * Sends pricing basis and rates to the rate section iframe
   */
  updateRateConfigDisplay(forceReset = false) {
    const serviceTypeEl = document.getElementById('serviceType');
    const vehicleTypeEl = document.getElementById('vehicleTypeRes');

    const serviceTypeCode = serviceTypeEl?.value || '';
    const vehicleTypeId = vehicleTypeEl?.value || '';

    // Track service type changes and clear rates when it changes
    const previousServiceType = this._lastServiceTypeForRates || '';
    if (forceReset || (previousServiceType && previousServiceType !== serviceTypeCode)) {
      console.log('[ReservationForm] Service type changed from', previousServiceType, 'to', serviceTypeCode, '- clearing rates');
      this.clearRateFields();
    }
    this._lastServiceTypeForRates = serviceTypeCode;

    // Get pricing types from cached service types (support both array and single value)
    let allowedPricingTypes = ['DISTANCE']; // Default
    let primaryPricingBasis = 'Distance';
    
    if (this._serviceTypesList) {
      const serviceType = this._serviceTypesList.find(st => st.code === serviceTypeCode);
      if (serviceType) {
        // Get allowed pricing types (array or single value)
        if (Array.isArray(serviceType.pricing_types) && serviceType.pricing_types.length > 0) {
          allowedPricingTypes = serviceType.pricing_types.map(t => t.toUpperCase());
        } else if (serviceType.pricing_type) {
          allowedPricingTypes = [serviceType.pricing_type.toUpperCase()];
        }
        
        // Set primary pricing basis from first allowed type
        const pt = allowedPricingTypes[0];
        if (pt === 'HOURS' || pt === 'PER_HOUR' || pt === 'HOURLY') primaryPricingBasis = 'Hourly';
        else if (pt === 'DISTANCE' || pt === 'PER_MILE') primaryPricingBasis = 'Distance';
        else if (pt === 'FLAT' || pt === 'FLAT_RATE' || pt === 'FIXED') primaryPricingBasis = 'Flat Rate';
        else if (pt === 'PER_PASSENGER' || pt === 'PASSENGER') primaryPricingBasis = 'Per Passenger';
      }
    } else {
      // Fallback to code-based detection
      if (serviceTypeCode === 'hourly') {
        primaryPricingBasis = 'Hourly';
        allowedPricingTypes = ['HOURS'];
      } else if (serviceTypeCode === 'point-to-point') {
        primaryPricingBasis = 'Distance';
        allowedPricingTypes = ['DISTANCE'];
      } else if (serviceTypeCode === 'airport-transfer' || serviceTypeCode === 'from-airport' || serviceTypeCode === 'to-airport') {
        primaryPricingBasis = 'Distance';
        allowedPricingTypes = ['DISTANCE'];
      }
    }

    // Helper to check if a pricing type is allowed
    const isAllowed = (type) => {
      const typeUpper = (type || '').toUpperCase();
      return allowedPricingTypes.some(allowed => {
        if (allowed === 'HOURS' || allowed === 'HOURLY' || allowed === 'PER_HOUR') {
          return typeUpper === 'HOURS' || typeUpper === 'HOURLY' || typeUpper === 'PER_HOUR';
        }
        if (allowed === 'DISTANCE' || allowed === 'PER_MILE') {
          return typeUpper === 'DISTANCE' || typeUpper === 'PER_MILE';
        }
        if (allowed === 'PASSENGER' || allowed === 'PER_PASSENGER') {
          return typeUpper === 'PASSENGER' || typeUpper === 'PER_PASSENGER';
        }
        if (allowed === 'FIXED' || allowed === 'FLAT' || allowed === 'FLAT_RATE') {
          return typeUpper === 'FIXED' || typeUpper === 'FLAT' || typeUpper === 'FLAT_RATE';
        }
        if (allowed === 'HYBRID') {
          return typeUpper === 'HYBRID';
        }
        return allowed === typeUpper;
      });
    };

    // Send pricing basis and allowed types to iframe
    if (this.rateSectionFrame && this.rateSectionReady) {
      this.rateSectionFrame.contentWindow.postMessage({
        type: 'setPricingBasis',
        data: { 
          basis: primaryPricingBasis,
          allowedTypes: allowedPricingTypes
        }
      }, '*');
    }

    // Apply stored rates that match this service type
    this.applyStoredRatesForServiceType(serviceTypeCode, primaryPricingBasis);

    // Get rates from vehicle type - filter based on selected service type's pricing types
    const allRates = this.vehicleTypeRates?.[vehicleTypeId] || {};
    
    // Get rates specific to current pricing basis, or fall back to general rates
    const getRatesForPricingBasis = (rates, basis) => {
      // Check if vehicle has service-specific rates
      if (rates.serviceRates && rates.serviceRates[serviceTypeCode]) {
        return rates.serviceRates[serviceTypeCode];
      }
      
      // Otherwise use rates that match the pricing basis
      switch (basis) {
        case 'Hourly':
          return rates.perHour || {};
        case 'Distance':
          return rates.distance || {};
        case 'Per Passenger':
          return rates.perPassenger || {};
        case 'Flat Rate':
          return rates.flatRate || rates.distance || {};
        default:
          return rates;
      }
    };
    
    const relevantRates = getRatesForPricingBasis(allRates, primaryPricingBasis);
    
    // Extract rates from nested structure (perHour, distance, etc.) or flat structure
    const getNum = (val) => {
      const num = parseFloat(val);
      return Number.isFinite(num) ? num : 0;
    };

    // Base rate / flat rate - only if FIXED/FLAT is allowed or as minimum fare
    const baseRate = getNum(relevantRates.baseRate)
      || getNum(relevantRates.baseFare)
      || getNum(relevantRates.minimumFare)
      || getNum(allRates.perHour?.baseRate) 
      || getNum(allRates.distance?.baseFare)
      || getNum(allRates.distance?.minimumFare) 
      || getNum(allRates.base_rate) || getNum(allRates.baseRate) || getNum(allRates.flatRate) || 0;
    
    // Hourly rate - only include if HOURS pricing type is allowed
    const perHour = isAllowed('HOURS') ? (
      getNum(relevantRates.ratePerHour)
      || getNum(allRates.perHour?.ratePerHour)
      || getNum(allRates.per_hour) || getNum(allRates.hourlyRate)
      || getNum(allRates.perHour?.asLow)
      || getNum(allRates.perHour?.rateSchedules?.[0]?.ratePerHour) || 0
    ) : 0;
    
    // Per mile rate - only include if DISTANCE pricing type is allowed
    const perMile = isAllowed('DISTANCE') ? (
      getNum(relevantRates.ratePerMile)
      || getNum(allRates.distance?.ratePerMile)
      || getNum(allRates.per_mile) || getNum(allRates.mileageRate)
      || getNum(allRates.distance?.basePerMile)
      || getNum(allRates.distance?.tiers?.[0]?.rate) || 0
    ) : 0;
    
    // Min hours - only include if HOURS pricing type is allowed
    const minHours = isAllowed('HOURS') ? (
      getNum(relevantRates.minimumHours)
      || getNum(allRates.perHour?.minimumHours)
      || getNum(allRates.min_hours) || getNum(allRates.minimumHours) || 0
    ) : 0;
    
    // Per passenger rate - only include if PASSENGER pricing type is allowed
    const perPassenger = isAllowed('PASSENGER') ? (
      getNum(relevantRates.ratePerPassenger)
      || getNum(allRates.perPassenger?.ratePerPassenger)
      || getNum(allRates.per_passenger) || getNum(allRates.passengerRate) || 0
    ) : 0;
    
    // Gratuity - always include (applies to all pricing types)
    const gratuity = getNum(relevantRates.gratuity)
      || getNum(allRates.perHour?.gratuity) 
      || getNum(allRates.perPassenger?.gratuity)
      || getNum(allRates.distance?.gratuity)
      || getNum(allRates.gratuity) || getNum(allRates.defaultGratuity) || 0;

    // Tiered distance formula config - only if DISTANCE is allowed
    const tieredFormula = isAllowed('DISTANCE') 
      ? (relevantRates.tieredFormula || allRates.distance?.tieredFormula || null)
      : null;

    // Auto-apply rates to cost fields (instant/automatic)
    this.autoApplyRatesToCosts({
      baseRate,
      perHour,
      perMile,
      perPassenger,
      minHours,
      gratuity,
      pricingBasis: primaryPricingBasis,
      allowedPricingTypes,
      tieredFormula
    });
  }

  /**
   * Automatically apply rates to cost fields based on vehicle type and route
   * Called whenever vehicle type or route changes
   */
  autoApplyRatesToCosts(rateConfig) {
    const { baseRate, perHour, perMile, perPassenger, minHours, gratuity, pricingBasis, allowedPricingTypes, tieredFormula } = rateConfig;
    
    // Helper to check if a pricing type is allowed
    const isAllowed = (type) => {
      if (!allowedPricingTypes || !Array.isArray(allowedPricingTypes)) return true;
      const typeUpper = (type || '').toUpperCase();
      return allowedPricingTypes.some(allowed => {
        const a = allowed.toUpperCase();
        if (a === 'HOURS' || a === 'HOURLY' || a === 'PER_HOUR') {
          return typeUpper === 'HOURS' || typeUpper === 'HOURLY' || typeUpper === 'PER_HOUR';
        }
        if (a === 'DISTANCE' || a === 'PER_MILE') {
          return typeUpper === 'DISTANCE' || typeUpper === 'PER_MILE';
        }
        if (a === 'PASSENGER' || a === 'PER_PASSENGER') {
          return typeUpper === 'PASSENGER' || typeUpper === 'PER_PASSENGER';
        }
        if (a === 'FIXED' || a === 'FLAT' || a === 'FLAT_RATE') {
          return typeUpper === 'FIXED' || typeUpper === 'FLAT' || typeUpper === 'FLAT_RATE';
        }
        return a === typeUpper;
      });
    };
    
    const setInputValue = (id, value) => {
      const el = document.getElementById(id);
      if (el && value > 0) {
        el.value = parseFloat(value).toFixed(2);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    };

    // Get current distance from route if available (use pre-converted miles or fall back to meters conversion)
    const distanceMiles = this.latestRouteSummary?.miles 
      || (this.latestRouteSummary?.distanceMeters ? this.latestRouteSummary.distanceMeters / 1609.344 : 0)
      || 0;
    
    // Calculate hours from PU time to DO time for hourly pricing
    const calculateHoursFromTimes = () => {
      const puDate = document.getElementById('puDate')?.value;
      const puTime = document.getElementById('puTime')?.value;
      const doDate = document.getElementById('doDate')?.value || puDate; // Use puDate if doDate not set
      const doTime = document.getElementById('doTime')?.value;
      
      if (puDate && puTime && doTime) {
        const start = new Date(`${puDate}T${puTime}`);
        const end = new Date(`${doDate || puDate}T${doTime}`);
        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
          const diffMs = end.getTime() - start.getTime();
          if (diffMs > 0) {
            return diffMs / (1000 * 60 * 60); // Convert ms to hours
          }
        }
      }
      return 0;
    };
    
    // Get duration in hours - prefer PU/DO time calculation for hourly pricing, fall back to route duration
    const hoursFromTimes = calculateHoursFromTimes();
    const tripHours = hoursFromTimes; // Hours from PU to DO time
    const routeHours = this.latestRouteSummary?.hours 
        || (this.latestRouteSummary?.durationSeconds ? this.latestRouteSummary.durationSeconds / 3600 : 0)
        || 0;
    const durationHours = routeHours > 0 ? routeHours : (parseFloat(document.getElementById('hourQty')?.value) || minHours || 0);
    
    // Get passenger count
    const passengerCount = parseFloat(document.getElementById('numPax')?.value) || 1;

    // Calculate flat rate if tiered formula is enabled
    let calculatedFlatRate = baseRate || 0;
    if (tieredFormula?.enabled && distanceMiles > 0) {
      calculatedFlatRate = this.calculateTieredDistanceCost(distanceMiles, tieredFormula);
    }

    // Build rate data - only include rates for allowed pricing types
    // Always populate qty from route/passenger data for allowed types
    // hour = route duration from Google Maps, hourTrip = PU to DO time duration
    let rateData = {
      flat: { qty: 1, rate: isAllowed('FIXED') || isAllowed('FLAT') ? calculatedFlatRate : 0 },
      hour: { qty: isAllowed('HOURS') ? Math.max(durationHours, minHours) : 0, rate: isAllowed('HOURS') ? (perHour || 0) : 0 },
      hourTrip: { qty: isAllowed('HOURS') ? tripHours : 0, rate: isAllowed('HOURS') ? (perHour || 0) : 0 },
      pass: { qty: isAllowed('PASSENGER') ? passengerCount : 0, rate: isAllowed('PASSENGER') ? (perPassenger || 0) : 0 },
      mile: { qty: isAllowed('DISTANCE') ? distanceMiles : 0, rate: isAllowed('DISTANCE') ? (perMile || 0) : 0 }
    };

    // Apply rates based on pricing basis (service type)
    switch (pricingBasis) {
      case 'Hourly':
        // Hourly pricing: use duration × hourly rate
        if (isAllowed('HOURS') && perHour > 0) {
          setInputValue('hourRate', perHour);
          rateData.hour.qty = Math.max(durationHours, minHours);
        }
        break;

      case 'Per Passenger':
        // Per passenger pricing: use passenger count × per-passenger rate
        if (isAllowed('PASSENGER') && perPassenger > 0) {
          setInputValue('passRate', perPassenger);
          rateData.pass.qty = passengerCount;
        }
        break;

      case 'Distance':
        // Distance/Per mile pricing
        if (isAllowed('DISTANCE')) {
          if (tieredFormula?.enabled && distanceMiles > 0) {
            // Tiered formula result goes to flat rate (qty 1)
            setInputValue('flatRate', calculatedFlatRate);
            rateData.flat.rate = calculatedFlatRate;
            rateData.flat.qty = 1;
            rateData.mile.qty = 0; // Don't double-count with tiered formula
            rateData.mile.rate = 0;
          } else {
            // Simple per-mile: always set qty from distance, rate from vehicle type
            rateData.mile.qty = distanceMiles;
            rateData.mile.rate = perMile || 0;
            
            // Set mileQty in DOM when distance is available
            if (distanceMiles > 0) {
              const mileQtyEl = document.getElementById('mileQty');
              if (mileQtyEl) {
                mileQtyEl.value = distanceMiles.toFixed(2);
                mileQtyEl.dispatchEvent(new Event('input', { bubbles: true }));
              }
            }
            if (perMile > 0) {
              setInputValue('mileRate', perMile);
            }
          }
        }
        break;

      case 'Flat Rate':
      default:
        // Flat rate pricing
        if ((isAllowed('FIXED') || isAllowed('FLAT')) && calculatedFlatRate > 0) {
          setInputValue('flatRate', calculatedFlatRate);
          rateData.flat.rate = calculatedFlatRate;
        }
        break;
    }

    // Set individual rate fields ONLY for allowed pricing types
    if (isAllowed('HOURS') && perHour > 0) setInputValue('hourRate', perHour);
    if (isAllowed('DISTANCE') && perMile > 0) setInputValue('mileRate', perMile);
    if (isAllowed('PASSENGER') && perPassenger > 0) setInputValue('passRate', perPassenger);

    // Gratuity
    if (gratuity > 0) {
      setInputValue('gratuityQty', gratuity);
    }

    // If tiered formula is enabled, always send result to flat rate (qty 1, rate = calculated total)
    if (isAllowed('DISTANCE') && tieredFormula?.enabled && calculatedFlatRate > 0) {
      rateData.flat.qty = 1;
      rateData.flat.rate = calculatedFlatRate;
    }

    // Send rates to iframe - only allowed rate types will have values
    if (this.rateSectionFrame && this.rateSectionReady) {
      this.rateSectionFrame.contentWindow.postMessage({
        type: 'setRates',
        data: rateData,
        allowedPricingTypes: allowedPricingTypes
      }, '*');

      // Send tiered formula result directly to flat rate field
      if (isAllowed('DISTANCE') && tieredFormula?.enabled && calculatedFlatRate > 0) {
        this.rateSectionFrame.contentWindow.postMessage({
          type: 'setTieredDistanceTotal',
          data: { total: calculatedFlatRate }
        }, '*');
      }
    }

    // Recalculate costs
    this.calculateCosts();
  }

  /**
   * Calculate trip hours from PU time to DO time
   * @returns {number} Trip duration in hours
   */
  calculateTripHours() {
    const puDate = document.getElementById('puDate')?.value;
    const puTime = document.getElementById('puTime')?.value;
    const doDate = document.getElementById('doDate')?.value || puDate;
    const doTime = document.getElementById('doTime')?.value;
    
    if (puDate && puTime && doTime) {
      const start = new Date(`${puDate}T${puTime}`);
      const end = new Date(`${doDate || puDate}T${doTime}`);
      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        const diffMs = end.getTime() - start.getTime();
        if (diffMs > 0) {
          return diffMs / (1000 * 60 * 60); // Convert ms to hours
        }
      }
    }
    return 0;
  }

  /**
   * Calculate tiered distance cost using formula: 
   * C(D) = multiplier * (tier1_rate * min(D, tier1_max) + tier2_rate * min(max(D - tier1_max, 0), tier2_range) + tier3_rate * max(D - tier3_start, 0))
   */
  calculateTieredDistanceCost(distanceMiles, formula) {
    const D = distanceMiles || 0;
    const M = formula.multiplier || 1.27;
    const T1 = formula.tier1_rate || 7.87;
    const T1max = formula.tier1_max || 3;
    const T2 = formula.tier2_rate || 3.50;
    const T2range = formula.tier2_range || 7;
    const T3 = formula.tier3_rate || 3.25;
    const T3start = T1max + T2range;

    // Calculate miles in each tier
    const tier1Miles = Math.min(D, T1max);
    const tier2Miles = Math.min(Math.max(D - T1max, 0), T2range);
    const tier3Miles = Math.max(D - T3start, 0);

    // Calculate cost for each tier
    const tier1Cost = T1 * tier1Miles;
    const tier2Cost = T2 * tier2Miles;
    const tier3Cost = T3 * tier3Miles;

    // Calculate total with multiplier
    const subtotal = tier1Cost + tier2Cost + tier3Cost;
    const total = M * subtotal;

    return total;
  }

  /**
   * Apply stored rates that match the selected service type
   * Loads rates from localStorage 'companyRates' and filters by:
   * - status === 'active'
   * - applyTo.serviceTypes includes 'st:' + serviceTypeCode, OR
   * - applyTo.pricingBasis includes matching pricing basis or 'all'
   */
  applyStoredRatesForServiceType(serviceTypeCode, pricingBasis) {
    if (!this.rateSectionFrame || !this.rateSectionReady) {
      return;
    }

    try {
      const savedRates = localStorage.getItem('companyRates');
      if (!savedRates) {
        return;
      }

      const allRates = JSON.parse(savedRates);
      if (!Array.isArray(allRates) || allRates.length === 0) {
        return;
      }

      // Map pricing basis to applyTo values
      const pricingBasisMap = {
        'Hourly': 'hourly',
        'Distance': 'mileage',
        'Flat Rate': 'flat',
        'Per Passenger': 'passenger'
      };
      const pricingBasisValue = pricingBasisMap[pricingBasis] || 'all';

      // Filter rates that match the service type OR pricing basis, and are active
      const matchingRates = allRates.filter(rate => {
        // Must be active
        if (rate.status !== 'active') {
          return false;
        }

        const applyTo = rate.applyTo || {};
        
        // Handle legacy string format
        if (typeof applyTo === 'string') {
          return applyTo === 'all' || applyTo === pricingBasisValue;
        }

        const serviceTypes = applyTo.serviceTypes || [];
        const pricingBasisArr = applyTo.pricingBasis || ['all'];
        
        // If service types are specified, check if current service type matches
        if (serviceTypes.length > 0) {
          const serviceTypeMatch = serviceTypes.includes(`st:${serviceTypeCode}`);
          if (serviceTypeMatch) {
            return true;
          }
          // If service types are specified but don't match, this rate doesn't apply
          return false;
        }

        // No service types specified - check pricing basis
        return pricingBasisArr.includes('all') || pricingBasisArr.includes(pricingBasisValue);
      });

      // Send matching rates to the iframe
      this.rateSectionFrame.contentWindow.postMessage({
        type: 'setAdditionalRates',
        data: matchingRates
      }, '*');

    } catch (e) {
      console.error('Error applying stored rates:', e);
    }
  }

  /**
   * Apply stored rates when iframe becomes ready
   * Gets current service type and pricing basis, then calls applyStoredRatesForServiceType
   */
  applyStoredRatesOnReady() {
    const serviceTypeEl = document.getElementById('serviceType');
    const serviceTypeCode = serviceTypeEl?.value || '';
    
    // Get pricing basis from service type
    let pricingBasis = 'Distance';
    if (this._serviceTypesList) {
      const serviceType = this._serviceTypesList.find(st => st.code === serviceTypeCode);
      if (serviceType?.pricing_type) {
        const pt = serviceType.pricing_type.toUpperCase();
        if (pt === 'HOURS' || pt === 'PER_HOUR' || pt === 'HOURLY') pricingBasis = 'Hourly';
        else if (pt === 'DISTANCE' || pt === 'PER_MILE') pricingBasis = 'Distance';
        else if (pt === 'FLAT' || pt === 'FLAT_RATE') pricingBasis = 'Flat Rate';
        else if (pt === 'PER_PASSENGER' || pt === 'PASSENGER') pricingBasis = 'Per Passenger';
      }
    }
    
    this.applyStoredRatesForServiceType(serviceTypeCode, pricingBasis);
  }

  /**
   * Format a rate value as currency
   */
  formatRate(value) {
    const num = parseFloat(value) || 0;
    return `$${num.toFixed(2)}`;
  }

  /**
   * Setup communication with the rate section iframe
   */
  setupRateSectionIframe() {
    const iframe = document.getElementById('rateSectionFrame');
    if (!iframe) {
      return;
    }

    this.rateSectionFrame = iframe;
    this.rateSectionReady = false;

    // Listen for messages from the rate section iframe
    window.addEventListener('message', (event) => {
      if (event.data && event.data.source === 'rateSection') {
        this.handleRateSectionMessage(event.data);
      }
    });

    // When iframe loads, request it to send ready again
    iframe.addEventListener('load', () => {
      // Give it a moment to initialize, then request ready
      setTimeout(() => {
        if (!this.rateSectionReady && iframe.contentWindow) {
          iframe.contentWindow.postMessage({ type: 'requestReady' }, '*');
        }
      }, 100);
    });

    // Also request ready immediately in case iframe already loaded
    setTimeout(() => {
      if (!this.rateSectionReady && iframe.contentWindow) {
        iframe.contentWindow.postMessage({ type: 'requestReady' }, '*');
      }
    }, 200);
  }

  /**
   * Handle messages from the rate section iframe
   */
  handleRateSectionMessage(message) {
    switch (message.type) {
      case 'ready':
        this.rateSectionReady = true;
        // Send vehicle rates if available
        if (this.currentVehicleType && this.currentVehicleType.rates) {
          this.sendVehicleRatesToIframe(this.currentVehicleType);
        } else {
          // Try to apply current vehicle type from dropdown
          this.applyVehicleTypePricing();
        }
        // Apply stored rates filtered by current service type
        this.applyStoredRatesOnReady();
        // Send pricing basis from service type
        this.sendPricingBasisToIframe();
        // Trigger route calculation to populate distance/duration
        this.updateTripMetricsFromStops().catch(err => {
          console.warn('⚠️ Route metrics not available:', err);
        });
        break;

      case 'ratesChanged':
        // Update hidden fields for form compatibility
        this.syncRatesFromIframe(message.data);
        break;

      case 'ratesData':
        // Response to getRates request
        this.lastRatesData = message.data;
        break;

      case 'resize':
        // Resize iframe to fit content
        if (this.rateSectionFrame && message.data?.height) {
          this.rateSectionFrame.style.height = message.data.height + 'px';
        }
        break;

      case 'matrixToggle':
        break;
    }
  }

  /**
   * Send active Rate Management rates to iframe
   */
  sendAdditionalRatesToIframe() {
    if (!this.rateSectionFrame || !this.rateSectionReady) return;

    // Get rates from localStorage (same as Rate Management tab)
    let rates = [];
    try {
      const saved = localStorage.getItem('companyRates');
      rates = saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.warn('Could not load company rates:', e);
    }

    // Only send active rates
    const activeRates = rates.filter(r => r.status === 'active');
    
    this.rateSectionFrame.contentWindow.postMessage({
      type: 'setAdditionalRates',
      data: activeRates
    }, '*');
  }

  /**
   * Send pricing basis to iframe based on selected service type
   */
  sendPricingBasisToIframe() {
    if (!this.rateSectionFrame || !this.rateSectionReady) return;

    // Get service type from dropdown
    const serviceTypeSelect = document.getElementById('serviceType');
    let pricingBasis = 'flat'; // default

    if (serviceTypeSelect && serviceTypeSelect.value) {
      const serviceTypeCode = serviceTypeSelect.value;
      // Try to get pricing type from data attribute first
      const selectedOption = serviceTypeSelect.options[serviceTypeSelect.selectedIndex];
      if (selectedOption && selectedOption.dataset.pricingType) {
        pricingBasis = selectedOption.dataset.pricingType;
      } else if (this._serviceTypesList) {
        // Fallback to cached service types list
        const st = this._serviceTypesList.find(s => s.code === serviceTypeCode);
        if (st?.pricing_type) {
          pricingBasis = st.pricing_type;
        }
      }
    }

    this.rateSectionFrame.contentWindow.postMessage({
      type: 'setPricingBasis',
      data: { basis: pricingBasis }
    }, '*');
  }

  /**
   * Send vehicle type rates to the rate section iframe
   */
  sendVehicleRatesToIframe(vehicleData) {
    if (!this.rateSectionFrame || !this.rateSectionReady) {
      return;
    }

    this.rateSectionFrame.contentWindow.postMessage({
      type: 'setVehicleRates',
      data: vehicleData
    }, '*');
  }

  /**
   * Send gratuity percentage to the rate section iframe
   */
  sendGratuityToIframe(percent) {
    if (!this.rateSectionFrame || !this.rateSectionReady) return;

    this.rateSectionFrame.contentWindow.postMessage({
      type: 'setGratuity',
      data: { percent }
    }, '*');
  }

  /**
   * Sync rates from iframe to hidden form fields
   */
  syncRatesFromIframe(data) {
    if (!data || !data.rates) return;

    // Update hidden fields
    const setHiddenValue = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.value = value;
    };

    setHiddenValue('grandTotal', data.grandTotal);
    setHiddenValue('payments', data.payments);
    setHiddenValue('flatQty', data.rates.flat?.qty || 1);
    setHiddenValue('flatRate', data.rates.flat?.rate || 0);
    setHiddenValue('hourQty', data.rates.hour?.qty || 0);
    setHiddenValue('hourRate', data.rates.hour?.rate || 0);
    setHiddenValue('passQty', data.rates.pass?.qty || 0);
    setHiddenValue('passRate', data.rates.pass?.rate || 0);
    setHiddenValue('mileQty', data.rates.mile?.qty || 0);
    setHiddenValue('mileRate', data.rates.mile?.rate || 0);
    setHiddenValue('gratuityPercent', data.gratuityPercent || 20);
    setHiddenValue('gratuityTotal', data.gratuityTotal || 0);

    // Store for save operation
    this.currentRatesData = data;
  }

  /**
   * Request current rates from iframe
   */
  requestRatesFromIframe() {
    if (!this.rateSectionFrame || !this.rateSectionReady) {
      return Promise.resolve(this.currentRatesData || null);
    }

    return new Promise((resolve) => {
      const handler = (event) => {
        if (event.data?.source === 'rateSection' && event.data?.type === 'ratesData') {
          window.removeEventListener('message', handler);
          resolve(event.data.data);
        }
      };
      window.addEventListener('message', handler);
      
      this.rateSectionFrame.contentWindow.postMessage({ type: 'getRates' }, '*');
      
      // Timeout fallback
      setTimeout(() => {
        window.removeEventListener('message', handler);
        resolve(this.currentRatesData || null);
      }, 500);
    });
  }

  /**
   * Clear all rate fields when service type changes
   * This ensures old rates don't persist when switching between service types
   */
  clearRateFields() {
    const rateFields = [
      'flatQty', 'flatRate', 'flatExt',
      'hourQty', 'hourRate', 'hourExt',
      'mileQty', 'mileRate', 'mileExt',
      'passQty', 'passRate', 'passExt',
      'unitQty', 'unitRate', 'unitExt',
      'otQty', 'otRate', 'otExt',
      'gratuityQty', 'gratuityExt',
      'baseRateQty', 'baseRateExt'
    ];
    
    rateFields.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.value = '0';
      }
    });
    
    // Also clear rates in iframe if available
    if (this.rateSectionFrame && this.rateSectionReady) {
      this.rateSectionFrame.contentWindow.postMessage({
        type: 'clear'
      }, '*');
    }
    
    console.log('[ReservationForm] Rate fields cleared');
  }

  initializeCostCalculations() {
    this.calculateCosts();
  }

  calculateCosts() {
    const requiredIds = [
      'flatQty', 'flatRate', 'hourQty', 'hourRate', 'unitQty', 'unitRate',
      'otQty', 'otRate', 'stopsQty', 'stopsRate', 'gratuityQty', 'fuelQty',
      'discountQty', 'passQty', 'passRate', 'mileQty', 'mileRate',
      'surfaceQty', 'baseRateQty', 'adminQty', 'adminRate',
      'flatExt', 'hourExt', 'unitExt', 'otExt', 'stopsExt', 'gratuityExt',
      'fuelExt', 'discountExt', 'passExt', 'mileExt', 'surfaceExt', 'baseRateExt',
      'adminExt', 'subTotal', 'totalDue'
    ];

    // If any cost field is missing (e.g., on stripped-down embeds), skip calculation to avoid null errors
    const missing = requiredIds.find(id => !document.getElementById(id));
    if (missing) {
      return;
    }

    const costs = {
      flat: {
        qty: parseFloat(document.getElementById('flatQty').value) || 0,
        rate: parseFloat(document.getElementById('flatRate').value) || 0
      },
      hour: {
        qty: parseFloat(document.getElementById('hourQty').value) || 0,
        rate: parseFloat(document.getElementById('hourRate').value) || 0
      },
      unit: {
        qty: parseFloat(document.getElementById('unitQty').value) || 0,
        rate: parseFloat(document.getElementById('unitRate').value) || 0
      },
      ot: {
        qty: parseFloat(document.getElementById('otQty').value) || 0,
        rate: parseFloat(document.getElementById('otRate').value) || 0
      },
      stops: {
        qty: parseFloat(document.getElementById('stopsQty').value) || 0,
        rate: parseFloat(document.getElementById('stopsRate').value) || 0
      },
      gratuity: parseFloat(document.getElementById('gratuityQty').value) || 0,
      fuel: parseFloat(document.getElementById('fuelQty').value) || 0,
      discount: parseFloat(document.getElementById('discountQty').value) || 0,
      pass: {
        qty: parseFloat(document.getElementById('passQty').value) || 0,
        rate: parseFloat(document.getElementById('passRate').value) || 0
      },
      mile: {
        qty: parseFloat(document.getElementById('mileQty').value) || 0,
        rate: parseFloat(document.getElementById('mileRate').value) || 0
      },
      surface: parseFloat(document.getElementById('surfaceQty').value) || 0,
      baseRate: parseFloat(document.getElementById('baseRateQty').value) || 0,
      admin: {
        qty: parseFloat(document.getElementById('adminQty').value) || 0,
        rate: parseFloat(document.getElementById('adminRate').value) || 0
      }
    };

    const result = this.costCalculator.calculate(costs);

    // Update extended values
    document.getElementById('flatExt').value = result.flat.toFixed(2);
    document.getElementById('hourExt').value = result.hour.toFixed(2);
    document.getElementById('unitExt').value = result.unit.toFixed(2);
    document.getElementById('otExt').value = result.ot.toFixed(2);
    document.getElementById('stopsExt').value = result.stops.toFixed(2);
    document.getElementById('gratuityExt').value = result.gratuity.toFixed(2);
    document.getElementById('fuelExt').value = result.fuel.toFixed(2);
    document.getElementById('discountExt').value = result.discount.toFixed(2);
    document.getElementById('passExt').value = result.pass.toFixed(2);
    document.getElementById('mileExt').value = result.mile.toFixed(2);
    document.getElementById('surfaceExt').value = result.surface.toFixed(2);
    document.getElementById('baseRateExt').value = result.baseRate.toFixed(2);
    document.getElementById('adminExt').value = result.admin.toFixed(2);

    // Update totals
    document.getElementById('grandTotal').textContent = result.grandTotal.toFixed(2);
    document.getElementById('payments').textContent = '0.00'; // Would come from payment system
  }

  async saveReservation(opts = {}) {
    // Validate required fields
    if (!this.validateForm()) {
      return;
    }

    // Check for warnings (missing but non-blocking fields)
    const warnings = this.checkReservationWarnings();
    if (warnings.length > 0) {
      const warningList = warnings.map(w => `• ${w}`).join('\n');
      const proceed = confirm(
        `⚠️ RESERVATION WARNINGS\n\nThe following items are missing or need attention:\n\n${warningList}\n\nDo you want to save anyway?`
      );
      if (!proceed) {
        return;
      }
    }

    // Sync rates from iframe before saving
    if (this.rateSectionFrame && this.rateSectionReady) {
      try {
        const ratesData = await this.requestRatesFromIframe();
        if (ratesData) {
          this.syncRatesFromIframe(ratesData);
        }
      } catch (e) {
        console.warn('Could not sync rates from iframe:', e);
      }
    }

    const getValue = (id) => document.getElementById(id)?.value ?? '';
    const getText = (id) => document.getElementById(id)?.textContent ?? '';

    const topSaveBtn = document.querySelector('.btn-save') || document.getElementById('saveBtn');
    const bottomSaveBtn = document.getElementById('saveReservationBtn');
    const saveButtons = [topSaveBtn, bottomSaveBtn].filter(Boolean);

    // More menu toggle
    const moreBtn = document.getElementById('moreActionsBtn');
    const moreMenu = document.getElementById('moreActionsDropdown');
    if (moreBtn && moreMenu && !moreBtn.dataset.bound) {
      moreBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const isOpen = moreMenu.style.display === 'block';
        moreMenu.style.display = isOpen ? 'none' : 'block';
      });
      document.addEventListener('click', (e) => {
        if (!moreMenu.contains(e.target) && e.target !== moreBtn) {
          moreMenu.style.display = 'none';
        }
      });
      moreBtn.dataset.bound = '1';
    }

    // Show loading state on all save buttons
    const originalButtonState = saveButtons.map(btn => ({
      btn,
      text: btn.textContent,
      disabled: btn.disabled,
      background: btn.style.background,
      color: btn.style.color
    }));
    saveButtons.forEach(btn => {
      btn.disabled = true;
      btn.textContent = '⏳ Saving...';
    });

    try {
      // Freeze created timestamp at save time if not already frozen
      const createdField = document.getElementById('resDateTime');
      if (!this.dateTimeFrozen) {
        const now = new Date();
        const dateTimeString = now.toLocaleString('en-US', {
          month: '2-digit',
          day: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });
        this.createdDateTime = dateTimeString;
        if (createdField) {
          createdField.value = dateTimeString;
        }
        this.dateTimeFrozen = true;
        if (this.dateTimeInterval) {
          clearInterval(this.dateTimeInterval);
          this.dateTimeInterval = null;
        }
      }

      const statusSelect = document.getElementById('resStatus');
      const statusValue = statusSelect?.value || 'unassigned';
      const statusLabel = (statusSelect && statusSelect.selectedIndex >= 0)
        ? (statusSelect.options[statusSelect.selectedIndex]?.text?.trim() || statusValue)
        : 'Unassigned';

      const puDate = getValue('puDate');
      const puTime = getValue('puTime');
      const doTime = getValue('doTime');
      const spotTime = getValue('spotTime');
      const garOutTime = getValue('garOutTime');
      const garInTime = getValue('garInTime');

      const farmOptionValue = document.querySelector('input[name="farmOption"]:checked')?.value || 'in-house';
      const eFarmStatusInput = document.getElementById('eFarmStatus') || document.getElementById('efarmStatus');
      const eFarmStatusValue = (eFarmStatusInput?.value || 'Farm-out Unassigned').trim();
      const eFarmStatusCanonical = eFarmStatusInput?.dataset?.canonical || canonicalizeFarmoutStatus(eFarmStatusValue) || 'unassigned';
      const eFarmOutSelect = document.getElementById('eFarmOut');
      const eFarmOutValue = eFarmOutSelect?.value || getValue('eFarmOut') || 'manual';
      const eFarmOutCanonical = eFarmOutSelect?.dataset?.canonical || canonicalizeFarmoutMode(eFarmOutValue) || 'manual';

      // Collect driver and vehicle info
      const driverSelectEl = document.getElementById('driverSelect');
      const driverIdValue = driverSelectEl?.value || '';
      const driverNameValue = driverIdValue && driverSelectEl?.selectedIndex >= 0
        ? driverSelectEl.options[driverSelectEl.selectedIndex]?.text || ''
        : '';
      const carSelectEl = document.getElementById('carSelect');
      const fleetVehicleIdValue = carSelectEl?.value || '';
      const fleetVehicleNameValue = fleetVehicleIdValue && carSelectEl?.selectedIndex >= 0
        ? carSelectEl.options[carSelectEl.selectedIndex]?.text || ''
        : '';
      const serviceTypeEl = document.getElementById('serviceType');
      const serviceTypeFormValue = serviceTypeEl?.value || '';
      const vehicleTypeEl = document.getElementById('vehicleTypeRes');
      const vehicleTypeFormValue = vehicleTypeEl?.value || '';

      // Collect all form data
      const reservationData = {
        billingAccount: {
          account: getValue('billingAccountSearch'),
          company: getValue('billingCompany'),
          firstName: getValue('billingFirstName'),
          lastName: getValue('billingLastName'),
          cellPhone: getValue('billingPhone'),
          email: getValue('billingEmail')
        },
        bookedBy: {
          firstName: getValue('bookedByFirstName'),
          lastName: getValue('bookedByLastName'),
          phone: getValue('bookedByPhone'),
          email: getValue('bookedByEmail')
        },
        passenger: {
          firstName: getValue('passengerFirstName'),
          lastName: getValue('passengerLastName'),
          phone: getValue('passengerPhone'),
          email: getValue('passengerEmail'),
          altContactName: getValue('altContactName'),
          altContactPhone: getValue('altContactPhone')
        },
        routing: {
          stops: this.getStops(),
          tripNotes: getValue('tripNotes'),
          billPaxNotes: getValue('billPaxNotes'),
          dispatchNotes: getValue('dispatchNotes'),
          partnerNotes: getValue('partnerNotes')
        },
        details: {
          status: statusValue,
          statusLabel,
          createdAt: this.createdDateTime || getValue('resDateTime'),
          created_at: this.createdDateTime || getValue('resDateTime'),
          puDate,
          puTime,
          doTime,
          spotTime,
          garOutTime,
          garInTime,
          farmOption: farmOptionValue,
          efarmStatus: eFarmStatusValue,
          eFarmStatus: eFarmStatusValue,
          eFarmOut: eFarmOutCanonical,
          farmoutStatusCanonical: eFarmStatusCanonical,
          farmoutMode: eFarmOutCanonical,
          affiliate: getValue('affiliate'),
          referenceNum: getValue('referenceNum') || getValue('referenceNumber'),
          driver: getValue('driverAssignment') || getValue('driverSelect'),
          // Add driver, vehicle, and service type for transformReservationPayload
          driverId: driverIdValue,
          driverName: driverNameValue,
          fleetVehicleId: fleetVehicleIdValue,
          fleetVehicleName: fleetVehicleNameValue,
          serviceType: serviceTypeFormValue,
          vehicleType: vehicleTypeFormValue
        },
        costs: this.getCostData(),
        grandTotal: parseFloat(getText('grandTotal'))
      };

      // Get current confirmation number - assign real number if this is a new reservation
      const confField = document.getElementById('confNumber') || document.getElementById('confirmation-number');
      let currentConfNumber = confField?.value;
      if (!currentConfNumber || currentConfNumber === 'NEW' || currentConfNumber === 'Loading...') {
        console.log('🔢 Assigning confirmation number from settings...');
        currentConfNumber = await this.computeNextConfirmationNumber();
        if (confField) confField.value = currentConfNumber;
        console.log('🔢 Confirmation number assigned:', currentConfNumber);
      }
      if (confField) {
        confField.setAttribute('readonly', 'true');
      }
      const pickupAt = puDate ? (puTime ? `${puDate}T${puTime}` : puDate) : null;

      // Check if this is a new reservation
      const allReservations = await db.getAllReservations();
      const existingReservation = allReservations.find(r => 
        r.confirmation_number === currentConfNumber || r.id === currentConfNumber
      );
      const isNewReservation = !existingReservation;

      // If this reservation already exists, carry its id so we update instead of inserting a duplicate
      if (existingReservation?.id) {
        reservationData.id = existingReservation.id;
      }
      
      // Get account_id from billing account search (if an account number is entered)
      const accountSearchValue = reservationData.billingAccount.account?.trim();
      let accountId = null;
      if (accountSearchValue) {
        // Try to find account by account number
        const allAccounts = await db.getAllAccounts();
        const account = allAccounts.find(a => 
          a.account_number === accountSearchValue || 
          a.id === accountSearchValue ||
          `${a.account_number} - ${a.first_name} ${a.last_name}`.includes(accountSearchValue)
        );
        if (account) {
          accountId = account.id;
          console.log('✅ Found account for reservation:', account.account_number);
        }
      }
      
      const formSnapshot = this.collectReservationSnapshot();

      // NO localStorage save for reservations - Supabase is the source of truth
      // (localStorage save removed to prevent ghost data issues)
      console.log('📋 Reservation data prepared, will save to Supabase only');

      // Mark form as clean after we capture the outgoing payload
      this.dirty = false;
      
      // Save passenger to passengers database (with Supabase sync)
      // Only save if we have at least a first name
      const passengerFirstName = (reservationData.passenger.firstName || '').trim();
      const passengerLastName = (reservationData.passenger.lastName || '').trim();
      if (passengerFirstName) {
        const passengerSaved = await db.savePassenger({
          firstName: passengerFirstName,
          lastName: passengerLastName || 'Unknown',
          phone: reservationData.passenger.phone,
          email: reservationData.passenger.email,
          altContactName: reservationData.passenger.altContactName,
          altContactPhone: reservationData.passenger.altContactPhone,
          notes: `From reservation ${currentConfNumber}`
        });
        console.log('👤 Passenger saved to db and Supabase:', passengerSaved);
      } else {
        console.log('⏭️ Skipping passenger save - no first name provided');
      }
      
      // Save booking agent to booking agents database (with Supabase sync)
      // Only save if we have at least a first name
      const bookingFirstName = (reservationData.bookedBy.firstName || '').trim();
      const bookingLastName = (reservationData.bookedBy.lastName || '').trim();
      if (bookingFirstName) {
        const bookingAgentSaved = await db.saveBookingAgent({
          firstName: bookingFirstName,
          lastName: bookingLastName || 'Unknown',
          phone: reservationData.bookedBy.phone,
          email: reservationData.bookedBy.email,
          companyName: reservationData.bookedBy.companyName || null,
          notes: `From reservation ${currentConfNumber}`
        });
        console.log('📞 Booking agent saved to db and Supabase:', bookingAgentSaved);
      } else {
        console.log('⏭️ Skipping booking agent save - no first name provided');
      }
      
      // If passenger/booking agent matches billing, also update the account
      if (this.passengerMatchesBilling || this.bookingMatchesBilling) {
        const accountNumber = reservationData.billingAccount.account;
        if (accountNumber && accountNumber.trim()) {
          const accountList = await db.getAllAccounts();
          const account = accountList.find(a => a.id === accountNumber || a.account_number === accountNumber);
          if (account) {
            const updatedAccount = {
              ...account,
              phone: reservationData.billingAccount.cellPhone || account.phone,
              cell_phone: reservationData.billingAccount.cellPhone || account.cell_phone,
              email: reservationData.billingAccount.email || account.email,
              updated_at: new Date().toISOString()
            };
            await db.saveAccount(updatedAccount);
            console.log('✅ Account updated with latest info');
          }
        }
      }

      // Save addresses to account if account number exists
      // This captures all addresses from the reservation for easy reuse
      const accountNumber = reservationData.billingAccount.account;
      if (accountNumber && accountNumber.trim()) {
        // Find account by number
        const accountList2 = await db.getAllAccounts();
        const account = accountList2.find(a => a.id === accountNumber || a.account_number === accountNumber);
        
        if (account) {
          console.log('📍 Saving addresses to account:', account.id);
          const addressPromises = [];
          
          // Save route stops if available
          if (reservationData.routing.stops && reservationData.routing.stops.length > 0) {
            if (typeof db.saveRouteStops === 'function') {
              db.saveRouteStops(saved.id, reservationData.routing.stops);
              console.log('✅ Route stops saved to db');
            }
            
            // Save each stop address to the account
            for (const stop of reservationData.routing.stops) {
              if (stop.address1 && stop.city) {
                const addressData = {
                  address_type: stop.stopType || 'waypoint',
                  address_name: stop.locationName || '',
                  address_line1: stop.address1,
                  address_line2: stop.address2 || '',
                  city: stop.city,
                  state: stop.state || '',
                  zip_code: stop.zipCode || '',
                  country: 'United States',
                  latitude: stop.latitude || null,
                  longitude: stop.longitude || null
                };
                
                addressPromises.push(db.saveAccountAddress(account.id, addressData));
              }
            }
          }
          
          // Also save primary pickup address from form fields
          const puAddress = document.getElementById('puAddress')?.value?.trim();
          const puCity = document.getElementById('puCity')?.value?.trim();
          const puLocationName = document.getElementById('puLocationName')?.value?.trim() || 
                                 document.getElementById('puPlace')?.value?.trim() || '';
          if (puAddress && puCity) {
            addressPromises.push(db.saveAccountAddress(account.id, {
              address_type: 'pickup',
              address_name: puLocationName,
              address_line1: puAddress,
              address_line2: '',
              city: puCity,
              state: document.getElementById('puState')?.value?.trim() || '',
              zip_code: document.getElementById('puZip')?.value?.trim() || '',
              country: 'United States'
            }));
          }
          
          // Also save primary dropoff address from form fields
          const doAddress = document.getElementById('doAddress')?.value?.trim();
          const doCity = document.getElementById('doCity')?.value?.trim();
          const doLocationName = document.getElementById('doLocationName')?.value?.trim() || 
                                 document.getElementById('doPlace')?.value?.trim() || '';
          if (doAddress && doCity) {
            addressPromises.push(db.saveAccountAddress(account.id, {
              address_type: 'dropoff',
              address_name: doLocationName,
              address_line1: doAddress,
              address_line2: '',
              city: doCity,
              state: document.getElementById('doState')?.value?.trim() || '',
              zip_code: document.getElementById('doZip')?.value?.trim() || '',
              country: 'United States'
            }));
          }
          
          // Wait for all address saves to complete
          try {
            await Promise.all(addressPromises);
            console.log('✅ All addresses saved to account');
          } catch (addrError) {
            console.warn('⚠️ Some addresses failed to save:', addrError);
          }
        }
      }

      // Normalize key summary fields for list views
      const passengerFullName = `${reservationData.passenger.firstName || ''} ${reservationData.passenger.lastName || ''}`.trim();
      const billingCompanyName = reservationData.billingAccount.company || '';
      const vehicleTypeValue = document.getElementById('vehicleTypeRes')?.value || '';
      const serviceTypeValue = document.getElementById('serviceType')?.value || '';
      const grandTotalValue = parseFloat(document.getElementById('grandTotal')?.textContent || '0') || 0;
      const paymentTypeValue = (document.querySelector('#paymentTab .payment-control')?.value || '').toString();
      const groupNameValue = document.getElementById('groupName')?.value || '';
      
      // Debug: Show what's being captured
      console.log('📋 SAVE DEBUG - billingCompany field value:', document.getElementById('billingCompany')?.value);
      console.log('📋 SAVE DEBUG - reservationData.billingAccount:', reservationData.billingAccount);
      console.log('📋 SAVE DEBUG - billingCompanyName to be saved:', billingCompanyName);
      console.log('📋 SAVE DEBUG - confirmation number:', currentConfNumber);
      console.log('📋 SAVE DEBUG - account_id:', accountId);

      // SAVE TO SUPABASE (PRIMARY) - No localStorage for reservations
      let supabaseSaveSuccess = false;
      let supabaseError = null;
      try {
        console.log('🔍 Testing Supabase connection and authentication...');
        const { setupAPI } = await import('./api-service.js');
        await setupAPI();
        
        // Test authentication and organization context first
        try {
          const { getSupabaseClient } = await import('./api-service.js');
          const client = getSupabaseClient();
          if (client) {
            const { data: { user }, error: userError } = await client.auth.getUser();
            console.log('🔐 Current user:', user?.id || 'Not authenticated', userError?.message || '');
            
            if (user) {
              const { data: membership, error: membershipError } = await client
                .from('organization_members')
                .select('organization_id')
                .eq('user_id', user.id)
                .single();
              console.log('🏢 Organization membership:', membership?.organization_id || 'None', membershipError?.message || '');
            }
          }
        } catch (authTestError) {
          console.error('🔐 Auth test failed:', authTestError);
        }
        
        console.log('💾 Attempting to save reservation...');
        
        // Use the proper save chain through supabase-db.js
        const supabaseResult = await db.saveReservation({
          ...reservationData,
          confirmationNumber: currentConfNumber,
          confirmation_number: currentConfNumber,
          formSnapshot,
          form_snapshot: formSnapshot,
          createdAt: this.createdDateTime || reservationData.details.createdAt,
          created_at: this.createdDateTime || reservationData.details.created_at,
          accountId: accountId,
          account_id: accountId,
          status: statusValue,
          pickupDateTime: pickupAt,
          pickup_datetime: pickupAt,
          passenger_name: passengerFullName,
          vehicle_type: vehicleTypeValue,
          service_type: serviceTypeValue,
          trip_type: serviceTypeValue,
          grand_total: grandTotalValue,
          payment_type: paymentTypeValue,
          passengerCount: parseInt(document.getElementById("numPax")?.value || "1") || 1,
          passenger_count: parseInt(document.getElementById("numPax")?.value || "1") || 1,
          grandTotal: grandTotalValue,
          farmOption: farmOptionValue,
          farm_option: farmOptionValue,
          // Explicitly pass driver and vehicle IDs
          assigned_driver_id: driverIdValue || null,
          assigned_driver_name: driverNameValue || null,
          fleet_vehicle_id: fleetVehicleIdValue || null
        });
        
        console.log('📤 Save result:', supabaseResult);
        
        // Handle different response formats
        if (supabaseResult && supabaseResult.success === false) {
          // Structured error response
          throw new Error(supabaseResult.error || 'Database operation failed');
        } else if (supabaseResult && (supabaseResult.id || (Array.isArray(supabaseResult) && supabaseResult.length > 0) || supabaseResult.confirmation_number)) {
          // Success - various valid formats
          supabaseSaveSuccess = true;
          console.log('✅ Reservation saved successfully:', supabaseResult);
          if (isNewReservation) {
            this.updateLastUsedConfirmationNumber(currentConfNumber);
          }
          // Keep form open for further editing; just show a toast/notification
          this.showSaveNotification('Reservation saved');
          
          // 📧 Send confirmation emails (billing with price, passenger without price if different)
          try {
            if (window.CustomerNotificationService) {
              console.log('📧 Sending reservation confirmation emails...');
              // Build reservation data for notification
              const reservationForNotification = {
                confirmation_number: currentConfNumber,
                passenger_name: passengerFullName,
                pickup_datetime: pickupAt,
                pickup_address: document.getElementById('puAddress')?.value || '',
                dropoff_address: document.getElementById('doAddress')?.value || '',
                vehicle_type: vehicleTypeValue,
                passenger_count: parseInt(document.getElementById("numPax")?.value || "1") || 1,
                grand_total: grandTotalValue,
                base_fare: document.getElementById('baseRate')?.value || '0',
                gratuity: document.getElementById('gratuity')?.value || '0',
                taxes: document.getElementById('tax')?.value || '0',
                billing_email: document.getElementById('acctEmail')?.value || document.getElementById('bookByEmail')?.value || '',
                passenger_email: document.getElementById('paxEmail')?.value || '',
                passenger_phone: document.getElementById('paxPhone')?.value || document.getElementById('paxCell')?.value || ''
              };
              const confirmResults = await window.CustomerNotificationService.sendReservationConfirmation(reservationForNotification);
              console.log('📬 Confirmation notification results:', confirmResults);
            }
          } catch (notifyError) {
            console.error('❌ Failed to send confirmation emails:', notifyError);
            // Don't block the save operation if notification fails
          }
          
          // Auto Farmout Mode: After save, auto-set farmout options if enabled
          await this.applyAutoFarmoutIfEnabled();
        } else {
          throw new Error('Save operation returned unexpected format: ' + JSON.stringify(supabaseResult));
        }
      } catch (apiError) {
        supabaseError = apiError;
        console.error('❌ Supabase save FAILED:', apiError);
      }
      
      // Show clear error if Supabase save failed
      if (!supabaseSaveSuccess) {
        const errorMsg = supabaseError?.message || 'Unknown database error';
        alert(`⚠️ RESERVATION NOT SAVED TO DATABASE!\n\nError: ${errorMsg}\n\nPlease check your connection and try again.`);
        
        // Reset buttons
        originalButtonState.forEach(s => {
          s.btn.disabled = s.disabled;
          s.btn.textContent = s.text;
          s.btn.style.background = s.background;
          s.btn.style.color = s.color;
        });
        return; // Don't proceed if Supabase save failed
      }
      
      // Success - update UI
      console.log('✅ Reservation saved successfully to Supabase');
      saveButtons.forEach(btn => {
        btn.textContent = '✓ Saved!';
        btn.style.background = '#28a745';
        btn.style.color = 'white';
      });
      
      // Notify parent window to refresh reservations list
      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({
            action: 'reservationSaved',
            confirmationNumber: currentConfNumber
          }, '*');
          console.log('📤 Sent reservationSaved message to parent');
        }
      } catch (e) {
        console.warn('Could not notify parent of save:', e);
      }
      
      // Keep user on form; reset buttons after short delay
      setTimeout(() => {
        originalButtonState.forEach(s => {
          s.btn.disabled = s.disabled;
          s.btn.textContent = s.text;
          s.btn.style.background = s.background;
          s.btn.style.color = s.color;
        });
      }, 1500);
    } catch (error) {
      const message = error?.message || (typeof error === 'string' ? error : 'Unknown error');
      console.error('❌ Error saving reservation:', error);
      if (error?.stack) {
        console.error('Stack:', error.stack);
      }
      alert(`Error saving reservation: ${message}`);
      
      // Reset buttons
      originalButtonState.forEach(s => {
        s.btn.disabled = s.disabled;
        s.btn.textContent = s.text;
        s.btn.style.background = s.background;
        s.btn.style.color = s.color;
      });
    }
  }

  async deleteReservationWithConfirm() {
    try {
      const confField = document.getElementById('confNumber') || document.getElementById('confirmation-number');
      const currentConfNumber = confField?.value?.trim();
      if (!currentConfNumber || currentConfNumber === 'NEW' || currentConfNumber === 'Loading...') {
        alert('No reservation loaded to delete.');
        return;
      }

      // Get the reservation ID - try both id and confirmation_number
      const allReservations = await db.getAllReservations();
      const existingReservation = allReservations.find(r => 
        r.confirmation_number === currentConfNumber ||
        r.id === currentConfNumber
      );

      // Even if not found locally, try to delete by confirmation number anyway
      // (it might exist in Supabase but not in local cache)
      const confirmed = window.confirm('Are you sure you want to DELETE this reservation?');
      if (!confirmed) return;

      // Delete using both ID and confirmation number for thorough cleanup
      const deleteId = existingReservation?.id || currentConfNumber;
      const deleteConf = existingReservation?.confirmation_number || currentConfNumber;
      
      console.log('🗑️ Attempting to delete reservation:', { deleteId, deleteConf });
      
      // Delete by ID
      if (typeof db.deleteReservation === 'function') {
        await db.deleteReservation(deleteId);
        // Also try by confirmation number if different
        if (deleteConf && deleteConf !== deleteId) {
          await db.deleteReservation(deleteConf);
        }
      } else if (window.apiService?.deleteReservation) {
        await window.apiService.deleteReservation(deleteId);
        if (deleteConf && deleteConf !== deleteId) {
          await window.apiService.deleteReservation(deleteConf);
        }
      }

      // Clear any additional caches
      try {
        // Clear dev_reservations
        const devReservations = JSON.parse(localStorage.getItem('dev_reservations') || '[]');
        const cleanedDev = devReservations.filter(r => 
          r.id !== deleteId && 
          r.confirmation_number !== deleteConf
        );
        localStorage.setItem('dev_reservations', JSON.stringify(cleanedDev));
        
        // Clear local_reservations
        const localReservations = JSON.parse(localStorage.getItem('local_reservations') || '[]');
        const cleanedLocal = localReservations.filter(r => 
          r.id !== deleteId && 
          r.confirmation_number !== deleteConf
        );
        localStorage.setItem('local_reservations', JSON.stringify(cleanedLocal));
        
        console.log('🗑️ Cleared reservation from all local caches');
      } catch (e) {
        console.warn('⚠️ Failed to clear local caches:', e);
      }

      alert('Reservation deleted.');
      window.location.href = 'reservations-list.html';
    } catch (err) {
      console.error('❌ Failed to delete reservation:', err);
      alert('Failed to delete reservation. Please try again.');
    }
  }

  getStops() {
    // Preferred: Stored Routing table (Pick-up / Drop-off / Stops / Wait)
    const tableBody = document.getElementById('addressTableBody');
    if (tableBody) {
      const rows = Array.from(tableBody.querySelectorAll('tr')).filter(r => !r.classList.contains('empty-row'));
      const parsed = rows.map((row, index) => {
        const stopId = row.dataset.stopId || row.id || `stop_${Date.now()}_${index}`;
        const stopTypeRaw = (row.dataset.stopType || '').toLowerCase().trim();

        // If dataset wasn't present, attempt to infer from cell text.
        let inferredType = stopTypeRaw;
        if (!inferredType) {
          const typeText = (row.querySelector('td')?.textContent || '').toLowerCase();
          if (typeText.includes('pickup')) inferredType = 'pickup';
          else if (typeText.includes('dropoff')) inferredType = 'dropoff';
          else if (typeText.includes('wait')) inferredType = 'wait';
          else inferredType = 'stop';
        }

        const tds = row.querySelectorAll('td');
        const locationNameFromCells = (tds[1]?.innerText || '').trim();
        const addressCell = tds[2];
        const addressFirstLine = (addressCell?.querySelector('div')?.innerText || '').trim();
        const addressFromCells = (addressFirstLine || addressCell?.innerText || '').trim();
        const timeInFromCells = (tds[3]?.innerText || '').trim();

        const locationName = (row.dataset.locationName || '').trim() || locationNameFromCells;
        const address1 = (row.dataset.address1 || '').trim();
        const address2 = row.dataset.address2 || '';
        const city = row.dataset.city || '';
        const state = row.dataset.state || '';
        const zipCode = row.dataset.zipCode || '';
        const country = row.dataset.country || '';
        const phone = row.dataset.phone || '';
        const notes = row.dataset.notes || '';
        const timeIn = row.dataset.timeIn || timeInFromCells || '';
        const fullAddress = row.dataset.fullAddress || addressFromCells || '';

        const airportCode = row.dataset.airportCode || '';
        const airline = row.dataset.airline || '';
        const flightNumber = row.dataset.flightNumber || '';
        const terminalGate = row.dataset.terminalGate || '';
        const flightStatus = row.dataset.flightStatus || '';

        const fboId = row.dataset.fboId || '';
        const fboName = row.dataset.fboName || '';
        const fboEmail = row.dataset.fboEmail || '';

        // Provide both the legacy keys and richer routing keys.
        return {
          id: stopId,
          stopType: inferredType,
          type: inferredType,
          locationName,
          location: locationName,
          address1,
          address2,
          city,
          state,
          zipCode,
          country,
          phone,
          notes,
          timeIn,
          fullAddress,
          address: fullAddress || address1,
          airportCode,
          airline,
          flightNumber,
          terminalGate,
          flightStatus,
          fboId,
          fboName,
          fboEmail
        };
      }).filter(s => {
        // Keep rows that have either a location, an address, or any airport/FBO info.
        return !!(s.locationName || s.address1 || s.fullAddress || s.airportCode || s.fboId);
      });

      if (parsed.length > 0) return parsed;
    }

    // Fallback: legacy stop-row UI
    const stops = [];
    document.querySelectorAll('.stop-row').forEach(row => {
      const type = row.querySelector('.stop-type')?.value;
      const location = row.querySelector('.location-name')?.value;
      const address = row.querySelector('.address-input')?.value;

      if (location || address) {
        stops.push({ type, location, address });
      }
    });
    return stops;
  }

  getCostData() {
    const v = (id, fallback = '0') => document.getElementById(id)?.value ?? fallback;
    return {
      flat: { qty: v('flatQty'), rate: v('flatRate') },
      hour: { qty: v('hourQty'), rate: v('hourRate') },
      unit: { qty: v('unitQty'), rate: v('unitRate') },
      ot: { qty: v('otQty'), rate: v('otRate') },
      stops: { qty: v('stopsQty'), rate: v('stopsRate') },
      gratuity: v('gratuityQty'),
      fuel: v('fuelQty'),
      discount: v('discountQty'),
      pass: { qty: v('passQty'), rate: v('passRate') },
      mile: { qty: v('mileQty'), rate: v('mileRate') },
      surface: v('surfaceQty'),
      baseRate: v('baseRateQty'),
      admin: { qty: v('adminQty'), rate: v('adminRate') }
    };
  }

  /**
   * Check for non-blocking warnings before saving a reservation.
   * Returns an array of warning messages. Empty array = no warnings.
   */
  checkReservationWarnings() {
    const warnings = [];
    const getValue = (id) => (document.getElementById(id)?.value || '').trim();

    // 1. Billing info warnings
    const billingAccount = getValue('billingAccountSearch');
    const billingCompany = getValue('billingCompany');
    const billingFirstName = getValue('billingFirstName');
    const billingLastName = getValue('billingLastName');
    if (!billingAccount && !billingCompany && !billingFirstName && !billingLastName) {
      warnings.push('No billing information (account, company, or contact name)');
    }

    // 2. Passenger info warnings
    const passengerFirstName = getValue('passengerFirstName');
    const passengerLastName = getValue('passengerLastName');
    const passengerPhone = getValue('passengerPhone');
    if (!passengerFirstName && !passengerLastName) {
      warnings.push('No passenger name');
    }
    if (!passengerPhone) {
      warnings.push('No passenger phone number');
    }

    // 3. Pickup date warning
    const puDate = getValue('puDate');
    if (!puDate) {
      warnings.push('No pickup date');
    }

    // 4. Pickup time warning
    const puTime = getValue('puTime');
    if (!puTime) {
      warnings.push('No pickup time');
    }

    // 5. Pickup and dropoff location warnings
    const stops = this.getStops();
    const stopsWithAddress = Array.isArray(stops)
      ? stops.filter(s => s && (s.fullAddress || s.address || s.address1 || s.locationName))
      : [];

    const hasPickup = stopsWithAddress.some(s => {
      const t = (s.stopType || s.type || '').toLowerCase();
      return t === 'pickup';
    });

    const hasDropoff = stopsWithAddress.some(s => {
      const t = (s.stopType || s.type || '').toLowerCase();
      return t === 'dropoff';
    });

    if (!hasPickup) {
      warnings.push('No pickup location');
    }
    if (!hasDropoff) {
      warnings.push('No dropoff location');
    }

    // Check if this is a farm-out reservation (affiliate will handle vehicle/driver)
    const farmOutRadio = document.querySelector('input[name="farmOption"][value="farm-out"]');
    const isFarmOut = farmOutRadio?.checked || false;

    // 6. Fleet vehicle warning (skip for farm-outs)
    // Check both carSelect (new) and vehicleType (legacy)
    const carSelect = document.getElementById('carSelect');
    const vehicleTypeSelect = document.getElementById('vehicleType');
    const fleetVehicleValue = carSelect?.value || vehicleTypeSelect?.value || '';
    if (!fleetVehicleValue && !isFarmOut) {
      warnings.push('No fleet vehicle selected');
    }

    // 7. Service type warning
    const serviceType = getValue('serviceType');
    if (!serviceType) {
      warnings.push('No service type selected');
    }

    // 8. Driver warning (skip for farm-outs - affiliate handles driver)
    // Check both driverSelect (new) and driver1/driver (legacy)
    const driverSelect = document.getElementById('driverSelect') || document.getElementById('driver1') || document.getElementById('driver');
    const driverValue = driverSelect?.value || '';
    if (!driverValue && !isFarmOut) {
      warnings.push('No driver assigned');
    }

    // 9. Airport pickup with unverified flight number
    const pickupStop = stopsWithAddress.find(s => {
      const t = (s.stopType || s.type || '').toLowerCase();
      return t === 'pickup';
    });

    if (pickupStop && pickupStop.airportCode) {
      // This is an airport pickup - check for flight verification
      const flightNumber = pickupStop.flightNumber || getValue('flightNumber');
      const flightStatus = pickupStop.flightStatus || getValue('flightStatus');
      
      if (flightNumber) {
        // Has flight number - check if verified (status indicates it was looked up)
        if (!flightStatus || flightStatus === '' || flightStatus.toLowerCase() === 'unverified') {
          warnings.push(`Airport pickup with unverified flight: ${flightNumber}`);
        }
      } else {
        // Airport pickup but no flight number at all
        warnings.push('Airport pickup without flight number');
      }
    }

    return warnings;
  }

  validateForm() {
    // Check required fields
    const passengerFirstName = document.getElementById('passengerFirstName')?.value || '';
    const passengerLastName = document.getElementById('passengerLastName')?.value || '';

    if (!passengerFirstName || !passengerLastName) {
      alert('Please enter passenger name.');
      return false;
    }

    // Billing contact must include phone and email
    const billingPhoneEl = document.getElementById('billingPhone');
    const billingEmailEl = document.getElementById('billingEmail');
    const billingPhoneRaw = (billingPhoneEl?.value || '').trim();
    const billingEmailRaw = (billingEmailEl?.value || '').trim();
    if (!billingPhoneRaw) {
      alert('Please enter a billing phone number.');
      billingPhoneEl?.focus();
      return false;
    }
    if (!billingEmailRaw) {
      alert('Please enter a billing email.');
      billingEmailEl?.focus();
      return false;
    }

    // Normalize/validate phone numbers (US +1)
    const phoneFields = [
      'billingPhone',
      'bookedByPhone',
      'passengerPhone',
      'altContactPhone'
    ];
    for (const id of phoneFields) {
      const el = document.getElementById(id);
      if (!el) continue;
      const raw = (el.value || '').trim();
      if (!raw) continue;
      const normalized = this.normalizeUsPhone(raw);
      if (!normalized) {
        alert('Please enter a valid US phone number with area code for field: ' + id + '.');
        el.focus();
        return false;
      }
      el.value = normalized;
    }

    // Validate emails
    const emailFields = [
      'billingEmail',
      'bookedByEmail',
      'passengerEmail'
    ];
    for (const id of emailFields) {
      const el = document.getElementById(id);
      if (!el) continue;
      const raw = (el.value || '').trim();
      if (!raw) continue;
      if (!this.isValidEmail(raw)) {
        alert('Please enter a valid email address for field: ' + id + '.');
        el.focus();
        return false;
      }
      el.value = raw;
    }

    // Require both a pick-up and a drop-off; intermediate stops are optional
    const stops = this.getStops();
    const stopsWithAddress = Array.isArray(stops)
      ? stops.filter(s => s && (s.fullAddress || s.address || s.address1))
      : [];

    const hasPickup = stopsWithAddress.some(s => {
      const t = (s.stopType || s.type || '').toLowerCase();
      return t === 'pickup';
    });

    const hasDropoff = stopsWithAddress.some(s => {
      const t = (s.stopType || s.type || '').toLowerCase();
      return t === 'dropoff';
    });

    if (!hasPickup || !hasDropoff) {
      alert('Please add both a pick-up and a drop-off address. Stops are optional.');
      return false;
    }

    return true;
  }

  normalizeUsPhone(input) {
    const digits = (input || '').replace(/\D+/g, '');
    if (digits.length === 10) return '+1' + digits;
    if (digits.length === 11 && digits.startsWith('1')) return '+' + digits;
    return null;
  }

  isValidEmail(input) {
    const email = (input || '').trim();
    // Basic RFC5322-ish email check
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  getConfFromUrl() {
    try {
      // First, try to get conf from parent iframe's data attribute
      if (window.frameElement) {
        const confFromParent = window.frameElement.dataset?.confNumber;
        if (confFromParent) {
          console.log('📦 [ReservationForm] Found conf in iframe.dataset.confNumber:', confFromParent);
          return confFromParent.trim();
        }
      }
      
      // Then check sessionStorage
      const sessionConf = sessionStorage.getItem('relia_open_reservation_conf');
      if (sessionConf) {
        console.log('📦 [ReservationForm] Found conf in sessionStorage:', sessionConf);
        sessionStorage.removeItem('relia_open_reservation_conf');
        return sessionConf.trim();
      }
      
      // Finally, try URL parameter
      const fullUrl = window.location.href;
      const search = window.location.search;
      console.log('🔍 [getConfFromUrl] Full URL:', fullUrl);
      console.log('🔍 [getConfFromUrl] Search string:', search);
      
      const conf = new URLSearchParams(search).get('conf');
      console.log('🔍 [getConfFromUrl] Extracted conf from URL:', conf);
      
      return conf ? conf.trim() : null;
    } catch (e) {
      console.error('❌ [getConfFromUrl] Error:', e);
      return null;
    }
  }

  async loadExistingReservation(confNumber) {
    try {
      console.log('📥 [ReservationForm] loadExistingReservation called for conf:', confNumber);
      const allReservations = await db.getAllReservations();
      console.log('📚 [ReservationForm] All reservations in db:', allReservations);
      
      // Find reservation by confirmation number
      const record = allReservations.find(r => 
        r.confirmation_number === confNumber || 
        r.confirmationNumber === confNumber ||
        r.id === confNumber
      );
      console.log('🔎 [ReservationForm] Database lookup result:', record);
      if (!record) {
        console.warn('⚠️ [ReservationForm] No reservation found in database for conf:', confNumber);
        if (this.isViewMode) {
          this.viewModeReady = true;
          window.dispatchEvent(new Event('reliaReservationViewReady'));
        }
        return;
      }

      console.log('✅ [ReservationForm] Found reservation, loading data...');
      // Prefer the full snapshot if present
      if (record.form_snapshot) {
        console.log('📸 [ReservationForm] Using form_snapshot');
        this.applyReservationSnapshot(record.form_snapshot);
      } else {
        // Fallback fill for database records without form_snapshot
        console.log('🔄 [ReservationForm] Using database field mapping');
        console.log('📋 Record data:', record);
        
        // Status
        this.safeSetValue('resStatus', record.status || '');
        
        // Passenger info
        if (record.passenger_name) {
          const parts = record.passenger_name.split(' ');
          this.safeSetValue('passengerFirstName', parts[0] || '');
          this.safeSetValue('passengerLastName', parts.slice(1).join(' ') || '');
        }
        this.safeSetValue('numPax', record.passenger_count || '1');
        
        // Vehicle and service
        this.safeSetValue('vehicleTypeRes', record.vehicle_type || '');
        this.safeSetValue('serviceType', record.trip_type || record.service_type || '');
        
        // Pickup date/time - parse from pickup_datetime (format: "2026-01-20T10:30")
        if (record.pickup_datetime) {
          const pickupDT = record.pickup_datetime;
          if (pickupDT.includes('T')) {
            const [datePart, timePart] = pickupDT.split('T');
            this.safeSetValue('puDate', datePart);
            this.safeSetValue('puTime', timePart.substring(0, 5)); // HH:MM
          } else {
            this.safeSetValue('puDate', pickupDT);
          }
        }
        
        // Dropoff time - parse from dropoff_datetime
        if (record.dropoff_datetime) {
          const dropoffDT = record.dropoff_datetime;
          if (dropoffDT.includes('T')) {
            const timePart = dropoffDT.split('T')[1];
            this.safeSetValue('doTime', timePart.substring(0, 5));
          }
        }
        
        // Driver assignment
        this.safeSetValue('driverAssignment', record.assigned_driver_name || '');
        this.safeSetValue('driverSelect', record.assigned_driver_id || '');
        
        // Fleet vehicle assignment
        if (record.fleet_vehicle_id) {
          this.safeSetValue('carSelect', record.fleet_vehicle_id);
        }
        
        // Service type
        this.safeSetValue('serviceType', record.service_type || record.trip_type || '');
        
        // Rates and payment
        this.safeSetValue('grandTotal', record.grand_total || '');
        this.safeSetValue('rateType', record.rate_type || '');
        this.safeSetValue('rateAmount', record.rate_amount || '');
        
        // Payment type
        const paymentControl = document.querySelector('#paymentTab .payment-control');
        if (paymentControl && record.payment_type) {
          paymentControl.value = record.payment_type;
        }
        
        // Farmout settings - comprehensive handling
        console.log('📋 [ReservationForm] Loading farmout settings:', {
          farmout_mode: record.farmout_mode,
          farmout_status: record.farmout_status
        });
        
        // Determine if this is a farmout reservation based on farmout_mode
        const isFarmout = record.farmout_mode && 
          record.farmout_mode !== 'in_house' && 
          record.farmout_mode !== 'in-house' &&
          record.farmout_mode !== 'none';
        
        // Set the farm option radio button
        const farmOptionValue = isFarmout ? 'farm-out' : 'in-house';
        document.querySelectorAll('input[name="farmOption"]').forEach(radio => {
          radio.checked = radio.value === farmOptionValue;
        });
        
        // Set the eFarmOut dropdown (manual, automatic, etc.)
        if (record.farmout_mode) {
          this.setFarmoutModeSelect(record.farmout_mode);
        }
        
        // Set and display the farmout status with proper styling
        if (record.farmout_status) {
          this.updateEFarmStatus(record.farmout_status);
        } else if (isFarmout) {
          this.updateEFarmStatus('unassigned');
        }
        
        // Notes - extract clean trip notes (remove billing/booking metadata)
        this.safeSetValue('tripNotes', record.notes || '');
        this.safeSetValue('specialInstructions', record.special_instructions || '');
        
        // Build stops from address fields
        const stops = [];
        
        // Pickup stop
        if (record.pickup_address || record.pu_address || record.pickup_city) {
          stops.push({
            stopType: 'pickup',
            type: 'pickup',
            address1: record.pickup_address || '',
            city: record.pickup_city || '',
            state: record.pickup_state || '',
            zipCode: record.pickup_zip || '',
            fullAddress: record.pu_address || [record.pickup_address, record.pickup_city, record.pickup_state, record.pickup_zip].filter(Boolean).join(', ')
          });
        }
        
        // Dropoff stop
        if (record.dropoff_address || record.do_address || record.dropoff_city) {
          stops.push({
            stopType: 'dropoff',
            type: 'dropoff',
            address1: record.dropoff_address || '',
            city: record.dropoff_city || '',
            state: record.dropoff_state || '',
            zipCode: record.dropoff_zip || '',
            fullAddress: record.do_address || [record.dropoff_address, record.dropoff_city, record.dropoff_state, record.dropoff_zip].filter(Boolean).join(', ')
          });
        }
        
        if (stops.length > 0) {
          console.log('📍 Loading stops from database:', stops);
          this.loadStops(stops);
        }
        
        // Load account info if account_id is present (pass record for parsing special_instructions/notes)
        if (record.account_id) {
          await this.loadAccountById(record.account_id, record);
        } else {
          // Even without account_id, still parse passenger/booking from special_instructions/notes
          if (record.special_instructions) {
            this.parseAndFillPassengerFromInstructions(record.special_instructions);
          }
          if (record.notes) {
            this.parseAndFillBookingAgentFromNotes(record.notes);
          }
        }
      }
      console.log('✅ [ReservationForm] Reservation loaded successfully');
      
      // Refresh company name from linked account (in case account was updated)
      await this.refreshCompanyNameFromAccount(record);
      
      if (this.isViewMode) {
        this.viewConfNumber = this.viewConfNumber || confNumber;
        this.finalizeViewMode();
      }

      this.syncFarmoutDisplayFromRecord(record);
    } catch (error) {
      console.error('❌ [ReservationForm] Error loading existing reservation:', error);
      if (this.isViewMode) {
        this.viewModeReady = true;
        window.dispatchEvent(new Event('reliaReservationViewReady'));
      }
    }
  }

  /**
   * Refresh company name from the linked account (for dynamic sync)
   * This ensures if account's company name is updated, the reservation shows the current value
   */
  async refreshCompanyNameFromAccount(record) {
    try {
      const accountId = record?.account_id || record?.billing_account;
      if (!accountId) {
        console.log('📋 [ReservationForm] No account_id to refresh company name from');
        return;
      }
      
      const { getAllAccounts } = await import('./supabase-db.js');
      const accounts = await getAllAccounts();
      const account = accounts.find(a => a.id === accountId);
      
      if (account && account.company_name) {
        console.log('🔄 [ReservationForm] Refreshing company name from account:', account.company_name);
        this.safeSetValue('billingCompany', account.company_name);
        
        // Also update first/last name if available and not already set
        const billingFirstName = document.getElementById('billingFirstName')?.value;
        const billingLastName = document.getElementById('billingLastName')?.value;
        
        if (!billingFirstName && account.first_name) {
          this.safeSetValue('billingFirstName', account.first_name);
        }
        if (!billingLastName && account.last_name) {
          this.safeSetValue('billingLastName', account.last_name);
        }
      } else {
        console.log('📋 [ReservationForm] Account found but no company_name, or account not found');
      }
    } catch (error) {
      console.error('⚠️ [ReservationForm] Error refreshing company name from account:', error);
    }
  }

  /**
   * Load account info by ID and populate billing, passenger, and booking agent fields
   */
  async loadAccountById(accountId, record = null) {
    if (!accountId) return;
    
    try {
      console.log('🔍 [ReservationForm] Loading account by ID:', accountId);
      const { getAllAccounts } = await import('./supabase-db.js');
      const accounts = await getAllAccounts();
      const account = accounts.find(a => a.id === accountId);
      
      if (account) {
        console.log('✅ [ReservationForm] Found account:', account.account_number, account.company_name || account.first_name);
        
        // Populate billing fields
        this.safeSetValue('billingAccountSearch', account.account_number || '');
        this.safeSetValue('billingCompany', account.company_name || '');
        this.safeSetValue('billingFirstName', account.first_name || '');
        this.safeSetValue('billingLastName', account.last_name || '');
        this.safeSetValue('billingPhone', account.phone || account.cell_phone || '');
        this.safeSetValue('billingEmail', account.email || '');
        
        // Also populate passenger fields from account if is_passenger flag is set
        if (account.is_passenger) {
          this.safeSetValue('passengerFirstName', account.first_name || '');
          this.safeSetValue('passengerLastName', account.last_name || '');
          this.safeSetValue('passengerPhone', account.phone || account.cell_phone || '');
          this.safeSetValue('passengerEmail', account.email || '');
          console.log('👤 [ReservationForm] Populated passenger from account (is_passenger)');
        }
        
        // Also populate booking agent fields if is_booking_contact flag is set
        if (account.is_booking_contact) {
          this.safeSetValue('bookedByFirstName', account.first_name || '');
          this.safeSetValue('bookedByLastName', account.last_name || '');
          this.safeSetValue('bookedByPhone', account.phone || account.cell_phone || '');
          this.safeSetValue('bookedByEmail', account.email || '');
          console.log('📞 [ReservationForm] Populated booking agent from account (is_booking_contact)');
        }
        
        // Load saved passengers and addresses for this account
        await this.loadSavedPassengersAndAddresses(accountId);
        
        // Parse passenger info from special_instructions if available (override account defaults)
        if (record?.special_instructions) {
          this.parseAndFillPassengerFromInstructions(record.special_instructions);
        }
        
        // Parse booking agent from notes if available
        if (record?.notes) {
          this.parseAndFillBookingAgentFromNotes(record.notes);
        }
      } else {
        console.log('⚠️ [ReservationForm] Account not found for ID:', accountId);
      }
    } catch (error) {
      console.error('⚠️ [ReservationForm] Error loading account by ID:', error);
    }
  }
  
  /**
   * Load saved passengers and addresses from customer_passengers and customer_addresses tables
   */
  async loadSavedPassengersAndAddresses(accountId) {
    try {
      const { getCustomerPassengers, getCustomerAddresses } = await import('./api-service.js');
      
      // Load saved passengers
      const passengers = await getCustomerPassengers(accountId);
      if (passengers?.length > 0) {
        this.savedPassengers = passengers;
        console.log('👥 [ReservationForm] Loaded saved passengers for account:', passengers.length);
        this.populateSavedPassengersDropdown();
      }
      
      // Load saved addresses
      const addresses = await getCustomerAddresses(accountId);
      if (addresses?.length > 0) {
        this.savedAddresses = addresses;
        console.log('📍 [ReservationForm] Loaded saved addresses for account:', addresses.length);
        this.populateSavedAddressesDropdown();
      }
    } catch (err) {
      console.error('⚠️ [ReservationForm] Error loading saved passengers/addresses:', err);
    }
  }
  
  /**
   * Populate passenger dropdown with saved passengers from customer portal
   */
  populateSavedPassengersDropdown() {
    const dropdown = document.getElementById('savedPassengersDropdown');
    if (!dropdown || !this.savedPassengers?.length) return;
    
    dropdown.innerHTML = '<option value="">-- Select Saved Passenger --</option>';
    this.savedPassengers.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = `${p.first_name} ${p.last_name}${p.relationship && p.relationship !== 'self' ? ` (${p.relationship})` : ''}`;
      dropdown.appendChild(opt);
    });
    
    // Show the dropdown
    dropdown.closest('.form-group')?.classList.remove('hidden');
    
    // Handle selection
    dropdown.addEventListener('change', (e) => {
      const passenger = this.savedPassengers.find(p => p.id === e.target.value);
      if (passenger) {
        this.safeSetValue('passengerFirstName', passenger.first_name || '');
        this.safeSetValue('passengerLastName', passenger.last_name || '');
        this.safeSetValue('passengerPhone', passenger.phone || '');
        this.safeSetValue('passengerEmail', passenger.email || '');
        console.log('👤 [ReservationForm] Selected saved passenger:', passenger.first_name, passenger.last_name);
      }
    });
  }
  
  /**
   * Populate address suggestions with saved addresses from customer portal
   */
  populateSavedAddressesDropdown() {
    // Store addresses for use in autocomplete/suggestions
    if (!this.savedAddresses?.length) return;
    
    console.log('📍 [ReservationForm] Saved addresses available for autocomplete:', 
      this.savedAddresses.map(a => a.label || a.full_address?.substring(0, 30)));
  }
  
  /**
   * Parse passenger phone/email from special_instructions field
   * Format: "Passenger: Name, Phone: xxx, Email: xxx, ..."
   */
  parseAndFillPassengerFromInstructions(instructions) {
    if (!instructions) return;
    
    console.log('📋 [ReservationForm] Parsing passenger from special_instructions:', instructions);
    
    // Parse Phone
    const phoneMatch = instructions.match(/Phone:\s*([^,]+)/i);
    if (phoneMatch && phoneMatch[1]) {
      const phone = phoneMatch[1].trim();
      this.safeSetValue('passengerPhone', phone);
      console.log('📱 Parsed passenger phone:', phone);
    }
    
    // Parse Email
    const emailMatch = instructions.match(/Email:\s*([^,]+)/i);
    if (emailMatch && emailMatch[1]) {
      const email = emailMatch[1].trim();
      this.safeSetValue('passengerEmail', email);
      console.log('📧 Parsed passenger email:', email);
    }
    
    // Parse Alt Contact
    const altContactMatch = instructions.match(/Alt Contact:\s*([^,]+)/i);
    if (altContactMatch && altContactMatch[1]) {
      this.safeSetValue('altContactName', altContactMatch[1].trim());
    }
    
    // Parse Alt Phone
    const altPhoneMatch = instructions.match(/Alt Phone:\s*([^,]+)/i);
    if (altPhoneMatch && altPhoneMatch[1]) {
      this.safeSetValue('altContactPhone', altPhoneMatch[1].trim());
    }
    
    // Parse Flight info
    const flightMatch = instructions.match(/Flight:\s*([^,]+)/i);
    if (flightMatch && flightMatch[1]) {
      this.safeSetValue('flightNumber', flightMatch[1].trim());
    }
    
    // Parse Airline
    const airlineMatch = instructions.match(/Airline:\s*([^,]+)/i);
    if (airlineMatch && airlineMatch[1]) {
      this.safeSetValue('airline', airlineMatch[1].trim());
    }
  }
  
  /**
   * Parse booking agent info from notes field
   * Format: "... | Booked By: Name | Booker Phone: xxx | Booker Email: xxx | ..."
   */
  parseAndFillBookingAgentFromNotes(notes) {
    if (!notes) return;
    
    console.log('📋 [ReservationForm] Parsing booking agent from notes:', notes);
    
    // Parse Booked By name
    const bookedByMatch = notes.match(/Booked By:\s*([^|]+)/i);
    if (bookedByMatch && bookedByMatch[1]) {
      const fullName = bookedByMatch[1].trim();
      const nameParts = fullName.split(' ');
      this.safeSetValue('bookedByFirstName', nameParts[0] || '');
      this.safeSetValue('bookedByLastName', nameParts.slice(1).join(' ') || '');
      console.log('📞 Parsed booked by:', fullName);
    }
    
    // Parse Booker Phone
    const bookerPhoneMatch = notes.match(/Booker Phone:\s*([^|]+)/i);
    if (bookerPhoneMatch && bookerPhoneMatch[1]) {
      this.safeSetValue('bookedByPhone', bookerPhoneMatch[1].trim());
    }
    
    // Parse Booker Email
    const bookerEmailMatch = notes.match(/Booker Email:\s*([^|]+)/i);
    if (bookerEmailMatch && bookerEmailMatch[1]) {
      this.safeSetValue('bookedByEmail', bookerEmailMatch[1].trim());
    }
    
    // Parse Reference Number
    const refMatch = notes.match(/Ref#:\s*([^|]+)/i);
    if (refMatch && refMatch[1]) {
      this.safeSetValue('referenceNum', refMatch[1].trim());
      this.safeSetValue('referenceNumber', refMatch[1].trim());
    }
    
    // Parse Affiliate
    const affiliateMatch = notes.match(/Affiliate:\s*([^|]+)/i);
    if (affiliateMatch && affiliateMatch[1]) {
      this.safeSetValue('affiliate', affiliateMatch[1].trim());
    }
  }

  collectReservationSnapshot() {
    const statusSelect = document.getElementById('resStatus');
    const statusValue = statusSelect?.value || '';
    const statusLabel = (statusSelect && statusSelect.selectedIndex >= 0)
      ? (statusSelect.options[statusSelect.selectedIndex]?.text?.trim() || '')
      : '';
    const farmOptionValue = document.querySelector('input[name="farmOption"]:checked')?.value || '';
    const eFarmStatusInput = document.getElementById('eFarmStatus') || document.getElementById('efarmStatus');
    const eFarmStatusValue = eFarmStatusInput?.value || '';
    const eFarmStatusCanonical = eFarmStatusInput?.dataset?.canonical || canonicalizeFarmoutStatus(eFarmStatusValue) || '';
    const eFarmOutSelect = document.getElementById('eFarmOut');
    const eFarmOutValue = eFarmOutSelect?.value || '';
    const eFarmOutCanonical = eFarmOutSelect?.dataset?.canonical || canonicalizeFarmoutMode(eFarmOutValue) || 'manual';

    // Get driver and fleet vehicle info
    const driverSelect = document.getElementById('driverSelect');
    const driverValue = driverSelect?.value || '';
    const driverName = driverSelect?.selectedIndex >= 0 ? driverSelect.options[driverSelect.selectedIndex]?.text || '' : '';
    const carSelect = document.getElementById('carSelect');
    const fleetVehicleValue = carSelect?.value || '';
    const fleetVehicleName = carSelect?.selectedIndex >= 0 ? carSelect.options[carSelect.selectedIndex]?.text || '' : '';

    const snapshot = {
      billing: {
        account: document.getElementById('billingAccountSearch')?.value || '',
        company: document.getElementById('billingCompany')?.value || '',
        firstName: document.getElementById('billingFirstName')?.value || '',
        lastName: document.getElementById('billingLastName')?.value || '',
        phone: document.getElementById('billingPhone')?.value || '',
        email: document.getElementById('billingEmail')?.value || ''
      },
      bookedBy: {
        firstName: document.getElementById('bookedByFirstName')?.value || '',
        lastName: document.getElementById('bookedByLastName')?.value || '',
        phone: document.getElementById('bookedByPhone')?.value || '',
        email: document.getElementById('bookedByEmail')?.value || ''
      },
      passenger: {
        firstName: document.getElementById('passengerFirstName')?.value || '',
        lastName: document.getElementById('passengerLastName')?.value || '',
        phone: document.getElementById('passengerPhone')?.value || '',
        email: document.getElementById('passengerEmail')?.value || '',
        altContactName: document.getElementById('altContactName')?.value || '',
        altContactPhone: document.getElementById('altContactPhone')?.value || ''
      },
      routing: {
        tripNotes: document.getElementById('tripNotes')?.value || '',
        billPaxNotes: document.getElementById('billPaxNotes')?.value || '',
        dispatchNotes: document.getElementById('dispatchNotes')?.value || '',
        partnerNotes: document.getElementById('partnerNotes')?.value || '',
        stops: this.getStops()
      },
      details: {
        serviceType: document.getElementById('serviceType')?.value || '',
        vehicleType: document.getElementById('vehicleTypeRes')?.value || '',
        driverId: driverValue,
        driverName: driverName,
        fleetVehicleId: fleetVehicleValue,
        fleetVehicleName: fleetVehicleName,
        puDate: document.getElementById('puDate')?.value || '',
        puTime: document.getElementById('puTime')?.value || '',
        doTime: document.getElementById('doTime')?.value || '',
        spotTime: document.getElementById('spotTime')?.value || '',
        garOutTime: document.getElementById('garOutTime')?.value || '',
        garInTime: document.getElementById('garInTime')?.value || '',
        numPax: document.getElementById('numPax')?.value || '',
        luggage: document.getElementById('luggage')?.value || '',
        accessible: document.getElementById('accessible')?.checked || false,
        resStatus: statusValue,
        resStatusLabel: statusLabel,
        farmOption: farmOptionValue,
        eFarmStatus: eFarmStatusValue,
        efarmStatus: eFarmStatusValue,
        farmoutStatusCanonical: eFarmStatusCanonical,
        eFarmOut: eFarmOutCanonical,
        farmoutMode: eFarmOutCanonical
      },
      costs: this.getCostData()
    };

    return snapshot;
  }

  applyReservationSnapshot(snapshot) {
    console.log('📸 [applyReservationSnapshot] Received snapshot:', snapshot);
    console.log('📸 [applyReservationSnapshot] Billing:', snapshot?.billing);
    console.log('📸 [applyReservationSnapshot] Passenger:', snapshot?.passenger);
    console.log('📸 [applyReservationSnapshot] Routing:', snapshot?.routing);
    console.log('📸 [applyReservationSnapshot] Details:', snapshot?.details);
    
    if (!snapshot || typeof snapshot !== 'object') {
      console.warn('⚠️ [applyReservationSnapshot] No valid snapshot provided');
      return;
    }

    this.safeSetValue('billingAccountSearch', snapshot.billing?.account || '');
    this.safeSetValue('billingCompany', snapshot.billing?.company || '');
    this.safeSetValue('billingFirstName', snapshot.billing?.firstName || '');
    this.safeSetValue('billingLastName', snapshot.billing?.lastName || '');
    this.safeSetValue('billingPhone', snapshot.billing?.phone || '');
    this.safeSetValue('billingEmail', snapshot.billing?.email || '');

    this.safeSetValue('bookedByFirstName', snapshot.bookedBy?.firstName || '');
    this.safeSetValue('bookedByLastName', snapshot.bookedBy?.lastName || '');
    this.safeSetValue('bookedByPhone', snapshot.bookedBy?.phone || '');
    this.safeSetValue('bookedByEmail', snapshot.bookedBy?.email || '');

    this.safeSetValue('passengerFirstName', snapshot.passenger?.firstName || '');
    this.safeSetValue('passengerLastName', snapshot.passenger?.lastName || '');
    this.safeSetValue('passengerPhone', snapshot.passenger?.phone || '');
    this.safeSetValue('passengerEmail', snapshot.passenger?.email || '');
    this.safeSetValue('altContactName', snapshot.passenger?.altContactName || '');
    this.safeSetValue('altContactPhone', snapshot.passenger?.altContactPhone || '');

    this.safeSetValue('tripNotes', snapshot.routing?.tripNotes || '');
    this.safeSetValue('billPaxNotes', snapshot.routing?.billPaxNotes || '');
    this.safeSetValue('dispatchNotes', snapshot.routing?.dispatchNotes || '');
    this.safeSetValue('partnerNotes', snapshot.routing?.partnerNotes || '');

    this.safeSetValue('serviceType', snapshot.details?.serviceType || '');
    this.safeSetValue('vehicleTypeRes', snapshot.details?.vehicleType || '');
    
    // Set driver and fleet vehicle from snapshot
    if (snapshot.details?.driverId) {
      this.safeSetValue('driverSelect', snapshot.details.driverId);
    }
    if (snapshot.details?.fleetVehicleId) {
      this.safeSetValue('carSelect', snapshot.details.fleetVehicleId);
    }
    
    this.safeSetValue('puDate', snapshot.details?.puDate || '');
    this.safeSetValue('puTime', snapshot.details?.puTime || '');
    this.safeSetValue('doTime', snapshot.details?.doTime || '');
    this.safeSetValue('spotTime', snapshot.details?.spotTime || '');
    this.safeSetValue('garOutTime', snapshot.details?.garOutTime || '');
    this.safeSetValue('garInTime', snapshot.details?.garInTime || '');
    this.safeSetValue('numPax', snapshot.details?.numPax || '');
    this.safeSetValue('luggage', snapshot.details?.luggage || '');
    this.safeSetValue('resStatus', snapshot.details?.resStatus || '');
    this.safeSetValue('eFarmStatus', snapshot.details?.eFarmStatus || snapshot.details?.efarmStatus || '');
    this.safeSetValue('eFarmOut', snapshot.details?.eFarmOut || '');
    const accessible = document.getElementById('accessible');
    if (accessible) accessible.checked = !!snapshot.details?.accessible;

    this.applyFarmoutSnapshotDetails(snapshot.details || {});

    // Ensure the visible Account # reflects the loaded billing account value
    this.tryResolveBillingAccountAndUpdateDisplay();

    if (snapshot.details?.farmOption) {
      const normalizedFarmOption = snapshot.details.farmOption.replace(/_/g, '-');
      document.querySelectorAll('input[name="farmOption"]').forEach(radio => {
        radio.checked = radio.value === normalizedFarmOption;
      });
    }

    // Ensure derived times follow pickup time rules when loading
    this.updateTimesFromPickup();

    if (Array.isArray(snapshot.routing?.stops)) {
      this.loadStops(snapshot.routing.stops);
    }

    if (snapshot.costs && typeof snapshot.costs === 'object') {
      this.safeSetValue('flatQty', snapshot.costs.flat?.qty ?? '');
      this.safeSetValue('flatRate', snapshot.costs.flat?.rate ?? '');
      this.safeSetValue('hourQty', snapshot.costs.hour?.qty ?? '');
      this.safeSetValue('hourRate', snapshot.costs.hour?.rate ?? '');
      this.safeSetValue('unitQty', snapshot.costs.unit?.qty ?? '');
      this.safeSetValue('unitRate', snapshot.costs.unit?.rate ?? '');
      this.safeSetValue('otQty', snapshot.costs.ot?.qty ?? '');
      this.safeSetValue('otRate', snapshot.costs.ot?.rate ?? '');
      this.safeSetValue('stopsQty', snapshot.costs.stops?.qty ?? '');
      this.safeSetValue('stopsRate', snapshot.costs.stops?.rate ?? '');
      this.safeSetValue('gratuityQty', snapshot.costs.gratuity ?? '');
      this.safeSetValue('fuelQty', snapshot.costs.fuel ?? '');
      this.safeSetValue('discountQty', snapshot.costs.discount ?? '');
      this.safeSetValue('passQty', snapshot.costs.pass?.qty ?? '');
      this.safeSetValue('passRate', snapshot.costs.pass?.rate ?? '');
      this.safeSetValue('mileQty', snapshot.costs.mile?.qty ?? '');
      this.safeSetValue('mileRate', snapshot.costs.mile?.rate ?? '');
      this.safeSetValue('surfaceQty', snapshot.costs.surface ?? '');
      this.safeSetValue('baseRateQty', snapshot.costs.baseRate ?? '');
      this.safeSetValue('adminQty', snapshot.costs.admin?.qty ?? '');
      this.safeSetValue('adminRate', snapshot.costs.admin?.rate ?? '');

      this.calculateCosts();
    }
  }

  loadStops(stops) {
    if (!Array.isArray(stops)) return;

    // Clear and initialize window.tripStops
    window.tripStops = [];

    // Preferred: Stored Routing table
    const tableBody = document.getElementById('addressTableBody');
    if (tableBody) {
      tableBody.innerHTML = '';

      if (stops.length === 0) {
        const emptyRow = document.createElement('tr');
        emptyRow.className = 'empty-row';
        emptyRow.innerHTML = '<td colspan="5" class="empty-message">No addresses added yet. Use the form above to add addresses.</td>';
        tableBody.appendChild(emptyRow);
        return;
      }

      stops.forEach((stop, index) => {
        const stopType = (stop.stopType || stop.type || 'stop').toString().toLowerCase();
        const stopId = stop.id || `stop_${Date.now()}_${index}`;

        // Build complete stop data object
        const stopData = {
          id: stopId,
          stopType: stopType,
          locationName: stop.locationName || stop.location || '',
          address1: stop.address1 || '',
          address2: stop.address2 || '',
          city: stop.city || '',
          state: stop.state || '',
          zipCode: stop.zipCode || '',
          country: stop.country || '',
          phone: stop.phone || '',
          notes: stop.notes || '',
          timeIn: stop.timeIn || '',
          fullAddress: stop.fullAddress || stop.address || '',
          airportCode: stop.airportCode || '',
          airline: stop.airline || '',
          flightNumber: stop.flightNumber || '',
          terminalGate: stop.terminalGate || '',
          flightStatus: stop.flightStatus || '',
          fboId: stop.fboId || '',
          fboName: stop.fboName || '',
          fboEmail: stop.fboEmail || ''
        };

        // Add to global tripStops array
        window.tripStops.push(stopData);

        const row = document.createElement('tr');
        row.id = stopId;
        row.dataset.stopId = stopId;
        row.dataset.stopType = stopData.stopType;
        row.dataset.locationName = stopData.locationName;
        row.dataset.address1 = stopData.address1;
        row.dataset.address2 = stopData.address2;
        row.dataset.city = stopData.city;
        row.dataset.state = stopData.state;
        row.dataset.zipCode = stopData.zipCode;
        row.dataset.country = stopData.country;
        row.dataset.phone = stopData.phone;
        row.dataset.notes = stopData.notes;
        row.dataset.timeIn = stopData.timeIn;
        row.dataset.fullAddress = stopData.fullAddress;
        row.dataset.airportCode = stopData.airportCode;
        row.dataset.airline = stopData.airline;
        row.dataset.flightNumber = stopData.flightNumber;
        row.dataset.terminalGate = stopData.terminalGate;
        row.dataset.flightStatus = stopData.flightStatus;
        row.dataset.fboId = stopData.fboId;
        row.dataset.fboName = stopData.fboName;
        row.dataset.fboEmail = stopData.fboEmail;

        const badgeColor =
          stopType === 'pickup' ? '#28a745' :
          stopType === 'dropoff' ? '#dc3545' :
          stopType === 'stop' ? '#ffc107' :
          '#17a2b8';

        const displayName = stop.locationName || stop.location || (stopType === 'wait' ? 'Wait' : 'Address');
        const displayAddress = stop.fullAddress || stop.address || stop.address1 || '';
        const timeIn = stop.timeIn || '';
        const phone = stop.phone || '';
        const notes = stop.notes || '';

        row.innerHTML = `
          <td><span class="stop-type-badge" style="background: ${badgeColor}; color: white; padding: 4px 8px; border-radius: 3px; font-size: 12px; font-weight: 600;">${stopType.toUpperCase()}</span></td>
          <td><strong>${displayName}</strong></td>
          <td>
            <div>${displayAddress}</div>
            <div style="font-size: 11px; color: #666; margin-top: 3px;">
              ${phone ? '📞 ' + phone + ' | ' : ''}
              ${timeIn ? '⏰ ' + timeIn : ''}
            </div>
            ${notes ? '<div style="font-size: 11px; color: #666; margin-top: 3px; font-style: italic;">📝 ' + notes + '</div>' : ''}
          </td>
          <td>${timeIn || 'N/A'}</td>
          <td>
            <button class="btn-edit" style="padding: 4px 8px; font-size: 12px; cursor: pointer; margin-right: 6px;" onclick="window.editStop && window.editStop('${stopId}')">Edit</button>
            <button class="btn-remove" style="padding: 4px 8px; font-size: 12px; cursor: pointer;" onclick="window.removeStop && window.removeStop('${stopId}')">✕ Remove</button>
          </td>
        `;

        tableBody.appendChild(row);
      });

      // Calculate route metrics after loading stops
      this.updateTripMetricsFromStops().catch(err => {
        console.warn('⚠️ Failed to update route metrics after loading stops:', err);
      });

      return;
    }

    // Fallback: legacy stop-row UI
    document.querySelectorAll('.stop-row').forEach(r => r.remove());
    this.stops = [];

    if (stops.length === 0) return;

    stops.forEach(stop => {
      this.addStop();
      const rows = document.querySelectorAll('.stop-row');
      const row = rows[rows.length - 1];
      if (!row) return;

      const typeEl = row.querySelector('.stop-type');
      const locationEl = row.querySelector('.location-name');
      const addressEl = row.querySelector('.address-input');

      if (typeEl && stop.type) typeEl.value = stop.type;
      if (locationEl) locationEl.value = stop.location || '';
      if (addressEl) addressEl.value = stop.address || '';
    });
  }

  safeSetValue(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = value ?? '';
  }

  applyReservationDraftIfPresent() {
    try {
      const raw = localStorage.getItem(RESERVATION_DRAFT_KEY);
      if (!raw) return;

      const draft = JSON.parse(raw);
      localStorage.removeItem(RESERVATION_DRAFT_KEY);

      // Always create a new confirmation number for drafts
      this.initializeConfirmationNumber();
      this.applyReservationSnapshot(draft);
      console.log('✅ Reservation draft applied and cleared');
    } catch (error) {
      console.error('❌ Failed to apply reservation draft:', error);
      localStorage.removeItem(RESERVATION_DRAFT_KEY);
    }
  }

  async copyToDraftAndNavigate(mode) {
    const snapshot = this.collectReservationSnapshot();

    // Always use a fresh confirmation number for the copy
    const nextConf = await this.computeNextConfirmationNumber();
    const currentConf = (document.getElementById('confNumber')?.value || '').trim();

    // Round trip mode: ask for return date/time and invert stops
    if (mode === 'roundtrip') {
      if (Array.isArray(snapshot.routing?.stops) && snapshot.routing.stops.length >= 2) {
        const reversed = [...snapshot.routing.stops].reverse().map(s => {
          let type = s.type;
          if (type === 'pickup') type = 'dropoff';
          else if (type === 'dropoff') type = 'pickup';
          return { ...s, type };
        });
        snapshot.routing.stops = reversed;
      }

      const returnDate = window.prompt('Enter return PU Date (YYYY-MM-DD):', snapshot.details?.puDate || '');
      const returnTime = window.prompt('Enter return PU Time (HH:MM, 24h):', snapshot.details?.puTime || '');
      if (returnDate) snapshot.details.puDate = returnDate;
      if (returnTime) snapshot.details.puTime = returnTime;
    }

    // Persist draft
    localStorage.setItem(RESERVATION_DRAFT_KEY, JSON.stringify(snapshot));

    // Build target URL carrying the new confirmation number
    const targetUrl = `reservation-form.html?conf=${encodeURIComponent(nextConf)}${currentConf ? `&copiedFrom=${encodeURIComponent(currentConf)}` : ''}`;

    // Notify user and offer to open immediately
    const message = `Copy created with confirmation #${nextConf}.\nOpen now to edit and save?`;
    if (window.confirm(message)) {
      window.location.href = targetUrl;
    } else {
      // Show link they can use later
      alert(`Copy saved. To edit later, open:\n${window.location.origin}/${targetUrl}`);
    }
  }

  openBillingPaymentTab() {
    const paymentTab = document.querySelector('.billing-tab[data-billing-tab="payment"]');
    if (paymentTab) {
      paymentTab.click();
      return;
    }
    // Fallback: attempt to show payment tab directly
    const paymentContent = document.getElementById('paymentTab');
    if (paymentContent) {
      paymentContent.classList.add('active');
    }
  }

  composeEmail() {
    const to = document.getElementById('passengerEmail')?.value?.trim() || document.getElementById('billingEmail')?.value?.trim();
    if (!to) {
      alert('No email address found (Passenger or Billing).');
      return;
    }

    const conf = document.getElementById('confNumber')?.value || '';
    const passengerName = `${document.getElementById('passengerFirstName')?.value || ''} ${document.getElementById('passengerLastName')?.value || ''}`.trim();
    const pickupAt = document.getElementById('puDate')?.value || '';

    const subject = conf ? `Reservation ${conf}` : 'Reservation';
    const bodyLines = [
      conf ? `Confirmation: ${conf}` : null,
      passengerName ? `Passenger: ${passengerName}` : null,
      pickupAt ? `Pickup: ${pickupAt}` : null
    ].filter(Boolean);

    const body = bodyLines.join('\n');
    window.location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  checkForTestData() {
    console.log('🧪 Checking for test data...');
    
    // Check URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const testMode = urlParams.get('test');
    
    if (testMode) {
      console.log('🎯 Test mode detected:', testMode);
      
      // Check for test instructions
      const testInstructions = localStorage.getItem('relia_test_instructions');
      if (testInstructions) {
        try {
          const instructions = JSON.parse(testInstructions);
          console.log('📋 Test instructions found:', instructions);
          
          // Show test instructions in console
          console.log('🔧 TEST MODE ACTIVE 🔧');
          console.log('Instructions:', instructions.steps.join('\n'));
          
          // Auto-fill test data if available
          if (instructions.testData && testMode === 'manual') {
            setTimeout(() => {
              console.log('📝 Auto-filling test data...');
              Object.entries(instructions.testData).forEach(([fieldId, value]) => {
                const element = document.getElementById(fieldId);
                if (element) {
                  element.value = value;
                  console.log(`✅ Set ${fieldId} to "${value}"`);
                } else {
                  console.warn(`⚠️ Element ${fieldId} not found`);
                }
              });
              
              // Highlight the create account button
              const createBtn = document.getElementById('createAccountBtn');
              if (createBtn) {
                createBtn.style.background = '#e74c3c';
                createBtn.style.color = 'white';
                createBtn.style.fontWeight = 'bold';
                createBtn.style.animation = 'pulse 2s infinite';
                console.log('🎯 Create Account button highlighted for testing');
                
                // Show instruction alert
                alert('🧪 TEST MODE ACTIVE!\n\nBilling fields have been auto-filled.\nClick the highlighted "Create Account" button to test the functionality.\n\nWatch the browser console for detailed logs.');
              }
              
              // Add CSS animation
              const style = document.createElement('style');
              style.textContent = `
                @keyframes pulse {
                  0% { transform: scale(1); }
                  50% { transform: scale(1.05); }
                  100% { transform: scale(1); }
                }
              `;
              document.head.appendChild(style);
              
            }, 1000);
          }
          
          // Clean up instructions after use
          localStorage.removeItem('relia_test_instructions');
          
        } catch (error) {
          console.error('❌ Error parsing test instructions:', error);
        }
      }
    }
  }

  // -----------------------------
  // Service Types (dynamic dropdown)
  // -----------------------------
  async loadServiceTypesIntoDropdown() {
    const select = document.getElementById('serviceType');
    if (!(select instanceof HTMLSelectElement)) return;

    try {
      const list = await loadServiceTypes({ includeInactive: false, preferRemote: true });
      const active = Array.isArray(list) ? list.filter((s) => s && s.active !== false && s.code) : [];

      // Cache the service types for rate config lookup
      this._serviceTypesList = active;

      // Preserve current selection (especially important when editing an existing reservation)
      const currentValue = select.value;

      // Rebuild options
      select.innerHTML = '';
      select.add(new Option('- - - - NOT ASSIGNED - - - -', ''));

      active
        .slice()
        .sort((a, b) => (Number(a.sort_order) - Number(b.sort_order)) || String(a.name || '').localeCompare(String(b.name || '')))
        .forEach((st) => {
          const opt = new Option(st.name, st.code);
          // Store pricing type as data attribute for rate section
          if (st.pricing_type) {
            opt.dataset.pricingType = st.pricing_type;
          }
          select.add(opt);
        });

      // Keep legacy value if not found
      const exists = Array.from(select.options).some((o) => o.value === currentValue);
      if (currentValue && !exists) {
        select.add(new Option(`Legacy: ${currentValue}`, currentValue));
      }

      // Restore selection
      if (currentValue) select.value = currentValue;

      // Update rate config display with new service type data
      this.updateRateConfigDisplay();

      // Listen for changes coming from the Service Types admin page
      if (!this._serviceTypesListenersInstalled) {
        this._serviceTypesListenersInstalled = true;

        window.addEventListener('storage', (e) => {
          if (e.key === SERVICE_TYPES_STORAGE_KEY) {
            this.loadServiceTypesIntoDropdown();
          }
        });

        window.addEventListener('relia:service-types-updated', () => {
          this.loadServiceTypesIntoDropdown();
        });
      }
    } catch (e) {
      console.warn('⚠️ Could not load service types; leaving existing dropdown options.', e);
    }
  }

}

// Initialize when DOM is ready
console.log('📄 reservation-form.js loaded - document.readyState:', document.readyState);
console.log('🔍 ReservationForm class defined:', typeof ReservationForm);

function initializeReservationForm() {
  try {
    window.reservationFormInstance = new ReservationForm();
    // Also expose as reservationForm for convenience
    window.reservationForm = window.reservationFormInstance;
    // Also expose common methods globally for debugging
    window.calculateRoute = () => window.reservationFormInstance?.updateTripMetricsFromStops?.();
    window.refreshRates = () => window.reservationFormInstance?.updateRateConfigDisplay?.();
    window.applyStoredRates = () => window.reservationFormInstance?.applyStoredRatesOnReady?.();
    console.log('✅ ReservationForm initialized');
  } catch (error) {
    console.error('❌ Failed to create ReservationForm instance:', error);
  }
}

if (document.readyState === 'loading') {
  console.log('⏳ DOM still loading, waiting for DOMContentLoaded...');
  document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ DOMContentLoaded event fired');
    initializeReservationForm();
  });
} else {
  // DOM is already loaded, initialize immediately
  console.log('⚡ DOM already loaded, initializing immediately');
  initializeReservationForm();
}

// Global backup function for onclick handler
window.copyPassengerToBillingAndOpenAccounts = function() {
  console.log('🎯 Global copyPassengerToBillingAndOpenAccounts() called');
  
  if (window.reservationFormInstance && typeof window.reservationFormInstance.copyPassengerToBillingAndOpenAccounts === 'function') {
    console.log('✅ Calling instance method');
    window.reservationFormInstance.copyPassengerToBillingAndOpenAccounts();
  } else {
    console.log('⚠️ Instance not ready, executing inline backup...');
    
    // Direct implementation as backup
    const firstName = document.getElementById('passengerFirstName')?.value?.trim() || '';
    const lastName = document.getElementById('passengerLastName')?.value?.trim() || '';
    const phone = document.getElementById('passengerPhone')?.value?.trim() || '';
    const email = document.getElementById('passengerEmail')?.value?.trim() || '';
    
    if (!firstName || !lastName) {
      console.warn('⚠️ Please enter passenger first and last name');
      return;
    }
    
    // Copy to billing
    document.getElementById('billingFirstName').value = firstName;
    document.getElementById('billingLastName').value = lastName;
    document.getElementById('billingPhone').value = phone;
    document.getElementById('billingEmail').value = email;
    document.getElementById('billingAccountSearch').value = `${firstName} ${lastName}`;
    
    console.log('✅ Copied to billing fields');
    
    // Save draft
    const draft = {
      first_name: firstName,
      last_name: lastName,
      company_name: document.getElementById('billingCompany')?.value?.trim() || '',
      phone: phone,
      email: email,
      type: 'individual',
      status: 'active'
    };
    
    localStorage.setItem('relia_account_draft', JSON.stringify(draft));
    console.log('✅ Draft saved to localStorage');
    
    // Update button and navigate
    const btn = document.getElementById('copyPassengerToAccountBtn');
    if (btn) {
      btn.textContent = '✓ Opening Accounts...';
      btn.style.background = '#28a745';
      btn.style.color = 'white';
      btn.disabled = true;
    }
    
    setTimeout(() => {
      console.log('🌐 Navigating to accounts.html');
      window.location.href = 'accounts.html?mode=new';
    }, 800);
  }
};

// Global function to handle going back to reservations list
window.goBackToReservations = function() {
  console.log('🔙 Closing form and returning to reservations list');
  const targetWindow = window.top || window.parent || window;
  if (targetWindow === window) {
    window.location.href = 'reservations-list.html';
    return;
  }
  targetWindow.postMessage({
    action: 'switchToReservations'
  }, '*');
};

// Setup close button visibility based on edit mode
document.addEventListener('DOMContentLoaded', () => {
  const closeFormBtn = document.getElementById('closeFormBtn');
  if (closeFormBtn) {
    // Check if we're in edit mode (has ?conf parameter)
    const params = new URLSearchParams(window.location.search);
    const conf = params.get('conf');
    const datasetConf = window.frameElement?.dataset?.confNumber;
    const isViewMode = window.RELIA_VIEW_MODE === true || window.RELIA_VIEW_MODE === 'true' || window.frameElement?.dataset?.viewMode === 'true';
    if (conf || isViewMode || datasetConf) {
      // In edit mode - show close button
      closeFormBtn.style.display = 'inline-block';
      console.log('✓ Close button visible (edit mode)');
      
      // Add escape key handler to close form
      const handleEscape = (e) => {
        if (e.key === 'Escape') {
          console.log('⎋ Escape key pressed - closing form');
          window.goBackToReservations();
        }
      };
      document.addEventListener('keydown', handleEscape);
    } else {
      // In create mode - hide close button
      closeFormBtn.style.display = 'none';
      console.log('✓ Close button hidden (create mode)');
    }
  }
});

// ========================================
// Global Stop Management Functions
// These are exposed on window for use by onclick handlers
// ========================================

// Global edit state for stop editing
if (typeof window.editingStopId === 'undefined') {
  window.editingStopId = null;
}

// Global tripStops array
if (typeof window.tripStops === 'undefined') {
  window.tripStops = [];
}

/**
 * Create or update a stop from the address entry form
 */
window.handleCreateStop = function() {
  console.log('➕ handleCreateStop called!');
  
  // Get form values - use currentStopType from routing panel (new UI) or fallback to radio buttons
  const radioBtn = document.querySelector('input[name="stopType"]:checked');
  const stopType = radioBtn ? radioBtn.value : (window.reservationFormInstance?.currentStopType || 'pickup');
  console.log('📋 Stop type:', stopType);
  const locationName = document.getElementById('locationName')?.value?.trim() || '';
  const address1 = document.getElementById('address1')?.value?.trim() || '';
  
  // Get airport and FBO fields - these may not exist in all layouts
  const airportCode = document.getElementById('airportSelect')?.value?.trim() || '';
  const airlineCode = document.getElementById('airlineCode')?.value?.trim() || '';
  const flightNumber = document.getElementById('flightNumber')?.value?.trim() || '';
  const terminalGate = document.getElementById('terminalGate')?.value?.trim() || '';
  const flightStatus = document.getElementById('flightStatus')?.value?.trim() || '';
  const fboSelectEl = document.getElementById('fboSelect');
  const fboSelect = fboSelectEl?.value?.trim() || '';
  
  // Get FBO info from selected option if available
  let fboInfo = null;
  if (fboSelect && fboSelectEl?.selectedOptions?.[0]) {
    const opt = fboSelectEl.selectedOptions[0];
    fboInfo = {
      name: opt.dataset.name || opt.textContent || '',
      address: opt.dataset.address || '',
      city: opt.dataset.city || '',
      state: opt.dataset.state || '',
      zip: opt.dataset.zip || '',
      phone: opt.dataset.phone || '',
      email: opt.dataset.email || '',
      services: opt.dataset.services || ''
    };
  }
  
  console.log('📝 Form values - locationName:', locationName, 'address1:', address1);
  console.log('✈️ Airport values - code:', airportCode, 'airline:', airlineCode, 'flight:', flightNumber);
  console.log('🛩️ FBO values - fboSelect:', fboSelect, 'fboInfo:', fboInfo);
  
  // Validate - need either location name or address (unless airport or FBO)
  if (!locationName && !address1 && !airportCode && !fboSelect) {
    console.log('⚠️ Need location name, address, airport, or FBO');
    alert('Please enter a location name, address, select an airport, or select an FBO.');
    return;
  }
  console.log('✅ Validation passed, proceeding to create stop');
  
  // Get all form values (with null safety for optional fields)
  const address2 = document.getElementById('address2')?.value?.trim() || '';
  const city = document.getElementById('city')?.value?.trim() || '';
  const state = document.getElementById('state')?.value?.trim() || '';
  const zipCode = document.getElementById('zipCode')?.value?.trim() || '';
  const country = document.getElementById('country')?.value?.trim() || 'US';
  const phone = document.getElementById('locationPhone')?.value?.trim() || '';
  const notes = document.getElementById('locationNotes')?.value?.trim() || '';
  const timeIn = document.getElementById('timeIn')?.value?.trim() || '';
  
  // Get latitude/longitude from hidden fields (populated by Google Places)
  const latitude = parseFloat(document.getElementById('locationLat')?.value) || null;
  const longitude = parseFloat(document.getElementById('locationLng')?.value) || null;
  
  console.log('📋 All form values:', { locationName, address1, address2, city, state, zipCode, country, phone, notes, timeIn, latitude, longitude });
  
  // Build full address
  let fullAddress = address1;
  if (address2) fullAddress += `, ${address2}`;
  if (city) fullAddress += `, ${city}`;
  if (state) fullAddress += ` ${state}`;
  if (zipCode) fullAddress += ` ${zipCode}`;
  if (country && country !== 'US') fullAddress += `, ${country}`;
  
  console.log('🏗️ Built full address:', fullAddress);
  
  // Create / update stop object with ALL details including airport and FBO
  const isEditing = !!window.editingStopId;
  const stopId = isEditing ? window.editingStopId : ('stop_' + Date.now());
  console.log('🆔 Generated stopId:', stopId, 'isEditing:', isEditing);
  
  const stopData = {
    id: stopId,
    stopType: stopType,
    locationName: locationName || (fboInfo?.name) || (airportCode ? `Airport: ${airportCode}` : ''),
    address1: address1 || (fboInfo?.address) || '',
    address2: address2 || (fboInfo?.address ? '' : ''),
    city: city || (fboInfo?.city) || '',
    state: state || (fboInfo?.state) || '',
    zipCode: zipCode || (fboInfo?.zip) || '',
    country: country || 'US',
    phone: phone || (fboInfo?.phone) || '',
    notes: notes || (fboInfo?.services ? `Services: ${fboInfo.services}` : ''),
    timeIn: timeIn,
    fullAddress: fullAddress || (fboInfo ? `${fboInfo.address}, ${fboInfo.city}, ${fboInfo.state} ${fboInfo.zip}` : ''),
    // Geo coordinates from Google Places
    latitude: latitude,
    longitude: longitude,
    // Airport info
    airportCode: airportCode,
    airline: airlineCode,
    flightNumber: flightNumber,
    terminalGate: terminalGate,
    flightStatus: flightStatus,
    // FBO info
    fboId: fboSelect,
    fboName: fboInfo?.name || '',
    fboEmail: fboInfo?.email || '',
    createdAt: new Date().toISOString()
  };
  console.log('📦 Created stopData object:', stopData);

  // Save to global trips array
  if (isEditing) {
    const idx = window.tripStops.findIndex(stop => stop && stop.id === stopId);
    if (idx >= 0) window.tripStops[idx] = stopData;
    else window.tripStops.push(stopData);
  } else {
    window.tripStops.push(stopData);
  }
  console.log('💾 Stop saved to tripStops:', window.tripStops);

  // Get table body
  const tableBody = document.getElementById('addressTableBody');
  if (!tableBody) {
    console.error('❌ addressTableBody not found');
    return;
  }
  
  // Remove empty row if it exists
  const emptyRow = tableBody.querySelector('.empty-row');
  if (emptyRow) {
    emptyRow.remove();
    console.log('🗑️ Removed empty row');
  }

  // Create or update row with stop type badge
  const existingRow = document.getElementById(stopId);
  const row = existingRow || document.createElement('tr');
  row.id = stopId;
  row.dataset.stopId = stopId;
  console.log('🏗️ Creating/updating table row with ID:', stopId);
  
  // Store full stop data for reliable save/load
  row.dataset.stopType = stopData.stopType || '';
  row.dataset.locationName = stopData.locationName || '';
  row.dataset.address1 = stopData.address1 || '';
  row.dataset.address2 = stopData.address2 || '';
  row.dataset.city = stopData.city || '';
  row.dataset.state = stopData.state || '';
  row.dataset.zipCode = stopData.zipCode || '';
  row.dataset.country = stopData.country || '';
  row.dataset.phone = stopData.phone || '';
  row.dataset.notes = stopData.notes || '';
  row.dataset.timeIn = stopData.timeIn || '';
  row.dataset.fullAddress = stopData.fullAddress || '';
  row.dataset.airportCode = stopData.airportCode || '';
  row.dataset.airline = stopData.airline || '';
  row.dataset.flightNumber = stopData.flightNumber || '';
  row.dataset.terminalGate = stopData.terminalGate || '';
  row.dataset.flightStatus = stopData.flightStatus || '';
  row.dataset.fboId = stopData.fboId || '';
  row.dataset.fboName = stopData.fboName || '';
  row.dataset.fboEmail = stopData.fboEmail || '';
  
  const badgeColor = 
    stopType === 'pickup' ? '#28a745' :
    stopType === 'dropoff' ? '#dc3545' :
    stopType === 'stop' ? '#ffc107' :
    '#17a2b8';
  
  // Build display content with airport and FBO info
  let displayAddress = fullAddress;
  let displayExtras = '';
  
  if (airportCode) {
    displayAddress = `✈️ ${airportCode} Airport`;
    displayExtras = `<div style="font-size: 11px; color: #005aa3; margin-top: 3px; font-weight: 500;">
      Flight: ${airlineCode}${flightNumber} | Terminal: ${terminalGate} | Status: ${flightStatus}
    </div>`;
  }
  
  if (fboInfo) {
    displayAddress = `🛩️ ${fboInfo.name}`;
    displayExtras = `<div style="font-size: 11px; color: #005aa3; margin-top: 3px;">
      ${fboInfo.address} | 📞 ${fboInfo.phone}
    </div>`;
  }
  
  row.innerHTML = `
    <td><span class="stop-type-badge" style="background: ${badgeColor}; color: white; padding: 4px 8px; border-radius: 3px; font-size: 12px; font-weight: 600;">${stopType.toUpperCase()}</span></td>
    <td><strong>${stopData.locationName || 'Address'}</strong></td>
    <td>
      <div>${displayAddress}</div>
      <div style="font-size: 11px; color: #666; margin-top: 3px;">
        ${phone ? '📞 ' + phone + ' | ' : ''}
        ${timeIn ? '⏰ ' + timeIn : ''}
      </div>
      ${displayExtras}
      ${notes ? '<div style="font-size: 11px; color: #666; margin-top: 3px; font-style: italic;">📝 ' + notes + '</div>' : ''}
    </td>
    <td>${timeIn || 'N/A'}</td>
    <td>
      <button class="btn-edit" style="padding: 4px 8px; font-size: 12px; cursor: pointer; margin-right: 6px;" onclick="window.editStop && window.editStop('${stopId}')">Edit</button>
      <button class="btn-remove" style="padding: 4px 8px; font-size: 12px; cursor: pointer;" onclick="window.removeStop && window.removeStop('${stopId}')">✕ Remove</button>
    </td>
  `;
  console.log('📋 Row HTML created:', row.innerHTML.substring(0, 200) + '...');

  if (!existingRow) {
    tableBody.appendChild(row);
    console.log('➕ New row added to table, total rows now:', tableBody.children.length);
  } else {
    console.log('🔄 Existing row updated');
  }
  console.log('🎯 Final row element:', row);
  console.log('✅ Stop added to trip table with stopType:', stopType);

  // Refresh route metrics so distance/duration and quantities stay in sync
  try {
    console.log('🔄 Refreshing route metrics...');
    if (window.reservationFormInstance && typeof window.reservationFormInstance.updateTripMetricsFromStops === 'function') {
      console.log('🚀 Calling updateTripMetricsFromStops...');
      window.reservationFormInstance.updateTripMetricsFromStops()
        .then(() => console.log('✅ Route metrics calculation complete'))
        .catch(err => console.error('❌ Route metrics calculation failed:', err));
    } else {
      console.warn('⚠️ reservationFormInstance or updateTripMetricsFromStops not available');
    }
  } catch (err) {
    console.error('❌ Failed to refresh route metrics after adding stop:', err);
  }

  // Clear the form (with null safety)
  const clearField = (id) => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  };
  clearField('locationName');
  clearField('address1');
  clearField('address2');
  clearField('city');
  clearField('state');
  clearField('zipCode');
  clearField('locationNotes');
  clearField('locationPhone');
  clearField('timeIn');
  clearField('airportSearch');
  clearField('airportSelect');
  clearField('airlineSearch');
  clearField('airlineCode');
  clearField('airlineName');
  clearField('flightNumber');
  clearField('terminalGate');
  clearField('flightStatus');
  clearField('fboSelect');
  console.log('🧹 Form cleared successfully');
  
  // Reset stop type radio if it exists, or reset routing panel state
  const pickupRadio = document.querySelector('input[name="stopType"][value="pickup"]');
  if (pickupRadio) pickupRadio.checked = true;
  if (window.reservationFormInstance) window.reservationFormInstance.currentStopType = 'pickup';

  // Close the entry card (new routing panel UI)
  const entryCard = document.getElementById('addressEntryCard');
  if (entryCard) entryCard.style.display = 'none';

  // Clear edit state
  window.editingStopId = null;

  // Show success feedback on the button
  const createBtn = document.getElementById('createStopBtn');
  if (createBtn) {
    const originalText = 'CREATE';
    createBtn.textContent = existingRow ? '✓ Updated!' : '✓ Added!';
    createBtn.style.background = '#28a745';
    createBtn.style.color = 'white';
    
    setTimeout(() => {
      createBtn.textContent = originalText;
      createBtn.style.background = '';
      createBtn.style.color = '';
    }, 1500);
  }

  console.log('✅ Form cleared and ready for next stop');
};

/**
 * Edit a stop - loads its data back into the entry form
 */
window.editStop = function(stopId) {
  console.log('✏️ Editing stop:', stopId);
  window.editingStopId = stopId;

  const row = document.getElementById(stopId);
  if (!row) {
    console.warn('⚠️ Stop row not found:', stopId);
    return;
  }

  const get = (k) => (row.dataset?.[k] || '').toString();

  const stopType = (get('stopType') || 'stop').toLowerCase().trim();
  
  // Set stop type via radio buttons if they exist, or via routing panel state
  const typeEl = document.querySelector(`input[name="stopType"][value="${stopType}"]`);
  if (typeEl) typeEl.checked = true;
  if (window.reservationFormInstance) window.reservationFormInstance.currentStopType = stopType;
  
  // Open the entry card for editing (new routing panel UI)
  const entryCard = document.getElementById('addressEntryCard');
  const entryLabel = document.getElementById('entryTypeLabel');
  if (entryCard) entryCard.style.display = 'block';
  if (entryLabel) {
    const labels = { pickup: '📍 Editing: Pick-up', dropoff: '🎯 Editing: Drop-off', stop: '⏸️ Editing: Stop', wait: '⏱️ Editing: Wait' };
    entryLabel.textContent = labels[stopType] || 'Editing Location';
  }

  const setVal = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.value = value || '';
  };

  setVal('locationName', get('locationName'));
  setVal('address1', get('address1'));
  setVal('address2', get('address2'));
  setVal('city', get('city'));
  setVal('state', get('state'));
  setVal('zipCode', get('zipCode'));
  setVal('country', get('country') || 'US');
  setVal('locationPhone', get('phone'));
  setVal('locationNotes', get('notes'));
  setVal('timeIn', get('timeIn'));

  // Airport fields (best effort)
  const airportCode = get('airportCode');
  if (airportCode) {
    try {
      const radio = document.getElementById('airport');
      if (radio) radio.checked = true;
      if (typeof window.handleLocationTypeChange === 'function') window.handleLocationTypeChange('airport');
    } catch { /* ignore */ }
    setVal('airportSelect', airportCode);
    setVal('airportSearch', `${airportCode} - Airport`);
    const airlineSection = document.getElementById('airlineSection');
    if (airlineSection) airlineSection.style.display = 'block';
    setVal('airlineCode', get('airline'));
    setVal('airlineSearch', get('airline'));
    setVal('flightNumber', get('flightNumber'));
    setVal('terminalGate', get('terminalGate'));
    setVal('flightStatus', get('flightStatus'));
  }

  // FBO fields (best effort)
  const fboId = get('fboId');
  if (fboId) {
    try {
      const radio = document.getElementById('fbo');
      if (radio) radio.checked = true;
      if (typeof window.handleLocationTypeChange === 'function') window.handleLocationTypeChange('fbo');
    } catch { /* ignore */ }
    setVal('fboSelect', fboId);
    try {
      if (typeof window.handleFBOSelection === 'function') window.handleFBOSelection(fboId);
    } catch { /* ignore */ }
  }

  // Switch button to UPDATE mode
  const createBtn = document.getElementById('createStopBtn');
  if (createBtn) {
    createBtn.textContent = 'UPDATE';
    createBtn.style.background = '#ffc107';
    createBtn.style.color = '#333';
  }
};

/**
 * Remove a stop from the table and data array
 */
window.removeStop = function(stopId) {
  console.log('🗑️ Removing stop:', stopId);

  // Cancel edit mode if we're deleting the row being edited
  if (window.editingStopId === stopId) {
    window.editingStopId = null;
    const createBtn = document.getElementById('createStopBtn');
    if (createBtn) {
      createBtn.textContent = 'CREATE';
      createBtn.style.background = '';
      createBtn.style.color = '';
    }
  }
  
  // Remove from DOM
  const row = document.getElementById(stopId);
  if (row) {
    row.remove();
  }

  // Remove from tripStops array
  window.tripStops = window.tripStops.filter(stop => stop.id !== stopId);
  console.log('✅ Stop removed, remaining stops:', window.tripStops);

  // Show empty state if no stops left
  const tableBody = document.getElementById('addressTableBody');
  if (tableBody && tableBody.children.length === 0) {
    const emptyRow = document.createElement('tr');
    emptyRow.className = 'empty-row';
    emptyRow.innerHTML = '<td colspan="5" class="empty-message">No addresses added yet. Use the form below to add addresses.</td>';
    tableBody.appendChild(emptyRow);
  }

  // Recompute route metrics after stop removal
  try {
    window.reservationFormInstance?.updateTripMetricsFromStops?.();
  } catch (err) {
    console.warn('⚠️ Failed to refresh route metrics after removing stop:', err);
  }
};

// Also expose handleLocationTypeChange if not defined
if (typeof window.handleLocationTypeChange === 'undefined') {
  window.handleLocationTypeChange = function(type) {
    console.log('🔄 Location type changed to:', type);
    // Implementation depends on the specific UI - this is a placeholder
  };
}

// Also expose openEntryForm if not defined
if (typeof window.openEntryForm === 'undefined') {
  window.openEntryForm = function(stopType) {
    console.log('📝 Opening entry form for:', stopType);
    const entryCard = document.getElementById('addressEntryCard');
    const entryLabel = document.getElementById('entryTypeLabel');
    if (entryCard) entryCard.style.display = 'block';
    if (entryLabel) {
      const labels = { pickup: '📍 Add Pick-up', dropoff: '🎯 Add Drop-off', stop: '⏸️ Add Stop', wait: '⏱️ Add Wait' };
      entryLabel.textContent = labels[stopType] || 'Add Location';
    }
    if (window.reservationFormInstance) {
      window.reservationFormInstance.currentStopType = stopType;
    }
  };
}
