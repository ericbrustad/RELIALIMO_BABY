// ============================================
// Customer Portal - Main JavaScript
// ============================================

import { getSupabaseCredentials } from '/shared/supabase-config.js';
import CustomerAuth from './customer-auth-service.js';
import { initUserMenu, injectUserMenuStyles } from './customer-user-menu.js';
import { LocalAirportsService } from './LocalAirportsService.js';

// ============================================
// Memo Notification Functions
// ============================================
async function loadAndDisplayMemos() {
  try {
    const config = getSupabaseCredentials();
    if (!config || !config.url) {
      console.warn('[Memos] No Supabase config available');
      return;
    }
    
    // Get active memos for account-login location
    const now = new Date().toISOString();
    const url = `${config.url}/rest/v1/company_memos?select=*&is_active=eq.true&notify_location=eq.account-login&or=(display_from.is.null,display_from.lte.${now})&or=(display_to.is.null,display_to.gte.${now})&order=created_at.desc&limit=5`;
    
    const response = await fetch(url, {
      headers: {
        'apikey': config.anonKey,
        'Authorization': `Bearer ${config.anonKey}`
      }
    });
    
    if (!response.ok) {
      console.warn('[Memos] Failed to load memos:', response.statusText);
      return;
    }
    
    const memos = await response.json();
    console.log('[Memos] Loaded', memos.length, 'memos for account-login');
    
    if (memos.length === 0) return;
    
    // Filter out dismissed memos
    const dismissedMemos = JSON.parse(localStorage.getItem('dismissedMemos') || '[]');
    const activeMemos = memos.filter(m => !dismissedMemos.includes(m.id));
    
    if (activeMemos.length === 0) return;
    
    // Get or create container
    const container = document.getElementById('memoNotificationContainer');
    if (!container) return;
    
    // Generate memo HTML
    const colorMap = {
      'red': '#ff3333',
      'yellow': '#ffd700',
      'green': '#90ee90',
      'blue': '#87ceeb',
      'orange': '#ffb366',
      'purple': '#dda0dd'
    };
    
    container.innerHTML = activeMemos.map(memo => `
      <div class="memo-banner" data-memo-id="${memo.id}" style="
        background: ${colorMap[memo.color] || '#ffd700'};
        color: #333;
        padding: 12px 16px;
        margin: 8px 0;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      ">
        <div class="memo-content" style="flex: 1;">
          <span style="font-weight: 600;">📢</span>
          ${memo.memo_text}
        </div>
        <button class="memo-dismiss-btn" onclick="dismissMemo('${memo.id}')" style="
          background: rgba(0,0,0,0.2);
          border: none;
          border-radius: 50%;
          width: 24px;
          height: 24px;
          cursor: pointer;
          font-size: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-left: 12px;
        ">×</button>
      </div>
    `).join('');
    
    container.style.display = 'block';
    
    // Add global dismiss function
    window.dismissMemo = function(memoId) {
      const dismissed = JSON.parse(localStorage.getItem('dismissedMemos') || '[]');
      if (!dismissed.includes(memoId)) {
        dismissed.push(memoId);
        localStorage.setItem('dismissedMemos', JSON.stringify(dismissed));
      }
      const banner = document.querySelector(`[data-memo-id="${memoId}"]`);
      if (banner) {
        banner.style.transition = 'opacity 0.3s, transform 0.3s';
        banner.style.opacity = '0';
        banner.style.transform = 'translateX(100%)';
        setTimeout(() => banner.remove(), 300);
      }
      // Hide container if no more memos
      const remaining = container.querySelectorAll('.memo-banner');
      if (remaining.length <= 1) {
        container.style.display = 'none';
      }
    };
    
  } catch (err) {
    console.error('[Memos] Error loading memos:', err);
  }
}

// ============================================
// State Management
// ============================================
const state = {
  customer: null,
  session: null,
  portalSlug: '',
  preferences: {
    smsUpdates: true,
    emailConfirm: true,
    announceStatus: false,
    showDriverMap: true,
    autoRefresh: true
  },
  savedPassengers: [],
  savedAddresses: [],
  addressesLoaded: false, // Flag to track if addresses have been fetched
  favoriteAirports: [], // Customer's favorite airport codes
  trips: [],
  activeTrip: null,
  vehicleTypes: [],
  airports: [],
  selectedVehicleType: null,
  selectedPickupAddress: null,
  selectedDropoffAddress: null,
  pickupAddressData: null, // Full address data with coordinates
  dropoffAddressData: null, // Full address data with coordinates
  pickupAutocomplete: null, // Google Places autocomplete instance
  dropoffAutocomplete: null, // Google Places autocomplete instance
  routeInfo: null, // Distance, duration from Google Directions
  estimatedPrice: null, // Calculated price based on vehicle type and route
  stops: [],
  tripType: 'standard', // 'standard' or 'hourly'
  hourlyDuration: 2, // minimum 2 hours
  mapboxToken: null,
  maps: {
    tracking: null,
    selection: null
  },
  driverMarker: null,
  trackingInterval: null,
  geofenceRadius: 25 // Default 25 meters, adjustable in admin
};

// ============================================
// Portal Settings (Loaded from DB/Admin)
// ============================================
const portalSettings = {
  logo: '/favicon.ico',
  headerTitle: 'RELIALIMO',
  welcomeMessage: 'Welcome to Professional',
  thankYouMessage: 'RELIALIMO thanks you',
  googleReviewUrl: '',
  primaryColor: '#4f46e5',
  geofenceRadius: 25
};

// ============================================
// Booking Defaults (Loaded from Admin Settings)
// ============================================
const bookingDefaults = {
  assignmentType: 'unassigned',       // Driver assignment: unassigned, in-house, farm-out
  vehicleType: 'Black SUV',           // Default vehicle type
  serviceType: 'Point to Point',      // Default service type
  confirmationPrefix: '',             // Prefix for confirmation numbers
  requireFlightPickup: true,          // Require flight # for airport pickups
  requireFlightDropoff: false,        // Require flight # for airport dropoffs
  sendConfirmationSms: true,
  sendConfirmationEmail: true,
  autoConfirm: true,
  availableVehicleTypes: ['Black SUV', 'Sedan', 'Executive SUV', 'Sprinter Van', 'Stretch Limo', 'Party Bus'],
  availableServiceTypes: ['Point to Point', 'Hourly', 'Airport Transfer', 'Wedding', 'Special Event']
};

// ============================================
// Initialization
// ============================================

// Auto-load ENV settings for SMS/Email (needed for OTP)
async function loadEnvSettingsToLocalStorage() {
  try {
    // Check if already loaded in this session
    const lastLoad = localStorage.getItem('envSettingsLastLoad');
    const now = Date.now();
    // Only reload if not loaded in last 5 minutes
    if (lastLoad && (now - parseInt(lastLoad)) < 5 * 60 * 1000) {
      console.log('[CustomerPortal] ENV settings recently loaded, skipping');
      return;
    }
    
    console.log('[CustomerPortal] Loading ENV settings...');
    const response = await fetch('/api/get-env-settings');
    const data = await response.json();
    
    if (data.success) {
      // Save SMS/Twilio settings
      if (data.twilio && (data.twilio.accountSid || data.twilio.authToken || data.twilio.fromNumber || data.twilio.messagingServiceSid)) {
        const smsProviders = JSON.parse(localStorage.getItem('smsProviders') || '[]');
        const existingTwilioIndex = smsProviders.findIndex(p => p.type === 'twilio');
        const twilioProvider = {
          type: 'twilio',
          accountSid: data.twilio.accountSid || '',
          authToken: data.twilio.authToken || '',
          phoneNumber: data.twilio.fromNumber || data.twilio.messagingServiceSid || '',
          fromNumber: data.twilio.fromNumber || data.twilio.messagingServiceSid || '',
          messagingServiceSid: data.twilio.messagingServiceSid || '',
          isDefault: true,
          enabled: true
        };
        
        if (existingTwilioIndex >= 0) {
          smsProviders[existingTwilioIndex] = { ...smsProviders[existingTwilioIndex], ...twilioProvider };
        } else {
          smsProviders.push(twilioProvider);
        }
        localStorage.setItem('smsProviders', JSON.stringify(smsProviders));
        console.log('[CustomerPortal] SMS settings loaded from ENV');
      }
      
      // Save Email settings
      if (data.email && (data.email.resendApiKey || data.email.fromEmail || data.email.smtpHost)) {
        const emailSettings = JSON.parse(localStorage.getItem('emailSettings') || '{}');
        emailSettings.fromEmail = data.email.fromEmail || emailSettings.fromEmail || '';
        emailSettings.replyTo = data.email.replyTo || emailSettings.replyTo || '';
        emailSettings.resendApiKey = data.email.resendApiKey || emailSettings.resendApiKey || '';
        emailSettings.smtpHost = data.email.smtpHost || emailSettings.smtpHost || '';
        emailSettings.smtpPort = data.email.smtpPort || emailSettings.smtpPort || '';
        emailSettings.smtpUser = data.email.smtpUser || emailSettings.smtpUser || '';
        emailSettings.smtpPass = data.email.smtpPass || emailSettings.smtpPass || '';
        localStorage.setItem('emailSettings', JSON.stringify(emailSettings));
        console.log('[CustomerPortal] Email settings loaded from ENV');
      }
      
      localStorage.setItem('envSettingsLastLoad', now.toString());
      console.log('[CustomerPortal] ENV settings loaded successfully');
    }
  } catch (error) {
    console.warn('[CustomerPortal] Could not load ENV settings:', error.message);
  }
}

// ============================================
// Location & Notification Permission Management
// ============================================
async function checkAndRequestLocationPermission() {
  console.log('[CustomerPortal] Checking location permission...');
  
  if (!('geolocation' in navigator)) {
    console.warn('[CustomerPortal] Geolocation not supported by this browser');
    return { supported: false, granted: false };
  }
  
  // Check current permission status if Permissions API is available
  if ('permissions' in navigator) {
    try {
      const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
      console.log('[CustomerPortal] Location permission status:', permissionStatus.state);
      
      if (permissionStatus.state === 'granted') {
        console.log('[CustomerPortal] ✅ Location permission already granted');
        return { supported: true, granted: true };
      } else if (permissionStatus.state === 'denied') {
        console.warn('[CustomerPortal] ❌ Location permission denied by user');
        showLocationPermissionDeniedWarning();
        return { supported: true, granted: false, denied: true };
      }
      // If 'prompt', we'll request below
    } catch (err) {
      console.warn('[CustomerPortal] Could not query location permission:', err);
    }
  }
  
  // Request location permission by attempting to get current position
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log('[CustomerPortal] ✅ Location permission granted');
        resolve({ supported: true, granted: true });
      },
      (error) => {
        console.warn('[CustomerPortal] ❌ Location permission error:', error.message);
        if (error.code === error.PERMISSION_DENIED) {
          showLocationPermissionDeniedWarning();
          resolve({ supported: true, granted: false, denied: true });
        } else {
          resolve({ supported: true, granted: false, error: error.message });
        }
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  });
}

async function checkAndRequestNotificationPermission() {
  console.log('[CustomerPortal] Checking notification permission...');
  
  if (!('Notification' in window)) {
    console.warn('[CustomerPortal] Notifications not supported by this browser');
    return { supported: false, granted: false };
  }
  
  const currentPermission = Notification.permission;
  console.log('[CustomerPortal] Current notification permission:', currentPermission);
  
  if (currentPermission === 'granted') {
    console.log('[CustomerPortal] ✅ Notification permission already granted');
    return { supported: true, granted: true };
  }
  
  if (currentPermission === 'denied') {
    console.warn('[CustomerPortal] ❌ Notification permission denied by user');
    showNotificationPermissionDeniedWarning();
    return { supported: true, granted: false, denied: true };
  }
  
  // Permission is 'default' - request it
  try {
    const permission = await Notification.requestPermission();
    console.log('[CustomerPortal] Notification permission result:', permission);
    
    if (permission === 'granted') {
      console.log('[CustomerPortal] ✅ Notification permission granted');
      return { supported: true, granted: true };
    } else {
      console.warn('[CustomerPortal] ❌ Notification permission not granted:', permission);
      if (permission === 'denied') {
        showNotificationPermissionDeniedWarning();
      }
      return { supported: true, granted: false, denied: permission === 'denied' };
    }
  } catch (err) {
    console.error('[CustomerPortal] Error requesting notification permission:', err);
    return { supported: true, granted: false, error: err.message };
  }
}

function showLocationPermissionDeniedWarning() {
  // Show a persistent warning banner about location permission
  const existingBanner = document.getElementById('location-permission-banner');
  if (existingBanner) return; // Already showing
  
  const banner = document.createElement('div');
  banner.id = 'location-permission-banner';
  banner.className = 'permission-warning-banner';
  banner.innerHTML = `
    <div class="permission-warning-content">
      <span class="permission-warning-icon">📍</span>
      <span class="permission-warning-text">Location services are disabled. Enable location in your browser settings for accurate pickup/dropoff.</span>
      <button class="permission-warning-close" onclick="this.parentElement.parentElement.remove()">✕</button>
    </div>
  `;
  banner.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: #ff6b35;
    color: white;
    padding: 10px 15px;
    z-index: 10000;
    font-size: 14px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
  `;
  
  const content = banner.querySelector('.permission-warning-content');
  if (content) {
    content.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      max-width: 600px;
      margin: 0 auto;
    `;
  }
  
  const closeBtn = banner.querySelector('.permission-warning-close');
  if (closeBtn) {
    closeBtn.style.cssText = `
      background: none;
      border: none;
      color: white;
      font-size: 18px;
      cursor: pointer;
      padding: 0 5px;
      margin-left: 10px;
    `;
  }
  
  document.body.prepend(banner);
}

