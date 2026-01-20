// ============================================
// Customer Onboarding JavaScript
// Complete account setup flow after email verification
// ============================================

import { getSupabaseCredentials } from '/shared/supabase-config.js';

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
  selectedAirport: null,
  cellPhone: null,
  cellPhoneFormatted: null,
  paymentMethod: null,
  skipPayment: false,
  
  // UI state
  iti: null, // intl-tel-input instance
  map: null,
  addressAutocomplete: null,
  nearbyAirports: []
};

// Major US airports database for nearby lookup
const MAJOR_AIRPORTS = [
  { code: 'MSP', name: 'Minneapolis-St. Paul International Airport', city: 'Minneapolis', state: 'MN', lat: 44.8848, lng: -93.2223 },
  { code: 'ORD', name: "O'Hare International Airport", city: 'Chicago', state: 'IL', lat: 41.9742, lng: -87.9073 },
  { code: 'LAX', name: 'Los Angeles International Airport', city: 'Los Angeles', state: 'CA', lat: 33.9416, lng: -118.4085 },
  { code: 'JFK', name: 'John F. Kennedy International Airport', city: 'New York', state: 'NY', lat: 40.6413, lng: -73.7781 },
  { code: 'SFO', name: 'San Francisco International Airport', city: 'San Francisco', state: 'CA', lat: 37.6213, lng: -122.3790 },
  { code: 'DFW', name: 'Dallas/Fort Worth International Airport', city: 'Dallas', state: 'TX', lat: 32.8998, lng: -97.0403 },
  { code: 'DEN', name: 'Denver International Airport', city: 'Denver', state: 'CO', lat: 39.8561, lng: -104.6737 },
  { code: 'SEA', name: 'Seattle-Tacoma International Airport', city: 'Seattle', state: 'WA', lat: 47.4502, lng: -122.3088 },
  { code: 'ATL', name: 'Hartsfield-Jackson Atlanta International Airport', city: 'Atlanta', state: 'GA', lat: 33.6407, lng: -84.4277 },
  { code: 'MIA', name: 'Miami International Airport', city: 'Miami', state: 'FL', lat: 25.7959, lng: -80.2870 },
  { code: 'BOS', name: 'Boston Logan International Airport', city: 'Boston', state: 'MA', lat: 42.3656, lng: -71.0096 },
  { code: 'PHX', name: 'Phoenix Sky Harbor International Airport', city: 'Phoenix', state: 'AZ', lat: 33.4373, lng: -112.0078 },
  { code: 'LAS', name: 'Harry Reid International Airport', city: 'Las Vegas', state: 'NV', lat: 36.0840, lng: -115.1537 },
  { code: 'MCO', name: 'Orlando International Airport', city: 'Orlando', state: 'FL', lat: 28.4312, lng: -81.3081 },
  { code: 'EWR', name: 'Newark Liberty International Airport', city: 'Newark', state: 'NJ', lat: 40.6895, lng: -74.1745 },
  { code: 'IAH', name: 'George Bush Intercontinental Airport', city: 'Houston', state: 'TX', lat: 29.9902, lng: -95.3368 },
  { code: 'SAN', name: 'San Diego International Airport', city: 'San Diego', state: 'CA', lat: 32.7338, lng: -117.1933 },
  { code: 'DTW', name: 'Detroit Metropolitan Wayne County Airport', city: 'Detroit', state: 'MI', lat: 42.2162, lng: -83.3554 },
  { code: 'MSN', name: 'Dane County Regional Airport', city: 'Madison', state: 'WI', lat: 43.1399, lng: -89.3375 },
  { code: 'MKE', name: 'General Mitchell International Airport', city: 'Milwaukee', state: 'WI', lat: 42.9472, lng: -87.8966 },
  { code: 'RST', name: 'Rochester International Airport', city: 'Rochester', state: 'MN', lat: 43.9083, lng: -92.5000 },
  { code: 'FAR', name: 'Hector International Airport', city: 'Fargo', state: 'ND', lat: 46.9207, lng: -96.8158 },
  { code: 'DLH', name: 'Duluth International Airport', city: 'Duluth', state: 'MN', lat: 46.8420, lng: -92.1936 },
  { code: 'STC', name: 'St. Cloud Regional Airport', city: 'St. Cloud', state: 'MN', lat: 45.5466, lng: -94.0597 }
];

