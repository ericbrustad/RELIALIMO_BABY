// ============================================
// Customer Auth Service - Centralized Authentication
// Handles login, logout, session management, token refresh
// ============================================

import { getSupabaseCredentials } from '/shared/supabase-config.js';

// ============================================
// Constants
// ============================================
const STORAGE_KEYS = {
  SESSION: 'customer_session',
  CUSTOMER: 'current_customer',
  REMEMBER_ME: 'customer_remember_me',
  REFRESH_TOKEN: 'customer_refresh_token',
  LAST_ACTIVITY: 'customer_last_activity',
  PENDING_VERIFICATIONS: 'pending_verifications'
};

// Auth URLs - always use account.relialimo.com for login
const AUTH_BASE_URL = 'https://account.relialimo.com';
const AUTH_LOGIN_URL = `${AUTH_BASE_URL}/auth`;

// Session timeout: 30 days if "remember me", 24 hours otherwise
const SESSION_TIMEOUT_REMEMBERED = 30 * 24 * 60 * 60 * 1000; // 30 days
const SESSION_TIMEOUT_DEFAULT = 24 * 60 * 60 * 1000; // 24 hours
const TOKEN_REFRESH_BUFFER = 5 * 60 * 1000; // Refresh 5 mins before expiry
const ACTIVITY_CHECK_INTERVAL = 60 * 1000; // Check activity every minute

// ============================================
// Auth State
// ============================================
let authState = {
  isAuthenticated: false,
  session: null,
  customer: null,
  refreshTimer: null,
  activityTimer: null,
  listeners: []
};

// ============================================
// Event System
// ============================================

/**
 * Subscribe to auth state changes
 * @param {Function} callback - Called with { isAuthenticated, customer, event }
 * @returns {Function} Unsubscribe function
 */
export function onAuthStateChange(callback) {
  authState.listeners.push(callback);
  // Immediately call with current state
  callback({
    isAuthenticated: authState.isAuthenticated,
    customer: authState.customer,
    event: 'INITIAL'
  });
  return () => {
    authState.listeners = authState.listeners.filter(l => l !== callback);
  };
}

function notifyListeners(event) {
  authState.listeners.forEach(listener => {
    try {
      listener({
        isAuthenticated: authState.isAuthenticated,
        customer: authState.customer,
        event
      });
    } catch (err) {
      console.error('[AuthService] Listener error:', err);
    }
  });
}

// ============================================
// Session Management
// ============================================

/**
 * Initialize the auth service - call on page load
 */
export async function initAuth() {
  console.log('[AuthService] Initializing...');
  
  try {
    // Load session from storage
    const sessionStr = localStorage.getItem(STORAGE_KEYS.SESSION);
    if (!sessionStr) {
      console.log('[AuthService] No session found');
      notifyListeners('SIGNED_OUT');
      return false;
    }
    
    const session = JSON.parse(sessionStr);
    if (!session?.access_token) {
      console.log('[AuthService] Invalid session');
      await clearAuth();
      return false;
    }
    
    // Check if session is expired
    const expiresAt = session.expires_at * 1000;
    if (expiresAt < Date.now()) {
      console.log('[AuthService] Session expired, attempting refresh...');
      const refreshed = await refreshSession();
      if (!refreshed) {
        await clearAuth();
        return false;
      }
    } else {
      authState.session = session;
    }
    
    // Load customer info
    const customerStr = localStorage.getItem(STORAGE_KEYS.CUSTOMER);
    if (customerStr) {
      authState.customer = JSON.parse(customerStr);
    } else {
      await fetchCustomerInfo();
    }
    
    authState.isAuthenticated = true;
    
    // Setup automatic token refresh
    setupTokenRefresh();
    
    // Setup activity tracking
    setupActivityTracking();
    
    // Update last activity
    updateLastActivity();
    
    notifyListeners('SIGNED_IN');
    console.log('[AuthService] Authenticated as:', authState.customer?.email);
    return true;
    
  } catch (err) {
    console.error('[AuthService] Init error:', err);
    await clearAuth();
    return false;
  }
}

/**
 * Login with email and password
 */
