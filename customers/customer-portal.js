// ============================================
// Customer Portal - Main JavaScript
// ============================================

import { getSupabaseCredentials } from '/shared/supabase-config.js';

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
  trips: [],
  activeTrip: null,
  vehicleTypes: [],
  airports: [],
  selectedVehicleType: null,
  selectedPickupAddress: null,
  selectedDropoffAddress: null,
  stops: [],
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
  welcomeMessage: 'Welcome back!',
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
  affiliate: 'in-house',              // Default affiliate
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
async function init() {
  console.log('[CustomerPortal] Initializing...');
  
  // Get portal slug from URL
  extractPortalSlug();
  
  // Check authentication
  const isAuth = await checkAuth();
  
  if (!isAuth) {
    // Redirect to auth page
    window.location.href = 'auth.html';
    return;
  }
  
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
  
  console.log('[CustomerPortal] Initialized successfully');
}

function extractPortalSlug() {
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

function logout() {
  localStorage.removeItem('customer_session');
  localStorage.removeItem('current_customer');
  window.location.href = 'auth.html';
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
        Object.assign(portalSettings, settings[0]);
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
  
  // Update titles
  document.getElementById('headerTitle').textContent = portalSettings.headerTitle || 'RELIALIMO';
  document.getElementById('thankYouCompany').textContent = portalSettings.thankYouMessage || 'RELIALIMO thanks you';
  
  // Update welcome message
  if (state.customer) {
    document.getElementById('welcomeGreeting').textContent = portalSettings.welcomeMessage || 'Welcome back!';
    document.getElementById('welcomeName').textContent = `${state.customer.first_name || ''} ${state.customer.last_name || ''}`.trim();
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
    // Query using account_id (billing account) and filter visible/non-deleted addresses
    const response = await fetch(
      `${creds.url}/rest/v1/customer_addresses?account_id=eq.${state.customer?.id}&is_deleted=eq.false&is_visible=eq.true&select=*&order=is_favorite.desc,usage_count.desc`,
      {
        headers: {
          'apikey': creds.anonKey,
          'Authorization': `Bearer ${state.session?.access_token}`
        }
      }
    );
    
    if (response.ok) {
      state.savedAddresses = await response.json();
    }
  } catch (err) {
    console.error('[CustomerPortal] Failed to load addresses:', err);
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
    const response = await fetch(
      `${creds.url}/rest/v1/vehicle_types?is_active=eq.true&select=*&order=sort_order.asc`,
      {
        headers: {
          'apikey': creds.anonKey
        }
      }
    );
    
    if (response.ok) {
      state.vehicleTypes = await response.json();
      renderVehicleTypes();
    }
  } catch (err) {
    console.error('[CustomerPortal] Failed to load vehicle types:', err);
    // Fallback default types
    state.vehicleTypes = [
      { id: 'sedan', name: 'Sedan', icon: '🚗', capacity: '1-3 passengers' },
      { id: 'suv', name: 'SUV', icon: '🚙', capacity: '1-5 passengers' },
      { id: 'van', name: 'Van', icon: '🚐', capacity: '1-7 passengers' },
      { id: 'limo', name: 'Limousine', icon: '🚖', capacity: '1-8 passengers' }
    ];
    renderVehicleTypes();
  }
}

function renderVehicleTypes() {
  const container = document.getElementById('vehicleTypeSelector');
  if (!container) return;
  
  container.innerHTML = state.vehicleTypes.map(type => `
    <div class="vehicle-type-option ${state.selectedVehicleType === type.id ? 'selected' : ''}" 
         data-type="${type.id}">
      <span class="vehicle-icon">${type.icon || '🚗'}</span>
      <span class="vehicle-name">${type.name}</span>
      <span class="vehicle-capacity">${type.capacity || ''}</span>
    </div>
  `).join('');
  
  // Add click handlers
  container.querySelectorAll('.vehicle-type-option').forEach(option => {
    option.addEventListener('click', () => {
      container.querySelectorAll('.vehicle-type-option').forEach(o => o.classList.remove('selected'));
      option.classList.add('selected');
      state.selectedVehicleType = option.dataset.type;
    });
  });
  
  // Select first by default
  if (state.vehicleTypes.length > 0 && !state.selectedVehicleType) {
    state.selectedVehicleType = state.vehicleTypes[0].id;
    container.querySelector('.vehicle-type-option')?.classList.add('selected');
  }
}

// ============================================
// Airports
// ============================================
async function loadAirports() {
  try {
    const creds = getSupabaseCredentials();
    const response = await fetch(
      `${creds.url}/rest/v1/airports?is_active=eq.true&select=*&order=name.asc`,
      {
        headers: {
          'apikey': creds.anonKey
        }
      }
    );
    
    if (response.ok) {
      state.airports = await response.json();
    }
  } catch (err) {
    console.error('[CustomerPortal] Failed to load airports:', err);
  }
  
  // Fallback defaults if no data
  if (state.airports.length === 0) {
    state.airports = [
      { code: 'MSP', name: 'Minneapolis-St. Paul International (MSP)', address: '4300 Glumack Dr, St Paul, MN 55111' },
      { code: 'STP', name: 'St. Paul Downtown Airport (STP)', address: '644 Bayfield St, St Paul, MN 55107' }
    ];
  }
  
  // Populate airport dropdowns
  ['pickupAirport', 'dropoffAirport'].forEach(id => {
    const select = document.getElementById(id);
    if (select) {
      select.innerHTML = '<option value="">Select Airport</option>' +
        state.airports.map(a => `<option value="${a.code}" data-address="${a.address || ''}">${a.name}</option>`).join('');
    }
  });
}

// ============================================
// Flight Verification
// ============================================
async function verifyFlight() {
  const flightNumber = document.getElementById('flightNumber').value.trim().toUpperCase();
  const arrivalTime = document.getElementById('flightArrivalTime').value;
  const pickupDate = document.getElementById('pickupDate').value;
  
  if (!flightNumber) {
    showToast('Please enter a flight number', 'warning');
    return;
  }
  
  const verifyBtn = document.getElementById('verifyFlightBtn');
  verifyBtn.disabled = true;
  verifyBtn.textContent = 'Verifying...';
  
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
        statusEl.className = 'verification-status error';
        statusEl.innerHTML = '<span class="status-icon">⚠️</span><span class="status-text">Flight Not Found</span>';
        infoEl.innerHTML = `<p>Could not verify flight. Please check the flight number.</p>`;
      }
    } else {
      throw new Error('Verification failed');
    }
  } catch (err) {
    console.error('[CustomerPortal] Flight verification error:', err);
    verificationDiv.classList.remove('hidden');
    verificationDiv.querySelector('.verification-status').className = 'verification-status';
    verificationDiv.querySelector('.verification-status').innerHTML = 
      '<span class="status-icon">⚠️</span><span class="status-text">Could not verify</span>';
    verificationDiv.querySelector('.flight-info').innerHTML = 
      '<p>Flight verification service unavailable. Please verify details manually.</p>';
  } finally {
    verifyBtn.disabled = false;
    verifyBtn.textContent = '✈️ Verify Flight';
  }
}

