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

// Check if email already exists in drivers table (direct query for efficiency)
async function checkEmailExists(email) {
  const supabaseUrl = window.ENV?.SUPABASE_URL || '';
  const supabaseKey = window.ENV?.SUPABASE_ANON_KEY || '';
  
  if (!supabaseUrl || !supabaseKey) {
    console.warn('[DriverPortal] Supabase not configured for email check');
    return false;
  }
  
  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/drivers?email=eq.${encodeURIComponent(email.toLowerCase())}&select=id,email`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      }
    );
    
    if (!response.ok) {
      console.warn('[DriverPortal] Email check failed:', response.status);
      return false;
    }
    
    const drivers = await response.json();
    return drivers && drivers.length > 0;
  } catch (err) {
    console.error('[DriverPortal] Email check error:', err);
    return false;
  }
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
    const orgId = window.ENV?.ORGANIZATION_ID || window.ENV?.FORCE_VEHICLE_ORG_ID || null;
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
  // Create vehicle in fleet_vehicles table (the main fleet management table)
  const client = getSupabase();
  if (!client) {
    throw new Error('Supabase not initialized');
  }
  
  // Look up the vehicle type name if we have an ID
  let vehicleTypeName = vehicleData.vehicle_type || null;
  const vehicleTypeId = vehicleData.veh_type || vehicleData.vehicle_type_id || null;
  
  if (vehicleTypeId && !vehicleTypeName) {
    try {
      const { data: vtData } = await client
        .from('vehicle_types')
        .select('name')
        .eq('id', vehicleTypeId)
        .single();
      if (vtData?.name) {
        vehicleTypeName = vtData.name;
      }
    } catch (e) {
      console.warn('[DriverPortal] Could not fetch vehicle type name:', e);
    }
  }
  
  // Generate proper unit number (not license plate)
  // Unit number should be like "V001" or based on driver name
  const unitNumber = vehicleData.unit_number || 
                     vehicleData.veh_disp_name ||
                     `V${Date.now().toString().slice(-6)}`;
  
  // Generate vehicle title from make/model/year
  const vehTitle = vehicleData.veh_title || 
    [vehicleData.year, vehicleData.make, vehicleData.model].filter(Boolean).join(' ') || null;
  
  // Map field names to fleet_vehicles schema - ALL 31 COLUMNS
  const payload = {
    // Core identity
    id: vehicleData.id || crypto.randomUUID(),
    organization_id: vehicleData.organization_id,
    affiliate_id: vehicleData.affiliate_id || null,
    
    // Display fields
    unit_number: unitNumber,
    veh_disp_name: vehTitle || unitNumber,  // Same as veh_title
    veh_title: vehTitle,
    
    // Vehicle type
    vehicle_type: vehicleTypeName,
    vehicle_type_id: vehicleTypeId,
    
    // Vehicle details
    make: vehicleData.make || null,
    model: vehicleData.model || null,
    year: vehicleData.year || null,
    color: vehicleData.color || null,
    license_plate: vehicleData.license_plate || null,
    vin: vehicleData.vin || null,
    
    // Capacity (keep both in sync)
    passenger_capacity: vehicleData.passenger_capacity || vehicleData.capacity || 4,
    capacity: vehicleData.passenger_capacity || vehicleData.capacity || 4,
    
    // Status
    status: vehicleData.status || 'AVAILABLE',
    is_active: vehicleData.is_active !== false,
    
    // Driver assignment
    assigned_driver_id: vehicleData.assigned_driver_id || null,
    assigned_at: vehicleData.assigned_driver_id ? new Date().toISOString() : null,
    
    // Permit & DOT fields
    limo_permit_number: vehicleData.limo_permit_number || null,
    permit_expiration_month: vehicleData.permit_expiration_month || null,
    permit_expiration_year: vehicleData.permit_expiration_year || null,
    us_dot_number: vehicleData.us_dot_number || null,
    
    // Insurance fields
    insurance_company: vehicleData.insurance_company || null,
    insurance_policy_number: vehicleData.insurance_policy_number || null,
    
    // Notes & metadata
    notes: vehicleData.notes || null,
    metadata: vehicleData.metadata || {},
    
    // Audit fields - created_by/updated_by have FK to auth.users, so leave null
    // (driver signup doesn't have an auth user context)
    created_by: null,
    updated_by: null
    // created_at and updated_at are auto-set by Supabase
  };
  
  console.log('[DriverPortal] Creating fleet vehicle with payload:', payload);
  
  const { data, error } = await client
    .from('fleet_vehicles')
    .insert([payload])
    .select()
    .single();
  
  if (error) {
    console.error('[DriverPortal] Fleet vehicle creation error:', error);
    throw error;
  }
  
  console.log('[DriverPortal] Fleet vehicle created:', data);
  return data;
}

// Delete a driver (for rollback on registration error)
async function deleteDriver(driverId) {
  const client = getSupabase();
  if (!client) {
    throw new Error('Supabase not initialized');
  }
  
  console.log('[DriverPortal] 🗑️ Deleting driver:', driverId);
  
  const { error } = await client
    .from('drivers')
    .delete()
    .eq('id', driverId);
  
  if (error) {
    console.error('[DriverPortal] Driver deletion error:', error);
    throw error;
  }
  
  console.log('[DriverPortal] ✅ Driver deleted:', driverId);
}

// Delete a vehicle (for rollback on registration error)
async function deleteVehicle(vehicleId) {
  const client = getSupabase();
  if (!client) {
    throw new Error('Supabase not initialized');
  }
  
  console.log('[DriverPortal] 🗑️ Deleting vehicle:', vehicleId);
  
  const { error } = await client
    .from('fleet_vehicles')
    .delete()
    .eq('id', vehicleId);
  
  if (error) {
    console.error('[DriverPortal] Vehicle deletion error:', error);
    throw error;
  }
  
  console.log('[DriverPortal] ✅ Vehicle deleted:', vehicleId);
}

// Delete an affiliate (for rollback on registration error)
async function deleteAffiliate(affiliateId) {
  const client = getSupabase();
  if (!client) {
    throw new Error('Supabase not initialized');
  }
  
  console.log('[DriverPortal] 🗑️ Deleting affiliate:', affiliateId);
  
  const { error } = await client
    .from('affiliates')
    .delete()
    .eq('id', affiliateId);
  
  if (error) {
    console.error('[DriverPortal] Affiliate deletion error:', error);
    throw error;
  }
  
  console.log('[DriverPortal] ✅ Affiliate deleted:', affiliateId);
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

async function updateAffiliate(id, affiliateData) {
  if (apiService?.updateAffiliate) {
    return await apiService.updateAffiliate(id, affiliateData);
  }
  throw new Error('updateAffiliate not available');
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
    
    // Create new affiliate under the MAIN organization (RELIALIMO)
    // All affiliates are sub-entities of the main org, not separate organizations
    // Data isolation is handled via affiliate_id, not organization_id
    console.log('[DriverPortal] Creating new affiliate:', companyName);
    
    // Use the main RELIALIMO organization ID for all affiliates
    const mainOrgId = window.ENV?.ORGANIZATION_ID || '54eb6ce7-ba97-4198-8566-6ac075828160';
    
    const newAffiliateData = {
      company_name: companyName.trim(),
      organization_id: mainOrgId,  // All affiliates under main org
      status: 'ACTIVE',
      is_active: true,
      primary_address: affiliateInfo?.address || null,
      city: affiliateInfo?.city || null,
      state: affiliateInfo?.state || null,
      zip: affiliateInfo?.zip || null,  // affiliates table uses 'zip' not 'postal_code'
      phone: affiliateInfo?.phone || null  // affiliates table uses 'phone' not 'primary_phone'
    };
    
    const newAffiliate = await createAffiliate(newAffiliateData);
    
    if (newAffiliate) {
      console.log('[DriverPortal] ✅ Created new affiliate:', newAffiliate.id, 
                  'with org_id:', newAffiliate.organization_id);
      return newAffiliate;
    }
    
    console.warn('[DriverPortal] Failed to create affiliate');
    return null;
  } catch (err) {
    console.error('[DriverPortal] Error in findOrCreateAffiliate:', err);
    return null;
  }
}

// ============================================
// State Management
// ============================================
const state = {
  currentScreen: 'loading',
  driver: null,
  driverId: null,
  portalSlug: null, // Driver's unique URL slug (first_name_last_name)
  urlDriverId: null, // Driver ID extracted from URL path
  trips: {
    offered: [],
    upcoming: [],
    active: null
  },
  previousOfferedTrips: [], // For tracking new offers and playing sounds
  vehicleTypes: [],
  activeTimer: null,
  timerStartTime: null,
  // OTP verification state (phone)
  otpCode: null,
  otpExpiry: null,
  otpAttempts: 0,
  otpResendTimer: null,
  phoneVerified: false,
  // Email OTP verification state
  emailOtpCode: null,
  emailOtpExpiry: null,
  emailOtpAttempts: 0,
  emailOtpResendTimer: null,
  emailVerified: false,
  // Selected company from matching
  selectedAffiliate: null,
  // Driver's affiliate/company data
  affiliate: null,
  // Pending password for registration (stored temporarily until driver record is created)
  pendingPassword: null
};

// ============================================
// URL Slug Handling for driver.relialimo.com/first_name_last_name
// ============================================
function generatePortalSlug(firstName, lastName) {
  const first = (firstName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const last = (lastName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${first}_${last}`;
}

function getPortalSlugFromUrl() {
  // Get the path after domain: driver.relialimo.com/john_doe -> "john_doe"
  // Also supports: driver.relialimo.com/driver_id (UUID format)
  const path = window.location.pathname;
  const hash = window.location.hash;
  const search = window.location.search;
  
  console.log('[DriverPortal] Parsing URL - Path:', path, 'Hash:', hash, 'Search:', search);
  
  // Check URL search parameters first (for Vercel routing compatibility)
  const urlParams = new URLSearchParams(search);
  
  // Check for driver_slug (from Vercel rewrite: /:driver_slug -> ?driver_slug=:driver_slug)
  const driverSlugParam = urlParams.get('driver_slug');
  if (driverSlugParam) {
    console.log('[DriverPortal] Found driver slug in search params:', driverSlugParam);
    return driverSlugParam.toLowerCase();
  }
  
  // Check for driver_id or driverId
  const driverIdParam = urlParams.get('driver_id') || urlParams.get('driverId');
  if (driverIdParam) {
    console.log('[DriverPortal] Found driver ID in search params:', driverIdParam);
    return driverIdParam;
  }
  
  // Check hash fragment for driver ID (for direct links)
  if (hash && hash.startsWith('#driver-')) {
    const hashDriverId = hash.replace('#driver-', '');
    if (hashDriverId) {
      console.log('[DriverPortal] Found driver ID in hash:', hashDriverId);
      return hashDriverId;
    }
  }
  
  // Check plain hash (just the ID)
  if (hash && hash.startsWith('#') && hash.length > 1) {
    const hashId = hash.substring(1);
    // Check if it looks like a driver ID
    if (hashId.length >= 8 && (hashId.includes('-') || /^[a-f0-9]+$/i.test(hashId))) {
      console.log('[DriverPortal] Found driver ID in plain hash:', hashId);
      return hashId;
    }
  }
  
  // Remove leading slash and any trailing slashes
  const slug = path.replace(/^\/+|\/+$/g, '');
  
  // Ignore common paths that aren't driver slugs or IDs
  if (!slug || slug === 'driver-portal.html' || slug === 'index.html' || slug.includes('.')) {
    return null;
  }
  
  console.log('[DriverPortal] Found URL slug/ID:', slug);
  return slug.toLowerCase();
}

