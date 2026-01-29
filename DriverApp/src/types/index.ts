/**
 * Type definitions for the Driver App
 */

export interface Driver {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  profile_photo?: string;
  status: DriverStatus;
  vehicle_type?: string;
  assigned_vehicle_id?: string;
  organization_id?: string;
  created_at: string;
  updated_at?: string;
}

export type DriverStatus = 
  | 'available'
  | 'getting_ready'
  | 'enroute'
  | 'arrived'
  | 'waiting'
  | 'passenger_onboard'
  | 'done'
  | 'completed'
  | 'busy'
  | 'offline'
  | 'cancelled'
  | 'no_show';

export interface Reservation {
  id: string;
  confirmation_number: string;
  status: string;
  driver_status?: DriverStatus;
  
  // Passenger info
  passenger_name?: string;
  passenger_first_name?: string;
  passenger_last_name?: string;
  passenger_phone?: string;
  passenger_email?: string;
  passenger_count?: number;
  
  // Pickup details
  pickup_datetime: string;
  pickup_address: string;
  pickup_location?: string;
  
  // Dropoff details
  dropoff_address: string;
  dropoff_location?: string;
  
  // Stops
  stop1_address?: string;
  stop2_address?: string;
  stop3_address?: string;
  
  // Vehicle & driver
  vehicle_type?: string;
  assigned_driver_id?: string;
  assigned_driver_name?: string;
  fleet_vehicle_id?: string;
  
  // Pricing
  base_fare?: number;
  driver_pay?: number;
  grand_total?: number;
  gratuity?: number;
  
  // Notes
  special_instructions?: string;
  notes?: string;
  driver_notes?: string;
  
  // Farm-out
  farm_option?: string;
  farmout_status?: string;
  
  // Timestamps
  created_at: string;
  updated_at?: string;
}

export interface TripOffer {
  id: string;
  reservation_id: string;
  driver_id: string;
  offered_at: string;
  expires_at: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  offer_amount?: number;
  reservation?: Reservation;
}

export interface Location {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp?: number;
  heading?: number;
  speed?: number;
}

// Navigation types
export type RootStackParamList = {
  Auth: undefined;
  Login: undefined;
  Register: undefined;
  Main: undefined;
  Dashboard: undefined;
  TripDetail: { tripId: string };
  ActiveTrip: { tripId: string };
  Offers: undefined;
  Profile: undefined;
  Settings: undefined;
};

// Status metadata
export const STATUS_META: Record<DriverStatus, { emoji: string; label: string; color: string }> = {
  available: { emoji: '🟢', label: 'Available', color: '#22c55e' },
  getting_ready: { emoji: '🔵', label: 'Getting Ready', color: '#3b82f6' },
  enroute: { emoji: '🟡', label: 'On the Way', color: '#f59e0b' },
  arrived: { emoji: '🟠', label: 'Arrived', color: '#f97316' },
  waiting: { emoji: '⏳', label: 'Waiting', color: '#f59e0b' },
  passenger_onboard: { emoji: '🚗', label: 'Customer in Car', color: '#3b82f6' },
  done: { emoji: '✅', label: 'Done', color: '#22c55e' },
  completed: { emoji: '🏁', label: 'Completed', color: '#22c55e' },
  busy: { emoji: '🔴', label: 'Busy', color: '#ef4444' },
  offline: { emoji: '⚫', label: 'Offline', color: '#6b7280' },
  cancelled: { emoji: '❌', label: 'Cancelled', color: '#dc3545' },
  no_show: { emoji: '🚫', label: 'No Show', color: '#6c757d' },
};
