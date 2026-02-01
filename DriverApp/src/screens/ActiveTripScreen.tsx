import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
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
  Animated,
  Vibration,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useTripStore, useLocationStore, useSettingsStore, useAuthStore } from '../store';
import { supabase } from '../config/supabase';
import { useTheme } from '../context';
import { spacing, fontSize, borderRadius } from '../config/theme';
import { STATUS_META } from '../types';
import type { Reservation, DriverStatus, RootStackParamList } from '../types';
import MississippiCountdown from '../components/MississippiCountdown';
import PassengerInfoBar from '../components/PassengerInfoBar';
import CancelTripModal from '../components/CancelTripModal';
import BackButton from '../components/BackButton';
import { navigateToAddress, geocodeAddress } from '../utils/navigation';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteParams = RouteProp<RootStackParamList, 'ActiveTrip'>;

// Status flow for active trip - starts with assigned
const STATUS_FLOW: DriverStatus[] = [
  'assigned',
  'enroute',
  'arrived',
  'passenger_onboard',
  'done',
];

// Status button configurations - simplified flow
const getStatusButtons = (colors: any): Record<DriverStatus, { nextLabel: string; icon: string; color: string }> => ({
  assigned: { nextLabel: 'On the Way', icon: '🚗', color: colors.primary },
  enroute: { nextLabel: 'Arrived', icon: '📍', color: colors.warning },
  arrived: { nextLabel: 'Passenger In Car', icon: '👤', color: colors.success },
  waiting: { nextLabel: 'Passenger In Car', icon: '👤', color: colors.success },
  passenger_onboard: { nextLabel: 'Done', icon: '✅', color: colors.success },
  done: { nextLabel: 'Trip Complete', icon: '✅', color: colors.success },
  available: { nextLabel: 'Start', icon: '▶️', color: colors.primary },
  completed: { nextLabel: 'Completed', icon: '✅', color: colors.success },
  busy: { nextLabel: 'Continue', icon: '▶️', color: colors.primary },
  offline: { nextLabel: 'Go Online', icon: '🟢', color: colors.success },
  cancelled: { nextLabel: 'Cancelled', icon: '❌', color: colors.danger },
  no_show: { nextLabel: 'No Show', icon: '🚫', color: colors.danger },
});