async function loadDriverBySlug(slug) {
  console.log('[DriverPortal] Loading driver by slug/ID:', slug);
  const supabaseUrl = window.ENV?.SUPABASE_URL || '';
  const supabaseKey = window.ENV?.SUPABASE_ANON_KEY || '';
  
  try {
    // First try to load by ID (if slug looks like a UUID)
    if (slug.length >= 8 && (slug.includes('-') || /^[a-f0-9]+$/i.test(slug))) {
      console.log('[DriverPortal] Trying to load by driver ID:', slug);
      const response = await fetch(
        `${supabaseUrl}/rest/v1/drivers?id=eq.${encodeURIComponent(slug)}&select=*`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
          }
        }
      );
      
      if (response.ok) {
        const drivers = await response.json();
        if (drivers && drivers.length > 0) {
          console.log('[DriverPortal] Found driver by ID:', drivers[0].first_name, drivers[0].last_name);
          return drivers[0];
        }
      }
    }
    
    // If ID lookup failed, try slug lookup
    console.log('[DriverPortal] Trying to load by portal slug:', slug);
    const response = await fetch(
      `${supabaseUrl}/rest/v1/drivers?portal_slug=eq.${encodeURIComponent(slug)}&select=*`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      }
    );
    
    if (!response.ok) {
      console.warn('[DriverPortal] Failed to fetch driver by slug:', response.status);
      return null;
    }
    
    const drivers = await response.json();
    if (drivers && drivers.length > 0) {
      console.log('[DriverPortal] Found driver by slug:', drivers[0].first_name, drivers[0].last_name);
      return drivers[0];
    }
    
    // If portal_slug lookup failed, try parsing slug as first_name_last_name
    if (slug.includes('_')) {
      const parts = slug.split('_');
      if (parts.length >= 2) {
        const firstName = parts[0];
        const lastName = parts.slice(1).join('_'); // Handle names with underscores
        console.log('[DriverPortal] Trying to find driver by name pattern:', firstName, lastName);
        
        const nameResponse = await fetch(
          `${supabaseUrl}/rest/v1/drivers?first_name=ilike.${encodeURIComponent(firstName)}&last_name=ilike.${encodeURIComponent(lastName)}&select=*`,
          {
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`
            }
          }
        );
        
        if (nameResponse.ok) {
          const nameDrivers = await nameResponse.json();
          if (nameDrivers && nameDrivers.length > 0) {
            console.log('[DriverPortal] Found driver by name:', nameDrivers[0].first_name, nameDrivers[0].last_name);
            return nameDrivers[0];
          }
        }
      }
    }
    
    console.log('[DriverPortal] No driver found for slug/ID:', slug);
    return null;
  } catch (err) {
    console.error('[DriverPortal] Error loading driver by slug/ID:', err);
    return null;
  }
}

function getDriverPortalUrl(driver) {
  // Generate the full portal URL for a driver
  const slug = driver.portal_slug || generatePortalSlug(driver.first_name, driver.last_name);
  // In production: return `https://driver.relialimo.com/${slug}`;
  // For local dev, use current origin
  return `${window.location.origin}/${slug}`;
}

// ============================================
// DOM Elements
// ============================================
const screens = {
  loading: document.getElementById('loadingScreen'),
  auth: document.getElementById('authScreen'),
  dashboard: document.getElementById('dashboardScreen'),
  vehicle: document.getElementById('vehicleScreen'),
  welcome: document.getElementById('welcomeScreen'),
  profile: document.getElementById('profileScreen'),
  settings: document.getElementById('settingsScreen'),
  registrationSplash: document.getElementById('registrationSplash')
};

const elements = {
  // Auth
  loginForm: document.getElementById('loginForm'),
  registerForm: document.getElementById('registerForm'),
  loginBtn: document.getElementById('loginBtn'),
  showRegisterBtn: document.getElementById('showRegisterBtn'),
  showLoginBtn: document.getElementById('showLoginBtn'),
  
  // Splash screen
  splashLogoPhase: document.getElementById('splashLogoPhase'),
  splashWelcomePhase: document.getElementById('splashWelcomePhase'),
  splashChecklistPhase: document.getElementById('splashChecklistPhase'),
  splashLetsGoBtn: document.getElementById('splashLetsGoBtn'),
  
  // Registration steps
  regNextStep1: document.getElementById('regNextStep1'),
  regNextStep2: document.getElementById('regNextStep2'),
  regBackStep1b: document.getElementById('regBackStep1b'),
  regBackStep2: document.getElementById('regBackStep2'),
  regBackStep2b: document.getElementById('regBackStep2b'),
  regBackStep3: document.getElementById('regBackStep3'),
  regSubmit: document.getElementById('regSubmit'),
  verifyOtpBtn: document.getElementById('verifyOtpBtn'),
  resendOtpBtn: document.getElementById('resendOtpBtn'),
  verifyEmailOtpBtn: document.getElementById('verifyEmailOtpBtn'),
  resendEmailOtpBtn: document.getElementById('resendEmailOtpBtn'),
  
  // Company matching
  companyMatchResults: document.getElementById('companyMatchResults'),
  selectedCompanyCard: document.getElementById('selectedCompanyCard'),
  newCompanyForm: document.getElementById('newCompanyForm'),
  clearSelectedCompany: document.getElementById('clearSelectedCompany'),
  
  // OTP elements
  otpDigits: document.querySelectorAll('.otp-digit'),
  otpPhoneDisplay: document.getElementById('otpPhoneDisplay'),
  otpStatus: document.getElementById('otpStatus'),
  otpTimer: document.getElementById('otpTimer'),
  
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
  closeStatusModal: document.getElementById('closeStatusModal'),
  
  postTripModal: document.getElementById('postTripModal'),
  submitPostTrip: document.getElementById('submitPostTrip'),
  
  // Menu
  menuBtn: document.getElementById('menuBtn'),
  menuSidebar: document.getElementById('menuSidebar'),
  menuOverlay: document.getElementById('menuOverlay'),
  menuLogout: document.getElementById('menuLogout'),
  menuDeleteAccount: document.getElementById('menuDeleteAccount'),
  menuVehicle: document.getElementById('menuVehicle'),
  menuProfile: document.getElementById('menuProfile'),
  sidebarName: document.getElementById('sidebarName'),
  sidebarEmail: document.getElementById('sidebarEmail'),
  sidebarAvatar: document.getElementById('sidebarAvatar'),
  
  // Vehicle Screen
  vehicleScreen: document.getElementById('vehicleScreen'),
  vehicleBackBtn: document.getElementById('vehicleBackBtn'),
  editVehicleBtn: document.getElementById('editVehicleBtn'),
  
  // Profile Screen
  profileScreen: document.getElementById('profileScreen'),
  profileBackBtn: document.getElementById('profileBackBtn'),
  saveProfileBtn: document.getElementById('saveProfileBtn'),
  saveProfileMainBtn: document.getElementById('saveProfileMainBtn'),
  profilePhoto: document.getElementById('profilePhoto'),
  profilePhotoPlaceholder: document.getElementById('profilePhotoPlaceholder'),
  profilePhotoInput: document.getElementById('profilePhotoInput'),
  changePhotoBtn: document.getElementById('changePhotoBtn'),
  profileFullName: document.getElementById('profileFullName'),
  profileEmail: document.getElementById('profileEmail'),
  profilePhone: document.getElementById('profilePhone'),
  profileBio: document.getElementById('profileBio'),
  bioCharCount: document.getElementById('bioCharCount'),
  profileYearsExp: document.getElementById('profileYearsExp'),
  profileServiceAreas: document.getElementById('profileServiceAreas'),
  profilePortalUrl: document.getElementById('profilePortalUrl'),
  // Company info
  companyInfoSection: document.getElementById('companyInfoSection'),
  profileCompanyName: document.getElementById('profileCompanyName'),
  profileCompanyAddress: document.getElementById('profileCompanyAddress'),
  profileCompanyPhone: document.getElementById('profileCompanyPhone'),
  saveCompanyInfoBtn: document.getElementById('saveCompanyInfoBtn'),
  
  // Settings Screen
  settingsScreen: document.getElementById('settingsScreen'),
  settingsBackBtn: document.getElementById('settingsBackBtn'),
  saveSettingsBtn: document.getElementById('saveSettingsBtn'),
  // Payment methods
  zelleEnabled: document.getElementById('zelleEnabled'),
  zelleDetails: document.getElementById('zelleDetails'),
  zelleEmail: document.getElementById('zelleEmail'),
  zelleName: document.getElementById('zelleName'),
  zelleStatus: document.getElementById('zelleStatus'),
  venmoEnabled: document.getElementById('venmoEnabled'),
  venmoDetails: document.getElementById('venmoDetails'),
  venmoUsername: document.getElementById('venmoUsername'),
  venmoStatus: document.getElementById('venmoStatus'),
  cashappEnabled: document.getElementById('cashappEnabled'),
  cashappDetails: document.getElementById('cashappDetails'),
  cashappTag: document.getElementById('cashappTag'),
  cashappStatus: document.getElementById('cashappStatus'),
  bankEnabled: document.getElementById('bankEnabled'),
  bankDetails: document.getElementById('bankDetails'),
  bankStatus: document.getElementById('bankStatus'),
  // Navigation preferences
  preferredMapApp: document.getElementById('preferredMapApp'),
  trafficUpdates: document.getElementById('trafficUpdates'),
  avoidTolls: document.getElementById('avoidTolls'),
  avoidHighways: document.getElementById('avoidHighways'),
  // Notifications
  pushNotifications: document.getElementById('pushNotifications'),
  smsNotifications: document.getElementById('smsNotifications'),
  emailNotifications: document.getElementById('emailNotifications'),
  soundAlerts: document.getElementById('soundAlerts'),
  // Trip preferences
  autoAcceptRadius: document.getElementById('autoAcceptRadius'),
  minTripFare: document.getElementById('minTripFare'),
  maxPickupDistance: document.getElementById('maxPickupDistance'),
  // Privacy
  locationSharing: document.getElementById('locationSharing'),
  showPhoneToPassengers: document.getElementById('showPhoneToPassengers'),
  changePasswordBtn: document.getElementById('changePasswordBtn'),
  // App preferences
  themePreference: document.getElementById('themePreference'),
  distanceUnit: document.getElementById('distanceUnit'),
  timeFormat: document.getElementById('timeFormat'),
  
  // Welcome Screen
  welcomeDriverName: document.getElementById('welcomeDriverName'),
  enableLocationBtn: document.getElementById('enableLocationBtn'),
  skipLocationBtn: document.getElementById('skipLocationBtn'),
  locationPermissionBox: document.getElementById('locationPermissionBox'),
  locationGranted: document.getElementById('locationGranted'),
  goToDashboardBtn: document.getElementById('goToDashboardBtn'),
  
  // Online Toggle
  onlineToggle: document.getElementById('onlineToggle'),
  onlineLabel: document.getElementById('onlineLabel'),
  
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

// Auto-load ENV settings for SMS/Email (needed for OTP)
async function loadEnvSettingsToLocalStorage() {
  try {
    // Check if already loaded in this session
    const lastLoad = localStorage.getItem('envSettingsLastLoad');
    const now = Date.now();
    // Only reload if not loaded in last 5 minutes
    if (lastLoad && (now - parseInt(lastLoad)) < 5 * 60 * 1000) {
      console.log('[DriverPortal] ENV settings recently loaded, skipping');
      return;
    }
    
    console.log('[DriverPortal] Loading ENV settings...');
    const response = await fetch('/api/get-env-settings');
    const data = await response.json();
    
    if (data.success) {
      // Save SMS/Twilio settings
      if (data.twilio && (data.twilio.accountSid || data.twilio.authToken || data.twilio.phoneNumber)) {
        const smsProviders = JSON.parse(localStorage.getItem('smsProviders') || '[]');
        const existingTwilioIndex = smsProviders.findIndex(p => p.type === 'twilio');
        const twilioProvider = {
          type: 'twilio',
          accountSid: data.twilio.accountSid || '',
          authToken: data.twilio.authToken || '',
          phoneNumber: data.twilio.phoneNumber || '',
          fromNumber: data.twilio.phoneNumber || '',
          isDefault: true,
          enabled: true
        };
        
        if (existingTwilioIndex >= 0) {
          smsProviders[existingTwilioIndex] = { ...smsProviders[existingTwilioIndex], ...twilioProvider };
        } else {
          smsProviders.push(twilioProvider);
        }
        localStorage.setItem('smsProviders', JSON.stringify(smsProviders));
        console.log('[DriverPortal] SMS settings loaded from ENV');
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
        console.log('[DriverPortal] Email settings loaded from ENV');
      }
      
      localStorage.setItem('envSettingsLastLoad', now.toString());
      console.log('[DriverPortal] ENV settings loaded successfully');
    }
  } catch (error) {
    console.warn('[DriverPortal] Could not load ENV settings:', error.message);
  }
}

async function init() {
  console.log('[DriverPortal] Initializing...');
  
  try {
    // Load ENV settings for SMS/Email
    await loadEnvSettingsToLocalStorage();
    
    // Load modules first
    console.log('[DriverPortal] Loading modules...');
    await loadModules();
    console.log('[DriverPortal] Modules loaded');
    
    // Check for driver slug/ID in URL (driver.relialimo.com/first_name_last_name or driver.relialimo.com/driver_id)
    const urlSlugOrId = getPortalSlugFromUrl();
    let urlDriver = null;
    
    if (urlSlugOrId) {
      console.log('[DriverPortal] URL slug/ID detected:', urlSlugOrId);
      state.portalSlug = urlSlugOrId;
      
      // Try to load driver by slug or ID
      urlDriver = await loadDriverBySlug(urlSlugOrId);
      if (urlDriver) {
        console.log('[DriverPortal] Driver found for URL:', urlDriver.first_name, urlDriver.last_name);
        
        // Update page title with driver name
        document.title = `${urlDriver.first_name} ${urlDriver.last_name} - Driver Portal | RELIALIMO`;
        
        // Pre-fill login email if found and not logged in
        const loginEmail = document.getElementById('loginEmail');
        if (loginEmail) {
          loginEmail.value = urlDriver.email || '';
        }
      } else {
        console.log('[DriverPortal] ❌ Driver not found for URL slug/ID:', urlSlugOrId);
        // We'll show an error message later if no valid session exists
      }
    }
    
    // Check for saved session
    const savedDriverId = localStorage.getItem('driver_portal_id');
    console.log('[DriverPortal] Saved driver ID:', savedDriverId);
    
    if (savedDriverId) {
      // Try to restore session
      try {
        console.log('[DriverPortal] Attempting to restore session...');
        const driver = await loadDriver(savedDriverId);
        if (driver) {
          // If URL slug/ID exists, verify it matches the session driver
          if (urlSlugOrId && urlDriver) {
            // URL driver found - check if it matches session
            if (driver.id !== urlDriver.id) {
              console.log('[DriverPortal] URL driver mismatch with session, clearing session');
              localStorage.removeItem('driver_portal_id');
              // Continue to show auth screen for URL driver
            } else {
              console.log('[DriverPortal] Session restored and matches URL driver:', driver.first_name);
              state.driver = driver;
              state.driverId = savedDriverId;
              state.portalSlug = driver.portal_slug || generatePortalSlug(driver.first_name, driver.last_name);
              await loadDashboard();
              showScreen('dashboard');
              
              // Check for offer parameter and highlight/show the offer
              await handleOfferParameter();
              return;
            }
          } else if (urlSlugOrId && !urlDriver) {
            // URL slug/ID provided but driver not found - clear session and show error
            console.log('[DriverPortal] URL driver not found, clearing session');
            localStorage.removeItem('driver_portal_id');
            // Will show error screen below
          } else {
            // No URL slug/ID - restore normal session
            console.log('[DriverPortal] Session restored for:', driver.first_name);
            state.driver = driver;
            state.driverId = savedDriverId;
            state.portalSlug = driver.portal_slug || generatePortalSlug(driver.first_name, driver.last_name);
            await loadDashboard();
            showScreen('dashboard');
            
            // Check for offer parameter and highlight/show the offer
            await handleOfferParameter();
            return;
          }
        }
      } catch (err) {
        console.warn('[DriverPortal] Failed to restore session:', err);
        localStorage.removeItem('driver_portal_id');
      }
    }
    
    // No valid session
    console.log('[DriverPortal] No valid session, loading vehicle types...');
    try {
      await loadVehicleTypes();
    } catch (err) {
      console.warn('[DriverPortal] Failed to load vehicle types:', err);
      // Continue anyway - we can still show auth screen
    }
    
    // Show appropriate screen based on URL
    if (urlSlugOrId && !urlDriver) {
      // URL slug/ID provided but driver not found - show error
      showDriverNotFoundScreen(urlSlugOrId);
    } else {
      // Normal auth screen
      console.log('[DriverPortal] Showing auth screen');
      showScreen('auth');
    }
    
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
  
  // Setup notification sound handlers
  setupNotificationSoundHandlers();
  
  setTimeout(init, 1000); // Show loading for 1 second
  
  // Pre-cache common fleet vehicle images in background
  setTimeout(() => {
    preCacheFleetVehicleImages().catch(err => {
      console.warn('[VehicleImageCache] Pre-cache failed:', err);
    });
  }, 3000); // Start after 3 seconds to not block initial load
});

// ============================================
// Offer Parameter Handling
// ============================================
async function handleOfferParameter() {
  const urlParams = new URLSearchParams(window.location.search);
  const offerReservationId = urlParams.get('offer');
  
  if (!offerReservationId) {
    return; // No offer parameter
  }
  
  console.log('[DriverPortal] Handling offer parameter:', offerReservationId);
  
  // Switch to Offered tab
  switchTab('offered');
  
  // Wait for trips to load
  await refreshTrips();
  
  // Find and highlight the specific offer
  setTimeout(() => {
    const offerCard = document.querySelector(`[data-trip-id="${offerReservationId}"]`);
    if (offerCard) {
      // Highlight the card
      offerCard.style.border = '3px solid #10b981';
      offerCard.style.boxShadow = '0 0 20px rgba(16, 185, 129, 0.5)';
      
      // Scroll to the card
      offerCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // Show a toast notification
      showToast('📲 New trip offer from SMS!', 'info');
      
      // Auto-open trip details modal after a short delay
      setTimeout(() => {
        const tripId = offerCard.dataset.tripId;
        if (tripId) {
          openTripDetail(tripId);
        }
      }, 1500);
    } else {
      console.warn('[DriverPortal] Offer not found in available trips:', offerReservationId);
      showToast('Trip offer may have expired or been assigned to another driver', 'warning');
    }
    
    // Clean up URL parameter
    const newUrl = new URL(window.location);
    newUrl.searchParams.delete('offer');
    window.history.replaceState({}, '', newUrl);
  }, 1000);
}

// ============================================
// Notification Sound Event Handlers
// ============================================
function setupNotificationSoundHandlers() {
  // Listen for farmout offer events
  window.addEventListener('farmoutOfferSent', (event) => {
    const { driverId, driverName, offerDetails } = event.detail;
    
    // Only play sound if this is for the current driver
    if (driverId === state.driverId) {
      console.log('[DriverPortal] New farmout offer received, playing sound');
      playNotificationSound('new_offer');
      
      // Also show browser notification if permission granted
      showBrowserNotification('🚗 New Trip Offer!', 
        `${offerDetails.pickupCity} → ${offerDetails.dropoffCity}\nPayout: $${offerDetails.driverPay}`);
    }
  });
  
  // Listen for trip status updates that might need sounds
  window.addEventListener('tripStatusUpdate', (event) => {
    const { status, tripId } = event.detail;
    
    switch (status) {
      case 'started':
        playNotificationSound('trip_start');
        break;
      case 'completed':
        playNotificationSound('trip_complete');
        break;
      case 'urgent_update':
        playNotificationSound('urgent');
        break;
    }
  });
  
  console.log('[DriverPortal] Notification sound handlers setup complete');
}

// ============================================
// Browser Notifications (optional)
// ============================================
function showBrowserNotification(title, body, options = {}) {
  if (!('Notification' in window)) {
    console.log('[DriverPortal] Browser notifications not supported');
    return;
  }
  
  if (Notification.permission === 'granted') {
    new Notification(title, {
      body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: 'trip-offer',
      requireInteraction: true,
      ...options
    });
  } else if (Notification.permission === 'default') {
    // Request permission for future notifications
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        showBrowserNotification(title, body, options);
      }
    });
  }
}

// ============================================
// Registration State Reset
// ============================================
function resetRegistrationState() {
  // Clear phone OTP state
  state.otpCode = null;
  state.otpExpiry = null;
  state.otpAttempts = 0;
  state.phoneVerified = false;
  
  // Clear email OTP state
  state.emailOtpCode = null;
  state.emailOtpExpiry = null;
  state.emailOtpAttempts = 0;
  state.emailVerified = false;
  
  state.selectedAffiliate = null;
  state.pendingPassword = null;
  
  // Clear phone OTP inputs
  document.querySelectorAll('.otp-digit').forEach(input => {
    input.value = '';
    input.classList.remove('filled');
  });
  
  // Clear email OTP inputs
  document.querySelectorAll('.email-otp-digit').forEach(input => {
    input.value = '';
    input.classList.remove('filled');
  });
  
  // Clear timers
  if (window.otpResendTimer) {
    clearInterval(window.otpResendTimer);
    window.otpResendTimer = null;
  }
  if (state.emailOtpResendTimer) {
    clearInterval(state.emailOtpResendTimer);
    state.emailOtpResendTimer = null;
  }
  
  // Hide company selection, show form
  if (elements.selectedCompanyCard) elements.selectedCompanyCard.style.display = 'none';
  if (elements.newCompanyForm) elements.newCompanyForm.style.display = 'block';
  if (elements.companyMatchResults) elements.companyMatchResults.style.display = 'none';
  
  // Clear hidden fields
  const selectedCompanyId = document.getElementById('selectedCompanyId');
  if (selectedCompanyId) selectedCompanyId.value = '';
  
  // Reset to step 1
  goToRegStep(1);
  
  console.log('[DriverPortal] Registration state reset');
}

// ============================================
// Registration Splash Screen
// ============================================
let audioContext = null;

function playTone(frequency, duration, startDelay = 0) {
  return new Promise((resolve) => {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';
    
    // Fade in and out for smoother sound
    const startTime = audioContext.currentTime + startDelay;
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.05);
    gainNode.gain.linearRampToValueAtTime(0.3, startTime + duration - 0.1);
    gainNode.gain.linearRampToValueAtTime(0, startTime + duration);
    
    oscillator.start(startTime);
    oscillator.stop(startTime + duration);
    
    setTimeout(resolve, (startDelay + duration) * 1000);
  });
}

async function playWelcomeTones() {
  // C4, E4, G4 - C major chord notes played sequentially
  const C4 = 261.63;
  const E4 = 329.63;
  const G4 = 392.00;
  
  await playTone(C4, 0.3, 0);
  await playTone(E4, 0.3, 0);
  await playTone(G4, 0.5, 0);
}

// ============================================
// Notification Sounds
// ============================================
async function playNotificationSound(type = 'default') {
  // Check if sounds are enabled
  const settings = getDriverSettings();
  if (!settings.sound_alerts) {
    return;
  }
  
  try {
    switch (type) {
      case 'new_offer':
        // Ascending triplet - attention-grabbing
        await playTone(523.25, 0.2, 0);   // C5
        await playTone(659.25, 0.2, 0);   // E5
        await playTone(783.99, 0.3, 0);   // G5
        break;
        
      case 'accept':
        // Success sound - ascending major chord
        await playTone(523.25, 0.15, 0);  // C5
        await playTone(659.25, 0.15, 0);  // E5
        await playTone(783.99, 0.15, 0);  // G5
        await playTone(1046.50, 0.25, 0); // C6
        break;
        
      case 'decline':
        // Gentle dismissal sound
        await playTone(523.25, 0.2, 0);   // C5
        await playTone(415.30, 0.3, 0);   // Ab4
        break;
        
      case 'trip_start':
        // Driving sound - two quick beeps
        await playTone(880.00, 0.15, 0);  // A5
        await playTone(880.00, 0.15, 0.2); // A5 again
        break;
        
      case 'trip_complete':
        // Celebration sound
        await playTone(523.25, 0.1, 0);   // C5
        await playTone(659.25, 0.1, 0.1); // E5
        await playTone(783.99, 0.1, 0.2); // G5
        await playTone(1046.50, 0.3, 0.3); // C6
        break;
        
      case 'urgent':
        // Urgent attention sound - repeated high tone
        await playTone(1108.73, 0.15, 0);  // C#6
        await playTone(1108.73, 0.15, 0.2); // C#6
        await playTone(1108.73, 0.2, 0.4);  // C#6
        break;
        
      default:
        // Default notification - simple two-tone
        await playTone(523.25, 0.2, 0);   // C5
        await playTone(659.25, 0.3, 0);   // E5
        break;
    }
  } catch (e) {
    console.log('[DriverPortal] Sound notification failed:', e);
  }
}

function getDriverSettings() {
  try {
    return JSON.parse(localStorage.getItem('driver_portal_settings') || '{}');
  } catch (e) {
    return { sound_alerts: true };
  }
}

async function showRegistrationSplash() {
  console.log('[DriverPortal] Starting registration splash sequence');
  
  // Show splash screen
  Object.values(screens).forEach(s => s?.classList.remove('active'));
  screens.registrationSplash?.classList.add('active');
  
  // Reset phases
  if (elements.splashLogoPhase) elements.splashLogoPhase.style.display = 'flex';
  if (elements.splashWelcomePhase) elements.splashWelcomePhase.style.display = 'none';
  if (elements.splashChecklistPhase) elements.splashChecklistPhase.style.display = 'none';
  
  // Phase 1: Play tones and show logo (after user interaction)
  try {
    await playWelcomeTones();
  } catch (e) {
    console.log('[DriverPortal] Audio playback not available:', e);
  }
  
  // Wait for logo animation
  await new Promise(resolve => setTimeout(resolve, 2500));
  
  // Phase 2: Show welcome message with map
  if (elements.splashLogoPhase) elements.splashLogoPhase.style.display = 'none';
  if (elements.splashWelcomePhase) elements.splashWelcomePhase.style.display = 'flex';
  
  // Wait for welcome phase
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Phase 3: Show checklist
  if (elements.splashWelcomePhase) elements.splashWelcomePhase.style.display = 'none';
  if (elements.splashChecklistPhase) elements.splashChecklistPhase.style.display = 'flex';
  
  // Setup checklist handlers
  setupSplashChecklist();
}

function setupSplashChecklist() {
  const checkboxes = document.querySelectorAll('.splash-checkbox');
  const letsGoBtn = elements.splashLetsGoBtn;
  
  checkboxes.forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      const allChecked = Array.from(checkboxes).every(cb => cb.checked);
      if (letsGoBtn) {
        letsGoBtn.disabled = !allChecked;
        if (allChecked) {
          // Play a small celebration tone
          try {
            playTone(523.25, 0.15, 0); // C5
            setTimeout(() => playTone(659.25, 0.15, 0), 100); // E5
            setTimeout(() => playTone(783.99, 0.2, 0), 200); // G5
          } catch (e) {}
        }
      }
    });
  });
  
  letsGoBtn?.addEventListener('click', () => {
    // Transition to registration form
    screens.registrationSplash?.classList.remove('active');
    screens.auth?.classList.add('active');
    elements.loginForm?.classList.remove('active');
    elements.registerForm?.classList.add('active');
    resetRegistrationState();
    loadVehicleTypes();
  });
}

// ============================================
// Driver View Tab - Map and Pinned Trips
// ============================================
let driverViewMap = null;
let driverLocationMarker = null;

