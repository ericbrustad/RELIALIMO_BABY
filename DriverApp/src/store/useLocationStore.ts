import { create } from 'zustand';
import * as Location from 'expo-location';
import { supabase } from '../config/supabase';
import type { Location as LocationType } from '../types';

// Geofence configuration
const GEOFENCE_RADIUS_METERS = 150; // 150 meters radius for arrival detection
const GEOFENCE_APPROACHING_RADIUS = 500; // 500 meters for "approaching" notification

interface GeofenceState {
  isInsideGeofence: boolean;
  isApproaching: boolean;
  distanceToDestination: number | null;
  destinationCoords: { latitude: number; longitude: number } | null;
}

interface LocationState {
  // State
  currentLocation: LocationType | null;
  location: LocationType | null; // Alias for currentLocation
  isTracking: boolean;
  permissionStatus: Location.PermissionStatus | null;
  error: string | null;
  
  // Geofence state
  geofence: GeofenceState;
  
  // Movement detection
  isMoving: boolean;
  lastMovementTime: number | null;
  
  // Actions
  requestPermissions: () => Promise<boolean>;
  startTracking: (driverId: string) => Promise<void>;
  stopTracking: () => void;
  getCurrentLocation: () => Promise<LocationType | null>;
  updateDriverLocation: (driverId: string, location: LocationType) => Promise<void>;
  
  // Geofence actions
  setDestination: (coords: { latitude: number; longitude: number } | null) => void;
  checkGeofence: (location: LocationType) => void;
  clearGeofence: () => void;
}

// Calculate distance between two coordinates in meters (Haversine formula)
function getDistanceMeters(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

interface LocationState {
  // State
  currentLocation: LocationType | null;
  location: LocationType | null; // Alias for currentLocation
  isTracking: boolean;
  permissionStatus: Location.PermissionStatus | null;
  error: string | null;
  
  // Actions
  requestPermissions: () => Promise<boolean>;
  startTracking: (driverId: string) => Promise<void>;
  stopTracking: () => void;
  getCurrentLocation: () => Promise<LocationType | null>;
  updateDriverLocation: (driverId: string, location: LocationType) => Promise<void>;
}

let locationSubscription: Location.LocationSubscription | null = null;
let updateInterval: NodeJS.Timeout | null = null;

export const useLocationStore = create<LocationState>((set, get) => ({
  currentLocation: null,
  location: null, // Alias for currentLocation
  isTracking: false,
  permissionStatus: null,
  error: null,
  
  // Geofence state
  geofence: {
    isInsideGeofence: false,
    isApproaching: false,
    distanceToDestination: null,
    destinationCoords: null,
  },
  
  // Movement detection
  isMoving: false,
  lastMovementTime: null,
  
  requestPermissions: async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      set({ permissionStatus: status });
      
      if (status !== 'granted') {
        set({ error: 'Location permission denied' });
        return false;
      }
      
      // Also request background permissions for trip tracking
      const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
      if (bgStatus !== 'granted') {
        console.log('Background location permission not granted');
      }
      
      return true;
    } catch (error: any) {
      console.error('Permission request error:', error);
      set({ error: error.message });
      return false;
    }
  },
  
  startTracking: async (driverId: string) => {
    try {
      const { permissionStatus } = get();
      
      if (permissionStatus !== 'granted') {
        const granted = await get().requestPermissions();
        if (!granted) return;
      }
      
      // Stop any existing tracking
      get().stopTracking();
      
      // Start location updates
      locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000, // Update every 5 seconds
          distanceInterval: 10, // Or when moved 10 meters
        },
        (location) => {
          const loc: LocationType = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy ?? undefined,
            heading: location.coords.heading ?? undefined,
            speed: location.coords.speed ?? undefined,
            timestamp: location.timestamp,
          };
          
          set({ currentLocation: loc, location: loc });
          
          // Check geofence on each location update
          get().checkGeofence(loc);
        }
      );
      
      // Update server every 30 seconds
      updateInterval = setInterval(async () => {
        const { currentLocation } = get();
        if (currentLocation) {
          await get().updateDriverLocation(driverId, currentLocation);
        }
      }, 30000);
      
      set({ isTracking: true, error: null });
    } catch (error: any) {
      console.error('Start tracking error:', error);
      set({ error: error.message, isTracking: false });
    }
  },
  
  stopTracking: () => {
    if (locationSubscription) {
      locationSubscription.remove();
      locationSubscription = null;
    }
    
    if (updateInterval) {
      clearInterval(updateInterval);
      updateInterval = null;
    }
    
    set({ isTracking: false });
  },
  
  getCurrentLocation: async () => {
    try {
      const { permissionStatus } = get();
      
      if (permissionStatus !== 'granted') {
        const granted = await get().requestPermissions();
        if (!granted) return null;
      }
      
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      
      const loc: LocationType = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy ?? undefined,
        heading: location.coords.heading ?? undefined,
        speed: location.coords.speed ?? undefined,
        timestamp: location.timestamp,
      };
      
      set({ currentLocation: loc });
      return loc;
    } catch (error: any) {
      console.error('Get location error:', error);
      set({ error: error.message });
      return null;
    }
  },
  
  updateDriverLocation: async (driverId: string, location: LocationType) => {
    try {
      // Update driver_locations table
      const { error } = await supabase
        .from('driver_locations')
        .upsert({
          driver_id: driverId,
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
          heading: location.heading,
          speed: location.speed,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'driver_id',
        });
      
      if (error) {
        console.error('Update location error:', error);
      }
    } catch (error) {
      console.error('Update driver location error:', error);
    }
  },
  
  // Set destination for geofence monitoring
  setDestination: (coords: { latitude: number; longitude: number } | null) => {
    set({
      geofence: {
        ...get().geofence,
        destinationCoords: coords,
        isInsideGeofence: false,
        isApproaching: false,
        distanceToDestination: null,
      },
    });
  },
  
  // Check if current location is within geofence
  checkGeofence: (location: LocationType) => {
    const { geofence, currentLocation } = get();
    const { destinationCoords } = geofence;
    
    if (!destinationCoords) return;
    
    const distance = getDistanceMeters(
      location.latitude, location.longitude,
      destinationCoords.latitude, destinationCoords.longitude
    );
    
    const isInsideGeofence = distance <= GEOFENCE_RADIUS_METERS;
    const isApproaching = distance <= GEOFENCE_APPROACHING_RADIUS && !isInsideGeofence;
    
    // Detect movement (speed > 2 m/s or about 4.5 mph)
    const isMoving = (location.speed ?? 0) > 2;
    
    set({
      geofence: {
        ...geofence,
        isInsideGeofence,
        isApproaching,
        distanceToDestination: Math.round(distance),
      },
      isMoving,
      lastMovementTime: isMoving ? Date.now() : get().lastMovementTime,
    });
  },
  
  // Clear geofence when trip ends
  clearGeofence: () => {
    set({
      geofence: {
        isInsideGeofence: false,
        isApproaching: false,
        distanceToDestination: null,
        destinationCoords: null,
      },
      isMoving: false,
      lastMovementTime: null,
    });
  },
}));
