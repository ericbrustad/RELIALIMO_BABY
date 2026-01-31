/**
 * Auth Service
 * Handles authentication with Supabase
 */

import { supabase } from '../config/supabase';
import type { Driver } from '../types';

export interface AuthResult {
  success: boolean;
  driver?: Driver;
  error?: string;
}

export interface SignUpData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

/**
 * Sign in with email and password
 */
export async function signIn(
  email: string,
  password: string
): Promise<AuthResult> {
  try {
    console.log('[Auth] Signing in:', email);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('[Auth] Sign in error:', error);
      return { success: false, error: error.message };
    }

    if (!data.session?.user) {
      return { success: false, error: 'No user session' };
    }

    // Fetch driver profile
    const driver = await fetchDriverProfile(data.session.user.email || '');
    
    if (!driver) {
      return { success: false, error: 'Driver profile not found' };
    }

    return { success: true, driver };
  } catch (error: any) {
    console.error('[Auth] Sign in error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Sign up a new driver
 */
export async function signUp(data: SignUpData): Promise<AuthResult> {
  try {
    console.log('[Auth] Signing up:', data.email);

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
    });

    if (authError) {
      console.error('[Auth] Sign up error:', authError);
      return { success: false, error: authError.message };
    }

    if (!authData.user) {
      return { success: false, error: 'Failed to create user' };
    }

    // Create driver profile
    const { data: driver, error: driverError } = await supabase
      .from('drivers')
      .insert({
        id: authData.user.id,
        email: data.email.toLowerCase(),
        first_name: data.firstName,
        last_name: data.lastName,
        phone: data.phone,
        status: 'pending',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (driverError) {
      console.error('[Auth] Driver profile error:', driverError);
      // Clean up: delete auth user if driver profile creation fails
      await supabase.auth.admin.deleteUser(authData.user.id);
      return { success: false, error: 'Failed to create driver profile' };
    }

    return { success: true, driver };
  } catch (error: any) {
    console.error('[Auth] Sign up error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Sign out
 */
export async function signOut(): Promise<void> {
  try {
    console.log('[Auth] Signing out');
    await supabase.auth.signOut();
  } catch (error) {
    console.error('[Auth] Sign out error:', error);
    throw error;
  }
}

/**
 * Check if user is authenticated
 */
export async function checkAuth(): Promise<{ isAuthenticated: boolean; driver?: Driver }> {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user) {
      return { isAuthenticated: false };
    }

    const driver = await fetchDriverProfile(session.user.email || '');
    
    if (!driver) {
      return { isAuthenticated: false };
    }

    return { isAuthenticated: true, driver };
  } catch (error) {
    console.error('[Auth] Check auth error:', error);
    return { isAuthenticated: false };
  }
}

/**
 * Fetch driver profile by email
 */
export async function fetchDriverProfile(email: string): Promise<Driver | null> {
  try {
    const { data, error } = await supabase
      .from('drivers')
      .select('*')
      .ilike('email', email)
      .maybeSingle();

    if (error) {
      console.error('[Auth] Fetch driver error:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('[Auth] Fetch driver error:', error);
    return null;
  }
}

/**
 * Update driver profile
 */
export async function updateDriverProfile(
  driverId: string,
  updates: Partial<Driver>
): Promise<AuthResult> {
  try {
    const { data, error } = await supabase
      .from('drivers')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', driverId)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, driver: data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Update driver status
 */
export async function updateDriverStatus(
  driverId: string,
  status: 'available' | 'busy' | 'offline'
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('drivers')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', driverId);

    return !error;
  } catch (error) {
    console.error('[Auth] Update status error:', error);
    return false;
  }
}

/**
 * Request password reset
 */
export async function requestPasswordReset(email: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Update password
 */
export async function updatePassword(newPassword: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Listen for auth state changes
 */
export function onAuthStateChange(
  callback: (event: string, session: any) => void
): () => void {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(callback);
  return () => subscription.unsubscribe();
}
