import React, { useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { NavigationContainer, DefaultTheme, NavigationContainerRef } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { useAuthStore } from './src/store';
import { colors } from './src/config/theme';
import { notificationService } from './src/services/notifications';
import type { RootStackParamList } from './src/types';

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
  
  // Initialize notifications when authenticated
  useEffect(() => {
    if (isAuthenticated && driver?.id) {
      initializeNotifications();
    }
    
    return () => {
      notificationService.removeAllListeners();
    };
  }, [isAuthenticated, driver?.id]);
  
  const initializeNotifications = async () => {
    try {
      // Initialize and get push token
      const token = await notificationService.initialize();
      
      if (token && driver?.id) {
        // Register token with backend
        await notificationService.registerToken(driver.id);
      }
      
      // Listen for notification taps
      notificationService.addNotificationResponseListener((response) => {
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
      notificationService.addNotificationReceivedListener((notification) => {
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
      <NavigationContainer theme={AppTheme}>
        <StatusBar style="dark" />
        <AppContent />
      </NavigationContainer>
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
