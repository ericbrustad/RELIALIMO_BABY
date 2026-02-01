import React, { useEffect, useState, useMemo } from 'react';
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
import { useTripStore, useAuthStore, useSettingsStore } from '../store';
import { supabase } from '../config/supabase';
import { useTheme } from '../context';
import { spacing, fontSize, borderRadius } from '../config/theme';
import { STATUS_META } from '../types';
import type { Reservation, RootStackParamList } from '../types';
import MississippiCountdown from '../components/MississippiCountdown';
import PassengerInfoBar from '../components/PassengerInfoBar';
import CancelTripModal from '../components/CancelTripModal';
import { navigateToAddress } from '../utils/navigation';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteParams = RouteProp<RootStackParamList, 'TripDetail'>;

export default function TripDetailScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteParams>();
  const { tripId } = route.params;
  const { driver } = useAuthStore();
  const { updateTripStatus, setCurrentTrip } = useTripStore();
  const { preferredNavigationApp, hasSetNavigationPreference, setNavigationApp } = useSettingsStore();
  const { colors } = useTheme();
  
  const [trip, setTrip] = useState<Reservation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showCountdown, setShowCountdown] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  
  // Create dynamic styles based on current theme
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  useEffect(() => {
    fetchTripDetails();
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
    } catch (error) {
      console.error('Error fetching trip:', error);
      Alert.alert('Error', 'Failed to load trip details');
    } finally {
      setIsLoading(false);
    }
  };
  
  const formatDateTime = (datetime: string) => {
    const date = new Date(datetime);
    return {
      date: date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }),
      time: date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }),
    };
  };
  
  const handleCall = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };
  
  const handleText = (phone: string) => {
    Linking.openURL(`sms:${phone}`);
  };
  
  const handleNavigate = (address: string) => {
    navigateToAddress(address, preferredNavigationApp, hasSetNavigationPreference, setNavigationApp);
  };
  
  const handleStartTrip = () => {
    if (!trip) return;
    setShowCountdown(true);
  };
  
  const executeStartTrip = async () => {
    setShowCountdown(false);
    if (!trip) return;
    
    const result = await updateTripStatus(trip.id, 'enroute');
    if (result.success) {
      setCurrentTrip({ ...trip, driver_status: 'enroute' });
      navigation.navigate('ActiveTrip', { tripId: trip.id });
    } else {
      Alert.alert('Error', result.error || 'Failed to start trip');
    }
  };
  
  const cancelCountdown = () => {
    setShowCountdown(false);
  };
  
  const getPassengerName = () => {
    if (!trip) return 'Unknown';
    if (trip.passenger_name) return trip.passenger_name;
    if (trip.passenger_first_name) {
      return `${trip.passenger_first_name} ${trip.passenger_last_name || ''}`.trim();
    }
    return 'Unknown Passenger';
  };
  
  const handleCancelTrip = async (reason: string) => {
    if (!trip) return;
    
    setIsCancelling(true);
    try {
      // Save cancellation reason to database
      const driverFullName = driver ? `${driver.first_name} ${driver.last_name}`.trim() : undefined;
      const { error: cancelError } = await supabase
        .from('driver_trip_cancellations')
        .insert({
          reservation_id: trip.id,
          driver_id: driver?.id,
          reason: reason,
          driver_name: driverFullName,
          driver_phone: driver?.phone,
          passenger_name: getPassengerName(),
          pickup_address: trip.pickup_address || trip.pickup_location,
          dropoff_address: trip.dropoff_address || trip.dropoff_location,
          pickup_datetime: trip.pickup_datetime,
          confirmation_number: trip.confirmation_number,
        });
      
      if (cancelError) {
        console.error('Error saving cancellation reason:', cancelError);
        // Continue with cancellation even if logging fails
      }
      
      // Update reservation with cancellation info
      const { error: updateError } = await supabase
        .from('reservations')
        .update({
          driver_status: 'cancelled',
          cancellation_reason: reason,
          cancelled_by_driver_id: driver?.id,
          cancelled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', trip.id);
      
      if (updateError) throw updateError;
      
      setShowCancelModal(false);
      Alert.alert('Trip Cancelled', 'The trip has been cancelled.', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error: any) {
      console.error('Error cancelling trip:', error);
      Alert.alert('Error', 'Failed to cancel trip. Please try again.');
    } finally {
      setIsCancelling(false);
    }
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
  
  const { date, time } = formatDateTime(trip.pickup_datetime);
  const status = trip.driver_status || 'available';
  const statusMeta = STATUS_META[status] || STATUS_META.available;
  
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Persistent Passenger Info Bar at Top */}
      <View style={styles.passengerBar}>
        <PassengerInfoBar
          passengerName={getPassengerName()}
          passengerPhone={trip.passenger_phone}
          passengerCount={trip.passenger_count}
        />
      </View>
      
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Status Badge */}
        <View style={[styles.statusContainer, { backgroundColor: statusMeta.color + '20' }]}>
          <Text style={styles.statusEmoji}>{statusMeta.emoji}</Text>
          <Text style={[styles.statusLabel, { color: statusMeta.color }]}>
            {statusMeta.label}
          </Text>
        </View>
        
        {/* Date & Time */}
        <View style={styles.section}>
          <Text style={styles.dateText}>{date}</Text>
          <Text style={styles.timeText}>{time}</Text>
        </View>
        
        {/* Locations - Clickable for Navigation */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Route - Tap to Navigate</Text>
          
          {/* Pickup */}
          <TouchableOpacity
            style={styles.locationRow}
            onPress={() => handleNavigate(trip.pickup_address || trip.pickup_location || '')}
          >
            <View style={[styles.locationDot, { backgroundColor: colors.success }]} />
            <View style={styles.locationInfo}>
              <Text style={styles.locationLabel}>PICKUP</Text>
              <Text style={[styles.locationAddress, styles.clickableAddress]}>
                {trip.pickup_address || trip.pickup_location || 'Not specified'}
              </Text>
            </View>
            <Text style={styles.navArrow}>🧭</Text>
          </TouchableOpacity>
          
          {/* Stops */}
          {trip.stop1_address && (
            <TouchableOpacity
              style={styles.locationRow}
              onPress={() => handleNavigate(trip.stop1_address!)}
            >
              <View style={[styles.locationDot, { backgroundColor: colors.warning }]} />
              <View style={styles.locationInfo}>
                <Text style={styles.locationLabel}>STOP 1</Text>
                <Text style={[styles.locationAddress, styles.clickableAddress]}>{trip.stop1_address}</Text>
              </View>
              <Text style={styles.navArrow}>🧭</Text>
            </TouchableOpacity>
          )}
          
          {trip.stop2_address && (
            <TouchableOpacity
              style={styles.locationRow}
              onPress={() => handleNavigate(trip.stop2_address!)}
            >
              <View style={[styles.locationDot, { backgroundColor: colors.warning }]} />
              <View style={styles.locationInfo}>
                <Text style={styles.locationLabel}>STOP 2</Text>
                <Text style={[styles.locationAddress, styles.clickableAddress]}>{trip.stop2_address}</Text>
              </View>
              <Text style={styles.navArrow}>🧭</Text>
            </TouchableOpacity>
          )}
          
          {/* Dropoff */}
          <TouchableOpacity
            style={styles.locationRow}
            onPress={() => handleNavigate(trip.dropoff_address || trip.dropoff_location || '')}
          >
            <View style={[styles.locationDot, { backgroundColor: colors.danger }]} />
            <View style={styles.locationInfo}>
              <Text style={styles.locationLabel}>DROPOFF</Text>
              <Text style={[styles.locationAddress, styles.clickableAddress]}>
                {trip.dropoff_address || trip.dropoff_location || 'Not specified'}
              </Text>
            </View>
            <Text style={styles.navArrow}>🧭</Text>
          </TouchableOpacity>
        </View>
        
        {/* Trip Details */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Trip Details</Text>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Confirmation #</Text>
            <Text style={styles.detailValue}>{trip.confirmation_number}</Text>
          </View>
          
          {trip.vehicle_type && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Vehicle Type</Text>
              <Text style={styles.detailValue}>{trip.vehicle_type}</Text>
            </View>
          )}
          
          {trip.driver_pay && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Your Pay</Text>
              <Text style={[styles.detailValue, styles.payAmount]}>
                ${trip.driver_pay.toFixed(2)}
              </Text>
            </View>
          )}
        </View>
        
        {/* Notes */}
        {(trip.special_instructions || trip.driver_notes) && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Notes</Text>
            
            {trip.special_instructions && (
              <View style={styles.noteSection}>
                <Text style={styles.noteLabel}>Special Instructions</Text>
                <Text style={styles.noteText}>{trip.special_instructions}</Text>
              </View>
            )}
            
            {trip.driver_notes && (
              <View style={styles.noteSection}>
                <Text style={styles.noteLabel}>Driver Notes</Text>
                <Text style={styles.noteText}>{trip.driver_notes}</Text>
              </View>
            )}
          </View>
        )}
        
        {/* Cancel Trip Button */}
        <TouchableOpacity 
          style={styles.cancelTripButton} 
          onPress={() => setShowCancelModal(true)}
        >
          <Text style={styles.cancelTripButtonText}>Cancel Trip</Text>
        </TouchableOpacity>
        
        <View style={{ height: 120 }} />
      </ScrollView>
      
      {/* Bottom Action Buttons */}
      {(!trip.driver_status || trip.driver_status === 'available' || trip.driver_status === 'assigned') && (
        <View style={styles.bottomBar}>
          <TouchableOpacity 
            style={styles.onTheWayButton} 
            onPress={handleStartTrip}
          >
            <Text style={styles.onTheWayButtonIcon}>🚗</Text>
            <Text style={styles.onTheWayButtonText}>On the Way</Text>
          </TouchableOpacity>
          <Text style={styles.bottomHint}>Press to start 3-2-1 countdown before status change</Text>
        </View>
      )}
      
      {/* Mississippi Countdown Modal */}
      <MississippiCountdown
        visible={showCountdown}
        onComplete={executeStartTrip}
        onCancel={cancelCountdown}
        actionLabel="On the Way"
        actionColor={colors.primary}
      />
      
      {/* Cancel Trip Modal with Reason */}
      <CancelTripModal
        visible={showCancelModal}
        onConfirm={handleCancelTrip}
        onCancel={() => setShowCancelModal(false)}
        isLoading={isCancelling}
      />
    </SafeAreaView>
  );
}