export async function login(email, password, rememberMe = false) {
  console.log('[AuthService] Logging in:', email);
  
  const creds = getSupabaseCredentials();
  
  const response = await fetch(`${creds.url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'apikey': creds.anonKey,
      'Authorization': `Bearer ${creds.anonKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password })
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error_description || data.msg || 'Login failed');
  }
  
  // Store session
  authState.session = data;
  localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(data));
  localStorage.setItem(STORAGE_KEYS.REMEMBER_ME, rememberMe.toString());
  
  if (data.refresh_token) {
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, data.refresh_token);
  }
  
  // Fetch and store customer info
  await fetchCustomerInfo(data.access_token, email);
  
  authState.isAuthenticated = true;
  
  // Setup automatic token refresh
  setupTokenRefresh();
  setupActivityTracking();
  updateLastActivity();
  
  notifyListeners('SIGNED_IN');
  
  return {
    session: authState.session,
    customer: authState.customer
  };
}

/**
 * Register a new account
 */
export async function register(email, password, metadata = {}) {
  console.log('[AuthService] Registering:', email);
  
  const creds = getSupabaseCredentials();
  
  const response = await fetch(`${creds.url}/auth/v1/signup`, {
    method: 'POST',
    headers: {
      'apikey': creds.anonKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email,
      password,
      data: metadata
    })
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error_description || data.msg || 'Registration failed');
  }
  
  return data;
}

/**
 * Logout and clear all auth data
 */
export async function logout(redirectToLogin = true) {
  console.log('[AuthService] Logging out...');
  
  try {
    // Try to revoke token on server
    if (authState.session?.access_token) {
      const creds = getSupabaseCredentials();
      await fetch(`${creds.url}/auth/v1/logout`, {
        method: 'POST',
        headers: {
          'apikey': creds.anonKey,
          'Authorization': `Bearer ${authState.session.access_token}`
        }
      }).catch(() => {}); // Ignore errors
    }
  } catch (err) {
    console.warn('[AuthService] Server logout failed:', err);
  }
  
  await clearAuth();
  
  if (redirectToLogin) {
    window.location.href = AUTH_LOGIN_URL;
  }
}

/**
 * Clear all auth data from storage
 */
async function clearAuth() {
  // Clear timers
  if (authState.refreshTimer) {
    clearTimeout(authState.refreshTimer);
    authState.refreshTimer = null;
  }
  if (authState.activityTimer) {
    clearInterval(authState.activityTimer);
    authState.activityTimer = null;
  }
  
  // Clear storage
  Object.values(STORAGE_KEYS).forEach(key => {
    localStorage.removeItem(key);
  });
  
  // Reset state
  authState.isAuthenticated = false;
  authState.session = null;
  authState.customer = null;
  
  notifyListeners('SIGNED_OUT');
}

/**
 * Refresh the access token using refresh token
 */
