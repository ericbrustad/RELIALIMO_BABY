import React, { useEffect, useState, useRef } from 'react';
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
import { useTripStore, useLocationStore, useSettingsStore } from '../store';
import { supabase } from '../config/supabase';
import { colors, spacing, fontSize, borderRadius } from '../config/theme';
import { STATUS_META } from '../types';
import type { Reservation, DriverStatus, RootStackParamList } from '../types';
import MississippiCountdown from '../components/MississippiCountdown';
import { navigateToAddress } from '../utils/navigation';

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

// Status button configurations
const STATUS_BUTTONS: Record<DriverStatus, { nextLabel: string; icon: string; color: string }> = {
  getting_ready: { nextLabel: 'Start Trip', icon: '🚗', color: colors.primary },
  enroute: { nextLabel: 'I\'ve Arrived', icon: '📍', color: colors.warning },
  arrived: { nextLabel: 'Start Waiting', icon: '⏱', color: colors.warning },
  waiting: { nextLabel: 'Passenger In', icon: '👤', color: colors.success },
  passenger_onboard: { nextLabel: 'Complete Trip', icon: '🏁', color: colors.success },
  done: { nextLabel: 'Done!', icon: '✅', color: colors.success },
  available: { nextLabel: 'Start', icon: '▶️', color: colors.primary },
  completed: { nextLabel: 'Completed', icon: '✅', color: colors.success },
  busy: { nextLabel: 'Continue', icon: '▶️', color: colors.primary },
  offline: { nextLabel: 'Go Online', icon: '🟢', color: colors.success },
  cancelled: { nextLabel: 'Cancelled', icon: '❌', color: colors.danger },
  no_show: { nextLabel: 'No Show', icon: '🚫', color: colors.danger },
};

export default function ActiveTripScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteParams>();
  const { tripId } = route.params;
  const { updateTripStatus, setCurrentTrip } = useTripStore();
  const { startTracking, stopTracking, location } = useLocationStore();
  const { preferredNavigationApp, hasSetNavigationPreference, setNavigationApp } = useSettingsStore();
  
  const [trip, setTrip] = useState<Reservation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [waitingTime, setWaitingTime] = useState(0);
  const [showCountdown, setShowCountdown] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ label: string; color: string } | null>(null);
  
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
      
      // If trip doesn't have a valid active status, initialize to getting_ready
      const activeStatuses: DriverStatus[] = ['getting_ready', 'enroute', 'arrived', 'waiting', 'passenger_onboard', 'done'];
      if (!data.driver_status || !activeStatuses.includes(data.driver_status)) {
        console.log('📋 Initializing trip status to getting_ready (current:', data.driver_status, ')');
        // Update database
        const { error: updateError } = await supabase
          .from('reservations')
          .update({ driver_status: 'getting_ready', updated_at: new Date().toISOString() })
          .eq('id', tripId);
        
        if (updateError) {
          console.error('Error initializing trip status:', updateError);
          Alert.alert('Database Error', `Could not update status: ${updateError.message}`);
        } else {
          console.log('✅ Status updated to getting_ready in database');
          data.driver_status = 'getting_ready';
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
    
    const status = trip.driver_status || 'getting_ready';
    const statusButton = STATUS_BUTTONS[status] || STATUS_BUTTONS.getting_ready;
    
    // Start the Mississippi countdown
    console.log('🚀 Starting Mississippi countdown!', { label: statusButton.nextLabel, color: statusButton.color });
    setPendingAction({ label: statusButton.nextLabel, color: statusButton.color });
    setShowCountdown(true);
  };
  
  // Called when countdown completes
  const executeStatusAdvance = async () => {
    console.log('🎯 executeStatusAdvance called! Countdown complete.');
    setShowCountdown(false);
    setPendingAction(null);
    
    if (!trip) return;
    
    const nextStatus = getNextStatus();
    if (!nextStatus) return;
    
    // Haptic feedback
    if (Platform.OS !== 'web') {
      Vibration.vibrate(50);
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
        setWaitingTime(0); // Reset waiting timer
        const address = trip.dropoff_address || trip.dropoff_location;
        if (address) {
          Alert.alert(
            'Navigate to Dropoff?',
            'Open navigation to the dropoff location?',
            [
              { text: 'Not Now', style: 'cancel' },
              { text: 'Navigate', onPress: () => handleNavigate(address) },
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
  };
  
  const cancelCountdown = () => {
    setShowCountdown(false);
    setPendingAction(null);
  };
  
  const handleCancelTrip = () => {
    Alert.alert(
      'Cancel Trip',
      'Are you sure? This should only be done if instructed by dispatch.',
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
  
  const status = trip.driver_status || 'getting_ready';
  const statusMeta = STATUS_META[status] || STATUS_META.getting_ready;
  const statusButton = STATUS_BUTTONS[status] || STATUS_BUTTONS.getting_ready;
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
        
        {/* Destination Card */}
        <View style={styles.destinationCard}>
          <View style={styles.destinationHeader}>
            <View style={[styles.destinationBadge, { backgroundColor: isOnTheWay ? colors.danger : colors.success }]}>
              <Text style={styles.destinationBadgeText}>{isOnTheWay ? 'DO' : 'PU'}</Text>
            </View>
            <Text style={styles.destinationLabel}>{destinationLabel}</Text>
          </View>
          <Text style={styles.destinationAddress}>{currentDestination}</Text>
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => handleNavigate(currentDestination)}
          >
            <Text style={styles.navButtonIcon}>🧭</Text>
            <Text style={styles.navButtonText}>Navigate</Text>
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
        
        <View style={{ height: 140 }} />
      </ScrollView>
      
      {/* Big Action Button */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: statusButton.color }]}
          onPress={handleAdvanceStatus}
          disabled={isUpdating}
          activeOpacity={0.8}
        >
          {isUpdating ? (
            <ActivityIndicator color="#fff" size="large" />
          ) : (
            <>
              <Text style={styles.actionButtonIcon}>{statusButton.icon}</Text>
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
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerBack: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerBackText: {
    fontSize: 24,
    color: colors.text,
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text,
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
    color: colors.text,
    lineHeight: 24,
    marginBottom: spacing.md,
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
  actionButtonIcon: {
    fontSize: 28,
  },
  actionButtonText: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.white,
  },
});
