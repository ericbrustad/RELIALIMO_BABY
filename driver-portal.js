/**
 * RELIALIMO Driver Portal
 * Mobile-friendly app for drivers to register, view trips, and update status
 */

console.log('[DriverPortal] Script loading...');

// Global error handler
window.addEventListener('error', (e) => {
  console.error('[DriverPortal] Global error:', e.message, e.filename, e.lineno);
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('[DriverPortal] Unhandled promise rejection:', e.reason);
});

// Dynamic imports to handle module loading failures gracefully
let apiService = null;

// Get supabase client via api-service's getSupabaseClient()
function getSupabase() {
  if (apiService?.getSupabaseClient) {
    return apiService.getSupabaseClient();
  }
  console.warn('[DriverPortal] getSupabaseClient not available');
  return null;
}

async function loadModules() {
  try {
    console.log('[DriverPortal] Loading api-service module...');
    apiService = await import('./api-service.js');
    console.log('[DriverPortal] API service loaded');
    
    // Initialize API if available
    if (apiService.setupAPI) {
      await apiService.setupAPI();
      console.log('[DriverPortal] API initialized');
    }
    
    // Verify supabase client is available
    const client = getSupabase();
    console.log('[DriverPortal] Supabase client available:', !!client);
  } catch (err) {
    console.error('[DriverPortal] Failed to load api-service.js:', err);
  }
}

// Helper functions that wrap API calls with fallbacks
async function fetchDrivers() {
  if (apiService?.fetchDrivers) {
    return await apiService.fetchDrivers();
  }
  console.warn('[DriverPortal] fetchDrivers not available');
  return [];
}

async function createDriver(data) {
  if (apiService?.createDriver) {
    return await apiService.createDriver(data);
  }
  throw new Error('createDriver not available');
}

async function updateDriver(id, data) {
  if (apiService?.updateDriver) {
    return await apiService.updateDriver(id, data);
  }
  throw new Error('updateDriver not available');
}

async function fetchVehicleTypesFromAPI() {
  try {
    // First try using the api-service which handles org context properly
    if (apiService?.fetchVehicleTypes) {
      console.log('[DriverPortal] Using api-service to fetch vehicle types...');
      try {
        const types = await apiService.fetchVehicleTypes({ includeInactive: true }); // Include all, we'll filter ourselves
        console.log('[DriverPortal] Vehicle types from api-service:', types);
        
        // If we got results, return them
        if (types && types.length > 0) {
          console.log('[DriverPortal] ✅ Got', types.length, 'types from api-service');
          return types;
        }
        
        console.log('[DriverPortal] ⚠️ api-service returned empty array, trying direct fetch...');
      } catch (apiErr) {
        console.warn('[DriverPortal] ❌ api-service fetch failed:', apiErr.message);
      }
    }
    
    // Fallback to direct fetch with anon key
    const orgId = window.ENV?.FORCE_VEHICLE_ORG_ID || null;
    console.log('[DriverPortal] 🔄 Direct fetch: Fetching vehicle types for org:', orgId);
    
    const supabaseUrl = window.ENV?.SUPABASE_URL;
    const supabaseKey = window.ENV?.SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('[DriverPortal] ❌ Missing Supabase credentials in ENV');
      return [];
    }
    
    // Try with org filter first
    let url = `${supabaseUrl}/rest/v1/vehicle_types?select=*&order=name.asc`;
    if (orgId) {
      url += `&organization_id=eq.${orgId}`;
    }
    
    console.log('[DriverPortal] Querying (with org filter):', url);
    
    const response = await fetch(url, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    let data = [];
    if (response.ok) {
      data = await response.json();
      console.log('[DriverPortal] ✅ Got', data?.length || 0, 'vehicle types with org filter');
    } else {
      console.warn('[DriverPortal] ⚠️ Org-filtered query failed (' + response.status + '), trying without filter...');
    }
    
    // If org-filtered query failed or returned nothing, try without org filter for debugging
    if (!response.ok || !data || data.length === 0) {
      const debugUrl = `${supabaseUrl}/rest/v1/vehicle_types?select=*&order=name.asc&limit=10`;
      console.log('[DriverPortal] 🐛 DEBUG: Querying all types (no filter):', debugUrl);
      try {
        const debugResponse = await fetch(debugUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json'
          }
        });
        if (debugResponse.ok) {
          const debugData = await debugResponse.json();
          console.log('[DriverPortal] 🐛 DEBUG: All vehicle types in DB (first 10):', debugData);
          if (!debugData || debugData.length === 0) {
            console.error('[DriverPortal] ❌ NO vehicle types found in database at all! Need to create them in my-office admin.');
          } else {
            console.log('[DriverPortal] Found', debugData.length, 'total types - filtered query may have been too restrictive');
            // Return all types if org filter failed - driver can still see them
            data = debugData;
          }
        } else {
          console.error('[DriverPortal] Debug query failed:', debugResponse.status);
        }
      } catch (debugErr) {
        console.error('[DriverPortal] 🐛 Debug query error:', debugErr.message);
      }
    }
    
    console.log('[DriverPortal] Returning', data?.length || 0, 'vehicle types');
    return data || [];
  } catch (err) {
    console.error('[DriverPortal] ❌ Fatal error in fetchVehicleTypesFromAPI:', err);
    return [];
  }
}

async function createVehicle(vehicleData) {
  // Create vehicle directly via Supabase since api-service doesn't export this
  const client = getSupabase();
  if (!client) {
    throw new Error('Supabase not initialized');
  }
  
  // Ensure we have a UUID for the vehicle
  const payload = {
    ...vehicleData,
    id: vehicleData.id || crypto.randomUUID()
  };
  
  console.log('[DriverPortal] Creating vehicle:', payload);
  
  const { data, error } = await client
    .from('vehicles')
    .insert([payload])
    .select()
    .single();
  
  if (error) {
    console.error('[DriverPortal] Vehicle creation error:', error);
    throw error;
  }
  
  console.log('[DriverPortal] Vehicle created:', data);
  return data;
}

// Helper functions for affiliate lookup/creation
async function fetchAffiliates() {
  if (apiService?.fetchAffiliates) {
    return await apiService.fetchAffiliates();
  }
  console.warn('[DriverPortal] fetchAffiliates not available');
  return [];
}

async function createAffiliate(affiliateData) {
  if (apiService?.createAffiliate) {
    return await apiService.createAffiliate(affiliateData);
  }
  throw new Error('createAffiliate not available');
}

// Find or create affiliate by company name
async function findOrCreateAffiliate(companyName, affiliateInfo) {
  if (!companyName || !companyName.trim()) {
    console.log('[DriverPortal] No company name provided, skipping affiliate association');
    return null;
  }
  
  const normalizedName = companyName.trim().toLowerCase();
  console.log('[DriverPortal] Looking for affiliate with name:', companyName);
  
  try {
    // Fetch existing affiliates
    const affiliates = await fetchAffiliates();
    
    // Find matching affiliate (case-insensitive)
    const existingAffiliate = (affiliates || []).find(a => 
      (a.company_name || '').trim().toLowerCase() === normalizedName
    );
    
    if (existingAffiliate) {
      console.log('[DriverPortal] ✅ Found existing affiliate:', existingAffiliate.id, existingAffiliate.company_name);
      return existingAffiliate;
    }
    
    // Create new affiliate
    console.log('[DriverPortal] Creating new affiliate:', companyName);
    const organizationId = window.ENV?.FORCE_VEHICLE_ORG_ID || null;
    
    const newAffiliateData = {
      company_name: companyName.trim(),
      organization_id: organizationId,
      status: 'ACTIVE',
      is_active: true,
      primary_address: affiliateInfo?.address || null,
      city: affiliateInfo?.city || null,
      state: affiliateInfo?.state || null,
      postal_code: affiliateInfo?.zip || null,
      primary_phone: affiliateInfo?.phone || null
    };
    
    const newAffiliate = await createAffiliate(newAffiliateData);
    
    if (newAffiliate) {
      console.log('[DriverPortal] ✅ Created new affiliate:', newAffiliate.id, newAffiliate.company_name);
      return newAffiliate;
    }
    
    console.warn('[DriverPortal] Failed to create affiliate');
    return null;
  } catch (err) {
    console.error('[DriverPortal] Error in findOrCreateAffiliate:', err);
    return null;
  }
}

