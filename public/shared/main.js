import { ReservationManager } from './ReservationManager.js';
import { MapManager } from './MapManager.js';
import { UIManager } from './UIManager.js';
import { MapboxService } from './MapboxService.js';
import { DriverTracker } from './DriverTracker.js';
import { FarmoutAutomationService } from './FarmoutAutomationService.js';
import supabaseDb from './supabase-db.js';
import { createReservation as createReservationAPI } from './api-service.js';
import realtimeService, { subscribeToReservations } from './shared/realtime-service.js';

// Use Supabase-only database (no localStorage)
const db = supabaseDb;

// Migration utility - run once to copy localStorage to Supabase
window.migrateLocalStorageToSupabase = async function() {
  console.log('🔄 Starting localStorage to Supabase migration...');
  
  try {
    // Get reservations from localStorage
    const localReservations = JSON.parse(localStorage.getItem('relia_reservations') || '[]');
    console.log(`📂 Found ${localReservations.length} reservations in localStorage`);
    
    if (localReservations.length === 0) {
      console.log('⚠️ No reservations found in localStorage');
      alert('No reservations found in localStorage to migrate.');
      return;
    }
    
    let migrated = 0;
    let failed = 0;
    
    for (const res of localReservations) {
      try {
        // Prepare reservation for Supabase
        const supabaseRes = {
          confirmation_number: res.confirmation_number || res.confirmationNumber || res.id,
          status: res.status || 'confirmed',
          pickup_at: res.pickup_at || res.pickupAt || res.puDate,
          pickup_time: res.pickup_time || res.pickupTime || res.puTime,
          dropoff_time: res.dropoff_time || res.dropoffTime || res.doTime,
          service_type: res.service_type || res.serviceType,
          vehicle_type: res.vehicle_type || res.vehicleType,
          company_name: res.company_name || res.companyName || res.form_snapshot?.billing?.company,
          passenger_first_name: res.passenger_first_name || res.form_snapshot?.passenger?.firstName,
          passenger_last_name: res.passenger_last_name || res.form_snapshot?.passenger?.lastName,
          passenger_phone: res.passenger_phone || res.form_snapshot?.passenger?.phone,
          passenger_email: res.passenger_email || res.form_snapshot?.passenger?.email,
          notes: res.notes || res.form_snapshot?.notes?.tripNotes,
          farm_option: res.farmOption || res.farm_option,
          farmout_status: res.efarm_status || res.farmoutStatus || res.farmout_status,
          form_snapshot: res.form_snapshot
        };
        
        const result = await createReservationAPI(supabaseRes);
        if (result) {
          migrated++;
          console.log(`✅ Migrated reservation ${supabaseRes.confirmation_number}`);
        } else {
          failed++;
          console.error(`❌ Failed to migrate reservation ${supabaseRes.confirmation_number}`);
        }
      } catch (err) {
        failed++;
        console.error(`❌ Error migrating reservation:`, err);
      }
    }
    
    console.log(`🎉 Migration complete: ${migrated} migrated, ${failed} failed`);
    alert(`Migration complete!\n\n✅ Migrated: ${migrated}\n❌ Failed: ${failed}\n\nRefresh the page to see migrated data.`);
  } catch (error) {
    console.error('❌ Migration error:', error);
    alert('Migration failed: ' + error.message);
  }
};

// Also expose for accounts
window.migrateAccountsToSupabase = async function() {
  console.log('🔄 Starting accounts migration...');
  
  try {
    const localAccounts = JSON.parse(localStorage.getItem('relia_accounts') || '[]');
    console.log(`📂 Found ${localAccounts.length} accounts in localStorage`);
    
    if (localAccounts.length === 0) {
      alert('No accounts found in localStorage to migrate.');
      return;
    }
    
    let migrated = 0;
    let failed = 0;
    
    for (const acc of localAccounts) {
      try {
        const result = await db.saveAccount(acc);
        if (result && result.success) {
          migrated++;
          console.log(`✅ Migrated account ${acc.account_number || acc.id}`);
        } else {
          failed++;
        }
      } catch (err) {
        failed++;
        console.error(`❌ Error migrating account:`, err);
      }
    }
    
    console.log(`🎉 Accounts migration complete: ${migrated} migrated, ${failed} failed`);
    alert(`Accounts migration complete!\n\n✅ Migrated: ${migrated}\n❌ Failed: ${failed}`);
  } catch (error) {
    console.error('❌ Accounts migration error:', error);
    alert('Migration failed: ' + error.message);
  }
};

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

const FARMOUT_RECOGNIZED_STATUSES = new Set([
  'unassigned',
  'offered',
  'offered_to_affiliate',
  'assigned',
  'affiliate_assigned',
  'affiliate_driver_assigned',
  'declined',
  'enroute',
  'driver_en_route',
  'on_the_way',
  'arrived',
  'passenger_onboard',
  'driver_waiting_at_pickup',
  'waiting_at_pickup',
  'driver_circling',
  'customer_in_car',
  'driving_passenger',
  'completed',
  'cancelled',
  'cancelled_by_affiliate',
  'late_cancel',
  'late_cancelled',
  'no_show',
  'covid19_cancellation'
]);

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

function isFarmOutStatus(status) {
  const canonical = canonicalizeFarmoutStatus(status);
  return FARMOUT_RECOGNIZED_STATUSES.has(canonical);
}

class LimoReservationSystem {
  constructor() {
    this.reservationManager = new ReservationManager();
    this.mapManager = new MapManager();
    this.uiManager = new UIManager(this.reservationManager, this.mapManager);
    this.mapboxService = new MapboxService();
    this.driverTracker = new DriverTracker();
    this.farmoutAutomationService = new FarmoutAutomationService({
      reservationManager: this.reservationManager,
      driverTracker: this.driverTracker,
      uiManager: this.uiManager
    });
    this.uiManager.setAutomationService(this.farmoutAutomationService);
    this.pickupData = null;
    this.dropoffData = null;
    this.companyLocation = null;
    
    this.init();
  }

  shouldNavigateToStartupPage() {
    // Only navigate from index.html, index-reservations.html, or root path
    const currentPath = (window.location.pathname || '').toLowerCase();
    let currentFile = currentPath.split('/').pop() || '';
    
    // Remove .html extension for comparison
    if (currentFile.endsWith('.html')) {
      currentFile = currentFile.replace('.html', '');
    }
    
    console.log('[StartupPage] ========== CHECKING STARTUP PAGE NAVIGATION ==========');
    console.log('[StartupPage] Path check - currentPath:', currentPath, 'currentFile (normalized):', currentFile);
    
    // Valid entry points for startup page navigation (normalized without .html)
    const validEntryPoints = ['index', 'index-reservations', ''];
    const isValidEntry = validEntryPoints.includes(currentFile) || !currentFile;
    console.log('[StartupPage] Is valid entry point?', isValidEntry);
    
    if (!isValidEntry) {
      console.log('[StartupPage] Not on a valid entry point, skipping navigation');
      return false;
    }

    // Check for startup page setting
    try {
      if (!window.CompanySettingsManager) {
        console.log('[StartupPage] CompanySettingsManager not available yet');
        return false;
      }

      console.log('[StartupPage] ===== LOADING SETTINGS =====');
      console.log('[StartupPage] CompanySettingsManager available, creating instance');
      const settingsManager = new window.CompanySettingsManager();
      const startPage = settingsManager.getSetting('defaultStartPage');
      console.log('[StartupPage] Raw getSetting(\"defaultStartPage\"):', startPage);
      console.log('[StartupPage] Type:', typeof startPage);
      const finalPage = startPage || 'reservations';
      console.log('[StartupPage] After fallback:', finalPage);
      
      console.log('[StartupPage] Current entry point:', currentFile || 'root');
      console.log('[StartupPage] Default start page setting:', startPage);
      console.log('[StartupPage] All stored settings:', settingsManager.getAllSettings());

      // Map setting values to routes
      const STARTUP_ROUTES = {
        'new-reservation': 'reservation-form.html',
        'farmout-dashboard': 'dashboard.html',
        'office': 'my-office.html',
        'accounts': 'accounts.html',
        'calendar': 'calendar.html',
        'quotes': 'quotes.html',
        'reservations': 'index-reservations.html',
        'dispatch': 'dispatch-grid.html',
        'network': 'network.html',
        'settle': 'settle.html',
        'receivables': 'receivables.html',
        'payables': 'payables.html',
        'memos': 'memos.html',
        'files': 'files.html',
        'tools': 'tools.html',
        'reports': 'reports.html'
      };

      const route = STARTUP_ROUTES[finalPage];
      console.log('[StartupPage] ===== ROUTE LOOKUP =====');
      console.log('[StartupPage] Looking up route for:', finalPage);
      console.log('[StartupPage] Available routes:', Object.keys(STARTUP_ROUTES));
      console.log('[StartupPage] Route lookup result:', route);
      
      // If the current file matches the startup page route, don't navigate
      if (route && !currentFile.includes(route.replace('.html', ''))) {
        console.log('[StartupPage] ✅ Navigating to startup page:', route);
        window.location.href = route;
        return true;
      }
      
      console.log('[StartupPage] Already on startup page or staying on current entry point');
      return false;
    } catch (error) {
      console.error('[StartupPage] Error checking startup page:', error);
      return false;
    }
  }

