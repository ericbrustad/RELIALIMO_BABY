import { create } from 'zustand';
import { supabase } from '../config/supabase';
import type { Reservation, DriverStatus, TripOffer } from '../types';

interface TripState {
  // State
  trips: Reservation[];
  currentTrip: Reservation | null;
  offers: TripOffer[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  fetchTrips: (driverId: string) => Promise<void>;
  fetchOffers: (driverId: string) => Promise<void>;
  acceptOffer: (offerId: string) => Promise<{ success: boolean; error?: string }>;
  declineOffer: (offerId: string) => Promise<{ success: boolean; error?: string }>;
  updateTripStatus: (tripId: string, status: DriverStatus) => Promise<{ success: boolean; error?: string }>;
  setCurrentTrip: (trip: Reservation | null) => void;
  clearError: () => void;
  refreshTrips: (driverId: string) => Promise<void>;
}

export const useTripStore = create<TripState>((set, get) => ({
  trips: [],
  currentTrip: null,
  offers: [],
  isLoading: false,
  error: null,
  
  fetchTrips: async (driverId: string) => {
    try {
      set({ isLoading: true, error: null });
      
      console.log('[Trips] Fetching trips for driver:', driverId);
      
      // Fetch today's and upcoming trips for this driver
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // First try to get trips assigned to this driver
      let { data, error } = await supabase
        .from('reservations')
        .select('*')
        .eq('assigned_driver_id', driverId)
        .gte('pickup_datetime', today.toISOString())
        .order('pickup_datetime', { ascending: true })
        .limit(50);
      
      if (error) {
        console.error('[Trips] Fetch error:', error);
        set({ isLoading: false, error: error.message });
        return;
      }
      
      console.log('[Trips] Found', data?.length || 0, 'assigned trips');
      
      // If no trips assigned, show unassigned trips as "available" (for demo/testing)
      if (!data || data.length === 0) {
        console.log('[Trips] No assigned trips, fetching available trips for demo...');
        const { data: availableTrips, error: availableError } = await supabase
          .from('reservations')
          .select('*')
          .gte('pickup_datetime', today.toISOString())
          .is('assigned_driver_id', null)
          .order('pickup_datetime', { ascending: true })
          .limit(10);
        
        if (!availableError && availableTrips && availableTrips.length > 0) {
          console.log('[Trips] Found', availableTrips.length, 'available/unassigned trips');
          // Mark these as offers
          data = availableTrips.map(t => ({ ...t, driver_status: 'offered' }));
        }
      }
      
      set({ trips: data || [], isLoading: false });
    } catch (error: any) {
      console.error('[Trips] Fetch error:', error);
      set({ isLoading: false, error: error.message });
    }
  },
  
  fetchOffers: async (driverId: string) => {
    try {
      const { data, error } = await supabase
        .from('trip_offers')
        .select(`
          *,
          reservation:reservations(*)
        `)
        .eq('driver_id', driverId)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .order('offered_at', { ascending: true });
      
      if (error) {
        console.error('Fetch offers error:', error);
        return;
      }
      
      set({ offers: data || [] });
    } catch (error) {
      console.error('Fetch offers error:', error);
    }
  },
  
  acceptOffer: async (offerId: string) => {
    try {
      set({ isLoading: true });
      
      const { error } = await supabase
        .from('trip_offers')
        .update({ status: 'accepted' })
        .eq('id', offerId);
      
      if (error) {
        set({ isLoading: false, error: error.message });
        return { success: false, error: error.message };
      }
      
      // Refresh offers
      const { offers } = get();
      set({
        offers: offers.filter(o => o.id !== offerId),
        isLoading: false,
      });
      
      return { success: true };
    } catch (error: any) {
      set({ isLoading: false, error: error.message });
      return { success: false, error: error.message };
    }
  },
  
  declineOffer: async (offerId: string) => {
    try {
      const { error } = await supabase
        .from('trip_offers')
        .update({ status: 'declined' })
        .eq('id', offerId);
      
      if (error) {
        return { success: false, error: error.message };
      }
      
      const { offers } = get();
      set({ offers: offers.filter(o => o.id !== offerId) });
      
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
  
  updateTripStatus: async (tripId: string, status: DriverStatus) => {
    try {
      set({ isLoading: true });
      
      const updateData: any = {
        driver_status: status,
        updated_at: new Date().toISOString(),
      };
      
      // Add timestamp fields based on status
      const now = new Date().toISOString();
      switch (status) {
        case 'enroute':
          updateData.enroute_time = now;
          break;
        case 'arrived':
          updateData.arrived_time = now;
          break;
        case 'passenger_onboard':
          updateData.passenger_onboard_time = now;
          updateData.status = 'in_progress';
          break;
        case 'done':
        case 'completed':
          updateData.completed_time = now;
          updateData.status = 'completed';
          break;
        case 'cancelled':
          updateData.status = 'cancelled';
          break;
        case 'no_show':
          updateData.status = 'no_show';
          break;
      }
      
      const { error } = await supabase
        .from('reservations')
        .update(updateData)
        .eq('id', tripId);
      
      if (error) {
        set({ isLoading: false, error: error.message });
        return { success: false, error: error.message };
      }
      
      // Update local state
      const { trips, currentTrip } = get();
      const updatedTrips = trips.map(t =>
        t.id === tripId ? { ...t, driver_status: status, ...updateData } : t
      );
      
      set({
        trips: updatedTrips,
        currentTrip: currentTrip?.id === tripId
          ? { ...currentTrip, driver_status: status, ...updateData }
          : currentTrip,
        isLoading: false,
      });
      
      return { success: true };
    } catch (error: any) {
      set({ isLoading: false, error: error.message });
      return { success: false, error: error.message };
    }
  },
  
  setCurrentTrip: (trip: Reservation | null) => {
    set({ currentTrip: trip });
  },
  
  clearError: () => set({ error: null }),
  
  refreshTrips: async (driverId: string) => {
    await get().fetchTrips(driverId);
    await get().fetchOffers(driverId);
  },
}));
