/**
 * Status Mapping Utilities
 * Maps driver_status values between Driver App and Web UI
 * 
 * DRIVER APP STATUSES (canonical):
 * - enroute: Driver is on the way to pickup
 * - arrived: Driver has arrived at pickup location
 * - waiting: Driver is waiting for passenger
 * - passenger_onboard: Passenger is in the car
 * - done: Trip is completed
 * - completed: Trip is completed (alias for done)
 * - cancelled: Trip was cancelled
 * - no_show: Passenger didn't show up
 * 
 * WEB UI may send different status names that need to be mapped
 */

import type { DriverStatus } from '../types';

// Map web/database status values to Driver App canonical statuses
export const WEB_TO_APP_STATUS_MAP: Record<string, DriverStatus> = {
  // Direct matches
  'enroute': 'enroute',
  'arrived': 'arrived',
  'waiting': 'waiting',
  'passenger_onboard': 'passenger_onboard',
  'done': 'done',
  'completed': 'completed',
  'cancelled': 'cancelled',
  'no_show': 'no_show',
  
  // En route variations
  'en_route': 'enroute',
  'en-route': 'enroute',
  'driver_en_route': 'enroute',
  'on_the_way': 'enroute',
  'otw': 'enroute',
  
  // Arrived variations
  'driver_arrived': 'arrived',
  'at_pickup': 'arrived',
  'at_location': 'arrived',
  
  // Waiting variations
  'driver_waiting': 'waiting',
  'driver_waiting_at_pickup': 'waiting',
  'waiting_at_pickup': 'waiting',
  'driver_circling': 'waiting',
  
  // Passenger onboard variations
  'passenger_on_board': 'passenger_onboard',
  'pob': 'passenger_onboard',
  'customer_in_car': 'passenger_onboard',
  'cic': 'passenger_onboard',
  'driving_passenger': 'passenger_onboard',
  
  // Completed variations
  'trip_completed': 'done',
  'trip_complete': 'done',
  'finished': 'done',
  
  // Assigned variations - keep as assigned
  'assigned': 'assigned',
  'confirmed': 'assigned',
  'accepted': 'assigned',
  'ready': 'assigned',
  // In-house farmout (auto-assigned to default driver)
  'in_house_assigned': 'assigned',
  'in_house_farmout': 'assigned',
  
  // No show variations
  'noshow': 'no_show',
  'no-show': 'no_show',
  
  // Cancelled variations
  'canceled': 'cancelled',
  'late_cancel': 'cancelled',
  'late_cancelled': 'cancelled',
  'cancelled_by_affiliate': 'cancelled',
};

// Map Driver App canonical statuses to web-friendly display values
// These are the values that get written to the database
export const APP_TO_WEB_STATUS_MAP: Record<DriverStatus, string> = {
  'available': 'available',
  'busy': 'busy',
  'offline': 'offline',
  'assigned': 'assigned',
  'enroute': 'enroute',
  'arrived': 'arrived',
  'waiting': 'waiting_at_pickup',  // Driver App "waiting" → database "waiting_at_pickup"
  'passenger_onboard': 'passenger_onboard',
  'done': 'completed',
  'completed': 'completed',
  'cancelled': 'cancelled',
  'no_show': 'no_show',
};

/**
 * Normalize a status string from any source to a canonical Driver App status
 */
export function normalizeToAppStatus(status: string | undefined | null): DriverStatus {
  if (!status) return 'assigned';  // Default to assigned for new/unstarted trips
  
  const normalized = status
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  
  const mapped = WEB_TO_APP_STATUS_MAP[normalized];
  if (mapped) return mapped;
  
  // If no direct mapping, try partial matches
  if (normalized.includes('assigned') || normalized.includes('confirm') || normalized.includes('accept')) {
    return 'assigned';
  }
  if (normalized.includes('enroute') || normalized.includes('en_route') || normalized.includes('way')) {
    return 'enroute';
  }
  if (normalized.includes('arrived') || normalized.includes('pickup')) {
    return 'arrived';
  }
  if (normalized.includes('waiting') || normalized.includes('circling')) {
    return 'waiting';
  }
  if (normalized.includes('onboard') || normalized.includes('on_board') || normalized.includes('customer') || normalized.includes('passenger')) {
    return 'passenger_onboard';
  }
  if (normalized.includes('done') || normalized.includes('complete') || normalized.includes('finish')) {
    return 'done';
  }
  if (normalized.includes('cancel')) {
    return 'cancelled';
  }
  if (normalized.includes('no_show') || normalized.includes('noshow')) {
    return 'no_show';
  }
  
  // Default fallback - assigned for unrecognized statuses
  return 'assigned';
}

/**
 * Convert Driver App status to web-compatible status for database updates
 */
export function normalizeToWebStatus(status: DriverStatus): string {
  return APP_TO_WEB_STATUS_MAP[status] || status;
}

/**
 * Get a human-readable label for any status
 */
export function getStatusLabel(status: string | undefined | null): string {
  const appStatus = normalizeToAppStatus(status);
  
  const labels: Record<DriverStatus, string> = {
    'available': 'Available',
    'busy': 'Busy',
    'offline': 'Offline',
    'assigned': 'Assigned',
    'enroute': 'En Route',
    'arrived': 'Arrived',
    'waiting': 'Waiting',
    'passenger_onboard': 'Passenger Onboard',
    'done': 'Complete',
    'completed': 'Completed',
    'cancelled': 'Cancelled',
    'no_show': 'No Show',
  };
  
  return labels[appStatus] || appStatus;
}
