import React, { useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { useAuthStore } from './src/store';
import { colors } from './src/config/theme';
import type { RootStackParamList } from './src/types';

// Lazy load notification service to prevent crash on startup
let notificationService: any = null;
const getNotificationService = async () => {
  if (!notificationService) {
    try {
      const module = await import('./src/services/notifications');
      notificationService = module.notificationService;
    } catch (e) {
      console.log('[Notifications] Service not available:', e);
    }
  }
  return notificationService;
};

// Custom light theme for navigation (DriverAnywhere style)
const AppTheme = {
  ...DefaultTheme,
  dark: false,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    notification: colors.danger,
  },
};

function AppContent() {
  const { initialize, isLoading, driver, isAuthenticated } = useAuthStore();
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null);
  
  useEffect(() => {
    initialize();
  }, []);
  
  // Initialize notifications when authenticated (optional - won't crash app if it fails)
  useEffect(() => {
    if (isAuthenticated && driver?.id) {
      // Run in background, don't block app
      initializeNotifications().catch((err) => {
        console.log('[Notifications] Skipped:', err?.message || err);
      });
    }
    
    return () => {
      // Cleanup notification listeners
      getNotificationService().then((svc) => {
        if (svc) {
          try { svc.removeAllListeners(); } catch (e) { /* ignore */ }
        }
      });
    };
  }, [isAuthenticated, driver?.id]);
  
  const initializeNotifications = async () => {
    const svc = await getNotificationService();
    if (!svc) return;
    
    try {
      // Initialize and get push token
      const token = await svc.initialize();
      
      if (token && driver?.id) {
        // Register token with backend
        await svc.registerToken(driver.id);
      }
      
      // Listen for notification taps
      svc.addNotificationResponseListener((response: any) => {
        const data = response.notification.request.content.data;
        
        if (data?.tripId && navigationRef.current) {
          if (data.type === 'trip_offer') {
            navigationRef.current.navigate('Offers' as any);
          } else {
            navigationRef.current.navigate('TripDetail' as any, { tripId: data.tripId });
          }
        }
      });
      
      // Listen for incoming notifications (foreground)
      svc.addNotificationReceivedListener((notification: any) => {
        console.log('[Notification] Received:', notification.request.content.title);
      });
      
    } catch (error) {
      console.error('[Notifications] Setup error:', error);
    }
  };
  
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }
  
  return <AppNavigator />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AppContent />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
