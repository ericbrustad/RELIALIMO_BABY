import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getSupabaseCredentials } from './supabase-config.js';

let supabase;

// Session storage keys (must match supabase-client.js)
const SESSION_STORAGE_KEY = 'supabase_session';
const ACCESS_TOKEN_KEY = 'supabase_access_token';

try {
  const { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY } = getSupabaseCredentials();
  
  // Create Supabase client with proper auth configuration
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: true,        // Enable automatic token refresh (default but explicit)
      persistSession: true,          // Persist session to localStorage
      detectSessionInUrl: true,      // Handle magic link/OAuth callbacks
      storageKey: 'sb-siumiadylwcrkaqsfwkj-auth-token', // SDK storage key
    }
  });
  
  // Listen for auth state changes and sync tokens to our custom storage keys
  // This ensures the REST client (supabase-client.js) always has the latest token
  supabase.auth.onAuthStateChange(async (event, session) => {
    console.log(`🔐 Auth state change: ${event}`);
    
    if (session) {
      // Sync session to our custom storage keys for REST client compatibility
      try {
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
        if (session.access_token) {
          localStorage.setItem(ACCESS_TOKEN_KEY, session.access_token);
        }
        console.log('✅ Session synced to storage');
      } catch (e) {
        console.warn('⚠️ Failed to sync session to storage:', e);
      }
    } else if (event === 'SIGNED_OUT') {
      // Clear custom storage on sign out
      localStorage.removeItem(SESSION_STORAGE_KEY);
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      console.log('🔓 Session cleared from storage');
    }
    
    // Dispatch custom event for other parts of the app
    window.dispatchEvent(new CustomEvent('supabase-session-change', { detail: session }));
  });
  
  console.log('✅ Supabase client initialized with auto-refresh enabled');
  
} catch (error) {
  console.error('Supabase configuration error', error);
  throw error;
}

export class AuthGuard {
  static async checkAuth() {
    const { data } = await supabase.auth.getSession();
    return Boolean(data?.session);
  }

  static async protectPage() {
    const hasSession = await this.checkAuth();

    if (!hasSession) {
      window.location.href = '/auth.html';
      return false;
    }

    return true;
  }

  static async setupAuthListener(callback) {
    return supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        window.location.href = '/auth.html';
      }
      if (typeof callback === 'function') {
        callback(_event, session);
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  AuthGuard.protectPage().catch((error) => console.error('Failed to enforce auth guard', error));
});

export default AuthGuard;
