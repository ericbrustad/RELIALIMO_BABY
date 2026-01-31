/**
 * Constants
 * App-wide constants and configuration values
 */

// Driver status flow
export const STATUS_FLOW: string[] = [
  'assigned',
  'enroute',
  'arrived',
  'waiting',
  'passenger_onboard',
  'done',
];

// Status that can be updated to
export const UPDATEABLE_STATUSES = {
  assigned: ['enroute', 'cancelled'],
  enroute: ['arrived', 'cancelled'],
  arrived: ['waiting', 'passenger_onboard', 'no_show', 'cancelled'],
  waiting: ['passenger_onboard', 'no_show', 'cancelled'],
  passenger_onboard: ['done'],
  done: [],
  completed: [],
  cancelled: [],
  no_show: [],
} as const;

// Next status in the flow
export const NEXT_STATUS: Record<string, string> = {
  assigned: 'enroute',
  enroute: 'arrived',
  arrived: 'passenger_onboard',
  waiting: 'passenger_onboard',
  passenger_onboard: 'done',
};

// Status button labels
export const STATUS_BUTTON_LABELS: Record<string, string> = {
  assigned: 'Start Trip',
  enroute: 'Arrived at Pickup',
  arrived: 'Passenger Onboard',
  waiting: 'Passenger Onboard',
  passenger_onboard: 'Complete Trip',
};

// Colors
export const COLORS = {
  primary: '#1a365d',
  primaryLight: '#2d4a77',
  secondary: '#c9a227',
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',
  
  background: '#f8fafc',
  surface: '#ffffff',
  text: '#1e293b',
  textSecondary: '#64748b',
  textMuted: '#94a3b8',
  border: '#e2e8f0',
  
  statusAvailable: '#4ade80',
  statusBusy: '#fbbf24',
  statusOffline: '#6b7280',
} as const;

// Spacing
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

// Border radius
export const RADIUS = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

// Typography
export const TYPOGRAPHY = {
  h1: { fontSize: 28, fontWeight: '700' as const },
  h2: { fontSize: 24, fontWeight: '600' as const },
  h3: { fontSize: 20, fontWeight: '600' as const },
  h4: { fontSize: 18, fontWeight: '600' as const },
  body: { fontSize: 16, fontWeight: '400' as const },
  bodySmall: { fontSize: 14, fontWeight: '400' as const },
  caption: { fontSize: 12, fontWeight: '400' as const },
  button: { fontSize: 16, fontWeight: '600' as const },
} as const;

// Geofence settings
export const GEOFENCE = {
  ARRIVAL_RADIUS: 100, // meters
  DROPOFF_RADIUS: 100, // meters
  CHECK_INTERVAL: 30000, // ms
} as const;

// Location tracking settings
export const LOCATION = {
  UPDATE_INTERVAL: 5000, // ms
  DISTANCE_INTERVAL: 10, // meters
  SERVER_UPDATE_INTERVAL: 30000, // ms
} as const;

// Trip offer settings
export const TRIP_OFFER = {
  DEFAULT_EXPIRY_MINUTES: 5,
  WARNING_SECONDS: 60, // Show warning when less than this
} as const;

// App info
export const APP_INFO = {
  name: 'ReliaLimo Driver',
  version: '1.0.0',
  supportEmail: 'support@relialimo.com',
  supportPhone: '1-800-RELIA-LIMO',
} as const;

// API endpoints (if needed beyond Supabase)
export const API = {
  BASE_URL: 'https://relialimo.com',
} as const;
