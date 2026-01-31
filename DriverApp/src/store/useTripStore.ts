import { create } from 'zustand';
import { supabase } from '../config/supabase';
import type { Reservation, TripOffer, DriverStatus } from '../types';
import { normalizeToAppStatus, normalizeToWebStatus } from '../utils/statusMapping';

interface TripState {
  trips: Reservation[];
  offers: Reservation[];  // Pending farmout offers (reservations with current_offer_driver_id)
  currentTrip: Reservation | null;
  isLoading: boolean;
  error: string | null;
  realtimeSubscription: any | null;
  
  fetchTrips: (driverId: string) => Promise<void>;
  fetchOffers: (driverId: string) => Promise<void>;
  fetchAllDriverData: (driverId: string) => Promise<void>;
  acceptOffer: (reservationId: string | number) => Promise<{ success: boolean; error?: string }>;
  declineOffer: (reservationId: string | number) => Promise<{ success: boolean; error?: string }>;
  updateTripStatus: (tripId: number | string, status: DriverStatus) => Promise<{ success: boolean; error?: string }>;
  setCurrentTrip: (trip: Reservation | null) => void;
  clearError: () => void;
  subscribeToRealtime: (driverId: string) => void;
  unsubscribeFromRealtime: () => void;
}

export const useTripStore = create<TripState>((set, get) => ({
  trips: [],
  offers: [],
  currentTrip: null,
  isLoading: false,
  error: null,
  realtimeSubscription: null,
  
  /**
   * Subscribe to real-time changes for this driver's reservations
   * Listens for updates from admin (web) side and syncs to app
   */
  subscribeToRealtime: (driverId: string) => {
    // Unsubscribe from existing subscription if any
    const existing = get().realtimeSubscription;
    if (existing) {
      supabase.removeChannel(existing);
    }
    
    console.log('[TripStore] Setting up real-time subscription for driver:', driverId);
    
    const channel = supabase
      .channel(`driver-reservations-${driverId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen for INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'reservations',
          filter: `assigned_driver_id=eq.${driverId}`,
        },
        (payload) => {
          console.log('[TripStore] Real-time event:', payload.eventType, payload.new);
          
          if (payload.eventType === 'INSERT') {
            const newTrip = payload.new as any;
            const normalizedStatus = normalizeToAppStatus(newTrip.driver_status || '');
            set(state => ({
              trips: [...state.trips, { ...newTrip, driver_status: normalizedStatus }],
            }));
          } else if (payload.eventType === 'UPDATE') {
            const updatedTrip = payload.new as any;
            const normalizedStatus = normalizeToAppStatus(updatedTrip.driver_status || '');
            set(state => ({
              trips: state.trips.map(t => 
                t.id === updatedTrip.id 
                  ? { ...updatedTrip, driver_status: normalizedStatus }
                  : t
              ),
              // Also update currentTrip if it's the same one
              currentTrip: state.currentTrip?.id === updatedTrip.id 
                ? { ...updatedTrip, driver_status: normalizedStatus }
                : state.currentTrip,
            }));
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as any).id;
            set(state => ({
              trips: state.trips.filter(t => t.id !== deletedId),
              currentTrip: state.currentTrip?.id === deletedId ? null : state.currentTrip,
            }));
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reservations',
          filter: `current_offer_driver_id=eq.${driverId}`,
        },
        (payload) => {
          console.log('[TripStore] Real-time offer event:', payload.eventType, payload.new);
          // Refetch offers when there's a change
          get().fetchOffers(driverId);
        }
      )
      .subscribe((status) => {
        console.log('[TripStore] Real-time subscription status:', status);
      });
    
    set({ realtimeSubscription: channel });
  },
  
  /**
   * Unsubscribe from real-time updates
   */
  unsubscribeFromRealtime: () => {
    const subscription = get().realtimeSubscription;
    if (subscription) {
      console.log('[TripStore] Unsubscribing from real-time updates');
      supabase.removeChannel(subscription);
      set({ realtimeSubscription: null });
    }
  },
  
  /**
   * Fetch all driver data (trips and offers) in one call
   * This is the main method to call on Dashboard load
   */
  fetchAllDriverData: async (driverId: string) => {
    try {
      set({ isLoading: true, error: null });
      const now = new Date();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Fetch reservations where:
      // 1. assigned_driver_id = this driver (assigned trips)
      // 2. current_offer_driver_id = this driver (pending offers)
      const { data, error } = await supabase
        .from('reservations')
        .select('*')
        .or(`assigned_driver_id.eq.${driverId},current_offer_driver_id.eq.${driverId}`)
        .gte('pickup_datetime', today.toISOString())
        .order('pickup_datetime', { ascending: true });
      
      if (error) {
        // Handle schema issues gracefully
        if (error.code === 'PGRST205' || error.code === '42P01' || error.code === '42703') {
          console.log('[TripStore] Schema issue, columns may not exist:', error.message);
          set({ trips: [], offers: [], isLoading: false });
          return;
        }
        throw error;
      }
      
      const allReservations = data || [];
      console.log('[TripStore] Fetched', allReservations.length, 'reservations for driver', driverId);
      
      // Categorize into trips (assigned) and offers (pending)
      const trips: Reservation[] = [];
      const offers: Reservation[] = [];
      
      allReservations.forEach((res: any) => {
        const farmoutStatus = res.farmout_status || '';
        const rawDriverStatus = res.driver_status || '';
        // Normalize the driver_status to our canonical values
        const normalizedStatus = normalizeToAppStatus(rawDriverStatus);
        const isAssigned = res.assigned_driver_id === driverId;
        const isOffered = res.current_offer_driver_id === driverId;
        
        // Check if offer has expired
        if (isOffered && res.current_offer_expires_at) {
          if (new Date(res.current_offer_expires_at) < now) {
            console.log('[TripStore] Skipping expired offer:', res.confirmation_number);
            return;
          }
        }
        
        // Pending offer (offered but not yet accepted)
        if (isOffered && !isAssigned && (farmoutStatus === 'offered' || rawDriverStatus === 'offered')) {
          offers.push({ ...res, driver_status: normalizedStatus });
          console.log('[TripStore] -> OFFER:', res.confirmation_number);
        }
        // Assigned trip
        else if (isAssigned) {
          trips.push({ ...res, driver_status: normalizedStatus });
          console.log('[TripStore] -> TRIP:', res.confirmation_number, 'raw status:', rawDriverStatus, '-> normalized:', normalizedStatus);
        }
      });
      
      set({ trips, offers, isLoading: false });
      console.log('[TripStore] Final: trips=', trips.length, 'offers=', offers.length);
    } catch (error: any) {
      console.error('[TripStore] fetchAllDriverData error:', error);
      set({ trips: [], offers: [], error: error.message, isLoading: false });
    }
  },
  
  /**
   * Fetch only assigned trips for this driver
   */
  fetchTrips: async (driverId: string) => {
    try {
      set({ isLoading: true, error: null });
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { data, error } = await supabase
        .from('reservations')
        .select('*')
        .eq('assigned_driver_id', driverId)
        .gte('pickup_datetime', today.toISOString())
        .order('pickup_datetime', { ascending: true });
      
      if (error) {
        if (error.code === 'PGRST205' || error.code === '42P01' || error.code === '42703') {
          console.log('[TripStore] assigned_driver_id column not found');
          set({ trips: [], isLoading: false });
          return;
        }
        throw error;
      }
      
      set({ trips: data || [], isLoading: false });
    } catch (error: any) {
      console.error('[TripStore] fetchTrips error:', error);
      set({ trips: [], error: error.message, isLoading: false });
    }
  },
  
  /**
   * Fetch pending farmout offers for this driver
   * These are reservations where current_offer_driver_id = driverId and farmout_status = 'offered'
   */
  fetchOffers: async (driverId: string) => {
    try {
      const now = new Date();
      
      const { data, error } = await supabase
        .from('reservations')
        .select('*')
        .eq('current_offer_driver_id', driverId)
        .eq('farmout_status', 'offered')
        .order('pickup_datetime', { ascending: true });
      
      if (error) {
        if (error.code === 'PGRST205' || error.code === '42P01' || error.code === '42703') {
          console.log('[TripStore] Offer columns not found - offers disabled');
          set({ offers: [] });
          return;
        }
        throw error;
      }
      
      // Filter out expired offers
      const validOffers = (data || []).filter((offer: any) => {
        if (offer.current_offer_expires_at) {
          return new Date(offer.current_offer_expires_at) > now;
        }
        return true;
      });
      
      set({ offers: validOffers });
    } catch (error: any) {
      console.error('[TripStore] fetchOffers error:', error);
      set({ offers: [] });
    }
  },
  
  /**
   * Accept a farmout offer
   * Updates the reservation to assign this driver
   */
  acceptOffer: async (reservationId: string | number) => {
    try {
      set({ isLoading: true });
      
      const { error } = await supabase
        .from('reservations')
        .update({
          farmout_status: 'assigned',
          driver_status: 'assigned',
          assigned_driver_id: (await supabase.auth.getUser()).data.user?.id,
          current_offer_driver_id: null,
          current_offer_sent_at: null,
          current_offer_expires_at: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', reservationId);
      
      if (error) throw error;
      
      // Move from offers to trips
      const offer = get().offers.find(o => o.id === reservationId);
      if (offer) {
        set(state => ({
          offers: state.offers.filter(o => o.id !== reservationId),
          trips: [...state.trips, { ...offer, driver_status: 'assigned', farmout_status: 'assigned' }],
          isLoading: false
        }));
      } else {
        set({ isLoading: false });
      }
      
      return { success: true };
    } catch (error: any) {
      console.error('[TripStore] acceptOffer error:', error);
      set({ error: error.message, isLoading: false });
      return { success: false, error: error.message };
    }
  },
  
  /**
   * Decline a farmout offer
   */
  declineOffer: async (reservationId: string | number) => {
    try {
      const { error } = await supabase
        .from('reservations')
        .update({
          farmout_status: 'declined',
          current_offer_driver_id: null,
          current_offer_sent_at: null,
          current_offer_expires_at: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', reservationId);
      
      if (error) throw error;
      
      set(state => ({ offers: state.offers.filter(o => o.id !== reservationId) }));
      return { success: true };
    } catch (error: any) {
      console.error('[TripStore] declineOffer error:', error);
      return { success: false, error: error.message };
    }
  },
  
  /**
   * Update trip status (driver workflow: assigned -> enroute -> arrived -> passenger_onboard -> completed)
   * Also syncs farmout_status to match driver_status for consistency
   */
  updateTripStatus: async (tripId: number | string, status: DriverStatus) => {
    try {
      set({ isLoading: true });
      
      // Convert app status to web/database status (e.g., 'waiting' -> 'waiting_at_pickup')
      const dbStatus = normalizeToWebStatus(status);
      console.log('[TripStore] updateTripStatus:', status, '->', dbStatus);
      
      const updateData: Record<string, any> = { 
        driver_status: dbStatus, 
        updated_at: new Date().toISOString() 
      };
      
      // Sync farmout_status with driver_status for all status changes
      // This ensures the Farmout Reservation view stays in sync
      const farmoutStatusMap: Record<string, string> = {
        'assigned': 'assigned',
        'enroute': 'enroute',
        'arrived': 'arrived',
        'waiting': 'waiting',
        'waiting_at_pickup': 'waiting',
        'passenger_onboard': 'passenger_onboard',
        'done': 'completed',
        'completed': 'completed',
      };
      if (farmoutStatusMap[dbStatus]) {
        updateData.farmout_status = farmoutStatusMap[dbStatus];
      }
      
      // Add timestamp fields based on status
      if (status === 'enroute') updateData.departed_at = new Date().toISOString();
      else if (status === 'arrived') updateData.arrived_at = new Date().toISOString();
      else if (status === 'passenger_onboard') updateData.picked_up_at = new Date().toISOString();
      else if (status === 'done' || status === 'completed') {
        updateData.completed_at = new Date().toISOString();
      }
      
      const { error } = await supabase
        .from('reservations')
        .update(updateData)
        .eq('id', tripId);
      
      if (error) throw error;
      
      set(state => ({
        trips: state.trips.map(t => t.id === tripId ? { ...t, driver_status: status } : t),
        currentTrip: state.currentTrip?.id === tripId ? { ...state.currentTrip, driver_status: status } : state.currentTrip,
        isLoading: false
      }));
      return { success: true };
    } catch (error: any) {
      console.error('[TripStore] updateTripStatus error:', error);
      set({ error: error.message, isLoading: false });
      return { success: false, error: error.message };
    }
  },
  
  setCurrentTrip: (trip) => set({ currentTrip: trip }),
  clearError: () => set({ error: null }),
}));
