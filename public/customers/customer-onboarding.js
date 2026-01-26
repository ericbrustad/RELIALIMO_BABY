// ============================================
// Customer Onboarding JavaScript
// Complete account setup flow after email verification
// ============================================

import { getSupabaseCredentials } from '/shared/supabase-config.js';
import CustomerAuth from './customer-auth-service.js';

// ============================================
// State Management
// ============================================
const state = {
  customer: null,
  session: null,
  currentStep: 1,
  verified: false,
  
  // Onboarding data
  homeAddress: null,
  homeCoordinates: null,
  selectedAirports: [], // Changed to array for multi-select
  selectedFBOs: [], // New: selected FBOs
  cellPhone: null,
  cellPhoneFormatted: null,
  paymentMethod: null,
  skipPayment: false,
  
  // UI state
  iti: null, // intl-tel-input instance
  map: null,
  addressAutocomplete: null,
  nearbyAirports: [],
  nearbyFBOs: [], // New: nearby FBOs from API
  
  // OTP verification state
  otpCode: null,
  otpExpiry: null,
  otpAttempts: 0,
  otpResendTimer: null,
  phoneVerified: false
};

// Mock drivers for demonstration with real vehicle images
const MOCK_DRIVERS = [
  { 
    id: 1, 
    name: 'Michael R.', 
    rating: 4.9, 
    trips: 1247, 
    vehicle: 'Black Escalade', 
    vehicleImage: '/assets/vehicles/escalade.svg',
    photo: '/assets/drivers/driver-m1.svg', 
    initials: 'MR',
    distance: 2.3 
  },
  { 
    id: 2, 
    name: 'Sarah K.', 
    rating: 4.8, 
    trips: 892, 
    vehicle: 'Lincoln Navigator', 
    vehicleImage: '/assets/vehicles/navigator.svg',
    photo: '/assets/drivers/driver-f1.svg', 
    initials: 'SK',
    distance: 3.1 
  },
  { 
    id: 3, 
    name: 'James T.', 
    rating: 4.9, 
    trips: 2103, 
    vehicle: 'Mercedes S-Class', 
    vehicleImage: '/assets/vehicles/mercedes-s.svg',
    photo: '/assets/drivers/driver-m2.svg', 
    initials: 'JT',
    distance: 4.7 
  },
  { 
    id: 4, 
    name: 'Emily W.', 
    rating: 5.0, 
    trips: 567, 
    vehicle: 'Cadillac CT6', 
    vehicleImage: '/assets/vehicles/cadillac-ct6.svg',
    photo: '/assets/drivers/driver-f2.svg', 
    initials: 'EW',
    distance: 5.2 
  },
  { 
    id: 5, 
    name: 'David L.', 
    rating: 4.7, 
    trips: 1456, 
    vehicle: 'Sprinter Van', 
    vehicleImage: '/assets/vehicles/sprinter.svg',
    photo: '/assets/drivers/driver-m3.svg', 
    initials: 'DL',
    distance: 6.8 
  }
];

// ============================================
// Location & Notification Permission Management
// ============================================
async function checkAndRequestLocationPermission() {
  console.log('[CustomerOnboarding] Checking location permission...');
  if (!('geolocation' in navigator)) return { supported: false, granted: false };
  
  if ('permissions' in navigator) {
    try {
      const status = await navigator.permissions.query({ name: 'geolocation' });
      if (status.state === 'granted') return { supported: true, granted: true };
      if (status.state === 'denied') { showPermissionWarning('location'); return { supported: true, granted: false, denied: true }; }
    } catch (err) { /* continue */ }
  }
  
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      () => resolve({ supported: true, granted: true }),
      (error) => {
        if (error.code === error.PERMISSION_DENIED) showPermissionWarning('location');
        resolve({ supported: true, granted: false, denied: error.code === error.PERMISSION_DENIED });
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  });
}

async function checkAndRequestNotificationPermission() {
  console.log('[CustomerOnboarding] Checking notification permission...');
  if (!('Notification' in window)) return { supported: false, granted: false };
  if (Notification.permission === 'granted') return { supported: true, granted: true };
  if (Notification.permission === 'denied') { showPermissionWarning('notification'); return { supported: true, granted: false, denied: true }; }
  
  try {
    const perm = await Notification.requestPermission();
    if (perm === 'denied') showPermissionWarning('notification');
    return { supported: true, granted: perm === 'granted', denied: perm === 'denied' };
  } catch (err) { return { supported: true, granted: false, error: err.message }; }
}

function showPermissionWarning(type) {
  const bannerId = `${type}-permission-banner`;
  if (document.getElementById(bannerId)) return;
  
  const banner = document.createElement('div');
  banner.id = bannerId;
  banner.style.cssText = `position:fixed;top:${type === 'notification' && document.getElementById('location-permission-banner') ? '45px' : '0'};left:0;right:0;background:${type === 'location' ? '#ff6b35' : '#f59e0b'};color:white;padding:10px 15px;z-index:${type === 'location' ? 10000 : 9999};font-size:14px;text-align:center;box-shadow:0 2px 10px rgba(0,0,0,0.2);`;
  banner.innerHTML = `${type === 'location' ? '📍 Location services disabled. Enable for accurate pickup.' : '🔔 Notifications disabled. Enable for trip updates.'} <button onclick="this.parentElement.remove()" style="margin-left:10px;background:none;border:none;color:white;font-size:16px;cursor:pointer;">✕</button>`;
  document.body.prepend(banner);
}

async function ensureRequiredPermissions() {
  console.log('[CustomerOnboarding] Checking required permissions...');
  await Promise.all([checkAndRequestLocationPermission(), checkAndRequestNotificationPermission()]);
}

// ============================================
// Initialization
// ============================================
async function init() {
  console.log('[CustomerOnboarding] Initializing...');
  
  // Check and request required permissions first
  await ensureRequiredPermissions();
  
  // Check for verification token in URL
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');
  const email = urlParams.get('email');
  const redirect = urlParams.get('redirect');
  
  if (token && email) {
    // Show verification screen
    showScreen('verifyScreen');
    await handleEmailVerification(token, email, redirect);
  } else {
    // Check if user is already authenticated
    const isAuth = await checkAuth();
    console.log('[CustomerOnboarding] Auth check result:', isAuth, 'Customer:', state.customer);
    
    if (isAuth) {
      // Check if onboarding is complete (treat null/undefined as complete for existing users)
      if (state.customer?.onboarding_complete !== false) {
        console.log('[CustomerOnboarding] Onboarding already complete, redirecting to portal');
        redirectToPortal();
      } else {
        console.log('[CustomerOnboarding] Showing onboarding screen');
        // Show onboarding
        showScreen('onboardingScreen');
        await setupOnboarding();
      }
    } else {
      // No auth - but allow onboarding if we have customer info from registration
      const pendingCustomer = localStorage.getItem('current_customer');
      console.log('[CustomerOnboarding] No auth, checking pending customer:', pendingCustomer);
      
      if (pendingCustomer) {
        try {
          state.customer = JSON.parse(pendingCustomer);
          console.log('[CustomerOnboarding] Found pending customer, showing onboarding');
          showScreen('onboardingScreen');
          await setupOnboarding();
          return;
        } catch (e) {
          console.error('[CustomerOnboarding] Error parsing pending customer:', e);
        }
      }
      
      // Redirect to auth
      console.log('[CustomerOnboarding] No customer found, redirecting to auth');
      window.location.href = 'auth.html';
    }
  }
}

// ============================================
// Screen Management
// ============================================
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const screen = document.getElementById(screenId);
  if (screen) screen.classList.add('active');
}

