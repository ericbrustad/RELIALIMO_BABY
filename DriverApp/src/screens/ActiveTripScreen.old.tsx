import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Linking,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useTripStore, useLocationStore } from '../store';
import { supabase } from '../config/supabase';
import { colors, spacing, fontSize, borderRadius } from '../config/theme';
import { STATUS_META } from '../types';
import type { Reservation, DriverStatus, RootStackParamList } from '../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteParams = RouteProp<RootStackParamList, 'ActiveTrip'>;

// Status flow for active trip
const STATUS_FLOW: DriverStatus[] = [
  'getting_ready',
  'enroute',
  'arrived',
  'waiting',
  'passenger_onboard',
  'done',
];

export default function ActiveTripScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteParams>();
  const { tripId } = route.params;
  const { updateTripStatus, setCurrentTrip } = useTripStore();
  const { startTracking, stopTracking } = useLocationStore();
  
  const [trip, setTrip] = useState<Reservation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  
  useEffect(() => {
    fetchTripDetails();
    
    return () => {
      // Stop tracking when leaving active trip
      stopTracking();
    };
  }, [tripId]);
  
  const fetchTripDetails = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('reservations')
        .select('*')
        .eq('id', tripId)
        .single();
      
      if (error) throw error;
      setTrip(data);
      setCurrentTrip(data);
    } catch (error) {
      console.error('Error fetching trip:', error);
      Alert.alert('Error', 'Failed to load trip details');
    } finally {
      setIsLoading(false);
    }
  };
  
  const getCurrentStatusIndex = () => {
    if (!trip?.driver_status) return 0;
    const idx = STATUS_FLOW.indexOf(trip.driver_status);
    return idx >= 0 ? idx : 0;
  };
  
  const getNextStatus = (): DriverStatus | null => {
    const currentIndex = getCurrentStatusIndex();
    if (currentIndex < STATUS_FLOW.length - 1) {
      return STATUS_FLOW[currentIndex + 1];
    }
    return null;
  };
  
  const getNextButtonText = (): string => {
    const nextStatus = getNextStatus();
    if (!nextStatus) return 'Trip Completed';
    
    const labels: Record<DriverStatus, string> = {
      available: 'Available',
      getting_ready: 'Getting Ready',
      enroute: 'Start Driving',
      arrived: 'Mark Arrived',
      waiting: 'Start Waiting',
      passenger_onboard: 'Passenger In Car',
      done: 'Complete Trip',
      completed: 'Completed',
      busy: 'Busy',
      offline: 'Offline',
      cancelled: 'Cancelled',
      no_show: 'No Show',
    };
    
    return labels[nextStatus] || nextStatus;
  };
  
  const handleAdvanceStatus = async () => {
    if (!trip) return;
    
    const nextStatus = getNextStatus();
    if (!nextStatus) {
      // Trip completed - go back to dashboard
      setCurrentTrip(null);
      navigation.navigate('Dashboard');
      return;
    }
    
    setIsUpdating(true);
    const result = await updateTripStatus(trip.id, nextStatus);
    setIsUpdating(false);
    
    if (result.success) {
      setTrip({ ...trip, driver_status: nextStatus });
      
      // If starting to drive, open navigation
      if (nextStatus === 'enroute') {
        const address = trip.pickup_address || trip.pickup_location;
        if (address) {
          handleNavigate(address);
        }
      }
      
      // If passenger onboard, offer to navigate to dropoff
      if (nextStatus === 'passenger_onboard') {
        const address = trip.dropoff_address || trip.dropoff_location;
        if (address) {
          Alert.alert(
            'Navigate to Dropoff?',
            'Would you like to open navigation to the dropoff location?',
            [
              { text: 'No', style: 'cancel' },
              { text: 'Yes', onPress: () => handleNavigate(address) },
            ]
          );
        }
      }
      
      // If done, go back to dashboard
      if (nextStatus === 'done') {
        Alert.alert(
          'Trip Completed! 🎉',
          'Great job! The trip has been completed.',
          [
            {
              text: 'OK',
              onPress: () => {
                setCurrentTrip(null);
                navigation.navigate('Dashboard');
              },
            },
          ]
        );
      }
    } else {
      Alert.alert('Error', result.error || 'Failed to update status');
    }
  };
  
  const handleCancelTrip = () => {
    Alert.alert(
      'Cancel Trip',
      'Are you sure you want to cancel this trip? This should only be done if instructed by dispatch.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            if (!trip) return;
            setIsUpdating(true);
            const result = await updateTripStatus(trip.id, 'cancelled');
            setIsUpdating(false);
            
            if (result.success) {
              setCurrentTrip(null);
              navigation.navigate('Dashboard');
            } else {
              Alert.alert('Error', result.error || 'Failed to cancel trip');
            }
          },
        },
      ]
    );
  };
  
  const handleNoShow = () => {
    Alert.alert(
      'Mark as No Show',
      'Confirm that the passenger did not show up. Make sure you have waited the required time and attempted to contact them.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark No Show',
          style: 'destructive',
          onPress: async () => {
            if (!trip) return;
            setIsUpdating(true);
            const result = await updateTripStatus(trip.id, 'no_show');
            setIsUpdating(false);
            
            if (result.success) {
              setCurrentTrip(null);
              navigation.navigate('Dashboard');
            } else {
              Alert.alert('Error', result.error || 'Failed to mark as no show');
            }
          },
        },
      ]
    );
  };
  
  const handleNavigate = (address: string) => {
    const encodedAddress = encodeURIComponent(address);
    
    Alert.alert(
      'Open Navigation',
      'Choose your navigation app',
      [
        {
          text: 'Google Maps',
          onPress: () => {
            const url = Platform.OS === 'ios'
              ? `comgooglemaps://?daddr=${encodedAddress}&directionsmode=driving`
              : `google.navigation:q=${encodedAddress}`;
            Linking.openURL(url).catch(() => {
              Linking.openURL(`https://maps.google.com/maps?daddr=${encodedAddress}`);
            });
          },
        },
        {
          text: 'Apple Maps',
          onPress: () => {
            Linking.openURL(`maps://?daddr=${encodedAddress}`);
          },
        },
        {
          text: 'Waze',
          onPress: () => {
            Linking.openURL(`waze://?q=${encodedAddress}&navigate=yes`).catch(() => {
              Linking.openURL(`https://waze.com/ul?q=${encodedAddress}&navigate=yes`);
            });
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };
  
  const handleCall = () => {
    if (trip?.passenger_phone) {
      Linking.openURL(`tel:${trip.passenger_phone}`);
    }
  };
  
  const handleText = () => {
    if (trip?.passenger_phone) {
      Linking.openURL(`sms:${trip.passenger_phone}`);
    }
  };
  
  const getPassengerName = () => {
    if (!trip) return 'Unknown';
    if (trip.passenger_name) return trip.passenger_name;
    if (trip.passenger_first_name) {
      return `${trip.passenger_first_name} ${trip.passenger_last_name || ''}`.trim();
    }
    return 'Passenger';
  };
  
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }
  
  if (!trip) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Trip not found</Text>
      </View>
    );
  }
  
  const status = trip.driver_status || 'getting_ready';
  const statusMeta = STATUS_META[status] || STATUS_META.getting_ready;
  const currentIndex = getCurrentStatusIndex();
  
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Big Status Display */}
        <View style={[styles.statusCard, { borderColor: statusMeta.color }]}>
          <Text style={styles.statusEmoji}>{statusMeta.emoji}</Text>
          <Text style={[styles.statusLabel, { color: statusMeta.color }]}>
            {statusMeta.label}
          </Text>
        </View>
        
        {/* Progress Dots */}
        <View style={styles.progressContainer}>
          {STATUS_FLOW.map((s, idx) => (
            <View
              key={s}
              style={[
                styles.progressDot,
                idx <= currentIndex && { backgroundColor: colors.primary },
              ]}
            />
          ))}
        </View>
        
        {/* Passenger Info Card */}
        <View style={styles.card}>
          <Text style={styles.passengerName}>{getPassengerName()}</Text>
          
          {trip.passenger_phone && (
            <View style={styles.contactRow}>
              <TouchableOpacity style={styles.contactBtn} onPress={handleCall}>
                <Text style={styles.contactBtnText}>📞 Call</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.contactBtn} onPress={handleText}>
                <Text style={styles.contactBtnText}>💬 Text</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
        
        {/* Current Destination */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>
            {status === 'passenger_onboard' ? 'DROPOFF' : 'PICKUP'}
          </Text>
          <Text style={styles.addressText}>
            {status === 'passenger_onboard'
              ? (trip.dropoff_address || trip.dropoff_location || 'Dropoff')
              : (trip.pickup_address || trip.pickup_location || 'Pickup')}
          </Text>
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => handleNavigate(
              status === 'passenger_onboard'
                ? (trip.dropoff_address || trip.dropoff_location || '')
                : (trip.pickup_address || trip.pickup_location || '')
            )}
          >
            <Text style={styles.navButtonText}>🧭 Navigate</Text>
          </TouchableOpacity>
        </View>
        
        {/* Action Buttons for Arrived/Waiting status */}
        {(status === 'arrived' || status === 'waiting') && (
          <TouchableOpacity style={styles.noShowButton} onPress={handleNoShow}>
            <Text style={styles.noShowButtonText}>🚫 Mark as No Show</Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity style={styles.cancelButton} onPress={handleCancelTrip}>
          <Text style={styles.cancelButtonText}>Cancel Trip</Text>
        </TouchableOpacity>
        
        <View style={{ height: 120 }} />
      </ScrollView>
      
      {/* Main Action Button */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[
            styles.actionButton,
            status === 'done' && styles.actionButtonCompleted,
          ]}
          onPress={handleAdvanceStatus}
          disabled={isUpdating}
        >
          {isUpdating ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.actionButtonText}>{getNextButtonText()}</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  errorText: {
    fontSize: fontSize.lg,
    color: colors.textSecondary,
  },
  scrollView: {
    flex: 1,
    padding: spacing.lg,
  },
  statusCard: {
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    marginBottom: spacing.lg,
  },
  statusEmoji: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  statusLabel: {
    fontSize: fontSize.xxl,
    fontWeight: '700',
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.border,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardLabel: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.textMuted,
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  passengerName: {
    fontSize: fontSize.xl,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  contactRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  contactBtn: {
    flex: 1,
    backgroundColor: colors.primary + '20',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    alignItems: 'center',
  },
  contactBtnText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.primary,
  },
  addressText: {
    fontSize: fontSize.lg,
    color: colors.text,
    marginBottom: spacing.md,
    lineHeight: 24,
  },
  navButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  navButtonText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: '#fff',
  },
  noShowButton: {
    backgroundColor: colors.warning + '20',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  noShowButtonText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.warning,
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.danger,
  },
  cancelButtonText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.danger,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.background,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionButton: {
    backgroundColor: colors.success,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    alignItems: 'center',
  },
  actionButtonCompleted: {
    backgroundColor: colors.primary,
  },
  actionButtonText: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: '#fff',
  },
});
