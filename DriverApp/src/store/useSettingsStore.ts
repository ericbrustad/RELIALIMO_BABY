/**
 * Settings Store
 * Manages app settings including navigation preferences
 */

import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export type NavigationApp = 'google' | 'apple' | 'waze' | 'default';

interface SettingsState {
  preferredNavigationApp: NavigationApp;
  preferredNavApp: NavigationApp; // Alias for preferredNavigationApp
  hasSetNavigationPreference: boolean;
  darkMode: boolean;
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  
  // Actions
  setNavigationApp: (app: NavigationApp) => Promise<void>;
  setPreferredNavApp: (app: NavigationApp) => Promise<void>; // Alias
  resetNavigationPreference: () => Promise<void>;
  setDarkMode: (enabled: boolean) => Promise<void>;
  toggleDarkMode: () => Promise<void>;
  setNotificationsEnabled: (enabled: boolean) => Promise<void>;
  setSoundEnabled: (enabled: boolean) => Promise<void>;
  setVibrationEnabled: (enabled: boolean) => Promise<void>;
  loadSettings: () => Promise<void>;
}

const STORAGE_KEY = 'driver_app_settings';

// Storage helper
const storage = {
  get: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    }
    return SecureStore.getItemAsync(key);
  },
  set: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  preferredNavigationApp: 'default',
  get preferredNavApp() { return get().preferredNavigationApp; }, // Alias getter
  hasSetNavigationPreference: false,
  darkMode: true, // Default to dark mode
  notificationsEnabled: true,
  soundEnabled: true,
  vibrationEnabled: true,
  
  setNavigationApp: async (app: NavigationApp) => {
    set({ preferredNavigationApp: app, hasSetNavigationPreference: true });
    await saveSettings(get());
  },
  
  setPreferredNavApp: async (app: NavigationApp) => {
    // Alias for setNavigationApp
    set({ preferredNavigationApp: app, hasSetNavigationPreference: true });
    await saveSettings(get());
  },
  
  resetNavigationPreference: async () => {
    set({ preferredNavigationApp: 'default', hasSetNavigationPreference: false });
    await saveSettings(get());
  },
  
  setDarkMode: async (enabled: boolean) => {
    set({ darkMode: enabled });
    await saveSettings(get());
  },
  
  toggleDarkMode: async () => {
    const newValue = !get().darkMode;
    set({ darkMode: newValue });
    await saveSettings(get());
  },
  
  setNotificationsEnabled: async (enabled: boolean) => {
    set({ notificationsEnabled: enabled });
    await saveSettings(get());
  },
  
  setSoundEnabled: async (enabled: boolean) => {
    set({ soundEnabled: enabled });
    await saveSettings(get());
  },
  
  setVibrationEnabled: async (enabled: boolean) => {
    set({ vibrationEnabled: enabled });
    await saveSettings(get());
  },
  
  loadSettings: async () => {
    try {
      const data = await storage.get(STORAGE_KEY);
      if (data) {
        const settings = JSON.parse(data);
        set({
          preferredNavigationApp: settings.preferredNavigationApp || 'default',
          hasSetNavigationPreference: settings.hasSetNavigationPreference || false,
          darkMode: settings.darkMode || false,
          notificationsEnabled: settings.notificationsEnabled ?? true,
          soundEnabled: settings.soundEnabled ?? true,
          vibrationEnabled: settings.vibrationEnabled ?? true,
        });
      }
    } catch (error) {
      console.error('[Settings] Error loading settings:', error);
    }
  },
}));

async function saveSettings(state: SettingsState): Promise<void> {
  try {
    const settings = {
      preferredNavigationApp: state.preferredNavigationApp,
      hasSetNavigationPreference: state.hasSetNavigationPreference,
      darkMode: state.darkMode,
      notificationsEnabled: state.notificationsEnabled,
      soundEnabled: state.soundEnabled,
      vibrationEnabled: state.vibrationEnabled,
    };
    await storage.set(STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('[Settings] Error saving settings:', error);
  }
}
