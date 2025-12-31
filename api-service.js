// API Service for RELIA🐂LIMO™
import { getSupabaseConfig, initSupabase } from './config.js';

let supabaseClient = null;
let lastApiError = null;

// Explicit dev-local switch: disabled by default to keep Supabase primary
const DEV_LOCAL_FLAG_KEY = 'relia_use_local_dev_data';

export function isLocalDevModeEnabled() {
  const hostIsLocal = window?.location && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  const flagEnabled = localStorage.getItem(DEV_LOCAL_FLAG_KEY) === 'true';
  return Boolean(hostIsLocal && flagEnabled);
}

export function setLocalDevModeEnabled(enabled) {
  if (enabled) {
    localStorage.setItem(DEV_LOCAL_FLAG_KEY, 'true');
  } else {
    localStorage.removeItem(DEV_LOCAL_FLAG_KEY);
  }
  const state = enabled ? 'ON' : 'OFF';
  console.warn(`🔧 Local dev data mode is now ${state}. Supabase remains primary when OFF.`);
}

export function getLastApiError() {
  return lastApiError;
}

/**
 * Check if JWT token is expired and attempt to refresh it
 */
async function ensureValidToken(client) {
  try {
    const session = localStorage.getItem('supabase_session');
    if (!session) return true; // No session yet, allow to proceed
    
    const parsed = JSON.parse(session);
    if (!parsed.access_token || parsed.access_token.startsWith('offline-')) {
      // Offline token or demo account, skip refresh
      return true;
    }
    
    // Decode JWT to check expiration
    const parts = parsed.access_token.split('.');
    if (parts.length !== 3) return true; // Invalid JWT format, but allow to proceed
    
    try {
      const decoded = JSON.parse(atob(parts[1]));
      const expiresAt = decoded.exp * 1000; // Convert to milliseconds
      const now = Date.now();
      const timeUntilExpiry = expiresAt - now;
      
      // If already expired or expires in less than 5 minutes, refresh
      if (timeUntilExpiry < 5 * 60 * 1000) {
        const isExpired = timeUntilExpiry <= 0;
        console.warn(isExpired ? '⚠️ Token EXPIRED, attempting refresh...' : '⚠️ Token expiring soon, attempting refresh...');
        
        // Only try to refresh if we have a refresh token
        if (parsed.refresh_token && !parsed.refresh_token.startsWith('offline-')) {
          const refreshResult = await refreshAccessToken(client, parsed.refresh_token);
          if (refreshResult.success) {
            console.log('✅ Token refreshed successfully');
            return true;
          }
        }
        
        // If token is expired AND refresh failed, handle it
        if (isExpired) {
          console.error('❌ Token expired and refresh failed');
          
          // If in a popup or iframe, just return false - don't block UI
          const isPopup = window.opener !== null;
          const isIframe = window.self !== window.top;
          
          if (isPopup || isIframe) {
            console.warn('⚠️ Session expired in popup/iframe - operations will fail');
            return false;
          }
          
          // Main window - redirect to login (but only once)
          if (!window._reliaSessionExpiredRedirecting) {
            window._reliaSessionExpiredRedirecting = true;
            window.location.href = '/auth.html';
          }
          return false;
        }
        
        // If just expiring soon but refresh failed, allow to proceed
        console.warn('⚠️ Token refresh failed, but will attempt API call');
        return true;
      }
      
      return true;
    } catch (decodeError) {
      console.warn('⚠️ Could not decode JWT:', decodeError);
      return true; // Allow to proceed even if we can't decode
    }
  } catch (error) {
    console.error('❌ Token validation error:', error);
    return true; // Allow to proceed even if validation fails
  }
}

/**
 * Refresh access token using refresh token
 */
