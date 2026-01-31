/**
 * TripHistoryScreen
 * Shows completed trips with details, timestamps, and payment info
 */

import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../config/supabase';
import { useAuthStore } from '../store';
import { useTheme } from '../context';
import BackButton from '../components/BackButton';
import type { Reservation } from '../types';

interface TripHistoryItem extends Reservation {
  departed_at?: string;
  arrived_at?: string;
  picked_up_at?: string;
  completed_at?: string;
  driver_pay?: number;
}

export default function TripHistoryScreen() {
  const navigation = useNavigation();
  const { driver } = useAuthStore();
  const { colors } = useTheme();
  const [trips, setTrips] = useState<TripHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedTrip, setExpandedTrip] = useState<string | number | null>(null);

  const styles = useMemo(() => createStyles(colors), [colors]);

  const fetchTripHistory = async () => {
    if (!driver?.id) return;

    try {
      const { data, error } = await supabase
        .from('reservations')
        .select('*')
        .eq('assigned_driver_id', driver.id)
        .in('driver_status', ['done', 'completed'])
        .order('completed_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setTrips(data || []);
    } catch (error) {
      console.error('Error fetching trip history:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTripHistory();
  }, [driver?.id]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTripHistory();
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (dateString: string | undefined) => {
    if (!dateString) return '--:--';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatCurrency = (amount: number | undefined) => {
    if (amount === undefined || amount === null) return '$0.00';
    return `$${amount.toFixed(2)}`;
  };

  const calculateDuration = (start: string | undefined, end: string | undefined) => {
    if (!start || !end) return 'N/A';
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffMs = endDate.getTime() - startDate.getTime();
    const diffMins = Math.round(diffMs / 60000);
    if (diffMins < 60) return `${diffMins} min`;
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hours}h ${mins}m`;
  };

  const renderTripCard = (trip: TripHistoryItem) => {
    const isExpanded = expandedTrip === trip.id;
    const passengerName = trip.passenger_name || 
      `${trip.passenger_first_name || ''} ${trip.passenger_last_name || ''}`.trim() || 
      'Unknown Passenger';

    return (
      <TouchableOpacity
        key={trip.id}
        style={styles.tripCard}
        onPress={() => setExpandedTrip(isExpanded ? null : trip.id)}
        activeOpacity={0.7}
      >
        <View style={styles.tripHeader}>
          <View style={styles.tripDateContainer}>
            <Text style={styles.tripDate}>{formatDate(trip.completed_at || trip.pickup_datetime)}</Text>
            <Text style={styles.confirmationNumber}>#{trip.confirmation_number}</Text>
          </View>
          <View style={styles.tripPayContainer}>
            <Text style={styles.tripPay}>{formatCurrency(trip.driver_pay)}</Text>
            <Text style={styles.paidLabel}>Paid</Text>
          </View>
        </View>

        <View style={styles.tripLocations}>
          <View style={styles.locationRow}>
            <Text style={styles.locationIcon}>📍</Text>
            <Text style={styles.locationText} numberOfLines={1}>
              {trip.pickup_address || trip.pickup_location || 'Pickup location'}
            </Text>
          </View>
          <View style={styles.locationRow}>
            <Text style={styles.locationIcon}>🏁</Text>
            <Text style={styles.locationText} numberOfLines={1}>
              {trip.dropoff_address || trip.dropoff_location || 'Dropoff location'}
            </Text>
          </View>
        </View>

        <View style={styles.tripSummary}>
          <Text style={styles.passengerName}>{passengerName}</Text>
          <Text style={styles.expandIcon}>{isExpanded ? '▲' : '▼'}</Text>
        </View>

        {isExpanded && (
          <View style={styles.tripDetails}>
            <Text style={styles.detailsTitle}>Trip Timeline</Text>
            
            <View style={styles.timelineContainer}>
              <View style={styles.timelineItem}>
                <View style={[styles.timelineDot, { backgroundColor: colors.primary }]} />
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineLabel}>Departed to Pickup</Text>
                  <Text style={styles.timelineTime}>{formatTime(trip.departed_at)}</Text>
                </View>
              </View>

              <View style={styles.timelineItem}>
                <View style={[styles.timelineDot, { backgroundColor: colors.warning }]} />
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineLabel}>Arrived at Pickup</Text>
                  <Text style={styles.timelineTime}>{formatTime(trip.arrived_at)}</Text>
                </View>
              </View>

              <View style={styles.timelineItem}>
                <View style={[styles.timelineDot, { backgroundColor: colors.info }]} />
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineLabel}>Passenger Picked Up</Text>
                  <Text style={styles.timelineTime}>{formatTime(trip.picked_up_at)}</Text>
                </View>
              </View>

              <View style={styles.timelineItem}>
                <View style={[styles.timelineDot, { backgroundColor: colors.success }]} />
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineLabel}>Trip Completed</Text>
                  <Text style={styles.timelineTime}>{formatTime(trip.completed_at)}</Text>
                </View>
              </View>
            </View>

            <View style={styles.tripStats}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Total Duration</Text>
                <Text style={styles.statValue}>
                  {calculateDuration(trip.departed_at, trip.completed_at)}
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Driver Pay</Text>
                <Text style={[styles.statValue, { color: colors.success }]}>
                  {formatCurrency(trip.driver_pay)}
                </Text>
              </View>
            </View>

            {trip.special_instructions && (
              <View style={styles.notesSection}>
                <Text style={styles.notesLabel}>Notes</Text>
                <Text style={styles.notesText}>{trip.special_instructions}</Text>
              </View>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // Calculate total earnings
  const totalEarnings = trips.reduce((sum, trip) => sum + (trip.driver_pay || 0), 0);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <BackButton title="Settings" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading trip history...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <BackButton title="Settings" />
      
      <View style={styles.header}>
        <Text style={styles.title}>Trip History</Text>
        <View style={styles.summaryCard}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{trips.length}</Text>
            <Text style={styles.summaryLabel}>Trips</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: colors.success }]}>
              {formatCurrency(totalEarnings)}
            </Text>
            <Text style={styles.summaryLabel}>Total Earned</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {trips.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyTitle}>No Completed Trips</Text>
            <Text style={styles.emptyText}>
              Your completed trips will appear here with timestamps and payment details.
            </Text>
          </View>
        ) : (
          trips.map(renderTripCard)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.textSecondary,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
  },
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginHorizontal: 16,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  summaryLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 8,
  },
  tripCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  tripDateContainer: {
    flex: 1,
  },
  tripDate: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  confirmationNumber: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  tripPayContainer: {
    alignItems: 'flex-end',
  },
  tripPay: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.success,
  },
  paidLabel: {
    fontSize: 12,
    color: colors.success,
    fontWeight: '500',
  },
  tripLocations: {
    marginBottom: 12,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  locationIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  locationText: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
  },
  tripSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
  },
  passengerName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  expandIcon: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  tripDetails: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  detailsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
  },
  timelineContainer: {
    marginBottom: 16,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
    marginTop: 4,
  },
  timelineContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timelineLabel: {
    fontSize: 14,
    color: colors.text,
  },
  timelineTime: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tripStats: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  notesSection: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 12,
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  notesText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 20,
  },
});
