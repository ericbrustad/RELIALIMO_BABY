import { create } from 'zustand';
import { supabase } from '../config/supabase';
import type { Driver } from '../types';

interface AuthState {
  // State
  driver: Driver | null;
  session: any | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  
  // Actions
  initialize: () => Promise<void>;
  checkAuth: () => Promise<void>; // Alias for initialize
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  updateDriver: (updates: Partial<Driver>) => void;
  clearError: () => void;
  setupAuthListener: () => () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  driver: null,
  session: null,
  isLoading: true,
  isAuthenticated: false,
  error: null,
  
  initialize: async () => {
    try {
      set({ isLoading: true, error: null });
      
      console.log('[Auth] Initializing, checking for existing session...');
      
      // Check for existing session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('[Auth] Session error:', sessionError);
        set({ isLoading: false, isAuthenticated: false });
        return;
      }
      
      if (session?.user) {
        console.log('[Auth] Found existing session for:', session.user.email);
        
        // Fetch driver profile using case-insensitive email match
        const { data: driver, error: driverError } = await supabase
          .from('drivers')
          .select('*')
          .ilike('email', session.user.email || '')
          .maybeSingle();
        
        if (driverError) {
          console.error('[Auth] Driver fetch error:', driverError);
        }
        
        if (driver) {
          console.log('[Auth] Driver profile restored:', driver.first_name);
          set({
            session,
            driver,
            isAuthenticated: true,
            isLoading: false,
          });
          return;
        }
        
        console.log('[Auth] No driver profile found for session email');
        set({ isLoading: false, isAuthenticated: false });
      } else {
        console.log('[Auth] No existing session found');
        set({ isLoading: false, isAuthenticated: false });
      }
    } catch (error) {
      console.error('[Auth] Initialize error:', error);
      set({ isLoading: false, isAuthenticated: false, error: 'Failed to initialize' });
    }
  },
  
  signIn: async (email: string, password: string) => {
    try {
      set({ isLoading: true, error: null });
      
      console.log('[Auth] Attempting sign in for:', email);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        console.error('[Auth] Sign in error:', error);
        set({ isLoading: false, error: error.message });
        return { success: false, error: error.message };
      }
      
      console.log('[Auth] Sign in successful, fetching driver profile...');
      
      if (data.session?.user) {
        // Fetch driver profile - use ilike for case-insensitive match
        const { data: driver, error: driverError } = await supabase
          .from('drivers')
          .select('*')
          .ilike('email', email.toLowerCase())
          .maybeSingle();
        
        console.log('[Auth] Driver query result:', { driver, driverError });
        
        if (driverError) {
          console.error('[Auth] Driver fetch error:', driverError);
          set({ isLoading: false, error: `Database error: ${driverError.message}` });
          await supabase.auth.signOut();
          return { success: false, error: driverError.message };
        }
        
        if (!driver) {
          console.error('[Auth] No driver profile found for email:', email);
          set({ isLoading: false, error: 'No driver profile found for this account. Please contact dispatch.' });
          await supabase.auth.signOut();
          return { success: false, error: 'No driver profile found' };
        }
        
        console.log('[Auth] Driver found:', driver.first_name, driver.last_name);
        
        set({
          session: data.session,
          driver,
          isAuthenticated: true,
          isLoading: false,
        });
        
        return { success: true };
      }
      
      set({ isLoading: false });
      return { success: false, error: 'Sign in failed' };
    } catch (error: any) {
      console.error('[Auth] Sign in exception:', error);
      set({ isLoading: false, error: error.message });
      return { success: false, error: error.message };
    }
  },
  
  signOut: async () => {
    try {
      console.log('[Auth] Signing out...');
      // Clear state first to ensure UI updates immediately
      set({
        driver: null,
        session: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
      // Then sign out from Supabase
      await supabase.auth.signOut();
      console.log('[Auth] Sign out complete');
    } catch (error) {
      console.error('Sign out error:', error);
      // Still clear state even if Supabase sign out fails
      set({
        driver: null,
        session: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },
  
  updateDriver: (updates: Partial<Driver>) => {
    const { driver } = get();
    if (driver) {
      set({ driver: { ...driver, ...updates } });
    }
  },
  
  clearError: () => set({ error: null }),
  
  // Alias for initialize (used by SplashScreen)
  checkAuth: async () => {
    return get().initialize();
  },
  
  // Setup auth state listener for Supabase auth events
  setupAuthListener: () => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[Auth] Auth state changed:', event);
      
      if (event === 'SIGNED_OUT' || !session) {
        console.log('[Auth] User signed out, clearing state');
        set({
          driver: null,
          session: null,
          isAuthenticated: false,
          isLoading: false,
        });
      } else if (event === 'SIGNED_IN' && session?.user) {
        // Handle OAuth callback (e.g., Google sign-in)
        console.log('[Auth] User signed in via OAuth:', session.user.email);
        
        // Fetch driver profile using case-insensitive email match
        const { data: driver, error: driverError } = await supabase
          .from('drivers')
          .select('*')
          .ilike('email', session.user.email || '')
          .maybeSingle();
        
        if (driverError) {
          console.error('[Auth] Driver fetch error:', driverError);
          set({ isLoading: false, error: 'Failed to fetch driver profile' });
          return;
        }
        
        if (driver) {
          console.log('[Auth] Driver profile found:', driver.first_name);
          set({
            session,
            driver,
            isAuthenticated: true,
            isLoading: false,
          });
        } else {
          console.log('[Auth] No driver profile found for OAuth user');
          set({ 
            isLoading: false, 
            isAuthenticated: false,
            error: 'No driver profile found for this account. Please register first.' 
          });
          // Sign out since there's no driver profile
          await supabase.auth.signOut();
        }
      }
    });
    
    // Return cleanup function
    return () => {
      subscription.unsubscribe();
    };
  },
}));