// ============================================
// Email Verification
// ============================================
async function handleEmailVerification(token, email, redirect) {
  console.log('[CustomerOnboarding] Verifying email:', email);
  
  const verifyMessage = document.getElementById('verifyMessage');
  const verifySpinner = document.getElementById('verifySpinner');
  const verifyError = document.getElementById('verifyError');
  const verifySuccess = document.getElementById('verifySuccess');
  
  try {
    const creds = getSupabaseCredentials();
    
    // Verify the token
    const response = await fetch(
      `${creds.url}/rest/v1/customer_email_verifications?token=eq.${token}&email=eq.${encodeURIComponent(email.toLowerCase())}&select=*`,
      {
        headers: {
          'apikey': creds.anonKey
        }
      }
    );

    let verificationData = null;
    
    if (response.ok) {
      const records = await response.json();
      if (records.length > 0) {
        verificationData = records[0];
        
        // Check expiry
        if (new Date(verificationData.expires_at) < new Date()) {
          throw new Error('This verification link has expired. Please request a new one.');
        }
        
        // Mark as verified
        if (!verificationData.verified) {
          await fetch(`${creds.url}/rest/v1/customer_email_verifications?id=eq.${verificationData.id}`, {
            method: 'PATCH',
            headers: {
              'apikey': creds.anonKey,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
              verified: true, 
              verified_at: new Date().toISOString() 
            })
          });
        }
        
        // Update the accounts table to mark email as verified
        await fetch(`${creds.url}/rest/v1/accounts?email=eq.${encodeURIComponent(email.toLowerCase())}`, {
          method: 'PATCH',
          headers: {
            'apikey': creds.anonKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            email_verified: true,
            email_verified_at: new Date().toISOString()
          })
        });
      }
    }
    
    // Fallback to localStorage verification
    if (!verificationData) {
      const stored = JSON.parse(localStorage.getItem('pending_verifications') || '{}');
      if (stored[token]) {
        verificationData = stored[token];
        if (verificationData.email.toLowerCase() !== email.toLowerCase()) {
          throw new Error('Invalid verification link.');
        }
        if (new Date(verificationData.expiresAt) < new Date()) {
          throw new Error('This verification link has expired. Please request a new one.');
        }
        stored[token].verified = true;
        localStorage.setItem('pending_verifications', JSON.stringify(stored));
      }
    }
    
    if (!verificationData) {
      throw new Error('Invalid verification token. Please request a new verification email.');
    }
    
    // Success!
    state.verified = true;
    state.customer = {
      email: email.toLowerCase(),
      first_name: verificationData.user_data?.firstName || redirect?.split('_')[0] || '',
      last_name: verificationData.user_data?.lastName || redirect?.split('_')[1] || '',
      portal_slug: verificationData.user_data?.portalSlug || redirect || ''
    };
    
    // Store in localStorage for prefilling
    localStorage.setItem('current_customer', JSON.stringify(state.customer));
    
    // Store email for prefilling login form
    localStorage.setItem('verified_email', email.toLowerCase());
    
    // Show success
    verifySpinner.classList.add('hidden');
    verifySuccess.classList.remove('hidden');
    document.querySelector('#verifySuccess p').textContent = 'Redirecting you to login...';
    
    // Redirect to login page with verified flag (they need to log in to get a session)
    setTimeout(() => {
      window.location.href = '/auth?verified=true';
    }, 2000);
    
  } catch (err) {
    console.error('[CustomerOnboarding] Verification error:', err);
    verifySpinner.classList.add('hidden');
    verifyError.classList.remove('hidden');
    document.getElementById('verifyErrorMessage').textContent = err.message;
  }
}

// ============================================
// Authentication Check
// ============================================
async function checkAuth() {
  try {
    // Use CustomerAuth service for consistent auth checking
    const isAuth = await CustomerAuth.initAuth();
    
    if (isAuth) {
      state.customer = CustomerAuth.getCustomer();
      state.session = CustomerAuth.getSession();
      console.log('[CustomerOnboarding] Authenticated via CustomerAuth:', state.customer?.email);
      return true;
    }
    
    // Fallback: Also check if we have customer info from verification
    const customerInfo = localStorage.getItem('current_customer');
    if (customerInfo) {
      state.customer = JSON.parse(customerInfo);
      console.log('[CustomerOnboarding] Customer loaded from localStorage:', state.customer?.email);
      return !!state.customer;
    }
    
    // Also try the customer_session
    const sessionInfo = localStorage.getItem('customer_session');
    if (sessionInfo) {
      const session = JSON.parse(sessionInfo);
      if (session.customer) {
        state.customer = session.customer;
        state.session = session;
        console.log('[CustomerOnboarding] Customer loaded from session:', state.customer?.email);
        return true;
      }
    }
    
    return false;
  } catch (err) {
    console.error('[CustomerOnboarding] Auth check error:', err);
    return false;
  }
}

// ============================================
// Onboarding Setup
// ============================================
async function setupOnboarding() {
  console.log('[CustomerOnboarding] Setting up onboarding...');
  
  // Hide loading, show onboarding
  document.getElementById('loadingScreen').classList.remove('active');
  
  // Ensure we have full customer data from database
  if (state.customer?.email) {
    await loadFullCustomerData(state.customer.email);
  }
  
  // Populate account owner info
  updateOwnerInfo();
  
  // Setup step navigation
  setupStepNavigation();
  
  // Setup address autocomplete
  setupAddressAutocomplete();
  
  // Setup phone input
  setupPhoneInput();
  
  // Setup payment form
  setupPaymentForm();
  
  // Show first step
  showStep(1);
}

// ============================================
// Load Full Customer Data from Database
// ============================================
async function loadFullCustomerData(email) {
  try {
    const creds = getSupabaseCredentials();
    console.log('[CustomerOnboarding] Loading full customer data for:', email);
    
    const response = await fetch(
      `${creds.url}/rest/v1/accounts?email=eq.${encodeURIComponent(email.toLowerCase())}&select=*`,
      {
        headers: {
          'apikey': creds.anonKey,
          'Authorization': state.session?.access_token ? `Bearer ${state.session.access_token}` : `Bearer ${creds.anonKey}`
        }
      }
    );
    
    if (response.ok) {
      const customers = await response.json();
      if (customers?.length > 0) {
        // Merge with existing state to preserve any locally set values
        state.customer = { ...state.customer, ...customers[0] };
        localStorage.setItem('current_customer', JSON.stringify(state.customer));
        console.log('[CustomerOnboarding] Full customer data loaded:', state.customer);
      }
    }
  } catch (err) {
    console.error('[CustomerOnboarding] Error loading customer data:', err);
  }
}

// ============================================
// Owner Info Display
// ============================================
function updateOwnerInfo() {
  const firstName = state.customer?.first_name || 'Guest';
  const lastName = state.customer?.last_name || '';
  const email = state.customer?.email || '';
  const phone = state.customer?.phone || state.customer?.cell_phone || '';
  
  // Avatar initials
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  document.getElementById('ownerInitials').textContent = initials;
  document.getElementById('ownerName').textContent = `${firstName} ${lastName}`;
  document.getElementById('ownerEmail').textContent = email;
  document.getElementById('ownerPhone').textContent = phone || '';
}

