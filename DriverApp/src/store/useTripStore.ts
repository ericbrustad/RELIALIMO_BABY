import { create } from 'zustand';
import { supabase } from '../config/supabase';
import type { Reservation, TripOffer, DriverStatus } from '../types';

interface TripState {
  // State
  trips: Reservation[];
  offers: TripOffer[];
  currentTrip: Reservation | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  fetchTrips: (driverId: string) => Promise<void>;
  fetchOffers: (driverId: string) => Promise<void>;
  acceptOffer: (offerId: string) => Promise<{ success: boolean; error?: string }>;
  declineOffer: (offerId: string) => Promise<{ success: boolean; error?: string }>;
  updateTripStatus: (tripId: number | string, status: DriverStatus) => Promise<{ success: boolean; error?: string }>;
  setCurrentTrip: (trip: Reservation | null) => void;
  clearError: () => void;
}

export const useTripStore = create<TripState>((set, get) => ({
  trips: [],
  offers: [],
  currentTrip: null,
  isLoading: false,
  error: null,
  
  fetchTrips: async (driverId: string) => {
    try {
      set({ isLoading: true, error: null });
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { data, error } = await supabase
        .from('reservations')
        .select('*')
        .eq('driver_id', driverId)
        .gte('pickup_datetime', today.toISOString())
        .order('pickup_datetime', { ascending: true });
      
      if (error) throw error;
      
      set({ trips: data || [], isLoading: false });
    } catch (error: any) {
      console.error('[TripStore] fetchTrips error:', error);
      set({ error: error.message, isLoading: false });
    }
  },
  
  fetchOffers: async (driverId: string) => {
    try {
      set({ isLoading: true, error: null });
      
      const { data, error } = await supabase
        .from('trip_offers')
        .select(`
          *,
          reservation:reservation_id (*)
        `)
        .eq('driver_id', driverId)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      set({ offers: data || [], isLoading: false });
    } catch (error: any) {
      console.error('[TripStore] fetchOffers error:', error);
      set({ error: error.message, isLoading: false });
    }
  },
  
  acceptOffer: async (offerId: string) => {
    try {
      set({ isLoading: true, error: null });
      
      // Update offer status
      const { data: offer, error: offerError } = await supabase
        .from('trip_offers')
        .update({ 
          status: 'accepted',
          responded_at: new Date().toISOString()
        })
        .eq('id', offerId)
        .select('reservation_id')
        .single();
      
      if (offerError) throw offerError;
      
      // Update reservation with driver assignment
      const { error: resError } = await supabase
        .from('reservations')
        .update({ 
          driver_status: 'assigned',
          updated_at: new Date().toISOString()
        })
        .eq('id', offer.reservation_id);
      
      if (resError) throw resError;
      
      // Remove from local offers
      set(state => ({
        offers: state.offers.filter(o => o.id !== offerId),
        isLoading: false
      }));
      
      return { success: true };
    } catch (error: any) {
      console.error('[TripStore] acceptOffer error:', error);
      set({ error: error.message, isLoading: false });
      return { success: false, error: error.message };
    }
  },
  
  declineOffer: async (offerId: string) => {
    try {
      set({ isLoading: true, error: null });
      
      const { error } = await supabase
        .from('trip_offers')
        .update({ 
          status: 'declined',
          responded_at: new Date().toISOString()
        })
        .eq('id', offerId);
      
      if (error) throw error;
      
      // Remove from local offers
      set(state => ({
        offers: state.offers.filter(o => o.id !== offerId),
        isLoading: false
      }));
      
      return { success: true };
    } catch (error: any) {
      console.error('[TripStore] declineOffer error:', error);
      set({ error: error.message, isLoading: false });
      return { success: false, error: error.message };
    }
  },
  
  updateTripStatus: async (tripId: number | string, status: DriverStatus) => {
    try {
      set({ isLoading: true, error: null });
      
      console.log(`[TripStore] Updating trip ${tripId} to status: ${status}`);
      
      const updateData: Record<string, any> = {
        driver_status: status,
        updated_at: new Date().toISOString()
      };
      
      // Add timestamp for specific statuses
      if (status === 'enroute') {
        updateData.departed_at = new Date().toISOString();
      } else if (status === 'arrived') {
        updateData.arrived_at = new Date().toISOString();
      } else if (status === 'passenger_onboard') {
        updateData.picked_up_at = new Date().toISOString();
      } else if (status === 'done' || status === 'completed') {
        updateData.completed_at = new Date().toISOString();
      }
      
      const { error } = await supabase
        .from('reservations')
        .update(updateData)
        .eq('id', tripId);
      
      if (error) throw error;
      
      // Update local state
      set(state => ({
        trips: state.trips.map(t => 
          t.id === tripId ? { ...t, driver_status: status } : t
        ),
        currentTrip: state.currentTrip?.id === tripId 
          ? { ...state.currentTrip, driver_status: status }
          : state.currentTrip,
        isLoading: false
      }));
      
      console.log(`[TripStore] Status updated successfully to: ${status}`);
      return { success: true };
    } catch (error: any) {
      console.error('[TripStore] updateTripStatus error:', error);
      set({ error: error.message, isLoading: false });
      return { success: false, error: error.message };
    }
  },
  
  setCurrentTrip: (trip: Reservation | null) => {
    set({ currentTrip: trip });
  },
  
  clearError: () => set({ error: null }),
}));
