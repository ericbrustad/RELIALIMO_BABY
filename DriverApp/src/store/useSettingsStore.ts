import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type NavigationApp = 'google' | 'apple' | 'waze';

interface SettingsState {
  // Navigation preferences
  preferredNavigationApp: NavigationApp;
  hasSetNavigationPreference: boolean;
  
  // Theme
  darkMode: boolean;
  
  // Notifications
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  
  // Actions
  setNavigationApp: (app: NavigationApp) => void;
  resetNavigationPreference: () => void;
  setDarkMode: (enabled: boolean) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setVibrationEnabled: (enabled: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      // Defaults
      preferredNavigationApp: 'google',
      hasSetNavigationPreference: false,
      darkMode: true,
      notificationsEnabled: true,
      soundEnabled: true,
      vibrationEnabled: true,
      
      setNavigationApp: (app: NavigationApp) => {
        set({ 
          preferredNavigationApp: app,
          hasSetNavigationPreference: true 
        });
      },
      
      resetNavigationPreference: () => {
        set({ 
          hasSetNavigationPreference: false 
        });
      },
      
      setDarkMode: (enabled: boolean) => {
        set({ darkMode: enabled });
      },
      
      setNotificationsEnabled: (enabled: boolean) => {
        set({ notificationsEnabled: enabled });
      },
      
      setSoundEnabled: (enabled: boolean) => {
        set({ soundEnabled: enabled });
      },
      
      setVibrationEnabled: (enabled: boolean) => {
        set({ vibrationEnabled: enabled });
      },
    }),
    {
      name: 'relialimo-driver-settings',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