// ============================================
// Passenger Management
// ============================================
function populatePassengerDropdown() {
  const select = document.getElementById('passengerSelect');
  if (!select) return;
  
  // Self is always first
  select.innerHTML = '<option value="self">Myself (Billing Account)</option>';
  
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
  if (passengerId === 'new') {
    // Open new passenger modal
    openModal('passengerModal');
    return;
  }
  
  let passenger;
  
  if (passengerId === 'self') {
    passenger = state.customer;
  } else {
    passenger = state.savedPassengers.find(p => p.id == passengerId);
  }
  
  if (passenger) {
    document.getElementById('passengerFirstName').value = passenger.first_name || '';
    document.getElementById('passengerLastName').value = passenger.last_name || '';
    document.getElementById('passengerPhone').value = passenger.phone || '';
    document.getElementById('passengerEmail').value = passenger.email || '';
  }
}

async function addNewPassenger() {
  const firstName = document.getElementById('newPassengerFirstName').value.trim();
  const lastName = document.getElementById('newPassengerLastName').value.trim();
  const phone = document.getElementById('newPassengerPhone').value.trim();
  const email = document.getElementById('newPassengerEmail').value.trim();
  const relationship = document.getElementById('newPassengerRelationship')?.value || 'other';
  const saveForFuture = document.getElementById('savePassengerForFuture').checked;
  
  if (!firstName || !lastName) {
    showToast('Please enter first and last name', 'error');
    return;
  }
  
  if (saveForFuture) {
    try {
      const creds = getSupabaseCredentials();
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
        }
      }
    } catch (err) {
      console.error('[CustomerPortal] Failed to save passenger:', err);
    }
  }
  
  // Update form
  document.getElementById('passengerFirstName').value = firstName;
  document.getElementById('passengerLastName').value = lastName;
  document.getElementById('passengerPhone').value = phone;
  document.getElementById('passengerEmail').value = email;
  
  // Reset passenger select to avoid "new" being selected
  document.getElementById('passengerSelect').value = 'self';
  
  // Update dropdown
  populatePassengerDropdown();
  
  // Close modal
  closeModal('passengerModal');
  showToast('Passenger added', 'success');
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
  ['savedPickupAddresses', 'savedDropoffAddresses'].forEach(containerId => {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    // Use full_address field name from database
    container.innerHTML = state.savedAddresses.map(addr => {
      const address = addr.full_address || addr.address || '';
      const label = addr.label || 'Saved';
      const icon = label.toLowerCase() === 'home' ? '🏠' : 
                   label.toLowerCase() === 'work' ? '🏢' : 
                   addr.address_type === 'airport' ? '✈️' :
                   addr.is_favorite ? '⭐' : '📍';
      
      return `
        <div class="saved-address-item" data-id="${addr.id}" data-address="${address}">
          <span class="address-icon">${icon}</span>
          <div class="address-content">
            <div class="address-label">${label}</div>
            <div class="address-text">${address}</div>
          </div>
          <button type="button" class="address-delete" data-id="${addr.id}" title="Remove">🗑️</button>
        </div>
      `;
    }).join('');
    
    // Add click handlers
    container.querySelectorAll('.saved-address-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.classList.contains('address-delete')) return;
        
        const addressType = containerId.includes('Pickup') ? 'pickup' : 'dropoff';
        selectSavedAddress(item.dataset.id, item.dataset.address, addressType);
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
  } else {
    state.selectedDropoffAddress = address;
    document.getElementById('dropoffAddressInput').value = address;
  }
  
  // Highlight selected
  document.querySelectorAll(`#saved${type.charAt(0).toUpperCase() + type.slice(1)}Addresses .saved-address-item`).forEach(item => {
    item.classList.toggle('selected', item.dataset.id === id);
  });
  
  // Increment usage count
  incrementAddressUsage(id);
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
    showToast('Address removed', 'success');
  } catch (err) {
    console.error('[CustomerPortal] Failed to delete address:', err);
    showToast('Failed to remove address', 'error');
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
    const response = await fetch(`${creds.url}/rest/v1/customer_addresses`, {
      method: 'POST',
      headers: {
        'apikey': creds.anonKey,
        'Authorization': `Bearer ${state.session?.access_token}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        customer_id: state.customer?.id,
        label,
        address,
        is_deleted: false,
        usage_count: 0
      })
    });
    
    if (response.ok) {
      const newAddresses = await response.json();
      if (newAddresses?.length > 0) {
        state.savedAddresses.push(newAddresses[0]);
      }
      populateAddressDropdowns();
      closeModal('addressModal');
      showToast('Address saved', 'success');
    }
  } catch (err) {
    console.error('[CustomerPortal] Failed to save address:', err);
    showToast('Failed to save address', 'error');
  }
}

// ============================================
// Stops Management
// ============================================
function addStop() {
  const stopIndex = state.stops.length + 1;
  state.stops.push({ address: '', order: stopIndex });
  renderStops();
}

function removeStop(index) {
  state.stops.splice(index, 1);
  // Re-order
  state.stops.forEach((s, i) => s.order = i + 1);
  renderStops();
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
    reservationData.confirmation_number = confirmationNumber;
    
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
    
    // Create reservation
    const creds = getSupabaseCredentials();
    const response = await fetch(`${creds.url}/rest/v1/reservations`, {
      method: 'POST',
      headers: {
        'apikey': creds.anonKey,
        'Authorization': `Bearer ${state.session?.access_token}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(reservationData)
    });
    
    if (response.ok) {
      const newReservation = await response.json();
      
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
      const error = await response.json();
      throw new Error(error.message || 'Failed to book trip');
    }
  } catch (err) {
    console.error('[CustomerPortal] Booking error:', err);
    showToast(err.message || 'Failed to book trip', 'error');
  } finally {
    bookBtn.disabled = false;
    bookBtn.textContent = includeReturn ? '🔄 Book One Way and Enter Return Trip' : '🚗 Book One Way Trip';
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
    const flightNumber = document.getElementById('flightNumber').value.trim();
    if (!airport) return { valid: false, message: 'Please select airport' };
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
  
  // Apply booking defaults from admin settings
  const assignmentType = bookingDefaults.defaultAssignmentType || 'unassigned';
  const affiliate = bookingDefaults.defaultAffiliate || 'in-house';
  const vehicleType = state.selectedVehicleType || bookingDefaults.defaultVehicleType || 'Black SUV';
  const serviceType = bookingDefaults.defaultServiceType || 'Point to Point';
  
  return {
    // Account & Passenger
    account_id: state.customer?.id,
    billing_name: `${state.customer?.first_name || ''} ${state.customer?.last_name || ''}`.trim(),
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
    
    // Vehicle & Service (from admin defaults)
    vehicle_type: vehicleType,
    service_type: serviceType,
    
    // Assignment defaults from admin settings
    driver_id: null,                    // Unassigned
    assignment_type: assignmentType,    // 'unassigned', 'in-house', 'farm-out'
    affiliate: affiliate,               // 'in-house' or affiliate name
    
    // Status
    status: bookingDefaults.autoConfirm ? 'confirmed' : 'pending',
    
    // Source & tracking
    source: 'customer_portal',
    
    // Flight info
    flight_number: document.getElementById('flightNumber')?.value?.trim() || 
                   document.getElementById('dropoffFlightNumber')?.value?.trim() || null,
    is_airport_pickup: pickupType === 'airport',
    is_airport_dropoff: dropoffType === 'airport',
    
    // Timestamps
    created_at: new Date().toISOString()
  };
}

// Get next confirmation number from sequence
async function getNextConfirmationNumber() {
  try {
    const creds = getSupabaseCredentials();
    const response = await fetch(
      `${creds.url}/rest/v1/rpc/get_next_confirmation_number`,
      {
        method: 'POST',
        headers: {
          'apikey': creds.anonKey,
          'Authorization': `Bearer ${state.session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ p_sequence_name: 'reservations' })
      }
    );
    
    if (response.ok) {
      const result = await response.json();
      return result;
    }
    
    // Fallback: generate timestamp-based number
    return Date.now().toString().slice(-8);
  } catch (err) {
    console.error('[CustomerPortal] Failed to get confirmation number:', err);
    return Date.now().toString().slice(-8);
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
  // Save new addresses that were entered
  const pickupType = document.getElementById('pickupAddressSelect').value;
  const dropoffType = document.getElementById('dropoffAddressSelect').value;
  
  if (pickupType === 'new') {
    const address = document.getElementById('pickupAddressInput').value.trim();
    if (address) {
      await saveAddress(address, 'Recent', 'pickup');
    }
  }
  
  if (dropoffType === 'new') {
    const address = document.getElementById('dropoffAddressInput').value.trim();
    if (address) {
      await saveAddress(address, 'Recent', 'dropoff');
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
    
    const pickupTime = new Date(reservation.pickup_date_time);
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
      `${creds.url}/rest/v1/reservations?account_id=eq.${state.customer?.id}&select=*&order=pickup_date_time.desc`,
      {
        headers: {
          'apikey': creds.anonKey,
          'Authorization': `Bearer ${state.session?.access_token}`
        }
      }
    );
    
    if (response.ok) {
      state.trips = await response.json();
      renderTrips('upcoming');
    }
  } catch (err) {
    console.error('[CustomerPortal] Failed to load trips:', err);
  }
}

function renderTrips(filter = 'upcoming') {
  const container = document.getElementById('tripsList');
  if (!container) return;
  
  const now = new Date();
  let filteredTrips = state.trips;
  
  if (filter === 'upcoming') {
    filteredTrips = state.trips.filter(t => new Date(t.pickup_date_time) >= now && t.status !== 'cancelled' && t.status !== 'completed');
  } else if (filter === 'past') {
    filteredTrips = state.trips.filter(t => new Date(t.pickup_date_time) < now || t.status === 'completed');
  }
  
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
    const pickupDate = new Date(trip.pickup_date_time);
    const dateStr = pickupDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const timeStr = pickupDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    
    return `
      <div class="trip-card" data-id="${trip.id}">
        <div class="trip-header">
          <div>
            <div class="trip-date">${dateStr}</div>
            <div class="trip-time">${timeStr}</div>
          </div>
          <span class="trip-status ${trip.status}">${formatStatus(trip.status)}</span>
        </div>
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
        ${canTrack(trip) ? `
          <div class="trip-actions">
            <button class="btn btn-sm btn-primary track-trip-btn" data-id="${trip.id}">📍 Track Driver</button>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
  
  // Add track handlers
  container.querySelectorAll('.track-trip-btn').forEach(btn => {
    btn.addEventListener('click', () => trackTrip(btn.dataset.id));
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

function truncateAddress(address, maxLength = 40) {
  if (!address) return 'N/A';
  return address.length > maxLength ? address.substring(0, maxLength) + '...' : address;
}

// ============================================
// Trip Tracking
// ============================================
function checkForActiveTrip() {
  const now = new Date();
  const activeTrip = state.trips.find(t => {
    const pickupDate = new Date(t.pickup_date_time);
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
    style: 'mapbox://styles/mapbox/dark-v11',
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
          el.innerHTML = '🚗';
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
      style: 'mapbox://styles/mapbox/dark-v11',
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
  
  renderSavedPassengers();
  renderSavedAddresses();
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
  
  container.innerHTML = state.savedAddresses.map(a => `
    <div class="saved-item">
      <span class="saved-item-icon">${a.label === 'Home' ? '🏠' : a.label === 'Work' ? '🏢' : '📍'}</span>
      <div class="saved-item-content">
        <div class="saved-item-name">${a.label}</div>
        <div class="saved-item-detail">${a.address}</div>
      </div>
      <button class="saved-item-delete" data-id="${a.id}">🗑️</button>
    </div>
  `).join('');
  
  // Delete handlers
  container.querySelectorAll('.saved-item-delete').forEach(btn => {
    btn.addEventListener('click', () => deleteSavedAddress(btn.dataset.id));
  });
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
  
  // Header buttons
  document.getElementById('preferencesBtn')?.addEventListener('click', () => {
    document.getElementById('preferencesModal').classList.remove('hidden');
  });
  
  document.getElementById('logoutBtn')?.addEventListener('click', logout);
  
  // Passenger selection
  document.getElementById('passengerSelect')?.addEventListener('change', (e) => {
    fillPassengerDetails(e.target.value);
  });
  
  // Passenger count
  document.getElementById('countMinus')?.addEventListener('click', () => {
    const input = document.getElementById('passengerCount');
    const val = parseInt(input.value) || 1;
    if (val > 1) input.value = val - 1;
  });
  
  document.getElementById('countPlus')?.addEventListener('click', () => {
    const input = document.getElementById('passengerCount');
    const val = parseInt(input.value) || 1;
    if (val < 50) input.value = val + 1;
  });
  
  // Address selectors
  document.getElementById('pickupAddressSelect')?.addEventListener('change', (e) => {
    const val = e.target.value;
    document.getElementById('pickupAddressNew').classList.toggle('hidden', val !== 'new');
    document.getElementById('airportPickupDetails').classList.toggle('hidden', val !== 'airport');
    document.getElementById('savedPickupAddresses').classList.toggle('hidden', !val || val === 'airport' || val === 'new');
    
    if (!val || val === 'airport' || val === 'new') {
      state.selectedPickupAddress = null;
    }
  });
  
  document.getElementById('dropoffAddressSelect')?.addEventListener('change', (e) => {
    const val = e.target.value;
    document.getElementById('dropoffAddressNew').classList.toggle('hidden', val !== 'new');
    document.getElementById('airportDropoffDetails').classList.toggle('hidden', val !== 'airport');
    document.getElementById('savedDropoffAddresses').classList.toggle('hidden', !val || val === 'airport' || val === 'new');
    
    if (!val || val === 'airport' || val === 'new') {
      state.selectedDropoffAddress = null;
    }
  });
  
  // Map buttons
  document.getElementById('pickupMapBtn')?.addEventListener('click', () => openMapSelection('pickup'));
  document.getElementById('dropoffMapBtn')?.addEventListener('click', () => openMapSelection('dropoff'));
  
  // Flight verification
  document.getElementById('verifyFlightBtn')?.addEventListener('click', verifyFlight);
  
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
// Initialize
// ============================================
document.addEventListener('DOMContentLoaded', init);