// ============================================
// Step Navigation
// ============================================
function setupStepNavigation() {
  // Step 1 -> Step 2
  document.getElementById('step1NextBtn').addEventListener('click', () => {
    if (state.homeAddress) {
      showStep(2);
    }
  });
  
  // Step 2 back
  document.getElementById('step2BackBtn').addEventListener('click', () => {
    showStep(1);
  });
  
  // Step 2 -> OTP verification -> Step 3
  document.getElementById('step2NextBtn').addEventListener('click', async () => {
    if (state.phoneVerified) {
      // Already verified, go to next step
      showStep(3);
    } else if (state.cellPhone) {
      // Send OTP
      await sendOtpToPhone();
    }
  });
  
  // Setup OTP inputs
  setupOtpInputs();
  
  // Resend OTP button
  document.getElementById('resendOtpBtn')?.addEventListener('click', async () => {
    if (!state.otpResendTimer) {
      await sendOtpToPhone();
    }
  });
  
  // Step 3 back
  document.getElementById('step3BackBtn').addEventListener('click', () => {
    showStep(2);
  });
  
  // Payment options
  document.getElementById('addCardYesBtn').addEventListener('click', () => {
    document.getElementById('creditCardForm').classList.remove('hidden');
    document.getElementById('addCardYesBtn').classList.add('selected');
    document.getElementById('addCardNoBtn').classList.remove('selected');
    state.skipPayment = false;
    updateCompleteButton();
  });
  
  document.getElementById('addCardNoBtn').addEventListener('click', () => {
    document.getElementById('creditCardForm').classList.add('hidden');
    document.getElementById('addCardNoBtn').classList.add('selected');
    document.getElementById('addCardYesBtn').classList.remove('selected');
    state.skipPayment = true;
    updateCompleteButton();
  });
  
  // Complete setup
  document.getElementById('completeSetupBtn').addEventListener('click', completeOnboarding);
  
  // Go to portal
  document.getElementById('goToPortalBtn').addEventListener('click', redirectToPortal);
}

function showStep(stepNum) {
  state.currentStep = stepNum;
  
  // Hide all steps
  document.querySelectorAll('.onboarding-step').forEach(s => s.classList.remove('active'));
  
  // Show current step
  const stepEl = document.getElementById(`step${stepNum}`);
  if (stepEl) stepEl.classList.add('active');
  
  // Update progress indicators
  document.querySelectorAll('.progress-step').forEach(p => {
    const step = parseInt(p.dataset.step);
    p.classList.remove('active', 'completed');
    if (step < stepNum) {
      p.classList.add('completed');
    } else if (step === stepNum) {
      p.classList.add('active');
    }
  });
  
  // Scroll to top
  window.scrollTo(0, 0);
}

// ============================================
// Address Autocomplete (Google Places)
// ============================================
function setupAddressAutocomplete() {
  const input = document.getElementById('homeAddressInput');
  const suggestionsContainer = document.getElementById('addressSuggestions');
  
  // Wait for Google Maps to be ready
  function initAutocomplete() {
    if (!window.google?.maps?.places) {
      setTimeout(initAutocomplete, 100);
      return;
    }
    
    const autocomplete = new google.maps.places.Autocomplete(input, {
      types: ['address'],
      componentRestrictions: { country: 'us' }
    });
    
    state.addressAutocomplete = autocomplete;
    
    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      
      if (!place.geometry) {
        console.warn('No geometry for selected place');
        return;
      }
      
      // Parse address components
      const addressData = parseAddressComponents(place);
      state.homeAddress = place.formatted_address;
      state.homeCoordinates = {
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng()
      };
      
      // Fill parsed fields
      document.getElementById('homeStreet').value = addressData.street || '';
      document.getElementById('homeCity').value = addressData.city || '';
      document.getElementById('homeState').value = addressData.state || '';
      document.getElementById('homeZip').value = addressData.zip || '';
      document.getElementById('parsedAddressFields').classList.remove('hidden');
      
      // Enable next button
      document.getElementById('step1NextBtn').disabled = false;
      
      // Find nearby airports
      findNearbyAirports(state.homeCoordinates);
    });
  }
  
  if (window.googleMapsReady) {
    initAutocomplete();
  } else {
    window.onGoogleMapsReady = initAutocomplete;
  }
  
  // Manual input change handler
  input.addEventListener('input', () => {
    if (!input.value.trim()) {
      document.getElementById('step1NextBtn').disabled = true;
      document.getElementById('parsedAddressFields').classList.add('hidden');
      document.getElementById('airportSuggestionSection').classList.add('hidden');
    }
  });
  
  // Setup "Use Current Location" button
  setupCurrentLocationButton();
}

// ============================================
// Use Current Location Feature
// ============================================
function setupCurrentLocationButton() {
  const btn = document.getElementById('useCurrentLocationBtn');
  const spinner = document.getElementById('locationLoadingSpinner');
  const errorEl = document.getElementById('locationError');
  
  if (!btn) return;
  
  btn.addEventListener('click', async () => {
    // Check if geolocation is supported
    if (!navigator.geolocation) {
      showLocationError('Geolocation is not supported by your browser');
      return;
    }
    
    // Show loading state
    btn.disabled = true;
    spinner.style.display = 'inline-block';
    errorEl.style.display = 'none';
    
    try {
      // Get current position
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      });
      
      const { latitude, longitude } = position.coords;
      console.log('[CustomerOnboarding] Got location:', latitude, longitude);
      
      // Reverse geocode to get address
      await reverseGeocodeLocation(latitude, longitude);
      
    } catch (error) {
      console.error('[CustomerOnboarding] Geolocation error:', error);
      let message = 'Unable to get your location. ';
      
      switch (error.code) {
        case error.PERMISSION_DENIED:
          message += 'Please allow location access in your browser settings.';
          break;
        case error.POSITION_UNAVAILABLE:
          message += 'Location information is unavailable.';
          break;
        case error.TIMEOUT:
          message += 'Location request timed out. Please try again.';
          break;
        default:
          message += 'Please enter your address manually.';
      }
      
      showLocationError(message);
    } finally {
      btn.disabled = false;
      spinner.style.display = 'none';
    }
  });
  
  function showLocationError(message) {
    errorEl.textContent = message;
    errorEl.style.display = 'block';
  }
}

async function reverseGeocodeLocation(lat, lng) {
  // Wait for Google Maps if not ready
  if (!window.google?.maps) {
    showToast('Map service not ready. Please try again.', 'warning');
    return;
  }
  
  const geocoder = new google.maps.Geocoder();
  const latlng = { lat, lng };
  
  try {
    const response = await new Promise((resolve, reject) => {
      geocoder.geocode({ location: latlng }, (results, status) => {
        if (status === 'OK' && results[0]) {
          resolve(results[0]);
        } else {
          reject(new Error('Geocoding failed: ' + status));
        }
      });
    });
    
    // Update the address input
    const input = document.getElementById('homeAddressInput');
    input.value = response.formatted_address;
    
    // Parse address components
    const addressData = parseAddressComponents(response);
    state.homeAddress = response.formatted_address;
    state.homeCoordinates = { lat, lng };
    
    // Fill parsed fields
    document.getElementById('homeStreet').value = addressData.street || '';
    document.getElementById('homeCity').value = addressData.city || '';
    document.getElementById('homeState').value = addressData.state || '';
    document.getElementById('homeZip').value = addressData.zip || '';
    document.getElementById('parsedAddressFields').classList.remove('hidden');
    
    // Enable next button
    document.getElementById('step1NextBtn').disabled = false;
    
    // Find nearby airports
    findNearbyAirports(state.homeCoordinates);
    
    showToast('Location found! Please verify your address.', 'success');
    
  } catch (error) {
    console.error('[CustomerOnboarding] Reverse geocoding error:', error);
    showToast('Could not determine your address. Please enter it manually.', 'warning');
  }
}

function parseAddressComponents(place) {
  const data = {
    street: '',
    city: '',
    state: '',
    zip: '',
    country: ''
  };
  
  if (!place.address_components) return data;
  
  let streetNumber = '';
  let streetName = '';
  
  for (const component of place.address_components) {
    const types = component.types;
    
    if (types.includes('street_number')) {
      streetNumber = component.long_name;
    } else if (types.includes('route')) {
      streetName = component.long_name;
    } else if (types.includes('locality')) {
      data.city = component.long_name;
    } else if (types.includes('administrative_area_level_1')) {
      data.state = component.short_name;
    } else if (types.includes('postal_code')) {
      data.zip = component.long_name;
    } else if (types.includes('country')) {
      data.country = component.short_name;
    }
  }
  
  data.street = `${streetNumber} ${streetName}`.trim();
  return data;
}

