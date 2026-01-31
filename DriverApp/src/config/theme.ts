/**
 * App Theme Configuration
 * DriverAnywhere-style theme with coral/salmon accents
 * Supports both light and dark modes
 */

// DriverAnywhere-inspired coral/salmon palette
export const driverAnywhereColors = {
  coral: '#FF6B6B',        // Primary coral
  coralDark: '#E85555',    // Darker coral
  coralLight: '#FF8A8A',   // Lighter coral
  salmon: '#FA8072',       // Classic salmon
  teal: '#4ECDC4',         // Accent teal
  navy: '#2C3E50',         // Dark text
  slate: '#34495E',        // Secondary text
};

// Light theme (DriverAnywhere-style)
export const lightColors = {
  primary: '#FF6B6B',      // Coral
  primaryDark: '#E85555',
  primaryLight: '#FF8A8A',
  accent: '#4ECDC4',       // Teal accent
  background: '#F8F9FA',   // Light gray background
  surface: '#FFFFFF',
  card: '#FFFFFF',
  text: '#2C3E50',         // Navy text
  textSecondary: '#7F8C8D',
  textMuted: '#BDC3C7',
  success: '#27AE60',
  warning: '#F39C12',
  danger: '#E74C3C',
  info: '#3498DB',
  border: '#E8E8E8',
  divider: '#ECEFF1',
  headerBg: '#FF6B6B',     // Coral header
  white: '#FFFFFF',
  black: '#000000',
  statusBar: 'dark',
};

// Dark theme (current style)
export const darkColors = {
  primary: '#6366f1',      // Indigo
  primaryDark: '#4f46e5',
  primaryLight: '#818cf8',
  accent: '#22d3ee',       // Cyan accent
  background: '#0f172a',   // Dark slate
  surface: '#1e293b',
  card: '#1e293b',
  text: '#f1f5f9',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#3b82f6',
  border: '#334155',
  divider: '#334155',
  headerBg: '#1e40af',
  white: '#ffffff',
  black: '#000000',
  statusBar: 'light',
};

// Hybrid theme - DriverAnywhere coral with dark background
export const hybridColors = {
  primary: '#FF6B6B',      // Coral from DriverAnywhere
  primaryDark: '#E85555',
  primaryLight: '#FF8A8A',
  accent: '#4ECDC4',       // Teal accent
  background: '#1A1A2E',   // Dark purple background
  surface: '#25254B',
  card: '#2D2D55',
  text: '#FFFFFF',
  textSecondary: '#B8B8D1',
  textMuted: '#6C6C8A',
  success: '#2ECC71',
  warning: '#F1C40F',
  danger: '#E74C3C',
  info: '#3498DB',
  border: '#3D3D66',
  divider: '#3D3D66',
  headerBg: '#FF6B6B',     // Coral header
  white: '#FFFFFF',
  black: '#000000',
  statusBar: 'light',
};

// Default to hybrid (DriverAnywhere coral + dark background)
export const colors = hybridColors;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 };
export const fontSize = { xs: 10, sm: 12, md: 14, lg: 16, xl: 18, xxl: 20, xxxl: 24, display: 32 };
export const borderRadius = { sm: 4, md: 8, lg: 12, xl: 16, full: 9999 };

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
};

export const theme = {
  colors,
  spacing,
  borderRadius,
  fontSize,
  shadows,
};

export default theme;