async function refreshAccessToken(client, refreshToken) {
  try {
    if (!refreshToken) {
      console.warn('⚠️ No refresh token available');
      return { success: false, error: 'No refresh token' };
    }
    
    // Use the correct Supabase URL from config
    const config = getSupabaseConfig();
    const url = `${config.url}/auth/v1/token?grant_type=refresh_token`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.anonKey
      },
      body: JSON.stringify({
        refresh_token: refreshToken
      })
    });
    
    if (!response.ok) {
      const errorBody = await response.text();
      console.error('⚠️ Token refresh error response:', response.status, errorBody);
      throw new Error(`Token refresh failed: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.access_token) {
      throw new Error('No access token in refresh response');
    }
    
    // Save new tokens
    const session = {
      access_token: data.access_token,
      refresh_token: data.refresh_token || refreshToken,
      user: JSON.parse(localStorage.getItem('supabase_session') || '{}').user
    };
    
    localStorage.setItem('supabase_session', JSON.stringify(session));
    localStorage.setItem('supabase_access_token', data.access_token);
    
    return { success: true, session };
  } catch (error) {
    console.error('❌ Token refresh failed:', error);
    return { success: false, error };
  }
}

// SDK storage key pattern
const SDK_SESSION_KEY = 'sb-siumiadylwcrkaqsfwkj-auth-token';

export async function getOrgContextOrThrow(client) {
  console.log('🔐 getOrgContextOrThrow starting...');
  console.log('🔐 Client available:', !!client);
  const useLocalDev = isLocalDevModeEnabled();
  
  // Development bypass for permission issues
  try {
    // First, try to refresh session if needed (especially important for popups)
    try {
      // Check our custom key first, then fall back to SDK key
      let session = localStorage.getItem('supabase_session');
      if (!session) {
        session = localStorage.getItem(SDK_SESSION_KEY);
        if (session) {
          console.log('ℹ️ Found session in SDK storage key');
          // Migrate to our key
          const parsed = JSON.parse(session);
          const actualSession = parsed.currentSession || parsed;
          if (actualSession?.access_token) {
            localStorage.setItem('supabase_session', JSON.stringify(actualSession));
            session = JSON.stringify(actualSession);
          }
        }
      }
      console.log('📋 Session exists:', !!session);
      if (session) {
        const parsed = JSON.parse(session);
        // Check if token is expired or expiring soon
        if (parsed.access_token && !parsed.access_token.startsWith('offline-')) {
          const parts = parsed.access_token.split('.');
          if (parts.length === 3) {
            try {
              const decoded = JSON.parse(atob(parts[1]));
              const expiresAt = decoded.exp * 1000;
              const now = Date.now();
              const minutesUntilExpiry = Math.round((expiresAt - now) / 60000);
              console.log('⏱️ Token expires in:', minutesUntilExpiry, 'minutes');
              // If token expires in less than 2 minutes or is already expired
              if (expiresAt - now < 2 * 60 * 1000) {
                console.log('🔄 Token expiring/expired, attempting refresh before auth check...');
                const refreshResult = await refreshAccessToken(client, parsed.refresh_token);
                if (refreshResult.success) {
                  console.log('✅ Token refreshed successfully');
                } else {
                  console.warn('⚠️ Token refresh failed:', refreshResult.error);
                }
              }
            } catch (e) {
              console.warn('⚠️ Could not decode token:', e);
            }
          }
        }
      }
    } catch (e) {
      console.warn('⚠️ Pre-auth token refresh check failed:', e);
    }
    
    console.log('👤 Getting user...');
    let user = null;
    let userError = null;
    
    try {
      const result = await client.auth.getUser();
      user = result.data?.user;
      userError = result.error;
    } catch (authError) {
      console.warn('⚠️ auth.getUser threw exception:', authError);
      userError = authError;
    }
    
    console.log('👤 User result:', user?.id || 'null', 'error:', userError?.message || 'none');
    
    if (userError) {
      const errorMsg = userError.message || String(userError);
      // Check if it's a permission error related to users table
      if (useLocalDev && (errorMsg.includes('permission denied') || errorMsg.includes('table users') || errorMsg.includes('42501'))) {
        console.warn('⚠️ Users table permission denied - using development fallback (local dev mode enabled)');
        const devUser = { 
          id: 'dev-user-' + Date.now(), 
          email: 'dev@localhost.local',
          created_at: new Date().toISOString()
        };
        const devOrgId = 'dev-org-00000000-0000-0000-0000-000000000001';
        console.log('🔧 Using development user context:', devUser.id);
        return { user: devUser, organizationId: devOrgId, userId: devUser.id };
      }
      throw userError;
    }
    
    if (!user) {
      if (useLocalDev) {
        console.warn('⚠️ No user found - using development fallback (local dev mode enabled)');
        const devUser = { 
          id: 'dev-user-' + Date.now(), 
          email: 'dev@localhost.local',
          created_at: new Date().toISOString()
        };
        const devOrgId = 'dev-org-00000000-0000-0000-0000-000000000001';
        return { user: devUser, organizationId: devOrgId, userId: devUser.id };
      }
      throw new Error('No authenticated user found');
    }

    console.log('🏢 Getting organization membership...');
    const { data: membership, error: membershipError } = await client
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();
    
    console.log('🏢 Membership result:', membership?.organization_id || 'null', 'error:', membershipError?.message || 'none');
    
    // Development bypass: if no organization membership found, use a default org ID
    if (membershipError || !membership?.organization_id) {
      if (useLocalDev) {
        console.warn('⚠️ No organization membership found - using development fallback (local dev mode enabled)');
        const fallbackOrgId = 'dev-org-00000000-0000-0000-0000-000000000001';
        return { user, organizationId: fallbackOrgId, userId: user.id };
      }
      throw membershipError || new Error('No organization membership found for user');
    }

    return { user, organizationId: membership.organization_id, userId: user.id };
    
  } catch (error) {
    // Catch any other authentication errors and provide development fallback
    console.error('❌ Authentication failed:', error);
    
    if (useLocalDev && error.message && (
        error.message.includes('permission denied') || 
        error.message.includes('RLS') ||
        error.message.includes('not authenticated')
    )) {
      console.warn('⚠️ Database permission error - using development fallback (local dev mode enabled)');
      const devUser = { 
        id: 'dev-user-' + Date.now(), 
        email: 'dev@localhost.local',
        created_at: new Date().toISOString()
      };
      const devOrgId = 'dev-org-00000000-0000-0000-0000-000000000001';
      return { user: devUser, organizationId: devOrgId, userId: devUser.id };
    }
    
    // For other errors, still throw to avoid silent local fallback
    throw error;
  }
}

/**
 * Initialize the Supabase client
 */
export async function setupAPI() {
  try {
    supabaseClient = await initSupabase();
    
    // Ensure token is valid on startup (non-blocking)
    const isValid = await ensureValidToken(supabaseClient);
    if (!isValid) {
      console.warn('⚠️ Token validation indicated potential issues, but proceeding');
    }
    
    console.log('✅ Supabase API initialized successfully');
    return supabaseClient;
  } catch (error) {
    console.error('❌ Failed to initialize Supabase:', error);
    throw error;
  }
}

/**
 * Get the Supabase client instance
 */
export function getSupabaseClient() {
  if (!supabaseClient) {
    console.warn('⚠️ Supabase client not initialized. Call setupAPI() first.');
  }
  return supabaseClient;
}

/**
 * Example: Fetch all drivers
 */
export async function fetchDrivers() {
  const client = getSupabaseClient();
  if (!client) return null;
  
  try {
    lastApiError = null;
    const { organizationId } = await getOrgContextOrThrow(client);

    const { data, error } = await client
      .from('drivers')
      .select('*')
      .eq('organization_id', organizationId);
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching drivers:', error);
    lastApiError = error;
    return null;
  }
}

/**
 * Example: Create new driver
 */
export async function createDriver(driverData) {
  const client = getSupabaseClient();
  if (!client) return null;
  
  try {
    const { organizationId } = await getOrgContextOrThrow(client);
    const timestamp = new Date().toISOString();
    const payload = {
      ...driverData,
      organization_id: driverData.organization_id || organizationId,
      created_at: driverData.created_at || timestamp,
      updated_at: driverData.updated_at || timestamp,
    };

    const { data, error } = await client
      .from('drivers')
      .insert([payload])
      .select()
      .maybeSingle();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating driver:', error);
    return null;
  }
}

/**
 * Example: Update driver
 */
export async function updateDriver(driverId, driverData) {
  const client = getSupabaseClient();
  if (!client) return null;
  
  try {
    const payload = {
      ...driverData,
      updated_at: driverData.updated_at || new Date().toISOString(),
    };

    const { data, error } = await client
      .from('drivers')
      .update(payload)
      .eq('id', driverId)
      .select()
      .maybeSingle();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating driver:', error);
    return null;
  }
}

/**
 * Example: Delete driver
 */
export async function deleteDriver(driverId) {
  const client = getSupabaseClient();
  if (!client) return null;
  
  try {
    const { data, error } = await client
      .from('drivers')
      .delete()
      .eq('id', driverId);
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error deleting driver:', error);
    return null;
  }
}

function normalizeSpaces(value) {
  return value.replace(/\s+/g, ' ').trim();
}

// ============================================================================
// AFFILIATE CRUD OPERATIONS (for 'affiliates' table from import)
// ============================================================================

/**
 * Fetch all affiliates from the affiliates table
 */
export async function fetchAffiliates() {
  const client = getSupabaseClient();
  console.log('🔍 fetchAffiliates - client:', client ? 'initialized' : 'NULL');
  if (!client) return null;

  try {
    lastApiError = null;
    
    // Ensure token is valid before making request
    const isValid = await ensureValidToken(client);
    if (!isValid) {
      console.warn('⚠️ Token validation failed');
      if (confirm('Your session has expired. Would you like to log in again?')) {
        window.location.href = 'auth.html';
      }
      return null;
    }
    
    const { data, error } = await client
      .from('affiliates')
      .select('*')
      .order('company_name', { ascending: true });

    console.log('🔍 fetchAffiliates - data:', data?.length, 'error:', error);
    
    // Handle JWT expiration
    if (error && error.status === 401 && error.message?.includes('JWT')) {
      console.warn('⚠️ JWT expired - clearing session');
      localStorage.removeItem('supabase_session');
      localStorage.removeItem('supabase_access_token');
      // Optionally redirect to login
      if (confirm('Your session has expired. Would you like to log in again?')) {
        window.location.href = 'auth.html';
      }
      return null;
    }
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching affiliates:', error);
    lastApiError = error;
    return null;
  }
}

/**
 * Create a new affiliate
 */
export async function createAffiliate(affiliateData) {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    lastApiError = null;
    const { data, error } = await client
      .from('affiliates')
      .insert([affiliateData])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating affiliate:', error);
    lastApiError = error;
    return null;
  }
}

/**
 * Update an existing affiliate
 */
export async function updateAffiliate(affiliateId, affiliateData) {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    lastApiError = null;
    const { data, error } = await client
      .from('affiliates')
      .update(affiliateData)
      .eq('id', affiliateId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating affiliate:', error);
    lastApiError = error;
    return null;
  }
}

/**
 * Delete an affiliate
 */
export async function deleteAffiliate(affiliateId) {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    lastApiError = null;
    const { data, error } = await client
      .from('affiliates')
      .delete()
      .eq('id', affiliateId);

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error deleting affiliate:', error);
    lastApiError = error;
    return null;
  }
}

// ============================================================================
// VEHICLE TYPE CRUD OPERATIONS
// ============================================================================

function sanitizeVehiclePayload(payload) {
  const cleaned = { ...payload };
  Object.keys(cleaned).forEach((key) => {
    if (cleaned[key] === undefined) {
      delete cleaned[key];
    }
  });
  return cleaned;
}

export async function fetchVehicleTypes() {
  const client = getSupabaseClient();
  if (!client) return [];

  try {
    lastApiError = null;
    const { organizationId } = await getOrgContextOrThrow(client);

    const { data, error } = await client
      .from('vehicle_types')
      .select('*')
      .eq('organization_id', organizationId)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching vehicle types:', error);
    lastApiError = error;
    return [];
  }
}

export async function upsertVehicleType(vehicleType) {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase client not initialized');

  try {
    lastApiError = null;
    const { organizationId, user } = await getOrgContextOrThrow(client);
    const now = new Date().toISOString();
    const isValidId = typeof vehicleType.id === 'string'
      && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(vehicleType.id);

    const payload = sanitizeVehiclePayload({
      id: isValidId ? vehicleType.id : undefined,
      organization_id: organizationId,
      name: vehicleType.name?.trim() || null,
      code: vehicleType.code?.trim() || null,
      status: (vehicleType.status || 'ACTIVE').toUpperCase(),
      pricing_basis: (vehicleType.pricing_basis || 'HOURS').toUpperCase(),
      passenger_capacity: vehicleType.passenger_capacity !== undefined && vehicleType.passenger_capacity !== null && vehicleType.passenger_capacity !== ''
        ? Number(vehicleType.passenger_capacity)
        : null,
      luggage_capacity: vehicleType.luggage_capacity !== undefined && vehicleType.luggage_capacity !== null && vehicleType.luggage_capacity !== ''
        ? Number(vehicleType.luggage_capacity)
        : null,
      color_hex: vehicleType.color_hex?.trim() || null,
      service_type_tags: Array.isArray(vehicleType.service_type_tags)
        ? vehicleType.service_type_tags
        : (vehicleType.service_type ? [vehicleType.service_type] : []),
      accessible: vehicleType.accessible === true,
      hide_from_online: vehicleType.hide_from_online === true,
      description: vehicleType.description?.trim() || null,
      sort_order: Number.isFinite(vehicleType.sort_order) ? vehicleType.sort_order : 0,
      metadata: vehicleType.metadata ?? {},
      updated_at: now,
      updated_by: user.id,
      created_at: isValidId ? undefined : now,
      created_by: isValidId ? undefined : user.id,
    });

    const { data, error } = await client
      .from('vehicle_types')
      .upsert([payload], { onConflict: 'id' })
      .select()
      .maybeSingle();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error upserting vehicle type:', error);
    lastApiError = error;
    throw error;
  }
}

/**
 * Remove duplicate affiliates from the database
 * Keeps the first occurrence (by id) and deletes duplicates based on company_name
 */
export async function removeDuplicateAffiliates() {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Client not initialized', removed: 0 };

  try {
    // Fetch all affiliates ordered by id
    const { data: affiliates, error: fetchError } = await client
      .from('affiliates')
      .select('id, company_name, first_name, last_name')
      .order('id', { ascending: true });

    if (fetchError) throw fetchError;
    if (!affiliates || affiliates.length === 0) {
      return { success: true, removed: 0, message: 'No affiliates found' };
    }

    // Track seen company names (normalized)
    const seen = new Map();
    const duplicateIds = [];

    affiliates.forEach(aff => {
      // Create a key from company_name or first+last name
      const key = (aff.company_name || `${aff.first_name || ''} ${aff.last_name || ''}`).trim().toLowerCase();
      
      if (key && seen.has(key)) {
        // This is a duplicate
        duplicateIds.push(aff.id);
      } else if (key) {
        // First occurrence
        seen.set(key, aff.id);
      }
    });

    if (duplicateIds.length === 0) {
      return { success: true, removed: 0, message: 'No duplicates found' };
    }

    // Delete duplicates
    const { error: deleteError } = await client
      .from('affiliates')
      .delete()
      .in('id', duplicateIds);

    if (deleteError) throw deleteError;

    console.log(`✅ Removed ${duplicateIds.length} duplicate affiliates`);
    return { success: true, removed: duplicateIds.length, message: `Removed ${duplicateIds.length} duplicates` };
  } catch (error) {
    console.error('Error removing duplicate affiliates:', error);
    return { success: false, error: error.message, removed: 0 };
  }
}

function buildDriverDuplicateKey(driver) {
  if (!driver) {
    return null;
  }
  const org = driver.organization_id || 'no_org';
  const email = (driver.email || '').trim().toLowerCase();
  if (email) {
    return `${org}|email|${email}`;
  }
  const phone = (driver.phone || '').replace(/[^0-9]/g, '');
  if (phone.length >= 7) {
    return `${org}|phone|${phone}`;
  }
  const first = (driver.first_name || '').trim().toLowerCase();
  const last = (driver.last_name || '').trim().toLowerCase();
  if (first || last) {
    return `${org}|name|${first} ${last}`.trim();
  }
  return null;
}

/**
 * Remove duplicate drivers from the database
 * Duplicates are detected per organization by email, then phone, then full name.
 */
export async function removeDuplicateDrivers() {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Client not initialized', removed: 0 };

  try {
    const { data: drivers, error: fetchError } = await client
      .from('drivers')
      .select('id, organization_id, email, phone, first_name, last_name, created_at')
      .order('created_at', { ascending: true });

    if (fetchError) throw fetchError;
    if (!drivers || drivers.length === 0) {
      return { success: true, removed: 0, message: 'No drivers found' };
    }

    const seen = new Map();
    const duplicateIds = [];

    drivers.forEach(driver => {
      const key = buildDriverDuplicateKey(driver);
      if (!key) {
        return;
      }
      if (seen.has(key)) {
        duplicateIds.push(driver.id);
      } else {
        seen.set(key, driver.id);
      }
    });

    if (duplicateIds.length === 0) {
      return { success: true, removed: 0, message: 'No duplicates found' };
    }

    const { error: deleteError } = await client
      .from('drivers')
      .delete()
      .in('id', duplicateIds);

    if (deleteError) throw deleteError;

    console.log(`✅ Removed ${duplicateIds.length} duplicate drivers`);
    return { success: true, removed: duplicateIds.length, message: `Removed ${duplicateIds.length} duplicates` };
  } catch (error) {
    console.error('Error removing duplicate drivers:', error);
    return { success: false, error: error.message, removed: 0 };
  }
}

export function normalizeAffiliateName(rawName) {
  if (typeof rawName !== 'string') {
    return '';
  }
  const normalized = normalizeSpaces(rawName);
  return normalized;
}

export async function fetchAllAffiliates() {
  const client = getSupabaseClient();
  if (!client) return [];

  try {
    lastApiError = null;
    const { data, error } = await client
      .from('affiliate_organizations')
      .select('id, name')
      .order('name', { ascending: true });

    if (error) throw error;
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Error fetching affiliates:', error);
    lastApiError = error;
    return [];
  }
}

export async function fetchOrganizationAffiliates() {
  const client = getSupabaseClient();
  if (!client) return [];

  try {
    lastApiError = null;
    const { organizationId } = await getOrgContextOrThrow(client);

    const { data, error } = await client
      .from('organization_affiliates')
      .select('affiliate_id, affiliate:affiliate_organizations(id, name)')
      .eq('organization_id', organizationId)
      .order('affiliate(name)', { ascending: true });

    if (error) throw error;

    const rows = Array.isArray(data) ? data : [];
    return rows
      .map(row => {
        const affiliate = row?.affiliate;
        const id = affiliate?.id || row?.affiliate_id;
        const name = affiliate?.name || '';
        if (!id || !name) {
          return null;
        }
        return { id, name };
      })
      .filter(Boolean);
  } catch (error) {
    console.error('Error fetching organization affiliates:', error);
    lastApiError = error;
    return [];
  }
}

export async function ensureAffiliateForOrganization(rawName) {
  const client = getSupabaseClient();
  if (!client) return null;

  const name = normalizeAffiliateName(rawName);
  if (!name) {
    throw new Error('Affiliate name is required');
  }

  try {
    lastApiError = null;
    const literal = name.replace(/[%_]/g, match => `\\${match}`);

    const { data: existingRows, error: existingError } = await client
      .from('affiliate_organizations')
      .select('id, name')
      .ilike('name', literal)
      .limit(1);

    if (existingError) throw existingError;

    let affiliate = Array.isArray(existingRows) && existingRows.length > 0 ? existingRows[0] : null;

    if (!affiliate) {
      const { data: inserted, error: insertError } = await client
        .from('affiliate_organizations')
        .insert([{ name }])
        .select('id, name')
        .single();

      if (insertError) {
        if (insertError.code === '23505' || /duplicate/i.test(insertError.message || '')) {
          const { data: retryRows, error: retryError } = await client
            .from('affiliate_organizations')
            .select('id, name')
            .ilike('name', literal)
            .limit(1);

          if (retryError) throw retryError;
          affiliate = Array.isArray(retryRows) && retryRows.length > 0 ? retryRows[0] : null;
        } else {
          throw insertError;
        }
      } else {
        affiliate = inserted;
      }
    }

    if (!affiliate) {
      throw new Error('Unable to resolve affiliate');
    }

    const { organizationId } = await getOrgContextOrThrow(client);

    const { error: linkError } = await client
      .from('organization_affiliates')
      .upsert({
        organization_id: organizationId,
        affiliate_id: affiliate.id
      }, { onConflict: 'organization_id,affiliate_id' });

    if (linkError && linkError.code !== '23505') {
      throw linkError;
    }

    return {
      affiliateId: affiliate.id,
      affiliateName: affiliate.name
    };
  } catch (error) {
    console.error('Error ensuring affiliate:', error);
    lastApiError = error;
    throw error;
  }
}

/**
 * Create new reservation
 */
export async function createReservation(reservationData) {
  const client = getSupabaseClient();
  if (!client) return null;
  
  const useLocalDev = isLocalDevModeEnabled();
  // Development mode: Skip Supabase entirely and use localStorage
  if (useLocalDev) {
    console.log('🔧 Local dev data mode: Saving reservation to localStorage only');
    console.log('📋 Received reservation data:', JSON.stringify(reservationData, null, 2));
    
    // Generate confirmation number sequentially for local dev
    let confirmationNumber = reservationData.confirmationNumber || reservationData.confirmation_number;
    if (!confirmationNumber) {
      try {
        const { getNextConfirmationNumber } = await import('./supabase-db.js');
        confirmationNumber = await getNextConfirmationNumber();
      } catch (numberError) {
        console.warn('⚠️ Could not generate next confirmation number locally, using timestamp fallback');
        confirmationNumber = `DEV${Date.now()}`;
      }
    }
    
    // Parse pickup/dropoff from routing stops - handle both address1 and address formats
    const stops = reservationData.routing?.stops || [];
    const pickup = stops[0] || {};
    const dropoff = stops.length > 1 ? stops[stops.length - 1] : stops[1] || {};
    
    // Extract passenger info from nested structure
    const passenger = reservationData.passenger || {};
    const passengerName = `${passenger.firstName || ''} ${passenger.lastName || ''}`.trim();
    
    // Extract billing info from nested structure
    const billing = reservationData.billingAccount || {};
    
    // Extract details from nested structure
    const details = reservationData.details || {};
    
    const reservationWithId = {
      id: `local-${Date.now()}`,
      organization_id: 'dev-org-00000000-0000-0000-0000-000000000001',
      confirmation_number: confirmationNumber,
      booked_by_user_id: 'dev-user',
      account_id: reservationData.accountId || reservationData.account_id || null,
      status: details.status || reservationData.status || 'pending',
      trip_type: details.tripType || reservationData.tripType || reservationData.trip_type || null,
      // Pickup - handle both address1 and address field names
      pickup_address: pickup.address1 || pickup.address || pickup.fullAddress || reservationData.pickup_location || '',
      pickup_location_name: pickup.locationName || pickup.location || '',
      pickup_city: pickup.city || '',
      pickup_state: pickup.state || '',
      pickup_zip: pickup.zipCode || pickup.zip || '',
      pickup_lat: pickup.lat || null,
      pickup_lon: pickup.lng || pickup.lon || null,
      pickup_datetime: reservationData.pickupDateTime || reservationData.pickup_datetime || (details.puDate && details.puTime ? `${details.puDate}T${details.puTime}` : details.puDate) || null,
      // Dropoff - handle both address1 and address field names  
      dropoff_address: dropoff.address1 || dropoff.address || dropoff.fullAddress || reservationData.dropoff_location || '',
      dropoff_location_name: dropoff.locationName || dropoff.location || '',
      dropoff_city: dropoff.city || '',
      dropoff_state: dropoff.state || '',
      dropoff_zip: dropoff.zipCode || dropoff.zip || '',
      dropoff_lat: dropoff.lat || null,
      dropoff_lon: dropoff.lng || dropoff.lon || null,
      dropoff_datetime: reservationData.dropoffDateTime || reservationData.dropoff_datetime || null,
      // Passenger info
      passenger_name: passengerName,
      passenger_first_name: passenger.firstName || '',
      passenger_last_name: passenger.lastName || '',
      passenger_phone: passenger.phone || '',
      passenger_email: passenger.email || '',
      passenger_count: reservationData.passengerCount || reservationData.passenger_count || 1,
      // Billing info
      billing_company: billing.company || '',
      billing_first_name: billing.firstName || '',
      billing_last_name: billing.lastName || '',
      billing_phone: billing.cellPhone || '',
      billing_email: billing.email || '',
      // Notes
      special_instructions: reservationData.routing?.tripNotes || reservationData.special_instructions || '',
      notes: reservationData.routing?.dispatchNotes || reservationData.notes || '',
      dispatch_notes: reservationData.routing?.dispatchNotes || '',
      partner_notes: reservationData.routing?.partnerNotes || '',
      // Rates
      rate_type: reservationData.rateType || reservationData.rate_type || null,
      rate_amount: reservationData.grandTotal || reservationData.rate_amount || 0,
      grand_total: reservationData.grandTotal || 0,
      currency: reservationData.currency || 'USD',
      timezone: reservationData.timezone || null,
      // Timestamps
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      // Store full routing data for reference
      routing_stops: stops
    };
    
    console.log('📤 Processed reservation to save:', reservationWithId);
    
    // Save to localStorage
    const existingReservations = JSON.parse(localStorage.getItem('local_reservations') || '[]');
    existingReservations.push(reservationWithId);
    localStorage.setItem('local_reservations', JSON.stringify(existingReservations));
    
    console.log('✅ Reservation saved locally for development:', reservationWithId);
    return [reservationWithId];
  }
  
  try {
    const { organizationId, userId } = await getOrgContextOrThrow(client);
    console.log('🆔 Using organization ID:', organizationId, 'User ID:', userId);
    
    // Generate confirmation number with duplicate checking
    let confirmationNumber = reservationData.confirmationNumber || 
                            reservationData.confirmation_number;
    
    if (!confirmationNumber) {
      // Import the duplicate-safe function dynamically to avoid circular imports
      try {
        const { generateUniqueConfirmationNumber } = await import('./supabase-db.js');
        confirmationNumber = await generateUniqueConfirmationNumber();
        console.log('✅ Generated unique confirmation number:', confirmationNumber);
      } catch (importError) {
        console.warn('⚠️ Could not import generateUniqueConfirmationNumber, using fallback');
        confirmationNumber = `${Date.now()}`;
      }
    } else {
      // If confirmation number was provided, check for duplicates
      try {
        const { checkConfirmationNumberExists } = await import('./supabase-db.js');
        const exists = await checkConfirmationNumberExists(confirmationNumber);
        if (exists) {
          const error = new Error(`Confirmation number ${confirmationNumber} already exists. Please use a different number.`);
          error.code = 'DUPLICATE_CONFIRMATION_NUMBER';
          throw error;
        }
      } catch (importError) {
        console.warn('⚠️ Could not check for duplicate confirmation number:', importError.message);
      }
    }
    
    console.log('🔢 Final confirmation number to use:', confirmationNumber);
    
    // Parse pickup/dropoff from routing stops
    const stops = reservationData.routing?.stops || [];
    const pickup = stops[0] || {};
    const dropoff = stops[1] || stops[stops.length - 1] || {};
    
    // First attempt: Try normal insert with organization
    let insertData = {
      organization_id: organizationId.startsWith('dev-org-') ? null : organizationId,
      confirmation_number: confirmationNumber,
      booked_by_user_id: userId,
      account_id: reservationData.accountId || reservationData.account_id || null,
      status: reservationData.status || 'pending',
      trip_type: reservationData.tripType || reservationData.trip_type || null,
      pickup_address: pickup.address || reservationData.pickup_location || '',
      pickup_city: pickup.city || '',
      pickup_state: pickup.state || '',
      pickup_zip: pickup.zip || '',
      pickup_lat: pickup.lat || null,
      pickup_lon: pickup.lng || pickup.lon || null,
      pickup_datetime: reservationData.pickupDateTime || reservationData.pickup_datetime || null,
      dropoff_address: dropoff.address || reservationData.dropoff_location || '',
      dropoff_city: dropoff.city || '',
      dropoff_state: dropoff.state || '',
      dropoff_zip: dropoff.zip || '',
      dropoff_lat: dropoff.lat || null,
      dropoff_lon: dropoff.lng || dropoff.lon || null,
      dropoff_datetime: reservationData.dropoffDateTime || reservationData.dropoff_datetime || null,
      passenger_count: reservationData.passengerCount || reservationData.passenger_count || 1,
      special_instructions: reservationData.routing?.tripNotes || reservationData.special_instructions || '',
      notes: reservationData.routing?.dispatchNotes || reservationData.notes || '',
      rate_type: reservationData.rateType || reservationData.rate_type || null,
      rate_amount: reservationData.grandTotal || reservationData.rate_amount || 0,
      currency: reservationData.currency || 'USD',
      timezone: reservationData.timezone || null
    };
    
    const { data, error } = await client
      .from('reservations')
      .insert([insertData])
      .select();
      
    // Check if RLS policy is blocking the insert
    if (error && error.code === '42501' && useLocalDev) {
      console.warn('⚠️ RLS policy blocking insert, using local storage fallback (local dev data mode enabled)...');
      
      const reservationWithId = {
        ...insertData,
        id: `local-${Date.now()}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      const existingReservations = JSON.parse(localStorage.getItem('local_reservations') || '[]');
      existingReservations.push(reservationWithId);
      localStorage.setItem('local_reservations', JSON.stringify(existingReservations));
      
      console.log('✅ Reservation saved locally for development:', reservationWithId);
      return [reservationWithId];
    }

    if (error) throw error;
    console.log('✅ Reservation created in Supabase:', data);
    return data;
  } catch (error) {
    console.error('❌ Error creating reservation in Supabase:', error);
    console.error('❌ Error details:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint
    });
    
    // Store the error for retrieval
    lastApiError = error;
    
    // Always return structured response with error details
    return [{
      success: false,
      error: error.message || 'Failed to create reservation',
      errorCode: error.code,
      errorDetails: error.details,
      timestamp: new Date().toISOString()
    }];
  }
}