// Fetch a driver record by portal slug (e.g., driver.relialimo.com/<slug>)
async function fetchDriverBySlug(slug) {
  if (!slug) return null;
  const client = getSupabase();
  if (!client) {
    console.warn('[DriverPortal] Supabase client not available for slug lookup');
    return null;
  }

  try {
    // Use maybeSingle() to avoid throwing if not found (depends on supabase client version)
    const { data, error } = await client.from('drivers').select('*').eq('portal_slug', slug).maybeSingle();
    if (error) {
      // Non-fatal: return null if not found
      console.warn('[DriverPortal] fetchDriverBySlug returned error:', error.message || error);
      return null;
    }

    if (!data) return null;
    console.log('[DriverPortal] fetchDriverBySlug found:', data.id);
    return data;
  } catch (err) {
    console.warn('[DriverPortal] fetchDriverBySlug error:', err?.message || err);
    return null;
  }
}

const state = {
  currentScreen: 'loading',
  driver: null,
  driverId: null,
  trips: {
    offered: [],
    upcoming: [],
    active: null
  },
  vehicleTypes: [],
  activeTimer: null,
  timerStartTime: null
};

// ============================================
// DOM Elements
// ============================================
const screens = {
  loading: document.getElementById('loadingScreen'),
  auth: document.getElementById('authScreen'),
  dashboard: document.getElementById('dashboardScreen')
};

const elements = {
  // Auth
  loginForm: document.getElementById('loginForm'),
  registerForm: document.getElementById('registerForm'),
  loginBtn: document.getElementById('loginBtn'),
  showRegisterBtn: document.getElementById('showRegisterBtn'),
  showLoginBtn: document.getElementById('showLoginBtn'),
  
  // Registration steps
  regNextStep1: document.getElementById('regNextStep1'),
  regNextStep2: document.getElementById('regNextStep2'),
  regBackStep2: document.getElementById('regBackStep2'),
  regBackStep3: document.getElementById('regBackStep3'),
  regSubmit: document.getElementById('regSubmit'),

  // Email verification flow
  verifyEmailScreen: document.getElementById('verifyEmailScreen'),
  verifyEmailAddress: document.getElementById('verifyEmailAddress'),
  verifyResendBtn: document.getElementById('verifyResendBtn'),
  verifyContinueBtn: document.getElementById('verifyContinueBtn'),
  
  // Dashboard
  driverName: document.getElementById('driverName'),
  driverAvatar: document.getElementById('driverAvatar'),
  driverStatusBadge: document.getElementById('driverStatusBadge'),
  
  // Tabs
  tabs: document.querySelectorAll('.tab'),
  tabPanels: document.querySelectorAll('.tab-panel'),
  offeredBadge: document.getElementById('offeredBadge'),
  upcomingBadge: document.getElementById('upcomingBadge'),
  activeBadge: document.getElementById('activeBadge'),
  
  // Trip lists
  offeredList: document.getElementById('offeredList'),
  upcomingList: document.getElementById('upcomingList'),
  activeTripCard: document.getElementById('activeTripCard'),
  
  // Empty states
  offeredEmpty: document.getElementById('offeredEmpty'),
  upcomingEmpty: document.getElementById('upcomingEmpty'),
  activeEmpty: document.getElementById('activeEmpty'),
  
  // Modals
  tripDetailModal: document.getElementById('tripDetailModal'),
  tripDetailBody: document.getElementById('tripDetailBody'),
  tripDetailFooter: document.getElementById('tripDetailFooter'),
  closeTripDetail: document.getElementById('closeTripDetail'),
  
  statusModal: document.getElementById('statusModal'),
  statusOptions: document.getElementById('statusOptions'),

  // OTP Modal elements
  otpModal: document.getElementById('otpModal'),
  otpPhoneDisplay: document.getElementById('otpPhoneDisplay'),
  otpCodeInput: document.getElementById('otpCodeInput'),
  otpResendBtn: document.getElementById('otpResendBtn'),
  otpVerifyBtn: document.getElementById('otpVerifyBtn'),
  otpMessage: document.getElementById('otpMessage'),
  otpCloseBtn: document.getElementById('otpCloseBtn'),
  closeStatusModal: document.getElementById('closeStatusModal'),
  
  postTripModal: document.getElementById('postTripModal'),
  submitPostTrip: document.getElementById('submitPostTrip'),
  
  // Menu
  menuBtn: document.getElementById('menuBtn'),
  menuSidebar: document.getElementById('menuSidebar'),
  menuOverlay: document.getElementById('menuOverlay'),
  menuLogout: document.getElementById('menuLogout'),
  menuDeleteAccount: document.getElementById('menuDeleteAccount'),
  sidebarName: document.getElementById('sidebarName'),
  sidebarEmail: document.getElementById('sidebarEmail'),
  sidebarAvatar: document.getElementById('sidebarAvatar'),
  
  // Delete Account Modal
  deleteAccountModal: document.getElementById('deleteAccountModal'),
  deleteConfirmEmail: document.getElementById('deleteConfirmEmail'),
  cancelDeleteBtn: document.getElementById('cancelDeleteBtn'),
  confirmDeleteBtn: document.getElementById('confirmDeleteBtn'),
  
  // FAB
  fabRefresh: document.getElementById('fabRefresh'),
  
  // Toast
  toast: document.getElementById('toast')
};

// ============================================
// Status Configuration
// ============================================
const STATUS_META = {
  available: { emoji: '🟢', label: 'Available', color: 'available' },
  enroute: { emoji: '🟡', label: 'On the Way', color: 'enroute' },
  arrived: { emoji: '🟠', label: 'Arrived', color: 'arrived' },
  passenger_onboard: { emoji: '🔵', label: 'Passenger On Board', color: 'onboard' },
  completed: { emoji: '✅', label: 'Completed', color: 'completed' },
  busy: { emoji: '🔴', label: 'Busy', color: 'busy' },
  offline: { emoji: '⚫', label: 'Offline', color: 'offline' }
};

const STATUS_TRANSITIONS = {
  // What statuses are available from each status
  available: ['enroute'],
  enroute: ['arrived'],
  arrived: ['passenger_onboard'],
  passenger_onboard: ['completed']
};

