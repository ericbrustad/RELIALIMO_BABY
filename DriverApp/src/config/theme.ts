/**
 * App Theme Configuration
 * DriverAnywhere-style light theme with coral accents
 */

export const colors = {
  // Primary colors - DriverAnywhere coral/red
  primary: '#E85A4F', // Coral red accent
  primaryLight: '#FF7B6F',
  primaryDark: '#D14940',
  
  // Status colors
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#F44336',
  danger: '#F44336',
  info: '#2196F3',
  
  // Background colors
  background: '#f5f5f5', // Light gray background
  surface: '#ffffff', // White surface
  bgDark: '#333333',
  bgCard: '#ffffff',
  bgInput: '#f0f0f0',
  
  // Dark surfaces (for headers)
  headerBg: '#333333',
  cardHeader: '#444444',
  
  // Text colors
  text: '#333333', // Dark text on light bg
  textLight: '#ffffff', // Light text on dark bg
  textPrimary: '#333333',
  textSecondary: '#666666',
  textMuted: '#999999',
  
  // Border colors
  border: '#e0e0e0',
  borderLight: '#eeeeee',
  
  // Driver status colors
  statusAvailable: '#4CAF50',
  statusEnroute: '#FF9800',
  statusArrived: '#E85A4F',
  statusOnboard: '#2196F3',
  statusOffline: '#9E9E9E',
  statusBusy: '#F44336',
  statusCancelled: '#F44336',
  statusNoShow: '#757575',
  
  // Additional
  white: '#ffffff',
  black: '#000000',
  
  // Tab colors
  tabActive: '#E85A4F',
  tabInactive: '#666666',
  
  // Navigation theme aliases
  card: '#ffffff',
  notification: '#E85A4F',
  md: '#999999',
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
