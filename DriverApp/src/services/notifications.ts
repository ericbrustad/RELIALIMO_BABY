/**
 * Notifications Service
 * Handles push notifications for trip offers and updates
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '../config/supabase';

// Configure how notifications are handled when app is in foreground
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
  type: 'trip_offer' | 'trip_update' | 'dispatch_message' | 'reminder';
  tripId?: string | number;
  offerId?: string;
  message?: string;
}

/**
 * Register for push notifications and return the token
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log('[Notifications] Push notifications require a physical device');
    return null;
  }

  try {
    // Check existing permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request permissions if not granted
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[Notifications] Permission denied');
      return null;
    }

    // Get push token
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const token = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    console.log('[Notifications] Push token:', token.data);

    // Configure Android notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });

      await Notifications.setNotificationChannelAsync('trip_offers', {
        name: 'Trip Offers',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 250, 500],
        sound: 'default',
      });
    }

    return token.data;
  } catch (error) {
    console.error('[Notifications] Error registering:', error);
    return null;
  }
}

/**
 * Save push token to database for driver
 */
export async function savePushToken(
  driverId: string,
  token: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('driver_push_tokens')
      .upsert({
        driver_id: driverId,
        token,
        platform: Platform.OS,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'driver_id',
      });

    if (error) {
      console.error('[Notifications] Error saving token:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[Notifications] Error saving token:', error);
    return false;
  }
}

/**
 * Schedule a local notification
 */
export async function scheduleLocalNotification(
  title: string,
  body: string,
  data?: NotificationData,
  trigger?: Notifications.NotificationTriggerInput
): Promise<string> {
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: data as any,
      sound: 'default',
    },
    trigger: trigger || null, // null = immediate
  });

  return id;
}

/**
 * Cancel a scheduled notification
 */
export async function cancelNotification(notificationId: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}

/**
 * Cancel all notifications
 */
export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Get badge count
 */
export async function getBadgeCount(): Promise<number> {
  return await Notifications.getBadgeCountAsync();
}

/**
 * Set badge count
 */
export async function setBadgeCount(count: number): Promise<void> {
  await Notifications.setBadgeCountAsync(count);
}

/**
 * Add notification received listener
 */
export function addNotificationReceivedListener(
  callback: (notification: Notifications.Notification) => void
): Notifications.Subscription {
  return Notifications.addNotificationReceivedListener(callback);
}

/**
 * Add notification response listener (when user taps notification)
 */
export function addNotificationResponseListener(
  callback: (response: Notifications.NotificationResponse) => void
): Notifications.Subscription {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

/**
 * Show trip offer notification
 */
export async function showTripOfferNotification(
  offerId: string,
  pickupAddress: string,
  amount?: number
): Promise<string> {
  const body = amount
    ? `New trip to ${pickupAddress} - $${amount}`
    : `New trip offer to ${pickupAddress}`;

  return scheduleLocalNotification(
    '🚗 New Trip Offer!',
    body,
    { type: 'trip_offer', offerId }
  );
}

/**
 * Show trip reminder notification
 */
export async function showTripReminderNotification(
  tripId: string | number,
  pickupTime: string,
  pickupAddress: string,
  minutesBefore: number
): Promise<string> {
  const trigger: Notifications.NotificationTriggerInput = {
    type: Notifications.SchedulableTriggerInputTypes.DATE,
    date: new Date(new Date(pickupTime).getTime() - minutesBefore * 60 * 1000),
  };

  return scheduleLocalNotification(
    `⏰ Trip in ${minutesBefore} minutes`,
    `Pickup at ${pickupAddress}`,
    { type: 'reminder', tripId },
    trigger
  );
}