function showNotificationPermissionDeniedWarning() {
  // Show a persistent warning banner about notification permission
  const existingBanner = document.getElementById('notification-permission-banner');
  if (existingBanner) return; // Already showing
  
  const banner = document.createElement('div');
  banner.id = 'notification-permission-banner';
  banner.className = 'permission-warning-banner';
  banner.innerHTML = `
    <div class="permission-warning-content">
      <span class="permission-warning-icon">🔔</span>
      <span class="permission-warning-text">Notifications are disabled. Enable in browser settings to receive trip updates.</span>
      <button class="permission-warning-close" onclick="this.parentElement.parentElement.remove()">✕</button>
    </div>
  `;
  banner.style.cssText = `
    position: fixed;
    top: ${document.getElementById('location-permission-banner') ? '45px' : '0'};
    left: 0;
    right: 0;
    background: #f59e0b;
    color: white;
    padding: 10px 15px;
    z-index: 9999;
    font-size: 14px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
  `;
  
  const content = banner.querySelector('.permission-warning-content');
  if (content) {
    content.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      max-width: 600px;
      margin: 0 auto;
    `;
  }
  
  const closeBtn = banner.querySelector('.permission-warning-close');
  if (closeBtn) {
    closeBtn.style.cssText = `
      background: none;
      border: none;
      color: white;
      font-size: 18px;
      cursor: pointer;
      padding: 0 5px;
      margin-left: 10px;
    `;
  }
  
  document.body.prepend(banner);
}

async function ensureRequiredPermissions() {
  console.log('[CustomerPortal] Checking required permissions (location & notifications)...');
  
  // Check both permissions in parallel
  const [locationResult, notificationResult] = await Promise.all([
    checkAndRequestLocationPermission(),
    checkAndRequestNotificationPermission()
  ]);
  
  console.log('[CustomerPortal] Permission check results:', {
    location: locationResult,
    notifications: notificationResult
  });
  
  // Store permission states
  state.permissions = {
    location: locationResult,
    notifications: notificationResult
  };
  
  return { location: locationResult, notifications: notificationResult };
}

async function init() {
  console.log('[CustomerPortal] Initializing...');
  
  try {
    // Check and request required permissions first (location & notifications)
    await ensureRequiredPermissions();
    
    // Load ENV settings for SMS/Email
    await loadEnvSettingsToLocalStorage();
    
    // Get portal slug from URL
    extractPortalSlug();
    
    // Initialize auth service and check authentication
    const isAuth = await CustomerAuth.initAuth();
    
    if (!isAuth) {
      // Redirect to auth page
      console.log('[CustomerPortal] Not authenticated, redirecting to auth...');
      window.location.href = '/auth';
      return;
    }
    
    // Sync state from auth service
    state.session = CustomerAuth.getSession();
    state.customer = CustomerAuth.getCustomer();
    
    console.log('[CustomerPortal] Synced customer from auth service:', state.customer);
    
    // If customer data is incomplete, fetch fresh from database
    if (!state.customer?.first_name && state.customer?.email) {
      console.log('[CustomerPortal] Customer data incomplete, fetching from database...');
      await fetchFreshCustomerData();
    }
    
    // DISABLED: Onboarding redirect is temporarily disabled
    // TODO: Re-enable when onboarding flow is properly tested
    // if (state.customer && state.customer.onboarding_complete === false) {
    //   console.log('[CustomerPortal] Onboarding not complete, redirecting to onboarding...');
    //   window.location.href = '/onboarding';
    //   return;
    // }
    
    // Inject user menu styles and initialize user menu
    injectUserMenuStyles();
    initUserMenu('userMenuContainer');
    
    // Load portal settings
    await loadPortalSettings();
    
    // Apply settings to UI
    applyPortalSettings();
    
    // Load customer data
    await loadCustomerData();
    
    // Setup event listeners
    setupEventListeners();
    
    // Initialize maps
    await initializeMaps();
    
    // Show portal screen
    document.getElementById('loadingScreen').classList.remove('active');
    document.getElementById('portalScreen').classList.add('active');
    
    // Load and display company memos
    await loadAndDisplayMemos();
    
    // Load initial data
    await Promise.all([
      loadVehicleTypes(),
      loadAirports(),
      loadTrips()
    ]);
    
    // Setup real-time tracking if active trip
    checkForActiveTrip();
    
    // Set default date/time
    setDefaultDateTime();
    
    // Background refresh of addresses to ensure they show up
    setTimeout(async () => {
      console.log('[CustomerPortal] Background refresh of addresses...');
      await loadSavedAddresses();
      populateAddressDropdowns();
    }, 2000);
    
    console.log('[CustomerPortal] Initialized successfully');
  } catch (err) {
    console.error('[CustomerPortal] Initialization error:', err);
    // Still hide loading screen to show something
    document.getElementById('loadingScreen').classList.remove('active');
    document.getElementById('portalScreen').classList.add('active');
  }
}

function extractPortalSlug() {
  // First check for slug in query params (from middleware rewrite)
  const urlParams = new URLSearchParams(window.location.search);
  const slugParam = urlParams.get('slug');
  if (slugParam) {
    state.portalSlug = slugParam;
    return;
  }
  
  // Fallback: extract from pathname
  const pathname = window.location.pathname;
  const parts = pathname.split('/').filter(p => p && !p.includes('.'));
  if (parts.length > 0) {
    state.portalSlug = parts[parts.length - 1];
  }
}

// ============================================
// Authentication
// ============================================
async function checkAuth() {
  try {
    const session = localStorage.getItem('customer_session');
    if (!session) return false;
    
    const parsed = JSON.parse(session);
    if (!parsed?.access_token) return false;
    
    // Check token expiry
    if (parsed.expires_at && parsed.expires_at * 1000 < Date.now()) {
      console.log('[CustomerPortal] Session expired');
      localStorage.removeItem('customer_session');
      return false;
    }
    
    state.session = parsed;
    
    // Load customer info
    const customerInfo = localStorage.getItem('current_customer');
    if (customerInfo) {
      state.customer = JSON.parse(customerInfo);
    } else {
      await fetchCustomerInfo();
    }
    
    return true;
  } catch (err) {
    console.error('[CustomerPortal] Auth check error:', err);
    return false;
  }
}

async function fetchCustomerInfo() {
  try {
    const creds = getSupabaseCredentials();
    const email = state.session?.user?.email;
    
    if (!email) return;
    
    const response = await fetch(
      `${creds.url}/rest/v1/accounts?email=eq.${encodeURIComponent(email.toLowerCase())}&select=*`,
      {
        headers: {
          'apikey': creds.anonKey,
          'Authorization': `Bearer ${state.session.access_token}`
        }
      }
    );
    
    if (response.ok) {
      const customers = await response.json();
      if (customers?.length > 0) {
        state.customer = customers[0];
        localStorage.setItem('current_customer', JSON.stringify(state.customer));
      }
    }
  } catch (err) {
    console.error('[CustomerPortal] Failed to fetch customer info:', err);
  }
}

async function fetchFreshCustomerData() {
  try {
    const creds = getSupabaseCredentials();
    const email = state.customer?.email || state.session?.user?.email;
    
    if (!email) {
      console.warn('[CustomerPortal] No email available to fetch customer data');
      return;
    }
    
    console.log('[CustomerPortal] Fetching fresh customer data for:', email);
    
    const response = await fetch(
      `${creds.url}/rest/v1/accounts?email=eq.${encodeURIComponent(email.toLowerCase())}&select=*`,
      {
        headers: {
          'apikey': creds.anonKey,
          'Authorization': `Bearer ${state.session?.access_token || creds.anonKey}`
        }
      }
    );
    
    if (response.ok) {
      const customers = await response.json();
      if (customers?.length > 0) {
        state.customer = customers[0];
        localStorage.setItem('current_customer', JSON.stringify(state.customer));
        console.log('[CustomerPortal] Fresh customer data loaded:', {
          first_name: state.customer.first_name,
          last_name: state.customer.last_name,
          email: state.customer.email,
          phone: state.customer.phone || state.customer.cell_phone
        });
      }
    }
  } catch (err) {
    console.error('[CustomerPortal] Failed to fetch fresh customer data:', err);
  }
}

function logout() {
  // Use the centralized auth service for logout
  CustomerAuth.logout(true);
}

// ============================================
// Portal Settings
// ============================================
async function loadPortalSettings() {
  try {
    const creds = getSupabaseCredentials();
    const response = await fetch(
      `${creds.url}/rest/v1/portal_settings?portal_type=eq.customer&select=*`,
      {
        headers: {
          'apikey': creds.anonKey,
          'Authorization': `Bearer ${state.session?.access_token || creds.anonKey}`
        }
      }
    );
    
    if (response.ok) {
      const settings = await response.json();
      if (settings?.length > 0) {
        const dbSettings = settings[0];
        // Map snake_case DB columns to camelCase properties
        portalSettings.logo = dbSettings.logo || dbSettings.logo_url || portalSettings.logo;
        portalSettings.headerTitle = dbSettings.header_title || dbSettings.headerTitle || portalSettings.headerTitle;
        portalSettings.welcomeMessage = dbSettings.welcome_message || dbSettings.welcomeMessage || portalSettings.welcomeMessage;
        portalSettings.thankYouMessage = dbSettings.thank_you_message || dbSettings.thankYouMessage || portalSettings.thankYouMessage;
        portalSettings.primaryColor = dbSettings.primary_color || dbSettings.primaryColor || portalSettings.primaryColor;
        portalSettings.googleReviewUrl = dbSettings.google_review_url || dbSettings.googleReviewUrl || portalSettings.googleReviewUrl;
        portalSettings.geofenceRadius = dbSettings.geofence_radius_meters || dbSettings.geofenceRadius || portalSettings.geofenceRadius;
      }
    }
    
    // Load booking defaults from admin settings
    await loadBookingDefaults();
    
    // Get Mapbox token
    const mapboxResp = await fetch(
      `${creds.url}/rest/v1/app_settings?key=eq.mapbox_token&select=value`,
      {
        headers: {
          'apikey': creds.anonKey
        }
      }
    );
    
    if (mapboxResp.ok) {
      const mapboxData = await mapboxResp.json();
      if (mapboxData?.length > 0) {
        state.mapboxToken = mapboxData[0].value;
      }
    }
  } catch (err) {
    console.error('[CustomerPortal] Failed to load portal settings:', err);
  }
}

// Load booking defaults from admin configuration
async function loadBookingDefaults() {
  try {
    const creds = getSupabaseCredentials();
    const response = await fetch(
      `${creds.url}/rest/v1/customer_booking_defaults?select=*`,
      {
        headers: {
          'apikey': creds.anonKey
        }
      }
    );
    
    if (response.ok) {
      const defaults = await response.json();
      defaults.forEach(setting => {
        const key = toCamelCase(setting.setting_key);
        let value = setting.setting_value;
        
        // Parse based on type
        if (setting.setting_type === 'boolean') {
          value = value === 'true';
        } else if (setting.setting_type === 'number') {
          value = parseFloat(value);
        } else if (setting.setting_type === 'json') {
          try { value = JSON.parse(value); } catch (e) {}
        }
        
        bookingDefaults[key] = value;
      });
    }
    
    // Apply default vehicle type
    if (bookingDefaults.defaultVehicleType) {
      state.selectedVehicleType = bookingDefaults.defaultVehicleType;
    }
    
    // Apply default service type
    if (bookingDefaults.serviceType) {
      state.serviceType = bookingDefaults.serviceType;
    }
  } catch (err) {
    console.error('[CustomerPortal] Failed to load booking defaults:', err);
  }
}

// Helper to convert snake_case to camelCase
function toCamelCase(str) {
  return str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
}

function applyPortalSettings() {
  // Update logo
  document.querySelectorAll('#loadingLogo, #headerLogo, #thankYouLogo').forEach(img => {
    if (portalSettings.logo) img.src = portalSettings.logo;
  });
  
  // Update titles (null checks for elements that may not exist on all pages)
  const headerTitle = document.getElementById('headerTitle');
  const thankYouCompany = document.getElementById('thankYouCompany');
  if (headerTitle) headerTitle.textContent = portalSettings.headerTitle || 'RELIALIMO';
  if (thankYouCompany) thankYouCompany.textContent = portalSettings.thankYouMessage || 'RELIALIMO thanks you';
  
  // Update welcome message
  if (state.customer) {
    const welcomeGreeting = document.getElementById('welcomeGreeting');
    const welcomeName = document.getElementById('welcomeName');
    if (welcomeGreeting) welcomeGreeting.textContent = portalSettings.welcomeMessage || 'Welcome to Professional';
    if (welcomeName) welcomeName.textContent = `${state.customer.first_name || ''} ${state.customer.last_name || ''}`.trim();
  }
  
  // Update primary color
  if (portalSettings.primaryColor) {
    document.documentElement.style.setProperty('--primary', portalSettings.primaryColor);
  }
  
  // Update geofence radius
  state.geofenceRadius = portalSettings.geofenceRadius || 25;
}

// ============================================
// Customer Data Loading
// ============================================
async function loadCustomerData() {
  await Promise.all([
    loadSavedPassengers(),
    loadSavedAddresses(),
    loadPreferences()
  ]);
  
  // Populate passenger dropdown
  populatePassengerDropdown();
  
  // Populate address dropdowns
  populateAddressDropdowns();
  
  // Update account tab
  updateAccountTab();
  
  // Prefill booking form with customer defaults
  prefillBookingDefaults();
}

async function loadSavedPassengers() {
  try {
    const creds = getSupabaseCredentials();
    // Query using account_id (billing account) and filter visible passengers
    const response = await fetch(
      `${creds.url}/rest/v1/customer_passengers?account_id=eq.${state.customer?.id}&is_visible=eq.true&select=*&order=is_primary.desc,usage_count.desc`,
      {
        headers: {
          'apikey': creds.anonKey,
          'Authorization': `Bearer ${state.session?.access_token}`
        }
      }
    );
    
    if (response.ok) {
      state.savedPassengers = await response.json();
    }
  } catch (err) {
    console.error('[CustomerPortal] Failed to load passengers:', err);
  }
}

async function loadSavedAddresses() {
  try {
    const creds = getSupabaseCredentials();
    const accountId = state.customer?.id;
    
    if (!accountId) {
      console.warn('[CustomerPortal] No account ID for loading addresses');
      return;
    }
    
    console.log('[CustomerPortal] Loading addresses for account:', accountId);
    
    // Try to load from both tables - customer_addresses (newer) and account_addresses (legacy)
    const headers = {
      'apikey': creds.anonKey,
      'Authorization': `Bearer ${state.session?.access_token}`
    };
    
    // First try customer_addresses table
    // Note: is_visible filter allows true OR null for backward compatibility
    const customerAddressUrl = `${creds.url}/rest/v1/customer_addresses?account_id=eq.${accountId}&is_deleted=eq.false&or=(is_visible.eq.true,is_visible.is.null)&select=*&order=is_favorite.desc.nullslast,usage_count.desc.nullslast`;
    console.log('[CustomerPortal] Fetching customer_addresses from:', customerAddressUrl);
    
    const customerAddressesResp = await fetch(customerAddressUrl, { headers });
    
    let addresses = [];
    if (customerAddressesResp.ok) {
      const customerAddresses = await customerAddressesResp.json();
      console.log('[CustomerPortal] customer_addresses response:', customerAddresses);
      addresses = customerAddresses.map(a => ({
        ...a,
        source: 'customer_addresses'
      }));
    } else {
      console.warn('[CustomerPortal] customer_addresses fetch failed:', customerAddressesResp.status, await customerAddressesResp.text());
    }
    
    // Also check account_addresses table for addresses saved from admin portal
    const accountAddressesResp = await fetch(
      `${creds.url}/rest/v1/account_addresses?account_id=eq.${accountId}&select=*&order=last_used_at.desc`,
      { headers }
    );
    
    if (accountAddressesResp.ok) {
      const accountAddresses = await accountAddressesResp.json();
      console.log('[CustomerPortal] account_addresses response:', accountAddresses);
      
      // Merge account_addresses, avoiding duplicates based on address_line1
      for (const addr of accountAddresses) {
        const isDuplicate = addresses.some(a => 
          a.full_address?.toLowerCase()?.includes(addr.address_line1?.toLowerCase()) ||
          a.address_line1?.toLowerCase() === addr.address_line1?.toLowerCase()
        );
        
        if (!isDuplicate) {
          // Convert account_addresses format to customer_addresses format
          const fullAddr = [
            addr.address_line1,
            addr.address_line2,
            addr.city,
            addr.state,
            addr.zip_code
          ].filter(Boolean).join(', ');
          
          addresses.push({
            id: addr.id,
            account_id: addr.account_id,
            full_address: fullAddr,
            label: addr.address_name || addr.address_type || 'Saved Address',
            address_type: addr.address_type || 'other',
            address_line1: addr.address_line1,
            city: addr.city,
            state: addr.state,
            zip_code: addr.zip_code,
            is_favorite: addr.address_type === 'home' || addr.address_type === 'primary',
            source: 'account_addresses'
          });
        }
      }
    } else {
      console.warn('[CustomerPortal] account_addresses fetch failed:', accountAddressesResp.status);
    }
    
    state.savedAddresses = addresses;
    state.addressesLoaded = true;
    console.log('[CustomerPortal] Loaded', addresses.length, 'total saved addresses:', addresses);
    
  } catch (err) {
    console.error('[CustomerPortal] Failed to load addresses:', err);
    state.addressesLoaded = true; // Mark as loaded even on error to prevent infinite retries
  }
}

async function loadPreferences() {
  const saved = localStorage.getItem(`customer_prefs_${state.customer?.id}`);
  if (saved) {
    try {
      Object.assign(state.preferences, JSON.parse(saved));
    } catch (e) {}
  }
  
  // Apply to checkboxes
  document.getElementById('prefSmsUpdates').checked = state.preferences.smsUpdates;
  document.getElementById('prefEmailConfirm').checked = state.preferences.emailConfirm;
  document.getElementById('prefAnnounceStatus').checked = state.preferences.announceStatus;
  document.getElementById('prefShowDriverMap').checked = state.preferences.showDriverMap;
  document.getElementById('prefAutoRefresh').checked = state.preferences.autoRefresh;
}

function savePreferences() {
  state.preferences = {
    smsUpdates: document.getElementById('prefSmsUpdates').checked,
    emailConfirm: document.getElementById('prefEmailConfirm').checked,
    announceStatus: document.getElementById('prefAnnounceStatus').checked,
    showDriverMap: document.getElementById('prefShowDriverMap').checked,
    autoRefresh: document.getElementById('prefAutoRefresh').checked
  };
  
  localStorage.setItem(`customer_prefs_${state.customer?.id}`, JSON.stringify(state.preferences));
  showToast('Preferences saved', 'success');
  closeModal('preferencesModal');
}

// ============================================
// Vehicle Types
// ============================================
async function loadVehicleTypes() {
  try {
    const creds = getSupabaseCredentials();
    
    // First, check if a default vehicle type is set in portal_settings
    // Use API endpoint to bypass RLS restrictions
    let lockedVehicleType = null;
    try {
      const settingsResponse = await fetch('/api/get-portal-settings');
      if (settingsResponse.ok) {
        const settingsData = await settingsResponse.json();
        if (settingsData.success && settingsData.settings?.default_vehicle_type) {
          lockedVehicleType = settingsData.settings.default_vehicle_type;
          console.log('[CustomerPortal] Default vehicle type from settings:', lockedVehicleType);
        }
      }
    } catch (err) {
      console.warn('[CustomerPortal] Could not fetch default vehicle type setting:', err);
    }
    
    // Load vehicle types that are active and shown in app
    const response = await fetch(
      `${creds.url}/rest/v1/vehicle_types?is_active=eq.true&select=*&order=sort_order.asc`,
      {
        headers: {
          'apikey': creds.anonKey
        }
      }
    );
    
    if (response.ok) {
      const allTypes = await response.json();
      // Filter to only show types with show_in_app = true (or if not set, show all)
      let filteredTypes = allTypes.filter(t => t.show_in_app !== false);
      
      // If a default vehicle type is set, lock to only that type
      if (lockedVehicleType) {
        const matchingType = filteredTypes.find(t => 
          t.name === lockedVehicleType || 
          t.id === lockedVehicleType ||
          t.name?.toLowerCase() === lockedVehicleType?.toLowerCase()
        );
        if (matchingType) {
          state.vehicleTypes = [matchingType];
          state.selectedVehicleType = matchingType.id;
          state.vehicleTypeLocked = true; // Flag to indicate selection is locked
          console.log('[CustomerPortal] Vehicle type locked to:', matchingType.name);
        } else {
          // Fallback to all types if the configured default isn't found
          console.warn('[CustomerPortal] Configured default vehicle type not found:', lockedVehicleType);
          state.vehicleTypes = filteredTypes;
        }
      } else {
        state.vehicleTypes = filteredTypes;
        
        // Find and set the default app vehicle type
        const defaultType = state.vehicleTypes.find(t => t.is_app_default === true);
        if (defaultType) {
          state.selectedVehicleType = defaultType.id;
          console.log('[CustomerPortal] Default app vehicle type:', defaultType.name);
        }
      }
      
      renderVehicleTypes();
    }
  } catch (err) {
    console.error('[CustomerPortal] Failed to load vehicle types:', err);
    // Fallback default types
    state.vehicleTypes = [
      { id: 'sedan', name: 'Sedan', icon: '🚗', capacity: '1-3 passengers', passenger_capacity: 3 },
      { id: 'suv', name: 'SUV', icon: '🚘', capacity: '1-5 passengers', passenger_capacity: 5 },
      { id: 'van', name: 'Van', icon: '🚐', capacity: '1-7 passengers', passenger_capacity: 7 },
      { id: 'limo', name: 'Limousine', icon: '🚙', capacity: '1-8 passengers', passenger_capacity: 8 }
    ];
    renderVehicleTypes();
  }
}

function renderVehicleTypes(filterByCapacity = null) {
  const container = document.getElementById('vehicleTypeSelector');
  if (!container) return;
  
  // Get current passenger count
  const passengerCount = filterByCapacity || parseInt(document.getElementById('passengerCount')?.value || '1');
  
  // Filter vehicles by passenger capacity if count > 7 (but only if not locked to a single type)
  let displayTypes = state.vehicleTypes;
  if (passengerCount > 7 && !state.vehicleTypeLocked) {
    // Show only vehicles that can accommodate 8+ passengers
    displayTypes = state.vehicleTypes.filter(t => (t.passenger_capacity || 4) >= passengerCount);
    
    // Show message if filtered
    if (displayTypes.length === 0) {
      container.innerHTML = `<p class="no-vehicles-msg">No vehicles available for ${passengerCount} passengers. Please contact us for group bookings.</p>`;
      return;
    }
    
    // Show info that vehicles have been filtered
    showToast(`Showing vehicles that accommodate ${passengerCount}+ passengers`, 'info');
  }
  
  // If locked to a single type, show a header indicating this
  const lockedHeader = state.vehicleTypeLocked && displayTypes.length === 1
    ? `<div class="vehicle-type-locked-notice">✓ Your vehicle type</div>`
    : '';
  
  container.innerHTML = lockedHeader + displayTypes.map(type => {
    const capacityText = type.passenger_capacity ? 
      `Up to ${type.passenger_capacity} passengers` : 
      (type.capacity || '');
    const rateInfo = type.base_rate ? `From $${type.base_rate}` : '';
    const isSelected = state.selectedVehicleType === type.id || displayTypes.length === 1;
    
    return `
      <div class="vehicle-type-option ${isSelected ? 'selected' : ''} ${state.vehicleTypeLocked ? 'locked' : ''}" 
           data-type="${type.id}"
           data-capacity="${type.passenger_capacity || 4}"
           data-base-rate="${type.base_rate || 0}"
           data-per-mile="${type.per_mile_rate || 0}"
           data-per-hour="${type.per_hour_rate || 0}">
        <span class="vehicle-icon">${type.icon || '🚗'}</span>
        <span class="vehicle-name">${type.name}</span>
        <span class="vehicle-capacity">${capacityText}</span>
        ${rateInfo ? `<span class="vehicle-rate">${rateInfo}</span>` : ''}
      </div>
    `;
  }).join('');
  
  // Add click handlers only if not locked
  if (!state.vehicleTypeLocked) {
    container.querySelectorAll('.vehicle-type-option').forEach(option => {
      option.addEventListener('click', () => {
        container.querySelectorAll('.vehicle-type-option').forEach(o => o.classList.remove('selected'));
        option.classList.add('selected');
        state.selectedVehicleType = option.dataset.type;
        // Recalculate price when vehicle type changes
        calculatePrice();
      });
    });
  }
  
  // Select default app type or first by default
  if (displayTypes.length > 0 && !state.selectedVehicleType) {
    const defaultType = displayTypes.find(t => t.is_app_default === true) || displayTypes[0];
    state.selectedVehicleType = defaultType.id;
    container.querySelector(`[data-type="${defaultType.id}"]`)?.classList.add('selected');
  }
}

// ============================================
// Airports
// Uses LocalAirportsService with fallback to legacy airports table
// ============================================
async function loadAirports() {
  const creds = getSupabaseCredentials();
  
  // Get organization ID from portal settings or session
  const organizationId = state.customer?.organization_id || 
                         window.portalOrganizationId || 
                         portalSettings.organizationId;
  
  try {
    // First, try LocalAirportsService (uses local_airports table)
    if (organizationId) {
      const localAirports = await LocalAirportsService.getFormattedAirports(organizationId);
      if (localAirports && localAirports.length > 0) {
        console.log('[CustomerPortal] Loaded local airports:', localAirports.length);
        state.airports = localAirports;
      }
    }
    
    // If no local airports, fall back to legacy airports table
    if (state.airports.length === 0) {
      const response = await fetch(
        `${creds.url}/rest/v1/airports?is_active=eq.true&select=*&order=name.asc`,
        {
          headers: {
            'apikey': creds.anonKey
          }
        }
      );
      
      if (response.ok) {
        const legacyAirports = await response.json();
        // Format legacy airports to match local format
        state.airports = legacyAirports.map(a => ({
          code: a.code || a.iata_code,
          iata_code: a.iata_code || a.code,
          name: a.name,
          city: a.city,
          state: a.state,
          address: a.address,
          is_primary: a.is_primary || false,
          source: 'legacy'
        }));
      }
    }
  } catch (err) {
    console.error('[CustomerPortal] Failed to load airports:', err);
  }
  
  // Fallback defaults if no data
  if (state.airports.length === 0) {
    state.airports = [
      { code: 'MSP', name: 'Minneapolis-St. Paul International (MSP)', address: '4300 Glumack Dr, St Paul, MN 55111', is_primary: true },
      { code: 'STP', name: 'St. Paul Downtown Airport (STP)', address: '644 Bayfield St, St Paul, MN 55107' }
    ];
    console.warn('[CustomerPortal] Using hardcoded fallback airports');
  }
  
  // Get customer's preferred airports (from onboarding) and favorite airports
  const preferredAirports = state.customer?.preferred_airports || [];
  const favoriteAirportCodes = state.customer?.favorite_airports || [];
  const preferredCodes = preferredAirports.map(a => a.code);
  
  // Populate airport dropdowns with favorites first, then preferred, then primary, then rest
  ['pickupAirport', 'dropoffAirport'].forEach(id => {
    const select = document.getElementById(id);
    if (select) {
      let html = '<option value="">Select Airport</option>';
      
      // Combine favorites and preferred into one "Your Airports" section
      const customerAirportCodes = [...new Set([...favoriteAirportCodes, ...preferredCodes])];
      
      if (customerAirportCodes.length > 0) {
        html += '<optgroup label="⭐ Your Favorite Airports">';
        customerAirportCodes.forEach(code => {
          const fullAirport = state.airports.find(a => a.code === code);
          if (fullAirport) {
            html += `<option value="${code}" data-address="${fullAirport.address || ''}">${fullAirport.name}</option>`;
          }
        });
        html += '</optgroup>';
        html += '<optgroup label="All Airports">';
      }
      
      // Add primary airports first (excluding customer airports to avoid duplicates)
      const primaryAirports = state.airports.filter(a => a.is_primary && !customerAirportCodes.includes(a.code));
      const otherAirports = state.airports.filter(a => !a.is_primary && !customerAirportCodes.includes(a.code));
      
      if (primaryAirports.length > 0) {
        primaryAirports.forEach(a => {
          html += `<option value="${a.code}" data-address="${a.address || ''}">⭐ ${a.name}</option>`;
        });
      }
      
      // Add other airports
      otherAirports.forEach(a => {
        html += `<option value="${a.code}" data-address="${a.address || ''}">${a.name}</option>`;
      });
      
      if (customerAirportCodes.length > 0) {
        html += '</optgroup>';
      }
      
      select.innerHTML = html;
    }
  });
  
  // Prefill airports AFTER dropdowns are populated (fixes timing issue)
  prefillAirports();
}

// Re-populate airport dropdowns (called after toggling favorites)
function populateAirportDropdowns() {
  const favoriteAirportCodes = state.customer?.favorite_airports || [];
  const preferredAirports = state.customer?.preferred_airports || [];
  const preferredCodes = preferredAirports.map(a => a.code);
  const customerAirportCodes = [...new Set([...favoriteAirportCodes, ...preferredCodes])];
  
  ['pickupAirport', 'dropoffAirport'].forEach(id => {
    const select = document.getElementById(id);
    if (!select) return;
    
    const currentValue = select.value;
    let html = '<option value="">Select Airport</option>';
    
    if (customerAirportCodes.length > 0) {
      html += '<optgroup label="⭐ Your Favorite Airports">';
      customerAirportCodes.forEach(code => {
        const fullAirport = state.airports.find(a => a.code === code);
        if (fullAirport) {
          html += `<option value="${code}" data-address="${fullAirport.address || ''}">${fullAirport.name}</option>`;
        }
      });
      html += '</optgroup>';
      html += '<optgroup label="All Airports">';
    }
    
    const primaryAirports = state.airports.filter(a => a.is_primary && !customerAirportCodes.includes(a.code));
    const otherAirports = state.airports.filter(a => !a.is_primary && !customerAirportCodes.includes(a.code));
    
    primaryAirports.forEach(a => {
      html += `<option value="${a.code}" data-address="${a.address || ''}">⭐ ${a.name}</option>`;
    });
    
    otherAirports.forEach(a => {
      html += `<option value="${a.code}" data-address="${a.address || ''}">${a.name}</option>`;
    });
    
    if (customerAirportCodes.length > 0) {
      html += '</optgroup>';
    }
    
    select.innerHTML = html;
    select.value = currentValue; // Restore selection
  });
}

// ============================================
// Passenger Count Change Handler
// Filters vehicle types based on passenger count
// ============================================
function handlePassengerCountChange(count) {
  console.log('[CustomerPortal] Passenger count changed to:', count);
  
  // If count > 7, show only vehicles that can accommodate
  if (count > 7) {
    // Re-render vehicle types with capacity filter
    renderVehicleTypes(count);
    
    // Check if currently selected vehicle can accommodate
    const selectedVehicle = state.vehicleTypes.find(t => t.id === state.selectedVehicleType);
    if (selectedVehicle && (selectedVehicle.passenger_capacity || 4) < count) {
      // Auto-select a vehicle that can accommodate
      const suitableVehicle = state.vehicleTypes.find(t => (t.passenger_capacity || 4) >= count);
      if (suitableVehicle) {
        state.selectedVehicleType = suitableVehicle.id;
        const container = document.getElementById('vehicleTypeSelector');
        container?.querySelectorAll('.vehicle-type-option').forEach(o => o.classList.remove('selected'));
        container?.querySelector(`[data-type="${suitableVehicle.id}"]`)?.classList.add('selected');
        showToast(`Switched to ${suitableVehicle.name} to accommodate ${count} passengers`, 'info');
      }
    }
  } else {
    // Show all vehicles
    renderVehicleTypes();
  }
  
  // Recalculate price
  calculatePrice();
}

// ============================================
// Trip Type Auto-Selection from Addresses
// ============================================
function updateTripTypeFromAddresses() {
  const pickupType = document.getElementById('pickupAddressSelect')?.value;
  const dropoffType = document.getElementById('dropoffAddressSelect')?.value;
  
  // Get actual addresses to compare for same-location detection
  const pickupAddress = pickupType === 'airport' 
    ? document.getElementById('pickupAirport')?.value 
    : document.getElementById('pickupAddressInput')?.value?.trim();
  const dropoffAddress = dropoffType === 'airport'
    ? document.getElementById('dropoffAirport')?.value
    : document.getElementById('dropoffAddressInput')?.value?.trim();
  
  let newTripType = 'standard'; // Default to point-to-point
  let isLocked = true; // Trip type selection should be locked by default
  let lockReason = '';
  
  // Priority 1: Pickup from airport → From Airport (with MAC fee)
  if (pickupType === 'airport') {
    newTripType = 'from-airport';
    lockReason = 'Airport pickup selected';
  }
  // Priority 2: Dropoff to airport → To Airport (no MAC fee)
  else if (dropoffType === 'airport') {
    newTripType = 'to-airport';
    lockReason = 'Airport dropoff selected';
  }
  // Priority 3: Same pickup/dropoff with stops → Hourly
  else if (pickupAddress && dropoffAddress && pickupAddress === dropoffAddress && state.stops.length > 0) {
    newTripType = 'hourly';
    lockReason = 'Same location with stops - hourly billing';
  }
  // Default: Point-to-point for distance-based billing
  else {
    newTripType = 'standard';
    lockReason = 'Distance-based billing';
  }
  
  // Update radio button selection
  const radio = document.querySelector(`input[name="tripType"][value="${newTripType}"]`);
  if (radio) {
    radio.checked = true;
    state.tripType = newTripType;
    
    // Hide hourly options unless hourly is selected
    const hourlyOptions = document.getElementById('hourlyOptions');
    if (newTripType === 'hourly') {
      hourlyOptions?.classList.remove('hidden');
    } else {
      hourlyOptions?.classList.add('hidden');
    }
  }
  
  // Lock/unlock trip type selection
  lockTripTypeSelection(isLocked, lockReason);
  
  console.log('[CustomerPortal] Auto-selected trip type:', newTripType, '- Locked:', isLocked, '- Reason:', lockReason);
}

// Lock or unlock the trip type radio buttons
function lockTripTypeSelection(lock, reason = '') {
  const tripTypeRadios = document.querySelectorAll('input[name="tripType"]');
  const tripTypeLabels = document.querySelectorAll('.trip-type-option');
  const tripTypeSection = document.querySelector('.trip-type-selector');
  
  tripTypeRadios.forEach(radio => {
    radio.disabled = lock;
  });
  
  tripTypeLabels.forEach(label => {
    if (lock) {
      label.style.opacity = '0.7';
      label.style.cursor = 'not-allowed';
      label.style.pointerEvents = 'none';
    } else {
      label.style.opacity = '1';
      label.style.cursor = 'pointer';
      label.style.pointerEvents = 'auto';
    }
  });
  
  // Add/remove locked indicator
  let lockedIndicator = document.getElementById('tripTypeLocked');
  if (lock && reason) {
    if (!lockedIndicator) {
      lockedIndicator = document.createElement('div');
      lockedIndicator.id = 'tripTypeLocked';
      lockedIndicator.style.cssText = 'font-size: 12px; color: rgba(255,255,255,0.6); margin-top: 8px; display: flex; align-items: center; gap: 6px;';
      tripTypeSection?.parentElement?.appendChild(lockedIndicator);
    }
    lockedIndicator.innerHTML = `<span style="font-size: 14px;">🔒</span> <span>Auto-selected: ${reason}</span>`;
    lockedIndicator.style.display = 'flex';
  } else if (lockedIndicator) {
    lockedIndicator.style.display = 'none';
  }
}

// ============================================
// Dropoff Flight Details Toggle (Optional)
// ============================================
function toggleDropoffFlightDetails() {
  const fields = document.getElementById('dropoffFlightFields');
  const arrow = document.getElementById('dropoffFlightArrow');
  
  if (fields && arrow) {
    const isHidden = fields.classList.contains('hidden');
    fields.classList.toggle('hidden');
    arrow.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
  }
}
// Expose to window for inline onclick
window.toggleDropoffFlightDetails = toggleDropoffFlightDetails;

// ============================================
// Flight Verification
// ============================================
async function verifyFlight() {
  const airlineCode = document.getElementById('airlineCode')?.value || '';
  let flightNumberInput = document.getElementById('flightNumber').value.trim().toUpperCase();
  const arrivalTime = document.getElementById('flightArrivalTime').value;
  const pickupDate = document.getElementById('pickupDate').value;
  
  // Combine airline code with flight number if airline is selected
  let flightNumber = flightNumberInput;
  if (airlineCode && airlineCode !== 'OTHER') {
    // Remove any leading airline code from user input
    flightNumber = flightNumberInput.replace(/^[A-Z]{2}/i, '');
    flightNumber = `${airlineCode}${flightNumber}`;
  }
  
  if (!flightNumber || flightNumber.length < 3) {
    showToast('Please select an airline and enter a flight number', 'warning');
    return;
  }
  
  const verifyBtn = document.getElementById('verifyFlightBtn');
  verifyBtn.disabled = true;
  verifyBtn.innerHTML = '<span class="spinner-sm"></span>';
  verifyBtn.classList.remove('verified', 'error');
  
  const verificationDiv = document.getElementById('flightVerification');
  
  try {
    // Call flight verification API
    const response = await fetch(`/api/flight-verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        flightNumber,
        date: pickupDate
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      
      verificationDiv.classList.remove('hidden');
      const statusEl = verificationDiv.querySelector('.verification-status');
      const infoEl = verificationDiv.querySelector('.flight-info');
      
      if (data.valid) {
        verifyBtn.innerHTML = '✓';
        verifyBtn.classList.add('verified');
        statusEl.className = 'verification-status verified';
        statusEl.innerHTML = '<span class="status-icon">✅</span><span class="status-text">Flight Verified</span>';
        infoEl.innerHTML = `
          <p><strong>${data.airline || ''} ${flightNumber}</strong></p>
          <p>From: ${data.origin || 'N/A'}</p>
          <p>Scheduled Arrival: ${data.arrival_time || arrivalTime}</p>
          ${data.status ? `<p>Status: ${data.status}</p>` : ''}
        `;
        
        // Update arrival time if API provides it
        if (data.arrival_time) {
          document.getElementById('flightArrivalTime').value = data.arrival_time;
        }
      } else {
        verifyBtn.innerHTML = '✗';
        verifyBtn.classList.add('error');
        statusEl.className = 'verification-status error';
        statusEl.innerHTML = '<span class="status-icon">⚠️</span><span class="status-text">Flight Not Found</span>';
        infoEl.innerHTML = `<p>Could not verify flight. Please check the flight number.</p>`;
      }
    } else {
      throw new Error('Verification failed');
    }
  } catch (err) {
    console.error('[CustomerPortal] Flight verification error:', err);
    verifyBtn.innerHTML = '!';
    verifyBtn.classList.add('error');
    verificationDiv.classList.remove('hidden');
    verificationDiv.querySelector('.verification-status').className = 'verification-status';
    verificationDiv.querySelector('.verification-status').innerHTML = 
      '<span class="status-icon">⚠️</span><span class="status-text">Could not verify</span>';
    verificationDiv.querySelector('.flight-info').innerHTML = 
      '<p>Flight verification service unavailable. Please verify details manually.</p>';
  } finally {
    verifyBtn.disabled = false;
  }
}