// Create dynamic styles based on theme colors
const createStyles = (colors: any) => StyleSheet.create({
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
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  statusEmoji: {
    fontSize: 24,
    marginRight: spacing.sm,
  },
  statusLabel: {
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
  section: {
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  dateText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  timeText: {
    fontSize: fontSize.xxxl,
    fontWeight: '700',
    color: colors.text,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.md,
  },
  passengerName: {
    fontSize: fontSize.xl,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },
  contactButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  contactButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary + '20',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
  },
  contactButtonEmoji: {
    fontSize: 18,
    marginRight: spacing.xs,
  },
  contactButtonText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.primary,
  },
  passengerCount: {
    marginTop: spacing.md,
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  locationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: spacing.md,
  },
  locationInfo: {
    flex: 1,
  },
  locationLabel: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 2,
  },
  locationAddress: {
    fontSize: fontSize.md,
    color: colors.text,
  },
  clickableAddress: {
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  navArrow: {
    fontSize: fontSize.lg,
    color: colors.primary,
    marginLeft: spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  detailLabel: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  detailValue: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
  },
  payAmount: {
    color: colors.success,
    fontSize: fontSize.lg,
  },
  noteSection: {
    marginBottom: spacing.md,
  },
  noteLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  noteText: {
    fontSize: fontSize.md,
    color: colors.text,
    lineHeight: 22,
  },
  passengerBar: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cancelTripButton: {
    backgroundColor: 'transparent',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.danger + '50',
    marginTop: spacing.md,
  },
  cancelTripButtonText: {
    fontSize: fontSize.md,
    fontWeight: '500',
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
    alignItems: 'center',
  },
  onTheWayButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    gap: spacing.sm,
  },
  onTheWayButtonIcon: {
    fontSize: 24,
  },
  onTheWayButtonText: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: '#fff',
  },
  bottomHint: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  startButton: {
    backgroundColor: colors.success,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  startButtonText: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: '#fff',
  },
});