// ============================================
// Initialization
// ============================================
async function init() {
  console.log('[DriverPortal] Initializing...');
  
  try {
    // Load modules first
    console.log('[DriverPortal] Loading modules...');
    await loadModules();
    console.log('[DriverPortal] Modules loaded');
    
    // Check for saved session
    const savedDriverId = localStorage.getItem('driver_portal_id');
    console.log('[DriverPortal] Saved driver ID:', savedDriverId);
    
    if (savedDriverId) {
      // Try to restore session
      try {
        console.log('[DriverPortal] Attempting to restore session...');
        const driver = await loadDriver(savedDriverId);
        if (driver) {
          console.log('[DriverPortal] Session restored for:', driver.first_name);
          state.driver = driver;
          state.driverId = savedDriverId;
          await loadDashboard();
          showScreen('dashboard');

          // If phone not verified, prompt OTP
          try {
            if (!state.driver.phone_verified) {
              const phoneToVerify = state.driver.cell_phone || state.driver.phone || null;
              if (phoneToVerify) {
                await requestPhoneOtp(phoneToVerify, state.driverId);
                showOtpModal(phoneToVerify);
              }
            }
          } catch (otpErr) {
            console.warn('[DriverPortal] OTP trigger on restore failed:', otpErr);
          }

          return;
        }
      } catch (err) {
        console.warn('[DriverPortal] Failed to restore session:', err);
        localStorage.removeItem('driver_portal_id');
      }
    }

    // If no saved session, check for driver slug in the URL path when using the driver subdomain
    if (!state.driverId && window.location.hostname && window.location.hostname.startsWith('driver.')) {
      try {
        const slug = (window.location.pathname || '').split('/').filter(Boolean)[0];
        if (slug) {
          console.log('[DriverPortal] Detected driver slug in URL:', slug);
          const bySlug = await fetchDriverBySlug(slug);
          if (bySlug) {
            console.log('[DriverPortal] Resolved driver by slug:', bySlug.id);
            state.driver = bySlug;
            state.driverId = String(bySlug.id);
            localStorage.setItem('driver_portal_id', state.driverId);
            await loadDashboard();
            showScreen('dashboard');
            return;
          } else {
            console.warn('[DriverPortal] No driver found for slug:', slug);
          }
        }
      } catch (err) {
        console.warn('[DriverPortal] Error resolving driver slug:', err);
      }
    }
    
    // No valid session, show auth
    console.log('[DriverPortal] No session, loading vehicle types...');
    try {
      await loadVehicleTypes();
    } catch (err) {
      console.warn('[DriverPortal] Failed to load vehicle types:', err);
      // Continue anyway - we can still show auth screen
    }
    
    console.log('[DriverPortal] Showing auth screen');
    showScreen('auth');
    
  } catch (err) {
    console.error('[DriverPortal] Critical init error:', err);
    // Fallback: show auth screen even on error
    showScreen('auth');
  }
}

// Wait for DOM and initialize
document.addEventListener('DOMContentLoaded', () => {
  console.log('[DriverPortal] DOM loaded, setting up...');
  try {
    setupEventListeners();
    console.log('[DriverPortal] Event listeners attached');
  } catch (err) {
    console.error('[DriverPortal] Failed to setup event listeners:', err);
  }
  setTimeout(init, 1000); // Show loading for 1 second
});

// ============================================
// Event Listeners
// ============================================
function setupEventListeners() {
  // Auth toggles
  elements.showRegisterBtn?.addEventListener('click', async () => {
    elements.loginForm.classList.remove('active');
    elements.registerForm.classList.add('active');
    // Ensure vehicle types are loaded for registration
    await loadVehicleTypes();
  });
  
  elements.showLoginBtn?.addEventListener('click', () => {
    elements.registerForm.classList.remove('active');
    elements.loginForm.classList.add('active');
  });
  
  // Login
  elements.loginBtn?.addEventListener('click', handleLogin);
  
  // Registration navigation
  elements.regNextStep1?.addEventListener('click', async () => {
    // Step 1 now performs email sign-up and shows verification screen
    if (!validateRegStep(1)) return;
    const email = document.getElementById('regEmail').value.trim().toLowerCase();
    const password = document.getElementById('regPassword').value;
    const firstName = document.getElementById('regFirstName').value.trim();
    const lastName = document.getElementById('regLastName').value.trim();

    elements.regNextStep1.disabled = true;
    elements.regNextStep1.textContent = 'Sending verification...';

    try {
      // Sign up via Supabase
      const client = getSupabase();
      if (!client) throw new Error('Auth client not available');

      const { data, error } = await client.auth.signUp({ email, password }, { data: { first_name: firstName, last_name: lastName } });
      if (error) {
        console.error('[DriverPortal] signUp error:', error.message || error);
        showToast(error.message || 'Sign up failed', 'error');
        return;
      }

      // Show verification screen
      elements.verifyEmailAddress.textContent = email;
      elements.verifyEmailScreen.style.display = 'block';
      goToRegStep(0); // hide other steps (helper function should handle UI)

      // Save sign-up data locally until verification completes
      pendingRegistration.email = email;
      pendingRegistration.password = password;
      pendingRegistration.firstName = firstName;
      pendingRegistration.lastName = lastName;
      pendingRegistration.phone = document.getElementById('regPhone').value.trim();

      showToast('Verification email sent. Check your inbox.', 'info');
    } catch (err) {
      console.error('[DriverPortal] signUp flow failed:', err);
      showToast(err?.message || 'Sign up failed', 'error');
    } finally {
      elements.regNextStep1.disabled = false;
      elements.regNextStep1.textContent = 'Continue →';
    }
  });
  elements.regNextStep2?.addEventListener('click', () => goToRegStep(3));

  // Verify screen actions
  elements.verifyResendBtn?.addEventListener('click', async () => {
    try {
      const email = pendingRegistration.email;
      if (!email) return;
      // Send magic sign-in link as a resend alternative
      const client = getSupabase();
      if (!client) throw new Error('Auth client not available');
      await client.auth.signInWithOtp({ email });
      showToast('Sent magic sign-in link to your email. Use that to sign in.', 'info');
    } catch (err) {
      console.error('[DriverPortal] Resend verification failed:', err);
      showToast('Resend failed', 'error');
    }
  });

  elements.verifyContinueBtn?.addEventListener('click', async () => {
    try {
      const email = pendingRegistration.email;
      const password = pendingRegistration.password;
      if (!email || !password) {
        showToast('No pending signup found', 'error');
        return;
      }
      const client = getSupabase();
      if (!client) throw new Error('Auth client not available');

      // Attempt a password sign-in which will succeed after email confirm
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) {
        console.error('[DriverPortal] signIn after verify failed:', error.message || error);
        showToast(error.message || 'Sign in failed. Make sure you clicked the verification link.', 'error');
        return;
      }

      // We are signed in — proceed with onboarding (company & vehicle steps)
      // Prefill the forms from pendingRegistration
      document.getElementById('regFirstName').value = pendingRegistration.firstName || '';
      document.getElementById('regLastName').value = pendingRegistration.lastName || '';
      document.getElementById('regEmail').value = pendingRegistration.email || '';
      document.getElementById('regPhone').value = pendingRegistration.phone || '';

      // Move to company info step
      elements.verifyEmailScreen.style.display = 'none';
      goToRegStep(2);
      showToast('Email verified. Continue onboarding.', 'success');
    } catch (err) {
      console.error('[DriverPortal] verifyContinue failed:', err);
      showToast('Verification check failed', 'error');
    }
  });
  elements.regBackStep2?.addEventListener('click', () => goToRegStep(1));
  elements.regBackStep3?.addEventListener('click', () => goToRegStep(2));
  elements.regSubmit?.addEventListener('click', handleRegistration);
  
  // Tabs
  elements.tabs.forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });
  
  // Menu
  elements.menuBtn?.addEventListener('click', toggleMenu);
  elements.menuOverlay?.addEventListener('click', closeMenu);
  elements.menuLogout?.addEventListener('click', handleLogout);
  elements.menuDeleteAccount?.addEventListener('click', showDeleteAccountModal);
  
  // Delete Account Modal
  elements.cancelDeleteBtn?.addEventListener('click', () => closeModal('deleteAccountModal'));
  elements.confirmDeleteBtn?.addEventListener('click', handleDeleteAccount);
  
  // Modals
  elements.closeTripDetail?.addEventListener('click', () => closeModal('tripDetailModal'));
  elements.closeStatusModal?.addEventListener('click', () => closeModal('statusModal'));
  elements.submitPostTrip?.addEventListener('click', handlePostTripSubmit);
  
  // FAB
  elements.fabRefresh?.addEventListener('click', refreshTrips);
  
  // Password show/hide toggles
  document.querySelectorAll('.btn-show-password').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      const input = document.getElementById(targetId);
      if (input) {
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        btn.classList.toggle('active', isPassword);
        btn.querySelector('.eye-icon').textContent = isPassword ? '🙈' : '👁️';
      }
    });
  });
  
  // Close modals on backdrop click
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal(modal.id);
    });
  });
}