// Mapbox access token (same as MapboxService.js)
const MAPBOX_ACCESS_TOKEN = 'pk.eyJ1IjoiZXJpeGNvYWNoIiwiYSI6ImNtaDdocXI0NDB1dW4yaW9tZWFka3NocHAifQ.h1czc1VBwbBJQbdJTU5HHA';

// Wait for Mapbox GL JS to load
function waitForMapbox(timeout = 5000) {
  return new Promise((resolve, reject) => {
    if (window.mapboxgl) {
      resolve(window.mapboxgl);
      return;
    }
    
    const startTime = Date.now();
    const checkInterval = setInterval(() => {
      if (window.mapboxgl) {
        clearInterval(checkInterval);
        resolve(window.mapboxgl);
      } else if (Date.now() - startTime > timeout) {
        clearInterval(checkInterval);
        reject(new Error('Mapbox GL JS did not load in time'));
      }
    }, 100);
  });
}

async function initDriverViewMap() {
  const mapContainer = document.getElementById('driverViewMap');
  if (!mapContainer) {
    console.error('[DriverPortal] Map container not found');
    return;
  }
  
  // If map already initialized, just resize
  if (driverViewMap) {
    console.log('[DriverPortal] Map already initialized, resizing');
    driverViewMap.resize();
    return;
  }
  
  try {
    // Wait for Mapbox to be available
    console.log('[DriverPortal] Waiting for Mapbox GL JS...');
    await waitForMapbox();
    console.log('[DriverPortal] Mapbox GL JS loaded');
    
    mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;
    
    // Get driver's current location
    const position = await getCurrentPosition().catch(err => {
      console.warn('[DriverPortal] Could not get location:', err.message);
      return null;
    });
    const center = position 
      ? [position.coords.longitude, position.coords.latitude]
      : [-95.3698, 29.7604]; // Default to Houston [lng, lat]
    
    console.log('[DriverPortal] Initializing map at', center);
    
    // Clear placeholder
    const placeholder = mapContainer.querySelector('.map-placeholder');
    if (placeholder) placeholder.style.display = 'none';
    
    driverViewMap = new mapboxgl.Map({
      container: mapContainer,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: center,
      zoom: 12
    });
    
    // Add navigation controls
    driverViewMap.addControl(new mapboxgl.NavigationControl(), 'top-right');
    
    // Add driver's location marker
    if (position) {
      // Create a custom marker element
      const markerEl = document.createElement('div');
      markerEl.className = 'driver-location-marker';
      markerEl.innerHTML = `
        <div style="
          width: 24px;
          height: 24px;
          background: #4f46e5;
          border: 3px solid #fff;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0,0,0,0.5);
        "></div>
      `;
      
      driverLocationMarker = new mapboxgl.Marker(markerEl)
        .setLngLat(center)
        .addTo(driverViewMap);
    }
    
    // Add geolocate control
    const geolocate = new mapboxgl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showUserHeading: true
    });
    driverViewMap.addControl(geolocate, 'top-right');
    
    console.log('[DriverPortal] Driver view Mapbox map initialized');
  } catch (err) {
    console.error('[DriverPortal] Mapbox map initialization error:', err);
    // Show error in placeholder
    const placeholder = mapContainer.querySelector('.map-placeholder');
    if (placeholder) {
      placeholder.innerHTML = `
        <div class="map-loading">
          <span>⚠️</span>
          <p>Map failed to load: ${err.message}</p>
        </div>
      `;
      placeholder.style.display = 'flex';
    }
  }
}

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000
    });
  });
}

async function loadPinnedTrips() {
  const pinnedList = document.getElementById('pinnedTripsList');
  const emptyState = document.getElementById('pinnedTripsEmpty');
  
  if (!pinnedList || !state.driver?.id) return;
  
  try {
    // Fetch assigned trips for this driver
    const response = await fetch(
      `${window.ENV?.SUPABASE_URL}/rest/v1/reservations?assigned_driver_id=eq.${state.driver.id}&select=*&order=pu_date.asc,pu_time.asc`,
      {
        headers: {
          'apikey': window.ENV?.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${window.ENV?.SUPABASE_ANON_KEY}`
        }
      }
    );
    
    const trips = await response.json();
    
    if (!trips || trips.length === 0) {
      if (emptyState) emptyState.style.display = 'block';
      return;
    }
    
    if (emptyState) emptyState.style.display = 'none';
    
    // Render pinned trip cards
    const tripCards = trips.slice(0, 10).map(trip => {
      const puTime = trip.pu_time ? formatTime(trip.pu_time) : '--:--';
      const puDate = trip.pu_date ? formatShortDate(trip.pu_date) : '';
      const passenger = trip.passenger_name || trip.passenger_first_name || 'Passenger';
      const location = trip.pu_address || trip.pu_location || 'Location TBD';
      
      return `
        <div class="pinned-trip-card" data-trip-id="${trip.id}">
          <div class="pinned-trip-time">
            <span class="time">${puTime}</span>
            <span class="date">${puDate}</span>
          </div>
          <div class="pinned-trip-info">
            <div class="pinned-trip-passenger">${passenger}</div>
            <div class="pinned-trip-location">📍 ${location}</div>
          </div>
          <div class="pinned-trip-pin">📌</div>
        </div>
      `;
    }).join('');
    
    // Keep empty state but add cards before it
    pinnedList.innerHTML = tripCards + (emptyState ? emptyState.outerHTML : '');
    
    // Add click handlers to trip cards
    pinnedList.querySelectorAll('.pinned-trip-card').forEach(card => {
      card.addEventListener('click', () => {
        const tripId = card.dataset.tripId;
        if (tripId) {
          showTripDetail(tripId);
        }
      });
    });
    
    // Update map markers if map is initialized
    if (driverViewMap && trips.length > 0) {
      addTripMarkersToMap(trips);
    }
    
  } catch (err) {
    console.error('[DriverPortal] Error loading pinned trips:', err);
  }
}

function addTripMarkersToMap(trips) {
  if (!driverViewMap || !window.google) return;
  
  trips.forEach((trip, index) => {
    // If we have coordinates, add a marker
    if (trip.pu_lat && trip.pu_lng) {
      const marker = new google.maps.Marker({
        position: { lat: parseFloat(trip.pu_lat), lng: parseFloat(trip.pu_lng) },
        map: driverViewMap,
        label: {
          text: (index + 1).toString(),
          color: '#fff',
          fontWeight: 'bold'
        },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 15,
          fillColor: '#10b981',
          fillOpacity: 0.9,
          strokeColor: '#fff',
          strokeWeight: 2
        },
        title: `${trip.pu_time || ''} - ${trip.passenger_name || 'Pickup'}`
      });
      
      marker.addListener('click', () => {
        showTripDetail(trip.id);
      });
    }
  });
}

function formatShortDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ============================================
// Event Listeners
// ============================================
function setupEventListeners() {
  // Auth toggles
  elements.showRegisterBtn?.addEventListener('click', async () => {
    // Show the splash screen with tones and checklist
    await showRegistrationSplash();
  });
  
  elements.showLoginBtn?.addEventListener('click', () => {
    elements.registerForm.classList.remove('active');
    elements.loginForm.classList.add('active');
  });
  
  // Login
  elements.loginBtn?.addEventListener('click', handleLogin);
  
  // Registration navigation - updated for new inline OTP flow
  elements.regNextStep1?.addEventListener('click', handleStep1Continue);
  elements.regNextStep2?.addEventListener('click', handleStep2Continue);
  elements.regBackStep1b?.addEventListener('click', () => goToRegStep(1));
  elements.regBackStep2?.addEventListener('click', () => goToRegStep(1)); // Now goes back to Step 1 since no more 1b
  elements.regBackStep2b?.addEventListener('click', () => goToRegStep(2));
  elements.regBackStep3?.addEventListener('click', () => goToRegStep(2)); // Skip 2b since phone OTP is now inline
  elements.regSubmit?.addEventListener('click', handleRegistration);
  
  // Inline OTP - Send Code buttons
  document.getElementById('sendEmailOtpBtn')?.addEventListener('click', handleSendEmailOtp);
  document.getElementById('sendPhoneOtpBtn')?.addEventListener('click', handleSendPhoneOtp);
  
  // Phone OTP verification (inline)
  elements.verifyOtpBtn?.addEventListener('click', handleVerifyPhoneOtpInline);
  elements.resendOtpBtn?.addEventListener('click', handleResendPhoneOtpInline);
  setupOtpInputs();
  
  // Email OTP verification (inline)
  elements.verifyEmailOtpBtn?.addEventListener('click', handleVerifyEmailOtpInline);
  elements.resendEmailOtpBtn?.addEventListener('click', handleResendEmailOtpInline);
  initEmailOtpInputs(); // Initialize email OTP inputs
  
  // Company matching
  const companyNameInput = document.getElementById('regCompanyName');
  companyNameInput?.addEventListener('input', debounce(handleCompanySearch, 300));
  companyNameInput?.addEventListener('blur', () => {
    setTimeout(() => hideCompanyMatches(), 200);
  });
  
  // Company phone search trigger
  const companyPhoneInput = document.getElementById('regCompanyPhone');
  companyPhoneInput?.addEventListener('blur', handleCompanyPhoneSearch);
  
  // Clear selected company
  elements.clearSelectedCompany?.addEventListener('click', clearSelectedCompany);
  
  // Tabs
  elements.tabs.forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });
  
  // Menu
  elements.menuBtn?.addEventListener('click', toggleMenu);
  elements.menuOverlay?.addEventListener('click', closeMenu);
  elements.menuLogout?.addEventListener('click', handleLogout);
  elements.menuDeleteAccount?.addEventListener('click', showDeleteAccountModal);
  elements.menuVehicle?.addEventListener('click', () => {
    closeMenu();
    showVehicleScreen();
  });
  elements.menuProfile?.addEventListener('click', () => {
    closeMenu();
    showProfileScreen();
  });
  
  // Add menuSettings element reference if not defined
  const menuSettings = document.getElementById('menuSettings');
  menuSettings?.addEventListener('click', () => {
    closeMenu();
    showSettingsScreen();
  });
  
  // Vehicle Screen
  elements.vehicleBackBtn?.addEventListener('click', () => showScreen('dashboard'));
  elements.editVehicleBtn?.addEventListener('click', () => {
    showToast('Vehicle editing coming soon', 'info');
  });
  
  // Profile Screen
  elements.profileBackBtn?.addEventListener('click', () => showScreen('dashboard'));
  elements.saveProfileBtn?.addEventListener('click', saveProfile);
  elements.saveProfileMainBtn?.addEventListener('click', saveProfile);
  elements.changePhotoBtn?.addEventListener('click', () => elements.profilePhotoInput?.click());
  elements.profilePhotoPlaceholder?.addEventListener('click', () => elements.profilePhotoInput?.click());
  elements.profilePhotoInput?.addEventListener('change', handleProfilePhotoUpload);
  elements.profileBio?.addEventListener('input', updateBioCharCount);
  elements.saveCompanyInfoBtn?.addEventListener('click', saveCompanyInfo);
  
  // Settings Screen
  elements.settingsBackBtn?.addEventListener('click', () => showScreen('dashboard'));
  elements.saveSettingsBtn?.addEventListener('click', saveSettings);
  elements.changePasswordBtn?.addEventListener('click', () => showToast('Password change coming soon', 'info'));
  
  // Payment method toggles
  elements.zelleEnabled?.addEventListener('change', (e) => togglePaymentDetails('zelle', e.target.checked));
  elements.venmoEnabled?.addEventListener('change', (e) => togglePaymentDetails('venmo', e.target.checked));
  elements.cashappEnabled?.addEventListener('change', (e) => togglePaymentDetails('cashapp', e.target.checked));
  elements.bankEnabled?.addEventListener('change', (e) => togglePaymentDetails('bank', e.target.checked));
  
  // Welcome Screen - Location Permission
  elements.enableLocationBtn?.addEventListener('click', requestLocationPermission);
  elements.skipLocationBtn?.addEventListener('click', skipLocationAndContinue);
  elements.goToDashboardBtn?.addEventListener('click', () => {
    showScreen('dashboard');
  });
  
  // Online/Offline Toggle
  elements.onlineToggle?.addEventListener('change', handleOnlineToggle);
  
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
  
  // Initialize Driver View map when dashboard is shown
  if (screenName === 'dashboard') {
    // Check which tab is active, if driverview then init map
    const activeTab = document.querySelector('.tab.active');
    if (activeTab?.dataset.tab === 'driverview') {
      setTimeout(() => {
        initDriverViewMap();
        loadPinnedTrips();
      }, 100);
    }
  }
}

/**
 * Show error screen when driver ID/slug in URL is not found
 */
function showDriverNotFoundScreen(slugOrId) {
  console.log('[DriverPortal] 👤 Showing driver not found screen for:', slugOrId);
  
  // Clear any existing error message
  const existingError = document.querySelector('.driver-not-found-error');
  if (existingError) {
    existingError.remove();
  }
  
  // Create error message in the auth screen
  const authScreen = document.getElementById('authScreen');
  if (authScreen) {
    // Create error overlay
    const errorDiv = document.createElement('div');
    errorDiv.className = 'driver-not-found-error';
    errorDiv.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(26, 26, 46, 0.95);
      color: white;
      padding: 40px 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      z-index: 9999;
      backdrop-filter: blur(10px);
    `;
    
    errorDiv.innerHTML = `
      <div style="max-width: 400px;">
        <div style="font-size: 48px; margin-bottom: 20px;">🚫</div>
        <h2 style="color: #ff6b6b; margin-bottom: 15px; font-size: 24px;">Driver Portal Not Found</h2>
        <p style="margin-bottom: 10px; opacity: 0.9; line-height: 1.5;">
          The driver portal for <strong style="color: #4ecdc4;">${slugOrId}</strong> was not found in our system.
        </p>
        <p style="margin-bottom: 30px; opacity: 0.7; font-size: 14px;">
          Please check your link or contact dispatch for assistance.
        </p>
        
        <div style="display: flex; flex-direction: column; gap: 10px; max-width: 280px; margin: 0 auto;">
          <button onclick="window.location.href = window.location.origin + '/driver-portal.html'" 
                  style="background: #007cba; color: white; border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer; font-size: 16px; transition: all 0.3s;">
            🏠 Go to Main Portal
          </button>
          <button onclick="window.location.reload()" 
                  style="background: transparent; color: #4ecdc4; border: 1px solid #4ecdc4; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-size: 14px; transition: all 0.3s;">
            🔄 Reload Page
          </button>
          <a href="tel:+1234567890" 
             style="color: #ff9f43; text-decoration: none; font-size: 14px; margin-top: 10px; opacity: 0.8;">
            📞 Need Help? Call Dispatch
          </a>
        </div>
      </div>
    `;
    
    // Add hover effects
    const buttons = errorDiv.querySelectorAll('button');
    buttons.forEach(btn => {
      btn.addEventListener('mouseenter', () => {
        btn.style.transform = 'translateY(-2px)';
        btn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.transform = 'translateY(0)';
        btn.style.boxShadow = 'none';
      });
    });
    
    document.body.appendChild(errorDiv);
  }
  
  // Still show auth screen in background
  showScreen('auth');
}

// ============================================
// Welcome Screen (after registration)
// ============================================
function showWelcomeScreen(driver) {
  const fullName = `${driver.first_name || ''} ${driver.last_name || ''}`.trim() || 'Driver';
  if (elements.welcomeDriverName) {
    elements.welcomeDriverName.textContent = `Welcome, ${fullName}!`;
  }
  
  // Show the driver's unique portal URL
  const portalUrl = getDriverPortalUrl(driver);
  const portalUrlDisplay = document.getElementById('welcomePortalUrl');
  if (portalUrlDisplay) {
    portalUrlDisplay.textContent = portalUrl;
    portalUrlDisplay.href = portalUrl;
  }
  
  // Update the state with portal slug
  state.portalSlug = driver.portal_slug || generatePortalSlug(driver.first_name, driver.last_name);
  
  // Reset state
  if (elements.locationPermissionBox) elements.locationPermissionBox.style.display = 'block';
  if (elements.locationGranted) elements.locationGranted.style.display = 'none';
  if (elements.goToDashboardBtn) elements.goToDashboardBtn.style.display = 'none';
  
  showScreen('welcome');
}

async function requestLocationPermission() {
  if (!navigator.geolocation) {
    showToast('Location services not supported', 'error');
    skipLocationAndContinue();
    return;
  }
  
  elements.enableLocationBtn.disabled = true;
  elements.enableLocationBtn.textContent = 'Requesting...';
  
  try {
    const permission = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(pos),
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
    
    // Permission granted
    console.log('[DriverPortal] Location permission granted:', permission.coords);
    
    // Update driver with location preference
    if (state.driver?.id) {
      try {
        await updateDriver(state.driver.id, { 
          location_enabled: true,
          last_known_lat: permission.coords.latitude,
          last_known_lng: permission.coords.longitude
        });
      } catch (e) {
        // Non-fatal - columns might not exist
        console.warn('[DriverPortal] Could not save location preference:', e.message);
      }
    }
    
    // Show success state
    elements.locationPermissionBox.style.display = 'none';
    elements.locationGranted.style.display = 'block';
    elements.goToDashboardBtn.style.display = 'block';
    
    showToast('Location services enabled!', 'success');
    
    // Auto-continue after 2 seconds
    setTimeout(() => {
      goToDashboard();
    }, 2000);
    
  } catch (err) {
    console.warn('[DriverPortal] Location permission denied:', err.message);
    showToast('Location access denied - you can enable later in settings', 'warning');
    skipLocationAndContinue();
  }
}

function skipLocationAndContinue() {
  elements.locationPermissionBox.style.display = 'none';
  elements.goToDashboardBtn.style.display = 'block';
  
  // Auto-continue after 1 second
  setTimeout(() => {
    goToDashboard();
  }, 1000);
}

async function goToDashboard() {
  await loadDashboard();
  showScreen('dashboard');
  showToast('Welcome to RELIALIMO!', 'success');
}

// ============================================
// Online/Offline Toggle
// ============================================
async function handleOnlineToggle() {
  const isOnline = elements.onlineToggle?.checked ?? true;
  const newStatus = isOnline ? 'available' : 'offline';
  
  // Update label
  if (elements.onlineLabel) {
    elements.onlineLabel.textContent = isOnline ? 'ONLINE' : 'OFFLINE';
  }
  
  // Update driver status in database
  if (state.driver?.id) {
    try {
      await updateDriver(state.driver.id, { driver_status: newStatus });
      state.driver.driver_status = newStatus;
      updateDriverUI();
      showToast(isOnline ? 'You are now ONLINE' : 'You are now OFFLINE', isOnline ? 'success' : 'warning');
    } catch (err) {
      console.error('[DriverPortal] Failed to update online status:', err);
      showToast('Failed to update status', 'error');
      // Revert toggle
      elements.onlineToggle.checked = !isOnline;
      elements.onlineLabel.textContent = !isOnline ? 'ONLINE' : 'OFFLINE';
    }
  }
}

// ============================================
// My Vehicle Screen
// ============================================
async function showVehicleScreen() {
  showScreen('vehicle');
  
  const driver = state.driver;
  if (!driver) {
    showToast('Please log in first', 'error');
    showScreen('login');
    return;
  }
  
  // Show loading state
  document.getElementById('vehicleTitle').textContent = 'Loading...';
  
  try {
    // Fetch driver's vehicle
    let vehicle = null;
    
    // Try to get vehicle by assigned_vehicle_id on driver (if exists)
    if (driver.assigned_vehicle_id) {
      const vehicles = await fetchVehicleById(driver.assigned_vehicle_id);
      vehicle = vehicles;
    }
    
    // If no assigned vehicle, try to find by driver's organization and license plate
    if (!vehicle) {
      const allVehicles = await fetchVehicles();
      // Find a vehicle that might belong to this driver (you could add a driver_id column to vehicles)
      vehicle = allVehicles.find(v => v.organization_id === driver.organization_id);
    }
    
    if (!vehicle) {
      // Show no vehicle message
      document.getElementById('vehicleCard').style.display = 'none';
      document.querySelectorAll('.info-section').forEach(s => s.style.display = 'none');
      document.getElementById('noVehicleMessage').style.display = 'flex';
      return;
    }
    
    // Hide no vehicle message, show vehicle info
    document.getElementById('vehicleCard').style.display = 'block';
    document.querySelectorAll('#vehicleScreen .info-section').forEach(s => s.style.display = 'block');
    document.getElementById('noVehicleMessage').style.display = 'none';
    
    // Populate vehicle info
    populateVehicleInfo(vehicle);
    
  } catch (err) {
    console.error('[DriverPortal] Error loading vehicle:', err);
    showToast('Failed to load vehicle info', 'error');
  }
}

function populateVehicleInfo(vehicle) {
  // Main card
  const title = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ') || 'Vehicle';
  document.getElementById('vehicleTitle').textContent = title;
  document.getElementById('vehiclePlate').textContent = vehicle.license_plate || '---';
  
  // Set vehicle image - check cache first, then fetch from web
  const vehicleImg = document.getElementById('vehicleImg');
  const vehicleFallback = document.getElementById('vehicleIconFallback');
  
  if (vehicle.make && vehicle.model) {
    // Show loading state
    vehicleImg.style.display = 'none';
    vehicleFallback.style.display = 'flex';
    vehicleFallback.textContent = '⏳';
    
    // Load image async (cache first, then web)
    getVehicleImage(vehicle.make, vehicle.model, vehicle.year, vehicle.color)
      .then(imageData => {
        if (imageData) {
          vehicleImg.src = imageData;
          vehicleImg.style.display = 'block';
          vehicleFallback.style.display = 'none';
        } else {
          // Fallback to emoji
          vehicleImg.style.display = 'none';
          vehicleFallback.style.display = 'flex';
          vehicleFallback.textContent = '🚗';
        }
      })
      .catch(() => {
        vehicleImg.style.display = 'none';
        vehicleFallback.style.display = 'flex';
        vehicleFallback.textContent = '🚗';
      });
  } else {
    vehicleImg.style.display = 'none';
    vehicleFallback.style.display = 'flex';
    vehicleFallback.textContent = '🚗';
  }
  
  // Vehicle Details - show type name, not ID
  // fleet_vehicles uses vehicle_type_id, vehicles uses veh_type
  const vehicleTypeName = getVehicleTypeName(vehicle.vehicle_type_id || vehicle.veh_type || vehicle.vehicle_type);
  document.getElementById('vehicleType').textContent = vehicleTypeName || '--';
  document.getElementById('vehicleYear').textContent = vehicle.year || '--';
  document.getElementById('vehicleMake').textContent = vehicle.make || '--';
  document.getElementById('vehicleModel').textContent = vehicle.model || '--';
  document.getElementById('vehicleColor').textContent = vehicle.color || '--';
  // fleet_vehicles uses passenger_capacity, vehicles uses capacity
  document.getElementById('vehicleCapacity').textContent = 
    vehicle.passenger_capacity || vehicle.capacity || vehicle.veh_pax_capacity || '--';
  
  // Identification
  document.getElementById('vehicleLicensePlate').textContent = vehicle.license_plate || '--';
  document.getElementById('vehicleVin').textContent = vehicle.vin || '--';
  // fleet_vehicles uses unit_number, vehicles uses veh_disp_name
  document.getElementById('vehicleUnitNumber').textContent = vehicle.unit_number || vehicle.veh_disp_name || '--';
  document.getElementById('vehicleStatus').textContent = vehicle.status || '--';
  
  // Permits & Compliance
  document.getElementById('vehiclePermitNumber').textContent = vehicle.limo_permit_number || '--';
  document.getElementById('vehiclePermitExp').textContent = 
    vehicle.permit_expiration_month && vehicle.permit_expiration_year 
      ? `${vehicle.permit_expiration_month}/${vehicle.permit_expiration_year}` 
      : '--';
  document.getElementById('vehicleDotNumber').textContent = vehicle.us_dot_number || '--';
  
  // Insurance Information
  document.getElementById('vehicleInsuranceCompany').textContent = vehicle.insurance_company || '--';
  document.getElementById('vehicleInsurancePolicyNumber').textContent = vehicle.insurance_policy_number || '--';
  document.getElementById('vehicleInsExp').textContent = 
    vehicle.insurance_expiration ? formatDate(new Date(vehicle.insurance_expiration)) : '--';
  
  // Features
  const featuresSection = document.getElementById('vehicleFeaturesSection');
  const featuresContainer = document.getElementById('vehicleFeatures');
  
  if (vehicle.features && Array.isArray(vehicle.features) && vehicle.features.length > 0) {
    featuresSection.style.display = 'block';
    featuresContainer.innerHTML = vehicle.features.map(f => 
      `<span class="feature-tag">${f}</span>`
    ).join('');
  } else {
    featuresSection.style.display = 'none';
  }
}

// ============================================================================
// PROFILE SCREEN
// ============================================================================

async function showProfileScreen() {
  showScreen('profile');
  
  const driver = state.driver;
  if (!driver) {
    showToast('Please log in first', 'error');
    showScreen('auth');
    return;
  }
  
  // Populate contact info (read-only)
  const fullName = `${driver.first_name || ''} ${driver.last_name || ''}`.trim();
  elements.profileFullName.textContent = fullName || '--';
  elements.profileEmail.textContent = driver.email || '--';
  elements.profilePhone.textContent = formatPhone(driver.cell_phone || driver.phone) || '--';
  
  // Populate portal URL
  const portalUrl = getDriverPortalUrl(driver);
  if (elements.profilePortalUrl) {
    elements.profilePortalUrl.href = portalUrl;
    elements.profilePortalUrl.textContent = portalUrl;
  }
  
  // Load profile photo
  if (driver.profile_photo_url) {
    elements.profilePhoto.src = driver.profile_photo_url;
    elements.profilePhoto.style.display = 'block';
    elements.profilePhotoPlaceholder.style.display = 'none';
  } else {
    elements.profilePhoto.style.display = 'none';
    elements.profilePhotoPlaceholder.style.display = 'flex';
  }
  
  // Populate bio
  elements.profileBio.value = driver.bio || '';
  updateBioCharCount();
  
  // Populate years of experience
  elements.profileYearsExp.value = driver.years_experience || '';
  
  // Populate service areas
  if (document.getElementById('profileServiceAreas')) {
    document.getElementById('profileServiceAreas').value = driver.service_areas || '';
  }
  
  // Load multi-select checkboxes
  loadCheckboxValues('languages', driver.languages);
  loadCheckboxValues('specialties', driver.specialties);
  loadCheckboxValues('certifications', driver.certifications);
  loadCheckboxValues('availability', driver.availability);
  
  // Load company info if driver belongs to a company
  await loadCompanyInfo(driver);
}

function loadCheckboxValues(name, values) {
  const checkboxes = document.querySelectorAll(`input[name="${name}"]`);
  const valueArray = Array.isArray(values) ? values : (values ? values.split(',') : []);
  
  checkboxes.forEach(checkbox => {
    checkbox.checked = valueArray.includes(checkbox.value);
  });
}

function getCheckboxValues(name) {
  const checked = document.querySelectorAll(`input[name="${name}"]:checked`);
  return Array.from(checked).map(cb => cb.value);
}

function updateBioCharCount() {
  const bio = elements.profileBio?.value || '';
  if (elements.bioCharCount) {
    elements.bioCharCount.textContent = bio.length;
  }
}

async function handleProfilePhotoUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  
  // Validate file type
  if (!file.type.startsWith('image/')) {
    showToast('Please select an image file', 'error');
    return;
  }
  
  // Validate file size (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    showToast('Image must be less than 5MB', 'error');
    return;
  }
  
  showToast('Uploading photo...', 'info');
  
  try {
    const client = getSupabase();
    if (!client) throw new Error('Supabase not initialized');
    
    const driver = state.driver;
    const fileName = `${driver.id}_${Date.now()}.${file.name.split('.').pop()}`;
    const filePath = `drivers/${fileName}`;
    
    // Upload to Supabase storage
    const { data, error } = await client.storage
      .from('images')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true
      });
    
    if (error) throw error;
    
    // Get public URL
    const { data: urlData } = client.storage
      .from('images')
      .getPublicUrl(filePath);
    
    const publicUrl = urlData.publicUrl;
    
    // Update driver record
    await updateDriver(driver.id, { profile_photo_url: publicUrl });
    
    // Update local state and UI
    state.driver.profile_photo_url = publicUrl;
    elements.profilePhoto.src = publicUrl;
    elements.profilePhoto.style.display = 'block';
    elements.profilePhotoPlaceholder.style.display = 'none';
    
    // Update avatar in dashboard too
    updateDriverAvatar(publicUrl);
    
    showToast('Photo uploaded successfully!', 'success');
    
  } catch (err) {
    console.error('[DriverPortal] Photo upload error:', err);
    showToast('Failed to upload photo', 'error');
  }
}