/**
 * Update reservation
 */
export async function updateReservation(reservationId, reservationData) {
  const client = getSupabaseClient();
  if (!client) return null;
  
  try {
    const { organizationId, userId } = await getOrgContextOrThrow(client);
    
    // Parse pickup/dropoff from routing stops
    const stops = reservationData.routing?.stops || [];
    const pickup = stops[0] || {};
    const dropoff = stops[1] || stops[stops.length - 1] || {};
    
    const { data, error } = await client
      .from('reservations')
      .update({
        status: reservationData.status || undefined,
        trip_type: reservationData.tripType || reservationData.trip_type || undefined,
        pickup_address: pickup.address || reservationData.pickup_location || undefined,
        pickup_city: pickup.city || undefined,
        pickup_state: pickup.state || undefined,
        pickup_zip: pickup.zip || undefined,
        pickup_lat: pickup.lat || undefined,
        pickup_lon: pickup.lng || pickup.lon || undefined,
        pickup_datetime: reservationData.pickupDateTime || reservationData.pickup_datetime || undefined,
        dropoff_address: dropoff.address || reservationData.dropoff_location || undefined,
        dropoff_city: dropoff.city || undefined,
        dropoff_state: dropoff.state || undefined,
        dropoff_zip: dropoff.zip || undefined,
        dropoff_lat: dropoff.lat || undefined,
        dropoff_lon: dropoff.lng || dropoff.lon || undefined,
        dropoff_datetime: reservationData.dropoffDateTime || reservationData.dropoff_datetime || undefined,
        passenger_count: reservationData.passengerCount || reservationData.passenger_count || undefined,
        special_instructions: reservationData.routing?.tripNotes || reservationData.special_instructions || undefined,
        notes: reservationData.routing?.dispatchNotes || reservationData.notes || undefined,
        rate_amount: reservationData.grandTotal || reservationData.rate_amount || undefined,
        updated_by: userId
      })
      .eq('id', reservationId)
      .eq('organization_id', organizationId)
      .select();
    
    if (error) throw error;
    console.log('✅ Reservation updated in Supabase:', data);
    return data;
  } catch (error) {
    console.error('Error updating reservation in Supabase:', error);
    return null;
  }
}