// ============================================
// Screen Management
// ============================================
function showScreen(screenName) {
  Object.values(screens).forEach(screen => screen?.classList.remove('active'));
  screens[screenName]?.classList.add('active');
  state.currentScreen = screenName;
}

// ============================================
// Authentication
// ============================================
async function handleLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  
  if (!email || !password) {
    showToast('Please enter email and password', 'error');
    return;
  }
  
  elements.loginBtn.disabled = true;
  elements.loginBtn.textContent = 'Signing in...';
  
  try {
    // Find driver by email
    const drivers = await fetchDrivers();
    const driver = drivers.find(d => d.email?.toLowerCase() === email.toLowerCase());
    
    if (!driver) {
      throw new Error('No driver found with this email');
    }
    
    // For now, accept any password (you'd implement proper auth)
    // In production, use Supabase Auth or similar
    
    state.driver = driver;
    state.driverId = driver.id;
    localStorage.setItem('driver_portal_id', driver.id);
    
    await loadDashboard();
    showScreen('dashboard');
    showToast('Welcome back, ' + (driver.first_name || 'Driver') + '!', 'success');
    
  } catch (err) {
    console.error('[DriverPortal] Login error:', err);
    showToast(err.message || 'Login failed', 'error');
  } finally {
    elements.loginBtn.disabled = false;
    elements.loginBtn.textContent = 'Sign In';
  }
}

async function handleLogout(e) {
  e?.preventDefault();
  localStorage.removeItem('driver_portal_id');
  state.driver = null;
  state.driverId = null;
  state.trips = { offered: [], upcoming: [], active: null };
  closeMenu();
  showScreen('auth');
  showToast('Signed out successfully', 'success');
}

// ============================================
// Delete Account (Testing Feature)
// ============================================
function showDeleteAccountModal(e) {
  e?.preventDefault();
  closeMenu();
  
  // Clear the confirmation input
  if (elements.deleteConfirmEmail) {
    elements.deleteConfirmEmail.value = '';
  }
  
  openModal('deleteAccountModal');
}

async function handleDeleteAccount() {
  const confirmEmail = elements.deleteConfirmEmail?.value?.trim()?.toLowerCase();
  const driverEmail = state.driver?.email?.toLowerCase();
  
  if (!confirmEmail || confirmEmail !== driverEmail) {
    showToast('Email does not match. Please enter your email to confirm.', 'error');
    return;
  }
  
  elements.confirmDeleteBtn.disabled = true;
  elements.confirmDeleteBtn.textContent = 'Deleting...';
  
  try {
    const client = getSupabase();
    if (!client) {
      throw new Error('Database not available');
    }
    
    const driverId = state.driverId;
    
    // First, delete any vehicles associated with this driver
    console.log('[DriverPortal] Deleting vehicles for driver:', driverId);
    const { error: vehicleError } = await client
      .from('vehicles')
      .delete()
      .eq('assigned_driver_id', driverId);
    
    if (vehicleError) {
      console.warn('[DriverPortal] Vehicle deletion warning:', vehicleError);
      // Continue anyway - vehicle might not exist
    }
    
    // Delete driver record
    console.log('[DriverPortal] Deleting driver:', driverId);
    const { error: driverError } = await client
      .from('drivers')
      .delete()
      .eq('id', driverId);
    
    if (driverError) {
      throw driverError;
    }
    
    // Clear session
    localStorage.removeItem('driver_portal_id');
    state.driver = null;
    state.driverId = null;
    state.trips = { offered: [], upcoming: [], active: null };
    
    closeModal('deleteAccountModal');
    showScreen('auth');
    showToast('Account deleted successfully. You can now register again.', 'success');
    
  } catch (err) {
    console.error('[DriverPortal] Delete account error:', err);
    showToast(err.message || 'Failed to delete account', 'error');
  } finally {
    elements.confirmDeleteBtn.disabled = false;
    elements.confirmDeleteBtn.textContent = '🗑️ Delete My Account';
  }
}

// ============================================
// Registration
// ============================================
function goToRegStep(step) {
  // Validate current step before proceeding
  if (step > 1) {
    const currentStep = document.querySelector('.register-step.active');
    const stepNum = parseInt(currentStep.id.replace('registerStep', ''));
    
    if (step > stepNum && !validateRegStep(stepNum)) {
      return;
    }
  }
  
  // Hide all steps
  document.querySelectorAll('.register-step').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.step-indicator .step').forEach(s => {
    s.classList.remove('active', 'completed');
  });
  
  // Show target step
  document.getElementById(`registerStep${step}`).classList.add('active');
  
  // Update step indicators
  for (let i = 1; i <= 3; i++) {
    const indicator = document.querySelector(`.step-indicator .step[data-step="${i}"]`);
    if (i < step) indicator.classList.add('completed');
    if (i === step) indicator.classList.add('active');
  }
}