// ============================================
// Passenger Management
// ============================================
function populatePassengerDropdown() {
  const select = document.getElementById('passengerSelect');
  if (!select) return;
  
  console.log('[CustomerPortal] Populating passenger dropdown, customer:', state.customer);
  
  // Self is always first - show customer's actual name
  const selfName = state.customer ? 
    `${state.customer.first_name || ''} ${state.customer.last_name || ''}`.trim() || 'Myself' : 
    'Myself';
  console.log('[CustomerPortal] Self name for dropdown:', selfName);
  select.innerHTML = `<option value="self">${selfName}</option>`;
  
  // Add saved passengers (excluding primary/self which is the account holder)
  state.savedPassengers.forEach(p => {
    if (!p.is_primary && p.relationship !== 'self') {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = `${p.first_name} ${p.last_name}${p.relationship ? ` (${p.relationship})` : ''}`;
      select.appendChild(opt);
    }
  });
  
  // Add "New Passenger" option
  const newOpt = document.createElement('option');
  newOpt.value = 'new';
  newOpt.textContent = '+ Add New Passenger';
  select.appendChild(newOpt);
  
  // Fill with "self" by default
  fillPassengerDetails('self');
}

function fillPassengerDetails(passengerId) {
  console.log('[CustomerPortal] fillPassengerDetails called with:', passengerId);
  
  if (passengerId === 'new') {
    // Open new passenger modal
    openModal('passengerModal');
    return;
  }
  
  let passenger;
  
  if (passengerId === 'self') {
    passenger = state.customer;
    console.log('[CustomerPortal] Using self/customer data:', passenger);
  } else {
    passenger = state.savedPassengers.find(p => p.id == passengerId);
  }
  
  // Get DOM elements
  const firstNameInput = document.getElementById('passengerFirstName');
  const lastNameInput = document.getElementById('passengerLastName');
  const phoneInput = document.getElementById('passengerPhone');
  const emailInput = document.getElementById('passengerEmail');
  
  if (passenger) {
    console.log('[CustomerPortal] Filling passenger details:', {
      first_name: passenger.first_name,
      last_name: passenger.last_name,
      phone: passenger.cell_phone || passenger.phone,
      email: passenger.email
    });
    
    if (firstNameInput) firstNameInput.value = passenger.first_name || '';
    if (lastNameInput) lastNameInput.value = passenger.last_name || '';
    // Check both cell_phone and phone fields (customer may have cell_phone from onboarding)
    if (phoneInput) phoneInput.value = passenger.cell_phone || passenger.phone || '';
    if (emailInput) emailInput.value = passenger.email || '';
    
    console.log('[CustomerPortal] Passenger form filled successfully');
  } else {
    console.warn('[CustomerPortal] No passenger data found for:', passengerId);
    // Clear the fields if no passenger data
    if (firstNameInput) firstNameInput.value = '';
    if (lastNameInput) lastNameInput.value = '';
    if (phoneInput) phoneInput.value = '';
    if (emailInput) emailInput.value = '';
  }
}