function updateDriverAvatar(photoUrl) {
  // Update all avatar elements to show the photo
  const avatars = document.querySelectorAll('.driver-avatar');
  avatars.forEach(avatar => {
    if (photoUrl) {
      avatar.innerHTML = `<img src="${photoUrl}" alt="Profile" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
    } else {
      const driver = state.driver;
      const initials = `${driver.first_name?.[0] || ''}${driver.last_name?.[0] || ''}`.toUpperCase() || '?';
      avatar.textContent = initials;
    }
  });
}

async function saveProfile() {
  const driver = state.driver;
  if (!driver) {
    showToast('Please log in first', 'error');
    return;
  }
  
  elements.saveProfileMainBtn.disabled = true;
  elements.saveProfileMainBtn.textContent = 'Saving...';
  
  try {
    const profileData = {
      bio: elements.profileBio?.value?.trim() || null,
      years_experience: elements.profileYearsExp?.value || null,
      languages: getCheckboxValues('languages'),
      specialties: getCheckboxValues('specialties'),
      certifications: getCheckboxValues('certifications'),
      availability: getCheckboxValues('availability'),
      service_areas: document.getElementById('profileServiceAreas')?.value?.trim() || null
    };
    
    console.log('[DriverPortal] Saving profile:', profileData);
    
    await updateDriver(driver.id, profileData);
    
    // Update local state
    Object.assign(state.driver, profileData);
    
    showToast('Profile saved successfully!', 'success');
    
  } catch (err) {
    console.error('[DriverPortal] Save profile error:', err);
    showToast('Failed to save profile', 'error');
  } finally {
    elements.saveProfileMainBtn.disabled = false;
    elements.saveProfileMainBtn.textContent = '💾 Save Profile';
  }
}

// ============================================================================
// COMPANY INFO FUNCTIONS
// ============================================================================

async function loadCompanyInfo(driver) {
  const companySection = elements.companyInfoSection;
  if (!companySection) return;
  
  // Hide by default
  companySection.style.display = 'none';
  
  // Check if driver has an affiliate_id
  if (!driver.affiliate_id) {
    console.log('[DriverPortal] Driver has no affiliate_id, hiding company section');
    return;
  }
  
  try {
    console.log('[DriverPortal] Loading company info for affiliate_id:', driver.affiliate_id);
    
    // Fetch affiliate data
    const affiliates = await fetchAffiliates();
    const affiliate = affiliates.find(a => a.id === driver.affiliate_id);
    
    if (!affiliate) {
      console.log('[DriverPortal] Affiliate not found:', driver.affiliate_id);
      return;
    }
    
    // Store affiliate in state for later use
    state.affiliate = affiliate;
    
    // Show the section
    companySection.style.display = 'block';
    
    // Populate fields
    if (elements.profileCompanyName) {
      elements.profileCompanyName.value = affiliate.company_name || '';
    }
    if (elements.profileCompanyAddress) {
      // Use primary_address or address field
      elements.profileCompanyAddress.value = affiliate.primary_address || affiliate.address || '';
    }
    if (elements.profileCompanyPhone) {
      elements.profileCompanyPhone.value = affiliate.phone || '';
    }
    
    console.log('[DriverPortal] Company info loaded:', affiliate.company_name);
    
  } catch (err) {
    console.error('[DriverPortal] Error loading company info:', err);
  }
}

async function saveCompanyInfo() {
  const driver = state.driver;
  const affiliate = state.affiliate;
  
  if (!driver || !affiliate) {
    showToast('No company associated with this driver', 'error');
    return;
  }
  
  const saveBtn = elements.saveCompanyInfoBtn;
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
  }
  
  try {
    const companyData = {
      company_name: elements.profileCompanyName?.value?.trim() || null,
      primary_address: elements.profileCompanyAddress?.value?.trim() || null,
      phone: elements.profileCompanyPhone?.value?.trim() || null
    };
    
    console.log('[DriverPortal] Saving company info:', companyData);
    
    // Update affiliate in database
    await updateAffiliate(affiliate.id, companyData);
    
    // Update local state
    Object.assign(state.affiliate, companyData);
    
    showToast('Company info saved successfully!', 'success');
    
  } catch (err) {
    console.error('[DriverPortal] Save company error:', err);
    showToast('Failed to save company info', 'error');
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = '💾 Save Company Info';
    }
  }
}

// ============================================================================
// SETTINGS SCREEN
// ============================================================================

async function showSettingsScreen() {
  showScreen('settings');
  
  const driver = state.driver;
  if (!driver) {
    showToast('Please log in first', 'error');
    showScreen('auth');
    return;
  }
  
  // Load settings from driver record or local storage
  const settings = driver.settings || {};
  
  // Payment Methods
  loadPaymentSettings(settings.payments || {});
  
  // Navigation preferences
  if (elements.preferredMapApp) elements.preferredMapApp.value = settings.preferred_map_app || 'internal';
  if (elements.trafficUpdates) elements.trafficUpdates.value = settings.traffic_updates || 'always';
  if (elements.avoidTolls) elements.avoidTolls.checked = settings.avoid_tolls || false;
  if (elements.avoidHighways) elements.avoidHighways.checked = settings.avoid_highways || false;
  
  // Notifications
  if (elements.pushNotifications) elements.pushNotifications.checked = settings.push_notifications !== false;
  if (elements.smsNotifications) elements.smsNotifications.checked = settings.sms_notifications !== false;
  if (elements.emailNotifications) elements.emailNotifications.checked = settings.email_notifications !== false;
  if (elements.soundAlerts) elements.soundAlerts.checked = settings.sound_alerts !== false;
  
  // Trip preferences
  if (elements.autoAcceptRadius) elements.autoAcceptRadius.value = settings.auto_accept_radius || '0';
  if (elements.minTripFare) elements.minTripFare.value = settings.min_trip_fare || 0;
  if (elements.maxPickupDistance) elements.maxPickupDistance.value = settings.max_pickup_distance || 50;
  
  // Privacy
  if (elements.locationSharing) elements.locationSharing.checked = settings.location_sharing !== false;
  if (elements.showPhoneToPassengers) elements.showPhoneToPassengers.checked = settings.show_phone_to_passengers || false;
  
  // App preferences
  if (elements.themePreference) elements.themePreference.value = settings.theme || 'dark';
  if (elements.distanceUnit) elements.distanceUnit.value = settings.distance_unit || 'miles';
  if (elements.timeFormat) elements.timeFormat.value = settings.time_format || '12h';
}

function loadPaymentSettings(payments) {
  // Zelle
  const zelleEnabled = !!payments.zelle?.enabled;
  if (elements.zelleEnabled) elements.zelleEnabled.checked = zelleEnabled;
  if (elements.zelleEmail) elements.zelleEmail.value = payments.zelle?.email || '';
  if (elements.zelleName) elements.zelleName.value = payments.zelle?.name || '';
  togglePaymentDetails('zelle', zelleEnabled);
  updatePaymentStatus('zelle', payments.zelle);
  
  // Venmo
  const venmoEnabled = !!payments.venmo?.enabled;
  if (elements.venmoEnabled) elements.venmoEnabled.checked = venmoEnabled;
  if (elements.venmoUsername) elements.venmoUsername.value = payments.venmo?.username || '';
  togglePaymentDetails('venmo', venmoEnabled);
  updatePaymentStatus('venmo', payments.venmo);
  
  // Cash App
  const cashappEnabled = !!payments.cashapp?.enabled;
  if (elements.cashappEnabled) elements.cashappEnabled.checked = cashappEnabled;
  if (elements.cashappTag) elements.cashappTag.value = payments.cashapp?.tag || '';
  togglePaymentDetails('cashapp', cashappEnabled);
  updatePaymentStatus('cashapp', payments.cashapp);
  
  // Bank
  const bankEnabled = !!payments.bank?.enabled;
  if (elements.bankEnabled) elements.bankEnabled.checked = bankEnabled;
  const bankName = document.getElementById('bankName');
  const bankRouting = document.getElementById('bankRouting');
  const bankAccount = document.getElementById('bankAccount');
  const bankAccountType = document.getElementById('bankAccountType');
  if (bankName) bankName.value = payments.bank?.bank_name || '';
  if (bankRouting) bankRouting.value = payments.bank?.routing || '';
  if (bankAccount) bankAccount.value = payments.bank?.account ? '••••' + payments.bank.account.slice(-4) : '';
  if (bankAccountType) bankAccountType.value = payments.bank?.account_type || 'checking';
  togglePaymentDetails('bank', bankEnabled);
  updatePaymentStatus('bank', payments.bank);
}

function togglePaymentDetails(method, show) {
  const detailsEl = document.getElementById(`${method}Details`);
  if (detailsEl) {
    detailsEl.style.display = show ? 'block' : 'none';
  }
}

function updatePaymentStatus(method, data) {
  const statusEl = document.getElementById(`${method}Status`);
  if (!statusEl) return;
  
  if (data?.enabled) {
    statusEl.textContent = 'Configured ✓';
    statusEl.classList.add('configured');
  } else {
    statusEl.textContent = 'Not configured';
    statusEl.classList.remove('configured');
  }
}

async function saveSettings() {
  const driver = state.driver;
  if (!driver) {
    showToast('Please log in first', 'error');
    return;
  }
  
  elements.saveSettingsBtn.disabled = true;
  elements.saveSettingsBtn.textContent = 'Saving...';
  
  try {
    // Collect all settings
    const settings = {
      // Payment methods
      payments: {
        zelle: {
          enabled: elements.zelleEnabled?.checked || false,
          email: elements.zelleEmail?.value?.trim() || null,
          name: elements.zelleName?.value?.trim() || null
        },
        venmo: {
          enabled: elements.venmoEnabled?.checked || false,
          username: elements.venmoUsername?.value?.trim() || null
        },
        cashapp: {
          enabled: elements.cashappEnabled?.checked || false,
          tag: elements.cashappTag?.value?.trim() || null
        },
        bank: {
          enabled: elements.bankEnabled?.checked || false,
          bank_name: document.getElementById('bankName')?.value?.trim() || null,
          routing: document.getElementById('bankRouting')?.value?.trim() || null,
          account: document.getElementById('bankAccount')?.value?.includes('••••') 
            ? (driver.settings?.payments?.bank?.account || null) // Keep existing
            : (document.getElementById('bankAccount')?.value?.trim() || null),
          account_type: document.getElementById('bankAccountType')?.value || 'checking'
        }
      },
      // Navigation
      preferred_map_app: elements.preferredMapApp?.value || 'internal',
      traffic_updates: elements.trafficUpdates?.value || 'always',
      avoid_tolls: elements.avoidTolls?.checked || false,
      avoid_highways: elements.avoidHighways?.checked || false,
      // Notifications
      push_notifications: elements.pushNotifications?.checked ?? true,
      sms_notifications: elements.smsNotifications?.checked ?? true,
      email_notifications: elements.emailNotifications?.checked ?? true,
      sound_alerts: elements.soundAlerts?.checked ?? true,
      // Trip preferences
      auto_accept_radius: elements.autoAcceptRadius?.value || '0',
      min_trip_fare: parseFloat(elements.minTripFare?.value) || 0,
      max_pickup_distance: parseFloat(elements.maxPickupDistance?.value) || 50,
      // Privacy
      location_sharing: elements.locationSharing?.checked ?? true,
      show_phone_to_passengers: elements.showPhoneToPassengers?.checked || false,
      // App
      theme: elements.themePreference?.value || 'dark',
      distance_unit: elements.distanceUnit?.value || 'miles',
      time_format: elements.timeFormat?.value || '12h'
    };
    
    console.log('[DriverPortal] Saving settings:', settings);
    
    // Save to driver record
    await updateDriver(driver.id, { settings });
    
    // Update local state
    state.driver.settings = settings;
    
    // Apply theme if changed
    applyTheme(settings.theme);
    
    showToast('Settings saved successfully!', 'success');
    
  } catch (err) {
    console.error('[DriverPortal] Save settings error:', err);
    showToast('Failed to save settings', 'error');
  } finally {
    elements.saveSettingsBtn.disabled = false;
    elements.saveSettingsBtn.textContent = '💾 Save Settings';
  }
}

function applyTheme(theme) {
  // For now just log - full theme implementation can be added later
  console.log('[DriverPortal] Theme preference:', theme);
  // document.documentElement.setAttribute('data-theme', theme);
}

// Helper to get navigation URL based on preference
function getNavigationUrl(destination, origin = null) {
  const driver = state.driver;
  const mapApp = driver?.settings?.preferred_map_app || 'internal';
  const avoidTolls = driver?.settings?.avoid_tolls || false;
  const avoidHighways = driver?.settings?.avoid_highways || false;
  
  const encodedDest = encodeURIComponent(destination);
  const encodedOrigin = origin ? encodeURIComponent(origin) : '';
  
  switch (mapApp) {
    case 'google_maps':
      let googleUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodedDest}`;
      if (origin) googleUrl += `&origin=${encodedOrigin}`;
      if (avoidTolls) googleUrl += '&avoid=tolls';
      if (avoidHighways) googleUrl += '&avoid=highways';
      return googleUrl;
      
    case 'apple_maps':
      return `http://maps.apple.com/?daddr=${encodedDest}${origin ? `&saddr=${encodedOrigin}` : ''}`;
      
    case 'waze':
      return `https://waze.com/ul?q=${encodedDest}&navigate=yes`;
      
    case 'mapbox':
      // Mapbox Navigation SDK - would need coords
      return `https://api.mapbox.com/directions/v5/mapbox/driving/${encodedDest}`;
      
    case 'internal':
    default:
      // Return internal map URL or just the destination for internal handling
      return null; // Will trigger internal map display
  }
}

// ============================================================================
// VEHICLE IMAGE CACHING SYSTEM
// Uses Supabase Storage bucket (images/vehicles) to cache vehicle images
// ============================================================================

const VEHICLE_IMAGE_BUCKET = 'images';
const VEHICLE_IMAGE_FOLDER = 'vehicles';

// Generate cache key/filename from vehicle details
function getVehicleImageCacheKey(make, model, year, color) {
  const normalizedMake = (make || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const modelParts = (model || '').toLowerCase().split(/\s+/);
  const modelFamily = modelParts[0]?.replace(/[^a-z0-9]/g, '') || '';
  const normalizedColor = (color || '').toLowerCase().replace(/[^a-z]/g, '') || 'black';
  const normalizedYear = year || 'unknown';
  
  return `${normalizedMake}_${modelFamily}_${normalizedYear}_${normalizedColor}`;
}

// Get the Supabase storage URL for a vehicle image
function getSupabaseVehicleImageUrl(cacheKey) {
  const supabaseUrl = window.ENV?.SUPABASE_URL || '';
  return `${supabaseUrl}/storage/v1/object/public/${VEHICLE_IMAGE_BUCKET}/${VEHICLE_IMAGE_FOLDER}/${cacheKey}.png`;
}

// Check if image exists in Supabase storage bucket
async function getCachedVehicleImage(cacheKey) {
  const imageUrl = getSupabaseVehicleImageUrl(cacheKey);
  
  try {
    // Try to fetch the image from Supabase storage
    const response = await fetch(imageUrl, { method: 'HEAD' });
    
    if (response.ok) {
      console.log('[VehicleImageCache] Supabase cache HIT:', cacheKey);
      return imageUrl; // Return the public URL
    } else {
      console.log('[VehicleImageCache] Supabase cache MISS:', cacheKey);
      return null;
    }
  } catch (err) {
    console.log('[VehicleImageCache] Supabase cache check error:', err.message);
    return null;
  }
}

// Upload image to Supabase storage bucket
async function cacheVehicleImage(cacheKey, imageBlob) {
  const supabaseUrl = window.ENV?.SUPABASE_URL || '';
  const supabaseKey = window.ENV?.SUPABASE_ANON_KEY || '';
  
  if (!supabaseUrl || !supabaseKey) {
    console.warn('[VehicleImageCache] Supabase not configured');
    return null;
  }
  
  const filePath = `${VEHICLE_IMAGE_FOLDER}/${cacheKey}.png`;
  const uploadUrl = `${supabaseUrl}/storage/v1/object/${VEHICLE_IMAGE_BUCKET}/${filePath}`;
  
  try {
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
        'Content-Type': 'image/png',
        'x-upsert': 'true' // Overwrite if exists
      },
      body: imageBlob
    });
    
    if (response.ok) {
      console.log('[VehicleImageCache] Image uploaded to Supabase:', cacheKey);
      return getSupabaseVehicleImageUrl(cacheKey);
    } else {
      const error = await response.text();
      console.warn('[VehicleImageCache] Upload failed:', response.status, error);
      return null;
    }
  } catch (err) {
    console.warn('[VehicleImageCache] Upload error:', err);
    return null;
  }
}