// Mock drivers for demonstration
const MOCK_DRIVERS = [
  { id: 1, name: 'Michael R.', rating: 4.9, trips: 1247, vehicle: 'Black Escalade', photo: '👨‍✈️', distance: 2.3 },
  { id: 2, name: 'Sarah K.', rating: 4.8, trips: 892, vehicle: 'Lincoln Navigator', photo: '👩‍✈️', distance: 3.1 },
  { id: 3, name: 'James T.', rating: 4.9, trips: 2103, vehicle: 'Mercedes S-Class', photo: '🧑‍✈️', distance: 4.7 },
  { id: 4, name: 'Emily W.', rating: 5.0, trips: 567, vehicle: 'Cadillac CT6', photo: '👩‍✈️', distance: 5.2 },
  { id: 5, name: 'David L.', rating: 4.7, trips: 1456, vehicle: 'Sprinter Van', photo: '👨‍✈️', distance: 6.8 }
];

// ============================================
// Initialization
// ============================================
async function init() {
  console.log('[CustomerOnboarding] Initializing...');
  
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
    if (isAuth) {
      // Check if onboarding is complete
      if (state.customer?.onboarding_complete) {
        // Redirect to portal
        redirectToPortal();
      } else {
        // Show onboarding
        showScreen('onboardingScreen');
        await setupOnboarding();
      }
    } else {
      // Redirect to auth
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
    
    // Store in localStorage
    localStorage.setItem('current_customer', JSON.stringify(state.customer));
    
    // Show success
    verifySpinner.classList.add('hidden');
    verifySuccess.classList.remove('hidden');
    
    // Redirect to onboarding after delay
    setTimeout(() => {
      showScreen('onboardingScreen');
      setupOnboarding();
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
    const session = localStorage.getItem('customer_session');
    const customerInfo = localStorage.getItem('current_customer');
    
    if (customerInfo) {
      state.customer = JSON.parse(customerInfo);
    }
    
    if (session) {
      const parsed = JSON.parse(session);
      if (parsed?.access_token) {
        // Check token expiry
        if (parsed.expires_at && parsed.expires_at * 1000 < Date.now()) {
          localStorage.removeItem('customer_session');
          return false;
        }
        state.session = parsed;
        return true;
      }
    }
    
    // Also check if we have customer info from verification
    return !!state.customer;
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
  
  // Step 2 -> Step 3
  document.getElementById('step2NextBtn').addEventListener('click', () => {
    if (state.cellPhone) {
      showStep(3);
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
// Nearby Airport Finder
// ============================================
function findNearbyAirports(coordinates) {
  console.log('[CustomerOnboarding] Finding nearby airports for:', coordinates);
  
  const MAX_DISTANCE_MILES = 100;
  const nearbyAirports = [];
  
  for (const airport of MAJOR_AIRPORTS) {
    const distance = calculateDistance(
      coordinates.lat, coordinates.lng,
      airport.lat, airport.lng
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
  
  // Take top 5
  state.nearbyAirports = nearbyAirports.slice(0, 5);
  
  // Display airports
  displayNearbyAirports();
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
  const section = document.getElementById('airportSuggestionSection');
  const list = document.getElementById('nearbyAirportsList');
  
  if (state.nearbyAirports.length === 0) {
    section.classList.add('hidden');
    return;
  }
  
  section.classList.remove('hidden');
  
  list.innerHTML = state.nearbyAirports.map(airport => `
    <button type="button" class="airport-option" data-code="${airport.code}">
      <div class="airport-code">${airport.code}</div>
      <div class="airport-info">
        <div class="airport-name">${airport.name}</div>
        <div class="airport-distance">${airport.distance} miles away</div>
      </div>
      <div class="airport-select-icon">→</div>
    </button>
  `).join('');
  
  // Add click handlers
  list.querySelectorAll('.airport-option').forEach(btn => {
    btn.addEventListener('click', () => selectAirport(btn.dataset.code));
  });
}

function selectAirport(code) {
  const airport = state.nearbyAirports.find(a => a.code === code);
  if (!airport) return;
  
  state.selectedAirport = airport;
  
  // Update UI
  document.getElementById('nearbyAirportsList').classList.add('hidden');
  const display = document.getElementById('selectedAirportDisplay');
  display.classList.remove('hidden');
  document.getElementById('selectedAirportName').textContent = `${airport.code} - ${airport.name}`;
  
  // Add change button handler
  document.getElementById('changeAirportBtn').addEventListener('click', () => {
    state.selectedAirport = null;
    display.classList.add('hidden');
    document.getElementById('nearbyAirportsList').classList.remove('hidden');
  });
  
  showToast(`Selected ${airport.code} as your home airport!`, 'success');
}

// ============================================
// Phone Input (US Only)
// ============================================
function setupPhoneInput() {
  const input = document.getElementById('cellPhoneInput');
  
  // Format phone as user types
  input.addEventListener('input', (e) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 10) value = value.substring(0, 10);
    
    // Format as (XXX) XXX-XXXX
    if (value.length >= 6) {
      value = '(' + value.substring(0, 3) + ') ' + value.substring(3, 6) + '-' + value.substring(6);
    } else if (value.length >= 3) {
      value = '(' + value.substring(0, 3) + ') ' + value.substring(3);
    } else if (value.length > 0) {
      value = '(' + value;
    }
    
    e.target.value = value;
    validatePhoneInput();
  });
  
  input.addEventListener('blur', () => {
    validatePhoneInput();
  });
  
  // Pre-fill if phone exists
  if (state.customer?.phone || state.customer?.cell_phone) {
    const existingPhone = state.customer.phone || state.customer.cell_phone;
    // Remove +1 or country code if present and format
    let digits = existingPhone.replace(/\D/g, '');
    if (digits.startsWith('1') && digits.length === 11) {
      digits = digits.substring(1);
    }
    if (digits.length === 10) {
      input.value = '(' + digits.substring(0, 3) + ') ' + digits.substring(3, 6) + '-' + digits.substring(6);
    } else {
      input.value = existingPhone;
    }
    validatePhoneInput();
  }
}

function validatePhoneInput() {
  const input = document.getElementById('cellPhoneInput');
  const statusDiv = document.getElementById('phoneVerificationStatus');
  const nextBtn = document.getElementById('step2NextBtn');
  
  // Get just the digits
  const digits = input.value.replace(/\D/g, '');
  const isValid = digits.length === 10;
  
  if (isValid) {
    state.cellPhone = '+1' + digits; // E.164 format
    state.cellPhoneFormatted = '+1 (' + digits.substring(0, 3) + ') ' + digits.substring(3, 6) + '-' + digits.substring(6);
    
    statusDiv.classList.remove('hidden');
    nextBtn.disabled = false;
    input.classList.remove('invalid');
    input.classList.add('valid');
  } else {
    state.cellPhone = null;
    state.cellPhoneFormatted = null;
    
    statusDiv.classList.add('hidden');
    nextBtn.disabled = true;
    
    if (input.value.trim()) {
      input.classList.add('invalid');
      input.classList.remove('valid');
    } else {
      input.classList.remove('invalid', 'valid');
    }
  }
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
    
    // Prepare update data
    const updateData = {
      address1: document.getElementById('homeStreet').value || state.homeAddress,
      city: document.getElementById('homeCity').value,
      state: document.getElementById('homeState').value,
      zip_code: document.getElementById('homeZip').value,
      cell_phone: state.cellPhone,
      home_airport: state.selectedAirport?.code || null,
      home_airport_name: state.selectedAirport?.name || null,
      home_coordinates: state.homeCoordinates,
      onboarding_complete: true,
      onboarding_completed_at: new Date().toISOString()
    };
    
    // Save payment method reference (in production, use Stripe)
    if (!state.skipPayment) {
      const cardNumber = document.getElementById('cardNumber').value.replace(/\s/g, '');
      updateData.payment_method_last4 = cardNumber.slice(-4);
      updateData.payment_method_type = detectCardTypeForStorage(cardNumber);
      updateData.has_payment_method = true;
    }
    
    // Update account in Supabase
    const response = await fetch(
      `${creds.url}/rest/v1/accounts?email=eq.${encodeURIComponent(state.customer.email.toLowerCase())}`,
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
    
    if (response.ok) {
      const updated = await response.json();
      if (updated.length > 0) {
        state.customer = { ...state.customer, ...updated[0] };
        localStorage.setItem('current_customer', JSON.stringify(state.customer));
      }
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
  document.getElementById('summaryAirport').textContent = state.selectedAirport 
    ? `${state.selectedAirport.code} - ${state.selectedAirport.name}`
    : 'No home airport selected';
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
  if (!window.mapboxgl) {
    console.warn('Mapbox not available');
    return;
  }
  
  mapboxgl.accessToken = window.ENV?.MAPBOX_TOKEN || 'pk.eyJ1IjoicmVsaWFsaW1vIiwiYSI6ImNtNnd2cHU5ODBkMXYycXB1cWR2a3JjNm4ifQ.uGT0gP5I2InS-5LMGJPkrA';
  
  const center = state.homeCoordinates || { lng: -93.2650, lat: 44.9778 }; // Default to Minneapolis
  
  state.map = new mapboxgl.Map({
    container: 'driversMap',
    style: 'mapbox://styles/mapbox/dark-v11',
    center: [center.lng, center.lat],
    zoom: 11
  });
  
  // Add user location marker
  const homeMarker = document.createElement('div');
  homeMarker.className = 'home-marker';
  homeMarker.innerHTML = '🏠';
  
  new mapboxgl.Marker({ element: homeMarker })
    .setLngLat([center.lng, center.lat])
    .addTo(state.map);
  
  // Add mock driver markers
  MOCK_DRIVERS.forEach((driver, index) => {
    const offset = 0.02 + (index * 0.01);
    const angle = (index * 72) * Math.PI / 180; // Spread around the center
    
    const driverLng = center.lng + offset * Math.cos(angle);
    const driverLat = center.lat + offset * Math.sin(angle);
    
    const driverMarker = document.createElement('div');
    driverMarker.className = 'driver-marker';
    driverMarker.innerHTML = '🚗';
    driverMarker.title = driver.name;
    
    new mapboxgl.Marker({ element: driverMarker })
      .setLngLat([driverLng, driverLat])
      .addTo(state.map);
  });
}

function displayNearbyDrivers() {
  const list = document.getElementById('nearbyDriversList');
  
  list.innerHTML = MOCK_DRIVERS.slice(0, 3).map(driver => `
    <div class="driver-card">
      <div class="driver-photo">${driver.photo}</div>
      <div class="driver-info">
        <div class="driver-name">${driver.name}</div>
        <div class="driver-vehicle">${driver.vehicle}</div>
        <div class="driver-stats">
          <span class="rating">⭐ ${driver.rating}</span>
          <span class="trips">${driver.trips} trips</span>
        </div>
      </div>
      <div class="driver-distance">${driver.distance} mi</div>
    </div>
  `).join('');
}

// ============================================
// Portal Redirect
// ============================================
function redirectToPortal() {
  const slug = state.customer?.portal_slug || 
    `${state.customer?.first_name || ''}_${state.customer?.last_name || ''}`.replace(/[^a-zA-Z0-9]/g, '_');
  
  window.location.href = `/${slug}`;
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