async function addNewPassenger() {
  const firstName = document.getElementById('newPassengerFirstName').value.trim();
  const lastName = document.getElementById('newPassengerLastName').value.trim();
  const phone = document.getElementById('newPassengerPhone').value.trim();
  const email = document.getElementById('newPassengerEmail').value.trim();
  const relationship = document.getElementById('newPassengerRelationship')?.value || 'other';
  
  if (!firstName || !lastName) {
    showToast('Please enter first and last name', 'error');
    return;
  }
  
  // ALWAYS save passenger for future use in the dropdown
  let newPassengerId = null;
  try {
    const creds = getSupabaseCredentials();
    
    // First check if this passenger already exists (by name)
    const checkResponse = await fetch(
      `${creds.url}/rest/v1/customer_passengers?account_id=eq.${state.customer?.id}&first_name=ilike.${encodeURIComponent(firstName)}&last_name=ilike.${encodeURIComponent(lastName)}&select=*`,
      {
        headers: {
          'apikey': creds.anonKey,
          'Authorization': `Bearer ${state.session?.access_token}`
        }
      }
    );
    
    if (checkResponse.ok) {
      const existing = await checkResponse.json();
      
      if (existing.length > 0) {
        // Update existing passenger
        newPassengerId = existing[0].id;
        await fetch(
          `${creds.url}/rest/v1/customer_passengers?id=eq.${existing[0].id}`,
          {
            method: 'PATCH',
            headers: {
              'apikey': creds.anonKey,
              'Authorization': `Bearer ${state.session?.access_token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              phone: phone || existing[0].phone,
              email: email || existing[0].email,
              relationship: relationship,
              usage_count: (existing[0].usage_count || 0) + 1,
              last_used_at: new Date().toISOString(),
              is_visible: true
            })
          }
        );
        
        // Update in state
        const stateIdx = state.savedPassengers.findIndex(p => p.id === existing[0].id);
        if (stateIdx >= 0) {
          state.savedPassengers[stateIdx] = {
            ...state.savedPassengers[stateIdx],
            phone: phone || existing[0].phone,
            email: email || existing[0].email,
            relationship: relationship,
            is_visible: true
          };
        } else {
          state.savedPassengers.push({...existing[0], phone, email, relationship, is_visible: true});
        }
        
        console.log('[CustomerPortal] Updated existing passenger:', newPassengerId);
      } else {
        // Insert new passenger
        const response = await fetch(`${creds.url}/rest/v1/customer_passengers`, {
          method: 'POST',
          headers: {
            'apikey': creds.anonKey,
            'Authorization': `Bearer ${state.session?.access_token}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({
            account_id: state.customer?.id,
            first_name: firstName,
            last_name: lastName,
            phone: phone,
            email: email,
            relationship: relationship,
            is_primary: false,
            is_visible: true,
            usage_count: 1,
            last_used_at: new Date().toISOString()
          })
        });
        
        if (response.ok) {
          const newPassengers = await response.json();
          if (newPassengers?.length > 0) {
            state.savedPassengers.push(newPassengers[0]);
            newPassengerId = newPassengers[0].id;
            console.log('[CustomerPortal] Created new passenger:', newPassengerId);
          }
        }
      }
    }
  } catch (err) {
    console.error('[CustomerPortal] Failed to save passenger:', err);
  }
  
  // Update booking form fields
  document.getElementById('passengerFirstName').value = firstName;
  document.getElementById('passengerLastName').value = lastName;
  document.getElementById('passengerPhone').value = phone;
  document.getElementById('passengerEmail').value = email;
  
  // Update dropdown with new passengers
  populatePassengerDropdown();
  
  // Select the newly added passenger in the dropdown
  if (newPassengerId) {
    document.getElementById('passengerSelect').value = newPassengerId;
  }
  
  // Clear the modal form for next use
  document.getElementById('newPassengerFirstName').value = '';
  document.getElementById('newPassengerLastName').value = '';
  document.getElementById('newPassengerPhone').value = '';
  document.getElementById('newPassengerEmail').value = '';
  
  // Close modal
  closeModal('passengerModal');
  showToast('Passenger saved for future use', 'success');
}

// Delete (hide) a saved passenger
async function deletePassenger(passengerId) {
  if (!confirm('Remove this passenger from your saved list?')) return;
  
  try {
    const creds = getSupabaseCredentials();
    await fetch(`${creds.url}/rest/v1/customer_passengers?id=eq.${passengerId}`, {
      method: 'PATCH',
      headers: {
        'apikey': creds.anonKey,
        'Authorization': `Bearer ${state.session?.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ is_visible: false })
    });
    
    state.savedPassengers = state.savedPassengers.filter(p => p.id != passengerId);
    populatePassengerDropdown();
    showToast('Passenger removed', 'success');
  } catch (err) {
    console.error('[CustomerPortal] Failed to delete passenger:', err);
    showToast('Failed to remove passenger', 'error');
  }
}

// ============================================
// Address Management
// ============================================
function populateAddressDropdowns() {
  console.log('[CustomerPortal] populateAddressDropdowns called');
  console.log('[CustomerPortal] state.savedAddresses:', state.savedAddresses);
  console.log('[CustomerPortal] Length:', state.savedAddresses?.length || 0);
  
  ['savedPickupAddresses', 'savedDropoffAddresses'].forEach(containerId => {
    const container = document.getElementById(containerId);
    console.log('[CustomerPortal] Container', containerId, ':', container ? 'found' : 'NOT FOUND');
    if (!container) return;
    
    // If no addresses, show empty state
    if (!state.savedAddresses || state.savedAddresses.length === 0) {
      container.innerHTML = '<p class="empty-hint" style="padding: 12px; color: #6b7280; text-align: center;">No saved addresses yet. Add addresses from My Account tab.</p>';
      console.log('[CustomerPortal] No addresses, showing empty state');
      return;
    }
    
    // Sort: favorites first, then by usage count
    const sortedAddresses = [...state.savedAddresses].sort((a, b) => {
      if (a.is_favorite && !b.is_favorite) return -1;
      if (!a.is_favorite && b.is_favorite) return 1;
      return (b.usage_count || 0) - (a.usage_count || 0);
    });
    
    // Use full_address field name from database
    let html = sortedAddresses.map(addr => {
      const address = addr.full_address || addr.address || '';
      const label = addr.label || 'Saved';
      const icon = label.toLowerCase() === 'home' ? '🏠' : 
                   label.toLowerCase() === 'work' ? '🏢' : 
                   addr.address_type === 'airport' ? '✈️' : '📍';
      const starClass = addr.is_favorite ? 'favorite-active' : '';
      // Use ★ (filled) when favorite, ☆ (outline) when not
      const starIcon = addr.is_favorite ? '★' : '☆';
      
      return `
        <div class="saved-address-item" data-id="${addr.id}" data-address="${address}">
          <span class="address-icon">${icon}</span>
          <div class="address-content">
            <div class="address-label">${label}</div>
            <div class="address-text">${address}</div>
          </div>
          <button type="button" class="address-favorite ${starClass}" data-id="${addr.id}" title="${addr.is_favorite ? 'Remove from favorites' : 'Add to favorites'}">${starIcon}</button>
          <button type="button" class="address-delete" data-id="${addr.id}" title="Delete">🗑️</button>
        </div>
      `;
    }).join('');
    
    container.innerHTML = html;
    
    // Add click handlers
    container.querySelectorAll('.saved-address-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.classList.contains('address-delete') || e.target.classList.contains('address-favorite')) return;
        
        const addressType = containerId.includes('Pickup') ? 'pickup' : 'dropoff';
        selectSavedAddress(item.dataset.id, item.dataset.address, addressType);
      });
    });
    
    // Favorite handlers
    container.querySelectorAll('.address-favorite').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleAddressFavorite(btn.dataset.id);
      });
    });
    
    // Delete handlers
    container.querySelectorAll('.address-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteSavedAddress(btn.dataset.id);
      });
    });
  });
}

function selectSavedAddress(id, address, type) {
  if (type === 'pickup') {
    state.selectedPickupAddress = address;
    document.getElementById('pickupAddressInput').value = address;
    // Update the dropdown to show selected address
    updateAddressSelectDropdown('pickup', address);
    // Hide the saved addresses list
    document.getElementById('savedPickupAddresses').classList.add('hidden');
  } else {
    state.selectedDropoffAddress = address;
    document.getElementById('dropoffAddressInput').value = address;
    // Update the dropdown to show selected address
    updateAddressSelectDropdown('dropoff', address);
    // Hide the saved addresses list
    document.getElementById('savedDropoffAddresses').classList.add('hidden');
  }
  
  // Increment usage count
  incrementAddressUsage(id);
  
  // Trigger route/price calculation
  calculateRouteAndPrice();
}

// Update the address select dropdown to show the selected address
function updateAddressSelectDropdown(type, selectedAddress) {
  const selectId = type === 'pickup' ? 'pickupAddressSelect' : 'dropoffAddressSelect';
  const select = document.getElementById(selectId);
  if (!select) return;
  
  // Remove any existing selected-address option
  const existingSelected = select.querySelector('option[value="selected"]');
  if (existingSelected) {
    existingSelected.remove();
  }
  
  if (selectedAddress) {
    // Truncate address for display if too long
    const displayAddress = selectedAddress.length > 50 
      ? selectedAddress.substring(0, 47) + '...' 
      : selectedAddress;
    
    // Add the selected address as the first option after the placeholder
    const selectedOption = document.createElement('option');
    selectedOption.value = 'selected';
    selectedOption.textContent = `📍 ${displayAddress}`;
    selectedOption.selected = true;
    
    // Insert after the first option (placeholder)
    select.insertBefore(selectedOption, select.options[1]);
  }
  
  // Set the dropdown to show the selected address
  select.value = selectedAddress ? 'selected' : '';
}

// Clear selected address and update dropdown
function clearSelectedAddress(type) {
  if (type === 'pickup') {
    state.selectedPickupAddress = null;
    document.getElementById('pickupAddressInput').value = '';
  } else {
    state.selectedDropoffAddress = null;
    document.getElementById('dropoffAddressInput').value = '';
  }
  
  // Remove the selected option from dropdown
  updateAddressSelectDropdown(type, null);
  
  // Recalculate route
  calculateRouteAndPrice();
}

async function incrementAddressUsage(addressId) {
  try {
    const creds = getSupabaseCredentials();
    await fetch(`${creds.url}/rest/v1/rpc/increment_address_usage`, {
      method: 'POST',
      headers: {
        'apikey': creds.anonKey,
        'Authorization': `Bearer ${state.session?.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ address_id: addressId })
    });
  } catch (err) {
    // Silent fail - not critical
  }
}

async function deleteSavedAddress(addressId) {
  if (!confirm('Remove this address from your saved addresses?')) return;
  
  try {
    const creds = getSupabaseCredentials();
    await fetch(`${creds.url}/rest/v1/customer_addresses?id=eq.${addressId}`, {
      method: 'PATCH',
      headers: {
        'apikey': creds.anonKey,
        'Authorization': `Bearer ${state.session?.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ is_deleted: true })
    });
    
    state.savedAddresses = state.savedAddresses.filter(a => a.id != addressId);
    populateAddressDropdowns();
    renderSavedAddresses();
    showToast('Address removed', 'success');
  } catch (err) {
    console.error('[CustomerPortal] Failed to delete address:', err);
    showToast('Failed to remove address', 'error');
  }
}

async function toggleAddressFavorite(addressId) {
  try {
    const creds = getSupabaseCredentials();
    const address = state.savedAddresses.find(a => a.id == addressId);
    if (!address) return;
    
    const newFavoriteStatus = !address.is_favorite;
    
    await fetch(`${creds.url}/rest/v1/customer_addresses?id=eq.${addressId}`, {
      method: 'PATCH',
      headers: {
        'apikey': creds.anonKey,
        'Authorization': `Bearer ${state.session?.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ is_favorite: newFavoriteStatus })
    });
    
    // Update local state
    address.is_favorite = newFavoriteStatus;
    
    // Re-render both dropdowns and the saved addresses list
    populateAddressDropdowns();
    renderSavedAddresses();
    
    showToast(newFavoriteStatus ? 'Added to favorites ⭐' : 'Removed from favorites', 'success');
  } catch (err) {
    console.error('[CustomerPortal] Failed to toggle favorite:', err);
    showToast('Failed to update favorite', 'error');
  }
}

async function saveNewAddress() {
  const label = document.getElementById('newAddressLabel').value.trim();
  const address = document.getElementById('newAddressInput').value.trim();
  
  if (!label || !address) {
    showToast('Please fill in all fields', 'error');
    return;
  }
  
  try {
    const creds = getSupabaseCredentials();
    console.log('[CustomerPortal] Saving new address for account:', state.customer?.id);
    
    const payload = {
      account_id: state.customer?.id,
      label,
      full_address: address,
      is_deleted: false,
      is_visible: true,
      usage_count: 0
    };
    console.log('[CustomerPortal] Address payload:', payload);
    
    const response = await fetch(`${creds.url}/rest/v1/customer_addresses`, {
      method: 'POST',
      headers: {
        'apikey': creds.anonKey,
        'Authorization': `Bearer ${state.session?.access_token}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(payload)
    });
    
    if (response.ok) {
      const newAddresses = await response.json();
      console.log('[CustomerPortal] Address saved successfully:', newAddresses);
      if (newAddresses?.length > 0) {
        state.savedAddresses.push(newAddresses[0]);
      }
      populateAddressDropdowns();
      closeModal('addressModal');
      showToast('Address saved', 'success');
    } else {
      const errorText = await response.text();
      console.error('[CustomerPortal] Address save failed:', response.status, errorText);
      showToast(`Failed to save address: ${response.status}`, 'error');
    }
  } catch (err) {
    console.error('[CustomerPortal] Failed to save address:', err);
    showToast('Failed to save address', 'error');
  }
}

// ============================================
// Stops Management
// ============================================

// ============================================
// PREFILL BOOKING DEFAULTS
// Auto-fills booking form with customer profile data
// ============================================
function prefillBookingDefaults() {
  console.log('[CustomerPortal] Prefilling booking defaults...');
  
  if (!state.customer) {
    console.warn('[CustomerPortal] No customer data for prefill');
    return;
  }
  
  console.log('[CustomerPortal] Customer data available:', {
    first_name: state.customer.first_name,
    last_name: state.customer.last_name,
    email: state.customer.email,
    phone: state.customer.phone,
    cell_phone: state.customer.cell_phone
  });
  
  // 1. ALWAYS prefill passenger details with customer's own info (default to "Myself")
  // Set the dropdown to "self" first
  const passengerSelect = document.getElementById('passengerSelect');
  if (passengerSelect) {
    passengerSelect.value = 'self';
  }
  
  // Then fill the details - use setTimeout to ensure DOM is fully ready
  setTimeout(() => {
    fillPassengerDetails('self');
  }, 50);
  
  // 2. Show saved addresses section automatically if customer has saved addresses
  if (state.savedAddresses && state.savedAddresses.length > 0) {
    // Show the saved addresses section for pickup
    const pickupSelect = document.getElementById('pickupAddressSelect');
    if (pickupSelect) {
      pickupSelect.value = 'saved';
      // Trigger change to show saved addresses
      const event = new Event('change', { bubbles: true });
      pickupSelect.dispatchEvent(event);
    }
    
    // Pre-select the home address if available
    const homeAddress = findHomeAddress();
    if (homeAddress) {
      setTimeout(() => {
        selectSavedAddress(homeAddress.id, homeAddress.full_address || homeAddress.address, 'pickup');
      }, 100);
    }
  } else if (state.customer.home_address) {
    // Fallback: If no saved addresses but home_address is set on account, prefill pickup input
    const pickupSelect = document.getElementById('pickupAddressSelect');
    if (pickupSelect) {
      pickupSelect.value = 'new';
      const event = new Event('change', { bubbles: true });
      pickupSelect.dispatchEvent(event);
    }
    setTimeout(() => {
      const pickupInput = document.getElementById('pickupAddressInput');
      if (pickupInput) {
        pickupInput.value = state.customer.home_address;
        state.selectedPickupAddress = state.customer.home_address;
      }
    }, 100);
  }
  
  // 3. Airport prefill is now handled by prefillAirports() after airports are loaded
  // This fixes the timing issue where airports weren't populated yet
  
  // 4. Set default passenger count
  const passengerCount = state.customer.default_passenger_count || 1;
  const countInput = document.getElementById('passengerCount');
  if (countInput) {
    countInput.value = passengerCount;
  }
  
  // 5. Set preferred vehicle type if available
  if (state.customer.preferred_vehicle_type) {
    setTimeout(() => {
      selectVehicleType(state.customer.preferred_vehicle_type);
    }, 200);
  }
  
  // 6. Set default date to tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateInput = document.getElementById('pickupDate');
  if (dateInput) {
    dateInput.value = tomorrow.toISOString().split('T')[0];
    dateInput.min = new Date().toISOString().split('T')[0]; // Can't book past dates
  }
  
  console.log('[CustomerPortal] Booking defaults prefilled');
}

// Prefill airport selects (called after airports are loaded)
function prefillAirports() {
  if (!state.customer) return;
  
  // Set preferred pickup airport (check both home_airport and preferred_pickup_airport)
  const preferredPickupAirport = state.customer.preferred_pickup_airport || state.customer.home_airport;
  if (preferredPickupAirport) {
    const pickupAirport = document.getElementById('pickupAirport');
    if (pickupAirport) {
      pickupAirport.value = preferredPickupAirport;
      console.log('[CustomerPortal] Prefilled pickup airport:', preferredPickupAirport);
    }
  }
  
  // Set preferred dropoff airport (use home_airport if no preferred_dropoff)
  const preferredDropoffAirport = state.customer.preferred_dropoff_airport || state.customer.home_airport;
  if (preferredDropoffAirport) {
    const dropoffAirport = document.getElementById('dropoffAirport');
    if (dropoffAirport) {
      dropoffAirport.value = preferredDropoffAirport;
      console.log('[CustomerPortal] Prefilled dropoff airport:', preferredDropoffAirport);
    }
  }
}

// Find the home address from saved addresses
function findHomeAddress() {
  // Priority: 1. label = 'Home', 2. address_type = 'home', 3. is_favorite
  return state.savedAddresses.find(a => a.label?.toLowerCase() === 'home') ||
         state.savedAddresses.find(a => a.address_type === 'home') ||
         state.savedAddresses.find(a => a.is_favorite);
}

// Select a vehicle type by ID or name
function selectVehicleType(typeIdOrName) {
  const container = document.getElementById('vehicleTypeSelector');
  if (!container) return;
  
  const cards = container.querySelectorAll('.vehicle-card');
  cards.forEach(card => {
    const isMatch = card.dataset.id === typeIdOrName || 
                    card.dataset.name?.toLowerCase() === typeIdOrName?.toLowerCase();
    card.classList.toggle('selected', isMatch);
    if (isMatch) {
      state.selectedVehicleType = card.dataset.id;
    }
  });
}

function addStop() {
  const stopIndex = state.stops.length + 1;
  state.stops.push({ address: '', order: stopIndex });
  renderStops();
  // Re-check trip type in case pickup/dropoff are same with stops
  updateTripTypeFromAddresses();
}

function removeStop(index) {
  state.stops.splice(index, 1);
  // Re-order
  state.stops.forEach((s, i) => s.order = i + 1);
  renderStops();
  // Re-check trip type in case no more stops with same location
  updateTripTypeFromAddresses();
}

function renderStops() {
  const container = document.getElementById('stopsContainer');
  if (!container) return;
  
  if (state.stops.length === 0) {
    container.innerHTML = '<p class="no-stops">No stops added</p>';
    return;
  }
  
  container.innerHTML = state.stops.map((stop, i) => `
    <div class="stop-item" data-index="${i}">
      <span class="stop-number">${i + 1}</span>
      <input type="text" class="form-input stop-address" placeholder="Enter stop address..." 
             value="${stop.address}" data-index="${i}">
      <button type="button" class="stop-remove" data-index="${i}">✕</button>
    </div>
  `).join('');
  
  // Add event listeners
  container.querySelectorAll('.stop-address').forEach(input => {
    input.addEventListener('change', (e) => {
      state.stops[parseInt(e.target.dataset.index)].address = e.target.value;
    });
  });
  
  container.querySelectorAll('.stop-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      removeStop(parseInt(btn.dataset.index));
    });
  });
}

// ============================================
// Default Driver Assignment
// Gets default drivers and checks for conflicts
// ============================================

/**
 * Get all drivers marked as default for In-House reservations
 */
async function getDefaultDrivers() {
  try {
    const creds = getSupabaseCredentials();
    const response = await fetch(
      `${creds.url}/rest/v1/drivers?is_default_driver=eq.true&is_active=eq.true&select=*`,
      {
        headers: {
          'apikey': creds.anonKey
        }
      }
    );
    
    if (response.ok) {
      const drivers = await response.json();
      console.log('[CustomerPortal] Default drivers:', drivers.length);
      return drivers;
    }
  } catch (err) {
    console.error('[CustomerPortal] Failed to load default drivers:', err);
  }
  return [];
}

/**
 * Check if a driver has a conflicting reservation at the given time
 * Uses garage_out_time and garage_in_time to determine conflicts
 */
async function checkDriverConflict(driverId, pickupDateTime) {
  try {
    const creds = getSupabaseCredentials();
    const pickupDate = pickupDateTime.split('T')[0];
    
    // Get all reservations for this driver on the same day
    // Use pu_date field which is the actual column name
    const response = await fetch(
      `${creds.url}/rest/v1/reservations?assigned_driver_id=eq.${driverId}&pu_date=eq.${pickupDate}&select=id,pu_date,pu_time,pickup_date_time,garage_out_time,garage_in_time,status`,
      {
        headers: {
          'apikey': creds.anonKey
        }
      }
    );
    
    if (!response.ok) return false;
    
    const reservations = await response.json();
    const newPickupTime = new Date(pickupDateTime);
    
    // Estimated duration for this trip: 2 hours default if no route info
    const estimatedDuration = state.routeInfo?.durationSeconds 
      ? state.routeInfo.durationSeconds / 60 
      : 120;
    
    // Calculate estimated garage times for new reservation
    const newGarageOut = new Date(newPickupTime.getTime() - 30 * 60000); // 30 min before pickup
    const newGarageIn = new Date(newPickupTime.getTime() + estimatedDuration * 60000 + 15 * 60000); // trip + 15 min
    
    for (const res of reservations) {
      // Skip cancelled reservations
      if (res.status?.toLowerCase()?.includes('cancel')) continue;
      
      // Get garage times from reservation, or calculate from pickup
      let garageOut, garageIn;
      const resPickupTime = res.pickup_datetime || res.pickup_date_time;
      
      if (res.garage_out_time) {
        // Parse garage times (they're stored as time strings like "14:30")
        const [outHour, outMin] = res.garage_out_time.split(':').map(Number);
        garageOut = new Date(new Date(resPickupTime).setHours(outHour, outMin, 0, 0));
      } else {
        // Default: 30 min before pickup
        garageOut = new Date(new Date(resPickupTime).getTime() - 30 * 60000);
      }
      
      if (res.garage_in_time) {
        const [inHour, inMin] = res.garage_in_time.split(':').map(Number);
        garageIn = new Date(new Date(resPickupTime).setHours(inHour, inMin, 0, 0));
        // If garage in is before garage out, it must be next day
        if (garageIn < garageOut) {
          garageIn.setDate(garageIn.getDate() + 1);
        }
      } else {
        // Default: 2 hours after pickup
        garageIn = new Date(new Date(resPickupTime).getTime() + 150 * 60000);
      }
      
      // Check for overlap: new trip's garage window overlaps with existing trip
      // Overlap if: newGarageOut < existingGarageIn AND newGarageIn > existingGarageOut
      if (newGarageOut < garageIn && newGarageIn > garageOut) {
        console.log(`[CustomerPortal] Driver conflict found with reservation ${res.id}`);
        return true; // Conflict found
      }
    }
    
    return false; // No conflict
  } catch (err) {
    console.error('[CustomerPortal] Error checking driver conflict:', err);
    return false; // Assume no conflict on error
  }
}

/**
 * Find an available default driver for the given pickup time
 */
async function findAvailableDefaultDriver(pickupDateTime) {
  const defaultDrivers = await getDefaultDrivers();
  
  if (defaultDrivers.length === 0) {
    console.log('[CustomerPortal] No default drivers configured');
    return null;
  }
  
  // Check each default driver for conflicts
  for (const driver of defaultDrivers) {
    const hasConflict = await checkDriverConflict(driver.id, pickupDateTime);
    if (!hasConflict) {
      console.log(`[CustomerPortal] Found available default driver: ${driver.first_name} ${driver.last_name}`);
      return driver;
    }
  }
  
  console.log('[CustomerPortal] All default drivers have conflicts');
  return null; // All default drivers are busy
}

/**
 * Check if auto-farm mode is enabled
 */
function isAutoFarmEnabled() {
  // Check localStorage setting (set in admin settings)
  return localStorage.getItem('autoFarmoutMode') === 'true';
}

// ============================================
// Booking
// ============================================
async function bookTrip(includeReturn = false) {
  // Validate form
  const validation = validateBookingForm();
  if (!validation.valid) {
    showToast(validation.message, 'error');
    return;
  }
  
  const bookBtn = includeReturn ? 
    document.getElementById('bookRoundTripBtn') : 
    document.getElementById('bookOneWayBtn');
  
  bookBtn.disabled = true;
  bookBtn.textContent = 'Booking...';
  
  try {
    // Get next confirmation number
    const confirmationNumber = await getNextConfirmationNumber();
    
    // Build reservation data
    const reservationData = buildReservationData();
    reservationData.confirmation_number = String(confirmationNumber); // Must be text for database
    
    // ============================================
    // Determine Assignment Based on Auto-Farm Toggle
    // ============================================
    const autoFarmEnabled = isAutoFarmEnabled();
    console.log('[CustomerPortal] Auto-farm mode:', autoFarmEnabled);
    
    if (autoFarmEnabled) {
      // AUTO-FARM ON: Set to Farm-out Unassigned with automatic mode
      reservationData.driver_id = null;
      reservationData.status = 'pending'; // Valid DB status
      reservationData.farm_option = 'farm_out';
      reservationData.farmout_status = 'unassigned';
      reservationData.farmout_mode = 'automatic';
      console.log('[CustomerPortal] Auto-farm enabled: Setting to Farm-out Unassigned (automatic)');
    } else {
      // AUTO-FARM OFF: Try to assign default driver
      reservationData.farmout_mode = 'manual';
      
      // Try to find an available default driver
      const pickupDateTime = reservationData.pickup_date_time;
      const availableDriver = await findAvailableDefaultDriver(pickupDateTime);
      
      if (availableDriver) {
        // Assign the default driver
        // Set Farm-out radio with Farm-out Assigned status
        reservationData.farm_option = 'farm-out';  // Radio button set to Farm-out - REQUIRED for farmout list
        reservationData.assigned_driver_id = availableDriver.id;
        reservationData.assigned_driver_name = `${availableDriver.first_name || ''} ${availableDriver.last_name || ''}`.trim();
        reservationData.driver_phone = availableDriver.phone || availableDriver.cell_phone;
        reservationData.driver_status = 'assigned'; // Directly assigned, not offered
        reservationData.status = 'confirmed'; // Valid DB status for assigned trips
        reservationData.farmout_status = 'assigned'; // DB farmout_status value
        
        // Set fleet vehicle from driver's assigned vehicle
        if (availableDriver.fleet_vehicle_id) {
          reservationData.fleet_vehicle_id = availableDriver.fleet_vehicle_id;
          console.log(`[CustomerPortal] ✅ Set fleet vehicle from driver: ${availableDriver.fleet_vehicle_id}`);
        }
        
        console.log(`[CustomerPortal] ✅ Assigned default driver: ${reservationData.assigned_driver_name} (${availableDriver.id})`);
      } else {
        // No default driver available - leave unassigned In-House
        reservationData.farm_option = 'in-house';
        reservationData.assigned_driver_id = null;
        reservationData.status = 'pending'; // Valid DB status for unassigned trips
        reservationData.farmout_status = 'unassigned'; // In-House but no driver yet
        console.log('[CustomerPortal] No default driver available: Setting to In-House Unassigned');
      }
    }
    
    // Validate required database fields
    if (!reservationData.organization_id) {
      throw new Error('Missing organization_id - cannot create reservation');
    }
    if (!reservationData.booked_by_user_id) {
      throw new Error('Missing user session - please log in again');
    }
    
    console.log('[CustomerPortal] Reservation data:', {
      confirmation_number: reservationData.confirmation_number,
      organization_id: reservationData.organization_id,
      booked_by_user_id: reservationData.booked_by_user_id,
      account_id: reservationData.account_id,
      pickup_address: reservationData.pickup_address,
      dropoff_address: reservationData.dropoff_address,
      vehicle_type: reservationData.vehicle_type,
      service_type: reservationData.service_type,
      status: reservationData.status,
      farm_option: reservationData.farm_option,
      farmout_mode: reservationData.farmout_mode,
      farmout_status: reservationData.farmout_status,
      assigned_driver_id: reservationData.assigned_driver_id,
      assigned_driver_name: reservationData.assigned_driver_name,
      driver_status: reservationData.driver_status,
      fleet_vehicle_id: reservationData.fleet_vehicle_id,
      grand_total: reservationData.total_price,
      rate_amount: reservationData.rate_amount,
      rate_type: reservationData.rate_type
    });
    
    // Save passenger to customer_passengers table for future use
    const passengerFirstName = document.getElementById('passengerFirstName').value.trim();
    const passengerLastName = document.getElementById('passengerLastName').value.trim();
    const passengerPhone = document.getElementById('passengerPhone').value.trim();
    const passengerEmail = document.getElementById('passengerEmail').value.trim();
    const passengerSelect = document.getElementById('passengerSelect').value;
    
    await savePassenger(
      passengerFirstName, 
      passengerLastName, 
      passengerPhone, 
      passengerEmail,
      passengerSelect === 'self',
      passengerSelect === 'self' ? 'self' : 'other'
    );
    
    // If passenger is different from billing (booker), create a passenger-only account
    if (passengerSelect !== 'self') {
      const billingFirstName = state.customer?.first_name?.toLowerCase() || '';
      const billingLastName = state.customer?.last_name?.toLowerCase() || '';
      const paxFirstName = passengerFirstName.toLowerCase();
      const paxLastName = passengerLastName.toLowerCase();
      
      // Check if passenger name differs from billing account holder
      if (paxFirstName !== billingFirstName || paxLastName !== billingLastName) {
        console.log('[CustomerPortal] Creating separate passenger account for:', passengerFirstName, passengerLastName);
        await createPassengerAccount(passengerFirstName, passengerLastName, passengerPhone, passengerEmail);
      }
    }
    
    // Valid reservation columns in the database (exact match from api-service.js)
    const VALID_COLUMNS = new Set([
      'id', 'organization_id', 'confirmation_number', 'status', 'account_id',
      'passenger_name', 'passenger_count', 'vehicle_type', 'trip_type', 'service_type',
      'pickup_datetime', 'pickup_address', 'pickup_city', 'pickup_state', 'pickup_zip', 'pickup_lat', 'pickup_lon',
      'dropoff_datetime', 'dropoff_address', 'dropoff_city', 'dropoff_state', 'dropoff_zip', 'dropoff_lat', 'dropoff_lon',
      'pu_address', 'do_address',
      'assigned_driver_id', 'assigned_driver_name', 'driver_status', 'fleet_vehicle_id',
      'grand_total', 'rate_type', 'rate_amount', 'payment_type', 'currency',
      'farm_option', 'farmout_status', 'farmout_mode', 'farmout_notes', 'farmout_attempts', 'farmout_declined_drivers',
      'current_offer_driver_id', 'current_offer_sent_at', 'current_offer_expires_at',
      'notes', 'special_instructions', 'timezone', 'form_snapshot',
      'created_at', 'updated_at', 'created_by', 'updated_by', 'booked_by_user_id'
    ]);
    
    // Filter to valid columns only, store extras in form_snapshot
    const dbData = {};
    const extraData = {};
    
    for (const [key, value] of Object.entries(reservationData)) {
      if (VALID_COLUMNS.has(key) && value !== undefined && value !== null) {
        dbData[key] = value;
      } else if (value !== undefined && value !== null) {
        extraData[key] = value;
      }
    }
    
    // Build form_snapshot with extra data
    // Determine status and farm settings based on assignment state (autoFarmEnabled already declared above)
    // IMPORTANT: Status values must match the resStatus dropdown in reservation-form.html
    // Valid values: farm_out_unassigned, farm_out_assigned, created_farm_out_assigned, offered, etc.
    let statusLabel, statusValue, farmOptionValue, eFarmStatusValue;
    if (autoFarmEnabled) {
      // Auto-farm mode: Farm-out with unassigned status
      statusLabel = 'Farm-out Unassigned';
      statusValue = 'farm_out_unassigned';  // Matches dropdown value
      farmOptionValue = 'farm-out';
      eFarmStatusValue = 'Farm-out Unassigned';
    } else if (reservationData.assigned_driver_id) {
      // Default driver assigned: Farm-out Assigned status
      statusLabel = 'Farm-out Assigned';
      statusValue = 'farm_out_assigned';  // Matches dropdown value
      farmOptionValue = 'farm-out';  // Radio button set to Farm-out
      eFarmStatusValue = 'Farm-out Assigned';  // eFarm status display
    } else {
      // No driver: In-House unassigned
      statusLabel = 'Unassigned';
      statusValue = 'unassigned';
      farmOptionValue = 'in-house';
      eFarmStatusValue = 'unassigned';
    }
    
    // Parse pickup date/time for form
    const pickupDT = reservationData.pickup_date_time || '';
    const [puDate, puTimeFull] = pickupDT.split('T');
    const puTime = puTimeFull ? puTimeFull.substring(0, 5) : '';
    
    // Build form_snapshot in the format the reservation form expects
    console.log('[CustomerPortal] Building form_snapshot with:', {
      statusValue, farmOptionValue, eFarmStatusValue,
      pickup_date_time: reservationData.pickup_date_time,
      pickup_address: reservationData.pickup_address,
      dropoff_address: reservationData.dropoff_address,
      vehicle_type: reservationData.vehicle_type,
      service_type: reservationData.service_type,
      assigned_driver_id: reservationData.assigned_driver_id,
      fleet_vehicle_id: reservationData.fleet_vehicle_id,
      customer: state.customer,
      passenger_first_name: reservationData.passenger_first_name,
      passenger_last_name: reservationData.passenger_last_name
    });
    
    dbData.form_snapshot = {
      source: 'customer_portal',
      booked_at: new Date().toISOString(),
      
      // Billing info - use customer account data
      billing: {
        firstName: state.customer?.first_name || '',
        lastName: state.customer?.last_name || '',
        phone: state.customer?.cell_phone || state.customer?.phone || '',
        email: state.customer?.email || '',
        company: state.customer?.company_name || ''
      },
      
      // Passenger info
      passenger: {
        firstName: reservationData.passenger_first_name || '',
        lastName: reservationData.passenger_last_name || '',
        phone: reservationData.passenger_phone || '',
        email: reservationData.passenger_email || ''
      },
      
      // Routing - pickup and dropoff stops
      routing: {
        stops: [
          {
            stopType: 'pickup',
            type: 'pickup',
            fullAddress: reservationData.pickup_address || '',
            address1: reservationData.pickup_address || ''
          },
          {
            stopType: 'dropoff',
            type: 'dropoff',
            fullAddress: reservationData.dropoff_address || '',
            address1: reservationData.dropoff_address || ''
          }
        ],
        tripNotes: reservationData.special_instructions || ''
      },
      
      // Details - all the form fields
      details: {
        resStatus: statusValue,
        resStatusLabel: statusLabel,
        vehicleType: reservationData.vehicle_type || '',
        serviceType: reservationData.service_type || '',
        puDate: puDate || '',
        puTime: puTime || '',
        numPax: reservationData.passenger_count || 1,
        farmOption: farmOptionValue,  // Use the calculated farm option
        eFarmStatus: eFarmStatusValue,  // Use the calculated eFarm status
        efarmStatus: eFarmStatusValue,  // Also set lowercase version
        driverId: reservationData.assigned_driver_id || null,
        driverName: reservationData.assigned_driver_name || '',
        fleetVehicleId: reservationData.fleet_vehicle_id || null,
        grandTotal: reservationData.total_price || 0,
        rateAmount: reservationData.rate_amount || 0,
        rateType: reservationData.rate_type || '',
        airportFee: reservationData.airport_fee || 0  // MAC/Baggage handling fee
      },
      
      // Costs section - rate breakdown for reservation form
      costs: {
        flat: { qty: 1, rate: reservationData.base_rate || 0 },
        mile: { qty: reservationData.distance_miles || 0, rate: reservationData.rate_per_mile || 0 },
        hour: { qty: reservationData.hourly_duration || 0, rate: reservationData.hourly_rate || 0 },
        airport: { qty: reservationData.airport_fee > 0 ? 1 : 0, rate: reservationData.airport_fee || 0 },  // MAC fee
        gratuity: 0,
        fuel: 0,
        discount: 0
      },
      
      // Store extra data that doesn't fit the structure
      extra: extraData
    };
    
    // Map some fields to valid column names
    if (reservationData.pickup_date_time) {
      dbData.pickup_datetime = reservationData.pickup_date_time;
    }
    if (reservationData.pickup_address) {
      dbData.pu_address = reservationData.pickup_address;
    }
    if (reservationData.dropoff_address) {
      dbData.do_address = reservationData.dropoff_address;
    }
    // Build passenger_name from first/last
    if (reservationData.passenger_first_name || reservationData.passenger_last_name) {
      dbData.passenger_name = `${reservationData.passenger_first_name || ''} ${reservationData.passenger_last_name || ''}`.trim();
    }
    // Set grand_total from total_price
    if (reservationData.total_price) {
      dbData.grand_total = reservationData.total_price;
    }
    
    // Create reservation with filtered data
    // Log what's being sent to the database
    console.log('[CustomerPortal] DB Data being saved:', {
      vehicle_type: dbData.vehicle_type,
      service_type: dbData.service_type,
      status: dbData.status,
      assigned_driver_id: dbData.assigned_driver_id,
      assigned_driver_name: dbData.assigned_driver_name,
      driver_status: dbData.driver_status,
      fleet_vehicle_id: dbData.fleet_vehicle_id,
      farm_option: dbData.farm_option,
      farmout_status: dbData.farmout_status,
      grand_total: dbData.grand_total,
      rate_amount: dbData.rate_amount
    });
    
    const creds = getSupabaseCredentials();
    const response = await fetch(`${creds.url}/rest/v1/reservations`, {
      method: 'POST',
      headers: {
        'apikey': creds.anonKey,
        'Authorization': `Bearer ${state.session?.access_token}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(dbData)
    });
    
    if (response.ok) {
      const newReservation = await response.json();
      console.log('[CustomerPortal] Reservation created successfully:', newReservation[0]?.id || newReservation?.id);
      
      // Save any new addresses to customer_addresses
      await saveUsedAddresses();
      
      // Reload passengers dropdown in case we added new one
      await loadSavedPassengers();
      populatePassengerDropdown();
      
      showToast(`Trip booked! Confirmation: ${confirmationNumber}`, 'success');
      
      // Send confirmation notifications if enabled
      if (bookingDefaults.sendConfirmationSms) {
        sendBookingConfirmationSMS(newReservation);
      }
      
      if (includeReturn) {
        // Show return trip form
        showReturnTripForm(newReservation);
      } else {
        // Switch to My Trips tab
        document.querySelector('.tab-btn[data-tab="trips"]').click();
        await loadTrips();
      }
      
      // Reset form
      resetBookingForm();
      
    } else {
      const errorText = await response.text();
      console.error('[CustomerPortal] Reservation creation failed:', response.status, errorText);
      let errorMessage = 'Failed to book trip';
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorJson.error || errorJson.details || errorMessage;
      } catch (e) {
        errorMessage = errorText || errorMessage;
      }
      throw new Error(errorMessage);
    }
  } catch (err) {
    console.error('[CustomerPortal] Booking error:', err);
    showToast(err.message || 'Failed to book trip', 'error');
  } finally {
    bookBtn.disabled = false;
    bookBtn.textContent = includeReturn ? '🔄 Book One Way and Enter Return Trip' : '📍 Book One Way Trip';
  }
}

function validateBookingForm() {
  const firstName = document.getElementById('passengerFirstName').value.trim();
  const lastName = document.getElementById('passengerLastName').value.trim();
  const phone = document.getElementById('passengerPhone').value.trim();
  const pickupDate = document.getElementById('pickupDate').value;
  const pickupTime = document.getElementById('pickupTime').value;
  
  if (!firstName || !lastName) return { valid: false, message: 'Please enter passenger name' };
  if (!phone) return { valid: false, message: 'Please enter phone number' };
  if (!pickupDate) return { valid: false, message: 'Please select pickup date' };
  if (!pickupTime) return { valid: false, message: 'Please select pickup time' };
  
  // Check pickup address
  const pickupType = document.getElementById('pickupAddressSelect').value;
  if (pickupType === 'airport') {
    const airport = document.getElementById('pickupAirport').value;
    const airlineCode = document.getElementById('airlineCode')?.value;
    const flightNumber = document.getElementById('flightNumber').value.trim();
    if (!airport) return { valid: false, message: 'Please select airport' };
    if (!airlineCode) return { valid: false, message: 'Please select airline for airport pickup' };
    if (!flightNumber) return { valid: false, message: 'Please enter flight number for airport pickup' };
  } else if (pickupType === 'new') {
    const address = document.getElementById('pickupAddressInput').value.trim();
    if (!address) return { valid: false, message: 'Please enter pickup address' };
  } else if (!state.selectedPickupAddress) {
    return { valid: false, message: 'Please select pickup address' };
  }
  
  // Check dropoff address
  const dropoffType = document.getElementById('dropoffAddressSelect').value;
  if (dropoffType === 'airport') {
    const airport = document.getElementById('dropoffAirport').value;
    if (!airport) return { valid: false, message: 'Please select dropoff airport' };
  } else if (dropoffType === 'new') {
    const address = document.getElementById('dropoffAddressInput').value.trim();
    if (!address) return { valid: false, message: 'Please enter dropoff address' };
  } else if (!state.selectedDropoffAddress) {
    return { valid: false, message: 'Please select dropoff address' };
  }
  
  return { valid: true };
}

function buildReservationData() {
  const pickupDate = document.getElementById('pickupDate').value;
  const pickupTime = document.getElementById('pickupTime').value;
  const pickupDateTime = `${pickupDate}T${pickupTime}:00`;
  
  // Customer portal reservations use the main admin org so admins can see/manage them
  // Customer Org is only for account records, not reservations
  const ADMIN_ORG_ID = '54eb6ce7-ba97-4198-8566-6ac075828160';
  const organizationId = window.ENV?.ORGANIZATION_ID || 
                        localStorage.getItem('relia_organization_id') || 
                        ADMIN_ORG_ID;
  
  // Get booked_by_user_id from session (required by database)
  const bookedByUserId = state.session?.user?.id || 
                        state.customer?.user_id || 
                        state.customer?.id;
  
  // Get pickup address
  let pickupAddress;
  const pickupType = document.getElementById('pickupAddressSelect').value;
  if (pickupType === 'airport') {
    const airportSelect = document.getElementById('pickupAirport');
    const selectedOption = airportSelect.options[airportSelect.selectedIndex];
    pickupAddress = selectedOption?.dataset?.address || airportSelect.value;
  } else if (pickupType === 'new') {
    pickupAddress = document.getElementById('pickupAddressInput').value.trim();
  } else {
    pickupAddress = state.selectedPickupAddress;
  }
  
  // Get dropoff address
  let dropoffAddress;
  const dropoffType = document.getElementById('dropoffAddressSelect').value;
  if (dropoffType === 'airport') {
    const airportSelect = document.getElementById('dropoffAirport');
    const selectedOption = airportSelect.options[airportSelect.selectedIndex];
    dropoffAddress = selectedOption?.dataset?.address || airportSelect.value;
  } else if (dropoffType === 'new') {
    dropoffAddress = document.getElementById('dropoffAddressInput').value.trim();
  } else {
    dropoffAddress = state.selectedDropoffAddress;
  }
  
  // Build stops array
  const stops = state.stops.filter(s => s.address).map(s => s.address);
  
  // Get vehicle type name (not ID)
  const selectedVehicleTypeData = state.vehicleTypes.find(v => 
    v.id === state.selectedVehicleType || v.name === state.selectedVehicleType
  );
  const vehicleTypeName = selectedVehicleTypeData?.name || state.selectedVehicleType || 'Black SUV';
  
  // Determine service type CODE based on trip type selection
  // Using codes that MUST match the service_types table: 
  // - from-airport, to-airport, point-to-point, hourly
  // pickupType and dropoffType already declared above
  const isPickupFromAirport = pickupType === 'airport';
  const isDropoffToAirport = dropoffType === 'airport';
  
  // Use the trip type directly if it's an airport type, otherwise detect from addresses
  let serviceType;
  if (state.tripType === 'hourly') {
    serviceType = 'hourly';
  } else if (state.tripType === 'from-airport' || isPickupFromAirport) {
    serviceType = 'from-airport';
  } else if (state.tripType === 'to-airport' || isDropoffToAirport) {
    serviceType = 'to-airport';
  } else {
    serviceType = 'point-to-point';
  }
  
  // Get airline code for flight number
  const airlineCode = document.getElementById('airlineCode')?.value || '';
  let flightNumber = document.getElementById('flightNumber')?.value?.trim() || '';
  if (airlineCode && airlineCode !== 'OTHER' && flightNumber) {
    flightNumber = `${airlineCode}${flightNumber.replace(/^[A-Z]{2}/i, '')}`;
  }
  
  // Get flight arrival time for airport pickups
  const flightArrivalTime = document.getElementById('flightArrivalTime')?.value || null;
  
  // Calculate total price from route info and vehicle type
  let totalPrice = state.estimatedPrice || 0;
  
  // MAC Airport Fee ($15 for any airport trip - pickup or dropoff)
  const MAC_AIRPORT_FEE = 15.00;
  const isAirportTrip = isPickupFromAirport || isDropoffToAirport;
  const airportFee = isAirportTrip ? MAC_AIRPORT_FEE : 0;
  
  if (!totalPrice && state.routeInfo && selectedVehicleTypeData) {
    // Calculate if not already done
    const distanceMiles = state.routeInfo.distanceMiles || 0;
    if (state.tripType === 'hourly') {
      const hourlyRate = parseFloat(selectedVehicleTypeData.hourly_rate) || parseFloat(selectedVehicleTypeData.base_rate) || 75;
      totalPrice = hourlyRate * state.hourlyDuration;
    } else {
      const baseRate = parseFloat(selectedVehicleTypeData.base_rate) || 0;
      const perMileRate = parseFloat(selectedVehicleTypeData.per_mile_rate) || parseFloat(selectedVehicleTypeData.rate_per_mile) || 3;
      const minimumFare = parseFloat(selectedVehicleTypeData.minimum_fare) || parseFloat(selectedVehicleTypeData.min_fare) || 50;
      totalPrice = baseRate + (distanceMiles * perMileRate);
      totalPrice = Math.max(totalPrice, minimumFare);
    }
    // Add MAC airport fee to total price
    totalPrice += airportFee;
  } else if (totalPrice && isAirportTrip) {
    // If we have an estimated price but haven't added airport fee
    totalPrice += airportFee;
  }
  
  // Get pickup airport code if airport pickup
  const pickupAirportCode = pickupType === 'airport' ? document.getElementById('pickupAirport')?.value : null;
  const dropoffAirportCode = dropoffType === 'airport' ? document.getElementById('dropoffAirport')?.value : null;
  
  return {
    // Required database fields
    organization_id: organizationId,
    booked_by_user_id: bookedByUserId,
    
    // Account & Passenger
    account_id: state.customer?.id,
    billing_name: `${state.customer?.first_name || ''} ${state.customer?.last_name || ''}`.trim(),
    billing_phone: state.customer?.cell_phone || state.customer?.phone || '',
    billing_email: state.customer?.email || '',
    passenger_first_name: document.getElementById('passengerFirstName').value.trim(),
    passenger_last_name: document.getElementById('passengerLastName').value.trim(),
    passenger_phone: document.getElementById('passengerPhone').value.trim(),
    passenger_email: document.getElementById('passengerEmail').value.trim(),
    passenger_count: parseInt(document.getElementById('passengerCount').value) || 1,
    
    // Trip details
    pickup_date_time: pickupDateTime,
    pickup_address: pickupAddress,
    dropoff_address: dropoffAddress,
    stops: stops.length > 0 ? JSON.stringify(stops) : null,
    special_instructions: document.getElementById('specialInstructions').value.trim(),
    
    // Vehicle & Service
    vehicle_type: vehicleTypeName,
    service_type: serviceType,
    
    // Assignment: Set dynamically in bookTrip based on auto-farm toggle
    // These are defaults - will be overwritten in bookTrip()
    driver_id: null,
    farm_option: 'in-house',
    farmout_mode: 'manual',
    
    // Status - default to pending, will be set to confirmed if driver assigned
    status: 'pending',
    
    // Source & tracking
    source: 'customer_portal',
    
    // Flight info - transfer with all data for API updates
    flight_number: flightNumber || document.getElementById('dropoffFlightNumber')?.value?.trim() || null,
    flight_time: flightArrivalTime,
    pickup_airport: pickupAirportCode,
    dropoff_airport: dropoffAirportCode,
    is_airport_pickup: pickupType === 'airport',
    is_airport_dropoff: dropoffType === 'airport',
    
    // Route & Pricing
    distance_miles: state.routeInfo?.distanceMiles || null,
    distance_text: state.routeInfo?.distanceText || null,
    duration_minutes: state.routeInfo ? Math.round(state.routeInfo.durationSeconds / 60) : null,
    duration_text: state.routeInfo?.durationText || null,
    total_price: totalPrice,
    base_rate: selectedVehicleTypeData?.base_rate || null,
    rate_per_mile: selectedVehicleTypeData?.per_mile_rate || selectedVehicleTypeData?.rate_per_mile || null,
    
    // MAC Airport Fee - $15 for airport pickups/dropoffs (baggage handling)
    airport_fee: airportFee,
    
    // Rate fields for reservation form display
    rate_amount: state.tripType === 'hourly' 
      ? (parseFloat(selectedVehicleTypeData?.hourly_rate) || parseFloat(selectedVehicleTypeData?.base_rate) || 75)
      : (parseFloat(selectedVehicleTypeData?.per_mile_rate) || parseFloat(selectedVehicleTypeData?.rate_per_mile) || 3),
    rate_type: state.tripType === 'hourly' ? 'hourly' : 'per_mile',
    
    // Hourly reservation
    is_hourly: state.tripType === 'hourly',
    hourly_duration: state.tripType === 'hourly' ? state.hourlyDuration : null,
    hourly_rate: state.tripType === 'hourly' ? (selectedVehicleTypeData?.hourly_rate || null) : null,
    
    // Timestamps
    created_at: new Date().toISOString()
  };
}

// Get next confirmation number using company settings (like reservation-form)
async function getNextConfirmationNumber() {
  try {
    const creds = getSupabaseCredentials();
    
    // Get company settings for confirmation start number
    const settingsRaw = localStorage.getItem('relia_company_settings');
    const settings = settingsRaw ? JSON.parse(settingsRaw) : {};
    const confirmationStartNumber = parseInt(settings.confirmationStartNumber, 10) || 100000;
    
    // Get the highest confirmation number from existing reservations
    const response = await fetch(
      `${creds.url}/rest/v1/reservations?select=confirmation_number`,
      {
        headers: {
          'apikey': creds.anonKey,
          'Authorization': `Bearer ${state.session?.access_token}`
        }
      }
    );
    
    if (response.ok) {
      const reservations = await response.json();
      
      if (reservations.length === 0) {
        // No reservations - use start number from settings
        console.log('[CustomerPortal] No reservations, using start number:', confirmationStartNumber);
        return confirmationStartNumber;
      }
      
      // Find highest confirmation number
      const confirmationNumbers = reservations
        .map(r => parseInt(r.confirmation_number, 10))
        .filter(n => !isNaN(n) && n > 0);
      
      if (confirmationNumbers.length > 0) {
        const maxNumber = Math.max(...confirmationNumbers);
        const nextNumber = maxNumber + 1;
        console.log('[CustomerPortal] Next confirmation number:', nextNumber);
        return nextNumber;
      }
      
      // No valid numbers found - use start number
      return confirmationStartNumber;
    }
    
    // Fallback: use start number
    return confirmationStartNumber;
  } catch (err) {
    console.error('[CustomerPortal] Failed to get confirmation number:', err);
    // Fallback: generate timestamp-based number
    const settingsRaw = localStorage.getItem('relia_company_settings');
    const settings = settingsRaw ? JSON.parse(settingsRaw) : {};
    return parseInt(settings.confirmationStartNumber, 10) || 100000;
  }
}

/**
 * Create a passenger-only account when booking for someone else
 * This creates a separate account marked as is_passenger=true only
 */
async function createPassengerAccount(firstName, lastName, phone, email) {
  try {
    const creds = getSupabaseCredentials();
    const CUSTOMER_ORG_ID = 'c0000000-0000-0000-0000-000000000001';
    
    // Check if an account with this name/email already exists
    const checkQuery = email 
      ? `first_name=ilike.${encodeURIComponent(firstName)}&last_name=ilike.${encodeURIComponent(lastName)}&email=eq.${encodeURIComponent(email.toLowerCase())}`
      : `first_name=ilike.${encodeURIComponent(firstName)}&last_name=ilike.${encodeURIComponent(lastName)}`;
    
    const checkResp = await fetch(
      `${creds.url}/rest/v1/accounts?${checkQuery}&select=id,account_number`,
      {
        headers: {
          'apikey': creds.anonKey,
          'Authorization': `Bearer ${state.session?.access_token}`
        }
      }
    );
    
    if (checkResp.ok) {
      const existing = await checkResp.json();
      if (existing.length > 0) {
        console.log('[CustomerPortal] Passenger account already exists:', existing[0].account_number);
        return existing[0];
      }
    }
    
    // Get next account number
    const maxResp = await fetch(
      `${creds.url}/rest/v1/accounts?organization_id=eq.${CUSTOMER_ORG_ID}&order=account_number.desc&limit=1&select=account_number`,
      {
        headers: {
          'apikey': creds.anonKey,
          'Authorization': `Bearer ${state.session?.access_token}`
        }
      }
    );
    
    let nextAccountNumber = 30001;
    if (maxResp.ok) {
      const maxAccounts = await maxResp.json();
      if (maxAccounts.length > 0 && maxAccounts[0].account_number) {
        nextAccountNumber = parseInt(maxAccounts[0].account_number) + 1;
      }
    }
    
    // Create the passenger-only account
    const accountData = {
      organization_id: CUSTOMER_ORG_ID,
      account_number: nextAccountNumber.toString(),
      first_name: firstName,
      last_name: lastName,
      phone: phone || null,
      email: email ? email.toLowerCase() : null,
      status: 'active',
      is_billing_client: false,  // NOT a billing client
      is_passenger: true,        // IS a passenger
      created_at: new Date().toISOString()
    };
    
    const createResp = await fetch(`${creds.url}/rest/v1/accounts`, {
      method: 'POST',
      headers: {
        'apikey': creds.anonKey,
        'Authorization': `Bearer ${state.session?.access_token}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(accountData)
    });
    
    if (createResp.ok) {
      const newAccounts = await createResp.json();
      if (newAccounts?.length > 0) {
        console.log('[CustomerPortal] Created passenger account:', newAccounts[0].account_number);
        return newAccounts[0];
      }
    } else {
      console.error('[CustomerPortal] Failed to create passenger account:', await createResp.text());
    }
    
    return null;
  } catch (err) {
    console.error('[CustomerPortal] Error creating passenger account:', err);
    return null;
  }
}

// Save or update passenger in customer_passengers table
async function savePassenger(firstName, lastName, phone, email, isPrimary = false, relationship = 'other') {
  try {
    const creds = getSupabaseCredentials();
    
    // Check if passenger already exists
    const checkResponse = await fetch(
      `${creds.url}/rest/v1/customer_passengers?account_id=eq.${state.customer?.id}&first_name=ilike.${encodeURIComponent(firstName)}&last_name=ilike.${encodeURIComponent(lastName)}&select=id,usage_count`,
      {
        headers: {
          'apikey': creds.anonKey,
          'Authorization': `Bearer ${state.session?.access_token}`
        }
      }
    );
    
    if (checkResponse.ok) {
      const existing = await checkResponse.json();
      
      if (existing.length > 0) {
        // Update usage count
        await fetch(
          `${creds.url}/rest/v1/customer_passengers?id=eq.${existing[0].id}`,
          {
            method: 'PATCH',
            headers: {
              'apikey': creds.anonKey,
              'Authorization': `Bearer ${state.session?.access_token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              usage_count: (existing[0].usage_count || 0) + 1,
              last_used_at: new Date().toISOString(),
              phone: phone || undefined,
              email: email || undefined,
              is_visible: true
            })
          }
        );
        return existing[0].id;
      }
    }
    
    // Insert new passenger
    const insertResponse = await fetch(
      `${creds.url}/rest/v1/customer_passengers`,
      {
        method: 'POST',
        headers: {
          'apikey': creds.anonKey,
          'Authorization': `Bearer ${state.session?.access_token}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          account_id: state.customer?.id,
          first_name: firstName,
          last_name: lastName,
          phone: phone,
          email: email,
          is_primary: isPrimary,
          relationship: relationship,
          usage_count: 1,
          last_used_at: new Date().toISOString(),
          is_visible: true
        })
      }
    );
    
    if (insertResponse.ok) {
      const newPassenger = await insertResponse.json();
      // Add to state
      if (Array.isArray(newPassenger)) {
        state.savedPassengers.push(newPassenger[0]);
      }
      return newPassenger[0]?.id;
    }
  } catch (err) {
    console.error('[CustomerPortal] Failed to save passenger:', err);
  }
  return null;
}

// Save or update address in customer_addresses table
async function saveAddress(fullAddress, label = 'Recent', addressType = 'other', latitude = null, longitude = null) {
  try {
    const creds = getSupabaseCredentials();
    
    // Check if address already exists (case-insensitive)
    const checkResponse = await fetch(
      `${creds.url}/rest/v1/customer_addresses?account_id=eq.${state.customer?.id}&full_address=ilike.${encodeURIComponent(fullAddress)}&select=id,usage_count`,
      {
        headers: {
          'apikey': creds.anonKey,
          'Authorization': `Bearer ${state.session?.access_token}`
        }
      }
    );
    
    if (checkResponse.ok) {
      const existing = await checkResponse.json();
      
      if (existing.length > 0) {
        // Update usage count
        await fetch(
          `${creds.url}/rest/v1/customer_addresses?id=eq.${existing[0].id}`,
          {
            method: 'PATCH',
            headers: {
              'apikey': creds.anonKey,
              'Authorization': `Bearer ${state.session?.access_token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              usage_count: (existing[0].usage_count || 0) + 1,
              last_used_at: new Date().toISOString(),
              is_deleted: false,
              is_visible: true
            })
          }
        );
        return existing[0].id;
      }
    }
    
    // Insert new address
    const insertResponse = await fetch(
      `${creds.url}/rest/v1/customer_addresses`,
      {
        method: 'POST',
        headers: {
          'apikey': creds.anonKey,
          'Authorization': `Bearer ${state.session?.access_token}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          account_id: state.customer?.id,
          full_address: fullAddress,
          label: label,
          address_type: addressType,
          latitude: latitude,
          longitude: longitude,
          is_deleted: false,
          is_visible: true,
          usage_count: 1,
          last_used_at: new Date().toISOString()
        })
      }
    );
    
    if (insertResponse.ok) {
      const newAddress = await insertResponse.json();
      if (Array.isArray(newAddress)) {
        state.savedAddresses.push(newAddress[0]);
      }
      return newAddress[0]?.id;
    }
  } catch (err) {
    console.error('[CustomerPortal] Failed to save address:', err);
  }
  return null;
}

async function saveUsedAddresses() {
  // Save new addresses that were entered (with coordinates from Google Places)
  const pickupType = document.getElementById('pickupAddressSelect').value;
  const dropoffType = document.getElementById('dropoffAddressSelect').value;
  
  if (pickupType === 'new') {
    const address = document.getElementById('pickupAddressInput').value.trim();
    if (address) {
      // Use coordinates from Google Places if available
      const lat = state.pickupAddressData?.coordinates?.lat || null;
      const lng = state.pickupAddressData?.coordinates?.lng || null;
      await saveAddress(address, 'Recent', 'pickup', lat, lng);
    }
  }
  
  if (dropoffType === 'new') {
    const address = document.getElementById('dropoffAddressInput').value.trim();
    if (address) {
      // Use coordinates from Google Places if available
      const lat = state.dropoffAddressData?.coordinates?.lat || null;
      const lng = state.dropoffAddressData?.coordinates?.lng || null;
      await saveAddress(address, 'Recent', 'dropoff', lat, lng);
    }
  }
  
  // Also save any stops
  for (const stop of state.stops) {
    if (stop.address) {
      await saveAddress(stop.address, 'Stop', 'other');
    }
  }
  
  // Reload address dropdown
  await loadSavedAddresses();
  populateAddressDropdowns();
}

// Send booking confirmation SMS
async function sendBookingConfirmationSMS(reservation) {
  try {
    const phone = reservation.passenger_phone || state.customer?.phone;
    if (!phone) return;
    
    const pickupTime = getTripPickupDateTime(reservation);
    const timeStr = pickupTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    const dateStr = pickupTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    
    const message = `🚗 RELIALIMO Booking Confirmed!\n\n` +
      `Confirmation: ${reservation.confirmation_number}\n` +
      `📅 ${dateStr} at ${timeStr}\n` +
      `📍 PU: ${(reservation.pickup_address || '').substring(0, 40)}...\n` +
      `🏁 DO: ${(reservation.dropoff_address || '').substring(0, 40)}...\n` +
      `🚙 ${reservation.vehicle_type || 'Vehicle'}\n\n` +
      `Track your trip at: https://account.relialimo.com/${state.portalSlug || state.customer?.portal_slug || ''}`;
    
    await fetch('/api/sms-send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: phone,
        body: message
      })
    });
  } catch (err) {
    console.error('[CustomerPortal] Failed to send confirmation SMS:', err);
  }
}
function resetBookingForm() {
  document.getElementById('passengerSelect').value = 'self';
  fillPassengerDetails('self');
  document.getElementById('passengerCount').value = '1';
  document.getElementById('pickupAddressSelect').value = '';
  document.getElementById('dropoffAddressSelect').value = '';
  document.getElementById('pickupAddressInput').value = '';
  document.getElementById('dropoffAddressInput').value = '';
  document.getElementById('specialInstructions').value = '';
  document.getElementById('flightNumber').value = '';
  document.getElementById('dropoffFlightNumber').value = '';
  
  state.selectedPickupAddress = null;
  state.selectedDropoffAddress = null;
  state.stops = [];
  renderStops();
  
  // Hide airport/address inputs
  document.getElementById('pickupAddressNew').classList.add('hidden');
  document.getElementById('dropoffAddressNew').classList.add('hidden');
  document.getElementById('airportPickupDetails').classList.add('hidden');
  document.getElementById('airportDropoffDetails').classList.add('hidden');
  document.getElementById('savedPickupAddresses').classList.add('hidden');
  document.getElementById('savedDropoffAddresses').classList.add('hidden');
  
  setDefaultDateTime();
}

