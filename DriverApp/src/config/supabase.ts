/**
 * Supabase Configuration
 * Uses the same Supabase instance as the web app
 */

import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const SUPABASE_URL = 'https://siumiadylwcrkaqsfwkj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpdW1pYWR5bHdjcmthcXNmd2tqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2NjMzMTMsImV4cCI6MjA4MTIzOTMxM30.sSZBsXyOOmIp2eve_SpiUGeIwx3BMoxvY4c7bvE2kKw';

// Custom storage adapter - uses SecureStore on mobile, localStorage on web
const createStorageAdapter = () => {
  if (Platform.OS === 'web') {
    // Web uses localStorage
    return {
      getItem: async (key: string): Promise<string | null> => {
        try {
          return localStorage.getItem(key);
        } catch {
          return null;
        }
      },
      setItem: async (key: string, value: string): Promise<void> => {
        try {
          localStorage.setItem(key, value);
        } catch {
          console.error('localStorage setItem error');
        }
      },
      removeItem: async (key: string): Promise<void> => {
        try {
          localStorage.removeItem(key);
        } catch {
          console.error('localStorage removeItem error');
        }
      },
    };
  }
  
  // Mobile uses SecureStore
  return {
    getItem: async (key: string): Promise<string | null> => {
      try {
        return await SecureStore.getItemAsync(key);
      } catch (error) {
        console.error('SecureStore getItem error:', error);
        return null;
      }
    },
    setItem: async (key: string, value: string): Promise<void> => {
      try {
        await SecureStore.setItemAsync(key, value);
      } catch (error) {
        console.error('SecureStore setItem error:', error);
      }
    },
    removeItem: async (key: string): Promise<void> => {
      try {
        await SecureStore.deleteItemAsync(key);
      } catch (error) {
        console.error('SecureStore removeItem error:', error);
      }
    },
  };
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: createStorageAdapter(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web', // Enable for web to handle OAuth callbacks
  },
});

export { SUPABASE_URL, SUPABASE_ANON_KEY };