// Fetch image from IMAGIN.studio as blob
async function fetchVehicleImageFromWeb(make, model, year, color) {
  const url = getVehicleImageUrl(make, model, year, color);
  console.log('[VehicleImageCache] Fetching from IMAGIN.studio:', url);
  
  try {
    const response = await fetch(url, { mode: 'cors' });
    
    if (!response.ok) {
      console.warn('[VehicleImageCache] Fetch failed:', response.status);
      return null;
    }
    
    const blob = await response.blob();
    return blob;
  } catch (err) {
    console.warn('[VehicleImageCache] Fetch error:', err);
    return null;
  }
}

// Main function: Get vehicle image (Supabase first, then web, then cache to Supabase)
async function getVehicleImage(make, model, year, color) {
  if (!make || !model) {
    return null;
  }
  
  const cacheKey = getVehicleImageCacheKey(make, model, year, color);
  
  // 1. Check Supabase storage first
  let imageUrl = await getCachedVehicleImage(cacheKey);
  
  if (imageUrl) {
    return imageUrl;
  }
  
  // 2. Fetch from IMAGIN.studio
  const imageBlob = await fetchVehicleImageFromWeb(make, model, year, color);
  
  if (imageBlob) {
    // 3. Upload to Supabase storage for future use
    imageUrl = await cacheVehicleImage(cacheKey, imageBlob);
    
    if (imageUrl) {
      return imageUrl;
    }
    
    // Fallback: return blob as data URL if upload failed
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(imageBlob);
    });
  }
  
  return null;
}

// Pre-cache common fleet vehicle images to Supabase storage
async function preCacheFleetVehicleImages() {
  console.log('[VehicleImageCache] Starting pre-cache of common fleet vehicles to Supabase...');
  
  const fleetVehicles = [
    // Chevy Suburban
    { make: 'Chevrolet', model: 'Suburban', year: 2024, color: 'black' },
    { make: 'Chevrolet', model: 'Suburban', year: 2025, color: 'black' },
    { make: 'Chevrolet', model: 'Suburban', year: 2026, color: 'black' },
    // GMC Yukon Denali
    { make: 'GMC', model: 'Yukon Denali', year: 2024, color: 'black' },
    { make: 'GMC', model: 'Yukon Denali', year: 2025, color: 'black' },
    { make: 'GMC', model: 'Yukon Denali', year: 2026, color: 'black' },
    // Cadillac Escalade
    { make: 'Cadillac', model: 'Escalade', year: 2024, color: 'black' },
    { make: 'Cadillac', model: 'Escalade', year: 2025, color: 'black' },
    { make: 'Cadillac', model: 'Escalade', year: 2026, color: 'black' },
    // Cadillac Escalade ESV
    { make: 'Cadillac', model: 'Escalade ESV', year: 2024, color: 'black' },
    { make: 'Cadillac', model: 'Escalade ESV', year: 2025, color: 'black' },
    { make: 'Cadillac', model: 'Escalade ESV', year: 2026, color: 'black' },
    // Lincoln Navigator
    { make: 'Lincoln', model: 'Navigator', year: 2024, color: 'black' },
    { make: 'Lincoln', model: 'Navigator', year: 2025, color: 'black' },
    { make: 'Lincoln', model: 'Navigator', year: 2026, color: 'black' },
    // Mercedes S-Class
    { make: 'Mercedes', model: 'S-Class', year: 2024, color: 'black' },
    { make: 'Mercedes', model: 'S-Class', year: 2025, color: 'black' },
    { make: 'Mercedes', model: 'S-Class', year: 2026, color: 'black' },
  ];
  
  let cached = 0;
  let skipped = 0;
  
  for (const vehicle of fleetVehicles) {
    const cacheKey = getVehicleImageCacheKey(vehicle.make, vehicle.model, vehicle.year, vehicle.color);
    
    // Check if already in Supabase
    const existing = await getCachedVehicleImage(cacheKey);
    if (existing) {
      skipped++;
      continue;
    }
    
    // Fetch from web and upload to Supabase
    const imageBlob = await fetchVehicleImageFromWeb(vehicle.make, vehicle.model, vehicle.year, vehicle.color);
    if (imageBlob) {
      const uploaded = await cacheVehicleImage(cacheKey, imageBlob);
      if (uploaded) {
        cached++;
      }
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log(`[VehicleImageCache] Pre-cache complete: ${cached} new, ${skipped} already cached`);
  return { cached, skipped };
}

// Generate vehicle image URL from IMAGIN.studio CDN
function getVehicleImageUrl(make, model, year, color) {
  // Normalize make and model for URL (lowercase, remove spaces)
  const normalizedMake = (make || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  // Model family is typically the first word of the model
  const modelParts = (model || '').toLowerCase().split(/\s+/);
  const modelFamily = modelParts[0]?.replace(/[^a-z0-9]/g, '') || '';
  
  // Map common color names to IMAGIN paint IDs
  const colorToPaintId = {
    'black': 'pspc0020',
    'white': 'pspc0001',
    'silver': 'pspc0010',
    'gray': 'pspc0012',
    'grey': 'pspc0012',
    'red': 'pspc0035',
    'blue': 'pspc0049',
    'green': 'pspc0060',
    'yellow': 'pspc0072',
    'orange': 'pspc0078',
    'brown': 'pspc0082',
    'beige': 'pspc0084',
    'gold': 'pspc0086',
    'burgundy': 'pspc0040',
    'maroon': 'pspc0040'
  };
  
  const normalizedColor = (color || '').toLowerCase();
  const paintId = colorToPaintId[normalizedColor] || 'pspc0020'; // Default to black
  
  // Build IMAGIN.studio URL
  const params = new URLSearchParams({
    customer: 'img',
    make: normalizedMake,
    modelFamily: modelFamily,
    modelYear: year || new Date().getFullYear(),
    paintId: paintId,
    angle: '23', // 3/4 front view
    width: '600'
  });
  
  return `https://cdn.imagin.studio/getImage?${params.toString()}`;
}

// Get vehicle type name from ID using cached vehicle types
function getVehicleTypeName(typeIdOrName) {
  if (!typeIdOrName) return null;
  
  // If it's already a name (not a UUID), return it
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(typeIdOrName)) {
    return typeIdOrName;
  }
  
  // Look up in cached vehicle types
  const vehicleType = state.vehicleTypes?.find(vt => vt.id === typeIdOrName);
  return vehicleType?.name || vehicleType?.veh_title || typeIdOrName;
}

async function fetchVehicleById(id) {
  try {
    // Fetch from fleet_vehicles table
    const url = `${window.ENV?.SUPABASE_URL || ''}/rest/v1/fleet_vehicles?id=eq.${id}`;
    const resp = await fetch(url, {
      headers: {
        'apikey': window.ENV?.SUPABASE_ANON_KEY || '',
        'Authorization': `Bearer ${window.ENV?.SUPABASE_ANON_KEY || ''}`
      }
    });
    const data = await resp.json();
    return Array.isArray(data) && data.length > 0 ? data[0] : null;
  } catch (err) {
    console.error('[DriverPortal] fetchVehicleById error:', err);
    return null;
  }
}

async function fetchVehicles() {
  try {
    // Fetch from fleet_vehicles table (primary) 
    const url = `${window.ENV?.SUPABASE_URL || ''}/rest/v1/fleet_vehicles?order=created_at.desc`;
    const resp = await fetch(url, {
      headers: {
        'apikey': window.ENV?.SUPABASE_ANON_KEY || '',
        'Authorization': `Bearer ${window.ENV?.SUPABASE_ANON_KEY || ''}`
      }
    });
    return await resp.json();
  } catch (err) {
    console.error('[DriverPortal] fetchVehicles error:', err);
    return [];
  }
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
    
    // Check for offer parameter and highlight/show the offer
    await handleOfferParameter();
    
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
    console.log('[DriverPortal] Deleting fleet vehicles for driver:', driverId);
    const { error: vehicleError } = await client
      .from('fleet_vehicles')
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
// Utility Functions
// ============================================
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function normalizePhone(phone) {
  if (!phone) return '';
  return phone.replace(/\D/g, '').slice(-10);
}

function normalizeString(str) {
  if (!str) return '';
  return str.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
}

// ============================================
// Registration - Step Navigation & Validation
// ============================================
function goToRegStep(step) {
  // Hide all steps
  document.querySelectorAll('.register-step').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.step-indicator .step').forEach(s => {
    s.classList.remove('active', 'completed');
  });
  
  // Show target step (handle 1b and 2b special cases)
  const stepId = (step === '1b' || step === '2b') ? `registerStep${step}` : `registerStep${step}`;
  document.getElementById(stepId)?.classList.add('active');
  
  // Update step indicators
  const stepOrder = ['1', '1b', '2', '2b', '3'];
  const targetIndex = stepOrder.indexOf(step.toString());
  
  stepOrder.forEach((s, i) => {
    const indicator = document.querySelector(`.step-indicator .step[data-step="${s}"]`);
    if (indicator) {
      if (i < targetIndex) indicator.classList.add('completed');
      if (s === step.toString()) indicator.classList.add('active');
    }
  });
  
  // Initialize email OTP inputs when going to step 1b
  if (step === '1b') {
    initEmailOtpInputs();
    document.getElementById('emailOtpDigit1')?.focus();
  }
}

// Step 1: Personal Info - with inline OTP verification
async function handleStep1Continue() {
  const firstName = document.getElementById('regFirstName').value.trim();
  const lastName = document.getElementById('regLastName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const phone = document.getElementById('regPhone').value.trim();
  const password = document.getElementById('regPassword').value;
  
  // Validate all fields
  if (!firstName || !lastName) {
    showToast('Please enter your name', 'error');
    return;
  }
  if (!email || !email.includes('@')) {
    showToast('Please enter a valid email', 'error');
    return;
  }
  if (!phone) {
    showToast('Please enter your phone number', 'error');
    return;
  }
  if (!password || password.length < 8) {
    showToast('Password must be at least 8 characters', 'error');
    return;
  }
  
  // Check that both verifications are complete
  if (!state.emailVerified) {
    showToast('Please verify your email first', 'error');
    return;
  }
  if (!state.phoneVerified) {
    showToast('Please verify your phone first', 'error');
    return;
  }
  
  const btn = elements.regNextStep1;
  btn.disabled = true;
  btn.textContent = 'Continuing...';
  
  try {
    // Store password for later use during registration
    state.pendingPassword = password;
    
    console.log('[DriverPortal] Step 1 complete, both email and phone verified');
    
    // Go directly to Step 2 (Company Info)
    goToRegStep(2);
    
  } catch (err) {
    console.error('[DriverPortal] Step 1 error:', err);
    showToast(err.message || 'Failed to continue', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Continue →';
  }
}

// Step 2: Company Info - proceed to vehicle info (no more phone OTP step)
async function handleStep2Continue() {
  // Company info is optional, just proceed to step 3
  const btn = elements.regNextStep2;
  btn.disabled = true;
  btn.textContent = 'Continuing...';
  
  try {
    // Go directly to Step 3 (Vehicle Info) - no more Step 2b
    goToRegStep(3);
    
  } catch (err) {
    console.error('[DriverPortal] Step 2 error:', err);
    showToast(err.message || 'Failed to continue', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Continue →';
  }
}

// ============================================
// Company Matching
// ============================================
async function handleCompanySearch(event) {
  const query = event.target.value.trim();
  
  if (query.length < 2) {
    hideCompanyMatches();
    return;
  }
  
  try {
    const affiliates = await fetchAffiliates();
    const matches = findMatchingCompanies(affiliates, { name: query });
    displayCompanyMatches(matches, query);
  } catch (err) {
    console.error('[DriverPortal] Company search error:', err);
  }
}

async function handleCompanyPhoneSearch() {
  const phone = document.getElementById('regCompanyPhone').value.trim();
  const name = document.getElementById('regCompanyName').value.trim();
  const address = document.getElementById('regCompanyAddress').value.trim();
  
  if (!phone && !name) return;
  
  try {
    const affiliates = await fetchAffiliates();
    const matches = findMatchingCompanies(affiliates, { name, phone, address });
    
    if (matches.length > 0 && !state.selectedAffiliate) {
      displayCompanyMatches(matches, name);
    }
  } catch (err) {
    console.error('[DriverPortal] Company phone search error:', err);
  }
}

function findMatchingCompanies(affiliates, criteria) {
  if (!affiliates || !affiliates.length) return [];
  
  const normalizedName = normalizeString(criteria.name);
  const normalizedPhone = normalizePhone(criteria.phone);
  const normalizedAddress = normalizeString(criteria.address);
  
  return affiliates.map(aff => {
    const matches = [];
    let score = 0;
    
    // Name match
    const affName = normalizeString(aff.company_name);
    if (affName && normalizedName) {
      if (affName === normalizedName) {
        matches.push('name-exact');
        score += 100;
      } else if (affName.includes(normalizedName) || normalizedName.includes(affName)) {
        matches.push('name-partial');
        score += 50;
      }
    }
    
    // Phone match
    const affPhone = normalizePhone(aff.phone || aff.primary_phone);
    if (affPhone && normalizedPhone && affPhone === normalizedPhone) {
      matches.push('phone');
      score += 80;
    }
    
    // Address match
    const affAddress = normalizeString(aff.primary_address);
    if (affAddress && normalizedAddress) {
      if (affAddress === normalizedAddress) {
        matches.push('address-exact');
        score += 60;
      } else if (affAddress.includes(normalizedAddress) || normalizedAddress.includes(affAddress)) {
        matches.push('address-partial');
        score += 30;
      }
    }
    
    return { affiliate: aff, matches, score };
  })
  .filter(m => m.score > 0)
  .sort((a, b) => b.score - a.score)
  .slice(0, 5);
}

function displayCompanyMatches(matches, query) {
  const container = elements.companyMatchResults;
  if (!container) return;
  
  if (matches.length === 0) {
    container.innerHTML = `
      <div class="match-result-item create-new" onclick="selectCreateNewCompany()">
        <div class="match-result-name">➕ Create new company: "${query}"</div>
        <div class="match-result-detail">This company will be created when you finish registration</div>
      </div>
    `;
    container.style.display = 'block';
    return;
  }
  
  let html = matches.map(m => {
    const badges = m.matches.map(type => {
      if (type.includes('name')) return '<span class="match-badge name-match">Name</span>';
      if (type === 'phone') return '<span class="match-badge phone-match">Phone</span>';
      if (type.includes('address')) return '<span class="match-badge address-match">Address</span>';
      return '';
    }).join('');
    
    const address = [m.affiliate.primary_address, m.affiliate.city, m.affiliate.state].filter(Boolean).join(', ');
    const phone = m.affiliate.phone || m.affiliate.primary_phone || '';
    
    return `
      <div class="match-result-item" onclick="selectMatchedCompany('${m.affiliate.id}')">
        <div class="match-result-name">${m.affiliate.company_name || 'Unnamed'} ${badges}</div>
        <div class="match-result-detail">${address}${phone ? ' • ' + phone : ''}</div>
      </div>
    `;
  }).join('');
  
  // Add option to create new
  html += `
    <div class="match-result-item create-new" onclick="selectCreateNewCompany()">
      <div class="match-result-name">➕ Create new company instead</div>
    </div>
  `;
  
  container.innerHTML = html;
  container.style.display = 'block';
}

function hideCompanyMatches() {
  if (elements.companyMatchResults) {
    elements.companyMatchResults.style.display = 'none';
  }
}

// Global function for onclick
window.selectMatchedCompany = async function(affiliateId) {
  try {
    const affiliates = await fetchAffiliates();
    const affiliate = affiliates.find(a => a.id === affiliateId);
    
    if (!affiliate) {
      showToast('Company not found', 'error');
      return;
    }
    
    // Store selected affiliate
    state.selectedAffiliate = affiliate;
    
    // Update UI
    document.getElementById('selectedCompanyId').value = affiliate.id;
    document.getElementById('selectedCompanyName').textContent = affiliate.company_name;
    document.getElementById('selectedCompanyAddress').textContent = 
      [affiliate.primary_address, affiliate.city, affiliate.state, affiliate.zip].filter(Boolean).join(', ');
    document.getElementById('selectedCompanyPhone').textContent = affiliate.phone || affiliate.primary_phone || '';
    
    // Show selected card, hide form
    elements.selectedCompanyCard.style.display = 'block';
    elements.newCompanyForm.style.display = 'none';
    document.getElementById('regCompanyName').value = affiliate.company_name;
    
    hideCompanyMatches();
    showToast('Company selected!', 'success');
    
  } catch (err) {
    console.error('[DriverPortal] Select company error:', err);
    showToast('Failed to select company', 'error');
  }
};

window.selectCreateNewCompany = function() {
  state.selectedAffiliate = null;
  elements.selectedCompanyCard.style.display = 'none';
  elements.newCompanyForm.style.display = 'block';
  document.getElementById('selectedCompanyId').value = '';
  hideCompanyMatches();
};

function clearSelectedCompany() {
  state.selectedAffiliate = null;
  elements.selectedCompanyCard.style.display = 'none';
  elements.newCompanyForm.style.display = 'block';
  document.getElementById('selectedCompanyId').value = '';
  document.getElementById('regCompanyName').value = '';
}

// ============================================
// OTP Verification
// ============================================
function setupOtpInputs() {
  const inputs = document.querySelectorAll('.otp-digit');
  
  inputs.forEach((input, index) => {
    // Auto-focus next on input
    input.addEventListener('input', (e) => {
      const value = e.target.value.replace(/\D/g, '');
      
      // Handle iOS/Android autofill - when multiple digits are entered at once
      if (value.length > 1) {
        const digits = value.substring(0, 6 - index);
        digits.split('').forEach((char, i) => {
          if (inputs[index + i]) {
            inputs[index + i].value = char;
            inputs[index + i].classList.add('filled');
          }
        });
        // Focus the next empty input or last input
        const nextEmpty = Array.from(inputs).findIndex(d => !d.value);
        if (nextEmpty !== -1) {
          inputs[nextEmpty].focus();
        } else {
          inputs[inputs.length - 1].focus();
        }
        checkOtpComplete();
        return;
      }
      
      // Single digit entry
      e.target.value = value.slice(0, 1);
      
      if (e.target.value) {
        e.target.classList.add('filled');
        // Move to next input
        if (index < inputs.length - 1) {
          inputs[index + 1].focus();
        }
      } else {
        e.target.classList.remove('filled');
      }
      
      // Check if all filled
      checkOtpComplete();
    });
    
    // Handle backspace
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !e.target.value && index > 0) {
        inputs[index - 1].focus();
        inputs[index - 1].value = '';
        inputs[index - 1].classList.remove('filled');
      }
    });
    
    // Handle paste
    input.addEventListener('paste', (e) => {
      e.preventDefault();
      const pastedData = (e.clipboardData || window.clipboardData).getData('text');
      const digits = pastedData.replace(/\D/g, '').slice(0, 6);
      
      digits.split('').forEach((digit, i) => {
        if (inputs[i]) {
          inputs[i].value = digit;
          inputs[i].classList.add('filled');
        }
      });
      
      // Focus last filled or next empty
      const focusIndex = Math.min(digits.length, inputs.length - 1);
      inputs[focusIndex]?.focus();
      
      checkOtpComplete();
    });
  });
}

function checkOtpComplete() {
  const inputs = document.querySelectorAll('.otp-digit');
  const code = Array.from(inputs).map(i => i.value).join('');
  
  if (code.length === 6) {
    // All digits entered, enable verify button
    elements.verifyOtpBtn.classList.add('btn-success');
  } else {
    elements.verifyOtpBtn.classList.remove('btn-success');
  }
}

function getEnteredOtp() {
  const inputs = document.querySelectorAll('.otp-digit');
  return Array.from(inputs).map(i => i.value).join('');
}

function clearOtpInputs() {
  document.querySelectorAll('.otp-digit').forEach(input => {
    input.value = '';
    input.classList.remove('filled', 'error');
  });
}

async function sendOtpToPhone(phone) {
  // Generate 6-digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  state.otpCode = code;
  state.otpExpiry = Date.now() + (5 * 60 * 1000); // 5 minutes
  state.otpAttempts = 0;
  
  console.log('[DriverPortal] Generated OTP:', code); // For testing - remove in production
  
  // Send via SMS
  const formattedPhone = formatPhone(phone);
  const message = `Your RELIALIMO verification code is: ${code}. This code expires in 5 minutes.`;
  
  try {
    await sendSMS(phone, message);
    console.log('[DriverPortal] OTP sent to:', formattedPhone);
  } catch (err) {
    console.warn('[DriverPortal] SMS send failed, but continuing for testing:', err);
    // For development/testing, continue even if SMS fails
    showToast('Code sent! (Check console if SMS not received)', 'info');
  }
}

async function sendSMS(to, message) {
  // Get SMS provider config
  const providers = JSON.parse(localStorage.getItem('smsProviders') || '[]');
  const defaultProvider = providers.find(p => p.isDefault) || providers[0];
  
  if (!defaultProvider) {
    console.warn('[DriverPortal] No SMS provider configured');
    throw new Error('SMS not configured');
  }
  
  // Try to send via Twilio (may fail due to CORS in browser)
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
    body: params
  });
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`SMS failed: ${text}`);
  }
  
  return await response.json();
}