function validateRegStep(step) {
  if (step === 1) {
    const firstName = document.getElementById('regFirstName').value.trim();
    const lastName = document.getElementById('regLastName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const phone = document.getElementById('regPhone').value.trim();
    const password = document.getElementById('regPassword').value;
    
    if (!firstName || !lastName) {
      showToast('Please enter your name', 'error');
      return false;
    }
    if (!email || !email.includes('@')) {
      showToast('Please enter a valid email', 'error');
      return false;
    }
    if (!phone) {
      showToast('Please enter your phone number', 'error');
      return false;
    }
    if (!password || password.length < 6) {
      showToast('Password must be at least 6 characters', 'error');
      return false;
    }
  }
  return true;
}

// Pending registration buffer while user verifies email
const pendingRegistration = {
  email: null,
  password: null,
  firstName: null,
  lastName: null,
  phone: null
};

async function handleRegistration() {
  const vehicleType = document.getElementById('regVehicleType').value;
  const licensePlate = document.getElementById('regVehiclePlate').value.trim();
  
  if (!vehicleType) {
    showToast('Please select a vehicle type', 'error');
    return;
  }
  if (!licensePlate) {
    showToast('Please enter license plate', 'error');
    return;
  }
  
  elements.regSubmit.disabled = true;
  elements.regSubmit.textContent = 'Creating Account...';
  
  try {
    const client = getSupabase();
    if (!client) throw new Error('Auth client not available. Please verify your email and sign in.');

    // Ensure the user is signed in (after email verification)
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError) console.warn('[DriverPortal] getSession warning:', sessionError.message || sessionError);
    const user = (sessionData?.session && sessionData.session.user) || sessionData?.user || null;
    if (!user) {
      throw new Error('Please verify your email and sign in before completing onboarding');
    }

    // Get organization ID from ENV
    const organizationId = window.ENV?.FORCE_VEHICLE_ORG_ID || null;
    
    // Get company name for affiliate association
    const companyName = document.getElementById('regCompanyName').value.trim();
    const companyInfo = {
      address: document.getElementById('regCompanyAddress').value.trim() || null,
      city: document.getElementById('regCompanyCity').value.trim() || null,
      state: document.getElementById('regCompanyState').value || null,
      zip: document.getElementById('regCompanyZip').value.trim() || null,
      phone: document.getElementById('regCompanyPhone').value.trim() || null
    };
    
    // Find or create affiliate if company name is provided
    let affiliate = null;
    if (companyName) {
      affiliate = await findOrCreateAffiliate(companyName, companyInfo);
    }
    
    // Collect all registration data - use correct field names per schema
    const firstNameVal = document.getElementById('regFirstName').value.trim();
    const lastNameVal = document.getElementById('regLastName').value.trim();
    const emailVal = document.getElementById('regEmail').value.trim().toLowerCase();

    // Ensure we don't already have a driver record for this auth user
    try {
      const { data: existing } = await client.from('drivers').select('id').eq('id', user.id).limit(1);
      if (Array.isArray(existing) && existing.length > 0) {
        throw new Error('Driver profile already exists for this account. Try signing in.');
      }
    } catch (e) {
      // If the select failed because of permissions or other, continue — the insert will enforce uniqueness
      console.warn('[DriverPortal] driver existence check warning:', e?.message || e);
    }

    const driverData = {
      id: user.id, // important for RLS
      first_name: firstNameVal,
      last_name: lastNameVal,
      display_name: `${firstNameVal} ${lastNameVal}`.trim(),
      email: user.email || emailVal,
      cell_phone: formatPhone(document.getElementById('regPhone').value),
      driver_status: 'available',
      status: 'ACTIVE',
      type: 'FULL TIME',
      organization_id: organizationId,
      portal_slug: slugify(`${firstNameVal}-${lastNameVal}`) || null,
      // Company info (optional) - use correct schema field names from VALID_DRIVER_COLUMNS
      primary_address: companyInfo.address,
      city: companyInfo.city,
      state: companyInfo.state,
      postal_code: companyInfo.zip,
      home_phone: companyInfo.phone,
      // Affiliate association - link driver to their company
      affiliate_id: affiliate?.id || null,
      affiliate_name: affiliate?.company_name || null
    };
    
    console.log('[DriverPortal] Creating driver with affiliate:', affiliate?.company_name || 'None');
    
    // Check if email already exists
    const existingDrivers = await fetchDrivers();
    if (existingDrivers.some(d => d.email?.toLowerCase() === driverData.email)) {
      throw new Error('An account with this email already exists');
    }
    
    // Create driver
    const newDriver = await createDriver(driverData);

    // If signups are disabled, createDriver returns {_application_submitted: true, application}
    if (newDriver && newDriver._application_submitted) {
      // Notify the applicant and stop further onboarding steps (vehicles, etc.)
      alert('Thanks — your application has been submitted. Our team will review and create your account. You will receive an email when it is ready.');
      console.log('[DriverPortal] Driver application submitted:', newDriver.application);
      return newDriver;
    }

    if (!newDriver || !newDriver.id) {
      throw new Error('Failed to create driver account');
    }

    console.log('[DriverPortal] ✅ Driver created:', newDriver.id, 'with affiliate_id:', newDriver.affiliate_id);
    
    // Create vehicle - generate a unit number from license plate or random
    const unitNumber = licensePlate.replace(/[^A-Z0-9]/gi, '').slice(-6) || 
                       Math.floor(100000 + Math.random() * 900000).toString();
    
    const vehicleData = {
      assigned_driver_id: newDriver.id,
      organization_id: organizationId,
      vehicle_type_id: vehicleType,
      unit_number: unitNumber,
      make: document.getElementById('regVehicleMake').value.trim() || null,
      model: document.getElementById('regVehicleModel').value.trim() || null,
      year: parseInt(document.getElementById('regVehicleYear').value) || null,
      color: document.getElementById('regVehicleColor').value.trim() || null,
      license_plate: licensePlate,
      passenger_capacity: parseInt(document.getElementById('regVehicleCapacity').value) || 4,
      status: 'ACTIVE'
    };
    
    const createdVehicle = await createVehicle(vehicleData);
    
    // Update driver with assigned vehicle ID
    if (createdVehicle && createdVehicle.id) {
      console.log('[DriverPortal] Updating driver with assigned_vehicle_id:', createdVehicle.id);
      try {
        await updateDriver(newDriver.id, { assigned_vehicle_id: createdVehicle.id });
        newDriver.assigned_vehicle_id = createdVehicle.id;
        console.log('[DriverPortal] ✅ Driver updated with vehicle assignment');
      } catch (updateErr) {
        console.warn('[DriverPortal] ⚠️ Could not update driver with vehicle:', updateErr.message);
        // Non-fatal - driver was still created successfully
      }
    }
    
    // Log in the new driver
    state.driver = newDriver;
    state.driverId = newDriver.id;
    localStorage.setItem('driver_portal_id', newDriver.id);
    
    await loadDashboard();
    showScreen('dashboard');
    showToast('Account created successfully! Welcome!', 'success');

    // Trigger phone verification if needed
    try {
      if (newDriver && !newDriver.phone_verified) {
        const phoneToVerify = newDriver.cell_phone || newDriver.phone || null;
        if (phoneToVerify) {
          await requestPhoneOtp(phoneToVerify, newDriver.id);
          showOtpModal(phoneToVerify);
        }
      }
    } catch (otpErr) {
      console.warn('[DriverPortal] OTP trigger failed:', otpErr);
    }
    
  } catch (err) {
    console.error('[DriverPortal] Registration error:', err);
    showToast(err.message || 'Registration failed', 'error');
  } finally {
    elements.regSubmit.disabled = false;
    elements.regSubmit.textContent = '🚀 Create Account';
  }
}

// -------------------------------
// OTP helpers
// -------------------------------
function showOtpModal(phone) {
  if (!elements.otpModal) return;
  elements.otpPhoneDisplay.innerHTML = `We sent a code to <strong>${phone}</strong>`;
  elements.otpCodeInput.value = '';
  elements.otpMessage.textContent = '';
  elements.otpModal.style.display = 'block';
}

function hideOtpModal() {
  if (!elements.otpModal) return;
  elements.otpModal.style.display = 'none';
}

async function requestPhoneOtp(phone, userId) {
  try {
    const res = await fetch('/api/otp/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, user_id: userId })
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error || 'OTP request failed');
    elements.otpMessage.textContent = 'OTP sent — check your messages';
    return true;
  } catch (err) {
    console.error('[DriverPortal] requestPhoneOtp failed:', err);
    elements.otpMessage.textContent = 'Failed to send OTP. Try again later.';
    return false;
  }
}

async function verifyPhoneOtp(code, userId) {
  try {
    const res = await fetch('/api/otp/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, code })
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error || 'OTP verify failed');
    elements.otpMessage.textContent = 'Phone verified!';

    // Update local state / server driver record
    try {
      await updateDriver(userId, { phone_verified: true });
      state.driver = { ...state.driver, phone_verified: true };
    } catch (e) {
      console.warn('[DriverPortal] Could not update driver phone_verified locally:', e.message);
    }

    setTimeout(() => hideOtpModal(), 1200);
    return true;
  } catch (err) {
    console.error('[DriverPortal] verifyPhoneOtp failed:', err);
    elements.otpMessage.textContent = err?.message || 'Invalid code';
    return false;
  }
}

// OTP modal events
if (elements.otpResendBtn) elements.otpResendBtn.addEventListener('click', async () => {
  const phoneText = (elements.otpPhoneDisplay.textContent || '').replace(/We sent a code to\s*/i,'').trim();
  const phone = phoneText.replace(/[^+0-9]/g,'');
  if (!phone || !state.driverId) return;
  elements.otpMessage.textContent = 'Resending...';
  await requestPhoneOtp(phone, state.driverId);
});

if (elements.otpVerifyBtn) elements.otpVerifyBtn.addEventListener('click', async () => {
  const code = elements.otpCodeInput.value.trim();
  if (!code || !state.driverId) return;
  elements.otpMessage.textContent = 'Verifying...';
  await verifyPhoneOtp(code, state.driverId);
});

if (elements.otpCloseBtn) elements.otpCloseBtn.addEventListener('click', () => hideOtpModal());



// ============================================
// Dashboard
// ============================================
async function loadDashboard() {
  if (!state.driver) return;
  
  updateDriverUI();
  await loadVehicleTypes();
  await refreshTrips();
}

function updateDriverUI() {
  const driver = state.driver;
  if (!driver) return;
  
  const fullName = `${driver.first_name || ''} ${driver.last_name || ''}`.trim() || 'Driver';
  const initials = getInitials(fullName);
  const status = driver.driver_status || 'available';
  const statusMeta = STATUS_META[status] || STATUS_META.available;
  
  // Header
  elements.driverName.textContent = fullName;
  elements.driverAvatar.textContent = initials;
  elements.driverStatusBadge.innerHTML = `
    <span class="status-dot ${statusMeta.color}"></span>
    ${statusMeta.label}
  `;
  
  // Sidebar
  elements.sidebarName.textContent = fullName;
  elements.sidebarEmail.textContent = driver.email || '';
  elements.sidebarAvatar.textContent = initials;
}

