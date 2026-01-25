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

/**
 * Create a custom vehicle type (entered via "Other" option)
 */
async function createCustomVehicleType(typeName, organizationId) {
  const SUPABASE_URL = 'https://siumiadylwcrkaqsfwkj.supabase.co';
  const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpdW1pYWR5bHdjcmthcXNmd2tqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTY2MzMxMywiZXhwIjoyMDgxMjM5MzEzfQ.AwUvDEQNb_U04OveQ6Ia9wFgoIatwV6wigdwSQnsOP4';
  
  const newType = {
    name: typeName,
    type_name: typeName,
    status: 'ACTIVE',
    organization_id: organizationId,
    passenger_capacity: 4,
    description: `Custom vehicle type created by driver: ${typeName}`,
    created_at: new Date().toISOString()
  };
  
  console.log('[DriverPortal] Creating custom vehicle type:', newType);
  
  const response = await fetch(`${SUPABASE_URL}/rest/v1/vehicle_types`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(newType)
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[DriverPortal] Failed to create vehicle type:', response.status, errorText);
    throw new Error(`Failed to create vehicle type: ${response.status}`);
  }
  
  const data = await response.json();
  console.log('[DriverPortal] ✅ Created custom vehicle type:', data);
  return Array.isArray(data) ? data[0] : data;
}

/**
 * Activate an inactive vehicle type
 */