function startOtpResendTimer() {
  let seconds = 60;
  
  if (state.otpResendTimer) {
    clearInterval(state.otpResendTimer);
  }
  
  elements.resendOtpBtn.disabled = true;
  
  state.otpResendTimer = setInterval(() => {
    seconds--;
    
    if (elements.otpTimer) {
      elements.otpTimer.textContent = seconds > 0 ? `Resend in ${seconds}s` : '';
    }
    
    if (seconds <= 0) {
      clearInterval(state.otpResendTimer);
      elements.resendOtpBtn.disabled = false;
    }
  }, 1000);
}

async function handleResendOtp() {
  const phone = document.getElementById('regPhone').value.trim();
  
  if (!phone) {
    showToast('Phone number not found', 'error');
    return;
  }
  
  elements.resendOtpBtn.disabled = true;
  elements.resendOtpBtn.textContent = 'Sending...';
  
  try {
    await sendOtpToPhone(phone);
    clearOtpInputs();
    startOtpResendTimer();
    showToast('New code sent!', 'success');
    document.getElementById('otpDigit1')?.focus();
  } catch (err) {
    showToast('Failed to resend code', 'error');
  } finally {
    elements.resendOtpBtn.textContent = 'Resend Code';
  }
}

async function handleVerifyOtp() {
  const enteredCode = getEnteredOtp();
  
  if (enteredCode.length !== 6) {
    showToast('Please enter all 6 digits', 'error');
    return;
  }
  
  // Check expiry
  if (Date.now() > state.otpExpiry) {
    setOtpStatus('Code expired. Please request a new one.', 'error');
    return;
  }
  
  // Check attempts
  state.otpAttempts++;
  if (state.otpAttempts > 5) {
    setOtpStatus('Too many attempts. Please request a new code.', 'error');
    return;
  }
  
  // Verify code
  if (enteredCode !== state.otpCode) {
    setOtpStatus(`Incorrect code. ${5 - state.otpAttempts} attempts remaining.`, 'error');
    document.querySelectorAll('.otp-digit').forEach(i => i.classList.add('error'));
    setTimeout(() => {
      document.querySelectorAll('.otp-digit').forEach(i => i.classList.remove('error'));
    }, 500);
    return;
  }
  
  // Success!
  state.phoneVerified = true;
  setOtpStatus('✓ Phone verified!', 'success');
  
  elements.verifyOtpBtn.disabled = true;
  elements.verifyOtpBtn.textContent = 'Verified! Continuing...';
  
  // Clear timer
  if (state.otpResendTimer) {
    clearInterval(state.otpResendTimer);
  }
  
  // Wait a moment then continue
  setTimeout(() => {
    goToRegStep(3);
    elements.verifyOtpBtn.disabled = false;
    elements.verifyOtpBtn.textContent = 'Verify & Continue →';
  }, 1000);
}

function setOtpStatus(message, type) {
  if (elements.otpStatus) {
    elements.otpStatus.textContent = message;
    elements.otpStatus.className = 'otp-status ' + type;
  }
}

// ============================================
// Email OTP Verification
// ============================================
function initEmailOtpInputs() {
  const inputs = document.querySelectorAll('.email-otp-digit');
  
  inputs.forEach((input, index) => {
    input.addEventListener('input', (e) => {
      const value = e.target.value.replace(/\D/g, '');
      
      // Handle iOS/Android autofill - when multiple digits are entered at once
      if (value.length > 1) {
        const digits = value.substring(0, 6 - index);
        digits.split('').forEach((char, i) => {
          if (inputs[index + i]) {
            inputs[index + i].value = char;
            inputs[index + i].classList.add('filled');
          }
        });
        // Focus the next empty input or last input
        const nextEmpty = Array.from(inputs).findIndex(d => !d.value);
        if (nextEmpty !== -1) {
          inputs[nextEmpty].focus();
        } else {
          inputs[inputs.length - 1].focus();
        }
        checkEmailOtpComplete();
        return;
      }
      
      // Single digit entry
      e.target.value = value;
      
      if (value) {
        e.target.classList.add('filled');
        // Move to next input
        if (index < inputs.length - 1) {
          inputs[index + 1].focus();
        }
      } else {
        e.target.classList.remove('filled');
      }
      
      checkEmailOtpComplete();
    });
    
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !e.target.value && index > 0) {
        inputs[index - 1].focus();
        inputs[index - 1].value = '';
        inputs[index - 1].classList.remove('filled');
      }
    });
    
    // Handle paste
    input.addEventListener('paste', (e) => {
      e.preventDefault();
      const pastedData = (e.clipboardData || window.clipboardData).getData('text');
      const digits = pastedData.replace(/\D/g, '').slice(0, 6);
      
      digits.split('').forEach((digit, i) => {
        if (inputs[i]) {
          inputs[i].value = digit;
          inputs[i].classList.add('filled');
        }
      });
      
      const focusIndex = Math.min(digits.length, inputs.length - 1);
      inputs[focusIndex]?.focus();
      
      checkEmailOtpComplete();
    });
  });
}

function checkEmailOtpComplete() {
  const inputs = document.querySelectorAll('.email-otp-digit');
  const code = Array.from(inputs).map(i => i.value).join('');
  const verifyBtn = document.getElementById('verifyEmailOtpBtn');
  
  if (code.length === 6) {
    verifyBtn?.classList.add('btn-success');
  } else {
    verifyBtn?.classList.remove('btn-success');
  }
}

function getEnteredEmailOtp() {
  const inputs = document.querySelectorAll('.email-otp-digit');
  return Array.from(inputs).map(i => i.value).join('');
}

function clearEmailOtpInputs() {
  document.querySelectorAll('.email-otp-digit').forEach(input => {
    input.value = '';
    input.classList.remove('filled', 'error');
  });
}

async function sendOtpToEmail(email) {
  // Generate 6-digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  state.emailOtpCode = code;
  state.emailOtpExpiry = Date.now() + (10 * 60 * 1000); // 10 minutes for email
  state.emailOtpAttempts = 0;
  
  console.log('[DriverPortal] Generated Email OTP:', code); // For testing - remove in production
  
  // Update display
  const emailDisplay = document.getElementById('emailOtpDisplay');
  if (emailDisplay) {
    emailDisplay.textContent = email;
  }
  
  // Send via email (using configured email provider)
  try {
    const sent = await sendOTPEmail(email, code);
    if (sent) {
      console.log('[DriverPortal] Email OTP sent to:', email);
      showToast('Verification code sent to your email!', 'success');
    } else {
      // Email wasn't sent but we logged to console
      showToast(`Code: ${code} (Check console - email not configured)`, 'info');
    }
  } catch (err) {
    console.warn('[DriverPortal] Email send failed:', err);
    // Show the code directly for testing purposes
    showToast(`Code: ${code} (Email service unavailable)`, 'info');
  }
}

