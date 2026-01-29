import React, { useEffect, useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore, useTripStore, useLocationStore } from '../store';
import { colors, spacing, fontSize, borderRadius } from '../config/theme';
import { STATUS_META } from '../types';
import type { Reservation, RootStackParamList } from '../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function DashboardScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { driver, signOut } = useAuthStore();
  const { trips, offers, isLoading, fetchTrips, fetchOffers } = useTripStore();
  const { startTracking, getCurrentLocation } = useLocationStore();
  const [refreshing, setRefreshing] = useState(false);
  
  // Initial load
  useEffect(() => {
    if (driver?.id) {
      fetchTrips(driver.id);
      fetchOffers(driver.id);
      getCurrentLocation();
      startTracking(driver.id);
    }
  }, [driver?.id]);
  
  // Pull to refresh
  const onRefresh = useCallback(async () => {
    if (!driver?.id) return;
    setRefreshing(true);
    await Promise.all([
      fetchTrips(driver.id),
      fetchOffers(driver.id),
    ]);
    setRefreshing(false);
  }, [driver?.id]);
  
  const formatTime = (datetime: string) => {
    return new Date(datetime).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };
  
  const formatDate = (datetime: string) => {
    const date = new Date(datetime);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
    }
  };
  
  const getPassengerName = (trip: Reservation) => {
    if (trip.passenger_name) return trip.passenger_name;
    if (trip.passenger_first_name) {
      return `${trip.passenger_first_name} ${trip.passenger_last_name || ''}`.trim();
    }
    return 'Unknown Passenger';
  };
  
  const handleTripPress = (trip: Reservation) => {
    // If trip is in progress, go to active trip screen
    if (trip.driver_status && ['enroute', 'arrived', 'waiting', 'passenger_onboard'].includes(trip.driver_status)) {
      navigation.navigate('ActiveTrip', { tripId: trip.id });
    } else {
      navigation.navigate('TripDetail', { tripId: trip.id });
    }
  };
  
  const renderTrip = ({ item: trip }: { item: Reservation }) => {
    const status = trip.driver_status || 'available';
    const statusMeta = STATUS_META[status] || STATUS_META.available;
    
    return (
      <TouchableOpacity
        style={styles.tripCard}
        onPress={() => handleTripPress(trip)}
        activeOpacity={0.7}
      >
        {/* Header Row */}
        <View style={styles.tripHeader}>
          <View style={styles.timeContainer}>
            <Text style={styles.tripDate}>{formatDate(trip.pickup_datetime)}</Text>
            <Text style={styles.tripTime}>{formatTime(trip.pickup_datetime)}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusMeta.color + '30' }]}>
            <Text style={styles.statusEmoji}>{statusMeta.emoji}</Text>
            <Text style={[styles.statusText, { color: statusMeta.color }]}>
              {statusMeta.label}
            </Text>
          </View>
        </View>
        
        {/* Passenger */}
        <Text style={styles.passengerName}>{getPassengerName(trip)}</Text>
        
        {/* Addresses */}
        <View style={styles.addressContainer}>
          <View style={styles.addressRow}>
            <View style={[styles.dot, { backgroundColor: colors.success }]} />
            <Text style={styles.addressText} numberOfLines={1}>
              {trip.pickup_address || trip.pickup_location || 'Pickup TBD'}
            </Text>
          </View>
          <View style={styles.addressLine} />
          <View style={styles.addressRow}>
            <View style={[styles.dot, { backgroundColor: colors.danger }]} />
            <Text style={styles.addressText} numberOfLines={1}>
              {trip.dropoff_address || trip.dropoff_location || 'Dropoff TBD'}
            </Text>
          </View>
        </View>
        
        {/* Footer */}
        <View style={styles.tripFooter}>
          <Text style={styles.confirmationNumber}>
            #{trip.confirmation_number}
          </Text>
          {trip.vehicle_type && (
            <Text style={styles.vehicleType}>{trip.vehicle_type}</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };
  
  const renderOffersBanner = () => {
    if (offers.length === 0) return null;
    
    return (
      <TouchableOpacity
        style={styles.offersBanner}
        onPress={() => navigation.navigate('Offers')}
      >
        <Text style={styles.offersBannerEmoji}>🔔</Text>
        <Text style={styles.offersBannerText}>
          You have {offers.length} new trip offer{offers.length > 1 ? 's' : ''}
        </Text>
        <Text style={styles.offersBannerArrow}>→</Text>
      </TouchableOpacity>
    );
  };
  
  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.welcomeContainer}>
        <Text style={styles.welcomeText}>Welcome back,</Text>
        <Text style={styles.driverName}>
          {driver?.first_name || 'Driver'}
        </Text>
      </View>
      <TouchableOpacity style={styles.profileButton} onPress={() => navigation.navigate('Profile')}>
        <Text style={styles.profileButtonText}>👤</Text>
      </TouchableOpacity>
    </View>
  );
  
  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyEmoji}>📋</Text>
      <Text style={styles.emptyTitle}>No Trips Scheduled</Text>
      <Text style={styles.emptySubtitle}>
        You don't have any upcoming trips assigned.{'\n'}
        Check back later or contact dispatch.
      </Text>
    </View>
  );
  
  if (isLoading && trips.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading trips...</Text>
      </View>
    );
  }
  
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {renderHeader()}
      {renderOffersBanner()}
      
      <FlatList
        data={trips}
        renderItem={renderTrip}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
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
    color: colors.textSecondary,
    fontSize: fontSize.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  welcomeContainer: {
    flex: 1,
  },
  welcomeText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  driverName: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text,
  },
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileButtonText: {
    fontSize: 20,
  },
  offersBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warning + '20',
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  offersBannerEmoji: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  offersBannerText: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.warning,
    fontWeight: '600',
  },
  offersBannerArrow: {
    fontSize: fontSize.lg,
    color: colors.warning,
  },
  listContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  tripCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  timeContainer: {
    flex: 1,
  },
  tripDate: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  tripTime: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  statusEmoji: {
    fontSize: 14,
    marginRight: 4,
  },
  statusText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  passengerName: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },
  addressContainer: {
    marginBottom: spacing.md,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: spacing.sm,
  },
  addressLine: {
    width: 2,
    height: 16,
    backgroundColor: colors.border,
    marginLeft: 4,
    marginVertical: 2,
  },
  addressText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  tripFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  confirmationNumber: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  vehicleType: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxl * 2,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontSize: fontSize.xl,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