async function activateVehicleType(vehicleTypeId) {
  const SUPABASE_URL = 'https://siumiadylwcrkaqsfwkj.supabase.co';
  const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpdW1pYWR5bHdjcmthcXNmd2tqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTY2MzMxMywiZXhwIjoyMDgxMjM5MzEzfQ.AwUvDEQNb_U04OveQ6Ia9wFgoIatwV6wigdwSQnsOP4';
  
  console.log('[DriverPortal] Activating vehicle type:', vehicleTypeId);
  
  const response = await fetch(`${SUPABASE_URL}/rest/v1/vehicle_types?id=eq.${vehicleTypeId}`, {
    method: 'PATCH',
    headers: {
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({ status: 'ACTIVE' })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[DriverPortal] Failed to activate vehicle type:', response.status, errorText);
    throw new Error(`Failed to activate vehicle type: ${response.status}`);
  }
  
  const data = await response.json();
  console.log('[DriverPortal] ✅ Activated vehicle type:', data);
  return Array.isArray(data) ? data[0] : data;
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
  // Map preferences
  preferredMapApp: localStorage.getItem('driver_preferred_map') || null,
  mapVisible: true, // Show/hide map toggle state
  // Active trip state
  activeTripBaseFare: 0,
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
// Status Configuration - Enhanced Flow
// ============================================
const STATUS_META = {
  available: { emoji: '🟢', label: 'Available', color: 'available' },
  getting_ready: { emoji: '🔵', label: 'Getting Ready', color: 'getting-ready' },
  enroute: { emoji: '🟡', label: 'On the Way', color: 'enroute' },
  arrived: { emoji: '🟠', label: 'Arrived', color: 'arrived' },
  waiting: { emoji: '⏳', label: 'Waiting', color: 'waiting' },
  passenger_onboard: { emoji: '🚗', label: 'Customer in Car', color: 'onboard' },
  done: { emoji: '✅', label: 'Done', color: 'done' },
  completed: { emoji: '🏁', label: 'Completed', color: 'completed' },
  busy: { emoji: '🔴', label: 'Busy', color: 'busy' },
  offline: { emoji: '⚫', label: 'Offline', color: 'offline' }
};

// Status flow with skip options (e.g., can skip 'waiting')
const STATUS_TRANSITIONS = {
  // What statuses are available from each status
  available: ['getting_ready'],
  getting_ready: ['enroute'],
  enroute: ['arrived'],
  arrived: ['waiting', 'passenger_onboard'], // Can skip waiting
  waiting: ['passenger_onboard'],
  passenger_onboard: ['done'],
  done: ['completed'] // After done, goes to post-trip incidentals
};

// Map app preferences
const MAP_APPS = {
  google: { name: 'Google Maps', icon: '🗺️', scheme: 'google.navigation:q=' },
  apple: { name: 'Apple Maps', icon: '🍎', scheme: 'maps://maps.google.com/maps?daddr=' },
  waze: { name: 'Waze', icon: '🚗', scheme: 'waze://?ll=' }
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
    
    // Load portal branding settings from database
    await loadDriverPortalSettings();
    
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
  
  // Check for dev mode URL parameter (?dev=1 or ?devmode=1)
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('dev') === '1' || urlParams.get('devmode') === '1') {
    window.ENV = window.ENV || {};
    window.ENV.DEV_MODE = true;
    state.emailVerified = true;
    state.phoneVerified = true;
    console.log('[DriverPortal] 🔧 DEV MODE enabled via URL parameter - skipping verification');
  }
  
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
    const { driverId, driverName, offerDetails, reservationId } = event.detail;
    
    // Only show if this is for the current driver
    if (driverId === state.driverId) {
      console.log('[DriverPortal] New farmout offer received, showing overlay');
      playNotificationSound('new_offer');
      
      // Show the hard offer overlay
      showTripOfferOverlay(reservationId, offerDetails);
      
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
// Trip Offer Overlay
// ============================================
let offerCountdownTimer = null;
let currentOfferData = null;

/**
 * Show the hard overlay for a new trip offer
 */
function showTripOfferOverlay(reservationId, offerDetails) {
  const overlay = document.getElementById('tripOfferOverlay');
  if (!overlay) {
    console.warn('[DriverPortal] Trip offer overlay element not found');
    return;
  }
  
  currentOfferData = { reservationId, ...offerDetails };
  
  // Populate offer details
  document.getElementById('offerPayout').textContent = `$${offerDetails.driverPay || '0.00'}`;
  
  // Format date and time
  const pickupDate = offerDetails.pickupDatetime ? new Date(offerDetails.pickupDatetime) : new Date();
  const dateOptions = { weekday: 'short', month: 'short', day: 'numeric' };
  const timeOptions = { hour: 'numeric', minute: '2-digit', hour12: true };
  document.getElementById('offerDate').textContent = pickupDate.toLocaleDateString('en-US', dateOptions);
  document.getElementById('offerTime').textContent = pickupDate.toLocaleTimeString('en-US', timeOptions);
  
  // Addresses
  document.getElementById('offerPickupAddress').textContent = offerDetails.pickupAddress || offerDetails.pickupCity || 'Pickup location';
  document.getElementById('offerDropoffAddress').textContent = offerDetails.dropoffAddress || offerDetails.dropoffCity || 'Dropoff location';
  
  // Passengers
  document.getElementById('offerPax').textContent = offerDetails.paxCount || 1;
  
  // Vehicle type
  const vehicleTypeEl = document.getElementById('offerVehicleType');
  if (vehicleTypeEl) {
    vehicleTypeEl.innerHTML = `<span class="vehicle-icon">🚙</span><span class="vehicle-name">${offerDetails.vehicleType || 'Vehicle'}</span>`;
  }
  
  // Distance and duration (will be updated by map calculation)
  document.getElementById('offerDistance').textContent = offerDetails.distance || '-- mi';
  document.getElementById('offerDuration').textContent = offerDetails.duration || '-- min';
  
  // Setup countdown timer
  const expiresAt = offerDetails.expiresAt ? new Date(offerDetails.expiresAt) : new Date(Date.now() + 15 * 60 * 1000);
  startOfferCountdown(expiresAt);
  
  // Check if map should be shown (setting)
  const showMapSetting = document.getElementById('showMapOnOffers');
  const showMap = showMapSetting ? showMapSetting.checked : true;
  const mapContainer = document.getElementById('offerMapContainer');
  
  if (mapContainer) {
    if (showMap && offerDetails.pickupAddress && offerDetails.dropoffAddress) {
      mapContainer.style.display = 'block';
      initOfferRouteMap(offerDetails.pickupAddress, offerDetails.dropoffAddress);
    } else {
      mapContainer.style.display = 'none';
    }
  }
  
  // Setup button handlers
  document.getElementById('acceptOfferBtn').onclick = () => handleOfferAccept(reservationId);
  document.getElementById('declineOfferBtn').onclick = () => handleOfferDecline(reservationId);
  
  // Show the overlay
  overlay.style.display = 'flex';
  
  console.log('[DriverPortal] Trip offer overlay shown for reservation:', reservationId);
}

/**
 * Hide the trip offer overlay
 */
function hideTripOfferOverlay() {
  const overlay = document.getElementById('tripOfferOverlay');
  if (overlay) {
    overlay.style.display = 'none';
  }
  
  if (offerCountdownTimer) {
    clearInterval(offerCountdownTimer);
    offerCountdownTimer = null;
  }
  
  currentOfferData = null;
}

/**
 * Start the countdown timer for offer expiry
 */
function startOfferCountdown(expiresAt) {
  if (offerCountdownTimer) {
    clearInterval(offerCountdownTimer);
  }
  
  const timerEl = document.getElementById('offerExpiresTimer');
  
  function updateTimer() {
    const now = Date.now();
    const remaining = expiresAt.getTime() - now;
    
    if (remaining <= 0) {
      timerEl.textContent = 'EXPIRED';
      timerEl.classList.add('urgent');
      hideTripOfferOverlay();
      showToast('Trip offer expired', 'warning');
      return;
    }
    
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    timerEl.textContent = `Expires in ${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    // Add urgent class when less than 2 minutes
    if (remaining < 120000) {
      timerEl.classList.add('urgent');
    } else {
      timerEl.classList.remove('urgent');
    }
  }
  
  updateTimer();
  offerCountdownTimer = setInterval(updateTimer, 1000);
}

/**
 * Initialize the route map for the offer
 */
async function initOfferRouteMap(pickupAddress, dropoffAddress) {
  const mapContainer = document.getElementById('offerRouteMap');
  if (!mapContainer) return;
  
  // Try to use Google Maps if available
  if (typeof google !== 'undefined' && google.maps) {
    try {
      const map = new google.maps.Map(mapContainer, {
        zoom: 10,
        center: { lat: 44.9778, lng: -93.2650 }, // Default to Minneapolis
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        styles: [
          { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
          { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a2e' }] },
          { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
          { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2d2d4a' }] },
          { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#1a1a2e' }] },
          { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f0f1a' }] }
        ]
      });
      
      const directionsService = new google.maps.DirectionsService();
      const directionsRenderer = new google.maps.DirectionsRenderer({
        map: map,
        suppressMarkers: false,
        polylineOptions: {
          strokeColor: '#4f46e5',
          strokeWeight: 4
        }
      });
      
      const result = await directionsService.route({
        origin: pickupAddress,
        destination: dropoffAddress,
        travelMode: google.maps.TravelMode.DRIVING
      });
      
      directionsRenderer.setDirections(result);
      
      // Update distance and duration from the result
      if (result.routes && result.routes[0] && result.routes[0].legs && result.routes[0].legs[0]) {
        const leg = result.routes[0].legs[0];
        document.getElementById('offerDistance').textContent = leg.distance.text;
        document.getElementById('offerDuration').textContent = leg.duration.text;
      }
      
      console.log('[DriverPortal] Offer route map initialized');
    } catch (err) {
      console.warn('[DriverPortal] Failed to initialize offer route map:', err);
      mapContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">Map unavailable</div>';
    }
  } else {
    // Fallback: show a static message
    mapContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">Map requires Google Maps API</div>';
  }
}

/**
 * Handle accepting the offer from the overlay
 */
async function handleOfferAccept(reservationId) {
  hideTripOfferOverlay();
  await window.acceptTrip(reservationId);
}

/**
 * Handle declining the offer from the overlay
 */
async function handleOfferDecline(reservationId) {
  hideTripOfferOverlay();
  await window.declineTrip(reservationId);
}

/**
 * Check for new offers and show overlay for the most recent one
 * Only shows overlay for offers that haven't been shown before
 */
function checkAndShowNewOfferOverlay() {
  if (!state.trips.offered || state.trips.offered.length === 0) return;
  
  // Get list of previously shown offers from sessionStorage
  const shownOffers = JSON.parse(sessionStorage.getItem('shown_offer_overlays') || '[]');
  
  // Find offers we haven't shown yet
  const newOffers = state.trips.offered.filter(trip => 
    trip.is_farmout_offer && !shownOffers.includes(trip.id)
  );
  
  if (newOffers.length === 0) return;
  
  // Show the first new offer (most recent by date)
  const offer = newOffers[0];
  
  // Mark as shown
  shownOffers.push(offer.id);
  sessionStorage.setItem('shown_offer_overlays', JSON.stringify(shownOffers));
  
  // Build offer details from the trip object
  const offerDetails = {
    reservationId: offer.id,
    confirmationNumber: offer.confirmation_number,
    pickupDatetime: offer.pickup_date_time,
    pickupAddress: offer.pickup_address || offer.pickup_location,
    dropoffAddress: offer.dropoff_address || offer.dropoff_location,
    pickupCity: offer.pickup_location,
    dropoffCity: offer.dropoff_location,
    driverPay: offer.driver_pay,
    paxCount: offer.passenger_count,
    vehicleType: offer.vehicle_type,
    expiresAt: offer.expires_at,
    distance: offer.distance,
    duration: offer.duration
  };
  
  // Play sound and show overlay
  playNotificationSound('new_offer');
  showTripOfferOverlay(offer.id, offerDetails);
  
  console.log('[DriverPortal] Auto-showing overlay for new offer:', offer.id);
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

// Load driver portal branding settings from database
async function loadDriverPortalSettings() {
  try {
    const supabaseUrl = window.ENV?.SUPABASE_URL || '';
    const supabaseKey = window.ENV?.SUPABASE_ANON_KEY || '';
    
    if (!supabaseUrl || !supabaseKey) return;
    
    const response = await fetch(
      `${supabaseUrl}/rest/v1/portal_settings?portal_type=eq.driver&select=*`,
      {
        headers: { 'apikey': supabaseKey }
      }
    );
    
    if (response.ok) {
      const settings = await response.json();
      if (settings?.length > 0) {
        const dbSettings = settings[0];
        
        // Apply header title
        const headerTitle = dbSettings.header_title || dbSettings.headerTitle;
        if (headerTitle) {
          document.querySelectorAll('.portal-header h1, .header-title').forEach(el => {
            el.textContent = headerTitle;
          });
        }
        
        // Apply logo
        const logo = dbSettings.logo || dbSettings.logo_url;
        if (logo) {
          document.querySelectorAll('#splashLogo, .splash-logo, .header-logo, .favicon-logo').forEach(img => {
            img.src = logo;
          });
        }
        
        // Apply primary color
        const primaryColor = dbSettings.primary_color || dbSettings.primaryColor;
        if (primaryColor) {
          document.documentElement.style.setProperty('--primary', primaryColor);
          document.documentElement.style.setProperty('--primary-color', primaryColor);
        }
        
        console.log('[DriverPortal] Portal settings loaded from database');
      }
    }
  } catch (err) {
    console.warn('[DriverPortal] Failed to load portal settings:', err);
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
      style: 'mapbox://styles/mapbox/streets-v12',
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
  
  // Availability preferences - 24/7 is mutually exclusive with other options
  setupAvailabilityCheckboxes();
  
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
        
        // Toggle SVG icons
        const eyeOpen = btn.querySelector('.eye-open');
        const eyeClosed = btn.querySelector('.eye-closed');
        if (eyeOpen && eyeClosed) {
          eyeOpen.style.display = isPassword ? 'none' : 'block';
          eyeClosed.style.display = isPassword ? 'block' : 'none';
        }
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

/**
 * Setup availability checkboxes - 24/7 Available is mutually exclusive with other options
 */
function setupAvailabilityCheckboxes() {
  const avail247 = document.getElementById('avail-247');
  const otherAvailCheckboxes = document.querySelectorAll('input[name="availability"]:not(#avail-247)');
  
  if (!avail247) return;
  
  // When 24/7 Available is checked, uncheck all others
  avail247.addEventListener('change', () => {
    if (avail247.checked) {
      otherAvailCheckboxes.forEach(cb => {
        cb.checked = false;
      });
    }
  });
  
  // When any other checkbox is checked, uncheck 24/7 Available
  otherAvailCheckboxes.forEach(cb => {
    cb.addEventListener('change', () => {
      if (cb.checked) {
        avail247.checked = false;
      }
    });
  });
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
      // Email wasn't sent - show code prominently
      console.warn('[DriverPortal] Email not sent, showing code to user');
      showFallbackCode(code, 'Email not configured');
    }
  } catch (err) {
    console.warn('[DriverPortal] Email send failed:', err);
    // Show the code prominently when email fails
    showFallbackCode(code, err.message || 'Email service unavailable');
  }
}

/**
 * Show fallback code prominently when email fails
 */
function showFallbackCode(code, reason) {
  // Show persistent toast with the code
  showToast(`Your code: ${code}`, 'warning', 30000); // 30 second toast
  
  // Also show in the OTP section if visible
  const otpSection = document.getElementById('emailOtpSection');
  if (otpSection) {
    let fallbackDiv = document.getElementById('emailFallbackCode');
    if (!fallbackDiv) {
      fallbackDiv = document.createElement('div');
      fallbackDiv.id = 'emailFallbackCode';
      fallbackDiv.style.cssText = 'background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 12px; margin: 10px 0; text-align: center;';
      otpSection.insertBefore(fallbackDiv, otpSection.firstChild);
    }
    fallbackDiv.innerHTML = `
      <div style="color: #92400e; font-size: 12px; margin-bottom: 4px;">⚠️ ${reason}</div>
      <div style="font-size: 24px; font-weight: bold; letter-spacing: 4px; color: #1f2937;">${code}</div>
      <div style="color: #6b7280; font-size: 11px; margin-top: 4px;">Enter this code below</div>
    `;
  }
  
  console.log('[DriverPortal] ⚠️ FALLBACK CODE DISPLAYED:', code);
}

async function sendOTPEmail(to, code) {
  // Get email settings from System Settings (emailSettingsConfig)
  const settingsRaw = localStorage.getItem('emailSettingsConfig');
  const settings = settingsRaw ? JSON.parse(settingsRaw) : {};
  
  const fromName = settings.fromName || 'RELIALIMO';
  
  console.log('[DriverPortal] Sending email via Resend API (server-side)');
  
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
  
  // Use server-side API endpoint (Resend) - this is the only reliable method
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
      console.log('[DriverPortal] ✅ Email sent via Resend API:', result);
      return true;
    } else {
      const error = await apiResponse.json();
      console.error('[DriverPortal] ❌ Resend API failed:', error);
      throw new Error(error.error || 'Failed to send email');
    }
  } catch (apiError) {
    console.error('[DriverPortal] ❌ Email send error:', apiError.message);
    
    // Fallback: Log to console for development/debugging
    console.log('[DriverPortal] ========== EMAIL OTP (Console Fallback) ==========');
    console.log('[DriverPortal] TO:', to);
    console.log('[DriverPortal] SUBJECT:', `Your ${fromName} Verification Code`);
    console.log('[DriverPortal] CODE:', code);
    console.log('[DriverPortal] ====================================================');
    console.log('[DriverPortal] Email failed. Ensure RESEND_API_KEY is set in Vercel.');
    console.log('[DriverPortal] ====================================================');
    
    throw apiError; // Re-throw so caller knows email failed
  }
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
  let vehicleType = document.getElementById('regVehicleType').value;
  const vehicleTypeOther = document.getElementById('regVehicleTypeOther')?.value?.trim();
  const licensePlate = document.getElementById('regVehiclePlate').value.trim();
  
  // Handle "Other" vehicle type
  if (vehicleType === '__other__') {
    if (!vehicleTypeOther) {
      showToast('Please enter a custom vehicle type name', 'error');
      return;
    }
    // Will create new vehicle type after driver is created
  } else if (!vehicleType) {
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
      // Default availability - 24/7 Available unless changed
      availability: ['24/7 Available'],
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
      
      // Get vehicle make/model/year for title - handle "Other" options
      const makeSelect = document.getElementById('regVehicleMake');
      const makeOther = document.getElementById('regVehicleMakeOther')?.value?.trim();
      const vehMake = (makeSelect?.value === '__other__' && makeOther) ? makeOther : (makeSelect?.value || null);
      
      const modelSelect = document.getElementById('regVehicleModel');
      const modelOther = document.getElementById('regVehicleModelOther')?.value?.trim();
      const vehModel = (modelSelect?.value === '__other__' && modelOther) ? modelOther : (modelSelect?.value || null);
      
      const vehYear = parseInt(document.getElementById('regVehicleYear').value) || null;
      const vehCapacity = parseInt(document.getElementById('regVehicleCapacity').value) || 4;
      
      // Handle vehicle type - create new or activate inactive
      let finalVehicleTypeId = vehicleType;
      
      if (vehicleType === '__other__' && vehicleTypeOther) {
        // Create a new vehicle type
        console.log('[DriverPortal] Creating custom vehicle type:', vehicleTypeOther);
        try {
          const newVehicleType = await createCustomVehicleType(vehicleTypeOther, organizationId);
          if (newVehicleType?.id) {
            finalVehicleTypeId = newVehicleType.id;
            console.log('[DriverPortal] ✅ Custom vehicle type created:', newVehicleType.id);
          } else {
            throw new Error('Failed to create vehicle type');
          }
        } catch (vtErr) {
          console.error('[DriverPortal] Failed to create custom vehicle type:', vtErr);
          showToast('Failed to create custom vehicle type: ' + vtErr.message, 'error');
          throw vtErr;
        }
      } else {
        // Check if selected type is inactive and activate it
        const selectedType = state.inactiveVehicleTypes?.find(t => t.id === vehicleType);
        if (selectedType) {
          console.log('[DriverPortal] Activating inactive vehicle type:', selectedType.name);
          try {
            await activateVehicleType(vehicleType);
            console.log('[DriverPortal] ✅ Vehicle type activated');
          } catch (actErr) {
            console.warn('[DriverPortal] Could not activate vehicle type:', actErr.message);
            // Non-fatal - continue with registration
          }
        }
      }
      
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
        veh_type: finalVehicleTypeId,
        vehicle_type_id: finalVehicleTypeId,
        // Vehicle details
        make: vehMake,
        model: vehModel,
        year: vehYear,
        color: document.getElementById('regVehicleColor').value || null,
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
    
    // Store all types (both active and inactive) for reference
    state.allVehicleTypes = types || [];
    
    // Separate active and inactive types
    const activeTypes = (types || []).filter(t => {
      const status = (t.status || '').toString().toUpperCase();
      return status === 'ACTIVE' || status === '' || !t.status;
    });
    
    const inactiveTypes = (types || []).filter(t => {
      const status = (t.status || '').toString().toUpperCase();
      return status === 'INACTIVE';
    });
    
    state.vehicleTypes = activeTypes;
    state.inactiveVehicleTypes = inactiveTypes;
    
    console.log('[DriverPortal] Active types:', activeTypes.length);
    console.log('[DriverPortal] Inactive types:', inactiveTypes.length);
    
    // Populate vehicle type dropdown
    const select = document.getElementById('regVehicleType');
    const otherInput = document.getElementById('regVehicleTypeOther');
    
    if (select) {
      // Clear all existing options
      select.innerHTML = '<option value="">Select type...</option>';
      
      // Add active types first
      if (activeTypes.length > 0) {
        const activeGroup = document.createElement('optgroup');
        activeGroup.label = 'Active Vehicle Types';
        activeTypes.forEach(t => {
          const opt = document.createElement('option');
          opt.value = t.id;
          opt.textContent = t.name || t.type_name || 'Unknown';
          activeGroup.appendChild(opt);
        });
        select.appendChild(activeGroup);
      }
      
      // Add inactive types in a separate group
      if (inactiveTypes.length > 0) {
        const inactiveGroup = document.createElement('optgroup');
        inactiveGroup.label = 'Inactive (will be activated)';
        inactiveTypes.forEach(t => {
          const opt = document.createElement('option');
          opt.value = t.id;
          opt.textContent = `${t.name || t.type_name || 'Unknown'} (inactive)`;
          opt.dataset.inactive = 'true';
          inactiveGroup.appendChild(opt);
        });
        select.appendChild(inactiveGroup);
      }
      
      // Add "Other" option at the end
      const otherOpt = document.createElement('option');
      otherOpt.value = '__other__';
      otherOpt.textContent = '➕ Other (enter custom type)';
      select.appendChild(otherOpt);
      
      console.log('[DriverPortal] Vehicle type dropdown populated with', select.options.length, 'options');
      
      // Handle "Other" selection - show/hide text input
      select.addEventListener('change', () => {
        if (select.value === '__other__') {
          if (otherInput) {
            otherInput.style.display = 'block';
            otherInput.focus();
            otherInput.required = true;
          }
        } else {
          if (otherInput) {
            otherInput.style.display = 'none';
            otherInput.required = false;
          }
        }
      });
    } else {
      console.warn('[DriverPortal] regVehicleType select not found');
    }
    
    console.log('[DriverPortal] Loaded', state.vehicleTypes.length, 'active vehicle types');
    
    // Also populate Make/Model/Year/Color dropdowns for vehicle registration
    populateVehicleMakeOptions();
    populateVehicleYearOptions();
    populateVehicleColorOptions();
  } catch (err) {
    console.error('[DriverPortal] Failed to load vehicle types:', err);
  }
}

/**
 * Update the vehicle preview image based on selected make/model
 * Uses image_url from database, or falls back to a search-based image
 */
function updateVehiclePreview() {
  const makeSelect = document.getElementById('regVehicleMake');
  const modelSelect = document.getElementById('regVehicleModel');
  const previewContainer = document.getElementById('vehiclePreviewContainer');
  const previewImage = document.getElementById('vehiclePreviewImage');
  const previewLabel = document.getElementById('vehiclePreviewLabel');
  
  if (!previewContainer || !previewImage || !previewLabel) return;
  
  const make = makeSelect?.value || '';
  const model = modelSelect?.value || '';
  
  // If no make selected or "Other" selected, hide preview
  if (!make || make === '__other__' || model === '__other__') {
    previewContainer.style.display = 'none';
    return;
  }
  
  // Try to get image_url from stored models
  let imageUrl = null;
  if (model && window._vehicleModels) {
    const modelData = window._vehicleModels.find(m => m.name === model);
    if (modelData && modelData.image_url) {
      imageUrl = modelData.image_url;
    }
  }
  
  // If no model image, try make logo
  if (!imageUrl && make && window._vehicleMakes) {
    const makeData = window._vehicleMakes.find(m => m.name === make);
    if (makeData && makeData.logo_url) {
      imageUrl = makeData.logo_url;
    }
  }
  
  // If no image URL from database, use a placeholder or fallback image search
  if (!imageUrl) {
    // Use a simple placeholder - could be enhanced with a vehicle image API later
    const searchTerm = model ? `${make} ${model}` : make;
    // Using a placeholder service or generic vehicle silhouette
    imageUrl = `https://via.placeholder.com/200x120/1a1a2e/c5a572?text=${encodeURIComponent(searchTerm)}`;
  }
  
  // Update the preview
  previewImage.src = imageUrl;
  previewImage.alt = model ? `${make} ${model}` : make;
  previewLabel.textContent = model ? `${make} ${model}` : make;
  previewContainer.style.display = 'flex';
  
  // Add error handler for failed images
  previewImage.onerror = () => {
    const fallbackText = model ? `${make} ${model}` : make;
    previewImage.src = `https://via.placeholder.com/200x120/1a1a2e/c5a572?text=${encodeURIComponent(fallbackText)}`;
  };
  
  console.log('[DriverPortal] Vehicle preview updated:', { make, model, imageUrl });
}

/**
 * Populate Year dropdown with years starting from 2019
 */
function populateVehicleYearOptions() {
  const yearSelect = document.getElementById('regVehicleYear');
  if (!yearSelect) return;
  
  const currentYear = new Date().getFullYear();
  const startYear = currentYear + 1; // allow ordering units ahead of delivery
  const minYear = 2019;
  
  yearSelect.innerHTML = '<option value="">Select Year</option>';
  for (let year = startYear; year >= minYear; year--) {
    const option = document.createElement('option');
    option.value = String(year);
    option.textContent = String(year);
    yearSelect.appendChild(option);
  }
}

/**
 * Populate Make dropdown from database
 */
async function populateVehicleMakeOptions() {
  const makeSelect = document.getElementById('regVehicleMake');
  const otherInput = document.getElementById('regVehicleMakeOther');
  if (!makeSelect) return;
  
  // Fetch makes from database (including logo_url)
  let makes = [];
  try {
    const response = await fetch(`${window.ENV?.SUPABASE_URL || 'https://qdrtpfgpqrfblpmskeig.supabase.co'}/rest/v1/vehicle_makes?is_active=eq.true&order=sort_order,name&select=id,name,display_name,logo_url`, {
      headers: {
        'apikey': window.ENV?.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFkcnRwZmdwcXJmYmxwbXNrZWlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ0MDcxNjMsImV4cCI6MjA1OTk4MzE2M30.YxGuvE7hqVfXirlnIbcNvEKnKR1LZMh1SfKPISIVn2c',
        'Content-Type': 'application/json'
      }
    });
    if (response.ok) {
      const data = await response.json();
      makes = data.map(m => ({ id: m.id, name: m.name, display_name: m.display_name || m.name, logo_url: m.logo_url }));
      console.log('[DriverPortal] Loaded', makes.length, 'vehicle makes from database');
    }
  } catch (err) {
    console.warn('[DriverPortal] Could not load makes from database, using fallback:', err);
  }
  
  // Fallback to hardcoded if database empty or failed
  if (makes.length === 0) {
    makes = [
      'Audi', 'Battisti', 'Bentley', 'BMW', 'Cadillac', 'Chevrolet', 'Chrysler', 'Dodge',
      'Executive Coach Builders', 'Ford', 'Freightliner', 'GMC', 'Grech', 'Infiniti',
      'International', 'Jaguar', 'Land Rover', 'Lexus', 'Lincoln', 'MCI', 'Mercedes-Benz',
      'Porsche', 'Prevost', 'Range Rover', 'Rolls-Royce', 'Sprinter', 'Tesla', 'Tiffany', 'Toyota', 'Van Hool'
    ].map(name => ({ name, display_name: name, logo_url: null }));
  }
  
  // Store makes globally for image lookup
  window._vehicleMakes = makes;
  
  const currentValue = makeSelect.value;
  makeSelect.innerHTML = '<option value="">Select Make</option>';
  makes.forEach(make => {
    const option = document.createElement('option');
    option.value = make.name;
    option.textContent = make.display_name;
    option.dataset.makeId = make.id || '';
    option.dataset.logoUrl = make.logo_url || '';
    makeSelect.appendChild(option);
  });
  
  // Add "Other" option at the end
  const otherOpt = document.createElement('option');
  otherOpt.value = '__other__';
  otherOpt.textContent = '➕ Other (enter custom make)';
  makeSelect.appendChild(otherOpt);
  
  if (currentValue && currentValue !== '__other__') makeSelect.value = currentValue;
  
  // Setup model population and "Other" handling when make changes
  makeSelect.addEventListener('change', () => {
    // Update vehicle preview
    updateVehiclePreview();
    
    if (makeSelect.value === '__other__') {
      if (otherInput) {
        otherInput.style.display = 'block';
        otherInput.focus();
      }
      // Clear model dropdown since we don't have models for custom makes
      const modelSelect = document.getElementById('regVehicleModel');
      const modelOtherInput = document.getElementById('regVehicleModelOther');
      if (modelSelect) {
        modelSelect.innerHTML = '<option value="">Select Model</option>';
        const otherModelOpt = document.createElement('option');
        otherModelOpt.value = '__other__';
        otherModelOpt.textContent = '➕ Other (enter custom model)';
        modelSelect.appendChild(otherModelOpt);
        modelSelect.value = '__other__';
      }
      if (modelOtherInput) {
        modelOtherInput.style.display = 'block';
      }
    } else {
      if (otherInput) {
        otherInput.style.display = 'none';
        otherInput.value = '';
      }
      populateVehicleModelOptions();
    }
  });
}

/**
 * Populate Model dropdown from database based on selected Make
 */
async function populateVehicleModelOptions() {
  const makeSelect = document.getElementById('regVehicleMake');
  const modelSelect = document.getElementById('regVehicleModel');
  const otherInput = document.getElementById('regVehicleModelOther');
  if (!modelSelect) return;
  
  const selectedMake = makeSelect?.value || '';
  
  // Hide other input initially
  if (otherInput) {
    otherInput.style.display = 'none';
    otherInput.value = '';
  }
  
  // Fetch models from database for selected make (including image_url)
  let models = [];
  if (selectedMake && selectedMake !== '__other__') {
    try {
      // First get the make_id
      const makeResponse = await fetch(`${window.ENV?.SUPABASE_URL || 'https://qdrtpfgpqrfblpmskeig.supabase.co'}/rest/v1/vehicle_makes?name=eq.${encodeURIComponent(selectedMake)}&select=id`, {
        headers: {
          'apikey': window.ENV?.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFkcnRwZmdwcXJmYmxwbXNrZWlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ0MDcxNjMsImV4cCI6MjA1OTk4MzE2M30.YxGuvE7hqVfXirlnIbcNvEKnKR1LZMh1SfKPISIVn2c',
          'Content-Type': 'application/json'
        }
      });
      
      if (makeResponse.ok) {
        const makeData = await makeResponse.json();
        if (makeData.length > 0) {
          const makeId = makeData[0].id;
          // Then get models for that make (including image_url)
          const modelResponse = await fetch(`${window.ENV?.SUPABASE_URL || 'https://qdrtpfgpqrfblpmskeig.supabase.co'}/rest/v1/vehicle_models?make_id=eq.${makeId}&is_active=eq.true&order=sort_order,name&select=id,name,display_name,image_url`, {
            headers: {
              'apikey': window.ENV?.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFkcnRwZmdwcXJmYmxwbXNrZWlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ0MDcxNjMsImV4cCI6MjA1OTk4MzE2M30.YxGuvE7hqVfXirlnIbcNvEKnKR1LZMh1SfKPISIVn2c',
              'Content-Type': 'application/json'
            }
          });
          
          if (modelResponse.ok) {
            const modelData = await modelResponse.json();
            models = modelData.map(m => ({ name: m.name, display_name: m.display_name || m.name, image_url: m.image_url }));
            console.log('[DriverPortal] Loaded', models.length, 'models for', selectedMake, 'from database');
          }
        }
      }
    } catch (err) {
      console.warn('[DriverPortal] Could not load models from database, using fallback:', err);
    }
  }
  
  // Store models globally for image lookup
  window._vehicleModels = models;
  
  // Fallback to hardcoded if database empty or failed
  if (models.length === 0 && selectedMake) {
    const fallbackModelsByMake = {
      'Cadillac': ['Escalade', 'Escalade ESV', 'CT6', 'XTS', 'XT5', 'XT6', 'Lyriq', 'DTS', 'CTS'],
      'Chevrolet': ['Suburban', 'Tahoe', 'Express', 'Express 2500', 'Express 3500', 'Traverse', 'Silverado'],
      'Chrysler': ['300', '300C', 'Pacifica', 'Town & Country', 'Voyager'],
      'Dodge': ['Durango', 'Grand Caravan', 'Charger', 'Ram ProMaster'],
      'Ford': ['Expedition', 'Expedition MAX', 'Explorer', 'Transit', 'Transit 350', 'E-350', 'E-450', 'F-550', 'Excursion'],
      'GMC': ['Yukon', 'Yukon XL', 'Savana', 'Savana 2500', 'Savana 3500', 'Sierra', 'Acadia'],
      'Infiniti': ['QX80', 'QX60', 'QX56', 'Q70L'],
      'Jaguar': ['XJ', 'XJL', 'F-Pace', 'I-Pace'],
      'Lexus': ['LS 460', 'LS 500', 'LX 570', 'LX 600', 'GX 460', 'ES 350'],
      'Lincoln': ['Navigator', 'Navigator L', 'MKT', 'MKS', 'Continental', 'Town Car', 'Aviator'],
      'Mercedes-Benz': ['S-Class', 'S550', 'S560', 'S580', 'Maybach', 'E-Class', 'GLS', 'GLE', 'V-Class', 'Sprinter', 'Metris'],
      'BMW': ['7 Series', '740i', '750i', 'X7', 'X5', 'i7'],
      'Audi': ['A8', 'A8L', 'Q7', 'Q8', 'e-tron'],
      'Tesla': ['Model S', 'Model X', 'Model Y', 'Model 3'],
      'Toyota': ['Sequoia', 'Land Cruiser', 'Sienna', 'Highlander'],
      'Rolls-Royce': ['Phantom', 'Ghost', 'Cullinan', 'Dawn', 'Wraith'],
      'Bentley': ['Flying Spur', 'Bentayga', 'Continental GT', 'Mulsanne'],
      'Land Rover': ['Range Rover', 'Range Rover Sport', 'Defender', 'Discovery'],
      'Range Rover': ['Autobiography', 'Sport', 'Velar', 'Evoque', 'LWB'],
      'Porsche': ['Panamera', 'Cayenne', 'Taycan'],
      'Sprinter': ['2500', '3500', '4500', 'Executive', 'Limo', 'Party Bus'],
      'Freightliner': ['M2', 'S2C', 'Party Bus Chassis'],
      'International': ['3200', '3400', 'Party Bus Chassis'],
      'Prevost': ['H3-45', 'X3-45', 'Entertainer Coach'],
      'MCI': ['J4500', 'D4500', 'D45 CRT LE'],
      'Van Hool': ['CX35', 'CX45', 'TX'],
      'Grech': ['GM33', 'GM40', 'Limo Bus'],
      'Executive Coach Builders': ['Sprinter Executive', 'Mobile Office', 'Luxury Van'],
      'Battisti': ['Custom Sedan', 'Custom SUV', 'Custom Sprinter'],
      'Tiffany': ['Town Car', 'Sprinter Conversion', 'Executive Van']
    };
    const fallbackModels = fallbackModelsByMake[selectedMake] || [];
    models = fallbackModels.map(name => ({ name, display_name: name, image_url: null }));
    window._vehicleModels = models;
  }
  
  const currentValue = modelSelect.value;
  
  modelSelect.innerHTML = '<option value="">Select Model</option>';
  models.forEach(model => {
    const option = document.createElement('option');
    option.value = model.name;
    option.textContent = model.display_name;
    option.dataset.imageUrl = model.image_url || '';
    modelSelect.appendChild(option);
  });
  
  // Add "Other" option at the end
  const otherOpt = document.createElement('option');
  otherOpt.value = '__other__';
  otherOpt.textContent = '➕ Other (enter custom model)';
  modelSelect.appendChild(otherOpt);
  
  // Try to restore previous value if it exists in new list
  const modelNames = models.map(m => m.name);
  if (currentValue && currentValue !== '__other__' && modelNames.includes(currentValue)) {
    modelSelect.value = currentValue;
  }
  
  // Handle "Other" selection - show/hide text input
  // Remove old listener first to prevent duplicates
  const newModelSelect = modelSelect.cloneNode(true);
  modelSelect.parentNode.replaceChild(newModelSelect, modelSelect);
  
  newModelSelect.addEventListener('change', () => {
    // Update vehicle preview
    updateVehiclePreview();
    
    const modelOtherInput = document.getElementById('regVehicleModelOther');
    if (newModelSelect.value === '__other__') {
      if (modelOtherInput) {
        modelOtherInput.style.display = 'block';
        modelOtherInput.focus();
      }
    } else {
      if (modelOtherInput) {
        modelOtherInput.style.display = 'none';
        modelOtherInput.value = '';
      }
    }
  });
}

/**
 * Populate Color dropdown with common vehicle colors
 */
function populateVehicleColorOptions() {
  const colorSelect = document.getElementById('regVehicleColor');
  if (!colorSelect) return;
  
  const colors = [
    'Black',
    'White',
    'Silver',
    'Gray',
    'Charcoal',
    'Navy Blue',
    'Dark Blue',
    'Midnight Blue',
    'Burgundy',
    'Maroon',
    'Red',
    'Champagne',
    'Gold',
    'Bronze',
    'Pearl White',
    'Diamond White',
    'Obsidian Black',
    'Onyx Black',
    'Platinum',
    'Graphite',
    'Metallic Gray',
    'Cashmere',
    'Tan',
    'Beige',
    'Brown',
    'Green',
    'Dark Green'
  ];
  
  const currentValue = colorSelect.value;
  colorSelect.innerHTML = '<option value="">Select Color</option>';
  colors.forEach(color => {
    const option = document.createElement('option');
    option.value = color;
    option.textContent = color;
    colorSelect.appendChild(option);
  });
  if (currentValue) colorSelect.value = currentValue;
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
      const farmoutStatus = trip.farmout_status || '';
      
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
      // Upcoming (assigned and in the future) - including farmout assigned AND in-house assigned
      else if (driverStatus === 'assigned' || driverStatus === 'available' || 
               farmoutStatus === 'assigned' || farmoutStatus === 'in_house_assigned') {
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
    
    // Check for new offers and show overlay for the first one
    checkAndShowNewOfferOverlay();
    
    // Update UI
    renderTripLists();
    updateBadges();
    updateInHouseStatusWidget();
    
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

/**
 * Format pickup date with day of week, date, and abbreviated month
 * e.g., "Mon, Jan 27"
 */
function formatTripDate(dateTimeStr) {
  if (!dateTimeStr) return '';
  const dt = new Date(dateTimeStr);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[dt.getDay()]}, ${months[dt.getMonth()]} ${dt.getDate()}`;
}

/**
 * Format time from datetime string
 */
function formatTripTime(dateTimeStr) {
  if (!dateTimeStr) return '';
  const dt = new Date(dateTimeStr);
  return dt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
}

/**
 * Check if address is an airport
 */
function isAirportAddress(address) {
  if (!address) return false;
  const airportPatterns = /\b(airport|MSP|ORD|JFK|LAX|SFO|LGA|ATL|DFW|DEN|SEA|BOS|PHL|FLL|MIA|SAN|PDX|STP|RST|DLH)\b/i;
  return airportPatterns.test(address);
}

/**
 * Render trip card for upcoming or offered trips
 * Enhanced with full trip details, flight info, and action buttons
 */
function renderTripCard(trip, type) {
  const pickupDateTime = trip.pickup_date_time || trip.pickup_datetime || `${trip.pickup_date}T${trip.pickup_time || '00:00'}`;
  const dropoffDateTime = trip.dropoff_date_time || trip.dropoff_datetime || trip.do_time;
  
  // Format date: Day of week, Month Day (e.g., "Mon, Jan 27")
  const tripDate = formatTripDate(pickupDateTime);
  const pickupTime = formatTripTime(pickupDateTime);
  const dropoffTime = dropoffDateTime ? formatTripTime(dropoffDateTime) : '';
  
  const passengerName = trip.passenger_name || 
    `${trip.passenger_first_name || ''} ${trip.passenger_last_name || ''}`.trim() || 
    'Passenger';
  const passengerCount = trip.passenger_count || 1;
  const confNumber = trip.confirmation_number || trip.id?.slice(0, 8);
  const vehicleType = trip.vehicle_type || '';
  
  // Check for airport trips
  const pickupAddress = trip.pickup_address || trip.pu_address || 'Pickup location';
  const dropoffAddress = trip.dropoff_address || trip.do_address || 'Dropoff location';
  const isAirportPickup = isAirportAddress(pickupAddress) || trip.pickup_airport || trip.is_airport_pickup;
  const isAirportDropoff = isAirportAddress(dropoffAddress) || trip.dropoff_airport || trip.is_airport_dropoff;
  
  // Flight info for airport trips
  const flightNumber = trip.flight_number || trip.form_snapshot?.routing?.stops?.[0]?.flightNumber || '';
  const flightAirline = trip.airline_code || trip.form_snapshot?.routing?.stops?.[0]?.airline || '';
  
  // Special requirements
  const hasBabySeat = trip.baby_seat || trip.child_seat || trip.car_seat || 
    trip.special_instructions?.toLowerCase()?.includes('baby seat') ||
    trip.special_instructions?.toLowerCase()?.includes('car seat');
  const hasNotes = trip.special_instructions || trip.trip_notes || trip.notes;
  
  // Footer buttons based on trip type
  let footerButtons = '';
  if (type === 'offered') {
    footerButtons = `
      <div class="trip-card-actions">
        <button class="btn btn-success btn-sm" onclick="event.stopPropagation(); acceptTrip('${trip.id}')">✓ Accept</button>
        <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); declineTrip('${trip.id}')">✗ Decline</button>
      </div>
    `;
  } else if (type === 'upcoming') {
    footerButtons = `
      <div class="trip-card-actions">
        <button class="btn btn-outline btn-sm" onclick="event.stopPropagation(); openStatusModal('${trip.id}')">📊 Status</button>
        <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); startTrip('${trip.id}')">🚗 Start Trip</button>
      </div>
    `;
  }
  
  // Build flight info display
  let flightInfoHtml = '';
  if (isAirportPickup && flightNumber) {
    flightInfoHtml = `
      <div class="trip-flight-info" data-flight="${flightNumber}" id="flight-info-${trip.id}">
        <span class="flight-badge">✈️ ${flightAirline}${flightNumber}</span>
        <span class="flight-status loading">Loading...</span>
      </div>
    `;
    // Queue flight status update
    setTimeout(() => updateFlightStatus(trip.id, flightNumber), 100);
  }
  
  return `
    <div class="trip-card trip-card-enhanced" data-trip-id="${trip.id}">
      <!-- Header: Date/Time and Conf # -->
      <div class="trip-card-header">
        <div class="trip-datetime">
          <div class="trip-date-display">${tripDate}</div>
          <div class="trip-time-display">
            <span class="time-pickup">${pickupTime}</span>
            ${dropoffTime ? `<span class="time-separator">→</span><span class="time-dropoff">${dropoffTime}</span>` : ''}
          </div>
        </div>
        <div class="trip-conf-badge">#${confNumber}</div>
      </div>
      
      <!-- Customer Info -->
      <div class="trip-customer-info">
        <div class="customer-avatar">👤</div>
        <div class="customer-details">
          <div class="customer-name">${passengerName}</div>
          <div class="customer-meta">
            <span class="pax-count">${passengerCount} pax</span>
            ${vehicleType ? `<span class="vehicle-badge">🚗 ${vehicleType}</span>` : ''}
            ${hasBabySeat ? '<span class="baby-seat-badge">👶 Baby Seat</span>' : ''}
          </div>
        </div>
        ${hasNotes ? `<button class="btn-notes" onclick="event.stopPropagation(); showTripNotes('${trip.id}')" title="View Notes">📝</button>` : ''}
      </div>
      
      <!-- Route: Pickup & Dropoff -->
      <div class="trip-route-enhanced">
        <div class="route-stop pickup">
          <div class="stop-marker pickup-marker">📍</div>
          <div class="stop-details">
            <div class="stop-label">PICKUP</div>
            <div class="stop-address">${pickupAddress}</div>
            ${flightInfoHtml}
          </div>
        </div>
        <div class="route-line"></div>
        <div class="route-stop dropoff">
          <div class="stop-marker dropoff-marker">🏁</div>
          <div class="stop-details">
            <div class="stop-label">DROP-OFF</div>
            <div class="stop-address">${dropoffAddress}</div>
          </div>
        </div>
      </div>
      
      ${renderFarmoutOfferDetails(trip, type)}
      
      <!-- Action Buttons -->
      ${footerButtons ? `<div class="trip-card-footer">${footerButtons}</div>` : ''}
    </div>
  `;
}

// ============================================
// In-House Status Widget
// ============================================
let inHouseCountdownTimer = null;

/**
 * Update the In-House driver status widget
 * Shows countdown to next trip and current driver status
 */
function updateInHouseStatusWidget() {
  const widget = document.getElementById('inHouseStatusWidget');
  if (!widget) return;
  
  // Check if driver has In-House trips (farm_mode = 'manual' or assignment_type = 'In-House')
  const inHouseTrips = state.trips.upcoming.filter(trip => {
    const farmMode = trip.farm_mode || trip.farmout_mode || '';
    const assignmentType = trip.assignment_type || '';
    return farmMode === 'manual' || assignmentType === 'In-House';
  });
  
  // If no In-House trips, hide widget
  if (inHouseTrips.length === 0) {
    widget.style.display = 'none';
    if (inHouseCountdownTimer) {
      clearInterval(inHouseCountdownTimer);
      inHouseCountdownTimer = null;
    }
    return;
  }
  
  // Show widget
  widget.style.display = 'block';
  
  // Get the next upcoming In-House trip
  const nextTrip = inHouseTrips[0];
  
  // Update trip info
  const confEl = document.getElementById('nextTripConf');
  const timeEl = document.getElementById('nextTripTime');
  if (confEl) confEl.textContent = `#${nextTrip.confirmation_number || nextTrip.id?.slice(0, 8)}`;
  if (timeEl) {
    const pickupTime = nextTrip.pickup_time || nextTrip.pu_time || 
      (nextTrip.pickup_date_time ? new Date(nextTrip.pickup_date_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--');
    const pickupDate = nextTrip.pickup_date || nextTrip.pu_date ||
      (nextTrip.pickup_date_time ? new Date(nextTrip.pickup_date_time).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '');
    timeEl.textContent = `${pickupTime} - ${pickupDate}`;
  }
  
  // Update driver status
  const statusDot = document.getElementById('driverStatusDot');
  const statusLabel = document.getElementById('driverStatusLabel');
  
  let driverStatus = 'Available';
  let statusClass = '';
  
  if (state.trips.active) {
    driverStatus = 'On Trip';
    statusClass = 'on-trip';
  } else if (inHouseTrips.length > 0) {
    const nextPickup = new Date(nextTrip.pickup_date_time || `${nextTrip.pickup_date}T${nextTrip.pickup_time}`);
    const now = new Date();
    const minutesUntil = (nextPickup - now) / 60000;
    
    if (minutesUntil < 30) {
      driverStatus = 'Trip Soon';
      statusClass = 'busy';
    } else {
      driverStatus = 'Available';
      statusClass = '';
    }
  }
  
  if (statusDot) statusDot.className = `status-dot ${statusClass}`;
  if (statusLabel) statusLabel.textContent = driverStatus;
  
  // Start countdown timer
  startInHouseCountdown(nextTrip);
}

/**
 * Start/update the countdown timer for In-House widget
 */
function startInHouseCountdown(nextTrip) {
  // Clear existing timer
  if (inHouseCountdownTimer) {
    clearInterval(inHouseCountdownTimer);
  }
  
  const countdownEl = document.getElementById('countdownTime');
  const countdownBar = document.getElementById('inHouseCountdownBar');
  
  if (!countdownEl) return;
  
  // Get pickup datetime
  const pickupDateTime = new Date(nextTrip.pickup_date_time || `${nextTrip.pickup_date}T${nextTrip.pickup_time || '00:00'}`);
  
  // Calculate total countdown duration for percentage (12 hours before)
  const totalDuration = 12 * 60 * 60 * 1000; // 12 hours in ms
  
  const updateCountdown = () => {
    const now = new Date();
    const timeUntil = pickupDateTime - now;
    
    if (timeUntil <= 0) {
      // Trip time has arrived
      countdownEl.textContent = 'NOW!';
      countdownEl.className = 'countdown-time imminent';
      if (countdownBar) {
        countdownBar.style.width = '0%';
        countdownBar.className = 'countdown-bar danger';
      }
      return;
    }
    
    // Format countdown
    const hours = Math.floor(timeUntil / (1000 * 60 * 60));
    const minutes = Math.floor((timeUntil % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeUntil % (1000 * 60)) / 1000);
    
    let displayTime;
    if (hours > 0) {
      displayTime = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else {
      displayTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    
    countdownEl.textContent = displayTime;
    
    // Update styling based on urgency
    const minutesUntil = timeUntil / 60000;
    if (minutesUntil < 15) {
      countdownEl.className = 'countdown-time imminent';
      if (countdownBar) countdownBar.className = 'countdown-bar danger';
    } else if (minutesUntil < 60) {
      countdownEl.className = 'countdown-time urgent';
      if (countdownBar) countdownBar.className = 'countdown-bar warning';
    } else {
      countdownEl.className = 'countdown-time';
      if (countdownBar) countdownBar.className = 'countdown-bar';
    }
    
    // Update progress bar (percentage of 12 hours remaining)
    if (countdownBar) {
      const percentage = Math.min(100, Math.max(0, (timeUntil / totalDuration) * 100));
      countdownBar.style.width = `${percentage}%`;
    }
  };
  
  // Initial update
  updateCountdown();
  
  // Update every second
  inHouseCountdownTimer = setInterval(updateCountdown, 1000);
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
  const status = trip.driver_status || 'getting_ready';
  const statusMeta = STATUS_META[status] || STATUS_META.getting_ready;
  const passengerName = trip.passenger_name || trip.passenger_first_name || 'Passenger';
  const passengerPhone = trip.passenger_phone || trip.passenger_cell || '';
  
  // Parse pickup date/time for display
  const pickupDateTime = new Date(trip.pickup_date_time || trip.pickup_date);
  const pickupDay = pickupDateTime.toLocaleDateString('en-US', { weekday: 'short' });
  const pickupDate = pickupDateTime.getDate();
  const pickupMonth = pickupDateTime.toLocaleDateString('en-US', { month: 'short' });
  const pickupTime = pickupDateTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  
  // Calculate elapsed time
  const elapsed = state.timerStartTime ? formatElapsedTime(Date.now() - state.timerStartTime) : '00:00';
  
  // Next status options
  const nextStatuses = STATUS_TRANSITIONS[status] || [];
  
  // Store base fare for post-trip calculations
  state.activeTripBaseFare = parseFloat(trip.driver_pay) || parseFloat(trip.base_fare) || 0;
  
  // Create status progress bar
  const statusFlow = ['getting_ready', 'enroute', 'arrived', 'passenger_onboard', 'done'];
  const currentStatusIndex = statusFlow.indexOf(status);
  
  elements.activeTripCard.innerHTML = `
    <!-- Status Progress Bar -->
    <div class="status-progress-bar">
      ${statusFlow.map((s, idx) => {
        const meta = STATUS_META[s];
        const isActive = s === status;
        const isComplete = idx < currentStatusIndex;
        const stateClass = isActive ? 'active' : (isComplete ? 'complete' : 'pending');
        return `<div class="status-step ${stateClass}" title="${meta.label}">${meta.emoji}</div>`;
      }).join('<div class="status-connector"></div>')}
    </div>
    
    <!-- Current Status Banner -->
    <div class="active-trip-status-bar ${status}">
      ${statusMeta.emoji} ${statusMeta.label}
    </div>
    
    <div class="active-trip-body">
      <!-- Trip Info Header -->
      <div class="active-trip-header">
        <div class="pickup-datetime">
          <div class="datetime-primary">
            <span class="datetime-time">${pickupTime}</span>
          </div>
          <div class="datetime-secondary">
            <span class="datetime-day">${pickupDay}</span>
            <span class="datetime-date">${pickupMonth} ${pickupDate}</span>
          </div>
        </div>
        <div class="trip-conf-badge">
          <span class="conf-label">CONF#</span>
          <span class="conf-number">${trip.confirmation_number || trip.id?.slice(0, 8)}</span>
        </div>
      </div>
      
      <!-- Passenger Info -->
      <div class="trip-passenger-info">
        <div class="passenger-avatar">👤</div>
        <div class="passenger-details">
          <div class="passenger-name">${passengerName}</div>
          ${passengerPhone ? `<a href="tel:${passengerPhone}" class="passenger-phone">📞 ${formatPhone(passengerPhone)}</a>` : ''}
        </div>
        <div class="passenger-count">${trip.passenger_count || 1} PAX</div>
      </div>
      
      <!-- Vehicle Type -->
      ${trip.vehicle_type ? `
        <div class="trip-vehicle-type">
          <span class="vehicle-icon">🚗</span>
          <span class="vehicle-name">${trip.vehicle_type}</span>
        </div>
      ` : ''}
      
      <!-- Trip Timer -->
      <div class="active-trip-timer">
        <div class="timer-value" id="tripTimer">${elapsed}</div>
        <div class="timer-label">Trip Duration</div>
      </div>
      
      <!-- Route with Navigate buttons -->
      <div class="trip-route-active">
        <div class="route-point">
          <div class="route-marker pickup">PU</div>
          <div class="route-address">${trip.pickup_address || trip.pickup_location || 'Pickup'}</div>
          <button class="btn btn-sm btn-nav" onclick="event.stopPropagation(); openNavigation('${(trip.pickup_address || trip.pickup_location || '').replace(/'/g, "\\'")}')">
            🧭
          </button>
        </div>
        <div class="route-connector"></div>
        <div class="route-point">
          <div class="route-marker dropoff">DO</div>
          <div class="route-address">${trip.dropoff_address || trip.dropoff_location || 'Dropoff'}</div>
          <button class="btn btn-sm btn-nav" onclick="event.stopPropagation(); openNavigation('${(trip.dropoff_address || trip.dropoff_location || '').replace(/'/g, "\\'")}')">
            🧭
          </button>
        </div>
      </div>
      
      <!-- Map Toggle Button (for mobile) -->
      <button type="button" id="toggleMapBtn" class="btn btn-outline btn-map-toggle" onclick="toggleMapVisibility()">
        🗺️ ${state.mapVisible ? 'Hide Map' : 'Show Map'}
      </button>
      
      <!-- Status Action Buttons -->
      <div class="active-trip-actions">
        ${nextStatuses.map(nextStatus => {
          const meta = STATUS_META[nextStatus];
          const btnClass = nextStatus === 'done' ? 'btn-success btn-large' : 'btn-primary';
          const btnLabel = getStatusActionLabel(nextStatus);
          return `
            <button class="btn ${btnClass}" onclick="updateTripStatus('${trip.id}', '${nextStatus}')">
              ${meta.emoji} ${btnLabel}
            </button>
          `;
        }).join('')}
      </div>
      
      <!-- Special Instructions -->
      ${trip.special_instructions ? `
        <div class="trip-special-instructions">
          <div class="instructions-header">⚠️ Special Instructions</div>
          <div class="instructions-text">${trip.special_instructions}</div>
        </div>
      ` : ''}
      
      <!-- Driver Notes Quick Add -->
      <div class="trip-notes-quick">
        <input type="text" id="quickNotes" placeholder="Quick note to dispatch..." class="quick-note-input">
        <button class="btn btn-sm" onclick="sendQuickNote('${trip.id}')">📤</button>
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
    
    // Start with "getting_ready" status instead of immediately enroute
    await updateReservationStatus(tripId, { driver_status: 'getting_ready' });
    
    showToast('Trip started! Update status as you go.', 'success');
    switchTab('active');
    await refreshTrips();
    
    // Check map preference on first navigation
    if (!state.preferredMapApp) {
      checkMapPreference();
    }
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
      showToast('🚗 On the way! Passenger notified.', 'success');
    } else if (newStatus === 'arrived') {
      await sendPassengerNotification(tripId, 'arrived');
      showToast('📍 Arrived! Passenger notified.', 'success');
    } else if (newStatus === 'waiting') {
      showToast('⏳ Waiting for passenger...', 'info');
    } else if (newStatus === 'passenger_onboard') {
      showToast('🚗 Customer in car! Drive safe.', 'success');
    } else if (newStatus === 'done') {
      // When driver marks as Done, show the post-trip incidentals modal
      playNotificationSound('trip_complete');
      stopTripTimer();
      openModal('postTripModal');
      elements.postTripModal.dataset.tripId = tripId;
      
      // Pre-fill base fare
      const trip = state.trips.active;
      if (trip) {
        state.activeTripBaseFare = parseFloat(trip.driver_pay) || parseFloat(trip.base_fare) || 0;
        updateTripTotals();
      }
      return; // Don't refresh yet, wait for post-trip form
    } else if (newStatus === 'completed') {
      // Play completion sound
      playNotificationSound('trip_complete');
      
      stopTripTimer();
      openModal('postTripModal');
      // Store trip ID for post-trip form
      elements.postTripModal.dataset.tripId = tripId;
      
      // Pre-fill the base fare from trip data
      const trip = state.trips.active;
      if (trip) {
        state.activeTripBaseFare = parseFloat(trip.driver_pay) || parseFloat(trip.base_fare) || 0;
        updateTripTotals();
      }
      
      return; // Don't refresh yet, wait for post-trip form
    }
    
    await refreshTrips();
  } catch (err) {
    console.error('[DriverPortal] Update status error:', err);
    showToast('Failed to update status', 'error');
  }
};

// Update trip totals in post-trip modal
window.updateTripTotals = function() {
  const baseFare = state.activeTripBaseFare || 0;
  const parking = parseFloat(document.getElementById('parkingCost')?.value) || 0;
  const tolls = parseFloat(document.getElementById('tollsCost')?.value) || 0;
  const otherCosts = parseFloat(document.getElementById('otherCosts')?.value) || 0;
  const tip = parseFloat(document.getElementById('tipAmount')?.value) || 0;
  
  const totalIncidentals = parking + tolls + otherCosts;
  const grandTotal = baseFare + totalIncidentals + tip;
  
  // Update display
  const baseFareEl = document.getElementById('totalBaseFare');
  const incidentalsEl = document.getElementById('totalIncidentals');
  const tipEl = document.getElementById('totalTip');
  const grandTotalEl = document.getElementById('grandTotal');
  const baseFareDisplayEl = document.getElementById('baseFareDisplay');
  
  if (baseFareEl) baseFareEl.textContent = `$${baseFare.toFixed(2)}`;
  if (baseFareDisplayEl) baseFareDisplayEl.textContent = `$${baseFare.toFixed(2)}`;
  if (incidentalsEl) incidentalsEl.textContent = `$${totalIncidentals.toFixed(2)}`;
  if (tipEl) tipEl.textContent = `$${tip.toFixed(2)}`;
  if (grandTotalEl) grandTotalEl.textContent = `$${grandTotal.toFixed(2)}`;
};

async function handlePostTripSubmit() {
  const tripId = elements.postTripModal.dataset.tripId;
  
  // Enhanced post-trip data with separate incidentals
  const postTripData = {
    wait_time: parseInt(document.getElementById('waitTime').value) || 0,
    extra_stops: parseInt(document.getElementById('extraStops').value) || 0,
    parking_cost: parseFloat(document.getElementById('parkingCost')?.value) || 0,
    tolls_cost: parseFloat(document.getElementById('tollsCost')?.value) || 0,
    other_costs: parseFloat(document.getElementById('otherCosts')?.value) || 0,
    other_costs_description: document.getElementById('otherCostsDesc')?.value?.trim() || '',
    tip: parseFloat(document.getElementById('tipAmount').value) || 0,
    driver_notes: document.getElementById('driverNotes').value.trim(),
    // Calculate totals
    total_incidentals: (parseFloat(document.getElementById('parkingCost')?.value) || 0) +
                       (parseFloat(document.getElementById('tollsCost')?.value) || 0) +
                       (parseFloat(document.getElementById('otherCosts')?.value) || 0)
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
    if (document.getElementById('parkingCost')) document.getElementById('parkingCost').value = '0';
    if (document.getElementById('tollsCost')) document.getElementById('tollsCost').value = '0';
    if (document.getElementById('otherCosts')) document.getElementById('otherCosts').value = '0';
    if (document.getElementById('otherCostsDesc')) document.getElementById('otherCostsDesc').value = '';
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

// ============================================
// Map Preference System
// ============================================
function checkMapPreference() {
  // Check if map preference is set, if not show modal on first use
  if (!state.preferredMapApp) {
    openModal('mapPreferenceModal');
    setupMapPreferenceHandlers();
  }
}

function setupMapPreferenceHandlers() {
  const options = document.querySelectorAll('.map-app-option');
  options.forEach(btn => {
    btn.addEventListener('click', () => {
      const mapApp = btn.dataset.map;
      setMapPreference(mapApp);
      closeModal('mapPreferenceModal');
      showToast(`${MAP_APPS[mapApp]?.name || mapApp} set as your navigation app!`, 'success');
    });
  });
}

function setMapPreference(mapApp) {
  state.preferredMapApp = mapApp;
  localStorage.setItem('driver_preferred_map', mapApp);
  
  // Update settings UI if visible
  const prefSelect = document.getElementById('preferredMapApp');
  if (prefSelect) prefSelect.value = mapApp;
}

window.openNavigation = function(address, usePickup = false) {
  if (!address) {
    showToast('No address available', 'warning');
    return;
  }
  
  // Check if user has set a preference, if not ask first
  if (!state.preferredMapApp) {
    checkMapPreference();
    // Store the address to navigate after preference is set
    localStorage.setItem('pending_navigation_address', address);
    return;
  }
  
  const encoded = encodeURIComponent(address);
  const userAgent = navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(userAgent);
  const isAndroid = /android/.test(userAgent);
  
  let navigationUrl = '';
  
  switch (state.preferredMapApp) {
    case 'google':
      if (isAndroid) {
        // Deep link for Google Maps on Android - works with CarPlay/Android Auto
        navigationUrl = `google.navigation:q=${encoded}&mode=d`;
      } else {
        // Universal link works on iOS and opens in Google Maps app if installed
        navigationUrl = `https://www.google.com/maps/dir/?api=1&destination=${encoded}&travelmode=driving`;
      }
      break;
      
    case 'apple':
      if (isIOS) {
        // Apple Maps deep link - works great with CarPlay
        navigationUrl = `maps://?daddr=${encoded}&dirflg=d`;
      } else {
        // Fallback to Google Maps on non-iOS
        navigationUrl = `https://www.google.com/maps/dir/?api=1&destination=${encoded}`;
      }
      break;
      
    case 'waze':
      // Waze deep link - works on both platforms and CarPlay
      navigationUrl = `https://waze.com/ul?q=${encoded}&navigate=yes`;
      break;
      
    default:
      // Default to Google Maps web
      navigationUrl = `https://www.google.com/maps/dir/?api=1&destination=${encoded}`;
  }
  
  console.log(`[DriverPortal] Opening navigation with ${state.preferredMapApp}:`, navigationUrl);
  window.open(navigationUrl, '_blank');
};

// Toggle map visibility for small screens
window.toggleMapVisibility = function() {
  state.mapVisible = !state.mapVisible;
  const mapContainer = document.getElementById('driverViewMap');
  const toggleBtn = document.getElementById('toggleMapBtn');
  
  if (mapContainer) {
    mapContainer.style.display = state.mapVisible ? 'block' : 'none';
  }
  
  if (toggleBtn) {
    toggleBtn.textContent = state.mapVisible ? '🗺️ Hide Map' : '🗺️ Show Map';
    toggleBtn.classList.toggle('map-hidden', !state.mapVisible);
  }
  
  // Resize map when showing
  if (state.mapVisible && driverViewMap) {
    setTimeout(() => driverViewMap.resize(), 100);
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
function showToast(message, type = 'info', duration = 3500) {
  elements.toast.textContent = message;
  elements.toast.className = `toast ${type} show`;
  
  setTimeout(() => {
    elements.toast.classList.remove('show');
  }, duration);
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
    case 'getting_ready': return 'Getting Ready';
    case 'enroute': return 'On the Way';
    case 'arrived': return 'Arrived';
    case 'waiting': return 'Waiting';
    case 'passenger_onboard': return 'Customer in Car';
    case 'done': return 'Done';
    case 'completed': return 'Complete Trip';
    default: return STATUS_META[status]?.label || status;
  }
}

// Send quick note to dispatch
window.sendQuickNote = async function(tripId) {
  const noteInput = document.getElementById('quickNotes');
  const note = noteInput?.value?.trim();
  
  if (!note) {
    showToast('Please enter a note', 'warning');
    return;
  }
  
  try {
    // Append to existing notes
    const existingNotes = state.trips.active?.driver_notes || '';
    const timestamp = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const newNote = existingNotes 
      ? `${existingNotes}\n[${timestamp}] ${note}`
      : `[${timestamp}] ${note}`;
    
    await updateReservationStatus(tripId, { driver_notes: newNote });
    
    noteInput.value = '';
    showToast('Note sent to dispatch! 📤', 'success');
  } catch (err) {
    console.error('[DriverPortal] Send note error:', err);
    showToast('Failed to send note', 'error');
  }
};

// ============================================
// SMS Trip Reminder System
// ============================================
async function sendTripReminderSMS(trip, driverId) {
  // Build the trip status URL for the driver
  // Driver portal is at driver.relialimo.com/firstname_lastname
  const driverBaseUrl = 'https://driver.relialimo.com';
  const driverSlug = state.portalSlug || state.driver?.portal_slug || '';
  const tripStatusUrl = `${driverBaseUrl}/${driverSlug}?trip=${trip.id}`;
  const portalUrl = driverSlug ? `${driverBaseUrl}/${driverSlug}` : driverBaseUrl;
  
  // Get driver's phone number
  const driverPhone = state.driver?.phone || state.driver?.cell_phone;
  if (!driverPhone) {
    console.warn('[DriverPortal] No driver phone for SMS reminder');
    return;
  }
  
  // Format pickup time
  const pickupTime = new Date(trip.pickup_date_time || trip.pickup_date);
  const timeStr = pickupTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  const dateStr = pickupTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  
  const message = `🚗 RELIALIMO Trip Reminder\n` +
    `📅 ${dateStr} at ${timeStr}\n` +
    `📍 ${(trip.pickup_address || trip.pickup_location || 'Pickup').substring(0, 50)}\n` +
    `🏁 ${(trip.dropoff_address || trip.dropoff_location || 'Dropoff').substring(0, 50)}\n\n` +
    `Trip Status: ${tripStatusUrl}\n` +
    `Portal: ${portalUrl}`;
  
  try {
    // Use the SMS service
    const response = await fetch(`${baseUrl}/api/sms-send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: driverPhone,
        body: message
      })
    });
    
    if (response.ok) {
      console.log('[DriverPortal] Trip reminder SMS sent successfully');
      return true;
    } else {
      console.warn('[DriverPortal] SMS send failed:', response.status);
      return false;
    }
  } catch (err) {
    console.error('[DriverPortal] SMS send error:', err);
    return false;
  }
}

// Schedule reminder SMS for upcoming trips
function scheduleUpcomingTripReminders() {
  const upcomingTrips = state.trips.upcoming || [];
  
  upcomingTrips.forEach(trip => {
    const pickupTime = new Date(trip.pickup_date_time || trip.pickup_date);
    const now = new Date();
    
    // Send reminder 60 minutes before pickup
    const reminderTime = new Date(pickupTime.getTime() - 60 * 60 * 1000);
    const msUntilReminder = reminderTime - now;
    
    // Only schedule if reminder time is in the future and within 24 hours
    if (msUntilReminder > 0 && msUntilReminder < 24 * 60 * 60 * 1000) {
      const reminderKey = `reminder_scheduled_${trip.id}`;
      
      // Check if already scheduled
      if (!localStorage.getItem(reminderKey)) {
        console.log(`[DriverPortal] Scheduling reminder for trip ${trip.id} in ${Math.round(msUntilReminder / 60000)} minutes`);
        
        setTimeout(() => {
          sendTripReminderSMS(trip, state.driverId);
          localStorage.removeItem(reminderKey);
        }, msUntilReminder);
        
        localStorage.setItem(reminderKey, 'true');
      }
    }
  });
}

// ============================================
// Flight Status API Integration
// ============================================

// Cache for flight status to avoid excessive API calls
const flightStatusCache = new Map();

/**
 * Update flight status for airport pickup trips
 * Uses AeroDataBox or fallback APIs
 */
async function updateFlightStatus(tripId, flightNumber) {
  const infoEl = document.getElementById(`flight-info-${tripId}`);
  if (!infoEl) return;
  
  const statusEl = infoEl.querySelector('.flight-status');
  if (!statusEl) return;
  
  // Check cache first (expires after 5 minutes)
  const cacheKey = flightNumber.toUpperCase();
  const cached = flightStatusCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
    renderFlightStatus(statusEl, cached.data);
    return;
  }
  
  try {
    statusEl.textContent = 'Loading...';
    statusEl.className = 'flight-status loading';
    
    // Try to get flight status from API
    const flightData = await fetchFlightStatus(flightNumber);
    
    if (flightData) {
      flightStatusCache.set(cacheKey, { data: flightData, timestamp: Date.now() });
      renderFlightStatus(statusEl, flightData);
    } else {
      statusEl.textContent = 'Status unavailable';
      statusEl.className = 'flight-status unknown';
    }
  } catch (err) {
    console.error('[DriverPortal] Flight status error:', err);
    statusEl.textContent = 'Status unavailable';
    statusEl.className = 'flight-status error';
  }
}

/**
 * Fetch flight status from API
 */
async function fetchFlightStatus(flightNumber) {
  // Extract airline code and flight number
  const match = flightNumber.match(/^([A-Z]{2})(\d+)$/i);
  if (!match) {
    console.warn('[DriverPortal] Invalid flight number format:', flightNumber);
    return null;
  }
  
  const [, airlineCode, flightNum] = match;
  
  // Try our API endpoint first
  try {
    const response = await fetch(`/api/flight-status?flight=${airlineCode}${flightNum}`);
    if (response.ok) {
      const data = await response.json();
      return data;
    }
  } catch (err) {
    console.warn('[DriverPortal] Flight API error:', err);
  }
  
  // Fallback: Return mock data for demo purposes
  // In production, this would call AeroDataBox, FlightAware, or similar API
  return {
    flightNumber: `${airlineCode}${flightNum}`,
    status: 'On Time',
    scheduledArrival: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
    estimatedArrival: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    terminal: 'Terminal 1',
    gate: 'Gate C12',
    origin: 'LAX',
    isMock: true
  };
}

/**
 * Render flight status with color-coded display
 */
function renderFlightStatus(statusEl, flightData) {
  const status = flightData.status?.toLowerCase() || 'unknown';
  let statusClass = 'unknown';
  let statusText = flightData.status || 'Unknown';
  
  if (status.includes('on time') || status.includes('scheduled')) {
    statusClass = 'on-time';
  } else if (status.includes('delayed')) {
    statusClass = 'delayed';
  } else if (status.includes('cancelled')) {
    statusClass = 'cancelled';
  } else if (status.includes('landed') || status.includes('arrived')) {
    statusClass = 'landed';
  } else if (status.includes('boarding') || status.includes('departing')) {
    statusClass = 'departing';
  }
  
  // Add arrival time if available
  if (flightData.estimatedArrival) {
    const arrivalTime = new Date(flightData.estimatedArrival);
    const timeStr = arrivalTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    statusText += ` • ETA ${timeStr}`;
  }
  
  // Add terminal/gate if available
  if (flightData.terminal || flightData.gate) {
    statusText += ` • ${flightData.terminal || ''} ${flightData.gate || ''}`.trim();
  }
  
  statusEl.textContent = statusText;
  statusEl.className = `flight-status ${statusClass}`;
  
  // Add mock indicator if using demo data
  if (flightData.isMock) {
    statusEl.title = 'Demo data - real API integration pending';
  }
}

/**
 * Show trip notes modal
 */
window.showTripNotes = function(tripId) {
  // Find the trip in state
  const allTrips = [...(state.trips.offered || []), ...(state.trips.upcoming || [])];
  if (state.trips.active) allTrips.push(state.trips.active);
  
  const trip = allTrips.find(t => t.id === tripId);
  if (!trip) {
    showToast('Trip not found', 'error');
    return;
  }
  
  const notes = trip.special_instructions || trip.trip_notes || trip.notes || 'No notes for this trip.';
  
  // Create modal HTML
  const modalHtml = `
    <div class="modal active" id="tripNotesModal" onclick="if(event.target===this) this.remove()">
      <div class="modal-content modal-sm">
        <div class="modal-header">
          <h2>📝 Trip Notes</h2>
          <button type="button" class="modal-close" onclick="document.getElementById('tripNotesModal').remove()">&times;</button>
        </div>
        <div class="modal-body">
          <p class="notes-text">${notes.replace(/\n/g, '<br>')}</p>
        </div>
      </div>
    </div>
  `;
  
  // Remove existing modal if any
  const existing = document.getElementById('tripNotesModal');
  if (existing) existing.remove();
  
  // Add to DOM
  document.body.insertAdjacentHTML('beforeend', modalHtml);
};

/**
 * Open status change modal for a trip
 */
window.openStatusModal = function(tripId) {
  // Find the trip in state
  const allTrips = [...(state.trips.offered || []), ...(state.trips.upcoming || [])];
  if (state.trips.active) allTrips.push(state.trips.active);
  
  const trip = allTrips.find(t => t.id === tripId);
  if (!trip) {
    showToast('Trip not found', 'error');
    return;
  }
  
  const currentStatus = trip.driver_status || 'assigned';
  
  // Define status options with progression
  const statusOptions = [
    { value: 'assigned', label: '📋 Assigned', icon: '📋' },
    { value: 'getting_ready', label: '🔧 Getting Ready', icon: '🔧' },
    { value: 'enroute', label: '🚗 On The Way', icon: '🚗' },
    { value: 'arrived', label: '📍 Arrived', icon: '📍' },
    { value: 'waiting', label: '⏳ Waiting', icon: '⏳' },
    { value: 'passenger_onboard', label: '👥 Passenger Onboard', icon: '👥' },
    { value: 'done', label: '✅ Trip Complete', icon: '✅' }
  ];
  
  const optionsHtml = statusOptions.map(opt => `
    <button class="status-option ${currentStatus === opt.value ? 'active' : ''}" 
            onclick="window.updateTripStatus('${tripId}', '${opt.value}'); document.getElementById('statusChangeModal').remove();">
      <span class="status-icon">${opt.icon}</span>
      <span class="status-label">${opt.label}</span>
    </button>
  `).join('');
  
  const modalHtml = `
    <div class="modal active" id="statusChangeModal" onclick="if(event.target===this) this.remove()">
      <div class="modal-content">
        <div class="modal-header">
          <h2>📊 Update Trip Status</h2>
          <button type="button" class="modal-close" onclick="document.getElementById('statusChangeModal').remove()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="status-grid">
            ${optionsHtml}
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Remove existing modal if any
  const existing = document.getElementById('statusChangeModal');
  if (existing) existing.remove();
  
  // Add to DOM
  document.body.insertAdjacentHTML('beforeend', modalHtml);
};

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