function setDefaultDateTime() {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  document.getElementById('pickupDate').value = dateStr;
  document.getElementById('pickupDate').min = dateStr;
  
  // Default time 1 hour from now
  now.setHours(now.getHours() + 1);
  const timeStr = now.toTimeString().slice(0, 5);
  document.getElementById('pickupTime').value = timeStr;
}

// ============================================
// Trips Loading & Display
// ============================================
async function loadTrips() {
  try {
    const creds = getSupabaseCredentials();
    const response = await fetch(
      `${creds.url}/rest/v1/reservations?account_id=eq.${state.customer?.id}&select=*&order=pickup_datetime.desc`,
      {
        headers: {
          'apikey': creds.anonKey,
          'Authorization': `Bearer ${state.session?.access_token}`
        }
      }
    );
    
    if (response.ok) {
      state.trips = await response.json();
      console.log('[CustomerPortal] Loaded trips:', state.trips.length, 'trips');
      
      // Fetch driver info for trips with assigned drivers
      await enrichTripsWithDriverInfo(state.trips);
      
      // Fetch fleet vehicle info for trips with assigned vehicles
      await enrichTripsWithVehicleInfo(state.trips);
      
      if (state.trips.length > 0) {
        console.log('[CustomerPortal] Sample trip data:', { 
          pickup_datetime: state.trips[0].pickup_datetime,
          assigned_driver_name: state.trips[0].assigned_driver_name,
          vehicle_type: state.trips[0].vehicle_type,
          confirmation_number: state.trips[0].confirmation_number
        });
      }
      renderTrips('upcoming');
    } else {
      console.error('[CustomerPortal] Failed to load trips, status:', response.status);
    }
  } catch (err) {
    console.error('[CustomerPortal] Failed to load trips:', err);
  }
}