// ============================================
// Nearby Airport & FBO Finder (API-based)
// ============================================
async function findNearbyAirports(coordinates) {
  console.log('[CustomerOnboarding] Finding nearby airports for:', coordinates);
  
  const section = document.getElementById('airportSuggestionSection');
  const loadingEl = document.getElementById('airportSearchLoading');
  const listEl = document.getElementById('nearbyAirportsList');
  
  // Show section with loading
  section.classList.remove('hidden');
  loadingEl.classList.remove('hidden');
  listEl.innerHTML = '';
  
  try {
    // Call the airport search API
    const response = await fetch(`/api/search-nearby-airports?lat=${coordinates.lat}&lng=${coordinates.lng}&radius=100&includeFBOs=true`);
    
    if (!response.ok) {
      throw new Error('Failed to search airports');
    }
    
    const data = await response.json();
    
    state.nearbyAirports = data.airports || [];
    state.nearbyFBOs = data.fbos || [];
    
    console.log('[CustomerOnboarding] Found airports:', state.nearbyAirports.length, 'FBOs:', state.nearbyFBOs.length);
    
    // Display airports and FBOs
    displayNearbyAirports();
    displayNearbyFBOs();
    
  } catch (error) {
    console.error('[CustomerOnboarding] Airport search error:', error);
    
    // Fallback to local calculation
    state.nearbyAirports = findNearbyAirportsFallback(coordinates);
    state.nearbyFBOs = [];
    displayNearbyAirports();
    
  } finally {
    loadingEl.classList.add('hidden');
  }
}

// Fallback: Major US airports for when API is not available
const MAJOR_AIRPORTS = [
  { code: 'MSP', name: 'Minneapolis-St. Paul International Airport', city: 'Minneapolis', state: 'MN', latitude: 44.8848, longitude: -93.2223 },
  { code: 'ORD', name: "O'Hare International Airport", city: 'Chicago', state: 'IL', latitude: 41.9742, longitude: -87.9073 },
  { code: 'LAX', name: 'Los Angeles International Airport', city: 'Los Angeles', state: 'CA', latitude: 33.9416, longitude: -118.4085 },
  { code: 'JFK', name: 'John F. Kennedy International Airport', city: 'New York', state: 'NY', latitude: 40.6413, longitude: -73.7781 },
  { code: 'SFO', name: 'San Francisco International Airport', city: 'San Francisco', state: 'CA', latitude: 37.6213, longitude: -122.3790 },
  { code: 'DFW', name: 'Dallas/Fort Worth International Airport', city: 'Dallas', state: 'TX', latitude: 32.8998, longitude: -97.0403 },
  { code: 'DEN', name: 'Denver International Airport', city: 'Denver', state: 'CO', latitude: 39.8561, longitude: -104.6737 },
  { code: 'SEA', name: 'Seattle-Tacoma International Airport', city: 'Seattle', state: 'WA', latitude: 47.4502, longitude: -122.3088 },
  { code: 'ATL', name: 'Hartsfield-Jackson Atlanta International Airport', city: 'Atlanta', state: 'GA', latitude: 33.6407, longitude: -84.4277 },
  { code: 'MIA', name: 'Miami International Airport', city: 'Miami', state: 'FL', latitude: 25.7959, longitude: -80.2870 },
  { code: 'BOS', name: 'Boston Logan International Airport', city: 'Boston', state: 'MA', latitude: 42.3656, longitude: -71.0096 },
  { code: 'DTW', name: 'Detroit Metropolitan Airport', city: 'Detroit', state: 'MI', latitude: 42.2162, longitude: -83.3554 },
  { code: 'MKE', name: 'General Mitchell International Airport', city: 'Milwaukee', state: 'WI', latitude: 42.9472, longitude: -87.8966 },
  { code: 'FCM', name: 'Flying Cloud Airport', city: 'Eden Prairie', state: 'MN', latitude: 44.8272, longitude: -93.4572 },
  { code: 'STP', name: 'St. Paul Downtown Airport', city: 'St. Paul', state: 'MN', latitude: 44.9345, longitude: -93.0600 }
];

function findNearbyAirportsFallback(coordinates) {
  const MAX_DISTANCE_MILES = 100;
  const nearbyAirports = [];
  
  for (const airport of MAJOR_AIRPORTS) {
    const distance = calculateDistance(
      coordinates.lat, coordinates.lng,
      airport.latitude, airport.longitude
    );
    
    if (distance <= MAX_DISTANCE_MILES) {
      nearbyAirports.push({
        ...airport,
        distance: Math.round(distance * 10) / 10
      });
    }
  }
  
  // Sort by distance
  nearbyAirports.sort((a, b) => a.distance - b.distance);
  
  return nearbyAirports.slice(0, 10);
}

function calculateDistance(lat1, lng1, lat2, lng2) {
  // Haversine formula
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function displayNearbyAirports() {
  const list = document.getElementById('nearbyAirportsList');
  
  if (state.nearbyAirports.length === 0) {
    list.innerHTML = '<p style="color: #888; text-align: center; padding: 20px;">No airports found nearby. You can add airports later in your account settings.</p>';
    return;
  }
  
  list.innerHTML = state.nearbyAirports.map(airport => {
    const isSelected = state.selectedAirports.some(a => a.code === airport.code);
    return `
      <button type="button" class="airport-option ${isSelected ? 'selected' : ''}" data-code="${airport.code}" data-type="airport">
        <div class="airport-checkbox">
          <input type="checkbox" ${isSelected ? 'checked' : ''} readonly style="pointer-events: none;">
        </div>
        <div class="airport-code">${airport.code}</div>
        <div class="airport-info">
          <div class="airport-name">${airport.name}</div>
          <div class="airport-distance">${airport.distance ? airport.distance.toFixed(1) + ' miles' : airport.city + ', ' + (airport.state || airport.country)}</div>
        </div>
      </button>
    `;
  }).join('');
  
  // Add click handlers for multi-select
  list.querySelectorAll('.airport-option').forEach(btn => {
    btn.addEventListener('click', () => toggleAirportSelection(btn.dataset.code, 'airport'));
  });
  
  // Add some styling for selected state
  addAirportSelectionStyles();
}

function displayNearbyFBOs() {
  const section = document.getElementById('nearbyFBOsSection');
  const list = document.getElementById('nearbyFBOsList');
  
  if (!state.nearbyFBOs || state.nearbyFBOs.length === 0) {
    section.classList.add('hidden');
    return;
  }
  
  section.classList.remove('hidden');
  
  list.innerHTML = state.nearbyFBOs.map(fbo => {
    const isSelected = state.selectedFBOs.some(f => f.code === fbo.code || f.name === fbo.name);
    return `
      <button type="button" class="airport-option fbo-option ${isSelected ? 'selected' : ''}" data-code="${fbo.code || fbo.name}" data-type="fbo">
        <div class="airport-checkbox">
          <input type="checkbox" ${isSelected ? 'checked' : ''} readonly style="pointer-events: none;">
        </div>
        <div class="airport-code" style="background: #7c3aed;">🛩️</div>
        <div class="airport-info">
          <div class="airport-name">${fbo.name}</div>
          <div class="airport-distance">${fbo.distance ? fbo.distance.toFixed(1) + ' miles' : fbo.city || 'Private Aviation'}</div>
        </div>
      </button>
    `;
  }).join('');
  
  // Add click handlers for multi-select
  list.querySelectorAll('.fbo-option').forEach(btn => {
    btn.addEventListener('click', () => toggleAirportSelection(btn.dataset.code, 'fbo'));
  });
}

function toggleAirportSelection(code, type) {
  if (type === 'airport') {
    const airport = state.nearbyAirports.find(a => a.code === code);
    if (!airport) return;
    
    const existingIndex = state.selectedAirports.findIndex(a => a.code === code);
    
    if (existingIndex >= 0) {
      // Remove from selection
      state.selectedAirports.splice(existingIndex, 1);
    } else {
      // Add to selection
      state.selectedAirports.push(airport);
    }
  } else if (type === 'fbo') {
    const fbo = state.nearbyFBOs.find(f => f.code === code || f.name === code);
    if (!fbo) return;
    
    const existingIndex = state.selectedFBOs.findIndex(f => f.code === code || f.name === code);
    
    if (existingIndex >= 0) {
      state.selectedFBOs.splice(existingIndex, 1);
    } else {
      state.selectedFBOs.push(fbo);
    }
  }
  
  // Re-render lists to update checkboxes
  displayNearbyAirports();
  displayNearbyFBOs();
  
  // Update selected display
  updateSelectedAirportsDisplay();
}

function updateSelectedAirportsDisplay() {
  const display = document.getElementById('selectedAirportsDisplay');
  const list = document.getElementById('selectedAirportsList');
  
  const allSelected = [...state.selectedAirports, ...state.selectedFBOs];
  
  if (allSelected.length === 0) {
    display.classList.add('hidden');
    return;
  }
  
  display.classList.remove('hidden');
  
  list.innerHTML = allSelected.map(item => `
    <span class="selected-airport-chip" style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; background: rgba(82, 183, 136, 0.2); border: 1px solid #52b788; border-radius: 20px; font-size: 13px; color: #fff;">
      <span>${item.type === 'fbo' ? '🛩️' : '✈️'}</span>
      <span>${item.code || item.name}</span>
      <button type="button" class="remove-airport-chip" data-code="${item.code || item.name}" data-type="${item.type || 'airport'}" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 16px; padding: 0; margin-left: 4px;">×</button>
    </span>
  `).join('');
  
  // Add remove handlers
  list.querySelectorAll('.remove-airport-chip').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleAirportSelection(btn.dataset.code, btn.dataset.type);
    });
  });
}

