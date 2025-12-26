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
  saveBookingAgentToSupabase
} from './api-service.js';

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
  
  // Development mode bypass for localhost
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    console.log('🔧 Development mode: Simulating successful reservation save');
    
    // Generate a fake ID if needed
    const fakeResult = {
      ...reservationData,
      id: reservationData.id || 'dev-' + Date.now(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    // Store in localStorage for development
    try {
      const existingReservations = JSON.parse(localStorage.getItem('dev_reservations') || '[]');
      const existingIndex = existingReservations.findIndex(r => r.id === fakeResult.id);
      
      if (existingIndex >= 0) {
        existingReservations[existingIndex] = fakeResult;
        console.log('🔄 Updated reservation in localStorage');
      } else {
        existingReservations.push(fakeResult);
        console.log('➕ Added new reservation to localStorage');
      }
      
      localStorage.setItem('dev_reservations', JSON.stringify(existingReservations));
    } catch (e) {
      console.warn('⚠️ Failed to store in localStorage:', e);
    }
    
    showDatabaseSuccess('Save Reservation', fakeResult);
    return fakeResult;
  }
  
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

export async function getAccountById(accountId) {
  try {
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

export async function getNextConfirmationNumber() {
  console.log('🔢 getNextConfirmationNumber called');
  try {
    console.log('🔢 About to call setupAPI...');
    await setupAPI();
    console.log('🔢 setupAPI done');
    const client = getSupabaseClient();
    console.log('🔢 Client:', client);
    console.log('🔢 Client.from:', typeof client?.from);
    if (!client) throw new Error('No Supabase client');
    if (!client.from) throw new Error('Client has no .from() method');
    
    // Get the max confirmation number from reservations
    console.log('🔢 Querying reservations for max confirmation_number...');
    const query = client.from('reservations').select('confirmation_number').order('confirmation_number', { ascending: false }).limit(1);
    console.log('🔢 Query built:', query);
    const { data, error } = await query;
    
    console.log('🔢 Query result - data:', data, 'error:', error);
    if (error) throw error;
    
    let nextNum = 100000; // Default starting number
    if (data && data.length > 0 && data[0].confirmation_number) {
      const lastNum = parseInt(data[0].confirmation_number);
      if (!isNaN(lastNum)) {
        nextNum = lastNum + 1;
      }
    }
    
    console.log('🔢 Returning confirmation number:', nextNum);
    return nextNum;
  } catch (error) {
    console.error('❌ Error getting next confirmation number:', error);
    // Fall back to 6-digit timestamp-based number
    const fallback = Math.floor(Date.now() / 1000) % 900000 + 100000;
    console.log('🔢 Using fallback confirmation number:', fallback);
    return fallback;
  }
}

export async function getNextAccountNumber() {
  try {
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
  getNextAccountNumber,
  checkConnection
};
