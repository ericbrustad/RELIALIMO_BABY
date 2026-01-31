/**
 * Location Service
 * Handles GPS tracking, geofencing, and location sharing
 */

import * as Location from 'expo-location';
import { supabase } from '../config/supabase';
import type { Location as LocationType } from '../types';

// Geofence radius in meters
const GEOFENCE_RADIUS = 100;

export interface GeofenceResult {
  isAtPickup: boolean;
  isAtDropoff: boolean;
  distanceToPickup: number | null;
  distanceToDropoff: number | null;
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

/**
 * Get current location once
 */
export async function getCurrentLocation(): Promise<LocationType | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.log('[Location] Permission denied');
      return null;
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy ?? undefined,
      heading: location.coords.heading ?? undefined,
      speed: location.coords.speed ?? undefined,
      timestamp: location.timestamp,
    };
  } catch (error) {
    console.error('[Location] Error getting current location:', error);
    return null;
  }
}

/**
 * Update driver location in database
 */
export async function updateDriverLocation(
  driverId: string,
  location: LocationType
): Promise<boolean> {
  try {
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
      console.error('[Location] Error updating driver location:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[Location] Error updating driver location:', error);
    return false;
  }
}

/**
 * Check if driver is within geofence of a location
 */
export function checkGeofence(
  currentLocation: LocationType,
  targetLat: number,
  targetLon: number,
  radius: number = GEOFENCE_RADIUS
): boolean {
  const distance = calculateDistance(
    currentLocation.latitude,
    currentLocation.longitude,
    targetLat,
    targetLon
  );
  return distance <= radius;
}

/**
 * Geocode an address to coordinates
 */
export async function geocodeAddress(
  address: string
): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const results = await Location.geocodeAsync(address);
    if (results.length > 0) {
      return {
        latitude: results[0].latitude,
        longitude: results[0].longitude,
      };
    }
    return null;
  } catch (error) {
    console.error('[Location] Geocoding error:', error);
    return null;
  }
}

/**
 * Reverse geocode coordinates to address
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<string | null> {
  try {
    const results = await Location.reverseGeocodeAsync({ latitude, longitude });
    if (results.length > 0) {
      const addr = results[0];
      return [addr.streetNumber, addr.street, addr.city, addr.region]
        .filter(Boolean)
        .join(' ');
    }
    return null;
  } catch (error) {
    console.error('[Location] Reverse geocoding error:', error);
    return null;
  }
}

/**
 * Format distance for display
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  const miles = meters / 1609.34;
  return `${miles.toFixed(1)} mi`;
}

/**
 * Get ETA based on distance and average speed
 */
export function getETA(distanceMeters: number, speedMph: number = 30): string {
  const hours = distanceMeters / 1609.34 / speedMph;
  const minutes = Math.round(hours * 60);
  
  if (minutes < 1) return '< 1 min';
  if (minutes < 60) return `${minutes} min`;
  
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hrs}h ${mins}m`;
}