// Fetch driver info for trips that have assigned_driver_id
async function enrichTripsWithDriverInfo(trips) {
  try {
    const creds = getSupabaseCredentials();
    const driverIds = [...new Set(trips.filter(t => t.assigned_driver_id).map(t => t.assigned_driver_id))];
    
    if (driverIds.length === 0) return;
    
    const response = await fetch(
      `${creds.url}/rest/v1/drivers?id=in.(${driverIds.join(',')})&select=id,first_name,last_name,profile_photo,vehicle_type,assigned_vehicle_id`,
      {
        headers: {
          'apikey': creds.anonKey,
          'Authorization': `Bearer ${state.session?.access_token}`
        }
      }
    );
    
    if (response.ok) {
      const drivers = await response.json();
      const driverMap = {};
      drivers.forEach(d => {
        driverMap[d.id] = d;
      });
      
      trips.forEach(trip => {
        if (trip.assigned_driver_id && driverMap[trip.assigned_driver_id]) {
          const driver = driverMap[trip.assigned_driver_id];
          trip.driverInfo = {
            name: `${driver.first_name || ''} ${driver.last_name || ''}`.trim() || trip.assigned_driver_name,
            profilePhoto: driver.profile_photo,
            vehicleType: driver.vehicle_type,
            assignedVehicleId: driver.assigned_vehicle_id
          };
        }
      });
    }
  } catch (err) {
    console.error('[CustomerPortal] Failed to enrich trips with driver info:', err);
  }
}

// Fetch fleet vehicle info for trips that have fleet_vehicle_id
async function enrichTripsWithVehicleInfo(trips) {
  try {
    const creds = getSupabaseCredentials();
    // Get vehicle IDs from fleet_vehicle_id or driver's assigned_vehicle_id
    const vehicleIds = [...new Set(trips
      .filter(t => t.fleet_vehicle_id || t.driverInfo?.assignedVehicleId)
      .map(t => t.fleet_vehicle_id || t.driverInfo?.assignedVehicleId)
      .filter(Boolean)
    )];
    
    if (vehicleIds.length === 0) return;
    
    const response = await fetch(
      `${creds.url}/rest/v1/fleet_vehicles?id=in.(${vehicleIds.join(',')})&select=id,make,model,year,color,license_plate,vehicle_type`,
      {
        headers: {
          'apikey': creds.anonKey,
          'Authorization': `Bearer ${state.session?.access_token}`
        }
      }
    );
    
    if (response.ok) {
      const vehicles = await response.json();
      const vehicleMap = {};
      vehicles.forEach(v => {
        vehicleMap[v.id] = v;
      });
      
      trips.forEach(trip => {
        const vehicleId = trip.fleet_vehicle_id || trip.driverInfo?.assignedVehicleId;
        if (vehicleId && vehicleMap[vehicleId]) {
          const vehicle = vehicleMap[vehicleId];
          trip.fleetVehicleInfo = {
            make: vehicle.make,
            model: vehicle.model,
            year: vehicle.year,
            color: vehicle.color,
            licensePlate: vehicle.license_plate,
            vehicleType: vehicle.vehicle_type,
            displayName: `${vehicle.year || ''} ${vehicle.color || ''} ${vehicle.make || ''} ${vehicle.model || ''}`.trim()
          };
        }
      });
    }
  } catch (err) {
    console.error('[CustomerPortal] Failed to enrich trips with vehicle info:', err);
  }
}

// Helper to get pickup datetime from trip (handles multiple field name formats)
// IMPORTANT: The datetime stored in DB represents the actual wall-clock time for pickup
// We parse it as a local time (without timezone conversion) to display correctly
function getTripPickupDateTime(trip) {
  // Try different field names used across the app
  let dtString = trip.pickup_datetime || trip.pickup_date_time;
  
  if (dtString) {
    // Remove timezone offset if present (e.g., +00:00) to parse as local time
    // This ensures 13:59:00+00:00 displays as 1:59 PM, not converted to local TZ
    dtString = dtString.replace(/[+-]\d{2}:\d{2}$/, '').replace(/Z$/, '');
    
    // Parse the components manually to avoid timezone conversion
    const [datePart, timePart] = dtString.split('T');
    if (datePart && timePart) {
      const [year, month, day] = datePart.split('-').map(Number);
      const [hours, minutes, seconds] = timePart.split(':').map(n => parseInt(n) || 0);
      // Create date with local timezone interpretation
      return new Date(year, month - 1, day, hours, minutes, seconds);
    }
    // Fallback for date-only strings
    if (datePart) {
      const [year, month, day] = datePart.split('-').map(Number);
      return new Date(year, month - 1, day);
    }
  }
  
  // Try pu_date + pu_time (alternate schema)
  const puDate = trip.pu_date || trip.pickup_date || '';
  const puTime = trip.pu_time || trip.pickup_time || '00:00';
  if (puDate) {
    const [year, month, day] = puDate.split('-').map(Number);
    const [hours, minutes] = puTime.split(':').map(Number);
    return new Date(year, month - 1, day, hours || 0, minutes || 0);
  }
  
  // If no date fields, return far future date so trip shows as upcoming
  return new Date('2099-12-31');
}

function renderTrips(filter = 'upcoming') {
  const container = document.getElementById('tripsList');
  if (!container) return;
  
  console.log('[CustomerPortal] renderTrips called with filter:', filter, 'total trips:', state.trips?.length || 0);
  
  const now = new Date();
  let filteredTrips = state.trips || [];
  
  if (filter === 'upcoming') {
    filteredTrips = (state.trips || []).filter(t => {
      const tripDate = getTripPickupDateTime(t);
      const isUpcoming = tripDate >= now && t.status !== 'cancelled' && t.status !== 'completed';
      return isUpcoming;
    });
  } else if (filter === 'past') {
    filteredTrips = (state.trips || []).filter(t => {
      const tripDate = getTripPickupDateTime(t);
      return tripDate < now || t.status === 'completed';
    });
  } else if (filter === 'all') {
    filteredTrips = state.trips || [];
  }
  
  console.log('[CustomerPortal] Filtered to', filteredTrips.length, filter, 'trips');
  
  if (filteredTrips.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">📋</span>
        <p>No ${filter} trips</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = filteredTrips.map(trip => {
    const pickupDate = getTripPickupDateTime(trip);
    const dateStr = pickupDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const timeStr = pickupDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    
    // Get driver info
    const driverName = trip.driverInfo?.name || trip.assigned_driver_name || null;
    const driverPhoto = trip.driverInfo?.profilePhoto || null;
    
    // Get vehicle info
    const vehicleType = trip.vehicle_type || trip.driverInfo?.vehicleType || null;
    const fleetVehicle = trip.fleetVehicleInfo?.displayName || null;
    
    // Get price
    const price = trip.grand_total || trip.rate_amount || null;
    const priceDisplay = price ? `$${parseFloat(price).toFixed(2)}` : null;
    
    return `
      <div class="trip-card" data-id="${trip.id}">
        <div class="trip-header">
          <div class="trip-header-left">
            <div class="trip-confirmation">#${trip.confirmation_number || trip.id}</div>
            <div class="trip-date">${dateStr}</div>
            <div class="trip-time">${timeStr}</div>
          </div>
          <div class="trip-header-right">
            <span class="trip-status ${trip.status}">${formatStatus(trip.status)}</span>
            ${priceDisplay ? `<div class="trip-price">${priceDisplay}</div>` : ''}
          </div>
        </div>
        
        ${driverName ? `
        <div class="trip-driver-info">
          <div class="driver-avatar">
            ${driverPhoto 
              ? `<img src="${driverPhoto}" alt="${driverName}" class="driver-photo" onerror="this.parentElement.innerHTML='<span class=\\'driver-initials\\'>${getInitials(driverName)}</span>'">`
              : `<span class="driver-initials">${getInitials(driverName)}</span>`
            }
          </div>
          <div class="driver-details">
            <div class="driver-name">${driverName}</div>
            ${vehicleType ? `<div class="driver-vehicle-type">${vehicleType}</div>` : ''}
            ${fleetVehicle ? `<div class="driver-fleet-vehicle">${fleetVehicle}</div>` : ''}
          </div>
        </div>
        ` : vehicleType ? `
        <div class="trip-vehicle-info">
          <span class="vehicle-icon">🚗</span>
          <span class="vehicle-type">${vehicleType}</span>
          ${fleetVehicle ? `<span class="fleet-vehicle"> • ${fleetVehicle}</span>` : ''}
        </div>
        ` : ''}
        
        <div class="trip-route">
          <div class="route-point">
            <span class="route-marker pickup">P</span>
            <span class="route-address">${truncateAddress(trip.pickup_address)}</span>
          </div>
          <div class="route-point">
            <span class="route-marker dropoff">D</span>
            <span class="route-address">${truncateAddress(trip.dropoff_address)}</span>
          </div>
        </div>
        <div class="trip-actions">
          ${canTrack(trip) ? `
            <button class="btn btn-sm btn-primary track-trip-btn" data-id="${trip.id}">📍 Track</button>
          ` : ''}
          ${canModifyTrip(trip) ? `
            <button class="btn btn-sm btn-secondary edit-trip-btn" data-id="${trip.id}">✏️ Edit</button>
            <button class="btn btn-sm btn-danger cancel-trip-btn" data-id="${trip.id}">❌ Cancel</button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
  
  // Add track handlers
  container.querySelectorAll('.track-trip-btn').forEach(btn => {
    btn.addEventListener('click', () => trackTrip(btn.dataset.id));
  });
  
  // Add edit handlers
  container.querySelectorAll('.edit-trip-btn').forEach(btn => {
    btn.addEventListener('click', () => openEditTripModal(btn.dataset.id));
  });
  
  // Add cancel handlers
  container.querySelectorAll('.cancel-trip-btn').forEach(btn => {
    btn.addEventListener('click', () => openCancelTripModal(btn.dataset.id));
  });
}

function formatStatus(status) {
  const statusMap = {
    'pending': 'Pending',
    'confirmed': 'Confirmed',
    'assigned': 'Driver Assigned',
    'enroute': 'Driver En Route',
    'arrived': 'Driver Arrived',
    'in_progress': 'In Progress',
    'completed': 'Completed',
    'cancelled': 'Cancelled'
  };
  return statusMap[status] || status;
}

function canTrack(trip) {
  return ['assigned', 'enroute', 'arrived', 'in_progress'].includes(trip.status);
}

// Check if a trip can be modified (edited or cancelled)
// Only allow for upcoming trips that haven't started
function canModifyTrip(trip) {
  // Don't allow modification for completed, cancelled, or in-progress trips
  const nonModifiableStatuses = ['completed', 'cancelled', 'in_progress', 'enroute', 'arrived', 'passenger_onboard'];
  if (nonModifiableStatuses.includes(trip.status)) return false;
  
  // Check if the trip is in the future
  const pickupDate = getTripPickupDateTime(trip);
  const now = new Date();
  return pickupDate > now;
}

function truncateAddress(address, maxLength = 40) {
  if (!address) return 'N/A';
  return address.length > maxLength ? address.substring(0, maxLength) + '...' : address;
}

// Get initials from a name
function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

// ============================================
// Trip Modification (Edit/Cancel)
// ============================================

/**
 * Open modal to edit a trip
 */
function openEditTripModal(tripId) {
  const trip = state.trips.find(t => t.id == tripId);
  if (!trip) {
    showToast('Trip not found', 'error');
    return;
  }
  
  const pickupDate = trip.pickup_datetime ? trip.pickup_datetime.split('T')[0] : '';
  const pickupTime = trip.pickup_datetime ? trip.pickup_datetime.split('T')[1]?.substring(0, 5) : '';
  
  const modalHtml = `
    <div class="modal active" id="editTripModal" onclick="if(event.target===this) closeEditTripModal()">
      <div class="modal-content">
        <div class="modal-header">
          <h2>✏️ Edit Reservation #${trip.confirmation_number || tripId}</h2>
          <button type="button" class="modal-close" onclick="closeEditTripModal()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="notice-banner warning">
            <span class="notice-icon">⚠️</span>
            <div class="notice-text">
              <strong>Change fees may apply</strong><br>
              Changes made less than 24 hours before pickup may incur fees. Dispatch will be notified of your changes.
            </div>
          </div>
          
          <div class="form-group">
            <label class="form-label">📅 New Pickup Date</label>
            <input type="date" id="editPickupDate" class="form-input" value="${pickupDate}">
          </div>
          
          <div class="form-group">
            <label class="form-label">🕐 New Pickup Time</label>
            <input type="time" id="editPickupTime" class="form-input" value="${pickupTime}">
          </div>
          
          <div class="form-group">
            <label class="form-label">📍 Pickup Address</label>
            <input type="text" id="editPickupAddress" class="form-input" value="${trip.pickup_address || ''}" placeholder="Enter pickup address">
          </div>
          
          <div class="form-group">
            <label class="form-label">🏁 Dropoff Address</label>
            <input type="text" id="editDropoffAddress" class="form-input" value="${trip.dropoff_address || ''}" placeholder="Enter dropoff address">
          </div>
          
          <div class="form-group">
            <label class="form-label">👥 Number of Passengers</label>
            <input type="number" id="editPassengerCount" class="form-input" value="${trip.passenger_count || 1}" min="1" max="50">
          </div>
          
          <div class="form-group">
            <label class="form-label">📝 Special Instructions (optional)</label>
            <textarea id="editSpecialInstructions" class="form-input" rows="3" placeholder="Any special requests or notes...">${trip.special_instructions || trip.notes || ''}</textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="closeEditTripModal()">Cancel</button>
          <button type="button" class="btn btn-primary" onclick="saveEditedTrip('${tripId}')">💾 Save Changes</button>
        </div>
      </div>
    </div>
  `;
  
  // Remove existing modal if any
  const existing = document.getElementById('editTripModal');
  if (existing) existing.remove();
  
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function closeEditTripModal() {
  const modal = document.getElementById('editTripModal');
  if (modal) modal.remove();
}

/**
 * Save the edited trip to the database
 */
async function saveEditedTrip(tripId) {
  const trip = state.trips.find(t => t.id == tripId);
  if (!trip) return;
  
  const newDate = document.getElementById('editPickupDate').value;
  const newTime = document.getElementById('editPickupTime').value;
  const newPickupAddress = document.getElementById('editPickupAddress').value;
  const newDropoffAddress = document.getElementById('editDropoffAddress').value;
  const newPassengerCount = document.getElementById('editPassengerCount').value;
  const newInstructions = document.getElementById('editSpecialInstructions').value;
  
  if (!newDate || !newTime) {
    showToast('Please enter date and time', 'error');
    return;
  }
  
  const newPickupDateTime = `${newDate}T${newTime}`;
  
  try {
    const creds = getSupabaseCredentials();
    
    // Build update payload
    const updateData = {
      pickup_datetime: newPickupDateTime,
      pickup_address: newPickupAddress,
      dropoff_address: newDropoffAddress,
      passenger_count: parseInt(newPassengerCount) || 1,
      special_instructions: newInstructions,
      notes: newInstructions,
      // Mark that this was modified by customer
      customer_modified: true,
      customer_modified_at: new Date().toISOString()
    };
    
    const response = await fetch(
      `${creds.url}/rest/v1/reservations?id=eq.${tripId}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': creds.anonKey,
          'Authorization': `Bearer ${state.session?.access_token}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(updateData)
      }
    );
    
    if (response.ok) {
      closeEditTripModal();
      showToast('Reservation updated! Dispatch has been notified.', 'success');
      
      // Send notification to dispatch
      await notifyDispatchOfChange(tripId, 'modified', {
        previousDateTime: trip.pickup_datetime,
        newDateTime: newPickupDateTime,
        previousPickup: trip.pickup_address,
        newPickup: newPickupAddress
      });
      
      // Reload trips
      await loadTrips();
    } else {
      const error = await response.text();
      console.error('[CustomerPortal] Failed to update trip:', error);
      showToast('Failed to update reservation', 'error');
    }
  } catch (err) {
    console.error('[CustomerPortal] Error updating trip:', err);
    showToast('Error updating reservation', 'error');
  }
}

/**
 * Open modal to cancel a trip
 */
function openCancelTripModal(tripId) {
  const trip = state.trips.find(t => t.id == tripId);
  if (!trip) {
    showToast('Trip not found', 'error');
    return;
  }
  
  const pickupDate = getTripPickupDateTime(trip);
  const dateStr = pickupDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const timeStr = pickupDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  
  const modalHtml = `
    <div class="modal active" id="cancelTripModal" onclick="if(event.target===this) closeCancelTripModal()">
      <div class="modal-content">
        <div class="modal-header danger-header">
          <h2>❌ Cancel Reservation</h2>
          <button type="button" class="modal-close" onclick="closeCancelTripModal()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="notice-banner danger">
            <span class="notice-icon">⚠️</span>
            <div class="notice-text">
              <strong>Cancellation fees may apply</strong><br>
              Cancellations made less than 24 hours before pickup may incur fees. Dispatch will be notified of this cancellation.
            </div>
          </div>
          
          <div class="cancel-trip-summary">
            <div class="summary-row">
              <span class="summary-label">Confirmation #:</span>
              <span class="summary-value">${trip.confirmation_number || tripId}</span>
            </div>
            <div class="summary-row">
              <span class="summary-label">Date & Time:</span>
              <span class="summary-value">${dateStr} at ${timeStr}</span>
            </div>
            <div class="summary-row">
              <span class="summary-label">Pickup:</span>
              <span class="summary-value">${truncateAddress(trip.pickup_address, 50)}</span>
            </div>
          </div>
          
          <div class="form-group">
            <label class="form-label">Reason for cancellation (optional)</label>
            <textarea id="cancelReason" class="form-input" rows="3" placeholder="Let us know why you're cancelling..."></textarea>
          </div>
          
          <p class="confirm-text">Are you sure you want to cancel this reservation?</p>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="closeCancelTripModal()">Keep Reservation</button>
          <button type="button" class="btn btn-danger" onclick="confirmCancelTrip('${tripId}')">❌ Cancel Reservation</button>
        </div>
      </div>
    </div>
  `;
  
  // Remove existing modal if any
  const existing = document.getElementById('cancelTripModal');
  if (existing) existing.remove();
  
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function closeCancelTripModal() {
  const modal = document.getElementById('cancelTripModal');
  if (modal) modal.remove();
}

/**
 * Confirm and execute trip cancellation
 */
async function confirmCancelTrip(tripId) {
  const trip = state.trips.find(t => t.id == tripId);
  if (!trip) return;
  
  const reason = document.getElementById('cancelReason')?.value || '';
  
  try {
    const creds = getSupabaseCredentials();
    
    const updateData = {
      status: 'cancelled',
      cancellation_reason: reason,
      cancelled_by: 'customer',
      cancelled_at: new Date().toISOString(),
      customer_cancelled: true
    };
    
    const response = await fetch(
      `${creds.url}/rest/v1/reservations?id=eq.${tripId}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': creds.anonKey,
          'Authorization': `Bearer ${state.session?.access_token}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(updateData)
      }
    );
    
    if (response.ok) {
      closeCancelTripModal();
      showToast('Reservation cancelled. Dispatch has been notified.', 'success');
      
      // Send notification to dispatch
      await notifyDispatchOfChange(tripId, 'cancelled', { reason });
      
      // Reload trips
      await loadTrips();
    } else {
      const error = await response.text();
      console.error('[CustomerPortal] Failed to cancel trip:', error);
      showToast('Failed to cancel reservation', 'error');
    }
  } catch (err) {
    console.error('[CustomerPortal] Error cancelling trip:', err);
    showToast('Error cancelling reservation', 'error');
  }
}

/**
 * Send notification to dispatch about customer changes
 */
async function notifyDispatchOfChange(tripId, changeType, details) {
  try {
    const trip = state.trips.find(t => t.id == tripId);
    if (!trip) return;
    
    // Create a dispatch notification record
    const creds = getSupabaseCredentials();
    
    const notification = {
      type: 'customer_change',
      reservation_id: tripId,
      confirmation_number: trip.confirmation_number,
      change_type: changeType, // 'modified' or 'cancelled'
      customer_name: `${state.customer?.first_name || ''} ${state.customer?.last_name || ''}`.trim(),
      customer_email: state.customer?.email,
      change_details: JSON.stringify(details),
      created_at: new Date().toISOString(),
      read: false
    };
    
    // Try to insert into dispatch_notifications table (if it exists)
    await fetch(`${creds.url}/rest/v1/dispatch_notifications`, {
      method: 'POST',
      headers: {
        'apikey': creds.anonKey,
        'Authorization': `Bearer ${state.session?.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(notification)
    }).catch(() => {
      // Table might not exist, that's ok - the reservation update itself serves as notification
      console.log('[CustomerPortal] Dispatch notifications table not available');
    });
    
    console.log(`[CustomerPortal] Notified dispatch of ${changeType} for trip ${tripId}`);
  } catch (err) {
    console.warn('[CustomerPortal] Could not send dispatch notification:', err);
    // Non-critical, don't show error to user
  }
}

// Make modal functions globally accessible
window.closeEditTripModal = closeEditTripModal;
window.saveEditedTrip = saveEditedTrip;
window.closeCancelTripModal = closeCancelTripModal;
window.confirmCancelTrip = confirmCancelTrip;

// ============================================
// Trip Tracking
// ============================================
function checkForActiveTrip() {
  const now = new Date();
  const activeTrip = state.trips.find(t => {
    const pickupDate = getTripPickupDateTime(t);
    const hoursDiff = (pickupDate - now) / (1000 * 60 * 60);
    return hoursDiff <= 2 && hoursDiff >= -2 && canTrack(t);
  });
  
  if (activeTrip) {
    state.activeTrip = activeTrip;
    startTracking();
  }
}

function trackTrip(tripId) {
  const trip = state.trips.find(t => t.id == tripId);
  if (!trip) return;
  
  state.activeTrip = trip;
  
  // Switch to track tab
  document.querySelector('.tab-btn[data-tab="track"]').click();
  
  startTracking();
}

function startTracking() {
  if (!state.activeTrip) return;
  
  document.getElementById('noActiveTrip').classList.add('hidden');
  document.getElementById('activeTracking').classList.remove('hidden');
  
  // Update status bar
  updateTrackingStatus();
  
  // Load driver info
  loadDriverInfo();
  
  // Initialize tracking map
  initTrackingMap();
  
  // Start polling for updates
  if (state.preferences.autoRefresh && !state.trackingInterval) {
    state.trackingInterval = setInterval(() => {
      updateDriverLocation();
      checkGeofence();
    }, 10000); // Every 10 seconds
  }
}

function stopTracking() {
  if (state.trackingInterval) {
    clearInterval(state.trackingInterval);
    state.trackingInterval = null;
  }
  
  document.getElementById('activeTracking').classList.add('hidden');
  document.getElementById('noActiveTrip').classList.remove('hidden');
  state.activeTrip = null;
}

function updateTrackingStatus() {
  const status = state.activeTrip?.status;
  const steps = ['stepBooked', 'stepOnWay', 'stepArrived', 'stepInProgress', 'stepComplete'];
  const statusStepMap = {
    'confirmed': 0, 'assigned': 0,
    'enroute': 1,
    'arrived': 2,
    'in_progress': 3, 'passenger_onboard': 3,
    'completed': 4
  };
  
  const currentStep = statusStepMap[status] || 0;
  
  steps.forEach((stepId, index) => {
    const el = document.getElementById(stepId);
    el.classList.remove('active', 'complete');
    if (index < currentStep) el.classList.add('complete');
    if (index === currentStep) el.classList.add('active');
  });
  
  // Update status text
  const statusText = {
    'confirmed': 'Trip Confirmed - Awaiting Driver',
    'assigned': 'Driver Assigned',
    'enroute': 'Driver is on the way',
    'arrived': 'Driver has arrived',
    'in_progress': 'Trip in progress',
    'completed': 'Trip completed'
  };
  
  document.getElementById('trackingStatusText').textContent = statusText[status] || 'Tracking...';
  
  // Announce status if enabled
  if (state.preferences.announceStatus) {
    announceStatus(statusText[status]);
  }
}

function announceStatus(text) {
  if ('speechSynthesis' in window && text) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    speechSynthesis.speak(utterance);
  }
}

async function loadDriverInfo() {
  if (!state.activeTrip?.driver_id) {
    document.getElementById('driverName').textContent = 'Awaiting driver assignment';
    document.getElementById('driverVehicle').textContent = '--';
    return;
  }
  
  try {
    const creds = getSupabaseCredentials();
    const response = await fetch(
      `${creds.url}/rest/v1/drivers?id=eq.${state.activeTrip.driver_id}&select=*`,
      {
        headers: {
          'apikey': creds.anonKey,
          'Authorization': `Bearer ${state.session?.access_token}`
        }
      }
    );
    
    if (response.ok) {
      const drivers = await response.json();
      if (drivers?.length > 0) {
        const driver = drivers[0];
        document.getElementById('driverName').textContent = `${driver.first_name} ${driver.last_name}`;
        document.getElementById('driverVehicle').textContent = driver.vehicle_description || 'Vehicle info pending';
        
        if (driver.phone) {
          document.getElementById('callDriverBtn').href = `tel:${driver.phone}`;
          document.getElementById('textDriverBtn').href = `sms:${driver.phone}`;
        }
      }
    }
  } catch (err) {
    console.error('[CustomerPortal] Failed to load driver info:', err);
  }
}

// ============================================
// Maps
// ============================================
async function initializeMaps() {
  if (!state.mapboxToken) {
    console.warn('[CustomerPortal] Mapbox token not available');
    return;
  }
  
  mapboxgl.accessToken = state.mapboxToken;
}

function initTrackingMap() {
  if (!state.mapboxToken || !state.preferences.showDriverMap) return;
  
  const mapContainer = document.getElementById('trackingMap');
  if (!mapContainer) return;
  
  // Get pickup coordinates (would need geocoding in real implementation)
  const defaultCenter = [-93.265, 44.978]; // Minneapolis default
  
  state.maps.tracking = new mapboxgl.Map({
    container: 'trackingMap',
    style: 'mapbox://styles/mapbox/streets-v12',
    center: defaultCenter,
    zoom: 13
  });
  
  // Add navigation controls
  state.maps.tracking.addControl(new mapboxgl.NavigationControl(), 'top-right');
}

async function updateDriverLocation() {
  if (!state.activeTrip?.driver_id || !state.maps.tracking) return;
  
  try {
    const creds = getSupabaseCredentials();
    const response = await fetch(
      `${creds.url}/rest/v1/driver_locations?driver_id=eq.${state.activeTrip.driver_id}&select=*&order=created_at.desc&limit=1`,
      {
        headers: {
          'apikey': creds.anonKey,
          'Authorization': `Bearer ${state.session?.access_token}`
        }
      }
    );
    
    if (response.ok) {
      const locations = await response.json();
      if (locations?.length > 0) {
        const loc = locations[0];
        const coords = [loc.longitude, loc.latitude];
        
        // Update or create driver marker
        if (state.driverMarker) {
          state.driverMarker.setLngLat(coords);
        } else {
          const el = document.createElement('div');
          el.className = 'driver-marker';
          el.innerHTML = '�';
          el.style.fontSize = '30px';
          
          state.driverMarker = new mapboxgl.Marker(el)
            .setLngLat(coords)
            .addTo(state.maps.tracking);
        }
        
        // Center map on driver
        state.maps.tracking.panTo(coords);
        
        // Update ETA if available
        if (loc.eta_minutes) {
          document.getElementById('etaValue').textContent = `${loc.eta_minutes} min`;
        }
      }
    }
  } catch (err) {
    console.error('[CustomerPortal] Failed to update driver location:', err);
  }
}

function checkGeofence() {
  // Check if customer has arrived at destination
  if (!state.activeTrip || state.activeTrip.status !== 'in_progress') return;
  
  if ('geolocation' in navigator) {
    navigator.geolocation.getCurrentPosition(async (position) => {
      const customerLat = position.coords.latitude;
      const customerLng = position.coords.longitude;
      
      // Get dropoff coordinates (would need geocoding)
      // For now, check with reservation's dropoff location via API
      try {
        const creds = getSupabaseCredentials();
        const response = await fetch(
          `${creds.url}/rest/v1/rpc/check_arrival_geofence`,
          {
            method: 'POST',
            headers: {
              'apikey': creds.anonKey,
              'Authorization': `Bearer ${state.session?.access_token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              reservation_id: state.activeTrip.id,
              customer_lat: customerLat,
              customer_lng: customerLng,
              radius_meters: state.geofenceRadius
            })
          }
        );
        
        if (response.ok) {
          const result = await response.json();
          if (result?.arrived) {
            showTripCompleted();
          }
        }
      } catch (err) {
        // Silent fail
      }
    });
  }
}

