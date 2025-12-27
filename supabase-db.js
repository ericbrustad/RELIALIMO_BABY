// Supabase-only Database Module for RELIA🐂LIMO™
// All data is stored in Supabase - NO localStorage for critical business data
// This replaces the localStorage-based db.js for production use

import { 
  setupAPI, 
  getSupabaseClient,
  getLastApiError,
  createReservation,
  updateReservation,
  fetchReservations,
  getReservation,
  fetchDrivers,
  createDriver,
  updateDriver,
  deleteDriver,
  fetchAffiliates,
  createAffiliate,
  updateAffiliate,
  deleteAffiliate,
  fetchVehicleTypes,
  upsertVehicleType,
  saveAccountToSupabase,
  fetchAccounts,
  savePassengerToSupabase,
  saveBookingAgentToSupabase,
  isLocalDevModeEnabled,
  setLocalDevModeEnabled,
  getOrgContextOrThrow
} from './api-service.js';

function isAuthOrRlsError(error) {
  const msg = (error?.message || '').toLowerCase();
  return msg.includes('jwt') || msg.includes('auth') || msg.includes('permission denied') || msg.includes('rls') || msg.includes('not authenticated');
}

let searchAuthPrompted = false;
function maybePromptLocalDevForSearch(error) {
  if (searchAuthPrompted) return;
  if (!isAuthOrRlsError(error)) return;
  const hostIsLocal = window?.location && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  if (!hostIsLocal) return;
  if (isLocalDevModeEnabled()) return;

  searchAuthPrompted = true;
  const confirmEnable = window.confirm('Supabase search is blocked (authentication/RLS). Enable local dev data mode and reload?');
  if (confirmEnable) {
    setLocalDevModeEnabled(true);
    window.location.reload();
  }
}