async function loadDriver(driverId) {
  const drivers = await fetchDrivers();
  return drivers.find(d => d.id === driverId);
}

async function loadVehicleTypes() {
  try {
    console.log('[DriverPortal] Loading vehicle types...');
    const types = await fetchVehicleTypesFromAPI();
    console.log('[DriverPortal] Raw vehicle types:', types);
    
    // Filter for active types (check both uppercase and lowercase)
    let filtered = (types || []).filter(t => {
      const status = (t.status || '').toString().toUpperCase();
      return status === 'ACTIVE' || status === '' || !t.status;
    });
    
    // If no active types found, use all types (for testing/debugging)
    if (filtered.length === 0 && types.length > 0) {
      console.log('[DriverPortal] No ACTIVE types found, using all types for testing');
      filtered = types;
    }
    
    state.vehicleTypes = filtered;
    
    console.log('[DriverPortal] Filtered active types:', state.vehicleTypes);
    console.log('[DriverPortal] Vehicle types count:', state.vehicleTypes.length);
    
    // Populate vehicle type dropdown - clear first to prevent duplicates
    const select = document.getElementById('regVehicleType');
    if (select) {
      // Clear all existing options except the first one
      while (select.options.length > 1) {
        select.remove(1);
      }
      
      console.log('[DriverPortal] Select element found, cleared options');
      
      // Add vehicle type options
      state.vehicleTypes.forEach((t, idx) => {
        console.log(`[DriverPortal] Adding option ${idx}: ${t.name} (${t.id})`);
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = t.name || t.type_name || 'Unknown';
        select.appendChild(opt);
      });
      
      console.log('[DriverPortal] Dropdown now has', select.options.length, 'options');
      
      // Log all options for debugging
      for (let i = 0; i < select.options.length; i++) {
        console.log(`[DriverPortal] Option ${i}: "${select.options[i].text}" = "${select.options[i].value}"`);
      }
    } else {
      console.warn('[DriverPortal] regVehicleType select not found');
    }
    console.log('[DriverPortal] Loaded', state.vehicleTypes.length, 'vehicle types');
  } catch (err) {
    console.error('[DriverPortal] Failed to load vehicle types:', err);
  }
}

async function refreshTrips() {
  if (!state.driverId) return;
  
  elements.fabRefresh.style.animation = 'spin 1s linear infinite';
  
  try {
    // Fetch all reservations assigned to this driver
    let allReservations = [];
    if (apiService?.fetchReservations) {
      allReservations = await apiService.fetchReservations() || [];
    } else {
      console.warn('[DriverPortal] fetchReservations not available');
    }
    
    // Filter reservations for this driver
    // Look at reservation_assignments or multiple possible driver fields
    const myTrips = allReservations.filter(res => {
      // Check if driver is assigned via reservation_assignments (support multiple column names)
      if (res.reservation_assignments?.some(a => a.assigned_driver_user_id === state.driverId || a.assigned_driver_id === state.driverId || a.driver_id === state.driverId)) {
        return true;
      }
      // Or directly on reservation (support multiple possible column names)
      const directDriverId = res.assigned_driver_user_id || res.driver_id || res.driverId || res.assigned_driver_id;
      if (directDriverId === state.driverId) return true;
      return false;
    });
    
    // Categorize trips
    const now = new Date();
    state.trips.offered = [];
    state.trips.upcoming = [];
    state.trips.active = null;
    
    myTrips.forEach(trip => {
      const tripDate = new Date(trip.pickup_date_time || trip.pickup_date);
      const driverStatus = trip.driver_status || 'assigned';
      
      // Active trip (in progress)
      if (['enroute', 'arrived', 'passenger_onboard'].includes(driverStatus)) {
        state.trips.active = trip;
      }
      // Offered but not yet accepted
      else if (driverStatus === 'offered' || trip.status === 'OFFERED') {
        state.trips.offered.push(trip);
      }
      // Upcoming (assigned and in the future)
      else if (driverStatus === 'assigned' || driverStatus === 'available') {
        if (tripDate > now || isSameDay(tripDate, now)) {
          state.trips.upcoming.push(trip);
        }
      }
    });
    
    // Sort by date
    state.trips.offered.sort((a, b) => new Date(a.pickup_date_time) - new Date(b.pickup_date_time));
    state.trips.upcoming.sort((a, b) => new Date(a.pickup_date_time) - new Date(b.pickup_date_time));
    
    // Update UI
    renderTripLists();
    updateBadges();
    
  } catch (err) {
    console.error('[DriverPortal] Failed to refresh trips:', err);
    showToast('Failed to load trips', 'error');
  } finally {
    elements.fabRefresh.style.animation = '';
  }
}