async function refreshSession() {
  const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN) || 
                       authState.session?.refresh_token;
  
  if (!refreshToken) {
    console.log('[AuthService] No refresh token available');
    return false;
  }
  
  try {
    const creds = getSupabaseCredentials();
    const response = await fetch(`${creds.url}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: {
        'apikey': creds.anonKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ refresh_token: refreshToken })
    });
    
    if (!response.ok) {
      console.log('[AuthService] Token refresh failed');
      return false;
    }
    
    const data = await response.json();
    
    authState.session = data;
    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(data));
    
    if (data.refresh_token) {
      localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, data.refresh_token);
    }
    
    console.log('[AuthService] Session refreshed');
    notifyListeners('TOKEN_REFRESHED');
    return true;
    
  } catch (err) {
    console.error('[AuthService] Refresh error:', err);
    return false;
  }
}

/**
 * Setup automatic token refresh
 */
function setupTokenRefresh() {
  if (authState.refreshTimer) {
    clearTimeout(authState.refreshTimer);
  }
  
  if (!authState.session?.expires_at) return;
  
  const expiresAt = authState.session.expires_at * 1000;
  const refreshAt = expiresAt - TOKEN_REFRESH_BUFFER;
  const timeUntilRefresh = refreshAt - Date.now();
  
  if (timeUntilRefresh > 0) {
    console.log(`[AuthService] Token refresh scheduled in ${Math.round(timeUntilRefresh / 60000)} minutes`);
    authState.refreshTimer = setTimeout(async () => {
      const success = await refreshSession();
      if (success) {
        setupTokenRefresh(); // Schedule next refresh
      } else {
        await logout();
      }
    }, timeUntilRefresh);
  }
}

// ============================================
// Activity Tracking (Auto-logout on inactivity)
// ============================================

function setupActivityTracking() {
  // Track user activity
  const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
  events.forEach(event => {
    document.addEventListener(event, updateLastActivity, { passive: true });
  });
  
  // Check for inactivity periodically
  if (authState.activityTimer) {
    clearInterval(authState.activityTimer);
  }
  
  authState.activityTimer = setInterval(checkInactivity, ACTIVITY_CHECK_INTERVAL);
}

function updateLastActivity() {
  localStorage.setItem(STORAGE_KEYS.LAST_ACTIVITY, Date.now().toString());
}

function checkInactivity() {
  const rememberMe = localStorage.getItem(STORAGE_KEYS.REMEMBER_ME) === 'true';
  const timeout = rememberMe ? SESSION_TIMEOUT_REMEMBERED : SESSION_TIMEOUT_DEFAULT;
  
  const lastActivity = parseInt(localStorage.getItem(STORAGE_KEYS.LAST_ACTIVITY) || '0');
  const inactive = Date.now() - lastActivity;
  
  if (inactive > timeout) {
    console.log('[AuthService] Session timeout due to inactivity');
    logout();
  }
}

// ============================================
// Customer Data
// ============================================

async function fetchCustomerInfo(accessToken, email) {
  try {
    const creds = getSupabaseCredentials();
    const token = accessToken || authState.session?.access_token;
    const userEmail = email || authState.session?.user?.email;
    
    if (!userEmail) {
      console.warn('[AuthService] No email to fetch customer info');
      return null;
    }
    
    console.log('[AuthService] Fetching customer info for email:', userEmail);
    
    const response = await fetch(
      `${creds.url}/rest/v1/accounts?email=eq.${encodeURIComponent(userEmail.toLowerCase())}&select=*`,
      {
        headers: {
          'apikey': creds.anonKey,
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    if (response.ok) {
      const customers = await response.json();
      console.log('[AuthService] Found customers:', customers?.length, customers);
      if (customers?.length > 0) {
        authState.customer = customers[0];
        console.log('[AuthService] Customer loaded:', {
          id: authState.customer.id,
          email: authState.customer.email,
          first_name: authState.customer.first_name,
          last_name: authState.customer.last_name,
          portal_slug: authState.customer.portal_slug
        });
        localStorage.setItem(STORAGE_KEYS.CUSTOMER, JSON.stringify(authState.customer));
        return authState.customer;
      } else {
        console.warn('[AuthService] No account found in accounts table for email:', userEmail);
        // Auto-create account record if it doesn't exist
        const newCustomer = await createAccountRecord(token, userEmail);
        if (newCustomer) {
          authState.customer = newCustomer;
          localStorage.setItem(STORAGE_KEYS.CUSTOMER, JSON.stringify(authState.customer));
          return authState.customer;
        }
      }
    } else {
      console.error('[AuthService] Failed to fetch accounts:', response.status, await response.text());
    }
    
    return null;
  } catch (err) {
    console.error('[AuthService] Failed to fetch customer info:', err);
    return null;
  }
}

/**
 * Auto-create an account record for a user who authenticated but has no account
 */
async function createAccountRecord(accessToken, email) {
  try {
    const creds = getSupabaseCredentials();
    
    // Customer organization ID for all customer accounts
    const CUSTOMER_ORG_ID = 'c0000000-0000-0000-0000-000000000001';
    
    // Try to get user metadata from auth session (may have first_name, last_name)
    const userMetadata = authState.session?.user?.user_metadata || {};
    const userId = authState.session?.user?.id || null;
    const firstName = userMetadata.first_name || '';
    const lastName = userMetadata.last_name || '';
    
    console.log('[AuthService] Auto-creating account for:', email, { firstName, lastName, userId });
    
    const accountData = {
      organization_id: CUSTOMER_ORG_ID,
      user_id: userId,
      email: email.toLowerCase(),
      first_name: firstName,
      last_name: lastName,
      account_type: 'customer',
      is_active: true,
      created_at: new Date().toISOString()
    };
    
    const createResp = await fetch(`${creds.url}/rest/v1/accounts`, {
      method: 'POST',
      headers: {
        'apikey': creds.anonKey,
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(accountData)
    });
    
    if (createResp.ok) {
      const newAccounts = await createResp.json();
      if (newAccounts?.length > 0) {
        console.log('[AuthService] Auto-created account:', newAccounts[0]);
        return newAccounts[0];
      }
    } else {
      const errorText = await createResp.text();
      console.error('[AuthService] Failed to auto-create account:', createResp.status, errorText);
    }
    
    return null;
  } catch (err) {
    console.error('[AuthService] Error auto-creating account:', err);
    return null;
  }
}

// ============================================
// Password Reset
// ============================================

/**
 * Send password reset email
 */
export async function sendPasswordReset(email) {
  const creds = getSupabaseCredentials();
  
  const response = await fetch(`${creds.url}/auth/v1/recover`, {
    method: 'POST',
    headers: {
      'apikey': creds.anonKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email,
      redirect_to: 'https://account.relialimo.com/reset-password'
    })
  });
  
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error_description || 'Failed to send reset email');
  }
  
  return true;
}

/**
 * Update password (when logged in or with reset token)
 */
export async function updatePassword(newPassword, accessToken) {
  const creds = getSupabaseCredentials();
  const token = accessToken || authState.session?.access_token;
  
  if (!token) {
    throw new Error('No valid session');
  }
  
  const response = await fetch(`${creds.url}/auth/v1/user`, {
    method: 'PUT',
    headers: {
      'apikey': creds.anonKey,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ password: newPassword })
  });
  
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error_description || 'Failed to update password');
  }
  
  return true;
}

// ============================================
// Getters
// ============================================

export function isAuthenticated() {
  return authState.isAuthenticated;
}

export function getSession() {
  return authState.session;
}

export function getCustomer() {
  return authState.customer;
}

export function getAccessToken() {
  return authState.session?.access_token;
}

export function getPortalSlug() {
  if (!authState.customer) return '';
  
  // Use stored portal_slug if available
  if (authState.customer.portal_slug) {
    return authState.customer.portal_slug;
  }
  
  // Generate from name if both first and last name exist
  const firstName = (authState.customer.first_name || '').toLowerCase().trim();
  const lastName = (authState.customer.last_name || '').toLowerCase().trim();
  
  if (firstName && lastName) {
    const slug = `${firstName}_${lastName}`.replace(/[^a-z0-9_]/g, '');
    // Validate slug is not empty or just underscores
    if (slug && slug !== '_' && slug.replace(/_/g, '') !== '') {
      return slug;
    }
  }
  
  return '';
}

// ============================================
// Auth Guard - Redirect if not authenticated
// ============================================

/**
 * Require authentication - redirects to login if not authenticated
 * @param {string} returnUrl - URL to return to after login
 */
export async function requireAuth(returnUrl) {
  const isAuth = await initAuth();
  if (!isAuth) {
    const redirect = returnUrl ? `?redirect=${encodeURIComponent(returnUrl)}` : '';
    window.location.href = `${AUTH_LOGIN_URL}${redirect}`;
    return false;
  }
  return true;
}

/**
 * Redirect if already authenticated (for login page)
 */
export async function redirectIfAuthenticated() {
  const isAuth = await initAuth();
  if (isAuth) {
    const slug = getPortalSlug();
    // If user has a valid slug, go to their portal. Otherwise go to booking page.
    window.location.href = slug ? `/${slug}` : 'https://relialimo.com/book';
    return true;
  }
  return false;
}

// ============================================
// Update Customer Data
// ============================================

export async function updateCustomer(updates) {
  if (!authState.customer?.id) {
    throw new Error('No customer logged in');
  }
  
  const creds = getSupabaseCredentials();
  
  const response = await fetch(
    `${creds.url}/rest/v1/accounts?id=eq.${authState.customer.id}`,
    {
      method: 'PATCH',
      headers: {
        'apikey': creds.anonKey,
        'Authorization': `Bearer ${authState.session.access_token}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(updates)
    }
  );
  
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.message || 'Failed to update profile');
  }
  
  const result = await response.json();
  if (result?.length > 0) {
    authState.customer = result[0];
    localStorage.setItem(STORAGE_KEYS.CUSTOMER, JSON.stringify(authState.customer));
  }
  
  notifyListeners('CUSTOMER_UPDATED');
  return authState.customer;
}

// ============================================
// Export default for convenience
// ============================================

export default {
  initAuth,
  login,
  register,
  logout,
  sendPasswordReset,
  updatePassword,
  isAuthenticated,
  getSession,
  getCustomer,
  getAccessToken,
  getPortalSlug,
  requireAuth,
  redirectIfAuthenticated,
  onAuthStateChange,
  updateCustomer,
  AUTH_LOGIN_URL,
  AUTH_BASE_URL
};