// Success notification helper
function showDatabaseSuccess(operation, data) {
  console.log(`✅ ${operation} successful:`, data);
  
  // Don't show alert in popups/iframes - just log to console
  const isPopup = window.opener !== null;
  const isIframe = window.self !== window.top;
  
  if (!isPopup && !isIframe) {
    // Show user-friendly success notification
    const successMsg = getSuccessMessage(operation, data);
    
    // Create a brief success notification
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #28a745;
      color: white;
      padding: 15px 20px;
      border-radius: 5px;
      z-index: 10000;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      font-family: Arial, sans-serif;
      font-size: 14px;
      max-width: 300px;
    `;
    notification.textContent = successMsg;
    document.body.appendChild(notification);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 3000);
  }
}

function getSuccessMessage(operation, data) {
  switch (operation) {
    case 'Save Reservation':
      return `✅ Reservation saved successfully!${data?.confirmation_number ? ' (' + data.confirmation_number + ')' : ''}`;
    case 'Save Account':
      return `✅ Account saved successfully!${data?.account_number ? ' (' + data.account_number + ')' : ''}`;
    case 'Update Reservation':
      return `✅ Reservation updated successfully!`;
    case 'Update Account':
      return `✅ Account updated successfully!`;
    default:
      return `✅ ${operation} completed successfully!`;
  }
}

// Error display helper
function showDatabaseError(operation, error) {
  const errorMsg = error?.message || error?.toString() || 'Unknown database error';
  console.error(`❌ Database Error [${operation}]:`, error);
  
  // Don't show alert in popups/iframes - just log to console
  const isPopup = window.opener !== null;
  const isIframe = window.self !== window.top;
  
  if (!isPopup && !isIframe) {
    // Only show alert in main window
    alert(`⚠️ DATABASE ERROR\n\nOperation: ${operation}\nError: ${errorMsg}\n\nPlease check your connection and try again.`);
  }
  
  // Return structured error instead of null
  return {
    success: false,
    error: errorMsg,
    operation: operation,
    details: error
  };
}

// Success notification (optional - can be disabled)
function logSuccess(operation, data) {
  console.log(`✅ ${operation} successful:`, data);
}

// ========================================
// RESERVATIONS
// ========================================

export async function saveReservation(reservationData) {
  console.log('💾 saveReservation called with data:', reservationData?.confirmation_number || 'no confirmation');
  
  try {
    console.log('🔧 Setting up API...');
    await setupAPI();
    
    // Check if this is an update or create
    if (reservationData.id && reservationData.id.toString().includes('-')) {
      // UUID = existing reservation, update it
      console.log('📝 Updating existing reservation:', reservationData.id);
      const result = await updateReservation(reservationData.id, reservationData);
      console.log('📤 Update result:', result ? 'received' : 'null');
      if (!result) {
        const apiError = getLastApiError();
        const errorMsg = apiError?.message || 'Update operation failed - no result returned';
        throw new Error(errorMsg);
      }
      logSuccess('Reservation updated', result);
      
      // Show success notification to user
      showDatabaseSuccess('Update Reservation', result);
      
      return result;
    } else {
      // New reservation
      console.log('🆕 Creating new reservation');
      const result = await createReservation(reservationData);
      console.log('📤 createReservation returned:', result ? 'data received' : 'null', Array.isArray(result) ? `array length: ${result.length}` : 'not array');
      console.log('📊 Result details:', JSON.stringify(result, null, 2));
      
      if (!result) {
        const apiError = getLastApiError();
        const errorMsg = apiError?.message || 'Create operation failed - no result returned';
        console.error('❌ Create reservation failed (null result):', errorMsg);
        throw new Error(errorMsg);
      }
      
      if (Array.isArray(result) && result.length === 0) {
        const apiError = getLastApiError();
        const errorMsg = apiError?.message || 'Create operation returned empty array';
        console.error('❌ Create reservation failed (empty array):', errorMsg);
        throw new Error(errorMsg);
      }
      
      console.log('✅ Reservation creation successful');
      logSuccess('Reservation created', result);
      const finalResult = Array.isArray(result) ? result[0] : result;
      console.log('📋 Returning final result:', finalResult);
      
      // Show success notification to user
      showDatabaseSuccess('Save Reservation', finalResult);
      
      return finalResult;
    }
  } catch (error) {
    console.error('❌ saveReservation error:', error);
    console.error('❌ Error details:', {
      message: error.message,
      stack: error.stack,
      type: typeof error
    });
    
    // Return an error object instead of null
    const errorResponse = {
      success: false,
      error: error.message || error.toString(),
      details: error
    };
    console.log('🚫 Returning error response:', errorResponse);
    return errorResponse;
  }
}

export async function getAllReservations() {
  try {
    console.log('🔍 Fetching all reservations from Supabase...');
    await setupAPI();
    const result = await fetchReservations();
    if (!result) return [];
    logSuccess('Fetched reservations', `${result.length} records`);
    return result;
  } catch (error) {
    showDatabaseError('Fetch Reservations', error);
    return [];
  }
}

export async function getReservationById(reservationId) {
  try {
    await setupAPI();
    const result = await getReservation(reservationId);
    return result;
  } catch (error) {
    showDatabaseError('Get Reservation', error);
    return null;
  }
}

// ========================================
// ACCOUNTS
// ========================================

export async function saveAccount(accountData) {
  console.log('📥 supabase-db.saveAccount called with:', accountData?.account_number);
  
  try {
    console.log('🔧 Calling setupAPI...');
    await setupAPI();
    console.log('✅ setupAPI complete, calling saveAccountToSupabase...');
    const result = await saveAccountToSupabase(accountData);
    console.log('📤 saveAccountToSupabase returned:', result ? 'success' : 'null');
    if (!result) {
      // Get the real error from api-service
      const apiError = getLastApiError();
      if (apiError) {
        console.error('API Error details:', apiError);
        throw apiError;
      }
      // Check if this is an auth issue
      const client = getSupabaseClient();
      if (client) {
        const { data: { user } } = await client.auth.getUser();
        if (!user) {
          throw new Error('Please log in to save accounts');
        }
      }
      throw new Error('Save returned empty result - check console for details');
    }
    logSuccess('Account saved', result);
    
    // Show success notification to user
    showDatabaseSuccess('Save Account', result);
    
    return { success: true, account: result };
  } catch (error) {
    showDatabaseError('Save Account', error);
    return { success: false, error: error.message };
  }
}

export async function getAllAccounts() {
  try {
    await setupAPI();
    const result = await fetchAccounts();
    if (!result) return [];
    logSuccess('Fetched accounts', `${result.length} records`);
    return result;
  } catch (error) {
    showDatabaseError('Fetch Accounts', error);
    return [];
  }
}

// Sample accounts for fallback when Supabase is empty or fails
const SAMPLE_ACCOUNTS = [
  { id: '30001', account_number: '30001', first_name: 'John', last_name: 'Smith', company_name: 'Smith Industries', phone: '555-0101', email: 'john@smith.com', status: 'active', is_billing_client: true, is_passenger: true, is_booking_contact: true },
  { id: '30002', account_number: '30002', first_name: 'Jane', last_name: 'Johnson', company_name: '', phone: '555-0102', email: 'jane@johnson.com', status: 'active', is_billing_client: false, is_passenger: true, is_booking_contact: false },
  { id: '30003', account_number: '30003', first_name: 'Bob', last_name: 'Wilson', company_name: 'Wilson Corp', phone: '555-0103', email: 'bob@wilson.com', status: 'active', is_billing_client: true, is_passenger: false, is_booking_contact: true },
  { id: '30004', account_number: '30004', first_name: 'Peter', last_name: 'Parker', company_name: 'Daily Bugle', phone: '555-0104', email: 'peter@bugle.com', status: 'active', is_billing_client: true, is_passenger: true, is_booking_contact: true },
  { id: '30005', account_number: '30005', first_name: 'Mary', last_name: 'Peterson', company_name: '', phone: '555-0105', email: 'mary@peterson.com', status: 'active', is_billing_client: false, is_passenger: true, is_booking_contact: false },
  { id: '30006', account_number: '30006', first_name: 'Mike', last_name: 'Peters', company_name: 'Peters Co', phone: '555-0106', email: 'mike@peters.com', status: 'active', is_billing_client: true, is_passenger: false, is_booking_contact: true }
];

function searchSampleAccounts(query) {
  const queryLower = query.toLowerCase();
  return SAMPLE_ACCOUNTS.filter(account => 
    (account.first_name && account.first_name.toLowerCase().includes(queryLower)) ||
    (account.last_name && account.last_name.toLowerCase().includes(queryLower)) ||
    (account.company_name && account.company_name.toLowerCase().includes(queryLower)) ||
    (account.phone && account.phone.includes(query)) ||
    (account.email && account.email.toLowerCase().includes(queryLower)) ||
    (account.account_number && account.account_number.includes(query))
  ).slice(0, 10);
}

export async function getAccountById(accountId) {
  try {
    console.log('🔍 getAccountById called for:', accountId);
    
    // Development mode: Check localStorage first
    const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isDev) {
      const localAccounts = JSON.parse(localStorage.getItem('local_accounts') || '[]');
      const localAccount = localAccounts.find(a => 
        a.id === accountId || 
        a.account_number === accountId
      );
      if (localAccount) {
        console.log('✅ Found account in localStorage:', localAccount.first_name, localAccount.last_name);
        return localAccount;
      }
      // Also check sample accounts
      const sampleAccount = SAMPLE_ACCOUNTS.find(a => a.id === accountId || a.account_number === accountId);
      if (sampleAccount) {
        console.log('✅ Found sample account:', sampleAccount.first_name, sampleAccount.last_name);
        return sampleAccount;
      }
      console.log('⚠️ Account not found in localStorage or samples');
      return null;
    }
    
    await setupAPI();
    const client = getSupabaseClient();
    if (!client) throw new Error('No Supabase client');
    
    const { data, error } = await client
      .from('accounts')
      .select('*')
      .eq('id', accountId)
      .single();
    
    if (error) throw error;
    if (data) return data;
    
    // Fallback to sample data if Supabase returns nothing
    console.log('⚠️ No data from Supabase, checking sample accounts');
    const sampleAccount = SAMPLE_ACCOUNTS.find(a => a.id === accountId || a.account_number === accountId);
    if (sampleAccount) {
      console.log('✅ Found sample account:', sampleAccount);
      return sampleAccount;
    }
    return null;
  } catch (error) {
    console.error('Error getting account by ID:', error);
    // Fallback to sample data on error
    const sampleAccount = SAMPLE_ACCOUNTS.find(a => a.id === accountId || a.account_number === accountId);
    if (sampleAccount) {
      console.log('✅ Fallback to sample account:', sampleAccount);
      return sampleAccount;
    }
    return null;
  }
}

// Search functions for account autocomplete
export async function searchAccounts(query) {
  console.log('🔍 searchAccounts called with query:', query);
  
  // Require at least 3 characters for search
  if (!query || query.length < 3) {
    console.log('⚠️ Query too short (need 3+ characters)');
    return [];
  }
  const useLocalDev = isLocalDevModeEnabled();
  
  // Development mode: Search localStorage first
  if (useLocalDev) {
    const localAccounts = JSON.parse(localStorage.getItem('local_accounts') || '[]');
    const queryLower = query.toLowerCase();
    const results = localAccounts.filter(account => 
      (account.first_name && account.first_name.toLowerCase().includes(queryLower)) ||
      (account.last_name && account.last_name.toLowerCase().includes(queryLower)) ||
      (account.company_name && account.company_name.toLowerCase().includes(queryLower)) ||
      (account.phone && account.phone.includes(query)) ||
      (account.email && account.email.toLowerCase().includes(queryLower)) ||
      (account.account_number && account.account_number.toString().includes(query))
    ).slice(0, 10);
    
    console.log('🔧 Development mode: Found', results.length, 'accounts in localStorage');
    
    // If no local results, also check sample accounts
    if (results.length === 0) {
      const sampleResults = searchSampleAccounts(query);
      console.log('✅ Fallback to', sampleResults.length, 'sample accounts');
      return sampleResults;
    }
    
    return results;
  }
  
  try {
    await setupAPI();
    const client = getSupabaseClient();
    if (!client) throw new Error('No Supabase client');
    
    // Get organization context for RLS
    const { organizationId } = await getOrgContextOrThrow(client);
    
    console.log('🔍 Building accounts query for org:', organizationId, 'query:', query);
    
    // Search across multiple fields using OR conditions
    // Use PostgREST filter syntax for OR
    let queryBuilder = client
      .from('accounts')
      .select('*')
      .eq('organization_id', organizationId);
    
    console.log('🔍 Query builder created:', !!queryBuilder);
    
    // Add OR filter using PostgREST syntax
    const filterStr = `first_name.ilike.%${query}%,last_name.ilike.%${query}%,company_name.ilike.%${query}%,phone.ilike.%${query}%,email.ilike.%${query}%,account_number.ilike.%${query}%`;
    console.log('🔍 OR filter string:', filterStr);
    
    queryBuilder = queryBuilder.or(filterStr);
    console.log('🔍 OR filter added:', !!queryBuilder);
    
    queryBuilder = queryBuilder.limit(10);
    console.log('🔍 Limit added, executing query...');
    
    const { data, error } = await queryBuilder;
    
    console.log('🔍 Query result - data:', data?.length || 0, 'error:', error?.message || 'none', 'error details:', error);
    
    if (error) {
      console.error('🔍 Full error object:', JSON.stringify(error, null, 2));
      throw error;
    }
    
    if (data && data.length > 0) {
      console.log('✅ Found', data.length, 'accounts from Supabase');
      return data;
    }
    
    console.log('⚠️ No matching accounts found in Supabase');
    return [];
  } catch (error) {
    console.error('❌ Error searching accounts:', error);
    if (useLocalDev) {
      const sampleResults = searchSampleAccounts(query);
      console.log('✅ Fallback to', sampleResults.length, 'sample accounts (local dev mode)');
      return sampleResults;
    }
    maybePromptLocalDevForSearch(error);
    return [];
  }
}

// Helper function to filter sample accounts by company name
function searchSampleAccountsByCompany(query) {
  const queryLower = query.toLowerCase();
  return SAMPLE_ACCOUNTS.filter(account => 
    account.company_name && account.company_name.toLowerCase().includes(queryLower)
  ).slice(0, 10);
}

// Helper function to filter sample accounts as passengers
function searchSamplePassengers(query) {
  const queryLower = query.toLowerCase();
  return SAMPLE_ACCOUNTS.filter(account => 
    (account.first_name && account.first_name.toLowerCase().includes(queryLower)) ||
    (account.last_name && account.last_name.toLowerCase().includes(queryLower)) ||
    (account.phone && account.phone.includes(query)) ||
    (account.email && account.email.toLowerCase().includes(queryLower))
  ).slice(0, 10);
}

export async function searchAccountsByCompany(query) {
  console.log('🔍 searchAccountsByCompany called with query:', query);
  
  // Require at least 3 characters for search
  if (!query || query.length < 3) {
    console.log('⚠️ Query too short (need 3+ characters)');
    return [];
  }
  const useLocalDev = isLocalDevModeEnabled();
  
  // Development mode: Search localStorage first
  if (useLocalDev) {
    const localAccounts = JSON.parse(localStorage.getItem('local_accounts') || '[]');
    const queryLower = query.toLowerCase();
    const results = localAccounts.filter(account => 
      account.company_name && account.company_name.toLowerCase().includes(queryLower)
    ).slice(0, 10);
    
    console.log('🔧 Development mode: Found', results.length, 'company accounts in localStorage');
    
    // If no local results, also check sample accounts
    if (results.length === 0) {
      const sampleResults = searchSampleAccountsByCompany(query);
      console.log('✅ Fallback to', sampleResults.length, 'sample company accounts');
      return sampleResults;
    }
    
    return results;
  }
  
  try {
    await setupAPI();
    const client = getSupabaseClient();
    if (!client) throw new Error('No Supabase client');
    
    // Get organization context for RLS
    const { organizationId } = await getOrgContextOrThrow(client);
    
    const { data, error } = await client
      .from('accounts')
      .select('*')
      .eq('organization_id', organizationId)
      .ilike('company_name', `%${query}%`)
      .not('company_name', 'is', null)
      .limit(10);
    
    if (error) throw error;
    
    if (data && data.length > 0) {
      console.log('✅ Found', data.length, 'company accounts from Supabase');
      return data;
    }
    
    console.log('⚠️ No matching company accounts found in Supabase');
    return [];
  } catch (error) {
    console.error('❌ Error searching company accounts:', error);
    if (useLocalDev) {
      const sampleResults = searchSampleAccountsByCompany(query);
      return sampleResults;
    }
    maybePromptLocalDevForSearch(error);
    return [];
  }
}

export async function searchPassengers(query) {
  console.log('🔍 searchPassengers called with query:', query);
  
  // Require at least 3 characters for search
  if (!query || query.length < 3) {
    console.log('⚠️ Query too short (need 3+ characters)');
    return [];
  }
  const useLocalDev = isLocalDevModeEnabled();
  
  try {
    await setupAPI();
    const client = getSupabaseClient();
    if (!client) throw new Error('No Supabase client');
    
    // Get organization context for RLS
    const { organizationId } = await getOrgContextOrThrow(client);
    
    console.log('🔍 Building passengers query for org:', organizationId, 'query:', query);
    
    // Search accounts that could be passengers
    let queryBuilder = client
      .from('accounts')
      .select('*')
      .eq('organization_id', organizationId);
    
    console.log('🔍 Query builder created:', !!queryBuilder);
    
    // Add OR filter
    const filterStr = `first_name.ilike.%${query}%,last_name.ilike.%${query}%,phone.ilike.%${query}%,email.ilike.%${query}%`;
    console.log('🔍 OR filter string:', filterStr);
    
    queryBuilder = queryBuilder.or(filterStr);
    console.log('🔍 OR filter added:', !!queryBuilder);
    
    queryBuilder = queryBuilder.limit(10);
    console.log('🔍 Limit added, executing query...');
    
    const { data, error } = await queryBuilder;
    
    console.log('🔍 Query result - data:', data?.length || 0, 'error:', error?.message || 'none', 'error details:', error);
    
    if (error) {
      console.error('🔍 Full error object:', JSON.stringify(error, null, 2));
      throw error;
    }
    
    if (data && data.length > 0) {
      console.log('✅ Found', data.length, 'passenger accounts from Supabase');
      return data;
    }
    
    console.log('⚠️ No matching passengers found in Supabase');
    return [];
  } catch (error) {
    console.error('❌ Error searching passengers:', error);
    if (useLocalDev) {
      const sampleResults = searchSamplePassengers(query);
      return sampleResults;
    }
    maybePromptLocalDevForSearch(error);
    return [];
  }
}

export async function searchBookingAgents(query) {
  console.log('🔍 searchBookingAgents called with query:', query);
  
  // Require at least 3 characters for search
  if (!query || query.length < 3) {
    console.log('⚠️ Query too short (need 3+ characters)');
    return [];
  }
  const useLocalDev = isLocalDevModeEnabled();
  
  try {
    await setupAPI();
    const client = getSupabaseClient();
    if (!client) throw new Error('No Supabase client');
    
    // Get organization context for RLS
    const { organizationId } = await getOrgContextOrThrow(client);
    
    console.log('🔍 Building booking agents query for org:', organizationId, 'query:', query);
    
    // Search accounts that could be booking agents
    let queryBuilder = client
      .from('accounts')
      .select('*')
      .eq('organization_id', organizationId);
    
    console.log('🔍 Query builder created:', !!queryBuilder);
    
    // Add OR filter
    const filterStr = `first_name.ilike.%${query}%,last_name.ilike.%${query}%,phone.ilike.%${query}%,email.ilike.%${query}%`;
    console.log('🔍 OR filter string:', filterStr);
    
    queryBuilder = queryBuilder.or(filterStr);
    console.log('🔍 OR filter added:', !!queryBuilder);
    
    queryBuilder = queryBuilder.limit(10);
    console.log('🔍 Limit added, executing query...');
    
    const { data, error } = await queryBuilder;
    
    console.log('🔍 Query result - data:', data?.length || 0, 'error:', error?.message || 'none', 'error details:', error);
    
    if (error) {
      console.error('🔍 Full error object:', JSON.stringify(error, null, 2));
      throw error;
    }
    
    if (data && data.length > 0) {
      console.log('✅ Found', data.length, 'booking agent accounts from Supabase');
      return data;
    }
    
    console.log('⚠️ No matching booking agents found in Supabase');
    return [];
  } catch (error) {
    console.error('❌ Error searching booking agents:', error);
    if (useLocalDev) {
      const sampleResults = searchSamplePassengers(query);
      return sampleResults;
    }
    maybePromptLocalDevForSearch(error);
    return [];
  }
}

export async function deleteAccount(accountId) {
  try {
    await setupAPI();
    const client = getSupabaseClient();
    if (!client) throw new Error('No Supabase client');
    
    const { error } = await client
      .from('accounts')
      .delete()
      .eq('id', accountId);
    
    if (error) throw error;
    logSuccess('Account deleted', accountId);
    return true;
  } catch (error) {
    return showDatabaseError('Delete Account', error);
  }
}

// ========================================
// DRIVERS
// ========================================

export async function saveDriver(driverData) {
  try {
    await setupAPI();
    
    if (driverData.id) {
      const result = await updateDriver(driverData.id, driverData);
      if (!result) throw new Error('Update returned empty result');
      logSuccess('Driver updated', result);
      return result;
    } else {
      const result = await createDriver(driverData);
      if (!result) throw new Error('Create returned empty result');
      logSuccess('Driver created', result);
      return result;
    }
  } catch (error) {
    return showDatabaseError('Save Driver', error);
  }
}

export async function getAllDrivers() {
  try {
    await setupAPI();
    const result = await fetchDrivers();
    if (!result) return [];
    logSuccess('Fetched drivers', `${result.length} records`);
    return result;
  } catch (error) {
    showDatabaseError('Fetch Drivers', error);
    return [];
  }
}

export { deleteDriver };

// ========================================
// AFFILIATES
// ========================================

export async function saveAffiliate(affiliateData) {
  try {
    await setupAPI();
    
    if (affiliateData.id) {
      const result = await updateAffiliate(affiliateData.id, affiliateData);
      if (!result) throw new Error('Update returned empty result');
      logSuccess('Affiliate updated', result);
      return result;
    } else {
      const result = await createAffiliate(affiliateData);
      if (!result) throw new Error('Create returned empty result');
      logSuccess('Affiliate created', result);
      return result;
    }
  } catch (error) {
    return showDatabaseError('Save Affiliate', error);
  }
}

export async function getAllAffiliates() {
  try {
    await setupAPI();
    const result = await fetchAffiliates();
    if (!result) return [];
    logSuccess('Fetched affiliates', `${result.length} records`);
    return result;
  } catch (error) {
    showDatabaseError('Fetch Affiliates', error);
    return [];
  }
}

export { deleteAffiliate };

// ========================================
// VEHICLES
// ========================================

export async function saveVehicleType(vehicleData) {
  try {
    await setupAPI();
    const result = await upsertVehicleType(vehicleData);
    if (!result) throw new Error('Upsert returned empty result');
    logSuccess('Vehicle type saved', result);
    return result;
  } catch (error) {
    return showDatabaseError('Save Vehicle Type', error);
  }
}

export async function getAllVehicleTypes() {
  try {
    await setupAPI();
    const result = await fetchVehicleTypes();
    if (!result) return [];
    logSuccess('Fetched vehicle types', `${result.length} records`);
    return result;
  } catch (error) {
    showDatabaseError('Fetch Vehicle Types', error);
    return [];
  }
}

// ========================================
// PASSENGERS
// ========================================

export async function savePassenger(passengerData) {
  try {
    await setupAPI();
    const result = await savePassengerToSupabase(passengerData);
    if (!result) throw new Error('Save returned empty result');
    logSuccess('Passenger saved', result);
    return result;
  } catch (error) {
    return showDatabaseError('Save Passenger', error);
  }
}

export async function getAllPassengers() {
  try {
    await setupAPI();
    const client = getSupabaseClient();
    if (!client) throw new Error('No Supabase client');
    
    const { data, error } = await client
      .from('passengers')
      .select('*')
      .order('last_name', { ascending: true });
    
    if (error) throw error;
    logSuccess('Fetched passengers', `${data?.length || 0} records`);
    return data || [];
  } catch (error) {
    showDatabaseError('Fetch Passengers', error);
    return [];
  }
}

// ========================================
// BOOKING AGENTS
// ========================================

export async function saveBookingAgent(agentData) {
  try {
    await setupAPI();
    const result = await saveBookingAgentToSupabase(agentData);
    if (!result) throw new Error('Save returned empty result');
    logSuccess('Booking agent saved', result);
    return result;
  } catch (error) {
    return showDatabaseError('Save Booking Agent', error);
  }
}

export async function getAllBookingAgents() {
  try {
    await setupAPI();
    const client = getSupabaseClient();
    if (!client) throw new Error('No Supabase client');
    
    const { data, error } = await client
      .from('booking_agents')
      .select('*')
      .order('last_name', { ascending: true });
    
    if (error) throw error;
    logSuccess('Fetched booking agents', `${data?.length || 0} records`);
    return data || [];
  } catch (error) {
    showDatabaseError('Fetch Booking Agents', error);
    return [];
  }
}

// ========================================
// ACCOUNT ADDRESSES
// ========================================

export async function saveAccountAddress(accountId, addressData) {
  try {
    await setupAPI();
    const client = getSupabaseClient();
    if (!client) throw new Error('No Supabase client');
    
    const { data, error } = await client
      .from('account_addresses')
      .insert([{
        account_id: accountId,
        ...addressData
      }])
      .select();
    
    if (error) throw error;
    logSuccess('Account address saved', data);
    return data?.[0] || data;
  } catch (error) {
    return showDatabaseError('Save Account Address', error);
  }
}

export async function getAccountAddresses(accountId) {
  try {
    await setupAPI();
    const client = getSupabaseClient();
    if (!client) throw new Error('No Supabase client');
    
    const { data, error } = await client
      .from('account_addresses')
      .select('*')
      .eq('account_id', accountId);
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    showDatabaseError('Fetch Account Addresses', error);
    return [];
  }
}

// ========================================
// CONFIRMATION / ACCOUNT NUMBER SEQUENCES
// ========================================

// Function to check if a confirmation number already exists
export async function checkConfirmationNumberExists(confirmationNumber) {
  console.log('🔍 Checking if confirmation number exists:', confirmationNumber);
  const useLocalDev = isLocalDevModeEnabled();
  
  if (useLocalDev) {
    const localReservations = JSON.parse(localStorage.getItem('local_reservations') || '[]');
    const existsLocal = localReservations.some(r => String(r.confirmation_number) === String(confirmationNumber));
    console.log('🔍 Local dev check - exists:', existsLocal);
    return existsLocal;
  }
  
  try {
    await setupAPI();
    const client = getSupabaseClient();
    if (!client) throw new Error('No Supabase client');
    
    const { data, error } = await client
      .from('reservations')
      .select('id')
      .eq('confirmation_number', confirmationNumber)
      .limit(1);
    
    if (error) {
      console.error('❌ Error checking confirmation number:', error);
      throw error;
    }
    
    const exists = data && data.length > 0;
    console.log('🔍 Confirmation number exists:', exists);
    return exists;
  } catch (error) {
    console.error('❌ Error checking confirmation number existence:', error);
    if (!useLocalDev) {
      throw error;
    }
    return false;
  }
}

// Function to generate a unique confirmation number with duplicate checking
export async function generateUniqueConfirmationNumber() {
  console.log('🔢 Generating unique confirmation number...');
  
  const maxAttempts = 10;
  let attempt = 0;
  let lastError = null;
  
  while (attempt < maxAttempts) {
    attempt++;
    
    // Get the next confirmation number
    const candidateNumber = await getNextConfirmationNumber();
    
    // Check if this number already exists
    let exists = false;
    try {
      exists = await checkConfirmationNumberExists(candidateNumber);
    } catch (checkError) {
      lastError = checkError;
      console.error('❌ Error during confirmation number existence check:', checkError);
      throw checkError;
    }
    
    if (!exists) {
      console.log(`✅ Generated unique confirmation number: ${candidateNumber} (attempt ${attempt})`);
      return candidateNumber;
    }
    
    console.log(`⚠️ Confirmation number ${candidateNumber} already exists, trying again... (attempt ${attempt})`);
    
    // Add a small random offset to avoid collision
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
  }
  
  const error = new Error(`Unable to generate unique confirmation number after ${maxAttempts} attempts${lastError ? `: ${lastError.message}` : ''}`);
  console.error(error);
  throw error;
}

export async function getNextConfirmationNumber() {
  console.log('🔢 getNextConfirmationNumber called');
  const useLocalDev = isLocalDevModeEnabled();
  
  try {
    // Get the starting confirmation number from settings (stored in localStorage by my-office.js)
    let startingNumber = 100000; // Default
    try {
      const settings = JSON.parse(localStorage.getItem('relia_company_settings') || '{}');
      const settingValue = settings.confirmationNumberStart;
      if (settingValue !== undefined && settingValue !== null && settingValue !== '') {
        startingNumber = parseInt(settingValue, 10);
        if (!Number.isFinite(startingNumber)) {
          startingNumber = 100000;
        }
        console.log('🔢 Loaded starting confirmation number from settings:', startingNumber);
      } else {
        console.log('⚠️ confirmationNumberStart not found in settings, using default:', startingNumber);
      }
    } catch (settingsError) {
      console.warn('⚠️ Could not load starting confirmation number from settings:', settingsError.message);
    }
    
    if (useLocalDev) {
      const localReservations = JSON.parse(localStorage.getItem('local_reservations') || '[]');
      const numericMax = localReservations.reduce((max, r) => {
        const num = parseInt(r.confirmation_number, 10);
        return Number.isFinite(num) && num > max ? num : max;
      }, startingNumber - 1);
      const nextNum = numericMax + 1;
      console.log('🔢 Local dev next confirmation number:', nextNum, '(starting from', startingNumber, ')');
      return nextNum;
    }

    console.log('🔢 About to call setupAPI...');
    await setupAPI();
    console.log('🔢 setupAPI done');
    const client = getSupabaseClient();
    console.log('🔢 Client:', client);
    console.log('🔢 Client.from:', typeof client?.from);
    if (!client) throw new Error('No Supabase client');
    if (!client.from) throw new Error('Client has no .from() method');
    
    // Get recent confirmation numbers and compute numeric max to avoid lexicographic issues
    console.log('🔢 Querying reservations for recent confirmation_number values...');
    const { data, error } = await client
      .from('reservations')
      .select('confirmation_number')
      .order('created_at', { ascending: false })
      .limit(200);
    
    console.log('🔢 Query result - data length:', data?.length || 0, 'error:', error);
    if (error) throw error;
    
    const numericMax = (data || []).reduce((max, row) => {
      const num = parseInt(row.confirmation_number, 10);
      return Number.isFinite(num) && num > max ? num : max;
    }, startingNumber - 1);
    const nextNum = numericMax + 1;
    console.log('🔢 Returning confirmation number:', nextNum, '(starting from', startingNumber, ')');
    return nextNum;
  } catch (error) {
    console.error('❌ Error getting next confirmation number:', error);
    throw error;
  }
}

export async function getNextAccountNumber() {
  try {
    console.log('🔢 Getting next account number from Supabase...');
    await setupAPI();
    const client = getSupabaseClient();
    if (!client) throw new Error('No Supabase client');
    
    // Get the max account number from accounts
    const { data, error } = await client
      .from('accounts')
      .select('account_number')
      .order('account_number', { ascending: false })
      .limit(1);
    
    if (error) throw error;
    
    let nextNum = 30000; // Default starting number
    if (data && data.length > 0 && data[0].account_number) {
      const lastNum = parseInt(data[0].account_number);
      if (!isNaN(lastNum)) {
        nextNum = lastNum + 1;
      }
    }
    
    return nextNum;
  } catch (error) {
    console.error('Error getting next account number:', error);
    // Fall back to 5-digit number in 30000 range
    return 30000 + (Date.now() % 10000);
  }
}

// ========================================
// INITIALIZATION CHECK
// ========================================

export async function checkConnection() {
  try {
    await setupAPI();
    const client = getSupabaseClient();
    if (!client) {
      throw new Error('Supabase client not initialized');
    }
    
    // Quick test query
    const { error } = await client.from('organizations').select('id').limit(1);
    if (error) throw error;
    
    console.log('✅ Supabase connection verified');
    return true;
  } catch (error) {
    console.error('❌ Supabase connection failed:', error);
    alert('⚠️ DATABASE CONNECTION FAILED\n\nPlease check your internet connection and reload the page.');
    return false;
  }
}

// Default export for compatibility
export default {
  saveReservation,
  getAllReservations,
  getReservationById,
  saveAccount,
  getAllAccounts,
  getAccountById,
  searchAccounts,
  searchAccountsByCompany,
  searchPassengers,
  searchBookingAgents,
  deleteAccount,
  saveDriver,
  getAllDrivers,
  deleteDriver,
  saveAffiliate,
  getAllAffiliates,
  deleteAffiliate,
  saveVehicleType,
  getAllVehicleTypes,
  savePassenger,
  getAllPassengers,
  saveBookingAgent,
  getAllBookingAgents,
  saveAccountAddress,
  getAccountAddresses,
  getNextConfirmationNumber,
  generateUniqueConfirmationNumber,
  checkConfirmationNumberExists,
  getNextAccountNumber,
  checkConnection
};
