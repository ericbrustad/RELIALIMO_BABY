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
  saveCustomerAddress
} from './api-service.js';

// Get organization_id from ENV config
function getOrganizationId() {
  if (typeof window !== 'undefined' && window.ENV) {
    return window.ENV.ORGANIZATION_ID || window.ENV.SUPABASE_ORGANIZATION_ID || window.ENV.ORG_ID || null;
  }
  return null;
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
  
  // Always use Supabase for reservations (removed localhost bypass)
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

// Delete reservation by id or confirmation number
export async function deleteReservation(reservationIdOrConf) {
  console.log('🗑️ deleteReservation called with:', reservationIdOrConf);
  
  // Clear ALL localStorage caches (dev_reservations and local_reservations)
  try {
    // Clear dev_reservations
    const devReservations = JSON.parse(localStorage.getItem('dev_reservations') || '[]');
    const cleanedDev = devReservations.filter(r => 
      r.id !== reservationIdOrConf && 
      r.confirmation_number !== reservationIdOrConf
    );
    localStorage.setItem('dev_reservations', JSON.stringify(cleanedDev));
    console.log(`🗑️ Cleaned dev_reservations: ${devReservations.length} → ${cleanedDev.length}`);
    
    // Clear local_reservations
    const localReservations = JSON.parse(localStorage.getItem('local_reservations') || '[]');
    const cleanedLocal = localReservations.filter(r => 
      r.id !== reservationIdOrConf && 
      r.confirmation_number !== reservationIdOrConf
    );
    localStorage.setItem('local_reservations', JSON.stringify(cleanedLocal));
    console.log(`🗑️ Cleaned local_reservations: ${localReservations.length} → ${cleanedLocal.length}`);
    
    // Also clear relia_reservations if it exists
    const reliaReservations = JSON.parse(localStorage.getItem('relia_reservations') || '[]');
    if (reliaReservations.length) {
      const cleanedRelia = reliaReservations.filter(r => 
        r.id !== reservationIdOrConf && 
        r.confirmation_number !== reservationIdOrConf
      );
      localStorage.setItem('relia_reservations', JSON.stringify(cleanedRelia));
      console.log(`🗑️ Cleaned relia_reservations: ${reliaReservations.length} → ${cleanedRelia.length}`);
    }
  } catch (e) {
    console.warn('⚠️ Failed to prune local reservations:', e);
  }

  try {
    await setupAPI();
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not initialized');

    // Try deleting by ID first (works for UUIDs)
    let data = null;
    let deleteError = null;
    
    // Attempt delete by ID
    const { data: dataById, error: errorById } = await client
      .from('reservations')
      .delete()
      .eq('id', reservationIdOrConf)
      .select();
    
    if (!errorById && dataById && dataById.length > 0) {
      data = dataById;
      console.log('🗑️ Deleted by ID:', data);
    } else {
      // If not found by ID, try by confirmation_number
      const { data: dataByConf, error: errorByConf } = await client
        .from('reservations')
        .delete()
        .eq('confirmation_number', reservationIdOrConf)
        .select();
      
      if (!errorByConf && dataByConf && dataByConf.length > 0) {
        data = dataByConf;
        console.log('🗑️ Deleted by confirmation_number:', data);
      } else {
        deleteError = errorById || errorByConf;
        console.log('⚠️ Reservation not found in Supabase (may have been dev-only)');
      }
    }

    if (data && data.length > 0) {
      logSuccess('Reservation deleted from Supabase', data);
      // Sync confirmation counter after successful delete
      syncConfirmationCounterFromDB().catch(() => {});
    } else {
      console.log('ℹ️ Reservation was not in Supabase (local-only or already deleted)');
    }
    
    return data || [];
  } catch (error) {
    console.error('❌ deleteReservation error:', error);
    // Don't show error dialog if it's just "not found" - we already cleared local cache
    if (error.message?.includes('not found') || error.code === 'PGRST116') {
      console.log('ℹ️ Reservation was local-only, cleared from cache');
      return [];
    }
    return showDatabaseError('Delete Reservation', error);
  }
}

export async function getAllReservations() {
  try {
    // Always try to fetch from Supabase first
    await setupAPI();
    const supabaseResult = await fetchReservations();
    
    // Sync confirmation counter in background
    syncConfirmationCounterFromDB().catch(() => {});
    
    // Collect any local-only reservations that aren't in Supabase
    const localReservations = [];
    
    // Check dev_reservations
    try {
      const devData = JSON.parse(localStorage.getItem('dev_reservations') || '[]');
      if (Array.isArray(devData) && devData.length) {
        localReservations.push(...devData);
      }
    } catch (e) {
      console.warn('⚠️ Failed to read dev_reservations:', e);
    }
    
    // fetchReservations already merges local_reservations, so we only need to merge dev_reservations
    // Deduplicate by id or confirmation_number
    const supabaseData = supabaseResult || [];
    const supabaseIds = new Set(supabaseData.map(r => r.id));
    const supabaseConfNumbers = new Set(supabaseData.map(r => r.confirmation_number));
    
    // Only add local reservations that aren't already in Supabase result
    const uniqueLocalOnly = localReservations.filter(r => 
      !supabaseIds.has(r.id) && !supabaseConfNumbers.has(r.confirmation_number)
    );
    
    const allReservations = [...supabaseData, ...uniqueLocalOnly];
    
    if (allReservations.length > 0) {
      logSuccess('Fetched reservations', `${supabaseData.length} Supabase + ${uniqueLocalOnly.length} local-only`);
    }
    
    return allReservations;
  } catch (error) {
    console.error('❌ getAllReservations error:', error);
    
    // Fallback to local storage only if Supabase fails
    try {
      const devData = JSON.parse(localStorage.getItem('dev_reservations') || '[]');
      const localData = JSON.parse(localStorage.getItem('local_reservations') || '[]');
      const combined = [...devData, ...localData];
      console.log('📋 Fallback: loaded from localStorage only:', combined.length);
      return combined;
    } catch (e) {
      console.warn('⚠️ Failed to read local reservations:', e);
    }
    
    showDatabaseError('Fetch Reservations', error);
    return [];
  }
}

export async function getReservationById(reservationId) {
  try {
    await setupAPI();
    const result = await getReservation(reservationId);
    if (result) return result;
  } catch (error) {
    console.warn('⚠️ Supabase lookup failed, checking localStorage:', error.message);
  }
  
  // Fallback: Check localStorage for local-only reservations
  try {
    const devData = JSON.parse(localStorage.getItem('relia_dev_reservations') || '[]');
    const localData = JSON.parse(localStorage.getItem('relia_reservations') || '[]');
    const allLocal = [...devData, ...localData];
    
    // Search by confirmation_number or id
    const found = allLocal.find(r => 
      String(r.confirmation_number) === String(reservationId) ||
      r.id === reservationId
    );
    
    if (found) {
      console.log('✅ Found reservation in localStorage:', reservationId);
      return found;
    }
    
    console.log('⚠️ Reservation not found in Supabase or localStorage:', reservationId);
  } catch (e) {
    console.warn('⚠️ Failed to check localStorage for reservation:', e);
  }
  
  return null;
}

// ========================================
// ACCOUNTS
// ========================================

// Cached accounts for quick lookups/searches
let accountCache = null;

export async function saveAccount(accountData) {
  console.log('📥 supabase-db.saveAccount called with:', accountData?.account_number, 'id:', accountData?.id);
  const isNewAccount = !accountData.id; // No id means new account
  console.log('🆕 isNewAccount:', isNewAccount);
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
    // Invalidate cache so future searches see latest data
    accountCache = null;
    
    // Store last used account number for fallback in case of future query failures
    if (isNewAccount && accountData.account_number) {
      try {
        const settingsRaw = localStorage.getItem('relia_company_settings') || '{}';
        const settings = JSON.parse(settingsRaw);
        settings.lastUsedAccountNumber = parseInt(accountData.account_number, 10);
        localStorage.setItem('relia_company_settings', JSON.stringify(settings));
        console.log('📝 Stored lastUsedAccountNumber:', settings.lastUsedAccountNumber);
      } catch (e) {
        console.warn('⚠️ Failed to store lastUsedAccountNumber:', e);
      }
    }
    
    console.log('✅ Account saved successfully. Next account number will be fetched from database.');
    
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

export async function getAccountById(accountId) {
  try {
    // First check cache for speed and local-only records
    const cached = await getCachedAccounts();
    const fromCache = cached.find(a => String(a.id) === String(accountId));
    if (fromCache) return fromCache;

    await setupAPI();
    const client = getSupabaseClient();
    if (!client) throw new Error('No Supabase client');
    
    const { data, error } = await client
      .from('accounts')
      .select('*')
      .eq('id', accountId)
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error getting account by ID:', error);
    return null;
  }
}

async function getCachedAccounts() {
  if (accountCache) return accountCache;
  accountCache = await getAllAccounts();
  return accountCache || [];
}

export async function searchAccounts(query) {
  if (!query || query.length < 2) return [];
  const accounts = await getCachedAccounts();
  const lower = query.toLowerCase();
  const digits = query.replace(/\D/g, '');

  return accounts.filter(account => {
    const firstName = (account.first_name || '').toLowerCase();
    const lastName = (account.last_name || '').toLowerCase();
    const fullName = `${firstName} ${lastName}`.trim();
    const company = (account.company_name || '').toLowerCase();
    const phone = (account.phone || '').replace(/\D/g, '');
    const email = (account.email || '').toLowerCase();
    const id = (account.id || '').toString();
    const accountNumber = (account.account_number || '').toString();

    return firstName.startsWith(lower) ||
      lastName.startsWith(lower) ||
      fullName.startsWith(lower) ||
      company.startsWith(lower) ||
      (digits && phone.startsWith(digits)) ||
      email.startsWith(lower) ||
      id.startsWith(lower) ||
      accountNumber.startsWith(lower);
  }).slice(0, 10);
}

export async function searchAccountsByCompany(query) {
  if (!query || query.length < 2) return [];
  const accounts = await getCachedAccounts();
  const lower = query.toLowerCase();
  return accounts.filter(account => {
    const company = (account.company_name || '').toLowerCase();
    return company && company.startsWith(lower);
  }).slice(0, 10);
}

export async function deleteAccount(accountId) {
  console.log('🗑️ deleteAccount called with:', accountId);
  
  // Clear from ALL localStorage caches first
  const keysToClean = ['local_accounts', 'dev_accounts', 'relia_accounts', 'accounts'];
  keysToClean.forEach(key => {
    try {
      const accounts = JSON.parse(localStorage.getItem(key) || '[]');
      const cleaned = accounts.filter(a => 
        a.id !== accountId && 
        a.account_number !== accountId &&
        String(a.id) !== String(accountId) &&
        String(a.account_number) !== String(accountId)
      );
      if (cleaned.length !== accounts.length) {
        localStorage.setItem(key, JSON.stringify(cleaned));
        console.log(`🗑️ Cleaned ${key}: ${accounts.length} → ${cleaned.length}`);
      }
    } catch (e) {
      console.warn(`⚠️ Failed to clean ${key}:`, e);
    }
  });
  
  try {
    await setupAPI();
    
    // Use service role key if available (bypasses RLS)
    const supabaseUrl = window.ENV?.SUPABASE_URL;
    const serviceKey = window.ENV?.SUPABASE_SERVICE_ROLE_KEY;
    
    if (supabaseUrl && serviceKey) {
      console.log('🗑️ Using service role key for delete (bypasses RLS)');
      
      // First get account info
      const getResp = await fetch(
        `${supabaseUrl}/rest/v1/accounts?or=(id.eq.${accountId},account_number.eq.${accountId})&select=id,user_id,email`,
        {
          method: 'GET',
          headers: {
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`
          }
        }
      );
      
      let accountToDelete = null;
      if (getResp.ok) {
        const accounts = await getResp.json();
        if (accounts && accounts.length > 0) {
          accountToDelete = accounts[0];
          console.log('🗑️ Found account to delete:', accountToDelete);
        }
      }
      
      // Delete by ID first
      let deleted = false;
      const deleteByIdResp = await fetch(
        `${supabaseUrl}/rest/v1/accounts?id=eq.${accountId}`,
        {
          method: 'DELETE',
          headers: {
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`,
            'Prefer': 'return=representation'
          }
        }
      );
      
      if (deleteByIdResp.ok) {
        const deletedData = await deleteByIdResp.json();
        if (deletedData && deletedData.length > 0) {
          deleted = true;
          console.log('🗑️ Deleted account by ID:', deletedData);
        }
      }
      
      // If not deleted by ID, try by account_number
      if (!deleted) {
        const deleteByNumResp = await fetch(
          `${supabaseUrl}/rest/v1/accounts?account_number=eq.${accountId}`,
          {
            method: 'DELETE',
            headers: {
              'apikey': serviceKey,
              'Authorization': `Bearer ${serviceKey}`,
              'Prefer': 'return=representation'
            }
          }
        );
        
        if (deleteByNumResp.ok) {
          const deletedData = await deleteByNumResp.json();
          if (deletedData && deletedData.length > 0) {
            deleted = true;
            console.log('🗑️ Deleted account by account_number:', deletedData);
          }
        }
      }
      
      // Try to delete auth user if account had one
      if (accountToDelete?.user_id || accountToDelete?.email) {
        console.log('🗑️ Attempting to delete auth user...');
        try {
          const response = await fetch('/api/delete-auth-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              userId: accountToDelete.user_id,
              email: accountToDelete.email 
            })
          });
          
          if (response.ok) {
            console.log('🗑️ Auth user deleted');
          }
        } catch (authErr) {
          console.warn('⚠️ Auth user deletion failed:', authErr);
        }
      }
      
      accountCache = null;
      
      if (deleted) {
        logSuccess('Account deleted from Supabase', accountId);
      } else {
        console.log('ℹ️ Account was not in Supabase (may have been local-only)');
      }
      return true;
    }
    
    // Fallback to regular client if no service key
    const client = getSupabaseClient();
    if (!client) throw new Error('No Supabase client');

    // First, get the account to find user_id and email
    let accountToDelete = null;
    const { data: accountData } = await client
      .from('accounts')
      .select('id, user_id, email')
      .or(`id.eq.${accountId},account_number.eq.${accountId}`)
      .single();
    
    if (accountData) {
      accountToDelete = accountData;
      console.log('🗑️ Found account to delete:', accountToDelete);
    }

    // Delete the account record
    let deleted = false;
    const { data: dataById, error: errorById } = await client
      .from('accounts')
      .delete()
      .eq('id', accountId)
      .select();
    
    if (!errorById && dataById && dataById.length > 0) {
      deleted = true;
      console.log('🗑️ Deleted account by ID:', dataById);
    } else {
      // Try by account_number
      const { data: dataByNum, error: errorByNum } = await client
        .from('accounts')
        .delete()
        .eq('account_number', accountId)
        .select();
      
      if (!errorByNum && dataByNum && dataByNum.length > 0) {
        deleted = true;
        console.log('🗑️ Deleted account by account_number:', dataByNum);
      }
    }

    // NOW DELETE THE AUTH USER if account had a user_id
    if (accountToDelete?.user_id || accountToDelete?.email) {
      console.log('🗑️ Attempting to delete auth user...');
      try {
        const response = await fetch('/api/delete-auth-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            userId: accountToDelete.user_id,
            email: accountToDelete.email 
          })
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log('🗑️ Auth user deleted:', result);
        } else {
          const errorText = await response.text();
          console.warn('⚠️ Failed to delete auth user:', errorText);
        }
      } catch (authErr) {
        console.warn('⚠️ Auth user deletion failed:', authErr);
        // Don't fail the whole operation if auth deletion fails
      }
    }

    accountCache = null; // Invalidate cache so lists/searches refresh
    
    if (deleted) {
      logSuccess('Account deleted from Supabase', accountId);
    } else {
      console.log('ℹ️ Account was not in Supabase (local-only or already deleted)');
    }
    return true;
  } catch (error) {
    console.error('❌ deleteAccount error:', error);
    // Don't show error if just "not found" - we already cleared local cache
    if (error.message?.includes('not found') || error.code === 'PGRST116') {
      console.log('ℹ️ Account was local-only, cleared from cache');
      return true;
    }
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

/**
 * Normalize address string for duplicate comparison
 * Removes extra spaces, converts to lowercase, strips common variations
 */
function normalizeAddress(addr) {
  if (!addr) return '';
  return addr
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,#]/g, '')
    .replace(/\bstreet\b/g, 'st')
    .replace(/\bavenue\b/g, 'ave')
    .replace(/\bboulevard\b/g, 'blvd')
    .replace(/\bdrive\b/g, 'dr')
    .replace(/\broad\b/g, 'rd')
    .replace(/\blane\b/g, 'ln')
    .replace(/\bcourt\b/g, 'ct')
    .replace(/\bplace\b/g, 'pl')
    .replace(/\bapartment\b/g, 'apt')
    .replace(/\bsuite\b/g, 'ste')
    .trim();
}

/**
 * Save account address with duplicate prevention
 * Checks if an address with the same address_line1, city, and state already exists
 * If duplicate found, returns existing record instead of inserting new one
 */
export async function saveAccountAddress(accountId, addressData) {
  try {
    await setupAPI();
    const client = getSupabaseClient();
    if (!client) throw new Error('No Supabase client');
    
    // Skip if no meaningful address data
    if (!addressData.address_line1 || !addressData.city) {
      console.log('⏭️ Skipping address save - missing address_line1 or city');
      return null;
    }
    
    // Check for existing duplicate addresses for this account
    const { data: existingAddresses, error: fetchError } = await client
      .from('account_addresses')
      .select('*')
      .eq('account_id', accountId);
    
    if (fetchError) {
      console.warn('⚠️ Could not check for duplicate addresses:', fetchError);
      // Continue with insert attempt
    } else if (existingAddresses && existingAddresses.length > 0) {
      // Normalize incoming address for comparison
      const normalizedIncoming = {
        address1: normalizeAddress(addressData.address_line1),
        city: normalizeAddress(addressData.city),
        state: normalizeAddress(addressData.state)
      };
      
      // Check each existing address for duplicates
      for (const existing of existingAddresses) {
        const normalizedExisting = {
          address1: normalizeAddress(existing.address_line1),
          city: normalizeAddress(existing.city),
          state: normalizeAddress(existing.state)
        };
        
        // If address1 and city match (state is optional match)
        if (normalizedIncoming.address1 === normalizedExisting.address1 &&
            normalizedIncoming.city === normalizedExisting.city) {
          // Check state if both have it
          if (!normalizedIncoming.state || !normalizedExisting.state ||
              normalizedIncoming.state === normalizedExisting.state) {
            console.log('📍 Duplicate address found, skipping insert:', existing.address_line1);
            
            // Optionally update the location name if provided and different
            if (addressData.address_name && addressData.address_name !== existing.address_name) {
              const { data: updated, error: updateError } = await client
                .from('account_addresses')
                .update({ address_name: addressData.address_name })
                .eq('id', existing.id)
                .select();
              
              if (!updateError && updated) {
                console.log('📝 Updated address name to:', addressData.address_name);
                return updated[0];
              }
            }
            
            return existing; // Return existing record
          }
        }
      }
    }
    
    // No duplicate found, insert new address
    const orgId = getOrganizationId();
    const { data, error } = await client
      .from('account_addresses')
      .insert([{
        account_id: accountId,
        organization_id: orgId,
        address_type: addressData.address_type || 'other',
        address_name: addressData.address_name || addressData.location_name || '',
        address_line1: addressData.address_line1,
        address_line2: addressData.address_line2 || '',
        city: addressData.city,
        state: addressData.state || '',
        zip_code: addressData.zip_code || '',
        country: addressData.country || 'United States',
        latitude: addressData.latitude || null,
        longitude: addressData.longitude || null
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

// Local counter key for background sync
const CONF_COUNTER_KEY = 'relia_confirmation_counter';

/**
 * Get local confirmation counter
 */
function getLocalConfirmationCounter() {
  try {
    const stored = localStorage.getItem(CONF_COUNTER_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      return {
        lastUsed: parseInt(data.lastUsed, 10) || 0,
        syncedAt: data.syncedAt || null
      };
    }
  } catch (e) {
    console.warn('⚠️ Could not read local confirmation counter:', e);
  }
  return { lastUsed: 0, syncedAt: null };
}

/**
 * Update local confirmation counter
 */
function updateLocalConfirmationCounter(lastUsed) {
  try {
    const data = {
      lastUsed: lastUsed,
      syncedAt: new Date().toISOString()
    };
    localStorage.setItem(CONF_COUNTER_KEY, JSON.stringify(data));
    console.log('🔢 Local confirmation counter updated:', lastUsed);
  } catch (e) {
    console.warn('⚠️ Could not update local confirmation counter:', e);
  }
}

/**
 * Reset confirmation counter (call when all reservations are deleted)
 */
export function resetConfirmationCounter() {
  try {
    localStorage.removeItem(CONF_COUNTER_KEY);
    console.log('🔢 Confirmation counter reset');
  } catch (e) {
    console.warn('⚠️ Could not reset confirmation counter:', e);
  }
}

/**
 * Sync confirmation counter from database in background
 * Call this periodically or after operations that might change reservation count
 */
export async function syncConfirmationCounterFromDB() {
  try {
    await setupAPI();
    const client = getSupabaseClient();
    if (!client) return;
    
    const { data, error } = await client
      .from('reservations')
      .select('confirmation_number');
    
    if (error) throw error;
    
    if (!data || data.length === 0) {
      // No reservations - reset counter
      resetConfirmationCounter();
      console.log('🔢 [Sync] No reservations in DB - counter reset');
      return;
    }
    
    const confirmationNumbers = data
      .map(r => parseInt(r.confirmation_number, 10))
      .filter(n => !isNaN(n));
    
    if (confirmationNumbers.length > 0) {
      const maxFromDb = Math.max(...confirmationNumbers);
      updateLocalConfirmationCounter(maxFromDb);
      console.log('🔢 [Sync] Counter synced from DB, max:', maxFromDb);
    }
  } catch (error) {
    console.warn('⚠️ Background confirmation sync failed:', error);
  }
}

export async function getNextConfirmationNumber() {
  console.log('🔢 getNextConfirmationNumber called');
  try {
    // Get company settings for confirmation start number
    const settingsRaw = localStorage.getItem('relia_company_settings');
    const settings = settingsRaw ? JSON.parse(settingsRaw) : {};
    const confirmationStartNumber = parseInt(settings.confirmationStartNumber, 10) || 100000;
    
    // Get local counter first (fast path)
    const localCounter = getLocalConfirmationCounter();
    
    await setupAPI();
    const client = getSupabaseClient();
    if (!client) throw new Error('No Supabase client');
    
    // Get ALL confirmation numbers from database to find max
    const { data, error } = await client
      .from('reservations')
      .select('confirmation_number');
    
    if (error) throw error;
    
    let nextNum;
    let dbMax = 0;
    
    if (data && data.length > 0) {
      // Reservations exist - find the highest and increment
      const confirmationNumbers = data
        .map(r => parseInt(r.confirmation_number, 10))
        .filter(n => !isNaN(n));
      
      if (confirmationNumbers.length > 0) {
        dbMax = Math.max(...confirmationNumbers);
        // Use the higher of DB max or local counter
        const effectiveMax = Math.max(dbMax, localCounter.lastUsed);
        nextNum = effectiveMax + 1;
        console.log('🔢 getNextConfirmationNumber: DB max:', dbMax, ', local counter:', localCounter.lastUsed, '→ next:', nextNum);
      } else {
        // Reservations exist but no valid numbers - use start number
        nextNum = confirmationStartNumber;
        console.log('🔢 getNextConfirmationNumber: No valid confirmation numbers found, starting at:', nextNum);
      }
    } else {
      // No reservations exist - reset counter and use configured start number
      resetConfirmationCounter();
      nextNum = confirmationStartNumber;
      console.log('🔢 getNextConfirmationNumber: No reservations in database, counter reset, starting at:', nextNum);
    }
    
    // Update local counter to track this number (will be saved after successful reservation)
    updateLocalConfirmationCounter(nextNum);
    
    return nextNum;
  } catch (error) {
    console.error('❌ Error getting next confirmation number:', error);
    // Fall back to local counter or start number
    try {
      const localCounter = getLocalConfirmationCounter();
      if (localCounter.lastUsed > 0) {
        const nextFromLocal = localCounter.lastUsed + 1;
        console.log('🔢 Using local counter fallback:', nextFromLocal);
        return nextFromLocal;
      }
      const settingsRaw = localStorage.getItem('relia_company_settings');
      const settings = settingsRaw ? JSON.parse(settingsRaw) : {};
      return parseInt(settings.confirmationStartNumber, 10) || 100000;
    } catch {
      return 100000;
    }
  }
}

async function ensureUniqueConfirmationNumber(client, candidate) {
  let attempts = 0;
  let next = candidate;
  while (attempts < 5) {
    const { data, error } = await client
      .from('reservations')
      .select('id')
      .eq('confirmation_number', next)
      .limit(1);
    if (error) throw error;
    if (!data || data.length === 0) {
      return next;
    }
    next += 1;
    attempts += 1;
  }
  return next;
}

export async function createReservationFromAccount(accountData) {
  await setupAPI();
  const client = getSupabaseClient();
  if (!client) throw new Error('No Supabase client');

  const rawNext = await getNextConfirmationNumber();
  const confirmationNumber = await ensureUniqueConfirmationNumber(client, Number(rawNext) || 100000);

  const now = new Date().toISOString();
  const billingAccount = accountData.account_number || accountData.id || accountData.accountId || '';

  const stub = {
    confirmation_number: confirmationNumber,
    status: 'pending',
    status_detail_code: 'draft',
    status_detail_label: 'Draft',
    status_detail_category: 'pending',
    efarm_status: 'Farm-out Unassigned',
    billing_account: billingAccount,
    passenger_first_name: accountData.first_name || '',
    passenger_last_name: accountData.last_name || '',
    passenger_email: accountData.email || '',
    passenger_phone: accountData.cell_phone || accountData.phone || '',
    created_at: now,
    updated_at: now
  };

  return stub;
}

export async function getNextAccountNumber() {
  try {
    // Get company settings
    const settingsRaw = localStorage.getItem('relia_company_settings');
    const settings = settingsRaw ? JSON.parse(settingsRaw) : {};
    const accountStartNumber = parseInt(settings.accountStartNumber, 10) || 30000;
    
    await setupAPI();
    
    // Use fetchAccounts which we know works, instead of direct Supabase client
    let allAccounts = [];
    try {
      allAccounts = await fetchAccounts() || [];
    } catch (fetchError) {
      console.warn('⚠️ fetchAccounts failed, trying direct client:', fetchError);
      // Fallback to direct client
      const client = getSupabaseClient();
      if (client) {
        const { data, error } = await client
          .from('accounts')
          .select('account_number');
        if (!error && data) {
          allAccounts = data;
        }
      }
    }
    
    let nextNum;
    
    if (allAccounts && allAccounts.length > 0) {
      // Accounts exist - find the highest and increment
      const accountNumbers = allAccounts
        .map(a => parseInt(a.account_number, 10))
        .filter(n => !isNaN(n));
      
      if (accountNumbers.length > 0) {
        const maxFromDb = Math.max(...accountNumbers);
        nextNum = maxFromDb + 1;
        console.log('📊 getNextAccountNumber: Found', accountNumbers.length, 'accounts, max is', maxFromDb, '→ next:', nextNum);
      } else {
        // Accounts exist but no valid numbers - use start number
        nextNum = accountStartNumber;
        console.log('📊 getNextAccountNumber: No valid account numbers found, starting at:', nextNum);
      }
    } else {
      // No accounts exist - use configured start number
      nextNum = accountStartNumber;
      console.log('📊 getNextAccountNumber: No accounts in database, starting at:', nextNum);
    }
    
    return nextNum;
  } catch (error) {
    console.error('Error getting next account number:', error);
    // Fall back - try to get from localStorage cache or use incremented start
    try {
      const settingsRaw = localStorage.getItem('relia_company_settings');
      const settings = settingsRaw ? JSON.parse(settingsRaw) : {};
      const startNum = parseInt(settings.accountStartNumber, 10) || 30000;
      
      // Check if we have a last used number stored
      const lastUsed = parseInt(settings.lastUsedAccountNumber, 10);
      if (!isNaN(lastUsed) && lastUsed >= startNum) {
        return lastUsed + 1;
      }
      
      // Last resort: use start number (may cause conflicts if accounts exist)
      return startNum;
    } catch {
      return 30000;
    }
  }
}

// These functions are no longer needed but kept for compatibility
export function incrementAccountCounter() {
  console.log('ℹ️ incrementAccountCounter called - counter is now managed by database');
}

export function resetAccountCounter() {
  console.log('ℹ️ resetAccountCounter called - counter is now managed by database');
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
  deleteAccount,
  createReservationFromAccount,
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
  deleteReservation,
  saveAccountAddress,
  getAccountAddresses,
  saveCustomerAddressForAccount,
  searchAccounts,
  searchAccountsByCompany,
  getNextConfirmationNumber,
  syncConfirmationCounterFromDB,
  resetConfirmationCounter,
  getNextAccountNumber,
  incrementAccountCounter,
  resetAccountCounter,
  checkConnection
};

/**
 * Save a customer address for an account to the customer_addresses table
 * This is used to make the home address available in the customer portal
 * @param {string} accountId - The account UUID
 * @param {Object} addressData - Address data with full_address, label, address_type, etc.
 * @returns {Promise<Object|null>} - Saved address or null
 */
export async function saveCustomerAddressForAccount(accountId, addressData) {
  try {
    await setupAPI();
    
    // Build full address from components if not provided
    let fullAddress = addressData.full_address;
    if (!fullAddress && addressData.address_line1) {
      const parts = [
        addressData.address_line1,
        addressData.address_line2,
        addressData.city,
        addressData.state,
        addressData.zip || addressData.zip_code
      ].filter(Boolean);
      fullAddress = parts.join(', ');
    }
    
    if (!fullAddress || !fullAddress.trim()) {
      console.log('⏭️ Skipping customer address save - no address data');
      return null;
    }
    
    const result = await saveCustomerAddress({
      account_id: accountId,
      full_address: fullAddress.trim(),
      label: addressData.label || addressData.address_name || 'Home',
      address_type: addressData.address_type || 'home',
      latitude: addressData.latitude || null,
      longitude: addressData.longitude || null,
      is_favorite: addressData.is_favorite !== false // Default to true for home address
    });
    
    if (result) {
      console.log('✅ Customer address saved for account:', accountId, result);
    }
    return result;
  } catch (err) {
    console.error('❌ Failed to save customer address for account:', err);
    return null;
  }
}
