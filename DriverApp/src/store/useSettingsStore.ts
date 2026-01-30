import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type NavigationApp = 'google' | 'apple' | 'waze';

interface SettingsState {
  preferredNavigationApp: NavigationApp;
  hasSetNavigationPreference: boolean;
  darkMode: boolean;
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
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
      preferredNavigationApp: 'google',
      hasSetNavigationPreference: false,
      darkMode: true,
      notificationsEnabled: true,
      soundEnabled: true,
      vibrationEnabled: true,
      setNavigationApp: (app) => set({ preferredNavigationApp: app, hasSetNavigationPreference: true }),
      resetNavigationPreference: () => set({ hasSetNavigationPreference: false }),
      setDarkMode: (enabled) => set({ darkMode: enabled }),
      setNotificationsEnabled: (enabled) => set({ notificationsEnabled: enabled }),
      setSoundEnabled: (enabled) => set({ soundEnabled: enabled }),
      setVibrationEnabled: (enabled) => set({ vibrationEnabled: enabled }),
    }),
    { name: 'relialimo-driver-settings', storage: createJSONStorage(() => AsyncStorage) }
  )
);