function openMapSelection(type) {
  if (!state.mapboxToken) {
    showToast('Map not available', 'warning');
    return;
  }
  
  const modal = document.getElementById('mapModal');
  modal.classList.remove('hidden');
  modal.dataset.addressType = type;
  
  // Initialize selection map
  setTimeout(() => {
    if (state.maps.selection) {
      state.maps.selection.remove();
    }
    
    state.maps.selection = new mapboxgl.Map({
      container: 'selectionMap',
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [-93.265, 44.978],
      zoom: 12
    });
    
    state.maps.selection.addControl(new mapboxgl.NavigationControl());
    
    let marker;
    
    state.maps.selection.on('click', async (e) => {
      const lngLat = e.lngLat;
      
      // Add/move marker
      if (marker) {
        marker.setLngLat(lngLat);
      } else {
        marker = new mapboxgl.Marker()
          .setLngLat(lngLat)
          .addTo(state.maps.selection);
      }
      
      // Reverse geocode
      try {
        const response = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${lngLat.lng},${lngLat.lat}.json?access_token=${state.mapboxToken}`
        );
        const data = await response.json();
        const address = data.features?.[0]?.place_name || `${lngLat.lat.toFixed(6)}, ${lngLat.lng.toFixed(6)}`;
        
        document.getElementById('selectedAddressText').textContent = address;
        document.getElementById('confirmMapSelection').disabled = false;
        document.getElementById('confirmMapSelection').dataset.address = address;
      } catch (err) {
        document.getElementById('selectedAddressText').textContent = `${lngLat.lat.toFixed(6)}, ${lngLat.lng.toFixed(6)}`;
      }
    });
  }, 100);
}

function confirmMapSelection() {
  const modal = document.getElementById('mapModal');
  const type = modal.dataset.addressType;
  const address = document.getElementById('confirmMapSelection').dataset.address;
  
  if (type === 'pickup') {
    document.getElementById('pickupAddressInput').value = address;
    state.selectedPickupAddress = address;
  } else {
    document.getElementById('dropoffAddressInput').value = address;
    state.selectedDropoffAddress = address;
  }
  
  closeModal('mapModal');
}

// ============================================
// Trip Completed Flow
// ============================================
function showTripCompleted() {
  stopTracking();
  document.getElementById('tripCompletedOverlay').classList.remove('hidden');
  
  // Set up star rating
  setupStarRating();
}

function setupStarRating() {
  const stars = document.querySelectorAll('#starRating .star');
  let selectedRating = 0;
  
  stars.forEach(star => {
    star.addEventListener('click', () => {
      selectedRating = parseInt(star.dataset.rating);
      stars.forEach((s, i) => {
        s.classList.toggle('active', i < selectedRating);
      });
    });
    
    star.addEventListener('mouseenter', () => {
      const hoverRating = parseInt(star.dataset.rating);
      stars.forEach((s, i) => {
        s.style.filter = i < hoverRating ? 'grayscale(0)' : 'grayscale(1)';
      });
    });
  });
  
  document.getElementById('starRating').addEventListener('mouseleave', () => {
    stars.forEach((s, i) => {
      s.style.filter = i < selectedRating ? 'grayscale(0)' : 'grayscale(1)';
    });
  });
}

async function submitFeedback() {
  const tip = getSelectedTip();
  const comment = document.getElementById('tripComment').value.trim();
  const rating = document.querySelectorAll('#starRating .star.active').length;
  
  try {
    const creds = getSupabaseCredentials();
    
    // Save feedback
    await fetch(`${creds.url}/rest/v1/trip_feedback`, {
      method: 'POST',
      headers: {
        'apikey': creds.anonKey,
        'Authorization': `Bearer ${state.session?.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        reservation_id: state.activeTrip?.id,
        customer_id: state.customer?.id,
        rating,
        comment,
        tip_amount: tip,
        created_at: new Date().toISOString()
      })
    });
    
    // Update reservation with tip
    if (tip > 0) {
      await fetch(`${creds.url}/rest/v1/reservations?id=eq.${state.activeTrip?.id}`, {
        method: 'PATCH',
        headers: {
          'apikey': creds.anonKey,
          'Authorization': `Bearer ${state.session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ tip_amount: tip })
      });
    }
    
    showToast('Thank you for your feedback!', 'success');
    
    setTimeout(() => {
      document.getElementById('tripCompletedOverlay').classList.add('hidden');
      loadTrips();
    }, 1500);
    
  } catch (err) {
    console.error('[CustomerPortal] Failed to submit feedback:', err);
    showToast('Failed to submit feedback', 'error');
  }
}

function getSelectedTip() {
  const activeBtn = document.querySelector('.tip-btn.active');
  if (!activeBtn) return 0;
  
  const tipValue = activeBtn.dataset.tip;
  if (tipValue === 'custom') {
    return parseFloat(document.getElementById('customTipAmount').value) || 0;
  }
  
  // Calculate percentage tip (would need fare amount)
  // For now, return fixed amounts
  const tipPercentages = { '15': 5, '20': 7, '25': 10, '0': 0 };
  return tipPercentages[tipValue] || 0;
}

// ============================================
// Account Tab
// ============================================
function updateAccountTab() {
  if (!state.customer) return;
  
  document.getElementById('accountFirstName').value = state.customer.first_name || '';
  document.getElementById('accountLastName').value = state.customer.last_name || '';
  document.getElementById('accountEmail').value = state.customer.email || '';
  document.getElementById('accountPhone').value = state.customer.phone || '';
  
  // Booking defaults
  document.getElementById('accountHomeAddress').value = state.customer.home_address || '';
  document.getElementById('accountDefaultPassengers').value = state.customer.default_passenger_count || 1;
  
  // Populate airport and vehicle dropdowns
  populateAccountAirportSelects();
  populateAccountVehicleSelect();
  
  renderSavedPassengers();
  renderSavedAddresses();
  renderFavoriteAirports();
}

function populateAccountAirportSelects() {
  const pickupSelect = document.getElementById('accountPreferredPickupAirport');
  const dropoffSelect = document.getElementById('accountPreferredDropoffAirport');
  
  if (!pickupSelect || !dropoffSelect) return;
  
  // Get airports from state (loaded elsewhere)
  const airports = state.airports || [];
  
  [pickupSelect, dropoffSelect].forEach(select => {
    select.innerHTML = '<option value="">- Select preferred airport -</option>';
    airports.forEach(airport => {
      const opt = document.createElement('option');
      opt.value = airport.code || airport.iata_code || airport.id;
      opt.textContent = `${airport.code || airport.iata_code || ''} - ${airport.name || airport.airport_name || ''}`;
      select.appendChild(opt);
    });
  });
  
  // Set selected values
  if (state.customer.preferred_pickup_airport) {
    pickupSelect.value = state.customer.preferred_pickup_airport;
  }
  if (state.customer.preferred_dropoff_airport) {
    dropoffSelect.value = state.customer.preferred_dropoff_airport;
  }
}

function populateAccountVehicleSelect() {
  const select = document.getElementById('accountPreferredVehicle');
  if (!select) return;
  
  select.innerHTML = '<option value="">- Select preferred vehicle -</option>';
  state.vehicleTypes.forEach(vt => {
    const opt = document.createElement('option');
    opt.value = vt.id || vt.name;
    opt.textContent = vt.name || vt.type_name;
    select.appendChild(opt);
  });
  
  // Set selected value
  if (state.customer.preferred_vehicle_type) {
    select.value = state.customer.preferred_vehicle_type;
  }
}

async function saveBookingDefaults() {
  const homeAddress = document.getElementById('accountHomeAddress').value.trim();
  const preferredPickupAirport = document.getElementById('accountPreferredPickupAirport').value;
  const preferredDropoffAirport = document.getElementById('accountPreferredDropoffAirport').value;
  const defaultPassengers = parseInt(document.getElementById('accountDefaultPassengers').value) || 1;
  const preferredVehicle = document.getElementById('accountPreferredVehicle').value;
  
  try {
    const creds = getSupabaseCredentials();
    const response = await fetch(`${creds.url}/rest/v1/accounts?id=eq.${state.customer.id}`, {
      method: 'PATCH',
      headers: {
        'apikey': creds.anonKey,
        'Authorization': `Bearer ${state.session?.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        home_address: homeAddress,
        preferred_pickup_airport: preferredPickupAirport,
        preferred_dropoff_airport: preferredDropoffAirport,
        default_passenger_count: defaultPassengers,
        preferred_vehicle_type: preferredVehicle,
        updated_at: new Date().toISOString()
      })
    });
    
    if (response.ok) {
      // Update local state
      state.customer.home_address = homeAddress;
      state.customer.preferred_pickup_airport = preferredPickupAirport;
      state.customer.preferred_dropoff_airport = preferredDropoffAirport;
      state.customer.default_passenger_count = defaultPassengers;
      state.customer.preferred_vehicle_type = preferredVehicle;
      
      // Save home address as a saved address if not exists
      if (homeAddress) {
        await saveHomeAddressAsSaved(homeAddress);
      }
      
      showToast('Booking defaults saved!', 'success');
    } else {
      throw new Error('Failed to save');
    }
  } catch (err) {
    console.error('[CustomerPortal] Failed to save booking defaults:', err);
    showToast('Failed to save booking defaults', 'error');
  }
}

async function saveHomeAddressAsSaved(homeAddress) {
  // Check if home address already exists
  const existingHome = state.savedAddresses.find(a => 
    a.label?.toLowerCase() === 'home' || a.address_type === 'home'
  );
  
  if (existingHome) {
    // Update existing
    try {
      const creds = getSupabaseCredentials();
      await fetch(`${creds.url}/rest/v1/customer_addresses?id=eq.${existingHome.id}`, {
        method: 'PATCH',
        headers: {
          'apikey': creds.anonKey,
          'Authorization': `Bearer ${state.session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          full_address: homeAddress,
          updated_at: new Date().toISOString()
        })
      });
      existingHome.full_address = homeAddress;
    } catch (err) {
      console.error('[CustomerPortal] Failed to update home address:', err);
    }
  } else {
    // Create new home address
    try {
      const creds = getSupabaseCredentials();
      const response = await fetch(`${creds.url}/rest/v1/customer_addresses`, {
        method: 'POST',
        headers: {
          'apikey': creds.anonKey,
          'Authorization': `Bearer ${state.session?.access_token}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          account_id: state.customer.id,
          label: 'Home',
          full_address: homeAddress,
          address_type: 'home',
          is_favorite: true,
          is_deleted: false,
          is_visible: true
        })
      });
      
      if (response.ok) {
        const newAddresses = await response.json();
        if (newAddresses?.length > 0) {
          state.savedAddresses.unshift(newAddresses[0]);
          populateAddressDropdowns();
          renderSavedAddresses();
        }
      }
    } catch (err) {
      console.error('[CustomerPortal] Failed to save home address:', err);
    }
  }
}

function renderSavedPassengers() {
  const container = document.getElementById('savedPassengersList');
  if (!container) return;
  
  if (state.savedPassengers.length === 0) {
    container.innerHTML = '<p class="empty-hint">No saved passengers</p>';
    return;
  }
  
  container.innerHTML = state.savedPassengers.map(p => `
    <div class="saved-item">
      <span class="saved-item-icon">👤</span>
      <div class="saved-item-content">
        <div class="saved-item-name">${p.first_name} ${p.last_name}</div>
        <div class="saved-item-detail">${p.phone}</div>
      </div>
      <button class="saved-item-delete" data-id="${p.id}">🗑️</button>
    </div>
  `).join('');
  
  // Delete handlers
  container.querySelectorAll('.saved-item-delete').forEach(btn => {
    btn.addEventListener('click', () => deleteSavedPassenger(btn.dataset.id));
  });
}

function renderSavedAddresses() {
  const container = document.getElementById('savedAddressesList');
  if (!container) return;
  
  if (state.savedAddresses.length === 0) {
    container.innerHTML = '<p class="empty-hint">No saved addresses</p>';
    return;
  }
  
  // Sort: favorites first, then by usage count
  const sortedAddresses = [...state.savedAddresses].sort((a, b) => {
    if (a.is_favorite && !b.is_favorite) return -1;
    if (!a.is_favorite && b.is_favorite) return 1;
    return (b.usage_count || 0) - (a.usage_count || 0);
  });
  
  container.innerHTML = sortedAddresses.map(a => {
    const icon = a.label === 'Home' ? '🏠' : a.label === 'Work' ? '🏢' : '📍';
    const starClass = a.is_favorite ? 'favorite-active' : '';
    // Use ★ (filled) when favorite, ☆ (outline) when not
    const starIcon = a.is_favorite ? '★' : '☆';
    const address = a.full_address || a.address || '';
    
    return `
      <div class="saved-item ${a.is_favorite ? 'is-favorite' : ''}">
        <span class="saved-item-icon">${icon}</span>
        <div class="saved-item-content">
          <div class="saved-item-name">${a.label || 'Address'}</div>
          <div class="saved-item-detail">${address}</div>
        </div>
        <button type="button" class="saved-item-favorite ${starClass}" data-id="${a.id}" title="${a.is_favorite ? 'Remove from favorites' : 'Add to favorites'}">${starIcon}</button>
        <button type="button" class="saved-item-delete" data-id="${a.id}" title="Delete address">🗑️</button>
      </div>
    `;
  }).join('');
  
  // Favorite handlers
  container.querySelectorAll('.saved-item-favorite').forEach(btn => {
    btn.addEventListener('click', () => toggleAddressFavorite(btn.dataset.id));
  });
  
  // Delete handlers
  container.querySelectorAll('.saved-item-delete').forEach(btn => {
    btn.addEventListener('click', () => deleteSavedAddress(btn.dataset.id));
  });
}

function renderFavoriteAirports() {
  const container = document.getElementById('favoriteAirportsList');
  if (!container) return;
  
  const airports = state.airports || [];
  
  if (airports.length === 0) {
    container.innerHTML = '<p class="empty-hint">No airports available</p>';
    return;
  }
  
  // Get customer's favorite airport codes
  const favoriteAirportCodes = state.customer?.favorite_airports || [];
  
  // Sort: favorites first
  const sortedAirports = [...airports].sort((a, b) => {
    const aFav = favoriteAirportCodes.includes(a.code);
    const bFav = favoriteAirportCodes.includes(b.code);
    if (aFav && !bFav) return -1;
    if (!aFav && bFav) return 1;
    return 0;
  });
  
  container.innerHTML = sortedAirports.map(airport => {
    const isFavorite = favoriteAirportCodes.includes(airport.code);
    const starClass = isFavorite ? 'favorite-active' : '';
    const starIcon = isFavorite ? '⭐' : '☆';
    
    return `
      <div class="saved-item ${isFavorite ? 'is-favorite' : ''}" data-code="${airport.code}">
        <span class="saved-item-icon">✈️</span>
        <div class="saved-item-content">
          <div class="saved-item-name">${airport.code}${isFavorite ? ' ⭐' : ''}</div>
          <div class="saved-item-detail">${airport.name}</div>
        </div>
        <button class="saved-item-favorite ${starClass}" data-code="${airport.code}" title="Toggle favorite">${starIcon}</button>
      </div>
    `;
  }).join('');
  
  // Favorite handlers
  container.querySelectorAll('.saved-item-favorite').forEach(btn => {
    btn.addEventListener('click', () => toggleAirportFavorite(btn.dataset.code));
  });
}

async function toggleAirportFavorite(airportCode) {
  try {
    const creds = getSupabaseCredentials();
    
    // Get current favorites
    let favorites = state.customer?.favorite_airports || [];
    
    // Toggle
    if (favorites.includes(airportCode)) {
      favorites = favorites.filter(c => c !== airportCode);
    } else {
      favorites.push(airportCode);
    }
    
    // Save to database
    await fetch(`${creds.url}/rest/v1/accounts?id=eq.${state.customer?.id}`, {
      method: 'PATCH',
      headers: {
        'apikey': creds.anonKey,
        'Authorization': `Bearer ${state.session?.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ favorite_airports: favorites })
    });
    
    // Update local state
    state.customer.favorite_airports = favorites;
    localStorage.setItem('current_customer', JSON.stringify(state.customer));
    
    // Re-render
    renderFavoriteAirports();
    populateAirportDropdowns();
    
    const isFav = favorites.includes(airportCode);
    showToast(isFav ? `${airportCode} added to favorites ⭐` : `${airportCode} removed from favorites`, 'success');
  } catch (err) {
    console.error('[CustomerPortal] Failed to toggle airport favorite:', err);
    showToast('Failed to update favorite', 'error');
  }
}

async function deleteSavedPassenger(passengerId) {
  if (!confirm('Remove this passenger?')) return;
  
  try {
    const creds = getSupabaseCredentials();
    await fetch(`${creds.url}/rest/v1/customer_passengers?id=eq.${passengerId}`, {
      method: 'DELETE',
      headers: {
        'apikey': creds.anonKey,
        'Authorization': `Bearer ${state.session?.access_token}`
      }
    });
    
    state.savedPassengers = state.savedPassengers.filter(p => p.id != passengerId);
    renderSavedPassengers();
    populatePassengerDropdown();
    showToast('Passenger removed', 'success');
  } catch (err) {
    console.error('[CustomerPortal] Failed to delete passenger:', err);
    showToast('Failed to remove passenger', 'error');
  }
}

async function saveProfile() {
  const firstName = document.getElementById('accountFirstName').value.trim();
  const lastName = document.getElementById('accountLastName').value.trim();
  const phone = document.getElementById('accountPhone').value.trim();
  
  if (!firstName || !lastName) {
    showToast('Name is required', 'error');
    return;
  }
  
  try {
    const creds = getSupabaseCredentials();
    await fetch(`${creds.url}/rest/v1/accounts?id=eq.${state.customer?.id}`, {
      method: 'PATCH',
      headers: {
        'apikey': creds.anonKey,
        'Authorization': `Bearer ${state.session?.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ first_name: firstName, last_name: lastName, phone })
    });
    
    state.customer.first_name = firstName;
    state.customer.last_name = lastName;
    state.customer.phone = phone;
    localStorage.setItem('current_customer', JSON.stringify(state.customer));
    
    document.getElementById('welcomeName').textContent = `${firstName} ${lastName}`;
    showToast('Profile saved', 'success');
  } catch (err) {
    console.error('[CustomerPortal] Failed to save profile:', err);
    showToast('Failed to save profile', 'error');
  }
}

// ============================================
// Event Listeners
// ============================================
function setupEventListeners() {
  // Tab navigation
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`${btn.dataset.tab}Tab`).classList.add('active');
    });
  });
  
  // Note: Preferences and logout are now handled by the user menu component (customer-user-menu.js)
  
  // Passenger selection
  document.getElementById('passengerSelect')?.addEventListener('change', (e) => {
    fillPassengerDetails(e.target.value);
  });
  
  // Passenger count
  document.getElementById('countMinus')?.addEventListener('click', () => {
    const input = document.getElementById('passengerCount');
    const val = parseInt(input.value) || 1;
    if (val > 1) {
      input.value = val - 1;
      handlePassengerCountChange(val - 1);
    }
  });
  
  document.getElementById('countPlus')?.addEventListener('click', () => {
    const input = document.getElementById('passengerCount');
    const val = parseInt(input.value) || 1;
    if (val < 50) {
      input.value = val + 1;
      handlePassengerCountChange(val + 1);
    }
  });
  
  // Also listen for direct input changes
  document.getElementById('passengerCount')?.addEventListener('change', (e) => {
    const val = parseInt(e.target.value) || 1;
    handlePassengerCountChange(val);
  });
  
  // Address selectors
  document.getElementById('pickupAddressSelect')?.addEventListener('change', async (e) => {
    const val = e.target.value;
    console.log('[CustomerPortal] Pickup address select changed to:', val);
    
    // Show/hide appropriate containers
    document.getElementById('pickupAddressNew').classList.toggle('hidden', val !== 'new');
    document.getElementById('airportPickupDetails').classList.toggle('hidden', val !== 'airport');
    
    // If "selected" is chosen, just keep the current selection (already set)
    if (val === 'selected') {
      document.getElementById('savedPickupAddresses').classList.add('hidden');
      return;
    }
    
    // Handle saved addresses - always populate when selected
    if (val === 'saved') {
      const container = document.getElementById('savedPickupAddresses');
      console.log('[CustomerPortal] Saved pickup selected, addressesLoaded:', state.addressesLoaded, 'count:', state.savedAddresses?.length || 0);
      
      // Show container immediately
      if (container) container.classList.remove('hidden');
      
      // If addresses haven't been loaded yet, fetch them
      if (!state.addressesLoaded) {
        if (container) {
          container.innerHTML = '<p style="padding: 12px; color: #6b7280; text-align: center;">Loading addresses...</p>';
        }
        await loadSavedAddresses();
        console.log('[CustomerPortal] After loading, addressesLoaded:', state.addressesLoaded, 'count:', state.savedAddresses?.length || 0);
      }
      
      // Always populate to ensure content is fresh
      populateAddressDropdowns();
    } else {
      document.getElementById('savedPickupAddresses').classList.add('hidden');
    }
    
    // Clear selection only when switching to airport, new, or empty
    if (val === 'airport' || val === 'new' || val === '') {
      clearSelectedAddress('pickup');
    }
      state.selectedPickupAddress = null;
    }
    
    // Auto-select trip type based on airport selection
    updateTripTypeFromAddresses();
  });
  
  document.getElementById('dropoffAddressSelect')?.addEventListener('change', async (e) => {
    const val = e.target.value;
    console.log('[CustomerPortal] Dropoff address select changed to:', val);
    
    // Show/hide appropriate containers
    document.getElementById('dropoffAddressNew').classList.toggle('hidden', val !== 'new');
    document.getElementById('airportDropoffDetails').classList.toggle('hidden', val !== 'airport');
    
    // If "selected" is chosen, just keep the current selection (already set)
    if (val === 'selected') {
      document.getElementById('savedDropoffAddresses').classList.add('hidden');
      return;
    }
    
    // Handle saved addresses - always populate when selected
    if (val === 'saved') {
      const container = document.getElementById('savedDropoffAddresses');
      console.log('[CustomerPortal] Saved dropoff selected, addressesLoaded:', state.addressesLoaded, 'count:', state.savedAddresses?.length || 0);
      
      // Show container immediately
      if (container) container.classList.remove('hidden');
      
      // If addresses haven't been loaded yet, fetch them
      if (!state.addressesLoaded) {
        if (container) {
          container.innerHTML = '<p style="padding: 12px; color: #6b7280; text-align: center;">Loading addresses...</p>';
        }
        await loadSavedAddresses();
        console.log('[CustomerPortal] After loading, addressesLoaded:', state.addressesLoaded, 'count:', state.savedAddresses?.length || 0);
      }
      
      // Always populate to ensure content is fresh
      populateAddressDropdowns();
    } else {
      document.getElementById('savedDropoffAddresses').classList.add('hidden');
    }
    
    // Clear selection only when switching to airport, new, or empty
    if (val === 'airport' || val === 'new' || val === '') {
      clearSelectedAddress('dropoff');
    }
    
    // Auto-select trip type based on airport selection
    updateTripTypeFromAddresses();
  });
  
  // Airport dropdown selection - triggers route/price calculation
  document.getElementById('pickupAirport')?.addEventListener('change', (e) => {
    if (e.target.value) {
      // Get the full airport address from the data attribute
      const selectedOption = e.target.options[e.target.selectedIndex];
      const airportAddress = selectedOption?.dataset?.address || e.target.value;
      state.selectedPickupAddress = airportAddress;
      console.log('[CustomerPortal] Pickup airport selected:', e.target.value, 'Address:', airportAddress);
      updateTripTypeFromAddresses();
      calculateRouteAndPrice();
    }
  });
  
  document.getElementById('dropoffAirport')?.addEventListener('change', (e) => {
    if (e.target.value) {
      // Get the full airport address from the data attribute
      const selectedOption = e.target.options[e.target.selectedIndex];
      const airportAddress = selectedOption?.dataset?.address || e.target.value;
      state.selectedDropoffAddress = airportAddress;
      console.log('[CustomerPortal] Dropoff airport selected:', e.target.value, 'Address:', airportAddress);
      updateTripTypeFromAddresses();
      calculateRouteAndPrice();
    }
  });
  
  // Map buttons
  document.getElementById('pickupMapBtn')?.addEventListener('click', () => openMapSelection('pickup'));
  document.getElementById('dropoffMapBtn')?.addEventListener('click', () => openMapSelection('dropoff'));
  
  // Airline code selector - update hint when selected
  document.getElementById('airlineCode')?.addEventListener('change', (e) => {
    const hint = document.getElementById('flightNumberHint');
    const flightInput = document.getElementById('flightNumber');
    const airlineCode = e.target.value;
    
    if (airlineCode && airlineCode !== 'OTHER') {
      hint.textContent = `Enter flight number only (e.g., ${airlineCode}1234 → just enter 1234)`;
      flightInput.placeholder = 'e.g., 1234';
    } else if (airlineCode === 'OTHER') {
      hint.textContent = 'Enter full flight number with airline code (e.g., DL1234)';
      flightInput.placeholder = 'e.g., DL1234';
    } else {
      hint.textContent = 'Enter flight number without airline code';
      flightInput.placeholder = 'e.g., 1234';
    }
  });
  
  // Flight verification
  document.getElementById('verifyFlightBtn')?.addEventListener('click', verifyFlight);
  
  // Trip type selection (Standard vs Hourly)
  document.querySelectorAll('input[name="tripType"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      state.tripType = e.target.value;
      const hourlyOptions = document.getElementById('hourlyOptions');
      if (hourlyOptions) {
        hourlyOptions.classList.toggle('hidden', e.target.value !== 'hourly');
      }
      console.log('[CustomerPortal] Trip type changed to:', state.tripType);
    });
  });
  
  // Hourly duration controls
  document.getElementById('hoursMinusBtn')?.addEventListener('click', () => {
    const input = document.getElementById('hourlyDuration');
    const val = parseInt(input.value) || 2;
    if (val > 2) {
      input.value = val - 1;
      state.hourlyDuration = val - 1;
    }
  });
  
  document.getElementById('hoursPlusBtn')?.addEventListener('click', () => {
    const input = document.getElementById('hourlyDuration');
    const val = parseInt(input.value) || 2;
    if (val < 12) {
      input.value = val + 1;
      state.hourlyDuration = val + 1;
    }
  });
  
  document.getElementById('hourlyDuration')?.addEventListener('change', (e) => {
    let val = parseInt(e.target.value) || 2;
    val = Math.max(2, Math.min(12, val)); // Clamp between 2-12
    e.target.value = val;
    state.hourlyDuration = val;
  });
  
  // Stops
  document.getElementById('addStopBtn')?.addEventListener('click', addStop);
  
  // Booking buttons
  document.getElementById('bookOneWayBtn')?.addEventListener('click', () => bookTrip(false));
  document.getElementById('bookRoundTripBtn')?.addEventListener('click', () => bookTrip(true));
  
  // Trips filter
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderTrips(btn.dataset.filter);
    });
  });
  
  // Passenger modal
  document.getElementById('addPassengerBtn')?.addEventListener('click', () => {
    document.getElementById('passengerModal').classList.remove('hidden');
  });
  document.getElementById('closePassengerModal')?.addEventListener('click', () => closeModal('passengerModal'));
  document.getElementById('cancelPassenger')?.addEventListener('click', () => closeModal('passengerModal'));
  document.getElementById('confirmPassenger')?.addEventListener('click', addNewPassenger);
  
  // Address modal
  document.getElementById('addSavedAddressBtn')?.addEventListener('click', () => {
    document.getElementById('addressModal').classList.remove('hidden');
  });
  document.getElementById('closeAddressModal')?.addEventListener('click', () => closeModal('addressModal'));
  document.getElementById('cancelAddress')?.addEventListener('click', () => closeModal('addressModal'));
  document.getElementById('confirmAddress')?.addEventListener('click', saveNewAddress);
  
  // Map modal
  document.getElementById('closeMapModal')?.addEventListener('click', () => closeModal('mapModal'));
  document.getElementById('cancelMapSelection')?.addEventListener('click', () => closeModal('mapModal'));
  document.getElementById('confirmMapSelection')?.addEventListener('click', confirmMapSelection);
  
  // Preferences modal
  document.getElementById('closePreferencesModal')?.addEventListener('click', () => closeModal('preferencesModal'));
  document.getElementById('savePreferences')?.addEventListener('click', savePreferences);
  
  // Tip buttons
  document.querySelectorAll('.tip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tip-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('customTipInput').classList.toggle('hidden', btn.dataset.tip !== 'custom');
    });
  });
  
  // Submit feedback
  document.getElementById('submitFeedbackBtn')?.addEventListener('click', submitFeedback);
  
  // Save profile
  document.getElementById('saveProfileBtn')?.addEventListener('click', saveProfile);
  
  // Save booking defaults
  document.getElementById('saveBookingDefaultsBtn')?.addEventListener('click', saveBookingDefaults);
  
  // Add passenger in account tab
  document.getElementById('addSavedPassengerBtn')?.addEventListener('click', () => {
    document.getElementById('passengerModal').classList.remove('hidden');
  });
}

