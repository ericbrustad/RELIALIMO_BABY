/**
 * App Theme Configuration
 * DriverAnywhere-style light theme with coral accents
 */

export const colors = {
  primary: '#6366f1',    // Indigo
  primaryDark: '#4f46e5',
  primaryLight: '#818cf8',
  background: '#0f172a',  // Dark slate
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
};

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