async function sendOTPEmail(to, code) {
  // Get email settings from System Settings (emailSettingsConfig)
  const settingsRaw = localStorage.getItem('emailSettingsConfig');
  const settings = settingsRaw ? JSON.parse(settingsRaw) : {};
  
  const fromName = settings.fromName || 'RELIALIMO';
  const fromEmail = settings.fromEmail || 'noreply@relialimo.com';
  
  // Check for Resend API key in env.js or settings
  const resendApiKey = window.ENV?.RESEND_API_KEY || settings.resendApiKey;
  
  console.log('[DriverPortal] Email settings found:', { 
    fromName, 
    fromEmail, 
    hasResendKey: !!resendApiKey,
    hasSmtp: !!settings.smtpHost 
  });
  
  // Build the email HTML
  const emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #4F46E5;">Email Verification</h2>
      <p>Your ${fromName} verification code is:</p>
      <div style="background: #f3f4f6; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1f2937;">${code}</span>
      </div>
      <p style="color: #6b7280; font-size: 14px;">This code expires in 10 minutes.</p>
      <p style="color: #6b7280; font-size: 14px;">If you didn't request this code, please ignore this email.</p>
    </div>
  `;
  
  // Method 1: Try server-side API endpoint first (works with Vercel/server deployments)
  try {
    const apiResponse = await fetch('/api/email-send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to: to,
        subject: `Your ${fromName} Verification Code`,
        html: emailHtml
      })
    });
    
    if (apiResponse.ok) {
      const result = await apiResponse.json();
      console.log('[DriverPortal] Email sent via API:', result);
      return true;
    } else {
      const error = await apiResponse.json();
      console.warn('[DriverPortal] API email failed:', error);
    }
  } catch (apiError) {
    console.warn('[DriverPortal] API endpoint not available:', apiError.message);
  }
  
  // Method 2: Try Supabase Edge Function for email
  try {
    const supabaseUrl = window.ENV?.SUPABASE_URL;
    const supabaseKey = window.ENV?.SUPABASE_ANON_KEY;
    
    if (supabaseUrl && supabaseKey) {
      const edgeResponse = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: to,
          subject: `Your ${fromName} Verification Code`,
          html: emailHtml,
          from: `${fromName} <${fromEmail}>`
        })
      });
      
      if (edgeResponse.ok) {
        const result = await edgeResponse.json();
        console.log('[DriverPortal] Email sent via Supabase Edge Function:', result);
        return true;
      } else {
        const error = await edgeResponse.text();
        console.warn('[DriverPortal] Supabase Edge Function failed:', error);
      }
    }
  } catch (edgeError) {
    console.warn('[DriverPortal] Supabase Edge Function not available:', edgeError.message);
  }
  
  // Method 3: Direct Resend API call (works locally if RESEND_API_KEY is set in env.js)
  if (resendApiKey) {
    try {
      console.log('[DriverPortal] Trying direct Resend API call...');
      const resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: `${fromName} <${fromEmail}>`,
          to: [to],
          subject: `Your ${fromName} Verification Code`,
          html: emailHtml
        })
      });
      
      if (resendResponse.ok) {
        const result = await resendResponse.json();
        console.log('[DriverPortal] Email sent via direct Resend API:', result);
        return true;
      } else {
        const error = await resendResponse.json();
        console.warn('[DriverPortal] Direct Resend API failed:', error);
        // CORS error is expected from browser - need server-side
        if (error.message?.includes('CORS') || error.statusCode === 0) {
          console.warn('[DriverPortal] CORS blocked - Resend API requires server-side calls');
        }
      }
    } catch (resendError) {
      console.warn('[DriverPortal] Direct Resend call failed (likely CORS):', resendError.message);
    }
  }
  
  // Fallback: Log to console (for development)
  console.log('[DriverPortal] ========== EMAIL OTP (Console Fallback) ==========');
  console.log('[DriverPortal] TO:', to);
  console.log('[DriverPortal] FROM:', `${fromName} <${fromEmail}>`);
  console.log('[DriverPortal] SUBJECT:', `Your ${fromName} Verification Code`);
  console.log('[DriverPortal] CODE:', code);
  console.log('[DriverPortal] ====================================================');
  console.log('[DriverPortal] To enable real emails:');
  console.log('[DriverPortal]   Option A: Deploy to Vercel with RESEND_API_KEY env var');
  console.log('[DriverPortal]   Option B: Deploy Supabase Edge Function send-email');
  console.log('[DriverPortal] ====================================================');
  
  return false; // Email not actually sent
}

function startEmailOtpResendTimer() {
  let seconds = 60;
  const resendBtn = document.getElementById('resendEmailOtpBtn');
  const timerEl = document.getElementById('emailOtpTimer');
  
  if (state.emailOtpResendTimer) {
    clearInterval(state.emailOtpResendTimer);
  }
  
  if (resendBtn) resendBtn.disabled = true;
  
  state.emailOtpResendTimer = setInterval(() => {
    seconds--;
    
    if (timerEl) {
      timerEl.textContent = seconds > 0 ? `Resend in ${seconds}s` : '';
    }
    
    if (seconds <= 0) {
      clearInterval(state.emailOtpResendTimer);
      if (resendBtn) resendBtn.disabled = false;
    }
  }, 1000);
}

async function handleResendEmailOtp() {
  const email = document.getElementById('regEmail').value.trim();
  
  if (!email) {
    showToast('Email address not found', 'error');
    return;
  }
  
  const resendBtn = document.getElementById('resendEmailOtpBtn');
  resendBtn.disabled = true;
  resendBtn.textContent = 'Sending...';
  
  try {
    await sendOtpToEmail(email);
    clearEmailOtpInputs();
    startEmailOtpResendTimer();
    showToast('New code sent to your email!', 'success');
    document.getElementById('emailOtpDigit1')?.focus();
  } catch (err) {
    showToast('Failed to resend code', 'error');
  } finally {
    resendBtn.textContent = 'Resend Code';
  }
}

async function handleVerifyEmailOtp() {
  const enteredCode = getEnteredEmailOtp();
  
  if (enteredCode.length !== 6) {
    showToast('Please enter all 6 digits', 'error');
    return;
  }
  
  // Check expiry
  if (Date.now() > state.emailOtpExpiry) {
    setEmailOtpStatus('Code expired. Please request a new one.', 'error');
    return;
  }
  
  // Check attempts
  state.emailOtpAttempts++;
  if (state.emailOtpAttempts > 5) {
    setEmailOtpStatus('Too many attempts. Please request a new code.', 'error');
    return;
  }
  
  // Verify code
  if (enteredCode !== state.emailOtpCode) {
    setEmailOtpStatus(`Incorrect code. ${5 - state.emailOtpAttempts} attempts remaining.`, 'error');
    document.querySelectorAll('.email-otp-digit').forEach(i => i.classList.add('error'));
    setTimeout(() => {
      document.querySelectorAll('.email-otp-digit').forEach(i => i.classList.remove('error'));
    }, 500);
    return;
  }
  
  // Success!
  state.emailVerified = true;
  setEmailOtpStatus('✓ Email verified!', 'success');
  
  const verifyBtn = document.getElementById('verifyEmailOtpBtn');
  verifyBtn.disabled = true;
  verifyBtn.textContent = 'Verified! Continuing...';
  
  // Clear timer
  if (state.emailOtpResendTimer) {
    clearInterval(state.emailOtpResendTimer);
  }
  
  // Wait a moment then continue to Step 2
  setTimeout(() => {
    goToRegStep(2);
    verifyBtn.disabled = false;
    verifyBtn.textContent = 'Verify & Continue →';
  }, 1000);
}

function setEmailOtpStatus(message, type) {
  const statusEl = document.getElementById('emailOtpStatus');
  if (statusEl) {
    statusEl.textContent = message;
    statusEl.className = 'otp-status ' + type;
  }
}

// ============================================
// INLINE OTP VERIFICATION HANDLERS (New Flow)
// ============================================

/**
 * Handle sending email OTP from the inline button
 */
async function handleSendEmailOtp() {
  const email = document.getElementById('regEmail').value.trim();
  const firstName = document.getElementById('regFirstName').value.trim();
  const lastName = document.getElementById('regLastName').value.trim();
  
  // Validate name fields first
  if (!firstName || !lastName) {
    showToast('Please enter your name first', 'error');
    document.getElementById('regFirstName').focus();
    return;
  }
  
  // Validate email
  if (!email || !email.includes('@')) {
    showToast('Please enter a valid email address', 'error');
    document.getElementById('regEmail').focus();
    return;
  }
  
  const btn = document.getElementById('sendEmailOtpBtn');
  btn.disabled = true;
  btn.textContent = 'Sending...';
  
  try {
    // Check if email already exists
    const emailExists = await checkEmailExists(email);
    if (emailExists) {
      showToast('A driver account with this email already exists. Please sign in instead.', 'error');
      return;
    }
    
    // Send OTP
    await sendOtpToEmail(email);
    
    // Show the OTP input section
    const otpSection = document.getElementById('emailOtpSection');
    otpSection.style.display = 'block';
    
    // Update display
    document.getElementById('emailOtpDisplay').textContent = email;
    
    // Start timer
    startEmailOtpResendTimerInline();
    
    // Focus first input
    document.getElementById('emailOtpDigit1')?.focus();
    
    // Disable the email input
    document.getElementById('regEmail').disabled = true;
    btn.style.display = 'none';
    
  } catch (err) {
    console.error('[DriverPortal] Send email OTP error:', err);
    showToast(err.message || 'Failed to send verification code', 'error');
    btn.disabled = false;
    btn.textContent = 'Send Code';
  }
}

/**
 * Handle verifying email OTP inline
 */
async function handleVerifyEmailOtpInline() {
  const enteredCode = getEnteredEmailOtp();
  
  if (enteredCode.length !== 6) {
    showToast('Please enter all 6 digits', 'error');
    return;
  }
  
  // Check expiry
  if (Date.now() > state.emailOtpExpiry) {
    setEmailOtpStatus('Code expired. Please request a new one.', 'error');
    return;
  }
  
  // Check attempts
  state.emailOtpAttempts++;
  if (state.emailOtpAttempts > 5) {
    setEmailOtpStatus('Too many attempts. Please request a new code.', 'error');
    return;
  }
  
  // Verify code
  if (enteredCode !== state.emailOtpCode) {
    setEmailOtpStatus(`Incorrect code. ${5 - state.emailOtpAttempts} attempts remaining.`, 'error');
    document.querySelectorAll('.email-otp-digit').forEach(i => i.classList.add('error'));
    setTimeout(() => {
      document.querySelectorAll('.email-otp-digit').forEach(i => i.classList.remove('error'));
    }, 500);
    return;
  }
  
  // Success!
  state.emailVerified = true;
  
  // Hide OTP section, show verified badge
  document.getElementById('emailOtpSection').style.display = 'none';
  document.getElementById('emailVerifiedBadge').style.display = 'inline-flex';
  
  // Clear timer
  if (state.emailOtpResendTimer) {
    clearInterval(state.emailOtpResendTimer);
  }
  
  // Enable phone section
  document.getElementById('regPhone').disabled = false;
  document.getElementById('sendPhoneOtpBtn').disabled = false;
  
  showToast('Email verified! Now verify your phone.', 'success');
}

/**
 * Handle resending email OTP inline
 */
async function handleResendEmailOtpInline() {
  const email = document.getElementById('regEmail').value.trim();
  
  if (!email) {
    showToast('Email address not found', 'error');
    return;
  }
  
  const resendBtn = document.getElementById('resendEmailOtpBtn');
  resendBtn.disabled = true;
  resendBtn.textContent = 'Sending...';
  
  try {
    await sendOtpToEmail(email);
    clearEmailOtpInputs();
    startEmailOtpResendTimerInline();
    showToast('New code sent to your email!', 'success');
    document.getElementById('emailOtpDigit1')?.focus();
  } catch (err) {
    showToast('Failed to resend code', 'error');
  } finally {
    resendBtn.textContent = 'Resend';
  }
}

/**
 * Start email OTP resend timer for inline flow
 */
function startEmailOtpResendTimerInline() {
  let seconds = 60;
  const resendBtn = document.getElementById('resendEmailOtpBtn');
  const timerEl = document.getElementById('emailOtpTimer');
  
  if (state.emailOtpResendTimer) {
    clearInterval(state.emailOtpResendTimer);
  }
  
  if (resendBtn) resendBtn.disabled = true;
  
  state.emailOtpResendTimer = setInterval(() => {
    seconds--;
    
    if (timerEl) {
      timerEl.textContent = seconds > 0 ? `${seconds}s` : '';
    }
    
    if (seconds <= 0) {
      clearInterval(state.emailOtpResendTimer);
      if (resendBtn) resendBtn.disabled = false;
    }
  }, 1000);
}

/**
 * Handle sending phone OTP from the inline button
 */
async function handleSendPhoneOtp() {
  const phone = document.getElementById('regPhone').value.trim();
  
  // Validate phone
  if (!phone) {
    showToast('Please enter your phone number', 'error');
    document.getElementById('regPhone').focus();
    return;
  }
  
  // Check if email is verified
  if (!state.emailVerified) {
    showToast('Please verify your email first', 'error');
    return;
  }
  
  const btn = document.getElementById('sendPhoneOtpBtn');
  btn.disabled = true;
  btn.textContent = 'Sending...';
  
  try {
    // Send OTP
    await sendOtpToPhone(phone);
    
    // Show the OTP input section
    const otpSection = document.getElementById('phoneOtpSection');
    otpSection.style.display = 'block';
    
    // Update display
    const formattedPhone = formatPhone(phone);
    document.getElementById('otpPhoneDisplay').textContent = formattedPhone;
    
    // Start timer
    startPhoneOtpResendTimerInline();
    
    // Focus first input
    document.getElementById('otpDigit1')?.focus();
    
    // Disable the phone input
    document.getElementById('regPhone').disabled = true;
    btn.style.display = 'none';
    
    showToast('Verification code sent to your phone!', 'success');
    
  } catch (err) {
    console.error('[DriverPortal] Send phone OTP error:', err);
    showToast(err.message || 'Failed to send verification code', 'error');
    btn.disabled = false;
    btn.textContent = 'Send Code';
  }
}

/**
 * Handle verifying phone OTP inline
 */
async function handleVerifyPhoneOtpInline() {
  const enteredCode = getEnteredOtp();
  
  if (enteredCode.length !== 6) {
    showToast('Please enter all 6 digits', 'error');
    return;
  }
  
  // Check expiry
  if (Date.now() > state.otpExpiry) {
    setOtpStatus('Code expired. Please request a new one.', 'error');
    return;
  }
  
  // Check attempts
  state.otpAttempts++;
  if (state.otpAttempts > 5) {
    setOtpStatus('Too many attempts. Please request a new code.', 'error');
    return;
  }
  
  // Verify code
  if (enteredCode !== state.otpCode) {
    setOtpStatus(`Incorrect code. ${5 - state.otpAttempts} attempts remaining.`, 'error');
    document.querySelectorAll('.otp-digit').forEach(i => i.classList.add('error'));
    setTimeout(() => {
      document.querySelectorAll('.otp-digit').forEach(i => i.classList.remove('error'));
    }, 500);
    return;
  }
  
  // Success!
  state.phoneVerified = true;
  
  // Hide OTP section, show verified badge
  document.getElementById('phoneOtpSection').style.display = 'none';
  document.getElementById('phoneVerifiedBadge').style.display = 'inline-flex';
  
  // Clear timer
  if (state.otpResendTimer) {
    clearInterval(state.otpResendTimer);
  }
  
  // Enable password section
  document.getElementById('regPassword').disabled = false;
  
  // Enable continue button
  document.getElementById('regNextStep1').disabled = false;
  
  showToast('Phone verified! Create your password to continue.', 'success');
  
  // Focus password field
  document.getElementById('regPassword')?.focus();
}

/**
 * Handle resending phone OTP inline
 */
async function handleResendPhoneOtpInline() {
  const phone = document.getElementById('regPhone').value.trim();
  
  if (!phone) {
    showToast('Phone number not found', 'error');
    return;
  }
  
  const resendBtn = document.getElementById('resendOtpBtn');
  resendBtn.disabled = true;
  resendBtn.textContent = 'Sending...';
  
  try {
    await sendOtpToPhone(phone);
    clearOtpInputs();
    startPhoneOtpResendTimerInline();
    showToast('New code sent to your phone!', 'success');
    document.getElementById('otpDigit1')?.focus();
  } catch (err) {
    showToast('Failed to resend code', 'error');
  } finally {
    resendBtn.textContent = 'Resend';
  }
}

/**
 * Start phone OTP resend timer for inline flow
 */
function startPhoneOtpResendTimerInline() {
  let seconds = 60;
  const resendBtn = document.getElementById('resendOtpBtn');
  const timerEl = document.getElementById('otpTimer');
  
  if (state.otpResendTimer) {
    clearInterval(state.otpResendTimer);
  }
  
  if (resendBtn) resendBtn.disabled = true;
  
  state.otpResendTimer = setInterval(() => {
    seconds--;
    
    if (timerEl) {
      timerEl.textContent = seconds > 0 ? `${seconds}s` : '';
    }
    
    if (seconds <= 0) {
      clearInterval(state.otpResendTimer);
      if (resendBtn) resendBtn.disabled = false;
    }
  }, 1000);
}

// ============================================
// Registration - Legacy goToRegStep and validation
// ============================================
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
  
  // Verify email was verified (unless in dev mode)
  if (!state.emailVerified && !window.ENV?.DEV_MODE) {
    showToast('Please verify your email first', 'error');
    goToRegStep('1b');
    return;
  }
  
  // Verify phone was verified (unless in dev mode)
  if (!state.phoneVerified && !window.ENV?.DEV_MODE) {
    showToast('Please verify your phone number first', 'error');
    goToRegStep('2b');
    return;
  }
  
  elements.regSubmit.disabled = true;
  elements.regSubmit.textContent = 'Creating Account...';
  
  try {
    // Use already selected affiliate from company matching, or create new one
    let affiliate = state.selectedAffiliate;
    
    // If no pre-selected affiliate but company name provided, create new
    if (!affiliate) {
      const companyName = document.getElementById('regCompanyName').value.trim();
      if (companyName) {
        const companyInfo = {
          address: document.getElementById('regCompanyAddress').value.trim() || null,
          city: document.getElementById('regCompanyCity').value.trim() || null,
          state: document.getElementById('regCompanyState').value || null,
          zip: document.getElementById('regCompanyZip').value.trim() || null,
          phone: document.getElementById('regCompanyPhone').value.trim() || null
        };
        affiliate = await findOrCreateAffiliate(companyName, companyInfo);
      }
    }
    
    // Generate driver ID upfront
    const driverUUID = crypto.randomUUID();
    
    // IMPORTANT: Organization_id hierarchy:
    // 1. If driver has affiliate -> use affiliate's organization_id
    // 2. If no affiliate -> use main organization ID (drivers must belong to a valid org)
    // The main org ID must exist in the organizations table to satisfy FK constraint
    const mainOrgId = window.ENV?.ORGANIZATION_ID || '54eb6ce7-ba97-4198-8566-6ac075828160';
    const organizationId = affiliate?.organization_id || mainOrgId;
    
    console.log('[DriverPortal] Using organization_id:', organizationId, 
                affiliate?.organization_id ? '(from affiliate)' : '(main organization)');

    // Get company info for driver record (use selected affiliate or form data)
    const companyInfo = affiliate ? {
      address: affiliate.primary_address,
      city: affiliate.city,
      state: affiliate.state,
      zip: affiliate.zip,
      phone: affiliate.phone || affiliate.primary_phone
    } : {
      address: document.getElementById('regCompanyAddress').value.trim() || null,
      city: document.getElementById('regCompanyCity').value.trim() || null,
      state: document.getElementById('regCompanyState').value || null,
      zip: document.getElementById('regCompanyZip').value.trim() || null,
      phone: document.getElementById('regCompanyPhone').value.trim() || null
    };
    
    // Simple password hash for driver login (not using Supabase Auth)
    // In production, use proper bcrypt or similar on the server
    const passwordHash = state.pendingPassword ? 
      btoa(state.pendingPassword + '_salt_' + Date.now()) : null;
    
    // Generate portal slug for driver-specific URL (driver.relialimo.com/first_name_last_name)
    const firstName = document.getElementById('regFirstName').value.trim();
    const lastName = document.getElementById('regLastName').value.trim();
    const portalSlug = generatePortalSlug(firstName, lastName);
    
    // Collect all registration data
    // NOTE: driver_status, affiliate_id, affiliate_name columns require running sql/sync_all_fields.sql migration
    const driverData = {
      id: driverUUID,  // Use pre-generated UUID (needed for organization_id if no affiliate)
      first_name: firstName,
      last_name: lastName,
      email: document.getElementById('regEmail').value.trim().toLowerCase(),
      cell_phone: formatPhone(document.getElementById('regPhone').value),
      status: 'ACTIVE',
      driver_status: 'available',  // Availability for farmout/dispatch - requires migration
      type: 'FULL TIME',
      organization_id: organizationId,
      // Portal URL slug for driver.relialimo.com/first_name_last_name
      portal_slug: portalSlug,
      // Password hash for driver-specific login (separate from admin auth)
      password_hash: passwordHash,
      // Auto-assign new drivers to level 10 (highest priority for farmout)
      driver_level: '10',
      // Company info (optional)
      primary_address: companyInfo.address,
      city: companyInfo.city,
      state: companyInfo.state,
      postal_code: companyInfo.zip,
      home_phone: companyInfo.phone,
      // Affiliate association - requires migration for affiliate_id column
      affiliate_id: affiliate?.id || null,
      affiliate_name: affiliate?.company_name || null
    };
    
    console.log('[DriverPortal] Creating driver with affiliate:', affiliate?.company_name || 'None');
    console.log('[DriverPortal] Driver data to create:', JSON.stringify(driverData, null, 2));
    
    // Track created resources for rollback on error
    let createdDriverId = null;
    let createdAffiliateId = null;
    let createdVehicleId = null;
    
    // Track if affiliate was newly created (vs pre-existing)
    const affiliateWasCreated = affiliate && !state.selectedAffiliate;
    if (affiliateWasCreated) {
      createdAffiliateId = affiliate.id;
    }
    
    try {
      // Create driver (email check already done in step 1)
      const newDriver = await createDriver(driverData);
      
      if (!newDriver || !newDriver.id) {
        throw new Error('Failed to create driver account');
      }
      
      createdDriverId = newDriver.id;
      
      // Clear pending password
      state.pendingPassword = null;
      
      console.log('[DriverPortal] ✅ Driver created:', newDriver.id, 'for affiliate:', affiliate?.company_name || 'None');
      
      // Create vehicle - generate a unique unit number
      // Format: Initials + timestamp suffix (guaranteed unique)
      const driverInitials = `${(newDriver.first_name || 'X')[0]}${(newDriver.last_name || 'X')[0]}`.toUpperCase();
      const timestamp = Date.now().toString(36).toUpperCase().slice(-5); // 5 char base36 timestamp
      const unitNumber = `${driverInitials}${timestamp}`;
      
      // Get vehicle make/model/year for title
      const vehMake = document.getElementById('regVehicleMake').value.trim() || null;
      const vehModel = document.getElementById('regVehicleModel').value.trim() || null;
      const vehYear = parseInt(document.getElementById('regVehicleYear').value) || null;
      const vehCapacity = parseInt(document.getElementById('regVehicleCapacity').value) || 4;
      
      const vehicleData = {
        // Link vehicle to the newly created driver
        assigned_driver_id: newDriver.id,
        organization_id: organizationId,
        // Link to affiliate if driver has one
        affiliate_id: affiliate?.id || newDriver.affiliate_id || null,
        // Proper unit number (not license plate)
        unit_number: unitNumber,
        veh_disp_name: unitNumber,
        // Vehicle type info
        veh_type: vehicleType, // This is the vehicle_type_id
        vehicle_type_id: vehicleType,
        // Vehicle details
        make: vehMake,
        model: vehModel,
        year: vehYear,
        color: document.getElementById('regVehicleColor').value.trim() || null,
        license_plate: licensePlate,
        // Use passenger_capacity for both to keep them in sync
        passenger_capacity: vehCapacity,
        capacity: vehCapacity,
        status: 'AVAILABLE',
        is_active: true,
        // Permit & DOT fields
        limo_permit_number: document.getElementById('regLimoPermit')?.value.trim() || null,
        permit_expiration_month: parseInt(document.getElementById('regPermitExpMonth')?.value) || null,
        permit_expiration_year: parseInt(document.getElementById('regPermitExpYear')?.value) || null,
        us_dot_number: document.getElementById('regDotNumber')?.value.trim() || null,
        // Insurance fields
        insurance_company: document.getElementById('regInsuranceCompany')?.value.trim() || null,
        insurance_policy_number: document.getElementById('regInsurancePolicyNumber')?.value.trim() || null
      };
      
      console.log('[DriverPortal] Creating vehicle with data:', JSON.stringify(vehicleData, null, 2));
      
      const createdVehicle = await createVehicle(vehicleData);
      
      if (!createdVehicle || !createdVehicle.id) {
        throw new Error('Failed to create vehicle record');
      }
      
      createdVehicleId = createdVehicle.id;
      console.log('[DriverPortal] ✅ Vehicle created:', createdVehicle.id, 'with unit:', createdVehicle.unit_number);
      
      // Update driver with assigned vehicle ID
      console.log('[DriverPortal] Updating driver with assigned_vehicle_id:', createdVehicle.id);
      try {
        await updateDriver(newDriver.id, { assigned_vehicle_id: createdVehicle.id });
        newDriver.assigned_vehicle_id = createdVehicle.id;
        console.log('[DriverPortal] ✅ Driver updated with vehicle assignment');
      } catch (updateErr) {
        console.warn('[DriverPortal] ⚠️ Could not update driver with vehicle:', updateErr.message);
        // This might fail if the column doesn't exist yet - non-fatal
        console.warn('[DriverPortal] Note: Run add_assigned_vehicle_id_to_drivers.sql to enable this feature');
      }
      
      // Log in the new driver
      state.driver = newDriver;
      state.driverId = newDriver.id;
      localStorage.setItem('driver_portal_id', newDriver.id);
      
      // Show welcome screen instead of dashboard for new registrations
      showWelcomeScreen(newDriver);
      
    } catch (innerErr) {
      // ⚠️ ROLLBACK: Clean up any partially created records
      console.error('[DriverPortal] Registration failed, rolling back...', innerErr);
      
      // Delete vehicle if created
      if (createdVehicleId) {
        try {
          console.log('[DriverPortal] 🗑️ Deleting vehicle:', createdVehicleId);
          await deleteVehicle(createdVehicleId);
        } catch (delErr) {
          console.warn('[DriverPortal] Could not delete vehicle:', delErr.message);
        }
      }
      
      // Delete driver if created
      if (createdDriverId) {
        try {
          console.log('[DriverPortal] 🗑️ Deleting driver:', createdDriverId);
          await deleteDriver(createdDriverId);
        } catch (delErr) {
          console.warn('[DriverPortal] Could not delete driver:', delErr.message);
        }
      }
      
      // Delete affiliate only if we created it during this registration
      if (createdAffiliateId) {
        try {
          console.log('[DriverPortal] 🗑️ Deleting affiliate:', createdAffiliateId);
          await deleteAffiliate(createdAffiliateId);
        } catch (delErr) {
          console.warn('[DriverPortal] Could not delete affiliate:', delErr.message);
        }
      }
      
      // Re-throw to show error to user
      throw innerErr;
    }
    
  } catch (err) {
    console.error('[DriverPortal] Registration error:', err);
    showToast(err.message || 'Registration failed', 'error');
  } finally {
    elements.regSubmit.disabled = false;
    elements.regSubmit.textContent = '🚀 Create Account';
  }
}

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
  elements.driverStatusBadge.innerHTML = `
    <span class="status-dot ${statusMeta.color}"></span>
    ${statusMeta.label}
  `;
  
  // Sidebar
  elements.sidebarName.textContent = fullName;
  elements.sidebarEmail.textContent = driver.email || '';
  
  // Update avatars with photo or initials
  if (driver.profile_photo_url) {
    updateDriverAvatar(driver.profile_photo_url);
  } else {
    elements.driverAvatar.textContent = initials;
    elements.sidebarAvatar.textContent = initials;
  }
  
  // Online/Offline Toggle - sync with driver status
  const isOnline = status !== 'offline';
  if (elements.onlineToggle) {
    elements.onlineToggle.checked = isOnline;
  }
  if (elements.onlineLabel) {
    elements.onlineLabel.textContent = isOnline ? 'ONLINE' : 'OFFLINE';
  }
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

/**
 * Fetch trips assigned to this driver using service role key (bypasses RLS)
 */
async function fetchDriverTripsWithServiceRole(driverId) {
  try {
    const SUPABASE_URL = 'https://siumiadylwcrkaqsfwkj.supabase.co';
    const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpdW1pYWR5bHdjcmthcXNmd2tqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTY2MzMxMywiZXhwIjoyMDgxMjM5MzEzfQ.AwUvDEQNb_U04OveQ6Ia9wFgoIatwV6wigdwSQnsOP4';
    
    // Fetch trips where assigned_driver_id or current_offer_driver_id matches
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/reservations?or=(assigned_driver_id.eq.${driverId},current_offer_driver_id.eq.${driverId})&select=*`,
      {
        method: 'GET',
        headers: {
          'apikey': SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!response.ok) {
      console.error('[DriverPortal] Failed to fetch driver trips:', response.status);
      return [];
    }
    
    const data = await response.json();
    console.log('[DriverPortal] Fetched', data?.length || 0, 'trips for driver via service role');
    return data || [];
  } catch (e) {
    console.error('[DriverPortal] Error fetching driver trips:', e);
    return [];
  }
}