/**
 * Fetch all reservations
 */
export async function fetchReservations() {
  const client = getSupabaseClient();
  if (!client) return null;
  
  const useLocalDev = isLocalDevModeEnabled();
  if (useLocalDev) {
    const localReservations = JSON.parse(localStorage.getItem('local_reservations') || '[]');
    console.log(`📊 Local dev mode: Loaded ${localReservations.length} local reservations`);
    return localReservations;
  }
  
  try {
    const { organizationId } = await getOrgContextOrThrow(client);
    const { data, error } = await client
      .from('reservations')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    console.log(`📊 Loaded ${(data || []).length} reservations from Supabase`);
    return data;
  } catch (error) {
    console.error('Error fetching reservations:', error);
    return null;
  }
}

/**
 * Get reservation by ID
 */
export async function getReservation(reservationId) {
  const client = getSupabaseClient();
  if (!client) return null;
  
  try {
    const { organizationId } = await getOrgContextOrThrow(client);
    const { data, error } = await client
      .from('reservations')
      .select('*')
      .eq('id', reservationId)
      .eq('organization_id', organizationId)
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching reservation:', error);
    return null;
  }
}

/**
 * Search airports by name or code
 */
export async function searchAirports(query) {
  try {
    // Using OpenFlights Airport database via public API
    const response = await fetch(`https://api.flightapi.io/airports?search=${encodeURIComponent(query)}`, {
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      // Fallback to static airport list if API fails
      return getStaticAirports(query);
    }
    
    const data = await response.json();
    return data.airports || [];
  } catch (error) {
    console.error('Airport search error:', error);
    return getStaticAirports(query);
  }
}

/**
 * Static airport list for fallback
 */
function getStaticAirports(query) {
  const airports = [
    { code: 'MSP', name: 'Minneapolis-Saint Paul International', city: 'Minneapolis', state: 'MN' },
    { code: 'JFK', name: 'John F. Kennedy International', city: 'New York', state: 'NY' },
    { code: 'LAX', name: 'Los Angeles International', city: 'Los Angeles', state: 'CA' },
    { code: 'ORD', name: 'Chicago O\'Hare International', city: 'Chicago', state: 'IL' },
    { code: 'DFW', name: 'Dallas/Fort Worth International', city: 'Dallas', state: 'TX' },
    { code: 'DEN', name: 'Denver International', city: 'Denver', state: 'CO' },
    { code: 'SEA', name: 'Seattle-Tacoma International', city: 'Seattle', state: 'WA' },
    { code: 'SFO', name: 'San Francisco International', city: 'San Francisco', state: 'CA' },
    { code: 'LAS', name: 'Harry Reid International', city: 'Las Vegas', state: 'NV' },
    { code: 'MIA', name: 'Miami International', city: 'Miami', state: 'FL' }
  ];
  
  const q = query.toLowerCase();
  return airports.filter(a => 
    a.code.toLowerCase().includes(q) || 
    a.name.toLowerCase().includes(q) ||
    a.city.toLowerCase().includes(q)
  );
}

/**
 * Geocode address using Nominatim (OpenStreetMap)
 */
export async function geocodeAddress(address) {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=5`,
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'RELIA-LIMO-APP'
        }
      }
    );
    
    if (!response.ok) {
      console.warn('Geocoding service unavailable');
      return [];
    }
    
    const data = await response.json();
    return data.map(result => ({
      name: result.name,
      address: result.display_name,
      latitude: result.lat,
      longitude: result.lon,
      context: {
        city: result.address?.city,
        state: result.address?.state,
        zipcode: result.address?.postcode,
        country: result.address?.country
      }
    }));
  } catch (error) {
    console.error('Geocoding error:', error);
    return [];
  }
}

/**
 * Reverse geocode coordinates to address
 */
export async function reverseGeocode(lat, lon) {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`,
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'RELIA-LIMO-APP'
        }
      }
    );
    
    if (!response.ok) {
      console.warn('Reverse geocoding service unavailable');
      return null;
    }
    
    const data = await response.json();
    return {
      name: data.name,
      address: data.display_name,
      latitude: data.lat,
      longitude: data.lon,
      context: {
        city: data.address?.city,
        state: data.address?.state,
        zipcode: data.address?.postcode,
        country: data.address?.country
      }
    };
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return null;
  }
}