function renderTripLists() {
  // Offered trips
  if (state.trips.offered.length === 0) {
    elements.offeredEmpty.style.display = 'block';
    elements.offeredList.innerHTML = '';
  } else {
    elements.offeredEmpty.style.display = 'none';
    elements.offeredList.innerHTML = state.trips.offered.map(trip => 
      renderTripCard(trip, 'offered')
    ).join('');
  }
  
  // Upcoming trips
  if (state.trips.upcoming.length === 0) {
    elements.upcomingEmpty.style.display = 'block';
    elements.upcomingList.innerHTML = '';
  } else {
    elements.upcomingEmpty.style.display = 'none';
    elements.upcomingList.innerHTML = state.trips.upcoming.map(trip => 
      renderTripCard(trip, 'upcoming')
    ).join('');
  }
  
  // Active trip
  if (!state.trips.active) {
    elements.activeEmpty.style.display = 'block';
    elements.activeTripCard.style.display = 'none';
  } else {
    elements.activeEmpty.style.display = 'none';
    elements.activeTripCard.style.display = 'block';
    renderActiveTripCard(state.trips.active);
  }
  
  // Attach event listeners to cards
  document.querySelectorAll('.trip-card').forEach(card => {
    card.addEventListener('click', () => openTripDetail(card.dataset.tripId));
  });
  
  document.querySelectorAll('.trip-card .btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  });
}

function renderTripCard(trip, type) {
  const pickupDate = formatDate(trip.pickup_date_time || trip.pickup_date);
  const pickupTime = formatTime(trip.pickup_date_time || trip.pickup_time);
  const passengerName = trip.passenger_name || trip.passenger_first_name || 'Passenger';
  const passengerCount = trip.passenger_count || 1;
  
  let footerButtons = '';
  if (type === 'offered') {
    footerButtons = `
      <button class="btn btn-success" onclick="acceptTrip('${trip.id}')">✓ Accept</button>
      <button class="btn btn-secondary" onclick="declineTrip('${trip.id}')">✗ Decline</button>
    `;
  } else if (type === 'upcoming') {
    footerButtons = `
      <button class="btn btn-primary" onclick="startTrip('${trip.id}')">🚗 Start Trip</button>
    `;
  }
  
  return `
    <div class="trip-card" data-trip-id="${trip.id}">
      <div class="trip-card-header">
        <div class="trip-date-time">
          <span class="trip-date">${pickupDate}</span>
          <span class="trip-time">${pickupTime}</span>
        </div>
        <span class="trip-conf">#${trip.confirmation_number || trip.id?.slice(0, 8)}</span>
      </div>
      
      <div class="trip-passenger">
        <div class="trip-passenger-avatar">👤</div>
        <div>
          <div class="trip-passenger-name">${passengerName}</div>
          <div class="trip-passenger-count">${passengerCount} passenger${passengerCount > 1 ? 's' : ''}</div>
        </div>
      </div>
      
      <div class="trip-route">
        <div class="trip-location pickup">
          <span class="trip-location-icon">📍</span>
          <span class="trip-location-text">${trip.pickup_address || trip.pickup_location || 'Pickup location'}</span>
        </div>
        <div class="trip-location dropoff">
          <span class="trip-location-icon">🏁</span>
          <span class="trip-location-text">${trip.dropoff_address || trip.dropoff_location || 'Dropoff location'}</span>
        </div>
      </div>
      
      ${footerButtons ? `<div class="trip-card-footer">${footerButtons}</div>` : ''}
    </div>
  `;
}

function renderActiveTripCard(trip) {
  const status = trip.driver_status || 'enroute';
  const statusMeta = STATUS_META[status] || STATUS_META.enroute;
  const passengerName = trip.passenger_name || trip.passenger_first_name || 'Passenger';
  
  // Calculate elapsed time
  const elapsed = state.timerStartTime ? formatElapsedTime(Date.now() - state.timerStartTime) : '00:00';
  
  // Next status options
  const nextStatuses = STATUS_TRANSITIONS[status] || [];
  
  elements.activeTripCard.innerHTML = `
    <div class="active-trip-status-bar ${status}">
      ${statusMeta.emoji} ${statusMeta.label}
    </div>
    <div class="active-trip-body">
      <div class="trip-card-header">
        <div class="trip-date-time">
          <span class="trip-date">${passengerName}</span>
          <span class="trip-time">#${trip.confirmation_number || trip.id?.slice(0, 8)}</span>
        </div>
      </div>
      
      <div class="active-trip-timer">
        <div class="timer-value" id="tripTimer">${elapsed}</div>
        <div class="timer-label">Trip Duration</div>
      </div>
      
      <div class="trip-route" style="margin-bottom: var(--space-lg);">
        <div class="trip-location pickup">
          <span class="trip-location-icon">📍</span>
          <span class="trip-location-text">${trip.pickup_address || trip.pickup_location || 'Pickup'}</span>
        </div>
        <div class="trip-location dropoff">
          <span class="trip-location-icon">🏁</span>
          <span class="trip-location-text">${trip.dropoff_address || trip.dropoff_location || 'Dropoff'}</span>
        </div>
      </div>
      
      <div class="active-trip-actions">
        ${nextStatuses.map(nextStatus => {
          const meta = STATUS_META[nextStatus];
          const btnClass = nextStatus === 'completed' ? 'btn-success' : 'btn-primary';
          return `
            <button class="btn ${btnClass}" onclick="updateTripStatus('${trip.id}', '${nextStatus}')">
              ${meta.emoji} ${getStatusActionLabel(nextStatus)}
            </button>
          `;
        }).join('')}
        
        <button class="btn btn-secondary" onclick="openNavigation('${trip.dropoff_address || trip.dropoff_location || ''}')">
          🧭 Open Navigation
        </button>
      </div>
    </div>
  `;
  
  // Start timer if not already running
  if (!state.activeTimer) {
    state.timerStartTime = Date.now();
    startTripTimer();
  }
}

function startTripTimer() {
  if (state.activeTimer) clearInterval(state.activeTimer);
  
  state.activeTimer = setInterval(() => {
    const timerEl = document.getElementById('tripTimer');
    if (timerEl && state.timerStartTime) {
      timerEl.textContent = formatElapsedTime(Date.now() - state.timerStartTime);
    }
  }, 1000);
}

function stopTripTimer() {
  if (state.activeTimer) {
    clearInterval(state.activeTimer);
    state.activeTimer = null;
  }
  state.timerStartTime = null;
}

function updateBadges() {
  const offeredCount = state.trips.offered.length;
  const upcomingCount = state.trips.upcoming.length;
  const activeCount = state.trips.active ? 1 : 0;
  
  elements.offeredBadge.textContent = offeredCount;
  elements.offeredBadge.classList.toggle('show', offeredCount > 0);
  
  elements.upcomingBadge.textContent = upcomingCount;
  elements.upcomingBadge.classList.toggle('show', upcomingCount > 0);
  
  elements.activeBadge.textContent = activeCount;
  elements.activeBadge.classList.toggle('show', activeCount > 0);
}

// ============================================
// Tab Navigation
// ============================================
function switchTab(tabName) {
  elements.tabs.forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });
  
  elements.tabPanels.forEach(panel => {
    panel.classList.toggle('active', panel.id === `${tabName}Tab`);
  });
}

// ============================================
// Trip Actions
// ============================================
window.acceptTrip = async function(tripId) {
  try {
    await updateReservationStatus(tripId, { driver_status: 'assigned' });
    showToast('Trip accepted!', 'success');
    await refreshTrips();
  } catch (err) {
    showToast('Failed to accept trip', 'error');
  }
};

window.declineTrip = async function(tripId) {
  if (!confirm('Are you sure you want to decline this trip?')) return;
  
  try {
    await updateReservationStatus(tripId, { driver_status: 'declined', driver_id: null });
    showToast('Trip declined', 'warning');
    await refreshTrips();
  } catch (err) {
    showToast('Failed to decline trip', 'error');
  }
};

window.startTrip = async function(tripId) {
  try {
    await updateReservationStatus(tripId, { driver_status: 'enroute' });
    
    // Send notification to passenger
    await sendPassengerNotification(tripId, 'on_the_way');
    
    showToast('Trip started! Passenger notified.', 'success');
    switchTab('active');
    await refreshTrips();
  } catch (err) {
    console.error('[DriverPortal] Start trip error:', err);
    showToast('Failed to start trip', 'error');
  }
};

window.updateTripStatus = async function(tripId, newStatus) {
  try {
    await updateReservationStatus(tripId, { driver_status: newStatus });
    
    // Send notifications for certain statuses
    if (newStatus === 'enroute') {
      await sendPassengerNotification(tripId, 'on_the_way');
      showToast('Passenger notified you are on the way', 'success');
    } else if (newStatus === 'arrived') {
      await sendPassengerNotification(tripId, 'arrived');
      showToast('Passenger notified you have arrived', 'success');
    } else if (newStatus === 'completed') {
      stopTripTimer();
      openModal('postTripModal');
      // Store trip ID for post-trip form
      elements.postTripModal.dataset.tripId = tripId;
      return; // Don't refresh yet, wait for post-trip form
    }
    
    await refreshTrips();
  } catch (err) {
    console.error('[DriverPortal] Update status error:', err);
    showToast('Failed to update status', 'error');
  }
};

async function handlePostTripSubmit() {
  const tripId = elements.postTripModal.dataset.tripId;
  
  const postTripData = {
    wait_time: parseInt(document.getElementById('waitTime').value) || 0,
    extra_stops: parseInt(document.getElementById('extraStops').value) || 0,
    tolls_parking: parseFloat(document.getElementById('tollsParking').value) || 0,
    tip: parseFloat(document.getElementById('tipAmount').value) || 0,
    driver_notes: document.getElementById('driverNotes').value.trim()
  };
  
  try {
    // Update reservation with post-trip data
    await updateReservationStatus(tripId, {
      driver_status: 'completed',
      status: 'COMPLETED',
      ...postTripData
    });
    
    closeModal('postTripModal');
    showToast('Trip completed successfully! 🎉', 'success');
    
    // Reset post-trip form
    document.getElementById('waitTime').value = '0';
    document.getElementById('extraStops').value = '0';
    document.getElementById('tollsParking').value = '0';
    document.getElementById('tipAmount').value = '0';
    document.getElementById('driverNotes').value = '';
    
    // Update driver status back to available
    await updateDriverStatus('available');
    
    await refreshTrips();
  } catch (err) {
    console.error('[DriverPortal] Post-trip error:', err);
    showToast('Failed to complete trip', 'error');
  }
}

