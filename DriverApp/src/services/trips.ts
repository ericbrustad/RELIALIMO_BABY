/**
 * Trips Service
 * Handles trip data fetching, status updates, and real-time subscriptions
 */

import { supabase } from '../config/supabase';
import type { Reservation, TripOffer, DriverStatus } from '../types';

export interface TripFilters {
  driverId: string;
  status?: DriverStatus | DriverStatus[];
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
}

/**
 * Fetch trips for a driver with filters
 * Uses assigned_driver_id column (RELIALIMO farmout system)
 */
export async function fetchTrips(filters: TripFilters): Promise<Reservation[]> {
  try {
    let query = supabase
      .from('reservations')
      .select('*')
      .eq('assigned_driver_id', filters.driverId);

    // Date filters
    if (filters.fromDate) {
      query = query.gte('pickup_datetime', filters.fromDate.toISOString());
    }
    if (filters.toDate) {
      query = query.lte('pickup_datetime', filters.toDate.toISOString());
    }

    // Status filter
    if (filters.status) {
      if (Array.isArray(filters.status)) {
        query = query.in('driver_status', filters.status);
      } else {
        query = query.eq('driver_status', filters.status);
      }
    }

    // Limit
    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    query = query.order('pickup_datetime', { ascending: true });

    const { data, error } = await query;

    if (error) {
      // Handle missing column gracefully
      if (error.code === '42703') {
        console.log('[Trips] assigned_driver_id column not found, returning empty');
        return [];
      }
      console.error('[Trips] Error fetching trips:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('[Trips] Error fetching trips:', error);
    throw error;
  }
}

/**
 * Fetch today's trips for a driver
 */
export async function fetchTodaysTrips(driverId: string): Promise<Reservation[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return fetchTrips({
    driverId,
    fromDate: today,
    toDate: tomorrow,
  });
}

/**
 * Fetch upcoming trips for a driver
 */
export async function fetchUpcomingTrips(
  driverId: string,
  limit: number = 10
): Promise<Reservation[]> {
  const now = new Date();

  return fetchTrips({
    driverId,
    fromDate: now,
    limit,
  });
}

/**
 * Fetch a single trip by ID
 */
export async function fetchTripById(tripId: number | string): Promise<Reservation | null> {
  try {
    const { data, error } = await supabase
      .from('reservations')
      .select('*')
      .eq('id', tripId)
      .single();

    if (error) {
      console.error('[Trips] Error fetching trip:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('[Trips] Error fetching trip:', error);
    return null;
  }
}

/**
 * Update trip status
 */
export async function updateTripStatus(
  tripId: number | string,
  status: DriverStatus,
  additionalData?: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
  try {
    const updateData: Record<string, any> = {
      driver_status: status,
      updated_at: new Date().toISOString(),
      ...additionalData,
    };

    // Set timestamps based on status
    switch (status) {
      case 'enroute':
        updateData.departed_at = new Date().toISOString();
        break;
      case 'arrived':
        updateData.arrived_at = new Date().toISOString();
        break;
      case 'passenger_onboard':
        updateData.picked_up_at = new Date().toISOString();
        break;
      case 'done':
      case 'completed':
        updateData.completed_at = new Date().toISOString();
        break;
      case 'no_show':
        updateData.no_show_at = new Date().toISOString();
        break;
      case 'cancelled':
        updateData.cancelled_at = new Date().toISOString();
        break;
    }

    const { error } = await supabase
      .from('reservations')
      .update(updateData)
      .eq('id', tripId);

    if (error) {
      console.error('[Trips] Error updating status:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('[Trips] Error updating status:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Fetch pending trip offers for a driver
 * Uses current_offer_driver_id column (RELIALIMO farmout system)
 */
export async function fetchTripOffers(driverId: string): Promise<Reservation[]> {
  try {
    const now = new Date();
    
    const { data, error } = await supabase
      .from('reservations')
      .select('*')
      .eq('current_offer_driver_id', driverId)
      .eq('farmout_status', 'offered')
      .order('pickup_datetime', { ascending: true });

    if (error) {
      // Handle missing column gracefully
      if (error.code === '42703') {
        console.log('[Trips] current_offer_driver_id column not found, offers disabled');
        return [];
      }
      console.error('[Trips] Error fetching offers:', error);
      throw error;
    }

    // Filter out expired offers
    const validOffers = (data || []).filter((offer: any) => {
      if (offer.current_offer_expires_at) {
        return new Date(offer.current_offer_expires_at) > now;
      }
      return true;
    });

    return validOffers;
  } catch (error) {
    console.error('[Trips] Error fetching offers:', error);
    return [];
  }
}

/**
 * Accept a trip offer
 * Updates reservation to assign this driver (RELIALIMO farmout system)
 */
export async function acceptTripOffer(
  reservationId: string | number,
  driverId: string
): Promise<{ success: boolean; tripId?: number | string; error?: string }> {
  try {
    const { error } = await supabase
      .from('reservations')
      .update({
        farmout_status: 'assigned',
        driver_status: 'assigned',
        assigned_driver_id: driverId,
        current_offer_driver_id: null,
        current_offer_sent_at: null,
        current_offer_expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', reservationId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, tripId: reservationId };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Decline a trip offer
 * Clears the offer from the reservation (RELIALIMO farmout system)
 */
export async function declineTripOffer(
  reservationId: string | number,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('reservations')
      .update({
        farmout_status: 'declined',
        current_offer_driver_id: null,
        current_offer_sent_at: null,
        current_offer_expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', reservationId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Subscribe to real-time trip updates
 * Listens for changes to reservations assigned to this driver
 */
export function subscribeToTripUpdates(
  driverId: string,
  onUpdate: (trip: Reservation) => void
): () => void {
  const subscription = supabase
    .channel(`trips:${driverId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'reservations',
        filter: `assigned_driver_id=eq.${driverId}`,
      },
      (payload) => {
        console.log('[Trips] Real-time update:', payload);
        if (payload.new) {
          onUpdate(payload.new as Reservation);
        }
      }
    )
    .subscribe();

  return () => {
    subscription.unsubscribe();
  };
}

/**
 * Subscribe to new trip offers
 * Listens for reservations where current_offer_driver_id is set to this driver
 */
export function subscribeToOffers(
  driverId: string,
  onNewOffer: (offer: Reservation) => void
): () => void {
  const subscription = supabase
    .channel(`offers:${driverId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'reservations',
        filter: `current_offer_driver_id=eq.${driverId}`,
      },
      async (payload) => {
        console.log('[Trips] Offer update received:', payload);
        
        if (payload.new && (payload.new as any).farmout_status === 'offered') {
          onNewOffer(payload.new as Reservation);
        }
      }
    )
    .subscribe();

  return () => {
    subscription.unsubscribe();
  };
}

/**
 * Get trip history for a driver
 */
export async function fetchTripHistory(
  driverId: string,
  page: number = 1,
  limit: number = 20
): Promise<{ trips: Reservation[]; hasMore: boolean }> {
  try {
    const offset = (page - 1) * limit;

    const { data, error, count } = await supabase
      .from('reservations')
      .select('*', { count: 'exact' })
      .eq('driver_id', driverId)
      .in('driver_status', ['done', 'completed', 'cancelled', 'no_show'])
      .order('pickup_datetime', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw error;
    }

    return {
      trips: data || [],
      hasMore: (count || 0) > offset + limit,
    };
  } catch (error) {
    console.error('[Trips] Error fetching history:', error);
    throw error;
  }
}