export default function ActiveTripScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteParams>();
  const { tripId } = route.params;
  const { updateTripStatus, setCurrentTrip } = useTripStore();
  const { driver } = useAuthStore();
  const { startTracking, stopTracking, location, geofence, setDestination, clearGeofence, isMoving } = useLocationStore();
  const { preferredNavigationApp, hasSetNavigationPreference, setNavigationApp } = useSettingsStore();
  const { colors } = useTheme();
  
  const [trip, setTrip] = useState<Reservation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [waitingTime, setWaitingTime] = useState(0);
  const [showCountdown, setShowCountdown] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ label: string; color: string; targetStatus?: DriverStatus } | null>(null);
  
  // Use ref to avoid stale closure in countdown callback
  const pendingActionRef = useRef<{ label: string; color: string; targetStatus?: DriverStatus } | null>(null);
  const tripRef = useRef<Reservation | null>(null);
  
  // Keep refs in sync with state
  useEffect(() => {
    pendingActionRef.current = pendingAction;
  }, [pendingAction]);
  
  useEffect(() => {
    tripRef.current = trip;
  }, [trip]);
  
  // Ref for navigation function to avoid stale closure
  const handleNavigateRef = useRef<(address: string) => void>(() => {});
  
  // Status menu state (for passenger_onboard expandable menu)
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  
  // Geofence tracking state
  const [hasEnteredDropoffGeofence, setHasEnteredDropoffGeofence] = useState(false);
  const [hasConfirmedArrival, setHasConfirmedArrival] = useState(false);
  const [geofenceAlertShown, setGeofenceAlertShown] = useState(false);
  
  // Create dynamic styles and status buttons based on current theme
  const styles = useMemo(() => createStyles(colors), [colors]);
  const STATUS_BUTTONS = useMemo(() => getStatusButtons(colors), [colors]);
  
  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    fetchTripDetails();
    
    // Start pulse animation for status
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    );
    pulse.start();
    
    return () => {
      pulse.stop();
      stopTracking();
    };
  }, [tripId]);
  
  // Waiting time counter
  useEffect(() => {
    if (trip?.driver_status === 'waiting' || trip?.driver_status === 'arrived') {
      const interval = setInterval(() => {
        setWaitingTime(prev => prev + 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [trip?.driver_status]);
  
  // Update progress animation based on status
  useEffect(() => {
    const currentIndex = getCurrentStatusIndex();
    Animated.spring(progressAnim, {
      toValue: currentIndex / (STATUS_FLOW.length - 1),
      useNativeDriver: false,
    }).start();
  }, [trip?.driver_status]);
  
  // Set up dropoff geofence when passenger is onboard
  useEffect(() => {
    if (trip?.driver_status === 'passenger_onboard') {
      const dropoffAddress = trip.dropoff_address || trip.dropoff_location;
      if (dropoffAddress) {
        // Geocode the dropoff address and set as geofence destination
        setupDropoffGeofence(dropoffAddress);
      }
    } else {
      // Clear geofence when not in passenger_onboard state
      clearGeofence();
      setHasEnteredDropoffGeofence(false);
      setHasConfirmedArrival(false);
      setGeofenceAlertShown(false);
    }
    
    return () => {
      clearGeofence();
    };
  }, [trip?.driver_status]);
  
  // Monitor geofence state changes
  useEffect(() => {
    if (trip?.driver_status !== 'passenger_onboard') return;
    
    // Track when driver enters the geofence
    if (geofence.isInsideGeofence && !hasEnteredDropoffGeofence) {
      console.log('📍 Driver entered dropoff geofence');
      setHasEnteredDropoffGeofence(true);
      
      // Show notification
      if (Platform.OS !== 'web') {
        Vibration.vibrate([0, 100, 50, 100]);
      }
    }
    
    // Check if driver left geofence without confirming arrival
    if (hasEnteredDropoffGeofence && !geofence.isInsideGeofence && !hasConfirmedArrival && !geofenceAlertShown) {
      console.log('📍 Driver left geofence without confirming arrival');
      setGeofenceAlertShown(true);
      
      Alert.alert(
        'Did You Arrive?',
        'It looks like you reached the dropoff location. Did you arrive and drop off the passenger?',
        [
          {
            text: 'No, Still Driving',
            style: 'cancel',
            onPress: () => {
              // Reset so we can track again
              setHasEnteredDropoffGeofence(false);
              setGeofenceAlertShown(false);
            },
          },
          {
            text: 'Yes, Arrived',
            onPress: () => handleConfirmArrival(),
          },
        ]
      );
    }
  }, [geofence.isInsideGeofence, hasEnteredDropoffGeofence, hasConfirmedArrival, trip?.driver_status]);
  
  // Helper to set up the dropoff geofence
  const setupDropoffGeofence = async (address: string) => {
    try {
      const coords = await geocodeAddress(address);
      if (coords) {
        console.log('📍 Setting dropoff geofence at:', coords);
        setDestination(coords);
      } else {
        console.log('⚠️ Could not geocode dropoff address:', address);
      }
    } catch (error) {
      console.error('Error setting up geofence:', error);
    }
  };
  
  // Handle confirming arrival at dropoff
  const handleConfirmArrival = async () => {
    setHasConfirmedArrival(true);
    setShowStatusMenu(false);
    
    // Just mark as confirmed, don't change status yet
    // Driver will use "Done" to complete the trip
    if (Platform.OS !== 'web') {
      Vibration.vibrate(50);
    }
    
    Alert.alert(
      '✅ Arrival Confirmed',
      'When the passenger exits, tap "Done" to complete the trip.',
      [{ text: 'OK' }]
    );
  };
  
  const fetchTripDetails = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('reservations')
        .select('*')
        .eq('id', tripId)
        .single();
      
      if (error) throw error;
      
      console.log('📋 Trip fetched, current driver_status:', data.driver_status);
      
      // If trip doesn't have a valid active status, initialize to enroute
      const activeStatuses: DriverStatus[] = ['enroute', 'arrived', 'waiting', 'passenger_onboard', 'done'];
      if (!data.driver_status || !activeStatuses.includes(data.driver_status)) {
        console.log('📋 Initializing trip status to enroute (current:', data.driver_status, ')');
        // Update database
        const { error: updateError } = await supabase
          .from('reservations')
          .update({ driver_status: 'enroute', updated_at: new Date().toISOString() })
          .eq('id', tripId);
        
        if (updateError) {
          console.error('Error initializing trip status:', updateError);
          Alert.alert('Database Error', `Could not update status: ${updateError.message}`);
        } else {
          console.log('✅ Status updated to enroute in database');
          data.driver_status = 'enroute';
        }
      }
      
      setTrip(data);
      setCurrentTrip(data);
    } catch (error: any) {
      console.error('Error fetching trip:', error);
      Alert.alert('Error', `Failed to load trip details: ${error.message}`);
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
  
  // Trigger the countdown before advancing status
  const handleAdvanceStatus = () => {
    console.log('🔘 handleAdvanceStatus called!', { trip: trip?.id, driver_status: trip?.driver_status });
    if (!trip) {
      console.log('❌ No trip, returning');
      return;
    }
    
    const nextStatus = getNextStatus();
    console.log('📍 Next status would be:', nextStatus);
    if (!nextStatus) {
      // Trip completed - go back to dashboard (no countdown needed)
      console.log('✅ Trip done, going to dashboard');
      setCurrentTrip(null);
      navigation.navigate('Dashboard');
      return;
    }
    
    const status = trip.driver_status || 'enroute';
    const statusButton = STATUS_BUTTONS[status] || STATUS_BUTTONS.enroute;
    
    // Start the Mississippi countdown with the target status
    console.log('🚀 Starting Mississippi countdown!', { label: statusButton.nextLabel, color: statusButton.color, targetStatus: nextStatus });
    setPendingAction({ label: statusButton.nextLabel, color: statusButton.color, targetStatus: nextStatus });
    setShowCountdown(true);
  };
  
  // Handle selecting a status from the expandable menu
  const handleStatusMenuSelect = (targetStatus: DriverStatus, label: string) => {
    console.log('📍 Status menu selected:', targetStatus);
    setShowStatusMenu(false);
    
    // Start countdown with the selected target status
    setPendingAction({ 
      label, 
      color: targetStatus === 'done' ? colors.success : colors.primary,
      targetStatus 
    });
    setShowCountdown(true);
  };
  
  // Called when countdown completes - wrapped in useCallback with empty deps since it reads from refs
  const executeStatusAdvance = useCallback(async () => {
    // Use refs to get latest values (avoid stale closure)
    const currentPendingAction = pendingActionRef.current;
    const currentTrip = tripRef.current;
    
    console.log('🎯 executeStatusAdvance called! Countdown complete.', { 
      pendingAction: currentPendingAction,
      tripId: currentTrip?.id,
      currentStatus: currentTrip?.driver_status 
    });
    setShowCountdown(false);
    
    if (!currentTrip) {
      console.log('❌ No trip in executeStatusAdvance');
      setPendingAction(null);
      return;
    }
    
    // Use the target status from pendingAction if it exists, otherwise calculate next status
    const currentIndex = STATUS_FLOW.indexOf(currentTrip.driver_status || 'enroute');
    const calculatedNextStatus = currentIndex < STATUS_FLOW.length - 1 ? STATUS_FLOW[currentIndex + 1] : null;
    const nextStatus = currentPendingAction?.targetStatus || calculatedNextStatus;
    
    console.log('📍 Will update to status:', nextStatus, 'from:', currentTrip.driver_status);
    setPendingAction(null);
    
    if (!nextStatus) {
      console.log('❌ No next status found');
      return;
    }
    
    // Haptic feedback
    if (Platform.OS !== 'web') {
      Vibration.vibrate(50);
    }
    
    setIsUpdating(true);
    console.log('⏳ Calling updateTripStatus with:', currentTrip.id, nextStatus);
    const result = await updateTripStatus(currentTrip.id, nextStatus);
    console.log('📊 updateTripStatus result:', result);
    setIsUpdating(false);
    
    if (result.success) {
      console.log('✅ Status update successful, updating local state');
      setTrip({ ...currentTrip, driver_status: nextStatus });
      
      // If starting to drive, open navigation
      if (nextStatus === 'enroute') {
        const address = currentTrip.pickup_address || currentTrip.pickup_location;
        if (address) {
          handleNavigateRef.current(address);
        }
      }
      
      // If passenger onboard, offer to navigate to dropoff
      if (nextStatus === 'passenger_onboard') {
        setWaitingTime(0); // Reset waiting timer
        const address = currentTrip.dropoff_address || currentTrip.dropoff_location;
        if (address) {
          Alert.alert(
            'Navigate to Dropoff?',
            'Open navigation to the dropoff location?',
            [
              { text: 'Not Now', style: 'cancel' },
              { text: 'Navigate', onPress: () => handleNavigateRef.current(address) },
            ]
          );
        }
      }
      
      // If done, show completion celebration
      if (nextStatus === 'done') {
        if (Platform.OS !== 'web') {
          Vibration.vibrate([0, 100, 50, 100]);
        }
        Alert.alert(
          '🎉 Trip Completed!',
          'Great job! You\'ve completed this trip.',
          [
            {
              text: 'Back to Dashboard',
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
  }, [updateTripStatus, setCurrentTrip, navigation, colors.success]);
  
  const cancelCountdown = () => {
    setShowCountdown(false);
    setPendingAction(null);
  };
  
  const handleCancelTrip = () => {
    setShowCancelModal(true);
  };
  
  const executeCancelTrip = async (reason: string) => {
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
      setCurrentTrip(null);
      Alert.alert('Trip Cancelled', 'The trip has been cancelled.', [
        { text: 'OK', onPress: () => navigation.navigate('Dashboard') }
      ]);
    } catch (error: any) {
      console.error('Error cancelling trip:', error);
      Alert.alert('Error', 'Failed to cancel trip. Please try again.');
    } finally {
      setIsCancelling(false);
    }
  };
  
  const handleNoShow = () => {
    Alert.alert(
      'Mark as No Show',
      'Have you waited the required time and tried to contact the passenger?',
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
    navigateToAddress(address, preferredNavigationApp, hasSetNavigationPreference, setNavigationApp);
  };
  
  // Keep handleNavigateRef in sync
  useEffect(() => {
    handleNavigateRef.current = handleNavigate;
  });
  
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
  
  const formatWaitingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
        <Text style={styles.loadingText}>Loading trip...</Text>
      </View>
    );
  }
  
  if (!trip) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Trip not found</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  const status = trip.driver_status || 'enroute';
  const statusMeta = STATUS_META[status] || STATUS_META.enroute;
  const statusButton = STATUS_BUTTONS[status] || STATUS_BUTTONS.enroute;
  const currentIndex = getCurrentStatusIndex();
  const isWaiting = status === 'waiting' || status === 'arrived';
  const isOnTheWay = status === 'passenger_onboard';
  const nextStatus = getNextStatus();
  
  // Determine which address to show prominently
  const currentDestination = isOnTheWay
    ? (trip.dropoff_address || trip.dropoff_location || 'Dropoff')
    : (trip.pickup_address || trip.pickup_location || 'Pickup');
  const destinationLabel = isOnTheWay ? 'DROPOFF' : 'PICKUP';
  
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Header with confirmation */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBack}>
          <Text style={styles.headerBackText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>#{trip.confirmation_number}</Text>
        <View style={{ width: 40 }} />
      </View>
      
      {/* Persistent Passenger Info Bar */}
      <View style={styles.passengerBar}>
        <PassengerInfoBar
          passengerName={getPassengerName()}
          passengerPhone={trip.passenger_phone}
          passengerCount={trip.passenger_count}
          compact
        />
      </View>
      
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Big Status Card */}
        <Animated.View style={[styles.statusCard, { transform: [{ scale: pulseAnim }] }]}>
          <View style={[styles.statusBadge, { backgroundColor: statusMeta.color }]}>
            <Text style={styles.statusEmoji}>{statusMeta.emoji}</Text>
            <Text style={styles.statusLabel}>{statusMeta.label}</Text>
          </View>
        </Animated.View>
        
        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>
          <View style={styles.progressDots}>
            {STATUS_FLOW.map((s, idx) => (
              <View
                key={s}
                style={[
                  styles.progressDot,
                  idx <= currentIndex && styles.progressDotActive,
                ]}
              />
            ))}
          </View>
        </View>
        
        {/* Waiting Timer (shows when arrived/waiting) */}
        {isWaiting && (
          <View style={styles.waitingCard}>
            <Text style={styles.waitingLabel}>⏱ Waiting Time</Text>
            <Text style={styles.waitingTime}>{formatWaitingTime(waitingTime)}</Text>
          </View>
        )}
        
        {/* Passenger Card */}
        <View style={styles.card}>
          <Text style={styles.passengerName}>{getPassengerName()}</Text>
          {trip.passenger_count && trip.passenger_count > 1 && (
            <Text style={styles.passengerCount}>👥 {trip.passenger_count} passengers</Text>
          )}
          
          {trip.passenger_phone && (
            <View style={styles.contactRow}>
              <TouchableOpacity style={styles.contactBtn} onPress={handleCall}>
                <Text style={styles.contactIcon}>📞</Text>
                <Text style={styles.contactBtnText}>Call</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.contactBtn} onPress={handleText}>
                <Text style={styles.contactIcon}>💬</Text>
                <Text style={styles.contactBtnText}>Text</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
        
        {/* Destination Card - Address is tappable for navigation */}
        <View style={styles.destinationCard}>
          <View style={styles.destinationHeader}>
            <View style={[styles.destinationBadge, { backgroundColor: isOnTheWay ? colors.danger : colors.success }]}>
              <Text style={styles.destinationBadgeText}>{isOnTheWay ? 'DO' : 'PU'}</Text>
            </View>
            <Text style={styles.destinationLabel}>{destinationLabel}</Text>
          </View>
          <TouchableOpacity
            onPress={() => handleNavigate(currentDestination)}
            activeOpacity={0.7}
          >
            <Text style={styles.destinationAddress}>{currentDestination}</Text>
            <Text style={styles.tapToNavigate}>Tap address to navigate 🧭</Text>
          </TouchableOpacity>
        </View>
        
        {/* Special Instructions */}
        {trip.special_instructions && (
          <View style={styles.notesCard}>
            <Text style={styles.notesLabel}>📝 Special Instructions</Text>
            <Text style={styles.notesText}>{trip.special_instructions}</Text>
          </View>
        )}
        
        {/* Quick Actions */}
        {isWaiting && (
          <TouchableOpacity style={styles.noShowButton} onPress={handleNoShow}>
            <Text style={styles.noShowButtonText}>🚫 Mark as No Show</Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity style={styles.cancelButton} onPress={handleCancelTrip}>
          <Text style={styles.cancelButtonText}>Cancel Trip</Text>
        </TouchableOpacity>
        
        <View style={{ height: isOnTheWay ? 200 : 140 }} />
      </ScrollView>
      
      {/* Geofence indicator when passenger is onboard */}
      {isOnTheWay && geofence.distanceToDestination !== null && (
        <View style={styles.geofenceIndicator}>
          <Text style={styles.geofenceText}>
            {geofence.isInsideGeofence 
              ? '📍 At dropoff location' 
              : geofence.isApproaching 
                ? `🔜 ${Math.round(geofence.distanceToDestination)}m to dropoff`
                : `📍 ${Math.round(geofence.distanceToDestination)}m to dropoff`
            }
          </Text>
          {hasConfirmedArrival && (
            <Text style={styles.geofenceConfirmed}>✅ Arrival confirmed</Text>
          )}
        </View>
      )}
      
      {/* Big Action Button */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[
            styles.actionButton, 
            { backgroundColor: statusButton.color },
          ]}
          onPress={handleAdvanceStatus}
          disabled={isUpdating}
          activeOpacity={0.8}
        >
          {isUpdating ? (
            <ActivityIndicator color="#fff" size="large" />
          ) : (
            <>
              <Text style={styles.actionButtonIcon}>
                {statusButton.icon}
              </Text>
              <Text style={styles.actionButtonText}>
                {nextStatus ? statusButton.nextLabel : 'Return to Dashboard'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
      
      {/* Mississippi Countdown Modal */}
      <MississippiCountdown
        visible={showCountdown}
        onComplete={executeStatusAdvance}
        onCancel={cancelCountdown}
        actionLabel={pendingAction?.label || 'Updating Status'}
        actionColor={pendingAction?.color || colors.primary}
      />
      
      {/* Cancel Trip Modal with Reason */}
      <CancelTripModal
        visible={showCancelModal}
        onConfirm={executeCancelTrip}
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
  loadingText: {
    marginTop: spacing.md,
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  errorText: {
    fontSize: fontSize.lg,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  backButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
  },
  backButtonText: {
    color: colors.white,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerBack: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 12,
    marginRight: 12,
  },
  headerBackText: {
    fontSize: 28,
    color: colors.text,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text,
  },
  passengerBar: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  scrollView: {
    flex: 1,
    padding: spacing.md,
  },
  statusCard: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 50,
    gap: spacing.sm,
  },
  statusEmoji: {
    fontSize: 32,
  },
  statusLabel: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.white,
  },
  progressContainer: {
    marginBottom: spacing.xl,
  },
  progressTrack: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  progressDots: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.border,
    borderWidth: 2,
    borderColor: colors.white,
  },
  progressDotActive: {
    backgroundColor: colors.primary,
  },
  waitingCard: {
    backgroundColor: colors.warning + '20',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.lg,
    borderWidth: 2,
    borderColor: colors.warning,
  },
  waitingLabel: {
    fontSize: fontSize.md,
    color: colors.warning,
    fontWeight: '600',
  },
  waitingTime: {
    fontSize: 48,
    fontWeight: '700',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  passengerName: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  passengerCount: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  contactRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  contactBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary + '15',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  contactIcon: {
    fontSize: 20,
  },
  contactBtnText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.primary,
  },
  destinationCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  destinationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  destinationBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  destinationBadgeText: {
    color: colors.white,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  destinationLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textMuted,
    letterSpacing: 1,
  },
  destinationAddress: {
    fontSize: fontSize.lg,
    color: colors.primary,
    lineHeight: 24,
    marginBottom: spacing.xs,
    textDecorationLine: 'underline',
  },
  tapToNavigate: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.headerBg,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  navButtonIcon: {
    fontSize: 20,
  },
  navButtonText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.white,
  },
  notesCard: {
    backgroundColor: colors.warning + '10',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.warning + '30',
  },
  notesLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.warning,
    marginBottom: spacing.xs,
  },
  notesText: {
    fontSize: fontSize.md,
    color: colors.text,
    lineHeight: 22,
  },
  noShowButton: {
    backgroundColor: colors.danger + '15',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  noShowButtonText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.danger,
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelButtonText: {
    fontSize: fontSize.md,
    fontWeight: '500',
    color: colors.textMuted,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    padding: spacing.md,
    paddingBottom: Platform.OS === 'ios' ? spacing.xl : spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  actionButtonExpanded: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  actionButtonIcon: {
    fontSize: 28,
  },
  actionButtonText: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.white,
  },
  
  // Geofence indicator
  geofenceIndicator: {
    position: 'absolute',
    bottom: 120,
    left: spacing.md,
    right: spacing.md,
    backgroundColor: colors.primary + '20',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
  },
  geofenceText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.primary,
  },
  geofenceConfirmed: {
    fontSize: fontSize.sm,
    color: colors.success,
    fontWeight: '600',
  },
  
  // Status menu (expandable)
  statusMenu: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 100 : 85,
    left: spacing.md,
    right: spacing.md,
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 8,
    overflow: 'hidden',
  },
  statusMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  statusMenuIcon: {
    fontSize: 24,
  },
  statusMenuText: {
    flex: 1,
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.white,
  },
  geofenceBadge: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  geofenceBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.success,
  },
});