  persistFarmoutSnapshot() {
    try {
      const reservations = this.reservationManager.getAllReservations();
      const assignments = reservations
        .filter(reservation => {
          const status = canonicalizeFarmoutStatus(
            reservation.farmoutStatus ||
            reservation.farmout_status ||
            reservation.statusDetailCode ||
            reservation.status_detail_code ||
            reservation.efarm_status ||
            reservation.form_snapshot?.details?.efarmStatus ||
            reservation.form_snapshot?.details?.efarm_status ||
            ''
          );
          const hasDriver = Boolean(
            reservation.driverSnapshot?.name ||
            reservation.driverName ||
            reservation.driverId
          );
          return hasDriver && status && status !== 'unassigned';
        })
        .map(reservation => {
          const driverSource = reservation.driverSnapshot || {};
          const driverId = driverSource.id ?? reservation.driverId ?? null;
          const driverName = driverSource.name || reservation.driverName || '';
          const driverAffiliate = driverSource.affiliate || reservation.affiliateName || '';
          const driverPhone = driverSource.phone || reservation.driverPhone || '';
          const driverVehicle = driverSource.vehicleType || reservation.vehicleType || '';
          const farmoutStatus = canonicalizeFarmoutStatus(
            reservation.farmoutStatus ||
            reservation.farmout_status ||
            reservation.efarm_status ||
            reservation.form_snapshot?.details?.efarmStatus ||
            ''
          ) || 'assigned';
          const farmoutMode = canonicalizeFarmoutMode(
            reservation.farmoutMode ||
            reservation.farmout_mode ||
            reservation.form_snapshot?.details?.farmoutMode ||
            'manual'
          );
          const assignment = {
            reservationId: String(reservation.id),
            confirmationNumber: reservation.confirmationNumber ? String(reservation.confirmationNumber) : String(reservation.id),
            passengerName: reservation.passengerName || '',
            pickupDate: reservation.pickupDate || '',
            pickupTime: reservation.pickupTime || '',
            farmoutStatus,
            farmoutMode,
            driver: {
              id: driverId,
              name: driverName,
              affiliate: driverAffiliate,
              phone: driverPhone,
              vehicleType: driverVehicle
            },
            updatedAt: new Date().toISOString()
          };

          if (this.uiManager?.buildTripLink) {
            assignment.tripLink = this.uiManager.buildTripLink(reservation, driverSource);
          }

          return assignment;
        });

      localStorage.setItem('relia_farmout_assignments', JSON.stringify(assignments));
    } catch (error) {
      console.warn('Unable to persist farm-out assignments:', error);
    }
  }

  async findReservationRecord(reservation) {
    try {
      if (!reservation || !db || typeof db.getAllReservations !== 'function') {
        return null;
      }

      const candidates = new Set();
      const addCandidate = (value) => {
        if (value === undefined || value === null) {
          return;
        }
        const str = String(value).trim();
        if (str) {
          candidates.add(str);
        }
      };

      addCandidate(reservation.confirmationNumber);
      addCandidate(reservation.confirmation_number);
      addCandidate(reservation.id);
      addCandidate(reservation.raw?.confirmation_number);
      addCandidate(reservation.raw?.id);

      if (candidates.size === 0) {
        return null;
      }

      const allReservations = await db.getAllReservations();
      if (!Array.isArray(allReservations) || allReservations.length === 0) {
        return null;
      }

      return allReservations.find(record => {
        const idStr = record?.id !== undefined && record?.id !== null ? String(record.id).trim() : '';
        const confStr = record?.confirmation_number !== undefined && record?.confirmation_number !== null
          ? String(record.confirmation_number).trim()
          : '';
        return (idStr && candidates.has(idStr)) || (confStr && candidates.has(confStr));
      }) || null;
    } catch (error) {
      console.warn('findReservationRecord failed:', error);
      return null;
    }
  }

  async syncFarmoutToStorage(reservation) {
    try {
      if (!reservation) {
        return;
      }

      const record = await this.findReservationRecord(reservation);
      if (!record) {
        return;
      }

      const canonicalStatus = canonicalizeFarmoutStatus(
        reservation.farmoutStatus ||
        reservation.farmout_status ||
        reservation.efarm_status ||
        record.farmout_status ||
        record.efarm_status ||
        ''
      ) || 'unassigned';

      const statusLabel = this.uiManager?.formatFarmoutStatus
        ? this.uiManager.formatFarmoutStatus(canonicalStatus)
        : canonicalStatus.split(/[_\-\s]+/).filter(Boolean).map(segment => segment.charAt(0).toUpperCase() + segment.slice(1)).join(' ');

      const canonicalMode = canonicalizeFarmoutMode(
        reservation.farmoutMode ||
        reservation.farmout_mode ||
        record.farmout_mode ||
        record.efarm_out_selection ||
        reservation.form_snapshot?.details?.farmoutMode ||
        'manual'
      );

      record.farmout_status = canonicalStatus;
      record.farmoutStatus = canonicalStatus;
      record.efarm_status = statusLabel;
      record.efarmStatus = statusLabel;
      record.farmout_mode = canonicalMode;
      record.farmoutMode = canonicalMode;
      record.efarm_out_selection = canonicalMode;
      record.eFarmOut = canonicalMode;

      if (record.form_snapshot && typeof record.form_snapshot === 'object') {
        const details = record.form_snapshot.details = record.form_snapshot.details || {};
        details.efarmStatus = statusLabel;
        details.eFarmStatus = statusLabel;
        details.farmoutStatusCanonical = canonicalStatus;
        details.eFarmOut = canonicalMode;
        details.farmoutMode = canonicalMode;
      }

      await db.saveReservation(record);
    } catch (error) {
      console.warn('syncFarmoutToStorage failed:', error);
    }
  }

