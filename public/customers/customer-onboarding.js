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
  selectedAirport: null,
  cellPhone: null,
  cellPhoneFormatted: null,
  paymentMethod: null,
  skipPayment: false,
  
  // UI state
  iti: null, // intl-tel-input instance
  map: null,
  addressAutocomplete: null,
  nearbyAirports: [],
  
  // OTP verification state
  otpCode: null,
  otpExpiry: null,
  otpAttempts: 0,
  otpResendTimer: null,
  phoneVerified: false
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
  document.getElementById('airportSuggestionText')?.classList.add('hidden');
  const display = document.getElementById('selectedAirportDisplay');
  display.classList.remove('hidden');
  document.getElementById('selectedAirportName').textContent = `${airport.code} - ${airport.name}`;
  
  // Add change button handler
  document.getElementById('changeAirportBtn').addEventListener('click', () => {
    state.selectedAirport = null;
    display.classList.add('hidden');
    document.getElementById('nearbyAirportsList').classList.remove('hidden');
    document.getElementById('airportSuggestionText')?.classList.remove('hidden');
  });
  
  showToast(`Selected ${airport.code} as your home airport!`, 'success');
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
    
    // Ensure we have customer data
    if (!state.customer) {
      // Try to reload customer from CustomerAuth or localStorage
      state.customer = CustomerAuth.getCustomer();
      if (!state.customer) {
        const storedCustomer = localStorage.getItem('current_customer');
        if (storedCustomer) {
          state.customer = JSON.parse(storedCustomer);
        }
      }
    }
    
    // If still no customer, show error
    if (!state.customer || !state.customer.email) {
      throw new Error('Session expired. Please log in again.');
    }
    
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
    style: 'mapbox://styles/mapbox/streets-v12',
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
    driverMarker.innerHTML = '�';
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
  // Try to get slug from CustomerAuth first, then state
  let slug = CustomerAuth.getPortalSlug() || state.customer?.portal_slug;
  
  // Generate from name if not available
  if (!slug && state.customer?.first_name && state.customer?.last_name) {
    slug = `${state.customer.first_name}_${state.customer.last_name}`.toLowerCase().replace(/[^a-z0-9_]/g, '');
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