function addAirportSelectionStyles() {
  // Add styles for selected airports if not already added
  if (document.getElementById('airport-selection-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'airport-selection-styles';
  style.textContent = `
    .airport-option {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      padding: 12px 16px;
      background: #252542;
      border: 1px solid #3a3a5e;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
      text-align: left;
      margin-bottom: 8px;
    }
    .airport-option:hover {
      background: #2d2d4d;
      border-color: #6366f1;
    }
    .airport-option.selected {
      background: linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%);
      border-color: #6366f1;
    }
    .airport-checkbox {
      flex-shrink: 0;
    }
    .airport-checkbox input[type="checkbox"] {
      width: 18px;
      height: 18px;
      accent-color: #6366f1;
    }
    .airport-code {
      flex-shrink: 0;
      padding: 6px 10px;
      background: #6366f1;
      border-radius: 4px;
      font-weight: 700;
      font-size: 12px;
      color: #fff;
    }
    .airport-info {
      flex: 1;
      min-width: 0;
    }
    .airport-name {
      font-weight: 500;
      color: #fff;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .airport-distance {
      font-size: 12px;
      color: #888;
    }
  `;
  document.head.appendChild(style);
}

// ============================================
// Phone Input (Smart - handles US and international)
// ============================================
function setupPhoneInput() {
  const input = document.getElementById('cellPhoneInput');
  
  // Format phone as user types
  input.addEventListener('input', (e) => {
    let rawValue = e.target.value;
    
    // Check if they're entering an international number (starts with + and not +1)
    if (rawValue.startsWith('+') && !rawValue.startsWith('+1')) {
      // International number - don't format, just clean it up
      e.target.value = rawValue.replace(/[^\d+]/g, '');
      validatePhoneInput();
      return;
    }
    
    // For US numbers, extract just digits
    let digits = rawValue.replace(/\D/g, '');
    
    // If they entered +1 or 1 at the start, remove it for formatting
    if (digits.startsWith('1') && digits.length > 10) {
      digits = digits.substring(1);
    }
    
    // Limit to 10 digits for US
    if (digits.length > 10) digits = digits.substring(0, 10);
    
    // Format as (XXX) XXX-XXXX
    let formatted = '';
    if (digits.length >= 6) {
      formatted = '(' + digits.substring(0, 3) + ') ' + digits.substring(3, 6) + '-' + digits.substring(6);
    } else if (digits.length >= 3) {
      formatted = '(' + digits.substring(0, 3) + ') ' + digits.substring(3);
    } else if (digits.length > 0) {
      formatted = '(' + digits;
    }
    
    e.target.value = formatted;
    validatePhoneInput();
  });
  
  input.addEventListener('blur', () => {
    validatePhoneInput();
  });
  
  // Pre-fill if phone exists
  if (state.customer?.phone || state.customer?.cell_phone) {
    const existingPhone = state.customer.phone || state.customer.cell_phone;
    // Check if international
    if (existingPhone.startsWith('+') && !existingPhone.startsWith('+1')) {
      input.value = existingPhone;
    } else {
      // US number - remove +1 or 1 if present and format
      let digits = existingPhone.replace(/\D/g, '');
      if (digits.startsWith('1') && digits.length === 11) {
        digits = digits.substring(1);
      }
      if (digits.length === 10) {
        input.value = '(' + digits.substring(0, 3) + ') ' + digits.substring(3, 6) + '-' + digits.substring(6);
      } else {
        input.value = existingPhone;
      }
    }
    validatePhoneInput();
  }
}

function validatePhoneInput() {
  const input = document.getElementById('cellPhoneInput');
  const statusDiv = document.getElementById('phoneVerificationStatus');
  const nextBtn = document.getElementById('step2NextBtn');
  const countryCodeBadge = document.getElementById('phoneCountryCode');
  
  const rawValue = input.value.trim();
  let isValid = false;
  let newPhone = null;
  let formattedPhone = null;
  let isInternational = false;
  
  // Check if international number (starts with + but not +1)
  if (rawValue.startsWith('+') && !rawValue.startsWith('+1')) {
    // International number - must have at least 8 digits after the +
    const intlDigits = rawValue.replace(/\D/g, '');
    if (intlDigits.length >= 8 && intlDigits.length <= 15) {
      isValid = true;
      newPhone = '+' + intlDigits;
      formattedPhone = rawValue;
      isInternational = true;
    }
  } else {
    // US number
    let digits = rawValue.replace(/\D/g, '');
    
    // Handle if they typed +1 or 1 at start
    if (digits.startsWith('1') && digits.length === 11) {
      digits = digits.substring(1);
    }
    
    if (digits.length === 10) {
      isValid = true;
      newPhone = '+1' + digits;
      formattedPhone = '+1 (' + digits.substring(0, 3) + ') ' + digits.substring(3, 6) + '-' + digits.substring(6);
    }
  }
  
  // Show/hide +1 badge based on international
  if (countryCodeBadge) {
    if (isInternational) {
      countryCodeBadge.style.display = 'none';
    } else {
      countryCodeBadge.style.display = 'block';
    }
  }
  
  // Reset OTP if phone number changed
  if (state.cellPhone && newPhone !== state.cellPhone) {
    state.otpCode = null;
    state.otpExpiry = null;
    state.phoneVerified = false;
    document.getElementById('otpSection')?.classList.add('hidden');
    document.getElementById('phoneVerifiedSection')?.classList.add('hidden');
    if (state.otpResendTimer) {
      clearInterval(state.otpResendTimer);
      state.otpResendTimer = null;
    }
    clearOtpInputs();
  }
  
  if (isValid) {
    state.cellPhone = newPhone; // E.164 format
    state.cellPhoneFormatted = formattedPhone;
    
    statusDiv.classList.remove('hidden');
    nextBtn.disabled = false;
    nextBtn.textContent = state.phoneVerified ? 'Continue →' : 'Send Verification Code';
    input.classList.remove('invalid');
    input.classList.add('valid');
  } else {
    state.cellPhone = null;
    state.cellPhoneFormatted = null;
    
    statusDiv.classList.add('hidden');
    nextBtn.disabled = true;
    nextBtn.textContent = 'Send Verification Code';
    
    if (rawValue) {
      input.classList.add('invalid');
      input.classList.remove('valid');
    } else {
      input.classList.remove('invalid', 'valid');
    }
  }
}

// ============================================
// OTP Verification
// ============================================
function setupOtpInputs() {
  const otpDigits = document.querySelectorAll('.otp-digit');
  
  otpDigits.forEach((input, index) => {
    input.addEventListener('input', (e) => {
      const value = e.target.value.replace(/\D/g, '');
      
      // Handle iOS/Android autofill - when multiple digits are entered at once
      if (value.length > 1) {
        // Distribute digits across all inputs starting from current position
        const digits = value.substring(0, 6 - index);
        digits.split('').forEach((char, i) => {
          if (otpDigits[index + i]) {
            otpDigits[index + i].value = char;
          }
        });
        // Focus the next empty input or last input
        const nextEmpty = Array.from(otpDigits).findIndex(d => !d.value);
        if (nextEmpty !== -1) {
          otpDigits[nextEmpty].focus();
        } else {
          otpDigits[otpDigits.length - 1].focus();
        }
        checkOtpComplete();
        return;
      }
      
      // Single digit entry
      e.target.value = value.substring(0, 1);
      
      if (value && index < otpDigits.length - 1) {
        otpDigits[index + 1].focus();
      }
      
      // Check if all digits are filled
      checkOtpComplete();
    });
    
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !e.target.value && index > 0) {
        otpDigits[index - 1].focus();
      }
    });
    
    // Handle paste
    input.addEventListener('paste', (e) => {
      e.preventDefault();
      const pasteData = e.clipboardData.getData('text').replace(/\D/g, '').substring(0, 6);
      pasteData.split('').forEach((char, i) => {
        if (otpDigits[i]) {
          otpDigits[i].value = char;
        }
      });
      checkOtpComplete();
    });
  });
}