/**
 * Calculate distance between two coordinates
 */
export async function calculateDistance(start, end) {
  try {
    // Using OSRM (Open Source Routing Machine)
    const response = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${start.lon},${start.lat};${end.lon},${end.lat}?overview=false`,
      {
        headers: {
          'Accept': 'application/json'
        }
      }
    );
    
    if (!response.ok) {
      console.warn('Distance calculation service unavailable');
      return null;
    }
    
    const data = await response.json();
    if (data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      return {
        distance_miles: (route.distance * 0.000621371).toFixed(2),
        distance_km: (route.distance / 1000).toFixed(2),
        duration_minutes: Math.round(route.duration / 60),
        duration_hours: (route.duration / 3600).toFixed(2)
      };
    }
    return null;
  } catch (error) {
    console.error('Distance calculation error:', error);
    return null;
  }
}

/**
 * Create or update account in Supabase
 */
export async function saveAccountToSupabase(accountData) {
  console.log('📤 saveAccountToSupabase called with:', accountData?.account_number);
  const client = getSupabaseClient();
  if (!client) {
    console.warn('⚠️ Supabase client not available, skipping account sync');
    return null;
  }
  
  const useLocalDev = isLocalDevModeEnabled();
  // Development mode: Skip Supabase entirely and use localStorage
  if (useLocalDev) {
    console.log('🔧 Local dev data mode: Saving account to localStorage only');
    
    const accountWithId = {
      ...accountData,
      id: accountData.id || `local-account-${Date.now()}`,
      organization_id: '00000000-0000-0000-0000-000000000001',
      account_number: accountData.account_number || accountData.id || `ACC${Date.now()}`,
      created_at: accountData.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    const existingAccounts = JSON.parse(localStorage.getItem('local_accounts') || '[]');
    const existingIndex = existingAccounts.findIndex(a => 
      a.id === accountWithId.id || 
      a.account_number === accountWithId.account_number
    );
    
    if (existingIndex >= 0) {
      existingAccounts[existingIndex] = accountWithId;
      console.log('✅ Account updated locally for development:', accountWithId);
    } else {
      existingAccounts.push(accountWithId);
      console.log('✅ Account saved locally for development:', accountWithId);
    }
    
    localStorage.setItem('local_accounts', JSON.stringify(existingAccounts));
    return accountWithId;
  }
  
  try {
    lastApiError = null;
    console.log('🔍 Getting org context...');
    const { user, organizationId } = await getOrgContextOrThrow(client);
    console.log('✅ Got org context:', { userId: user?.id, organizationId });
    
    // Prepare account data for Supabase with all fields
    const supabaseAccount = {
      organization_id: organizationId,
      account_number: accountData.account_number || accountData.id,
      first_name: accountData.first_name,
      last_name: accountData.last_name,
      company_name: accountData.company_name,
      department: accountData.department,
      job_title: accountData.job_title,
      email: accountData.email,
      phone: accountData.phone,
      cell_phone: accountData.cell_phone || accountData.phone,
      
      // Additional phone fields
      office_phone: accountData.office_phone,
      office_phone_ext: accountData.office_phone_ext,
      home_phone: accountData.home_phone,
      home_phone_ext: accountData.home_phone_ext,
      cell_phone_2: accountData.cell_phone_2,
      cell_phone_3: accountData.cell_phone_3,
      fax_1: accountData.fax_1,
      fax_2: accountData.fax_2,
      fax_3: accountData.fax_3,
      
      // Address fields
      address_line1: accountData.address_line1,
      address_line2: accountData.address_line2,
      city: accountData.city,
      state: accountData.state,
      zip: accountData.zip,
      country: accountData.country || 'US',
      
      // Notes
      internal_notes: accountData.internal_notes,
      trip_notes: accountData.trip_notes,
      notes_others: accountData.notes_others,
      
      // Restrictions (stored as JSON arrays)
      restricted_drivers: accountData.restricted_drivers || [],
      restricted_cars: accountData.restricted_cars || [],
      
      // Settings
      source: accountData.source,
      rental_agreement: accountData.rental_agreement,
      account_settings: accountData.account_settings || 'normal',
      status: accountData.status || 'active',
      web_access: accountData.web_access || 'allow',
      
      // Account types
      is_billing_client: accountData.is_billing_client || false,
      is_passenger: accountData.is_passenger || false,
      is_booking_contact: accountData.is_booking_contact || false,
      
      // Email preferences (default to true if not explicitly set)
      email_pref_all: accountData.email_pref_all !== false,
      email_pref_confirmation: accountData.email_pref_confirmation !== false,
      email_pref_payment_receipt: accountData.email_pref_payment_receipt !== false,
      email_pref_invoice: accountData.email_pref_invoice !== false,
      email_pref_other: accountData.email_pref_other !== false,
      
      // Financial/legacy fields
      post_method: accountData.post_method,
      post_terms: accountData.post_terms,
      primary_agent_assigned: accountData.primary_agent_assigned,
      secondary_agent_assigned: accountData.secondary_agent_assigned,
      credit_card_number: accountData.credit_card_number,
      name_on_card: accountData.name_on_card,
      billing_address: accountData.billing_address,
      billing_city: accountData.billing_city,
      billing_state: accountData.billing_state,
      billing_zip: accountData.billing_zip,
      exp_month: accountData.exp_month,
      exp_year: accountData.exp_year,
      cc_type: accountData.cc_type,
      cvv: accountData.cvv,
      notes: accountData.notes,
      
      created_by: user.id,
      updated_by: user.id
    };
    
    // Check for existing account by account number
    const { data: existingRows, error: existingError } = await client
      .from('accounts')
      .select('id')
      .eq('account_number', supabaseAccount.account_number)
      .eq('organization_id', organizationId);

    if (existingError) throw existingError;
    const existing = Array.isArray(existingRows) && existingRows.length > 0 ? existingRows[0] : null;
    
    if (existing) {
      // Update existing account
      const { data, error } = await client
        .from('accounts')
        .update(supabaseAccount)
        .eq('id', existing.id)
        .select();
      
      // Check if RLS policy is blocking the update
      if (error && error.code === '42501' && useLocalDev) {
        console.warn('⚠️ RLS policy blocking account update, using local storage fallback (local dev data mode enabled)...');
        
        const accountWithId = {
          ...supabaseAccount,
          id: existing.id,
          updated_at: new Date().toISOString()
        };
        
        const existingAccounts = JSON.parse(localStorage.getItem('local_accounts') || '[]');
        const accountIndex = existingAccounts.findIndex(a => a.id === existing.id);
        if (accountIndex >= 0) {
          existingAccounts[accountIndex] = accountWithId;
        } else {
          existingAccounts.push(accountWithId);
        }
        localStorage.setItem('local_accounts', JSON.stringify(existingAccounts));
        
        console.log('✅ Account updated locally for development:', accountWithId);
        return accountWithId;
      }
      
      if (error) throw error;
      console.log('✅ Account updated in Supabase:', data);
      return data[0];
    } else {
      // Insert new account
      const { data, error } = await client
        .from('accounts')
        .insert([supabaseAccount])
        .select();
      
      // Check if RLS policy is blocking the insert
      if (error && error.code === '42501' && useLocalDev) {
        console.warn('⚠️ RLS policy blocking account insert, using local storage fallback (local dev data mode enabled)...');
        
        const accountWithId = {
          ...supabaseAccount,
          id: `local-account-${Date.now()}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        const existingAccounts = JSON.parse(localStorage.getItem('local_accounts') || '[]');
        existingAccounts.push(accountWithId);
        localStorage.setItem('local_accounts', JSON.stringify(existingAccounts));
        
        console.log('✅ Account saved locally for development:', accountWithId);
        return accountWithId;
      }
      
      if (error) throw error;
      console.log('✅ Account created in Supabase:', data);
      return data[0];
    }
  } catch (error) {
    console.error('❌ Error saving account to Supabase:', error);
    
    if (useLocalDev && error.message && (
        error.message.includes('JWT expired') || 
        error.message.includes('permission denied') ||
        error.message.includes('User not authenticated') ||
        error.message.includes('not authenticated')
    )) {
      console.warn('⚠️ Authentication error - using local storage fallback for account (local dev data mode enabled)');
      
      const localAccount = {
        ...accountData,
        id: `local-account-${Date.now()}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      const existingAccounts = JSON.parse(localStorage.getItem('local_accounts') || '[]');
      existingAccounts.push(localAccount);
      localStorage.setItem('local_accounts', JSON.stringify(existingAccounts));
      
      console.log('✅ Account saved locally due to authentication issue:', localAccount);
      return localAccount;
    }
    
    lastApiError = error;
    
    // Always return structured response with error details
    return {
      success: false,
      error: error.message || 'Failed to save account',
      errorCode: error.code,
      errorDetails: error.details,
      timestamp: new Date().toISOString(),
      accountData: accountData  // Include original data for reference
    };
  }
}

/**
 * Fetch accounts from Supabase
 */
export async function fetchAccounts() {
  const client = getSupabaseClient();
  if (!client) return null;
  const useLocalDev = isLocalDevModeEnabled();
  if (useLocalDev) {
    const localAccounts = JSON.parse(localStorage.getItem('local_accounts') || '[]');
    console.log(`✅ Local dev mode: Loaded ${localAccounts.length} local accounts`);
    // If local dev mode is on but there's nothing stored locally, fall back to Supabase
    if (localAccounts.length > 0) {
      return localAccounts;
    }
    console.warn('⚠️ Local dev mode enabled but no local accounts found; attempting Supabase fetch instead');
  }
  
  try {
    lastApiError = null;
    const { organizationId } = await getOrgContextOrThrow(client);

    const { data, error } = await client
      .from('accounts')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    console.log(`✅ Fetched ${(data || []).length} accounts from Supabase`);
    return data;
  } catch (error) {
    console.error('❌ Error fetching accounts:', error);
    lastApiError = error;
    return null;
  }
}

/**
 * Save passenger to Supabase
 */
export async function savePassengerToSupabase(passengerData) {
  const client = getSupabaseClient();
  if (!client) return null;
  
  try {
    lastApiError = null;
    const { user, organizationId } = await getOrgContextOrThrow(client);
    
    const supabasePassenger = {
      organization_id: organizationId,
      first_name: passengerData.firstName || passengerData.first_name,
      last_name: passengerData.lastName || passengerData.last_name,
      phone: passengerData.phone,
      email: passengerData.email,
      alt_contact_name: passengerData.altContactName || passengerData.alt_contact_name,
      alt_contact_phone: passengerData.altContactPhone || passengerData.alt_contact_phone,
      notes: passengerData.notes,
      created_by: user.id,
      updated_by: user.id
    };
    
    // Check for duplicate
    const { data: existingRows, error: existingError } = await client
      .from('passengers')
      .select('id')
      .eq('first_name', supabasePassenger.first_name)
      .eq('last_name', supabasePassenger.last_name)
      .eq('email', supabasePassenger.email)
      .eq('organization_id', organizationId);

    if (existingError) throw existingError;
    const existing = Array.isArray(existingRows) && existingRows.length > 0 ? existingRows[0] : null;
    
    if (existing) {
      const { data, error } = await client
        .from('passengers')
        .update(supabasePassenger)
        .eq('id', existing.id)
        .select();
      
      if (error) throw error;
      return data[0];
    } else {
      const { data, error } = await client
        .from('passengers')
        .insert([supabasePassenger])
        .select();
      
      if (error) throw error;
      return data[0];
    }
  } catch (error) {
    console.error('❌ Error saving passenger to Supabase:', error);
    lastApiError = error;
    return null;
  }
}

/**
 * Save booking agent to Supabase
 */
export async function saveBookingAgentToSupabase(agentData) {
  const client = getSupabaseClient();
  if (!client) return null;
  
  try {
    lastApiError = null;
    const { user, organizationId } = await getOrgContextOrThrow(client);
    
    const supabaseAgent = {
      organization_id: organizationId,
      first_name: agentData.firstName || agentData.first_name,
      last_name: agentData.lastName || agentData.last_name,
      phone: agentData.phone,
      email: agentData.email,
      notes: agentData.notes,
      created_by: user.id,
      updated_by: user.id
    };
    
    // Check for duplicate
    const { data: existingRows, error: existingError } = await client
      .from('booking_agents')
      .select('id')
      .eq('first_name', supabaseAgent.first_name)
      .eq('last_name', supabaseAgent.last_name)
      .eq('email', supabaseAgent.email)
      .eq('organization_id', organizationId);

    if (existingError) throw existingError;
    const existing = Array.isArray(existingRows) && existingRows.length > 0 ? existingRows[0] : null;
    
    if (existing) {
      const { data, error } = await client
        .from('booking_agents')
        .update(supabaseAgent)
        .eq('id', existing.id)
        .select();
      
      if (error) throw error;
      return data[0];
    } else {
      const { data, error } = await client
        .from('booking_agents')
        .insert([supabaseAgent])
        .select();
      
      if (error) throw error;
      return data[0];
    }
  } catch (error) {
    console.error('❌ Error saving booking agent to Supabase:', error);
    lastApiError = error;
    return null;
  }
}

// ============================================================================
// DELETE ALL FUNCTIONS (for utilities/system settings)
// ============================================================================

/**
 * Delete all accounts from Supabase
 */
export async function deleteAllAccountsSupabase() {
  const client = getSupabaseClient();
  
  const useLocalDev = isLocalDevModeEnabled();
  if (useLocalDev) {
    const existing = JSON.parse(localStorage.getItem('local_accounts') || '[]');
    const count = existing.length;
    localStorage.removeItem('local_accounts');
    console.log(`🔧 Local dev mode: Cleared ${count} accounts from localStorage`);
    return { success: true, deleted: count, message: `Deleted ${count} local accounts` };
  }
  
  if (!client) {
    return { success: false, error: 'Client not initialized', deleted: 0 };
  }
  
  try {
    lastApiError = null;
    
    // Delete all accounts (using neq to match all ids)
    const { data, error } = await client
      .from('accounts')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
      .select();
    
    if (error) throw error;
    
    const count = data?.length || 0;
    console.log(`✅ Deleted ${count} accounts from Supabase`);
    return { success: true, deleted: count, message: `Deleted ${count} accounts` };
  } catch (error) {
    console.error('❌ Error deleting accounts:', error);
    lastApiError = error;
    return { success: false, error: error.message, deleted: 0 };
  }
}

/**
 * Delete all reservations from Supabase
 */
export async function deleteAllReservationsSupabase() {
  const client = getSupabaseClient();
  
  const useLocalDev = isLocalDevModeEnabled();
  if (useLocalDev) {
    const existing = JSON.parse(localStorage.getItem('local_reservations') || '[]');
    const count = existing.length;
    localStorage.removeItem('local_reservations');
    console.log(`🔧 Local dev mode: Cleared ${count} reservations from localStorage`);
    return { success: true, deleted: count, message: `Deleted ${count} local reservations` };
  }
  
  if (!client) {
    return { success: false, error: 'Client not initialized', deleted: 0 };
  }
  
  try {
    lastApiError = null;
    
    const { data, error } = await client
      .from('reservations')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
      .select();
    
    if (error) throw error;
    
    const count = data?.length || 0;
    console.log(`✅ Deleted ${count} reservations from Supabase`);
    return { success: true, deleted: count, message: `Deleted ${count} reservations` };
  } catch (error) {
    console.error('❌ Error deleting reservations:', error);
    lastApiError = error;
    return { success: false, error: error.message, deleted: 0 };
  }
}

/**
 * Delete all drivers from Supabase
 */
export async function deleteAllDriversSupabase() {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, error: 'Client not initialized', deleted: 0 };
  }
  
  try {
    lastApiError = null;
    
    const { data, error } = await client
      .from('drivers')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
      .select();
    
    if (error) throw error;
    
    const count = data?.length || 0;
    console.log(`✅ Deleted ${count} drivers from Supabase`);
    return { success: true, deleted: count, message: `Deleted ${count} drivers` };
  } catch (error) {
    console.error('❌ Error deleting drivers:', error);
    lastApiError = error;
    return { success: false, error: error.message, deleted: 0 };
  }
}

/**
 * Delete all rates from Supabase
 */
export async function deleteAllRatesSupabase() {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, error: 'Client not initialized', deleted: 0 };
  }
  
  try {
    lastApiError = null;
    
    const { data, error } = await client
      .from('rates')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
      .select();
    
    if (error) throw error;
    
    const count = data?.length || 0;
    console.log(`✅ Deleted ${count} rates from Supabase`);
    return { success: true, deleted: count, message: `Deleted ${count} rates` };
  } catch (error) {
    console.error('❌ Error deleting rates:', error);
    lastApiError = error;
    return { success: false, error: error.message, deleted: 0 };
  }
}
