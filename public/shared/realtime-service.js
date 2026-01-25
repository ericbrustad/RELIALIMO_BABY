// ============================================
// RELIALIMO Real-Time Service
// Provides real-time updates across all portals using Supabase Realtime
// ============================================

import { getSupabaseCredentials } from './supabase-config.js';

/**
 * Real-time subscription manager for cross-portal synchronization
 */
class RealtimeService {
  constructor() {
    this.supabase = null;
    this.channels = new Map();
    this.listeners = new Map();
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  /**
   * Initialize the Supabase client for realtime
   */
  async init() {
    if (this.supabase) return this.supabase;

    try {
      const creds = getSupabaseCredentials();
      
      // Dynamic import of Supabase client
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
      
      this.supabase = createClient(creds.url, creds.anonKey, {
        realtime: {
          params: {
            eventsPerSecond: 10
          }
        }
      });

      console.log('[Realtime] Service initialized');
      this.isConnected = true;
      return this.supabase;
    } catch (err) {
      console.error('[Realtime] Failed to initialize:', err);
      return null;
    }
  }

  /**
   * Subscribe to reservation changes
   * @param {Function} callback - Called with (eventType, newRecord, oldRecord)
   * @returns {Function} Unsubscribe function
   */
  subscribeToReservations(callback) {
    return this._subscribe('reservations', 'reservations-changes', callback);
  }

  /**
   * Subscribe to driver changes (location, status, availability)
   * @param {Function} callback - Called with (eventType, newRecord, oldRecord)
   * @returns {Function} Unsubscribe function
   */
  subscribeToDrivers(callback) {
    return this._subscribe('drivers', 'drivers-changes', callback);
  }

  /**
   * Subscribe to account/customer changes
   * @param {Function} callback - Called with (eventType, newRecord, oldRecord)
   * @returns {Function} Unsubscribe function
   */
  subscribeToAccounts(callback) {
    return this._subscribe('accounts', 'accounts-changes', callback);
  }

  /**
   * Subscribe to vehicle type changes
   * @param {Function} callback - Called with (eventType, newRecord, oldRecord)
   * @returns {Function} Unsubscribe function
   */
  subscribeToVehicleTypes(callback) {
    return this._subscribe('vehicle_types', 'vehicle-types-changes', callback);
  }

  /**
   * Subscribe to portal settings changes
   * @param {Function} callback - Called with (eventType, newRecord, oldRecord)
   * @returns {Function} Unsubscribe function
   */
  subscribeToPortalSettings(callback) {
    return this._subscribe('portal_settings', 'portal-settings-changes', callback);
  }

  /**
   * Subscribe to a specific reservation by ID
   * @param {string} reservationId - The reservation UUID
   * @param {Function} callback - Called with (eventType, newRecord, oldRecord)
   * @returns {Function} Unsubscribe function
   */
  subscribeToReservation(reservationId, callback) {
    const channelName = `reservation-${reservationId}`;
    return this._subscribe('reservations', channelName, callback, {
      filter: `id=eq.${reservationId}`
    });
  }

  /**
   * Subscribe to reservations for a specific driver
   * @param {string} driverId - The driver UUID
   * @param {Function} callback - Called with (eventType, newRecord, oldRecord)
   * @returns {Function} Unsubscribe function
   */
  subscribeToDriverReservations(driverId, callback) {
    const channelName = `driver-reservations-${driverId}`;
    return this._subscribe('reservations', channelName, callback, {
      filter: `assigned_driver_id=eq.${driverId}`
    });
  }

  /**
   * Subscribe to reservations for a specific account
   * @param {string} accountId - The account UUID
   * @param {Function} callback - Called with (eventType, newRecord, oldRecord)
   * @returns {Function} Unsubscribe function
   */
  subscribeToAccountReservations(accountId, callback) {
    const channelName = `account-reservations-${accountId}`;
    return this._subscribe('reservations', channelName, callback, {
      filter: `account_id=eq.${accountId}`
    });
  }

  /**
   * Internal subscribe method
   * @private
   */
  _subscribe(table, channelName, callback, options = {}) {
    if (!this.supabase) {
      console.warn('[Realtime] Service not initialized. Call init() first.');
      // Auto-init and retry
      this.init().then(() => {
        if (this.supabase) {
          this._subscribe(table, channelName, callback, options);
        }
      });
      return () => {};
    }

    // Check if already subscribed to this channel
    if (this.channels.has(channelName)) {
      // Add callback to existing listeners
      const listeners = this.listeners.get(channelName) || [];
      listeners.push(callback);
      this.listeners.set(channelName, listeners);
      console.log(`[Realtime] Added listener to existing channel: ${channelName}`);
      
      return () => {
        const l = this.listeners.get(channelName) || [];
        const idx = l.indexOf(callback);
        if (idx > -1) l.splice(idx, 1);
      };
    }

    // Create new channel
    let channelConfig = {
      event: '*',
      schema: 'public',
      table: table
    };

    if (options.filter) {
      channelConfig.filter = options.filter;
    }

    const channel = this.supabase
      .channel(channelName)
      .on('postgres_changes', channelConfig, (payload) => {
        console.log(`[Realtime] ${table} ${payload.eventType}:`, payload);
        
        // Notify all listeners
        const listeners = this.listeners.get(channelName) || [];
        listeners.forEach(cb => {
          try {
            cb(payload.eventType, payload.new, payload.old);
          } catch (err) {
            console.error('[Realtime] Listener error:', err);
          }
        });
      })
      .subscribe((status) => {
        console.log(`[Realtime] Channel ${channelName} status:`, status);
        if (status === 'SUBSCRIBED') {
          this.reconnectAttempts = 0;
        } else if (status === 'CHANNEL_ERROR') {
          this._handleError(channelName);
        }
      });

    this.channels.set(channelName, channel);
    this.listeners.set(channelName, [callback]);
    
    console.log(`[Realtime] Subscribed to ${table} changes on channel: ${channelName}`);

    // Return unsubscribe function
    return () => {
      this.unsubscribe(channelName);
    };
  }

  /**
   * Handle subscription errors with retry logic
   * @private
   */
  _handleError(channelName) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`[Realtime] Reconnect attempt ${this.reconnectAttempts} for ${channelName}`);
      
