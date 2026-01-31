import React, { useMemo } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../store';
import { useTheme } from '../context';
import type { RootStackParamList } from '../types';

// Screens
import SplashScreen from '../screens/SplashScreen';
import AuthScreen from '../screens/AuthScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { RegisterCompanyScreen } from '../screens/RegisterCompanyScreen';
import { RegisterVehicleScreen } from '../screens/RegisterVehicleScreen';
import { WelcomeScreen } from '../screens/WelcomeScreen';
import DashboardScreen from '../screens/DashboardScreen';
import TripDetailScreen from '../screens/TripDetailScreen';
import ActiveTripScreen from '../screens/ActiveTripScreen';
import OffersScreen from '../screens/OffersScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SettingsScreen from '../screens/SettingsScreen';
import CalendarScreen from '../screens/CalendarScreen';
import MessagesScreen from '../screens/MessagesScreen';
import GreetingSignScreen from '../screens/GreetingSignScreen';
import CalendarSyncScreen from '../screens/CalendarSyncScreen';
import TripHistoryScreen from '../screens/TripHistoryScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const { isAuthenticated, isLoading } = useAuthStore();
  const { colors } = useTheme();
  
  // Create dynamic screen options based on current theme
  const opts = useMemo(() => ({ 
    headerStyle: { backgroundColor: colors.headerBg }, 
    headerTintColor: colors.white, 
    headerTitleStyle: { fontWeight: '600' as const }, 
    contentStyle: { backgroundColor: colors.background } 
  }), [colors]);

  if (isLoading) return <Stack.Navigator screenOptions={{ headerShown: false }}><Stack.Screen name="Splash" component={SplashScreen} /></Stack.Navigator>;

  return (
    <Stack.Navigator screenOptions={opts}>
      {!isAuthenticated ? (
        <>
          <Stack.Screen name="Auth" component={AuthScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Register" component={RegisterScreen} options={{ headerShown: false }} />
          <Stack.Screen name="RegisterCompany" component={RegisterCompanyScreen} options={{ headerShown: false }} />
          <Stack.Screen name="RegisterVehicle" component={RegisterVehicleScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Welcome" component={WelcomeScreen} options={{ headerShown: false }} />
        </>
      ) : (
        <>
          <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'My Trips', headerLeft: () => null }} />
          <Stack.Screen name="TripDetail" component={TripDetailScreen} options={{ title: 'Trip Details' }} />
          <Stack.Screen name="ActiveTrip" component={ActiveTripScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Offers" component={OffersScreen} options={{ title: 'Trip Offers' }} />
          <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
          <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
          <Stack.Screen name="TripHistory" component={TripHistoryScreen} options={{ title: 'Trip History', headerShown: false }} />
          <Stack.Screen name="Calendar" component={CalendarScreen} options={{ title: 'Calendar' }} />
          <Stack.Screen name="Messages" component={MessagesScreen} options={{ title: 'Messages' }} />
          <Stack.Screen name="GreetingSign" component={GreetingSignScreen} options={{ title: 'Greeting Sign' }} />
          <Stack.Screen name="CalendarSync" component={CalendarSyncScreen} options={{ title: 'Calendar Sync' }} />
        </>
      )}
    </Stack.Navigator>
  );
}
