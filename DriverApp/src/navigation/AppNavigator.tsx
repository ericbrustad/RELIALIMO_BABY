import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../store';
import { colors } from '../config/theme';
import type { RootStackParamList } from '../types';

// Screens
import AuthScreen from '../screens/AuthScreen';
import DashboardScreen from '../screens/DashboardScreen';
import TripDetailScreen from '../screens/TripDetailScreen';
import ActiveTripScreen from '../screens/ActiveTripScreen';
import OffersScreen from '../screens/OffersScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

const screenOptions = {
  headerStyle: {
    backgroundColor: colors.background,
  },
  headerTintColor: colors.text,
  headerTitleStyle: {
    fontWeight: '600' as const,
  },
  contentStyle: {
    backgroundColor: colors.background,
  },
  headerShadowVisible: false,
};

export default function AppNavigator() {
  const { isAuthenticated, isLoading } = useAuthStore();
  
  if (isLoading) {
    return null; // App.tsx shows loading indicator
  }
  
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      {!isAuthenticated ? (
        // Auth Stack
        <Stack.Screen
          name="Auth"
          component={AuthScreen}
          options={{ headerShown: false }}
        />
      ) : (
        // Main App Stack
        <>
          <Stack.Screen
            name="Dashboard"
            component={DashboardScreen}
            options={{
              title: 'My Trips',
            }}
          />
          <Stack.Screen
            name="TripDetail"
            component={TripDetailScreen}
            options={{
              title: 'Trip Details',
            }}
          />
          <Stack.Screen
            name="ActiveTrip"
            component={ActiveTripScreen}
            options={{
              title: 'Active Trip',
              headerBackVisible: false,
              gestureEnabled: false,
            }}
          />
          <Stack.Screen
            name="Offers"
            component={OffersScreen}
            options={{
              title: 'Trip Offers',
            }}
          />
          <Stack.Screen
            name="Profile"
            component={ProfileScreen}
            options={{
              title: 'My Profile',
            }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}