function checkOtpComplete() {
  const otpDigits = document.querySelectorAll('.otp-digit');
  const code = Array.from(otpDigits).map(d => d.value).join('');
  
  if (code.length === 6) {
    verifyOtp(code);
  }
}

async function sendOtpToPhone() {
  if (!state.cellPhone) return;
  
  const nextBtn = document.getElementById('step2NextBtn');
  const otpSection = document.getElementById('otpSection');
  const phoneDisplay = document.getElementById('otpPhoneDisplay');
  
  // Show loading state
  nextBtn.disabled = true;
  nextBtn.textContent = 'Sending...';
  
  // Generate 6-digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  state.otpCode = code;
  state.otpExpiry = Date.now() + (5 * 60 * 1000); // 5 minutes
  state.otpAttempts = 0;
  
  console.log('[CustomerOnboarding] Generated OTP:', code); // For testing
  
  // Display phone number
  phoneDisplay.textContent = state.cellPhoneFormatted;
  
  // Send SMS
  try {
    await sendSMS(state.cellPhone, `Your RELIALIMO verification code is: ${code}. This code expires in 5 minutes.`);
    showToast('Verification code sent!', 'success');
  } catch (err) {
    console.warn('[CustomerOnboarding] SMS send failed, continuing for testing:', err);
    showToast('Code sent! (Check console if SMS not received)', 'info');
  }
  
  // Show OTP section
  otpSection.classList.remove('hidden');
  
  // Focus first digit
  document.getElementById('otpDigit1')?.focus();
  
  // Start resend timer
  startResendTimer();
  
  // Update button
  nextBtn.textContent = 'Verify Code';
  nextBtn.disabled = true;
}

function startResendTimer() {
  const timerEl = document.getElementById('otpTimer');
  const resendBtn = document.getElementById('resendOtpBtn');
  let seconds = 60;
  
  resendBtn.disabled = true;
  resendBtn.style.opacity = '0.5';
  
  state.otpResendTimer = setInterval(() => {
    seconds--;
    timerEl.textContent = `Resend in ${seconds}s`;
    
    if (seconds <= 0) {
      clearInterval(state.otpResendTimer);
      state.otpResendTimer = null;
      timerEl.textContent = '';
      resendBtn.disabled = false;
      resendBtn.style.opacity = '1';
    }
  }, 1000);
}

function verifyOtp(code) {
  const statusEl = document.getElementById('otpStatus');
  const nextBtn = document.getElementById('step2NextBtn');
  
  // Check expiry
  if (Date.now() > state.otpExpiry) {
    statusEl.innerHTML = '<span style="color:#ef5350;">Code expired. Please request a new one.</span>';
    clearOtpInputs();
    return;
  }
  
  // Check attempts
  state.otpAttempts++;
  if (state.otpAttempts > 5) {
    statusEl.innerHTML = '<span style="color:#ef5350;">Too many attempts. Please request a new code.</span>';
    clearOtpInputs();
    return;
  }
  
  // Verify code
  if (code === state.otpCode) {
    // Success!
    state.phoneVerified = true;
    statusEl.innerHTML = '<span style="color:#4caf50;">✓ Phone verified!</span>';
    
    // Hide OTP section, show verified section
    document.getElementById('otpSection').classList.add('hidden');
    document.getElementById('phoneVerifiedSection').classList.remove('hidden');
    
    // Update button to continue
    nextBtn.textContent = 'Continue →';
    nextBtn.disabled = false;
    
    // Clear timer
    if (state.otpResendTimer) {
      clearInterval(state.otpResendTimer);
      state.otpResendTimer = null;
    }
    
    showToast('Phone verified successfully!', 'success');
  } else {
    // Wrong code
    statusEl.innerHTML = '<span style="color:#ef5350;">Invalid code. Please try again.</span>';
    document.querySelectorAll('.otp-digit').forEach(d => {
      d.style.borderColor = '#ef5350';
    });
    setTimeout(() => {
      document.querySelectorAll('.otp-digit').forEach(d => {
        d.style.borderColor = '#3a3a5e';
      });
    }, 2000);
  }
}

function clearOtpInputs() {
  document.querySelectorAll('.otp-digit').forEach(input => {
    input.value = '';
    input.style.borderColor = '#3a3a5e';
  });
  document.getElementById('otpDigit1')?.focus();
}

async function sendSMS(to, message) {
  // Get SMS provider config
  const providers = JSON.parse(localStorage.getItem('smsProviders') || '[]');
  const defaultProvider = providers.find(p => p.isDefault) || providers[0];
  
  if (!defaultProvider) {
    console.warn('[CustomerOnboarding] No SMS provider configured');
    throw new Error('SMS not configured');
  }
  
  const accountSid = defaultProvider.accountSid || window.ENV?.TWILIO_ACCOUNT_SID;
  const authToken = defaultProvider.authToken || window.ENV?.TWILIO_AUTH_TOKEN;
  const fromNumber = defaultProvider.fromNumber || defaultProvider.messagingServiceSid || window.ENV?.TWILIO_FROM;
  
  if (!accountSid || !authToken) {
    throw new Error('SMS credentials not configured');
  }
  
  const params = new URLSearchParams();
  params.append('To', to.startsWith('+') ? to : `+1${to.replace(/\D/g, '')}`);
  params.append('Body', message);
  if (fromNumber) {
    if (fromNumber.startsWith('MG')) {
      params.append('MessagingServiceSid', fromNumber);
    } else {
      params.append('From', fromNumber);
    }
  }
  
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'SMS send failed');
  }
  
  return await response.json();
}