async function refreshTrips() {
  if (!state.driverId) return;
  
  elements.fabRefresh.style.animation = 'spin 1s linear infinite';
  
  try {
    // Fetch trips assigned to this driver using service role key (bypasses RLS)
    let allReservations = await fetchDriverTripsWithServiceRole(state.driverId);
    console.log('[DriverPortal] refreshTrips: got', allReservations.length, 'reservations for driver', state.driverId);
    
    // All reservations are already filtered by driver ID in the query
    const myTrips = allReservations;
    
    // Categorize trips
    const now = new Date();
    state.trips.offered = [];
    state.trips.upcoming = [];
    state.trips.active = null;
    
    myTrips.forEach(trip => {
      const tripDate = new Date(trip.pickup_date_time || trip.pickup_datetime || trip.pickup_date);
      const driverStatus = trip.driver_status || 'assigned';
      const farmoutStatus = trip.farmout_status;
      
      console.log('[DriverPortal] Categorizing trip:', trip.confirmation_number, 
        'farmoutStatus:', farmoutStatus, 'driverStatus:', driverStatus, 'tripDate:', tripDate);
      
      // Active trip (in progress)
      if (['enroute', 'arrived', 'passenger_onboard'].includes(driverStatus)) {
        state.trips.active = trip;
        console.log('[DriverPortal] -> ACTIVE');
      }
      // Offered but not yet accepted
      else if (driverStatus === 'offered' || trip.status === 'OFFERED' || farmoutStatus === 'offered') {
        state.trips.offered.push(trip);
        console.log('[DriverPortal] -> OFFERED');
      }
      // Upcoming (assigned and in the future) - including farmout assigned
      else if (driverStatus === 'assigned' || driverStatus === 'available' || farmoutStatus === 'assigned') {
        if (tripDate > now || isSameDay(tripDate, now)) {
          state.trips.upcoming.push(trip);
          console.log('[DriverPortal] -> UPCOMING');
        } else {
          console.log('[DriverPortal] -> Past trip, skipped');
        }
      } else {
        console.log('[DriverPortal] -> Not categorized');
      }
    });
    
    console.log('[DriverPortal] Final counts - offered:', state.trips.offered.length, 'upcoming:', state.trips.upcoming.length);
    
    // Also load pending farmout offers from Supabase (reservations where current_offer_driver_id matches this driver)
    // Note: These are already included in our main query via fetchDriverTripsWithServiceRole
    const supabaseOffers = await loadPendingFarmoutOffersFromSupabase(state.driverId);
    supabaseOffers.forEach(offer => {
      // Check if offer hasn't expired
      if (offer.current_offer_expires_at && new Date(offer.current_offer_expires_at) < now) {
        return; // Skip expired offers
      }
      
      // Convert reservation to trip-like object for display
      const offerAsTrip = {
        id: offer.id,
        confirmation_number: offer.confirmation_number,
        pickup_date: offer.pickup_datetime?.split('T')[0],
        pickup_time: offer.pickup_datetime?.split('T')[1]?.substring(0, 5),
        pickup_date_time: offer.pickup_datetime,
        pickup_location: offer.pickup_city || offer.pickup_address,
        dropoff_location: offer.dropoff_city || offer.dropoff_address,
        passenger_name: 'Passenger',  // Limited info until accepted
        passenger_count: offer.passenger_count || 1,
        vehicle_type: offer.vehicle_type,
        driver_status: 'offered',
        driver_pay: offer.rate_amount ? (offer.rate_amount * 0.7).toFixed(2) : null,  // 70% default
        notes: offer.special_instructions,
        is_farmout_offer: true,
        offered_at: offer.current_offer_sent_at,
        expires_at: offer.current_offer_expires_at
      };
      
      // Don't add duplicates
      if (!state.trips.offered.some(t => t.id === offerAsTrip.id)) {
        state.trips.offered.push(offerAsTrip);
      }
    });
    
    // Also check localStorage as fallback
    const pendingFarmoutOffers = loadPendingFarmoutOffers(state.driverId);
    pendingFarmoutOffers.forEach(offer => {
      // Check if offer hasn't expired
      if (offer.expiresAt && new Date(offer.expiresAt) < now) {
        return; // Skip expired offers
      }
      
      // Convert offer to trip-like object for display
      // (These are offers with limited info until accepted)
      const offerAsTrip = {
        id: offer.reservationId,
        confirmation_number: offer.confirmationNumber,
        pickup_date: offer.pickupDate,
        pickup_time: offer.pickupTime,
        pickup_date_time: `${offer.pickupDate} ${offer.pickupTime}`,
        pickup_location: offer.pickupCity,  // City only until accepted
        dropoff_location: offer.dropoffCity,  // City only until accepted
        passenger_name: offer.passengerFirstName,  // First name only
        passenger_count: offer.paxCount,
        vehicle_type: offer.vehicleType,
        driver_status: 'offered',
        driver_pay: offer.driverPay,
        duration: offer.duration,
        distance: offer.distance,
        notes: offer.notes,
        is_farmout_offer: true,  // Flag to identify as farmout offer
        offered_at: offer.offeredAt,
        expires_at: offer.expiresAt
      };
      
      // Don't add duplicates
      if (!state.trips.offered.some(t => t.id === offerAsTrip.id)) {
        state.trips.offered.push(offerAsTrip);
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

/**
 * Load pending farmout offers from Supabase
 * Queries reservations where current_offer_driver_id matches this driver
 */
async function loadPendingFarmoutOffersFromSupabase(driverId) {
  try {
    const client = getSupabase();
    if (!client) {
      console.warn('[DriverPortal] Supabase not initialized for offers');
      return [];
    }
    
    const { data, error } = await client
      .from('reservations')
      .select('*')
      .eq('current_offer_driver_id', driverId)
      .eq('farmout_status', 'offered')
      .order('pickup_datetime', { ascending: true });
    
    if (error) {
      console.warn('[DriverPortal] Failed to fetch offers from Supabase:', error);
      return [];
    }
    
    console.log('[DriverPortal] Loaded', data?.length || 0, 'offers from Supabase');
    return data || [];
  } catch (e) {
    console.warn('[DriverPortal] Error fetching offers from Supabase:', e);
    return [];
  }
}

/**
 * Load pending farmout offers for this driver from localStorage
 */
function loadPendingFarmoutOffers(driverId) {
  try {
    const pendingOffers = JSON.parse(localStorage.getItem('pending_farmout_offers') || '{}');
    return pendingOffers[driverId] || [];
  } catch (e) {
    console.warn('[DriverPortal] Failed to load pending offers:', e);
    return [];
  }
}

function renderTripLists() {
  // Track previous offered trips for sound notifications
  const previousOfferedIds = state.previousOfferedTrips || [];
  const currentOfferedIds = state.trips.offered.map(trip => trip.id);
  
  // Find new offers (not in previous list)
  const newOffers = state.trips.offered.filter(trip => 
    !previousOfferedIds.includes(trip.id)
  );
  
  // Play sound for new offers (but not on initial load)
  if (previousOfferedIds.length > 0 && newOffers.length > 0) {
    console.log('[DriverPortal] New trip offers detected:', newOffers.length);
    playNotificationSound('new_offer');
    
    // Show toast for new offers
    const plural = newOffers.length > 1 ? 's' : '';
    showToast(`🚗 ${newOffers.length} new trip offer${plural}!`, 'info');
  }
  
  // Update previous list for next comparison
  state.previousOfferedTrips = currentOfferedIds;
  
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
    <div class="trip-card" data-trip-id="${trip.id}" onclick="openTripDetail('${trip.id}')" style="cursor: pointer;">
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
      
      ${renderFarmoutOfferDetails(trip, type)}
      
      ${footerButtons ? `<div class="trip-card-footer" onclick="event.stopPropagation();">${footerButtons}</div>` : ''}
    </div>
  `;
}

/**
 * Render farmout offer details (pay, duration, expiry countdown) for offered trips
 */
function renderFarmoutOfferDetails(trip, type) {
  if (type !== 'offered') return '';
  
  let detailsHtml = '';
  
  // Show driver pay if available
  if (trip.driver_pay) {
    detailsHtml += `
      <div class="offer-pay">
        <span class="offer-pay-label">💰 Your Pay:</span>
        <span class="offer-pay-amount">$${trip.driver_pay}</span>
      </div>
    `;
  }
  
  // Show duration/distance if available
  if (trip.duration || trip.distance) {
    detailsHtml += `
      <div class="offer-details">
        ${trip.duration ? `<span class="offer-detail">⏱️ ${trip.duration}</span>` : ''}
        ${trip.distance ? `<span class="offer-detail">📏 ${trip.distance}</span>` : ''}
        ${trip.vehicle_type ? `<span class="offer-detail">🚗 ${trip.vehicle_type}</span>` : ''}
      </div>
    `;
  }
  
  // Show expiry countdown for farmout offers
  if (trip.expires_at && trip.is_farmout_offer) {
    const expiresAt = new Date(trip.expires_at);
    const now = new Date();
    const msRemaining = expiresAt - now;
    
    if (msRemaining > 0) {
      const minsRemaining = Math.ceil(msRemaining / 60000);
      detailsHtml += `
        <div class="offer-expiry">
          <span class="offer-expiry-icon">⏰</span>
          <span class="offer-expiry-text">Expires in ${minsRemaining} min</span>
        </div>
      `;
    } else {
      detailsHtml += `
        <div class="offer-expiry expired">
          <span class="offer-expiry-icon">⚠️</span>
          <span class="offer-expiry-text">Offer expired</span>
        </div>
      `;
    }
  }
  
  // Show notes if available
  if (trip.notes) {
    detailsHtml += `
      <div class="offer-notes">
        <span class="offer-notes-icon">📝</span>
        <span class="offer-notes-text">${trip.notes}</span>
      </div>
    `;
  }
  
  return detailsHtml ? `<div class="offer-info-section">${detailsHtml}</div>` : '';
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
  
  // Initialize Driver View map when tab is selected
  if (tabName === 'driverview') {
    initDriverViewMap();
    loadPinnedTrips();
  }
}

// ============================================
// Trip Actions
// ============================================
window.acceptTrip = async function(tripId) {
  try {
    // Play accept sound immediately for feedback
    playNotificationSound('accept');
    
    // Get current driver info
    const driverId = state.driverId || localStorage.getItem('driver_id');
    const driverName = state.driverName || localStorage.getItem('driver_portal_name') || 'Driver';
    
    // Update reservation with driver assignment (use correct column names)
    await updateReservationStatus(tripId, { 
      assigned_driver_id: driverId,
      assigned_driver_name: driverName,
      farmout_status: 'assigned',
      status: 'farmout assigned',
      current_offer_driver_id: null,
      current_offer_sent_at: null,
      current_offer_expires_at: null
    });
    
    // Dispatch event to notify FarmoutAutomationService
    window.dispatchEvent(new CustomEvent('farmoutDriverResponse', {
      detail: {
        reservationId: tripId,
        driverId: driverId,
        accepted: true,
        responseMethod: 'in_app'
      }
    }));
    
    // Also try to communicate with parent window (if in iframe)
    try {
      window.parent?.postMessage({
        type: 'farmoutDriverResponse',
        reservationId: tripId,
        driverId: driverId,
        accepted: true,
        responseMethod: 'in_app'
      }, '*');
    } catch (e) { /* ignore cross-origin */ }
    
    // Clear from pending offers
    clearPendingOffer(tripId, driverId);
    
    showToast('🎉 Trip accepted! Check your upcoming trips.', 'success');
    switchTab('upcoming');
    await refreshTrips();
  } catch (err) {
    console.error('[DriverPortal] Accept trip error:', err);
    showToast('Failed to accept trip', 'error');
  }
};

window.declineTrip = async function(tripId) {
  if (!confirm('Are you sure you want to decline this trip?')) return;
  
  try {
    // Play decline sound immediately for feedback
    playNotificationSound('decline');
    
    const driverId = state.driverId || localStorage.getItem('driver_id');
    
    // Update reservation - clear current offer and set back to searching
    await updateReservationStatus(tripId, { 
      farmout_status: 'searching',
      current_offer_driver_id: null,
      current_offer_sent_at: null,
      current_offer_expires_at: null
    });
    
    // Dispatch event to notify FarmoutAutomationService
    window.dispatchEvent(new CustomEvent('farmoutDriverResponse', {
      detail: {
        reservationId: tripId,
        driverId: driverId,
        accepted: false,
        responseMethod: 'in_app'
      }
    }));
    
    // Also try to communicate with parent window
    try {
      window.parent?.postMessage({
        type: 'farmoutDriverResponse',
        reservationId: tripId,
        driverId: driverId,
        accepted: false,
        responseMethod: 'in_app'
      }, '*');
    } catch (e) { /* ignore cross-origin */ }
    
    // Clear from pending offers
    clearPendingOffer(tripId, driverId);
    
    showToast('Trip declined', 'warning');
    await refreshTrips();
  } catch (err) {
    console.error('[DriverPortal] Decline trip error:', err);
    showToast('Failed to decline trip', 'error');
  }
};

/**
 * Clear a pending offer from localStorage
 */
function clearPendingOffer(tripId, driverId) {
  try {
    const pendingOffers = JSON.parse(localStorage.getItem('pending_farmout_offers') || '{}');
    if (pendingOffers[driverId]) {
      pendingOffers[driverId] = pendingOffers[driverId].filter(o => o.reservationId !== tripId);
      localStorage.setItem('pending_farmout_offers', JSON.stringify(pendingOffers));
    }
  } catch (e) {
    console.warn('[DriverPortal] Failed to clear pending offer:', e);
  }
}

window.startTrip = async function(tripId) {
  try {
    // Play trip start sound
    playNotificationSound('trip_start');
    
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
      // Play completion sound
      playNotificationSound('trip_complete');
      
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
  // Use service role key for driver portal updates (bypasses RLS)
  const supabaseUrl = window.ENV?.SUPABASE_URL || 'https://siumiadylwcrkaqsfwkj.supabase.co';
  const serviceKey = window.ENV?.SUPABASE_SERVICE_ROLE_KEY || 
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpdW1pYWR5bHdjcmthcXNmd2tqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTY2MzMxMywiZXhwIjoyMDgxMjM5MzEzfQ.AwUvDEQNb_U04OveQ6Ia9wFgoIatwV6wigdwSQnsOP4';
  
  const response = await fetch(`${supabaseUrl}/rest/v1/reservations?id=eq.${reservationId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(updates)
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[DriverPortal] Update failed:', response.status, errorText);
    throw new Error(`Update failed: ${response.status}`);
  }
  
  const data = await response.json();
  console.log('[DriverPortal] Reservation updated:', data);
  return data?.[0] || null;
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
  const defaultCountryCode = '+1'; // USA default
  
  // Format as +1 (XXX) XXX-XXXX (USA default)
  if (digits.length === 10) {
    return `${defaultCountryCode} (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  // If 11 digits starting with 1, format as USA
  else if (digits.length === 11 && digits[0] === '1') {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
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