window.openNavigation = function(address) {
  if (!address) {
    showToast('No address available', 'warning');
    return;
  }
  
  const encoded = encodeURIComponent(address);
  
  // Try to detect platform and open appropriate navigation app
  const userAgent = navigator.userAgent.toLowerCase();
  
  if (/iphone|ipad|ipod/.test(userAgent)) {
    // iOS - Apple Maps
    window.open(`maps://maps.google.com/maps?daddr=${encoded}`, '_blank');
  } else if (/android/.test(userAgent)) {
    // Android - Google Maps
    window.open(`google.navigation:q=${encoded}`, '_blank');
  } else {
    // Desktop - Google Maps web
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encoded}`, '_blank');
  }
};

// ============================================
// Trip Detail Modal
// ============================================
function openTripDetail(tripId) {
  const trip = [...state.trips.offered, ...state.trips.upcoming].find(t => t.id === tripId);
  if (!trip) return;
  
  const pickupDate = formatDate(trip.pickup_date_time || trip.pickup_date);
  const pickupTime = formatTime(trip.pickup_date_time || trip.pickup_time);
  const passengerName = trip.passenger_name || trip.passenger_first_name || 'Passenger';
  const passengerPhone = trip.passenger_phone || trip.passenger_cell || '';
  
  elements.tripDetailBody.innerHTML = `
    <div class="trip-detail-section">
      <div class="trip-detail-label">Confirmation #</div>
      <div class="trip-detail-value large">${trip.confirmation_number || trip.id?.slice(0, 8)}</div>
    </div>
    
    <div class="trip-detail-section">
      <div class="trip-detail-label">Date & Time</div>
      <div class="trip-detail-value">${pickupDate} at ${pickupTime}</div>
    </div>
    
    <div class="trip-detail-section">
      <div class="trip-detail-label">Passenger</div>
      <div class="trip-detail-value">${passengerName}</div>
      ${passengerPhone ? `<a href="tel:${passengerPhone}" class="nav-link">📞 ${passengerPhone}</a>` : ''}
    </div>
    
    <div class="trip-detail-section">
      <div class="trip-detail-label">Route</div>
      <div class="trip-detail-route">
        <div class="route-point">
          <div class="route-point-marker pickup">📍</div>
          <div class="route-point-content">
            <div class="route-point-label">Pickup</div>
            <div class="route-point-address">${trip.pickup_address || trip.pickup_location || 'TBD'}</div>
            <a href="#" class="nav-link" onclick="openNavigation('${trip.pickup_address || trip.pickup_location || ''}')">🧭 Navigate</a>
          </div>
        </div>
        <div class="route-point">
          <div class="route-point-marker dropoff">🏁</div>
          <div class="route-point-content">
            <div class="route-point-label">Dropoff</div>
            <div class="route-point-address">${trip.dropoff_address || trip.dropoff_location || 'TBD'}</div>
            <a href="#" class="nav-link" onclick="openNavigation('${trip.dropoff_address || trip.dropoff_location || ''}')">🧭 Navigate</a>
          </div>
        </div>
      </div>
    </div>
    
    ${trip.special_instructions ? `
      <div class="trip-detail-section">
        <div class="special-instructions">
          <div class="special-instructions-header">
            ⚠️ Special Instructions
          </div>
          <div>${trip.special_instructions}</div>
        </div>
      </div>
    ` : ''}
    
    <div class="trip-detail-section">
      <div class="trip-detail-label">Service Type</div>
      <div class="trip-detail-value">${trip.service_type || 'Standard'}</div>
    </div>
    
    <div class="trip-detail-section">
      <div class="trip-detail-label">Vehicle Type</div>
      <div class="trip-detail-value">${trip.vehicle_type || 'As Assigned'}</div>
    </div>
  `;
  
  // Footer buttons based on trip type
  const isOffered = state.trips.offered.some(t => t.id === tripId);
  const isUpcoming = state.trips.upcoming.some(t => t.id === tripId);
  
  elements.tripDetailFooter.innerHTML = '';
  
  if (isOffered) {
    elements.tripDetailFooter.innerHTML = `
      <div class="btn-row">
        <button class="btn btn-secondary" onclick="declineTrip('${tripId}'); closeModal('tripDetailModal');">✗ Decline</button>
        <button class="btn btn-success" onclick="acceptTrip('${tripId}'); closeModal('tripDetailModal');">✓ Accept</button>
      </div>
    `;
  } else if (isUpcoming) {
    elements.tripDetailFooter.innerHTML = `
      <button class="btn btn-primary btn-large" onclick="startTrip('${tripId}'); closeModal('tripDetailModal');">
        🚗 Start Trip
      </button>
    `;
  }
  
  openModal('tripDetailModal');
}

// ============================================
// API Helpers
// ============================================
async function updateReservationStatus(reservationId, updates) {
  const client = getSupabase();
  if (!client) throw new Error('Supabase not initialized');
  
  const { data, error } = await client
    .from('reservations')
    .update(updates)
    .eq('id', reservationId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

async function updateDriverStatus(status) {
  if (!state.driverId) return;
  const client = getSupabase();
  if (!client) throw new Error('Supabase not initialized');
  
  const { data, error } = await client
    .from('drivers')
    .update({ driver_status: status })
    .eq('id', state.driverId)
    .select()
    .single();
  
  if (error) throw error;
  
  state.driver = data;
  updateDriverUI();
  return data;
}

async function sendPassengerNotification(reservationId, notificationType) {
  // This would call your notification service
  // For now, just log it
  console.log(`[DriverPortal] Sending ${notificationType} notification for reservation ${reservationId}`);
  
  // In production, you'd call an API endpoint like:
  // await fetch('/api/notify', {
  //   method: 'POST',
  //   body: JSON.stringify({ reservationId, type: notificationType })
  // });
  
  // Or use Supabase Edge Functions:
  // await supabase.functions.invoke('send-notification', {
  //   body: { reservationId, type: notificationType }
  // });
}

// ============================================
// Menu
// ============================================
function toggleMenu() {
  elements.menuSidebar.classList.toggle('active');
  elements.menuOverlay.classList.toggle('active');
}

function closeMenu() {
  elements.menuSidebar.classList.remove('active');
  elements.menuOverlay.classList.remove('active');
}

// ============================================
// Modals
// ============================================
function openModal(modalId) {
  document.getElementById(modalId)?.classList.add('active');
}

function closeModal(modalId) {
  document.getElementById(modalId)?.classList.remove('active');
}

// Make closeModal available globally
window.closeModal = closeModal;

// ============================================
// Toast Notifications
// ============================================
function showToast(message, type = 'info') {
  elements.toast.textContent = message;
  elements.toast.className = `toast ${type} show`;
  
  setTimeout(() => {
    elements.toast.classList.remove('show');
  }, 3500);
}

// ============================================
// Utility Functions
// ============================================
function getInitials(name) {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  if (isSameDay(date, today)) return 'Today';
  if (isSameDay(date, tomorrow)) return 'Tomorrow';
  
  return date.toLocaleDateString('en-US', { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric' 
  });
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });
}

function isSameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
}

function formatElapsedTime(ms) {
  const seconds = Math.floor(ms / 1000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const hrs = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  
  if (hrs > 0) {
    return `${hrs}:${String(remainingMins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatPhone(phone) {
  // Remove non-digits
  const digits = phone.replace(/\D/g, '');
  // Format as (XXX) XXX-XXXX
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

function getStatusActionLabel(status) {
  switch (status) {
    case 'enroute': return 'On the Way';
    case 'arrived': return 'Arrived';
    case 'passenger_onboard': return 'Passenger On Board';
    case 'completed': return 'Complete Trip';
    default: return STATUS_META[status]?.label || status;
  }
}

// ============================================
// Service Worker Registration (PWA)
// ============================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/driver-portal-sw.js')
      .then(reg => console.log('[DriverPortal] SW registered'))
      .catch(err => console.log('[DriverPortal] SW registration failed:', err));
  });
}

console.log('[DriverPortal] Script fully loaded, waiting for DOMContentLoaded...');