// ============================================
// Payment Form
// ============================================
function setupPaymentForm() {
  // Card number formatting
  const cardNumber = document.getElementById('cardNumber');
  cardNumber.addEventListener('input', (e) => {
    let value = e.target.value.replace(/\D/g, '');
    value = value.replace(/(\d{4})(?=\d)/g, '$1 ');
    e.target.value = value.substring(0, 19);
    
    // Detect card type
    detectCardType(value.replace(/\s/g, ''));
    updateCompleteButton();
  });
  
  // Expiry formatting
  const cardExpiry = document.getElementById('cardExpiry');
  cardExpiry.addEventListener('input', (e) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length >= 2) {
      value = value.substring(0, 2) + '/' + value.substring(2);
    }
    e.target.value = value.substring(0, 5);
    updateCompleteButton();
  });
  
  // CVV formatting
  const cardCvv = document.getElementById('cardCvv');
  cardCvv.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').substring(0, 4);
    updateCompleteButton();
  });
  
  // Card name
  document.getElementById('cardName').addEventListener('input', updateCompleteButton);
}

function detectCardType(number) {
  const cardIcons = document.getElementById('cardIcons');
  let type = 'unknown';
  
  if (/^4/.test(number)) type = 'visa';
  else if (/^5[1-5]/.test(number)) type = 'mastercard';
  else if (/^3[47]/.test(number)) type = 'amex';
  else if (/^6(?:011|5)/.test(number)) type = 'discover';
  
  const icons = {
    visa: '💳 Visa',
    mastercard: '💳 Mastercard',
    amex: '💳 Amex',
    discover: '💳 Discover',
    unknown: '💳'
  };
  
  cardIcons.innerHTML = `<span class="card-icon ${type}">${icons[type]}</span>`;
}

function updateCompleteButton() {
  const btn = document.getElementById('completeSetupBtn');
  
  if (state.skipPayment) {
    btn.disabled = false;
    return;
  }
  
  // Validate card form
  const cardName = document.getElementById('cardName').value.trim();
  const cardNumber = document.getElementById('cardNumber').value.replace(/\s/g, '');
  const cardExpiry = document.getElementById('cardExpiry').value;
  const cardCvv = document.getElementById('cardCvv').value;
  
  const isValid = 
    cardName.length >= 2 &&
    cardNumber.length >= 15 &&
    /^\d{2}\/\d{2}$/.test(cardExpiry) &&
    cardCvv.length >= 3;
  
  btn.disabled = !isValid;
}

