/**
 * App Theme Configuration
 * Matches the existing dark theme from the web driver portal
 */

export const colors = {
  // Primary colors
  primary: '#6366f1', // Indigo
  primaryLight: '#818cf8',
  primaryDark: '#4f46e5',
  
  // Status colors
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  danger: '#ef4444', // Alias for error
  info: '#3b82f6',
  
  // Background colors
  background: '#0f172a', // Main dark background
  surface: '#1e293b', // Card/surface background
  bgDark: '#1a1a2e',
  bgCard: '#16213e',
  bgInput: '#0f3460',
  
  // Text colors
  text: '#ffffff', // Alias for textPrimary
  textPrimary: '#ffffff',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',
  
  // Border colors
  border: '#334155',
  borderLight: '#475569',
  
  // Driver status colors
  statusAvailable: '#22c55e',
  statusEnroute: '#f59e0b',
  statusArrived: '#f97316',
  statusOnboard: '#3b82f6',
  statusOffline: '#6b7280',
  statusBusy: '#ef4444',
  statusCancelled: '#dc3545',
  statusNoShow: '#6c757d',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const borderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
};

export const fontSize = {
  xs: 12,
  sm: 14,
  md: 16, // Alias for base
  base: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const fontWeight = {
  normal: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

export default {
  colors,
  spacing,
  borderRadius,
  fontSize,
  fontWeight,
};