  /**
   * Purge ghost reservations that don't belong to the current organization.
   * This runs once on startup to clean any leaked data from other orgs.
   */
  purgeGhostReservations() {
    try {
      const STORAGE_KEY = 'relia_reservations';
      const PURGE_FLAG = 'relia_ghost_purge_v1';
      
      // Only run once per session
      if (sessionStorage.getItem(PURGE_FLAG)) {
        return;
      }
      
      // Get current organization ID
      const orgId = window.SUPABASE_UUID || 
                    localStorage.getItem('organization_id') || 
                    sessionStorage.getItem('organization_id');
      
      if (!orgId) {
        console.log('[GhostPurge] No organization ID found, skipping purge');
        return;
      }
      
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        sessionStorage.setItem(PURGE_FLAG, 'done');
        return;
      }
      
      let reservations = JSON.parse(stored);
      if (!Array.isArray(reservations)) {
        sessionStorage.setItem(PURGE_FLAG, 'done');
        return;
      }
      
      const originalCount = reservations.length;
      
      // Filter to only keep reservations matching current org
      reservations = reservations.filter(r => {
        const resOrgId = r.organization_id || r.org_id;
        // Keep if no org ID (legacy) or matches current org
        return !resOrgId || resOrgId === orgId;
      });
      
      const purgedCount = originalCount - reservations.length;
      
      if (purgedCount > 0) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(reservations));
        console.log(`[GhostPurge] Removed ${purgedCount} ghost reservations from other organizations`);
      }
      
      sessionStorage.setItem(PURGE_FLAG, 'done');
    } catch (error) {
      console.warn('[GhostPurge] Error during purge:', error);
    }
  }

  async init() {
    // One-time purge of ghost reservations from other organizations
    this.purgeGhostReservations();

    // Skip startup page redirect to keep users on the current page

    // Initialize UI
    this.uiManager.init();
    
    // Get company location from zip code
    await this.getCompanyLocation();
    
    // Initialize maps with company location from settings (no hardcoded fallback)
    const center = this.companyLocation || window.COMPANY_CENTER || null;
    if (center) {
      this.mapManager.initUserMap('userMap', center);
      this.mapManager.initDriverMap('driverMap', center);
      this.driverTracker.setBaseLocation(center);
    } else {
      console.warn('No company location configured. Please set address in My Office > Company Settings.');
      // Initialize with null - maps will show world view until location is set
      this.mapManager.initUserMap('userMap', [0, 0]);
      this.mapManager.initDriverMap('driverMap', [0, 0]);
    }
    
    // Load initial data (will use company location)
    await this.loadInitialData();

    // Setup real-time subscription for instant farmout updates
    await this.setupRealtimeSubscription();

    this.farmoutAutomationService.init();
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Setup address autocomplete
    this.setupAddressAutocomplete();
    
    // Start driver tracking (async - fetches from API if needed)
    await this.startDriverTracking();
    
    // Start auto-update
    this.startAutoUpdate();
    
    // Handle URL parameters for view switching
    this.handleURLParameters();

    window.addEventListener('storage', (event) => {
      if (!event) return;
      if (event.key === 'relia_reservations') {
        this.updateListViewsFromDb();
      } else if (event.key === 'relia_driver_status_overrides') {
        this.driverTracker.applyStatusOverrides();
        const drivers = this.driverTracker.getAllDrivers();
        this.mapManager.updateLiveDrivers(drivers);
        this.updateDriverStatusPanel(drivers);
        this.uiManager.updateDriverDirectory(drivers);
      } else if (event.key === 'relia_trip_status_update') {
        this.applyDriverTripStatusUpdate();
      }
    });

    this.applyDriverTripStatusUpdate();
  }

  applyDriverTripStatusUpdate() {
    try {
      const raw = localStorage.getItem('relia_trip_status_update');
      if (!raw) return;
      const update = JSON.parse(raw);
      const reservationId = update?.reservationId;
      if (!reservationId || !update.status) return;

      const reservation = this.reservationManager.getReservationById(reservationId);
      if (!reservation) return;

      const newStatus = update.status;
      this.reservationManager.updateFarmoutStatus(reservationId, newStatus);

      if (newStatus === 'completed') {
        this.reservationManager.completeReservation(reservationId);
      } else {
        this.reservationManager.updateReservation(reservationId, { status: 'accepted' });
      }

      const driverStatusMap = {
        enroute: 'enroute',
        arrived: 'arrived',
        passenger_onboard: 'passenger_onboard',
        completed: 'available'
      };
      if (update.driverId) {
        const driverIdNum = parseInt(update.driverId, 10);
        const mapped = driverStatusMap[newStatus];
        if (!Number.isNaN(driverIdNum) && mapped) {
          this.driverTracker.updateDriverStatus(driverIdNum, mapped);
        }
      }

      this.uiManager.logFarmoutActivity(reservationId, `Driver updated status to ${newStatus.toUpperCase()}`);
      const updatedReservation = this.reservationManager.getReservationById(reservationId);
      this.uiManager.updateFarmoutState(updatedReservation);
      this.uiManager.updateDriverDirectory(this.driverTracker.getAllDrivers());
      this.mapManager.addUserMapMarkers(this.reservationManager.getAllReservations());
      this.mapManager.addDriverMapMarkers(this.reservationManager.getAllReservations());
      this.persistFarmoutSnapshot();
    } catch (error) {
      console.warn('Unable to apply trip status update:', error);
    }
  }
  
  handleURLParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    const view = urlParams.get('view');
    
    if (view === 'user') {
      this.uiManager.switchView('userView');
    } else if (view === 'driver') {
      this.uiManager.switchView('driverView');
    } else if (view === 'reservations') {
      this.uiManager.switchView('farm-out_reservations_View');
    }
  }

  async getCompanyLocation() {
    try {
      // First check if COMPANY_CENTER was already set from localStorage lat/lng
      if (window.COMPANY_CENTER && Array.isArray(window.COMPANY_CENTER) && window.COMPANY_CENTER.length === 2) {
        this.companyLocation = window.COMPANY_CENTER;
        console.log('✓ Company location from saved settings:', this.companyLocation);
        return;
      }
      
      // Build location query from globals injected by index-reservations.html
      const companyZip = (window.COMPANY_ZIP_CODE || '').toString().trim();
      const cityState = (window.COMPANY_LOCATION_QUERY || '').toString().trim();
      const locationQuery = cityState || companyZip;
      
      if (!locationQuery) {
        console.warn('No company location configured. Please set address in My Office > Company Settings.');
        this.companyLocation = null;
        return;
      }
      
      console.log('Geocoding company location:', { locationQuery, companyZip, cityState });
      
      // Geocode the city/state or zip code to get coordinates
      const results = await this.mapboxService.geocodeAddress(locationQuery);
      
      if (results && results.length > 0) {
        // Convert from [lng, lat] to [lat, lng] for Leaflet
        this.companyLocation = [results[0].coordinates[1], results[0].coordinates[0]];
        console.log('✓ Company location geocoded to:', this.companyLocation, '(' + locationQuery + ')');
        window.COMPANY_CENTER = this.companyLocation;
      } else {
        console.warn('No geocoding results for company location query:', locationQuery);
        this.companyLocation = null;
      }
    } catch (error) {
      console.error('Error getting company location:', error);
      this.companyLocation = null;
    }
  }

  async startDriverTracking() {
    // Start tracking drivers and update map with their positions
    await this.driverTracker.startTracking((drivers) => {
      this.mapManager.updateLiveDrivers(drivers);
      this.updateDriverStatusPanel(drivers);
      this.uiManager.updateDriverDirectory(drivers);
    });
  }

  // Refresh drivers from API
  async refreshDrivers() {
    await this.driverTracker.refreshDrivers();
  }

  updateDriverStatusPanel(drivers) {
    const driverCountEl = document.getElementById('driverCount');
    const driverListEl = document.getElementById('driverStatusList');
    
    if (!driverCountEl || !driverListEl) return;
    
    // Update count
    const availableCount = drivers.filter(d => d.status === 'available').length;
    driverCountEl.textContent = availableCount;
    
    const formatStatusLabel = (status) => {
      if (!status) return '';
      return status
        .split('_')
        .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join(' ');
    };
    
    const formatPhone = (phone) => {
      if (!phone) return '';
      const digits = phone.replace(/\D/g, '');
      if (digits.length === 10) {
        return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
      }
      return phone;
    };

    // Update list
    driverListEl.innerHTML = drivers.map(driver => {
      const statusEmoji = {
        'available': '🟢',
        'enroute': '🟡',
        'arrived': '🟠',
        'passenger_onboard': '🔵',
        'busy': '🔴',
        'offline': '⚫'
      }[driver.status] || '🟢';
      const statusLabel = formatStatusLabel(driver.status);
      const noteLine = driver.notes ? `<div class="driver-status-note">${driver.notes}</div>` : '';
      const phoneLine = driver.phone ? `<div class="driver-status-phone">📱 ${formatPhone(driver.phone)}</div>` : '';
      const affiliateLine = driver.affiliate && driver.affiliate !== 'RELIA Fleet' ? `<div class="driver-status-affiliate">🏢 ${driver.affiliate}</div>` : '';
      
      return `
        <div class="driver-status-item ${driver.status}" data-driver-id="${driver.id}">
          <span class="driver-status-icon">${statusEmoji}</span>
          <div class="driver-status-info">
            <div class="driver-status-name">${driver.name}</div>
            <div class="driver-status-details">${driver.vehicle} • ${statusLabel}</div>
            ${phoneLine}
            ${affiliateLine}
            ${noteLine}
          </div>
        </div>
      `;
    }).join('');
    
    // Add click handlers to show directions
    driverListEl.querySelectorAll('.driver-status-item').forEach(item => {
      item.addEventListener('click', async () => {
        const driverId = parseInt(item.dataset.driverId);
        await this.showDriverDirections(driverId, drivers);
      });
    });
  }

  async showDriverDirections(driverId, drivers) {
    const driver = drivers.find(d => d.id === driverId);
    if (!driver || !this.mapManager.userMap) return;

    // Get a nearby reservation (for demo, get first pending reservation)
    const reservations = this.reservationManager.getAllReservations();
    const targetReservation = reservations.find(r => r.status === 'pending' || r.status === 'accepted');
    
    if (!targetReservation || !targetReservation.pickupCoords) {
      // Just focus on driver if no target
      this.mapManager.userMap.setView(driver.position, 15);
      const markerId = `user-${driver.id}`;
      const marker = this.mapManager.liveDriverMarkers.get(markerId);
      if (marker) {
        marker.openPopup();
      }
      return;
    }

    try {
      // Get route from driver to pickup location
      // Convert from [lat, lng] to [lng, lat] for Mapbox
      const driverCoords = [driver.position[1], driver.position[0]];
      const pickupCoords = [targetReservation.pickupCoords[1], targetReservation.pickupCoords[0]];
      
      const routeData = await this.mapboxService.getRoute([driverCoords, pickupCoords]);
      
      // Display route on map
      this.mapManager.showDriverRoute(routeData, driver.position, targetReservation.pickupCoords);
      
      // Focus on driver and show route info
      const markerId = `user-${driver.id}`;
      const marker = this.mapManager.liveDriverMarkers.get(markerId);
      if (marker) {
        marker.setPopupContent(`
          <div class="popup-content">
            <div class="popup-title">🚗 ${driver.name}</div>
            <div class="popup-info">
              <div class="popup-field">
                <span class="popup-label">Status:</span>
                <span class="popup-value" style="color: #4caf50; font-weight: 600;">
                  ${driver.status.charAt(0).toUpperCase() + driver.status.slice(1)}
                </span>
              </div>
              <div class="popup-field">
                <span class="popup-label">Vehicle:</span>
                <span class="popup-value">${driver.vehicle}</span>
              </div>
              <div class="popup-field">
                <span class="popup-label">To Pickup:</span>
                <span class="popup-value" style="font-weight: 600; color: #2196f3;">${routeData.distance}</span>
              </div>
              <div class="popup-field">
                <span class="popup-label">ETA:</span>
                <span class="popup-value" style="font-weight: 600; color: #2196f3;">${routeData.duration}</span>
              </div>
            </div>
          </div>
        `);
        marker.openPopup();
      }
    } catch (error) {
      console.error('Error showing driver directions:', error);
      // Fallback to just focusing on driver
      this.mapManager.userMap.setView(driver.position, 15);
    }
  }

  async loadInitialData() {
    await this.updateListViewsFromDb();

    // Use company location from settings (no hardcoded fallback)
    const center = this.companyLocation || window.COMPANY_CENTER || null;
    await this.loadReservationsFromStorage();

    // REMOVED: Sample reservation seeding - production apps should not seed demo data
    // Sample data was causing ghost reservations to appear in the farmout dashboard

    // Update all views
    this.uiManager.updateAllViews();
    this.persistFarmoutSnapshot();
  }

  async setupRealtimeSubscription() {
    try {
      await realtimeService.init();
      
      this.unsubscribeRealtime = subscribeToReservations((eventType, newRecord, oldRecord) => {
        console.log(`[Main] Real-time ${eventType}:`, newRecord?.confirmation_number || oldRecord?.confirmation_number);
        
        // Check if this is a new assignment (INSERT or UPDATE with driver assigned)
        if (eventType === 'INSERT' || eventType === 'UPDATE') {
          this.checkForNewAssignment(eventType, newRecord, oldRecord);
        }
        
        // Reload all views on any change for instant updates
        this.updateListViewsFromDb();
      });
      
      console.log('[Main] Real-time subscription active for instant farmout updates');
    } catch (err) {
      console.error('[Main] Failed to set up real-time subscription:', err);
    }
  }

  checkForNewAssignment(eventType, newRecord, oldRecord) {
    if (!newRecord) return;
    
    const confNumber = newRecord.confirmation_number || newRecord.id;
    const driverId = newRecord.driver_id || newRecord.form_snapshot?.details?.driverId;
    const driverName = newRecord.driver_name || newRecord.form_snapshot?.details?.driverName;
    const farmoutStatus = newRecord.farmout_status || '';
    
    // Check if this is a new assignment
    const wasAssigned = eventType === 'UPDATE' && oldRecord && 
                        !oldRecord.driver_id && !oldRecord.form_snapshot?.details?.driverId;
    const isNewlyAssigned = eventType === 'INSERT' || wasAssigned;
    const hasDriver = driverId || driverName;
    const isAssignedStatus = farmoutStatus === 'assigned' || farmoutStatus === 'farmout_assigned';
    
    if (isNewlyAssigned && (hasDriver || isAssignedStatus)) {
      // Get passenger name for display
      const passengerFirst = newRecord.lead_passenger_first_name || 
                             newRecord.form_snapshot?.passenger?.firstName || '';
      const passengerLast = newRecord.lead_passenger_last_name || 
                            newRecord.form_snapshot?.passenger?.lastName || '';
      const passengerName = `${passengerFirst} ${passengerLast}`.trim() || 'Guest';
      
      // Get pickup date/time
      const pickupDate = newRecord.form_snapshot?.details?.puDate || '';
      const pickupTime = newRecord.form_snapshot?.details?.puTime || '';
      
      this.showTripAssignmentNotification({
        confNumber,
        passengerName,
        driverName: driverName || 'Driver',
        pickupDate,
        pickupTime
      });
    }
  }

  showTripAssignmentNotification({ confNumber, passengerName, driverName, pickupDate, pickupTime }) {
    // Remove any existing notification
    const existing = document.getElementById('tripAssignmentNotification');
    if (existing) existing.remove();
    
    // Create notification container
    const notification = document.createElement('div');
    notification.id = 'tripAssignmentNotification';
    notification.className = 'trip-assignment-notification';
    
    // Format the date/time display
    let dateTimeDisplay = '';
    if (pickupDate) {
      const dateObj = new Date(pickupDate + (pickupTime ? 'T' + pickupTime : ''));
      if (!isNaN(dateObj.getTime())) {
        dateTimeDisplay = dateObj.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit'
        });
      } else {
        dateTimeDisplay = pickupDate + (pickupTime ? ' ' + pickupTime : '');
      }
    }
    
    notification.innerHTML = `
      <div class="notification-icon">🚗</div>
      <div class="notification-content">
        <div class="notification-title">New Trip Assigned!</div>
        <div class="notification-details">
          <strong>Conf #${confNumber}</strong><br>
          ${passengerName}${dateTimeDisplay ? ` • ${dateTimeDisplay}` : ''}
        </div>
      </div>
      <div class="notification-actions">
        <button class="btn-view-reservation" onclick="window.openReservationFromNotification('${confNumber}')">View Reservation</button>
        <button class="btn-view-later" onclick="document.getElementById('tripAssignmentNotification').remove()">Later</button>
      </div>
      <button class="notification-close" onclick="document.getElementById('tripAssignmentNotification').remove()">×</button>
    `;
    
    // Add styles if not already present
    if (!document.getElementById('tripNotificationStyles')) {
      const style = document.createElement('style');
      style.id = 'tripNotificationStyles';
      style.textContent = `
        .trip-assignment-notification {
          position: fixed;
          top: 20px;
          right: 20px;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          border: 1px solid #00d4ff;
          border-radius: 12px;
          padding: 16px 20px;
          display: flex;
          align-items: flex-start;
          gap: 12px;
          box-shadow: 0 8px 32px rgba(0, 212, 255, 0.3), 0 0 0 1px rgba(0, 212, 255, 0.1);
          z-index: 10000;
          max-width: 420px;
          animation: slideInRight 0.4s ease-out;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        
        @keyframes slideInRight {
          from { transform: translateX(120%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        
        .notification-icon {
          font-size: 32px;
          line-height: 1;
        }
        
        .notification-content {
          flex: 1;
        }
        
        .notification-title {
          color: #00d4ff;
          font-weight: 600;
          font-size: 15px;
          margin-bottom: 6px;
        }
        
        .notification-details {
          color: #e0e0e0;
          font-size: 13px;
          line-height: 1.4;
        }
        
        .notification-actions {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-left: 8px;
        }
        
        .btn-view-reservation {
          background: linear-gradient(135deg, #00d4ff 0%, #0099cc 100%);
          color: #000;
          border: none;
          padding: 8px 14px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.2s;
        }
        
        .btn-view-reservation:hover {
          background: linear-gradient(135deg, #33ddff 0%, #00b3e6 100%);
          transform: translateY(-1px);
        }
        
        .btn-view-later {
          background: transparent;
          color: #888;
          border: 1px solid #444;
          padding: 6px 14px;
          border-radius: 6px;
          font-size: 11px;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .btn-view-later:hover {
          border-color: #666;
          color: #aaa;
        }
        
        .notification-close {
          position: absolute;
          top: 8px;
          right: 8px;
          background: none;
          border: none;
          color: #666;
          font-size: 18px;
          cursor: pointer;
          padding: 0;
          line-height: 1;
          width: 20px;
          height: 20px;
        }
        
        .notification-close:hover {
          color: #fff;
        }
      `;
      document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    // Play notification sound if available
    try {
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleP8Xt9T3zqpwHQNKl8jWu3gtAEqPwdfGs1oAAEOJv9nJt1cAADyFvNrLt1MAADJ/udnPt1EAADCBud3Ruks=');
      audio.volume = 0.3;
      audio.play().catch(() => {});
    } catch (e) {}
    
    // Auto-dismiss after 15 seconds
    setTimeout(() => {
      const notif = document.getElementById('tripAssignmentNotification');
      if (notif) {
        notif.style.animation = 'slideInRight 0.3s ease-out reverse forwards';
        setTimeout(() => notif.remove(), 300);
      }
    }, 15000);
  }

  async loadReservationsFromStorage() {
    try {
      if (!db || typeof db.getAllReservations !== 'function') {
        return 0;
      }

      const rawReservations = await db.getAllReservations() || [];
      if (!Array.isArray(rawReservations) || rawReservations.length === 0) {
        return 0;
      }

      const canonicalReservations = rawReservations
        .map(reservation => this.transformReservationForManager(reservation))
        .filter(Boolean);

      if (!canonicalReservations.length) {
        return 0;
      }

      this.reservationManager.reservations = [];
      this.reservationManager.nextId = 1;

      let highestId = 0;
      canonicalReservations.forEach(reservation => {
        this.reservationManager.addReservation(reservation);
        const numericId = Number(reservation.id || reservation.confirmationNumber || reservation.confirmation_number);
        if (Number.isFinite(numericId)) {
          highestId = Math.max(highestId, numericId);
        }
      });

      if (highestId >= this.reservationManager.nextId) {
        this.reservationManager.nextId = highestId + 1;
      }

      console.log(`[LiveReservations] Loaded ${canonicalReservations.length} reservation(s) from storage`);
      return canonicalReservations.length;
    } catch (error) {
      console.warn('Unable to load live reservations from storage:', error);
      return 0;
    }
  }

  // REMOVED: seedSampleReservations - demo seeding caused ghost entries in production
  // If demo mode is needed in the future, it should be behind an explicit flag
  seedSampleReservations(center) {
    console.log('[LiveReservations] Sample reservation seeding is disabled in production mode');
    // No-op: sample data seeding has been disabled to prevent ghost reservations
  }

  setupEventListeners() {
    // View switching
    const userViewBtn = document.getElementById('userViewBtn');
    if (userViewBtn) {
      userViewBtn.addEventListener('click', () => {
        this.uiManager.switchView('userView');
      });
    }

    const driverViewBtn = document.getElementById('driverViewBtn');
    if (driverViewBtn) {
      driverViewBtn.addEventListener('click', () => {
        this.uiManager.switchView('driverView');
      });
    }

    // Reservations button - always navigate to reservations list
    const reservationsBtn = document.getElementById('reservationsBtn');
    if (reservationsBtn) {
      reservationsBtn.addEventListener('click', () => {
        // Check if we're in an iframe, if so tell parent to switch to reservations
        if (window.self !== window.top) {
          window.parent.postMessage({ action: 'switchSection', section: 'reservations' }, '*');
        } else {
          // Navigate directly to reservations list
          window.location.href = 'reservations-list.html';
        }
      });
    }

    const farmOutBtn = document.getElementById('farmOutBtn');
    if (farmOutBtn) {
      farmOutBtn.addEventListener('click', () => {
        // Switch to the farm-out reservations view (dark table)
        this.uiManager.switchView('farm-out_reservations_View');
        this.uiManager.hideFarmoutToolShell();
      });
    }

    // Availability Console tab
    const availabilityBtn = document.getElementById('availabilityBtn');
    if (availabilityBtn) {
      availabilityBtn.addEventListener('click', () => {
        this.uiManager.switchView('availabilityView');
      });
    }

    // Active Drivers tab
    const activeDriversBtn = document.getElementById('activeDriversBtn');
    if (activeDriversBtn) {
      activeDriversBtn.addEventListener('click', () => {
        this.uiManager.switchView('activeDriversView');
      });
    }

    // Trip Monitor tab
    const tripMonitorBtn = document.getElementById('tripMonitorBtn');
    if (tripMonitorBtn) {
      tripMonitorBtn.addEventListener('click', () => {
        this.uiManager.switchView('tripMonitorView');
      });
    }

    // Reservations Iframe tab
    const reservationsIframeBtn = document.getElementById('reservationsIframeBtn');
    if (reservationsIframeBtn) {
      reservationsIframeBtn.addEventListener('click', () => {
        this.uiManager.switchView('reservationsIframeView');
      });
    }

    // Form submission
    const reservationForm = document.getElementById('reservationForm');
    if (reservationForm) {
      reservationForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleNewReservation();
      });
    }

    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const bar = e.target.closest('.filter-bar');
        if (bar) {
          bar.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        }
        e.target.classList.add('active');
        const filter = e.target.dataset.filter || 'all';
        const context = bar?.dataset.context === 'farmout' ? 'farmout' : 'reservations';
        this.uiManager.filterReservations(filter, context);
      });
    });

    // Map view selectors
    const userMapView = document.getElementById('userMapView');
    if (userMapView) {
      userMapView.addEventListener('change', (e) => {
        this.mapManager.changeMapLayer(e.target.value, 'user');
      });
    }

    const driverMapView = document.getElementById('driverMapView');
    if (driverMapView) {
      driverMapView.addEventListener('change', (e) => {
        this.mapManager.changeMapLayer(e.target.value, 'driver');
      });
    }

    window.addEventListener('reservationFarmoutUpdated', (event) => {
      if (!event || !event.detail) return;
      const { reservation, type, previousDriverId } = event.detail;
      if (!reservation) return;

      if (type === 'farmoutDriverAssigned' && reservation.driverId) {
        const driverIdNum = parseInt(reservation.driverId, 10);
        if (!Number.isNaN(driverIdNum)) {
          this.driverTracker.assignDriver(driverIdNum, reservation.id);
        }
      }

      if (type === 'farmoutDriverCleared' && previousDriverId) {
        const driverIdNum = parseInt(previousDriverId, 10);
        if (!Number.isNaN(driverIdNum)) {
          this.driverTracker.updateDriverStatus(driverIdNum, 'available');
        }
      }

      this.uiManager.updateFarmoutState(reservation);
      this.uiManager.updateDriverDirectory(this.driverTracker.getAllDrivers());
      this.mapManager.addUserMapMarkers(this.reservationManager.getAllReservations());
      this.mapManager.addDriverMapMarkers(this.reservationManager.getAllReservations());
      this.syncFarmoutToStorage(reservation);
      this.persistFarmoutSnapshot();
    });

    // Refresh drivers button
    const refreshDriversBtn = document.getElementById('refreshDriversBtn');
    if (refreshDriversBtn) {
      refreshDriversBtn.addEventListener('click', async () => {
        refreshDriversBtn.classList.add('spinning');
        refreshDriversBtn.disabled = true;
        try {
          await this.refreshDrivers();
        } finally {
          refreshDriversBtn.classList.remove('spinning');
          refreshDriversBtn.disabled = false;
        }
      });
    }
  }

  setupAddressAutocomplete() {
    // Pickup location autocomplete
    const pickupInput = document.getElementById('pickupLocation');
    const pickupSuggestions = document.getElementById('pickupSuggestions');
    let pickupDebounceTimer;

    pickupInput.addEventListener('input', (e) => {
      clearTimeout(pickupDebounceTimer);
      const query = e.target.value;
      
      if (query.length < 3) {
        pickupSuggestions.classList.remove('active');
        return;
      }
      
      pickupDebounceTimer = setTimeout(async () => {
        await this.searchAddress(pickupInput, pickupSuggestions, 'pickup');
      }, 300);
    });

    pickupInput.addEventListener('blur', () => {
      setTimeout(() => pickupSuggestions.classList.remove('active'), 200);
    });

    // Dropoff location autocomplete
    const dropoffInput = document.getElementById('dropoffLocation');
    const dropoffSuggestions = document.getElementById('dropoffSuggestions');
    let dropoffDebounceTimer;

    dropoffInput.addEventListener('input', (e) => {
      clearTimeout(dropoffDebounceTimer);
      const query = e.target.value;
      
      if (query.length < 3) {
        dropoffSuggestions.classList.remove('active');
        return;
      }
      
      dropoffDebounceTimer = setTimeout(async () => {
        await this.searchAddress(dropoffInput, dropoffSuggestions, 'dropoff');
      }, 300);
    });

    dropoffInput.addEventListener('blur', () => {
      setTimeout(() => dropoffSuggestions.classList.remove('active'), 200);
    });
  }

  async searchAddress(inputElement, suggestionsContainer, type) {
    try {
      const results = await this.mapboxService.geocodeAddress(inputElement.value);
      this.showAddressSuggestions(inputElement, suggestionsContainer, results, type);
    } catch (error) {
      console.error('Address search error:', error);
    }
  }

  showAddressSuggestions(inputElement, suggestionsContainer, results, type) {
    if (!results || results.length === 0) {
      suggestionsContainer.classList.remove('active');
      return;
    }

    suggestionsContainer.innerHTML = results.map((result, index) => `
      <div class="address-suggestion-item" data-index="${index}">
        <div class="suggestion-main">${result.name}</div>
        <div class="suggestion-secondary">${result.address}</div>
      </div>
    `).join('');

    // Add click handlers
    suggestionsContainer.querySelectorAll('.address-suggestion-item').forEach((item, index) => {
      item.addEventListener('click', () => {
        this.selectAddress(inputElement, results[index], type);
        suggestionsContainer.classList.remove('active');
      });
    });

    suggestionsContainer.classList.add('active');
  }

  selectAddress(inputElement, addressData, type) {
    // Fill in the location field
    inputElement.value = addressData.name || addressData.address;
    
    // Store the full data
    if (type === 'pickup') {
      this.pickupData = addressData;
      // Fill pickup detail fields
      document.getElementById('pickupAddress').value = addressData.address || '';
      document.getElementById('pickupCity').value = addressData.context?.city || '';
      document.getElementById('pickupState').value = addressData.context?.state || '';
      document.getElementById('pickupZip').value = addressData.context?.postcode || '';
    } else {
      this.dropoffData = addressData;
      // Fill dropoff detail fields
      document.getElementById('dropoffAddress').value = addressData.address || '';
      document.getElementById('dropoffCity').value = addressData.context?.city || '';
      document.getElementById('dropoffState').value = addressData.context?.state || '';
      document.getElementById('dropoffZip').value = addressData.context?.postcode || '';
    }
  }

  handleNewReservation() {
    const form = document.getElementById('reservationForm');
    
    // Use stored coordinates from geocoding or generate random ones
    const pickupCoords = this.pickupData?.coordinates || [
      34.0522 + (Math.random() - 0.5) * 0.2,
      -118.2437 + (Math.random() - 0.5) * 0.2
    ];
    const dropoffCoords = this.dropoffData?.coordinates || [
      34.0522 + (Math.random() - 0.5) * 0.2,
      -118.2437 + (Math.random() - 0.5) * 0.2
    ];

    const firstName = document.getElementById('passengerFirstName').value;
    const lastName = document.getElementById('passengerLastName').value;
    const passengerName = `${firstName} ${lastName}`;

    const reservation = {
      passengerName: passengerName,
      phone: document.getElementById('phone').value,
      email: document.getElementById('email').value,
      pickupLocation: document.getElementById('pickupLocation').value,
      dropoffLocation: document.getElementById('dropoffLocation').value,
      pickupDate: document.getElementById('pickupDate').value,
      pickupTime: document.getElementById('pickupTime').value,
      vehicleType: document.getElementById('vehicleType').value,
      passengers: document.getElementById('passengers').value,
      specialInstructions: document.getElementById('specialInstructions').value,
      status: 'pending',
      pickupCoords,
      dropoffCoords
    };

    const createdReservation = this.reservationManager.addReservation(reservation);
    this.farmoutAutomationService.handleReservationCreated(createdReservation);
    this.uiManager.updateAllViews();
    this.persistFarmoutSnapshot();
    
    // Show success message
    alert('Reservation created successfully!');
    
    // Reset form and stored data
    form.reset();
    this.pickupData = null;
    this.dropoffData = null;
    
    // Clear address detail fields
    document.getElementById('pickupAddress').value = '';
    document.getElementById('pickupCity').value = '';
    document.getElementById('pickupState').value = '';
    document.getElementById('pickupZip').value = '';
    document.getElementById('dropoffAddress').value = '';
    document.getElementById('dropoffCity').value = '';
    document.getElementById('dropoffState').value = '';
    document.getElementById('dropoffZip').value = '';
  }

  startAutoUpdate() {
    // Periodic UI refresh every 30 seconds
    setInterval(() => {
      // Auto-update logic removed - no mock driver assignments
      // Real driver assignments should come from database updates
    }, 30000);
  }

  async updateListViewsFromDb() {
    try {
      if (!db || typeof db.getAllReservations !== 'function') {
        this.uiManager.renderReservationsFromDb([], []);
        return;
      }

      const rawReservations = await db.getAllReservations() || [];
      const mappedReservations = rawReservations
        .map(reservation => this.mapReservationForDashboard(reservation))
        .filter(Boolean);

      console.log('📦 [updateListViewsFromDb] Total mappedReservations:', mappedReservations.length);
      const farmOutReservations = mappedReservations.filter(item => {
        if (!item) return false;
        
        // A reservation should appear in farmout ONLY if farm_option is 'farm-out'
        // Radio button values are: 'in-house', 'farm-in', 'farm-out'
        const raw = item.raw || {};
        const farmOption = raw.farm_option || raw.farmOption || item.farmOption || '';
        const normalizedOption = normalizeFarmoutKey(farmOption);
        
        // Only farm-out (not farm-in, not in-house)
        const isFarmOut = normalizedOption === 'farm_out' || normalizedOption === 'farmout';
        
        // Also check form_snapshot for farmOption setting
        const snapshotFarmOption = raw.form_snapshot?.details?.farmOption || '';
        const normalizedSnapshot = normalizeFarmoutKey(snapshotFarmOption);
        const snapshotIsFarmOut = normalizedSnapshot === 'farm_out' || normalizedSnapshot === 'farmout';
        
        const isIncluded = isFarmOut || snapshotIsFarmOut;
        console.log(`📦 [farmout filter] Conf #${item.confirmationNumber}: farm_option="${farmOption}" -> normalized="${normalizedOption}" | snapshot="${snapshotFarmOption}" -> "${normalizedSnapshot}" | included=${isIncluded}`);
        
        return isIncluded;
      });
      console.log('📦 [updateListViewsFromDb] farmOutReservations count:', farmOutReservations.length);

      this.uiManager.renderReservationsFromDb(mappedReservations, farmOutReservations);
      this.persistFarmoutSnapshot();
    } catch (error) {
      console.error('Error updating reservation dashboards:', error);
      this.uiManager.renderReservationsFromDb([], []);
    }
  }

  mapReservationForDashboard(reservation) {
    if (!reservation || typeof reservation !== 'object') {
      return null;
    }

    const identifier = reservation.confirmation_number ?? reservation.id;
    if (identifier === undefined || identifier === null) {
      return null;
    }

    const { pickupStop, dropoffStop } = this.getReservationStops(reservation);

    const formatStop = (stop) => {
      if (!stop) return '';
      return stop.fullAddress || stop.address || stop.address1 || stop.locationName || stop.location || '';
    };

    const pickupLocation = formatStop(pickupStop) || reservation.pickup_address || 'Unknown Pickup';
    const dropoffLocation = formatStop(dropoffStop) || reservation.dropoff_address || 'Unknown Dropoff';
    const pickupCoords = this.getStopCoordinates(pickupStop);
    const dropoffCoords = this.getStopCoordinates(dropoffStop);

    let pickupDate = '';
    let pickupTime = '';
    // Use pickup_datetime (canonical DB column) first, then pickup_at, then form_snapshot
    const pickupDateTimeSource = reservation.pickup_datetime || reservation.pickup_at;
    if (pickupDateTimeSource) {
      const pickupDateObj = new Date(pickupDateTimeSource);
      if (!Number.isNaN(pickupDateObj.getTime())) {
        pickupDate = pickupDateObj.toLocaleDateString('en-US');
        pickupTime = pickupDateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      }
    } else if (reservation.form_snapshot?.details?.puDate) {
      pickupDate = reservation.form_snapshot.details.puDate;
      if (reservation.form_snapshot?.details?.puTime) {
        pickupTime = reservation.form_snapshot.details.puTime;
      }
    }

    const snapshotPassenger = reservation.form_snapshot?.passenger || {};
    const computedPassenger = `${snapshotPassenger.firstName || ''} ${snapshotPassenger.lastName || ''}`.trim();
    const passengerName = reservation.passenger_name || 
      `${reservation.lead_passenger_first_name || ''} ${reservation.lead_passenger_last_name || ''}`.trim() ||
      computedPassenger || 'N/A';

    const statusDetailCodeRaw = (reservation.status_detail_code || reservation.statusDetailCode || reservation.status_detail || reservation.status || 'pending');
    const statusDetailCode = statusDetailCodeRaw.toString();
    const statusLabel = reservation.status_detail_label || reservation.status || '';
    const statusCategory = this.normalizeStatusCategory(statusDetailCode, statusLabel);
    const statusDetailLower = statusDetailCode.toLowerCase();
    const statusDetailCanonical = canonicalizeFarmoutStatus(statusDetailCode);

    const farmOptionRaw = reservation.farm_option || reservation.form_snapshot?.details?.farmOption || 'in-house';
    const farmOptionNormalized = normalizeFarmoutKey(farmOptionRaw);
    const farmOptionIndicatesFarmOut = farmOptionNormalized === 'farm_out' || farmOptionNormalized === 'farmout';

    const farmoutStatusCandidates = [
      reservation.farmout_status,
      reservation.farmoutStatus,
      reservation.efarm_status,
      reservation.efarmStatus,
      reservation.form_snapshot?.details?.efarmStatus,
      reservation.form_snapshot?.details?.efarm_status
    ];

    let farmoutStatus = '';
    for (const candidate of farmoutStatusCandidates) {
      if (!candidate) continue;
      const canonical = canonicalizeFarmoutStatus(candidate);
      if (canonical) {
        farmoutStatus = canonical;
        break;
      }
    }

    if (!farmoutStatus && isFarmOutStatus(statusDetailCanonical)) {
      farmoutStatus = statusDetailCanonical;
    }

    if (!farmoutStatus) {
      if (farmOptionIndicatesFarmOut) {
        if (statusDetailLower.includes('complete') || statusDetailLower.includes('done')) {
          farmoutStatus = 'completed';
        } else if (statusDetailLower.includes('assign')) {
          farmoutStatus = 'assigned';
        } else if (statusDetailLower.includes('decline')) {
          farmoutStatus = 'declined';
        } else if (statusDetailLower.includes('arrive')) {
          farmoutStatus = 'arrived';
        } else {
          farmoutStatus = 'unassigned';
        }
      } else {
        farmoutStatus = 'in_house';
      }
    }

    farmoutStatus = canonicalizeFarmoutStatus(farmoutStatus) || 'in_house';

    const farmoutModeCandidates = [
      reservation.farmoutMode,
      reservation.farmout_mode,
      reservation.form_snapshot?.details?.farmoutMode
    ];

    let farmoutMode = 'manual';
    for (const modeCandidate of farmoutModeCandidates) {
      if (!modeCandidate) continue;
      farmoutMode = canonicalizeFarmoutMode(modeCandidate);
      break;
    }
    farmoutMode = canonicalizeFarmoutMode(farmoutMode);

    return {
      id: String(identifier),
      confirmationNumber: identifier,
      passengerName,
      phone: reservation.passenger_phone || reservation.form_snapshot?.billing?.passenger?.phone || '',
      email: reservation.passenger_email || reservation.form_snapshot?.billing?.passenger?.email || '',
      pickupLocation,
      dropoffLocation,
      pickupDate,
      pickupTime,
      status: reservation.status || statusCategory,
      statusLabel: reservation.status || statusLabel || statusCategory,
      statusDetailCode,
      driverName: reservation.driver_name || reservation.form_snapshot?.driver?.name || '',
      farmOption: farmOptionRaw,
      farmOptionNormalized,
      farmoutStatus,
      farmoutMode,
      efarmStatus: reservation.efarm_status || reservation.form_snapshot?.details?.efarmStatus || '',
      affiliateName: reservation.affiliate_name || reservation.affiliate_reference || reservation.form_snapshot?.details?.affiliate?.name || '',
      grandTotal: reservation.grand_total || 0,
      pickupCoords,
      dropoffCoords,
      raw: reservation
    };
  }

  transformReservationForManager(reservation) {
    if (!reservation) {
      return null;
    }

    const mapped = this.mapReservationForDashboard(reservation);
    if (!mapped) {
      return null;
    }

    const driverSnapshot = this.createDriverSnapshot(reservation, mapped);
    const passengers = this.pickFirstDefined(
      reservation.passengers,
      reservation.passenger_count,
      reservation.passengerCount,
      reservation.form_snapshot?.details?.passengers,
      reservation.form_snapshot?.details?.passengerCount
    );
    const vehicleType = this.pickFirstString(
      reservation.vehicle_type,
      reservation.vehicleType,
      reservation.vehicle,
      reservation.form_snapshot?.details?.vehicleType,
      reservation.form_snapshot?.details?.vehicle,
      reservation.form_snapshot?.vehicle?.type
    );

    const base = {
      id: mapped.id,
      confirmationNumber: mapped.confirmationNumber,
      passengerName: mapped.passengerName,
      phone: mapped.phone || '',
      email: mapped.email || '',
      pickupLocation: mapped.pickupLocation,
      dropoffLocation: mapped.dropoffLocation,
      pickupDate: mapped.pickupDate,
      pickupTime: mapped.pickupTime,
      status: mapped.status || reservation.status || 'pending',
      statusLabel: mapped.statusLabel || reservation.status_detail_label || reservation.status_label || reservation.status || '',
      farmoutStatus: mapped.farmoutStatus || reservation.farmout_status || 'unassigned',
      farmoutMode: mapped.farmoutMode || reservation.farmout_mode || 'manual',
      farmOption: mapped.farmOption,
      farmOptionNormalized: mapped.farmOptionNormalized,
      driverName: mapped.driverName || driverSnapshot?.name || '',
      driverSnapshot,
      driverId: driverSnapshot?.id ?? reservation.driver_id ?? reservation.driverId ?? null,
      affiliateName: mapped.affiliateName || reservation.affiliate_name || reservation.affiliateName || '',
      grandTotal: mapped.grandTotal || reservation.grand_total || reservation.total || 0,
      pickupCoords: mapped.pickupCoords || null,
      dropoffCoords: mapped.dropoffCoords || null,
      raw: reservation,
      createdAt: reservation.created_at || reservation.createdAt || reservation.created_at_utc || null,
      updatedAt: reservation.updated_at || reservation.updatedAt || reservation.updated_at_utc || null
    };

    if (passengers !== null && passengers !== undefined) {
      base.passengers = passengers;
    }

    if (vehicleType) {
      base.vehicleType = vehicleType;
    }

    if (!base.createdAt) {
      base.createdAt = new Date().toISOString();
    }

    if (!base.updatedAt) {
      base.updatedAt = base.createdAt;
    }

    return base;
  }

  createDriverSnapshot(reservation, mapped) {
    const sources = [
      reservation.driverSnapshot,
      reservation.driver_snapshot,
      reservation.driver,
      reservation.assigned_driver,
      reservation.form_snapshot?.driver,
      reservation.form_snapshot?.details?.driver
    ];

    const driverSource = sources.find(source => source && typeof source === 'object') || {};

    const id = this.pickFirstDefined(
      driverSource.id,
      reservation.driver_id,
      reservation.driverId,
      mapped?.raw?.driver_id
    );

    const name = this.pickFirstString(
      driverSource.name,
      reservation.driver_name,
      reservation.driverName,
      mapped?.driverName
    );

    const affiliate = this.pickFirstString(
      driverSource.affiliate,
      reservation.affiliate_name,
      reservation.affiliateName,
      mapped?.affiliateName
    );

    const phone = this.pickFirstString(
      driverSource.phone,
      reservation.driver_phone,
      reservation.driverPhone
    );

    const vehicle = this.pickFirstString(
      driverSource.vehicleType,
      driverSource.vehicle_type,
      reservation.driver_vehicle,
      reservation.vehicle_type,
      reservation.form_snapshot?.vehicle?.type,
      reservation.form_snapshot?.details?.vehicleType
    );

    if (!name && id === null && !affiliate && !phone && !vehicle) {
      return null;
    }

    return {
      id: id ?? null,
      name,
      affiliate,
      phone,
      vehicleType: vehicle
    };
  }

  pickFirstDefined(...values) {
    for (const value of values) {
      if (value !== null && value !== undefined && value !== '') {
        return value;
      }
    }
    return null;
  }

  pickFirstString(...values) {
    for (const value of values) {
      if (value === null || value === undefined) {
        continue;
      }
      if (Array.isArray(value)) {
        const merged = value.map(item => (item ?? '')).join(' ').trim();
        if (merged) {
          return merged;
        }
        continue;
      }
      const text = String(value).trim();
      if (text) {
        return text;
      }
    }
    return '';
  }

  getReservationStops(reservation) {
    const stopsFromRecord = Array.isArray(reservation?.stops) ? reservation.stops : [];
    const snapshotStops = Array.isArray(reservation?.form_snapshot?.routing?.stops)
      ? reservation.form_snapshot.routing.stops
      : [];
    const stops = stopsFromRecord.length > 0 ? stopsFromRecord : snapshotStops;

    const normalizeStop = (stop) => (stop && typeof stop === 'object') ? stop : null;

    const pickupStop = normalizeStop(
      stops.find(stop => (stop.stopType || stop.type || '').toLowerCase() === 'pickup')
    ) || normalizeStop(stops[0]) || null;

    const dropoffStop = normalizeStop(
      stops.find(stop => (stop.stopType || stop.type || '').toLowerCase() === 'dropoff')
    ) || normalizeStop(stops[stops.length - 1]) || pickupStop;

    return { pickupStop, dropoffStop, stops };
  }

  getStopCoordinates(stop) {
    if (!stop || typeof stop !== 'object') {
      return null;
    }

    const arrayCandidates = [
      stop.coordinates,
      stop.coords,
      stop.latLng,
      stop.latlng,
      stop.location?.coordinates,
      stop.location?.coords,
      stop.geometry?.coordinates,
      stop.position,
      stop.point,
      stop.geo,
      stop.gps
    ];

    for (const candidate of arrayCandidates) {
      const normalized = this.normalizeCoordinateArray(candidate);
      if (normalized) {
        return normalized;
      }
    }

    const latitude = this.pickFirstNumericValue([
      stop.lat,
      stop.latitude,
      stop.latStart,
      stop.lat_start,
      stop.pickupLat,
      stop.pickup_lat,
      stop.startLat,
      stop.start_lat,
      stop.location?.lat,
      stop.location?.latitude,
      stop.geo?.lat,
      stop.geo?.latitude
    ]);

    const longitude = this.pickFirstNumericValue([
      stop.lng,
      stop.lon,
      stop.long,
      stop.longitude,
      stop.lngStart,
      stop.lng_start,
      stop.pickupLng,
      stop.pickup_lng,
      stop.startLng,
      stop.start_lng,
      stop.location?.lng,
      stop.location?.lon,
      stop.location?.longitude,
      stop.geo?.lng,
      stop.geo?.lon,
      stop.geo?.longitude
    ]);

    if (latitude !== null && longitude !== null) {
      return [latitude, longitude];
    }

    return null;
  }

  normalizeCoordinateArray(candidate) {
    if (!Array.isArray(candidate)) {
      return null;
    }

    const flattened = [];
    const pushValues = (value) => {
      if (Array.isArray(value)) {
        value.forEach(pushValues);
      } else {
        const parsed = this.parseCoordinateValue(value);
        if (parsed !== null) {
          flattened.push(parsed);
        }
      }
    };

    pushValues(candidate);

    if (flattened.length < 2) {
      return null;
    }

    const first = flattened[0];
    const second = flattened[1];

    if (!Number.isFinite(first) || !Number.isFinite(second)) {
      return null;
    }

    const firstLooksLikeLat = Math.abs(first) <= 90;
    const secondLooksLikeLat = Math.abs(second) <= 90;

    if (firstLooksLikeLat && !secondLooksLikeLat) {
      return [first, second];
    }

    if (!firstLooksLikeLat && secondLooksLikeLat) {
      return [second, first];
    }

    if (firstLooksLikeLat && secondLooksLikeLat) {
      return [first, second];
    }

    return [second, first];
  }

  pickFirstNumericValue(candidates) {
    for (const candidate of candidates) {
      const value = this.parseCoordinateValue(candidate);
      if (value !== null) {
        return value;
      }
    }
    return null;
  }

  parseCoordinateValue(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const normalized = value.trim();
      if (!normalized) {
        return null;
      }
      const parsed = Number(normalized);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  normalizeStatusCategory(code, label) {
    const normalizedCode = (code || '').toLowerCase();
    const normalizedLabel = (label || '').toLowerCase();

    if (['affiliate_assigned', 'driver_assigned', 'driver_en_route', 'driver_waiting_at_pickup', 'driver_circling'].includes(normalizedCode)) {
      return 'accepted';
    }

    if (normalizedLabel.includes('assigned')) {
      return 'accepted';
    }

    if (
      ['completed', 'completing', 'done'].includes(normalizedCode) ||
      normalizedLabel.includes('completed') ||
      normalizedLabel.includes('done')
    ) {
      return 'completed';
    }

    return 'pending';
  }
}

// Initialize the system when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.limoSystem = new LimoReservationSystem();
  
  // Expose closeReservationPopup globally for the popup close button
  window.closeReservationPopup = () => {
    if (window.limoSystem?.uiManager?.closeReservationPopup) {
      window.limoSystem.uiManager.closeReservationPopup();
    }
  };
  
  // Expose uiManager globally for cross-frame communication
  window.uiManager = window.limoSystem?.uiManager;
});

// Open reservation from notification popup
window.openReservationFromNotification = function(confNumber) {
  // Close the notification
  const notif = document.getElementById('tripAssignmentNotification');
  if (notif) notif.remove();
  
  // Open reservation form
  window.location.href = `reservation-form.html?conf=${confNumber}`;
};

// Expose utility for manual ghost purge from console
window.purgeAllGhostReservations = function() {
  localStorage.removeItem('relia_reservations');
  sessionStorage.removeItem('relia_ghost_purge_v1');
  console.log('[ManualPurge] Cleared all cached reservations. Reload to fetch fresh data.');
  location.reload();
};