// ============================================
// Complete Onboarding
// ============================================
async function completeOnboarding() {
  console.log('[CustomerOnboarding] Completing onboarding...');
  
  const btn = document.getElementById('completeSetupBtn');
  btn.disabled = true;
  btn.textContent = 'Saving...';
  
  try {
    const creds = getSupabaseCredentials();
    
    // Ensure we have customer data - try multiple sources
    let customerEmail = null;
    
    if (!state.customer || !state.customer.email) {
      console.log('[CustomerOnboarding] Customer not in state, trying to reload...');
      
      // Try CustomerAuth
      state.customer = CustomerAuth.getCustomer();
      customerEmail = state.customer?.email;
      console.log('[CustomerOnboarding] From CustomerAuth:', customerEmail);
      
      // Try localStorage current_customer
      if (!customerEmail) {
        const storedCustomer = localStorage.getItem('current_customer');
        if (storedCustomer) {
          state.customer = JSON.parse(storedCustomer);
          customerEmail = state.customer?.email;
          console.log('[CustomerOnboarding] From current_customer:', customerEmail);
        }
      }
      
      // Try customer_session
      if (!customerEmail) {
        const sessionStr = localStorage.getItem('customer_session');
        if (sessionStr) {
          const session = JSON.parse(sessionStr);
          customerEmail = session?.customer?.email || session?.user?.email;
          if (customerEmail && !state.customer) {
            state.customer = session.customer || { email: customerEmail };
          }
          console.log('[CustomerOnboarding] From customer_session:', customerEmail);
        }
      }
      
      // Try Supabase session user
      if (!customerEmail) {
        const session = CustomerAuth.getSession();
        customerEmail = session?.user?.email;
        if (customerEmail && !state.customer) {
          state.customer = { email: customerEmail };
        }
        console.log('[CustomerOnboarding] From Supabase session:', customerEmail);
      }
      
      // Final fallback: verified_email in localStorage
      if (!customerEmail) {
        customerEmail = localStorage.getItem('verified_email');
        if (customerEmail && !state.customer) {
          state.customer = { email: customerEmail };
        }
        console.log('[CustomerOnboarding] From verified_email:', customerEmail);
      }
    } else {
      customerEmail = state.customer.email;
    }
    
    // If still no email, show error
    if (!customerEmail) {
      console.error('[CustomerOnboarding] Could not find customer email from any source');
      throw new Error('Session expired. Please log in again.');
    }
    
    console.log('[CustomerOnboarding] Using email:', customerEmail);
    
    // Prepare update data
    // For backwards compatibility, use first selected airport as home_airport
    const primaryAirport = state.selectedAirports[0] || null;
    
    const updateData = {
      // Use correct column names: address_line1, city, state, zip
      address_line1: document.getElementById('homeStreet').value || state.homeAddress,
      city: document.getElementById('homeCity').value,
      state: document.getElementById('homeState').value,
      zip: document.getElementById('homeZip').value,
      cell_phone: state.cellPhone,
      home_airport: primaryAirport?.code || null,
      home_airport_name: primaryAirport?.name || null,
      home_coordinates: state.homeCoordinates,
      // Store all selected airports and FBOs as JSON
      preferred_airports: state.selectedAirports.map(a => ({
        code: a.code,
        name: a.name,
        city: a.city,
        state: a.state,
        latitude: a.latitude,
        longitude: a.longitude
      })),
      preferred_fbos: state.selectedFBOs.map(f => ({
        code: f.code,
        name: f.name,
        city: f.city,
        latitude: f.latitude,
        longitude: f.longitude
      })),
      onboarding_complete: true,
      onboarding_completed_at: new Date().toISOString()
    };
    
    console.log('[CustomerOnboarding] Saving data:', updateData);
    console.log('[CustomerOnboarding] Selected airports:', state.selectedAirports);
    
    // Save payment method reference (in production, use Stripe)
    if (!state.skipPayment) {
      const cardNumber = document.getElementById('cardNumber').value.replace(/\s/g, '');
      updateData.payment_method_last4 = cardNumber.slice(-4);
      updateData.payment_method_type = detectCardTypeForStorage(cardNumber);
      updateData.has_payment_method = true;
    }
    
    // Update account in Supabase
    const response = await fetch(
      `${creds.url}/rest/v1/accounts?email=eq.${encodeURIComponent(customerEmail.toLowerCase())}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': creds.anonKey,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(updateData)
      }
    );
    
    const responseText = await response.text();
    console.log('[CustomerOnboarding] Save response:', response.status, responseText);
    
    if (response.ok) {
      try {
        const updated = JSON.parse(responseText);
        if (updated.length > 0) {
          state.customer = { ...state.customer, ...updated[0] };
          localStorage.setItem('current_customer', JSON.stringify(state.customer));
        }
      } catch (e) {
        console.log('[CustomerOnboarding] Response was not JSON:', responseText);
      }
    } else {
      console.error('[CustomerOnboarding] Save failed:', response.status, responseText);
    }
    
    // Show completion section
    showCompletionScreen();
    
  } catch (err) {
    console.error('[CustomerOnboarding] Error completing onboarding:', err);
    showToast('Failed to save. Please try again.', 'error');
    btn.disabled = false;
    btn.textContent = 'Complete Setup →';
  }
}

function detectCardTypeForStorage(number) {
  if (/^4/.test(number)) return 'visa';
  if (/^5[1-5]/.test(number)) return 'mastercard';
  if (/^3[47]/.test(number)) return 'amex';
  if (/^6(?:011|5)/.test(number)) return 'discover';
  return 'card';
}

// ============================================
// Completion Screen
// ============================================
function showCompletionScreen() {
  // Hide steps
  document.querySelectorAll('.onboarding-step').forEach(s => s.classList.remove('active'));
  document.querySelector('.onboarding-progress').classList.add('hidden');
  
  // Show completion
  document.getElementById('completionSection').classList.remove('hidden');
  
  // Populate summary
  const firstName = state.customer?.first_name || '';
  const lastName = state.customer?.last_name || '';
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  
  document.getElementById('summaryInitials').textContent = initials;
  document.getElementById('summaryName').textContent = `${firstName} ${lastName}`;
  document.getElementById('summaryEmail').textContent = state.customer?.email || '';
  document.getElementById('summaryPhone').textContent = state.cellPhoneFormatted || state.cellPhone || '';
  document.getElementById('summaryAddress').textContent = state.homeAddress || '-';
  
  // Display selected airports (multi-select)
  const airportDisplay = state.selectedAirports.length > 0
    ? state.selectedAirports.map(a => a.code).join(', ')
    : 'No home airport selected';
  document.getElementById('summaryAirport').textContent = airportDisplay;
  
  document.getElementById('summaryPayment').textContent = state.skipPayment
    ? 'No payment method added'
    : `•••• ${document.getElementById('cardNumber').value.slice(-4)}`;
  
  // Initialize map with drivers
  initializeDriversMap();
  
  // Show nearby drivers
  displayNearbyDrivers();
}

// ============================================
// Drivers Map
// ============================================
function initializeDriversMap() {
  const mapContainer = document.getElementById('driversMap');
  
  if (!mapContainer) {
    console.warn('[CustomerOnboarding] Map container #driversMap not found');
    return;
  }
  
  if (!window.mapboxgl) {
    console.warn('[CustomerOnboarding] Mapbox GL JS not loaded');
    mapContainer.innerHTML = '<p style="padding: 40px; text-align: center; color: #888;">Map unavailable</p>';
    return;
  }
  
  try {
    const token = window.ENV?.MAPBOX_TOKEN || 'pk.eyJ1IjoiZXJpeGNvYWNoIiwiYSI6ImNtaDdocXI0NDB1dW4yaW9tZWFka3NocHAifQ.h1czc1VBwbBJQbdJTU5HHA';
    mapboxgl.accessToken = token;
    console.log('[CustomerOnboarding] Initializing map with token:', token.substring(0, 20) + '...');
    
    const center = state.homeCoordinates || { lng: -93.2650, lat: 44.9778 }; // Default to Minneapolis
    console.log('[CustomerOnboarding] Map center:', center);
    
    state.map = new mapboxgl.Map({
      container: 'driversMap',
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [center.lng, center.lat],
      zoom: 11,
      attributionControl: true
    });
    
    state.map.on('error', (e) => {
      console.error('[CustomerOnboarding] Mapbox error:', e);
    });
    
    state.map.on('load', () => {
      console.log('[CustomerOnboarding] Map loaded successfully');
      
      // Add user location marker
      const homeMarker = document.createElement('div');
      homeMarker.className = 'home-marker';
      homeMarker.innerHTML = '🏠';
      homeMarker.style.fontSize = '28px';
      homeMarker.style.cursor = 'pointer';
      
      new mapboxgl.Marker({ element: homeMarker })
        .setLngLat([center.lng, center.lat])
        .addTo(state.map);
      
      // Add mock driver markers with car icons
      MOCK_DRIVERS.forEach((driver, index) => {
        const offset = 0.015 + (index * 0.008);
        const angle = (index * 72 + 15) * Math.PI / 180;
        
        const driverLng = center.lng + offset * Math.cos(angle);
        const driverLat = center.lat + offset * Math.sin(angle);
        
        const driverMarker = document.createElement('div');
        driverMarker.className = 'driver-marker';
        driverMarker.innerHTML = `
          <div class="car-icon" style="
            width: 32px;
            height: 32px;
            background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 2px solid white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            cursor: pointer;
          ">
            <span style="font-size: 16px;">🚗</span>
          </div>
        `;
        driverMarker.title = `${driver.name} - ${driver.vehicle}`;
        
        new mapboxgl.Marker({ element: driverMarker })
          .setLngLat([driverLng, driverLat])
          .addTo(state.map);
      });
    });
  } catch (err) {
    console.error('[CustomerOnboarding] Map initialization error:', err);
    mapContainer.innerHTML = '<p style="padding: 40px; text-align: center; color: #888;">Map unavailable</p>';
  }
}

function displayNearbyDrivers() {
  const list = document.getElementById('nearbyDriversList');
  
  list.innerHTML = MOCK_DRIVERS.slice(0, 3).map(driver => `
    <div class="driver-card" style="display: flex; align-items: center; gap: 12px; padding: 12px; background: rgba(255,255,255,0.05); border-radius: 12px; margin-bottom: 10px;">
      <div class="driver-photo" style="width: 50px; height: 50px; border-radius: 50%; overflow: hidden; background: linear-gradient(135deg, #6366f1, #8b5cf6); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
        <img src="${driver.photo}" alt="${driver.name}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
        <span style="display: none; color: white; font-weight: bold; font-size: 16px;">${driver.initials}</span>
      </div>
      <div class="driver-info" style="flex: 1; min-width: 0;">
        <div class="driver-name" style="font-weight: 600; color: #fff; font-size: 14px;">${driver.name}</div>
        <div class="driver-vehicle" style="display: flex; align-items: center; gap: 6px; margin-top: 4px;">
          <img src="${driver.vehicleImage}" alt="${driver.vehicle}" style="width: 40px; height: 20px; object-fit: contain;" onerror="this.style.display='none';">
          <span style="color: rgba(255,255,255,0.7); font-size: 12px;">${driver.vehicle}</span>
        </div>
        <div class="driver-stats" style="display: flex; gap: 10px; margin-top: 4px; font-size: 11px; color: rgba(255,255,255,0.6);">
          <span class="rating">⭐ ${driver.rating}</span>
          <span class="trips">${driver.trips.toLocaleString()} trips</span>
        </div>
      </div>
      <div class="driver-distance" style="background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 6px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; flex-shrink: 0;">
        ${driver.distance} mi
      </div>
    </div>
  `).join('');
}

// ============================================
// Portal Redirect
// ============================================
function redirectToPortal() {
  // Try to get slug from CustomerAuth first, then state
  let slug = CustomerAuth.getPortalSlug() || state.customer?.portal_slug;
  
  // Generate from name with random ID if not available
  if (!slug && state.customer?.first_name && state.customer?.last_name) {
    const randomId = Math.random().toString(36).substring(2, 10);
    slug = `${state.customer.first_name}_${state.customer.last_name}_${randomId}`.toLowerCase().replace(/[^a-z0-9_]/g, '');
  }
  
  // Validate slug
  if (slug && slug !== '_' && slug.replace(/_/g, '') !== '') {
    window.location.href = `/${slug}`;
  } else {
    // Fallback to booking page
    window.location.href = 'https://relialimo.com/book';
  }
}

// ============================================
// Toast Notifications
// ============================================
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  
  container.appendChild(toast);
  
  // Animate in
  setTimeout(() => toast.classList.add('show'), 10);
  
  // Remove after delay
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ============================================
// Initialize on DOM Ready
// ============================================
document.addEventListener('DOMContentLoaded', init);

// Export for module use
export { state, init };
