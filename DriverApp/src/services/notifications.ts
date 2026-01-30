/**
 * Push Notification Service for Driver App
 * Handles registration, permissions, and notification display
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '../config/supabase';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface NotificationData {
  type: 'trip_offer' | 'trip_update' | 'message' | 'reminder';
  tripId?: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}

class NotificationService {
  private expoPushToken: string | null = null;
  private notificationListener: any = null;
  private responseListener: any = null;
  
  /**
   * Initialize notifications and request permissions
   */
  async initialize(): Promise<string | null> {
    try {
      // Skip on simulators/emulators - but don't crash
      if (!Device.isDevice) {
        console.log('[Notifications] Running on simulator - skipping push setup');
        return null;
      }
      
      // Check existing permission
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      // Request permission if not granted
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.log('[Notifications] Permission not granted');
        return null;
      }
      
      // Get Expo push token - may fail in Expo Go without EAS projectId
      try {
        const projectId = Constants.expoConfig?.extra?.eas?.projectId;
        const tokenData = await Notifications.getExpoPushTokenAsync(
          projectId ? { projectId } : undefined
        );
        this.expoPushToken = tokenData.data;
        console.log('[Notifications] Push token:', this.expoPushToken);
      } catch (tokenError) {
        console.log('[Notifications] Could not get push token (Expo Go limitation):', tokenError);
        return null;
      }
      
      // Configure Android channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('trip-offers', {
          name: 'Trip Offers',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#E85A4F',
          sound: 'default',
        });
        
        await Notifications.setNotificationChannelAsync('trip-updates', {
          name: 'Trip Updates',
          importance: Notifications.AndroidImportance.HIGH,
          sound: 'default',
        });
        
        await Notifications.setNotificationChannelAsync('messages', {
          name: 'Messages',
          importance: Notifications.AndroidImportance.DEFAULT,
          sound: 'default',
        });
      }
      
      return this.expoPushToken;
    } catch (error) {
      console.error('[Notifications] Error initializing:', error);
      return null;
    }
  }
  
  /**
   * Register push token with Supabase for driver
   */
  async registerToken(driverId: string): Promise<boolean> {
    if (!this.expoPushToken) {
      console.log('[Notifications] No token to register');
      return false;
    }
    
    try {
      const { error } = await supabase
        .from('driver_push_tokens')
        .upsert({
          driver_id: driverId,
          push_token: this.expoPushToken,
          platform: Platform.OS,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'driver_id',
        });
      
      if (error) {
        console.error('[Notifications] Error registering token:', error);
        return false;
      }
      
      console.log('[Notifications] Token registered for driver:', driverId);
      return true;
    } catch (error) {
      console.error('[Notifications] Error registering token:', error);
      return false;
    }
  }
  
  /**
   * Add listener for incoming notifications
   */
  addNotificationReceivedListener(
    callback: (notification: Notifications.Notification) => void
  ) {
    this.notificationListener = Notifications.addNotificationReceivedListener(callback);
    return this.notificationListener;
  }
  
  /**
   * Add listener for notification taps
   */
  addNotificationResponseListener(
    callback: (response: Notifications.NotificationResponse) => void
  ) {
    this.responseListener = Notifications.addNotificationResponseReceivedListener(callback);
    return this.responseListener;
  }
  
  /**
   * Remove all listeners
   */
  removeAllListeners() {
    if (this.notificationListener) {
      this.notificationListener.remove();
    }
    if (this.responseListener) {
      this.responseListener.remove();
    }
  }
  
  /**
   * Show a local notification (for testing or real-time events)
   */
  async showLocalNotification(data: NotificationData): Promise<void> {
    const channelId = Platform.OS === 'android'
      ? data.type === 'trip_offer' ? 'trip-offers'
        : data.type === 'trip_update' ? 'trip-updates'
        : 'messages'
      : undefined;
    
    await Notifications.scheduleNotificationAsync({
      content: {
        title: data.title,
        body: data.body,
        data: {
          type: data.type,
          tripId: data.tripId,
          ...data.data,
        },
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        ...(channelId && { channelId }),
      },
      trigger: null, // Show immediately
    });
  }
  
  /**
   * Show trip offer notification with actions
   */
  async showTripOfferNotification(trip: {
    id: string;
    confirmationNumber: string;
    pickupTime: string;
    pickupAddress: string;
    passengerName: string;
  }): Promise<void> {
    const time = new Date(trip.pickupTime).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    
    await this.showLocalNotification({
      type: 'trip_offer',
      tripId: trip.id,
      title: '🔔 New Trip Offer!',
      body: `${trip.passengerName} • ${time}\n${trip.pickupAddress}`,
      data: {
        confirmationNumber: trip.confirmationNumber,
      },
    });
  }
  
  /**
   * Get badge count
   */
  async getBadgeCount(): Promise<number> {
    return await Notifications.getBadgeCountAsync();
  }
  
  /**
   * Set badge count
   */
  async setBadgeCount(count: number): Promise<void> {
    await Notifications.setBadgeCountAsync(count);
  }
  
  /**
   * Clear all notifications
   */
  async clearAll(): Promise<void> {
    await Notifications.dismissAllNotificationsAsync();
    await this.setBadgeCount(0);
  }
  
  /**
   * Get the current push token
   */
  getToken(): string | null {
    return this.expoPushToken;
  }
}

// Export singleton instance
export const notificationService = new NotificationService();

// Export types for use elsewhere
export type { Notifications };
