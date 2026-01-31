/**
 * Theme Context
 * Provides dynamic theming based on user's dark/light mode preference
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useSettingsStore } from '../store/useSettingsStore';
import { lightColors, hybridColors, spacing, fontSize, borderRadius, shadows } from '../config/theme';

// Define the theme type
export interface ThemeColors {
  primary: string;
  primaryDark: string;
  primaryLight: string;
  accent: string;
  background: string;
  surface: string;
  card: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
  border: string;
  divider: string;
  headerBg: string;
  white: string;
  black: string;
  statusBar: 'light' | 'dark';
}

interface ThemeContextType {
  colors: ThemeColors;
  isDark: boolean;
  spacing: typeof spacing;
  fontSize: typeof fontSize;
  borderRadius: typeof borderRadius;
  shadows: typeof shadows;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { darkMode, loadSettings } = useSettingsStore();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    loadSettings().then(() => setIsReady(true));
  }, []);

  // Select colors based on dark mode setting
  const colors = darkMode ? hybridColors : lightColors;

  const value: ThemeContextType = {
    colors: colors as ThemeColors,
    isDark: darkMode,
    spacing,
    fontSize,
    borderRadius,
    shadows,
  };

  // Don't render until settings are loaded to prevent flash
  if (!isReady) {
    return null;
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

// For backward compatibility - returns current theme colors
export function useThemeColors(): ThemeColors {
  const { colors } = useTheme();
  return colors;
}
