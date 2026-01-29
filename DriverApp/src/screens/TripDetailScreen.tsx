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
import { useTripStore, useAuthStore } from '../store';
import { supabase } from '../config/supabase';
import { colors, spacing, fontSize, borderRadius } from '../config/theme';
import { STATUS_META } from '../types';
import type { Reservation, RootStackParamList } from '../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteParams = RouteProp<RootStackParamList, 'TripDetail'>;

export default function TripDetailScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteParams>();
  const { tripId } = route.params;
  const { driver } = useAuthStore();
  const { updateTripStatus, setCurrentTrip } = useTripStore();
  
  const [trip, setTrip] = useState<Reservation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
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
  
  const getPassengerName = () => {
    if (!trip) return 'Unknown';
    if (trip.passenger_name) return trip.passenger_name;
    if (trip.passenger_first_name) {
      return `${trip.passenger_first_name} ${trip.passenger_last_name || ''}`.trim();
    }
    return 'Unknown Passenger';
  };
  
  const handleCall = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };
  
  const handleText = (phone: string) => {
    Linking.openURL(`sms:${phone}`);
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
              // Fallback to web
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
  
  const handleStartTrip = async () => {
    if (!trip) return;
    
    Alert.alert(
      'Start Trip',
      'Are you ready to start this trip?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start',
          onPress: async () => {
            const result = await updateTripStatus(trip.id, 'getting_ready');
            if (result.success) {
              setCurrentTrip({ ...trip, driver_status: 'getting_ready' });
              navigation.navigate('ActiveTrip', { tripId: trip.id });
            } else {
              Alert.alert('Error', result.error || 'Failed to start trip');
            }
          },
        },
      ]
    );
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
        
        {/* Passenger Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Passenger</Text>
          <Text style={styles.passengerName}>{getPassengerName()}</Text>
          
          {trip.passenger_phone && (
            <View style={styles.contactButtons}>
              <TouchableOpacity
                style={styles.contactButton}
                onPress={() => handleCall(trip.passenger_phone!)}
              >
                <Text style={styles.contactButtonEmoji}>📞</Text>
                <Text style={styles.contactButtonText}>Call</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.contactButton}
                onPress={() => handleText(trip.passenger_phone!)}
              >
                <Text style={styles.contactButtonEmoji}>💬</Text>
                <Text style={styles.contactButtonText}>Text</Text>
              </TouchableOpacity>
            </View>
          )}
          
          {trip.passenger_count && trip.passenger_count > 1 && (
            <Text style={styles.passengerCount}>
              👥 {trip.passenger_count} passengers
            </Text>
          )}
        </View>
        
        {/* Locations */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Route</Text>
          
          {/* Pickup */}
          <TouchableOpacity
            style={styles.locationRow}
            onPress={() => handleNavigate(trip.pickup_address || trip.pickup_location || '')}
          >
            <View style={[styles.locationDot, { backgroundColor: colors.success }]} />
            <View style={styles.locationInfo}>
              <Text style={styles.locationLabel}>PICKUP</Text>
              <Text style={styles.locationAddress}>
                {trip.pickup_address || trip.pickup_location || 'Not specified'}
              </Text>
            </View>
            <Text style={styles.navArrow}>→</Text>
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
                <Text style={styles.locationAddress}>{trip.stop1_address}</Text>
              </View>
              <Text style={styles.navArrow}>→</Text>
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
                <Text style={styles.locationAddress}>{trip.stop2_address}</Text>
              </View>
              <Text style={styles.navArrow}>→</Text>
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
              <Text style={styles.locationAddress}>
                {trip.dropoff_address || trip.dropoff_location || 'Not specified'}
              </Text>
            </View>
            <Text style={styles.navArrow}>→</Text>
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
        
        <View style={{ height: 100 }} />
      </ScrollView>
      
      {/* Start Trip Button */}
      {(!trip.driver_status || trip.driver_status === 'available') && (
        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.startButton} onPress={handleStartTrip}>
            <Text style={styles.startButtonText}>Start Trip</Text>
          </TouchableOpacity>
        </View>
      )}
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