      setTimeout(() => {
        const channel = this.channels.get(channelName);
        if (channel) {
          channel.subscribe();
        }
      }, 1000 * this.reconnectAttempts);
    } else {
      console.error(`[Realtime] Max reconnect attempts reached for ${channelName}`);
    }
  }

  /**
   * Unsubscribe from a channel
   * @param {string} channelName 
   */
  unsubscribe(channelName) {
    const channel = this.channels.get(channelName);
    if (channel) {
      this.supabase.removeChannel(channel);
      this.channels.delete(channelName);
      this.listeners.delete(channelName);
      console.log(`[Realtime] Unsubscribed from channel: ${channelName}`);
    }
  }

  /**
   * Unsubscribe from all channels
   */
  unsubscribeAll() {
    this.channels.forEach((channel, name) => {
      this.supabase.removeChannel(channel);
    });
    this.channels.clear();
    this.listeners.clear();
    console.log('[Realtime] Unsubscribed from all channels');
  }

  /**
   * Broadcast a custom event to other clients
   * @param {string} event - Event name
   * @param {object} payload - Event payload
   */
  async broadcast(event, payload) {
    if (!this.supabase) {
      console.warn('[Realtime] Service not initialized');
      return;
    }

    const channel = this.supabase.channel('app-broadcast');
    
    await channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channel.send({
          type: 'broadcast',
          event,
          payload
        });
      }
    });
  }

  /**
   * Listen for custom broadcast events
   * @param {string} event - Event name to listen for
   * @param {Function} callback - Called with event payload
   * @returns {Function} Unsubscribe function
   */
  onBroadcast(event, callback) {
    if (!this.supabase) {
      console.warn('[Realtime] Service not initialized');
      return () => {};
    }

    const channel = this.supabase
      .channel('app-broadcast')
      .on('broadcast', { event }, (payload) => {
        callback(payload.payload);
      })
      .subscribe();

    return () => {
      this.supabase.removeChannel(channel);
    };
  }
}

// Singleton instance
const realtimeService = new RealtimeService();

// Auto-initialize when module loads
realtimeService.init();

export default realtimeService;

// Named exports for convenience
export const subscribeToReservations = (cb) => realtimeService.subscribeToReservations(cb);
export const subscribeToDrivers = (cb) => realtimeService.subscribeToDrivers(cb);
export const subscribeToAccounts = (cb) => realtimeService.subscribeToAccounts(cb);
export const subscribeToVehicleTypes = (cb) => realtimeService.subscribeToVehicleTypes(cb);
export const subscribeToPortalSettings = (cb) => realtimeService.subscribeToPortalSettings(cb);
export const subscribeToReservation = (id, cb) => realtimeService.subscribeToReservation(id, cb);
export const subscribeToDriverReservations = (id, cb) => realtimeService.subscribeToDriverReservations(id, cb);
export const subscribeToAccountReservations = (id, cb) => realtimeService.subscribeToAccountReservations(id, cb);
export const broadcast = (event, payload) => realtimeService.broadcast(event, payload);
export const onBroadcast = (event, cb) => realtimeService.onBroadcast(event, cb);