// ============================================
// Utilities
// ============================================
function closeModal(modalId) {
  document.getElementById(modalId)?.classList.add('hidden');
}

function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  setTimeout(() => {
    toast.className = 'toast';
  }, 3000);
}

// ============================================
// Google Places Autocomplete for Address Search
// ============================================
function setupAddressAutocomplete() {
  function initAutocomplete() {
    if (!window.google?.maps?.places) {
      setTimeout(initAutocomplete, 100);
      return;
    }
    
    // Setup for pickup address
    setupPlacesAutocomplete('pickupAddressInput', 'pickupAddressSuggestions', 'pickup');
    
    // Setup for dropoff address
    setupPlacesAutocomplete('dropoffAddressInput', 'dropoffAddressSuggestions', 'dropoff');
    
    console.log('[CustomerPortal] Google Places autocomplete initialized');
  }
  
  if (window.googleMapsReady) {
    initAutocomplete();
  } else {
    window.onGoogleMapsReady = initAutocomplete;
  }
}

function setupPlacesAutocomplete(inputId, suggestionsId, type) {
  const input = document.getElementById(inputId);
  const suggestionsContainer = document.getElementById(suggestionsId);
  
  if (!input || !suggestionsContainer) return;
  
  const autocomplete = new google.maps.places.Autocomplete(input, {
    types: ['establishment', 'geocode'],
    componentRestrictions: { country: 'us' },
    fields: ['place_id', 'formatted_address', 'name', 'geometry', 'types', 'address_components']
  });
  
  // Store autocomplete reference
  if (type === 'pickup') {
    state.pickupAutocomplete = autocomplete;
  } else {
    state.dropoffAutocomplete = autocomplete;
  }
  
  autocomplete.addListener('place_changed', () => {
    const place = autocomplete.getPlace();
    
    if (!place.geometry) {
      console.warn('[CustomerPortal] No geometry for selected place');
      return;
    }
    
    // Build the full address with business name if applicable
    let fullAddress = place.formatted_address;
    const isEstablishment = place.types?.some(t => 
      ['establishment', 'point_of_interest', 'restaurant', 'lodging', 'store'].includes(t)
    );
    
    if (isEstablishment && place.name && !place.formatted_address.includes(place.name)) {
      fullAddress = `${place.name}, ${place.formatted_address}`;
    }
    
    // Store the address with coordinates
    const addressData = {
      fullAddress,
      name: place.name,
      formattedAddress: place.formatted_address,
      coordinates: {
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng()
      },
      placeId: place.place_id,
      addressComponents: parseAddressComponents(place.address_components)
    };
    
    if (type === 'pickup') {
      state.selectedPickupAddress = fullAddress;
      state.pickupAddressData = addressData;
      input.value = fullAddress;
    } else {
      state.selectedDropoffAddress = fullAddress;
      state.dropoffAddressData = addressData;
      input.value = fullAddress;
    }
    
    // Hide suggestions
    suggestionsContainer.classList.remove('active');
    
    // Calculate route for pricing
    calculateRouteAndPrice();
    
    console.log(`[CustomerPortal] ${type} address selected:`, addressData);
  });
  
  // Handle input focus to show pac-container
  input.addEventListener('focus', () => {
    suggestionsContainer.classList.remove('active');
  });
  
  input.addEventListener('blur', () => {
    setTimeout(() => suggestionsContainer.classList.remove('active'), 200);
  });
}

function parseAddressComponents(components) {
  const result = {
    street_number: '',
    route: '',
    city: '',
    state: '',
    zip: '',
    country: ''
  };
  
  if (!components) return result;
  
  components.forEach(c => {
    if (c.types.includes('street_number')) result.street_number = c.long_name;
    if (c.types.includes('route')) result.route = c.long_name;
    if (c.types.includes('locality')) result.city = c.long_name;
    if (c.types.includes('administrative_area_level_1')) result.state = c.short_name;
    if (c.types.includes('postal_code')) result.zip = c.long_name;
    if (c.types.includes('country')) result.country = c.short_name;
  });
  
  result.street = [result.street_number, result.route].filter(Boolean).join(' ');
  return result;
}

// ============================================
// Route Calculation and Pricing
// ============================================
async function calculateRouteAndPrice() {
  const pickupType = document.getElementById('pickupAddressSelect')?.value;
  const dropoffType = document.getElementById('dropoffAddressSelect')?.value;
  
  // Get pickup address - check state first, then form elements
  let pickupAddress = state.selectedPickupAddress || null;
  if (!pickupAddress) {
    if (pickupType === 'airport') {
      const airportSelect = document.getElementById('pickupAirport');
      const selectedOption = airportSelect?.options[airportSelect.selectedIndex];
      pickupAddress = selectedOption?.dataset?.address || airportSelect?.value;
    } else {
      // Try to get from input field
      const pickupInput = document.getElementById('pickupAddress');
      if (pickupInput?.value) pickupAddress = pickupInput.value;
    }
  }
  
  // Get dropoff address - check state first, then form elements
  let dropoffAddress = state.selectedDropoffAddress || null;
  if (!dropoffAddress) {
    if (dropoffType === 'airport') {
      const airportSelect = document.getElementById('dropoffAirport');
      const selectedOption = airportSelect?.options[airportSelect.selectedIndex];
      dropoffAddress = selectedOption?.dataset?.address || airportSelect?.value;
    } else {
      // Try to get from input field
      const dropoffInput = document.getElementById('dropoffAddress');
      if (dropoffInput?.value) dropoffAddress = dropoffInput.value;
    }
  }
  
  if (!pickupAddress || !dropoffAddress) {
    state.routeInfo = null;
    return;
  }
  
  console.log('[CustomerPortal] Calculating route:', pickupAddress, '→', dropoffAddress);
  
  try {
    // Use Google Maps Directions API
    if (!window.google?.maps) {
      console.warn('[CustomerPortal] Google Maps not ready for route calculation');
      return;
    }
    
    const directionsService = new google.maps.DirectionsService();
    const result = await new Promise((resolve, reject) => {
      directionsService.route({
        origin: pickupAddress,
        destination: dropoffAddress,
        travelMode: google.maps.TravelMode.DRIVING
      }, (response, status) => {
        if (status === 'OK') {
          resolve(response);
        } else {
          reject(new Error(`Directions failed: ${status}`));
        }
      });
    });
    
    const leg = result.routes[0]?.legs[0];
    if (leg) {
      state.routeInfo = {
        distanceMeters: leg.distance.value,
        distanceText: leg.distance.text,
        durationSeconds: leg.duration.value,
        durationText: leg.duration.text,
        distanceMiles: leg.distance.value / 1609.34
      };
      
      console.log('[CustomerPortal] Route calculated:', state.routeInfo);
      
      // Calculate price based on vehicle type
      calculatePrice();
    }
  } catch (err) {
    console.error('[CustomerPortal] Route calculation error:', err);
    state.routeInfo = null;
  }
}

/**
 * Calculate price using tiered distance formula
 * Tier 1: First X miles at rate1
 * Tier 2: Next Y miles at rate2
 * Tier 3: Remaining miles at rate3
 * Final result multiplied by multiplier
 */
function calculateTieredPrice(distanceMiles, formula) {
  const multiplier = parseFloat(formula.multiplier) || 1.27;
  const tier1Rate = parseFloat(formula.tier1_rate) || 7.87;
  const tier1Max = parseFloat(formula.tier1_max) || 3;
  const tier2Rate = parseFloat(formula.tier2_rate) || 3.50;
  const tier2Range = parseFloat(formula.tier2_range) || 7;
  const tier3Rate = parseFloat(formula.tier3_rate) || 3.25;
  
  let cost = 0;
  let remainingMiles = distanceMiles;
  
  // Tier 1
  const tier1Miles = Math.min(remainingMiles, tier1Max);
  cost += tier1Miles * tier1Rate;
  remainingMiles -= tier1Miles;
  
  // Tier 2
  if (remainingMiles > 0) {
    const tier2Miles = Math.min(remainingMiles, tier2Range);
    cost += tier2Miles * tier2Rate;
    remainingMiles -= tier2Miles;
  }
  
  // Tier 3 (remaining)
  if (remainingMiles > 0) {
    cost += remainingMiles * tier3Rate;
  }
  
  // Apply multiplier
  return cost * multiplier;
}

function calculatePrice() {
  const priceDisplay = document.getElementById('estimatedPrice');
  const routeInfoDisplay = document.getElementById('routeInfo');
  
  if (!state.routeInfo || !state.selectedVehicleType) {
    state.estimatedPrice = null;
    if (priceDisplay) priceDisplay.textContent = '--';
    if (routeInfoDisplay) routeInfoDisplay.textContent = '';
    return;
  }
  
  // Find selected vehicle type data
  const vehicleType = state.vehicleTypes.find(v => v.id === state.selectedVehicleType || v.name === state.selectedVehicleType);
  if (!vehicleType) {
    state.estimatedPrice = null;
    if (priceDisplay) priceDisplay.textContent = '--';
    return;
  }
  
  let price = 0;
  const distanceMiles = state.routeInfo.distanceMiles;
  const durationMinutes = state.routeInfo.durationSeconds / 60;
  
  // Extract rates from the nested structure (metadata.rates or rates)
  const rates = vehicleType.rates || vehicleType.metadata?.rates || {};
  const distanceRates = rates.distance || {};
  const hourlyRates = rates.perHour || {};
  
  // Check for hourly vs point-to-point
  if (state.tripType === 'hourly') {
    // Hourly rate - check nested rates first, then flat fields
    const hourlyRate = parseFloat(hourlyRates.ratePerHour) || 
                       parseFloat(vehicleType.hourly_rate) || 
                       parseFloat(vehicleType.base_rate) || 75;
    const minHours = parseFloat(hourlyRates.minimumHours) || 2;
    price = hourlyRate * Math.max(state.hourlyDuration || minHours, minHours);
  } else {
    // Point-to-point / Airport Transfer: use distance-based pricing
    // Check for tiered formula first
    const tieredFormula = distanceRates.tieredFormula;
    
    if (tieredFormula?.enabled && distanceMiles > 0) {
      // Use tiered distance formula
      price = calculateTieredPrice(distanceMiles, tieredFormula);
    } else {
      // Simple: base fare + (miles × per-mile rate)
      const baseFare = parseFloat(distanceRates.baseFare) || 
                       parseFloat(distanceRates.minimumFare) || 
                       parseFloat(vehicleType.base_rate) || 0;
      const perMileRate = parseFloat(distanceRates.ratePerMile) || 
                          parseFloat(vehicleType.per_mile_rate) || 
                          parseFloat(vehicleType.rate_per_mile) || 3;
      const minimumFare = parseFloat(distanceRates.minimumFare) || 
                          parseFloat(vehicleType.minimum_fare) || 
                          parseFloat(vehicleType.min_fare) || 50;
      
      price = baseFare + (distanceMiles * perMileRate);
      price = Math.max(price, minimumFare);
    }
    
    // Add gratuity if configured
    const gratuityPercent = parseFloat(distanceRates.gratuity) || 0;
    if (gratuityPercent > 0) {
      price = price * (1 + gratuityPercent / 100);
    }
  }
  
  // Round to 2 decimal places
  state.estimatedPrice = Math.round(price * 100) / 100;
  
  console.log('[CustomerPortal] Estimated price:', state.estimatedPrice, 'for', vehicleType.name, 'rates:', rates);
  
  // Update price display
  if (priceDisplay) {
    priceDisplay.textContent = `$${state.estimatedPrice.toFixed(2)}`;
    console.log('[CustomerPortal] Price display updated to:', priceDisplay.textContent);
  } else {
    console.warn('[CustomerPortal] ⚠️ Price display element not found! Cannot show price.');
  }
  
  // Update route info display
  if (routeInfoDisplay && state.routeInfo) {
    routeInfoDisplay.textContent = `${state.routeInfo.distanceText} • ${state.routeInfo.durationText}`;
  }
}

// ============================================
// Initialize
// ============================================
// Setup address autocomplete on load
setTimeout(() => setupAddressAutocomplete(), 500);

document.addEventListener('DOMContentLoaded', init);
