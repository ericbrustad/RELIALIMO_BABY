/**
 * Type definitions for the Driver App
 */

export interface Driver {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  status?: string;
  driver_status?: DriverStatus;
  vehicle_type?: string;
  created_at?: string;
  updated_at?: string;
}

export type DriverStatus = 
  | 'available' | 'busy' | 'offline'
  | 'getting_ready' | 'enroute' | 'arrived' | 'waiting'
  | 'passenger_onboard' | 'done' | 'completed' | 'cancelled' | 'no_show';

export interface Reservation {
  id: number | string;
  confirmation_number: string;
  pickup_datetime: string;
  pickup_address?: string;
  pickup_location?: string;
  dropoff_address?: string;
  dropoff_location?: string;
  stop1_address?: string;
  stop2_address?: string;
  passenger_name?: string;
  passenger_first_name?: string;
  passenger_last_name?: string;
  passenger_phone?: string;
  passenger_email?: string;
  passenger_count?: number;
  vehicle_type?: string;
  driver_id?: string;
  driver_status?: DriverStatus;
  driver_pay?: number;
  driver_notes?: string;
  special_instructions?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

export interface TripOffer {
  id: string;
  driver_id: string;
  reservation_id: string | number;
  reservation?: Reservation;
  offer_amount?: number;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  expires_at: string;
  created_at: string;
  responded_at?: string;
}

export interface Location {
  latitude: number;
  longitude: number;
  accuracy?: number;
  heading?: number;
  speed?: number;
  timestamp?: number;
}

export const STATUS_META: Record<DriverStatus, { label: string; emoji: string; color: string }> = {
  available: { label: 'Available', emoji: '🟢', color: '#4ade80' },
  busy: { label: 'Busy', emoji: '🟡', color: '#fbbf24' },
  offline: { label: 'Offline', emoji: '⚫', color: '#6b7280' },
  getting_ready: { label: 'Getting Ready', emoji: '🚗', color: '#6366f1' },
  enroute: { label: 'On The Way', emoji: '🛣️', color: '#3b82f6' },
  arrived: { label: 'Arrived', emoji: '📍', color: '#f59e0b' },
  waiting: { label: 'Waiting', emoji: '⏱️', color: '#f59e0b' },
  passenger_onboard: { label: 'Passenger Onboard', emoji: '👤', color: '#10b981' },
  done: { label: 'Complete', emoji: '✅', color: '#22c55e' },
  completed: { label: 'Completed', emoji: '✅', color: '#22c55e' },
  cancelled: { label: 'Cancelled', emoji: '❌', color: '#ef4444' },
  no_show: { label: 'No Show', emoji: '🚫', color: '#ef4444' },
};

export type RootStackParamList = {
  Splash: undefined;
  Auth: undefined;
  Dashboard: undefined;
  TripDetail: { tripId: number | string };
  ActiveTrip: { tripId: number | string };
  Offers: undefined;
  Profile: undefined;
  Settings: undefined;
};
