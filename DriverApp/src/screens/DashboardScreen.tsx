import React, { useEffect, useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Switch,
  Image,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore, useTripStore, useLocationStore } from '../store';
import { colors, spacing, fontSize, borderRadius } from '../config/theme';
import type { Reservation, RootStackParamList } from '../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type TabType = 'pending' | 'upcoming' | 'inProgress';

export default function DashboardScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { driver } = useAuthStore();
  const { trips, offers, isLoading, fetchTrips, fetchOffers } = useTripStore();
  const { startTracking, getCurrentLocation } = useLocationStore();
  const [refreshing, setRefreshing] = useState(false);
  const [onDuty, setOnDuty] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('upcoming');
  
  // Categorize trips
  const categorizedTrips = React.useMemo(() => {
    const pending: Reservation[] = [];
    const upcoming: Reservation[] = [];
    const inProgress: Reservation[] = [];
    
    trips.forEach(trip => {
      const status = trip.driver_status?.toLowerCase() || '';
      if (['enroute', 'arrived', 'waiting', 'passenger_onboard', 'on_the_way'].includes(status)) {
        inProgress.push(trip);
      } else if (status === 'pending' || status === 'offered') {
        pending.push(trip);
      } else {
        upcoming.push(trip);
      }
    });
    
    return { pending, upcoming, inProgress };
  }, [trips]);
  
  useEffect(() => {
    if (driver?.id) {
      fetchTrips(driver.id);
      fetchOffers(driver.id);
      getCurrentLocation();
      startTracking(driver.id);
    }
  }, [driver?.id]);
  
  const onRefresh = useCallback(async () => {
    if (!driver?.id) return;
    setRefreshing(true);
    await Promise.all([fetchTrips(driver.id), fetchOffers(driver.id)]);
    setRefreshing(false);
  }, [driver?.id]);
  
  const formatTime = (datetime: string) => {
    return new Date(datetime).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };
  
  const formatDate = (datetime: string) => {
    const date = new Date(datetime);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
    });
  };
  
  const getPassengerName = (trip: Reservation) => {
    if (trip.passenger_name) return trip.passenger_name;
    if (trip.passenger_first_name) {
      return `${trip.passenger_first_name} ${trip.passenger_last_name || ''}`.trim();
    }
    return 'Unknown Passenger';
  };
  
  const handleTripPress = (trip: Reservation) => {
    const status = trip.driver_status?.toLowerCase() || '';
    if (['enroute', 'arrived', 'waiting', 'passenger_onboard', 'on_the_way'].includes(status)) {
      navigation.navigate('ActiveTrip', { tripId: trip.id });
    } else {
      navigation.navigate('TripDetail', { tripId: trip.id });
    }
  };
  
  const openMaps = (address: string) => {
    const url = Platform.select({
      ios: `maps:0,0?q=${encodeURIComponent(address)}`,
      android: `geo:0,0?q=${encodeURIComponent(address)}`,
    });
    if (url) Linking.openURL(url);
  };
  
  const callPassenger = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };
  
  const getStatusLabel = (status: string | undefined) => {
    const s = status?.toLowerCase() || '';
    const labels: Record<string, string> = {
      'enroute': 'ON THE WAY',
      'on_the_way': 'ON THE WAY',
      'arrived': 'ARRIVED',
      'waiting': 'WAITING',
      'passenger_onboard': 'IN PROGRESS',
      'assigned': 'ASSIGNED',
      'confirmed': 'CONFIRMED',
    };
    return labels[s] || 'SCHEDULED';
  };
  
  const renderTripCard = ({ item: trip }: { item: Reservation }) => {
    const isInProgress = activeTab === 'inProgress';
    const statusLabel = getStatusLabel(trip.driver_status);
    
    return (
      <TouchableOpacity
        style={styles.tripCard}
        onPress={() => handleTripPress(trip)}
        activeOpacity={0.9}
      >
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.cardTime}>{formatTime(trip.pickup_datetime)}, {formatDate(trip.pickup_datetime)}</Text>
            <Text style={styles.cardPassenger}>{getPassengerName(trip)}</Text>
          </View>
          <Text style={styles.cardConfirmation}>#{trip.confirmation_number}</Text>
        </View>
        
        <View style={styles.cardBody}>
          <View style={styles.addressRow}>
            <View style={[styles.addressBadge, { backgroundColor: colors.success }]}>
              <Text style={styles.addressBadgeText}>PU</Text>
            </View>
            <Text style={styles.addressText} numberOfLines={2}>
              {trip.pickup_address || trip.pickup_location || 'Pickup TBD'}
            </Text>
          </View>
          
          <View style={styles.addressRow}>
            <View style={[styles.addressBadge, { backgroundColor: colors.headerBg }]}>
              <Text style={styles.addressBadgeText}>DO</Text>
            </View>
            <View style={styles.dropoffContainer}>
              <Text style={styles.addressText} numberOfLines={2}>
                {trip.dropoff_address || trip.dropoff_location || 'Dropoff TBD'}
              </Text>
              {trip.airline_name && (
                <View style={styles.flightInfo}>
                  <Text style={styles.flightStatus}>Flight Status: <Text style={styles.flightStatusValue}>Scheduled</Text></Text>
                  <Text style={styles.flightDetails}>
                    ✈️ {trip.flight_number || 'N/A'}, {trip.airline_name}
                  </Text>
                </View>
              )}
            </View>
          </View>
          
          {trip.vehicle_type && (
            <View style={styles.vehicleRow}>
              <Text style={styles.vehicleIcon}>🚗</Text>
              <Text style={styles.vehicleText}>{trip.vehicle_type}</Text>
            </View>
          )}
          
          <View style={styles.actionIcons}>
            <TouchableOpacity style={styles.actionIcon} onPress={() => openMaps(trip.pickup_address || '')}>
              <Text style={styles.actionIconText}>🗺️</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionIcon}>
              <Text style={styles.actionIconText}>✈️</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionIcon} onPress={() => trip.passenger_phone && callPassenger(trip.passenger_phone)}>
              <Text style={styles.actionIconText}>📞</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionIcon, styles.actionIconAlert]}>
              <Text style={styles.actionIconText}>⚠️</Text>
            </TouchableOpacity>
          </View>
          
          {isInProgress ? (
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Current Status</Text>
              <TouchableOpacity style={styles.statusButton}>
                <Text style={styles.statusButtonText}>{statusLabel}</Text>
                <Text style={styles.statusArrow}>›</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.buttonsRow}>
              <TouchableOpacity style={styles.changeStatusBtn}>
                <Text style={styles.changeStatusText}>CHANGE STATUS</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.startTripBtn} onPress={() => handleTripPress(trip)}>
                <Text style={styles.startTripText}>START TRIP</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };
  
  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.avatarText}>{driver?.first_name?.[0] || 'D'}</Text>
        </View>
        <Text style={styles.greeting}>Hi, {driver?.first_name || 'Driver'}!</Text>
      </View>
      <View style={styles.headerRight}>
        <Text style={styles.dutyLabel}>ON DUTY</Text>
        <Switch
          value={onDuty}
          onValueChange={setOnDuty}
          trackColor={{ false: '#ccc', true: colors.success }}
          thumbColor={colors.white}
        />
      </View>
    </View>
  );
  
  const renderTabs = () => {
    const tabs: { key: TabType; label: string; count: number }[] = [
      { key: 'pending', label: 'PENDING', count: categorizedTrips.pending.length },
      { key: 'upcoming', label: 'UPCOMING', count: categorizedTrips.upcoming.length },
      { key: 'inProgress', label: 'IN PROGRESS', count: categorizedTrips.inProgress.length },
    ];
    
    return (
      <View style={styles.tabsContainer}>
        {tabs.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
            {tab.count > 0 && (
              <View style={[styles.tabBadge, activeTab === tab.key && styles.tabBadgeActive]}>
                <Text style={styles.tabBadgeText}>{tab.count}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
    );
  };
  
  const getCurrentTrips = () => {
    switch (activeTab) {
      case 'pending': return categorizedTrips.pending;
      case 'upcoming': return categorizedTrips.upcoming;
      case 'inProgress': return categorizedTrips.inProgress;
    }
  };
  
  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyEmoji}>📋</Text>
      <Text style={styles.emptyTitle}>No Trips</Text>
      <Text style={styles.emptySubtitle}>No trips in this category.</Text>
    </View>
  );
  
  const renderBottomNav = () => (
    <View style={styles.bottomNav}>
      <TouchableOpacity style={styles.navItem}><Text style={[styles.navIcon, styles.navIconActive]}>📅</Text></TouchableOpacity>
      <TouchableOpacity style={styles.navItem}><Text style={styles.navIcon}>🔍</Text></TouchableOpacity>
      <TouchableOpacity style={styles.navItem}><Text style={styles.navIcon}>💬</Text></TouchableOpacity>
      <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Profile')}><Text style={styles.navIcon}>⚙️</Text></TouchableOpacity>
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
      {renderTabs()}
      <FlatList
        data={getCurrentTrips()}
        renderItem={renderTripCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmpty}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
      />
      {renderBottomNav()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  loadingText: { marginTop: spacing.md, color: colors.textSecondary, fontSize: fontSize.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  avatarPlaceholder: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: spacing.sm },
  avatarText: { color: colors.white, fontSize: fontSize.lg, fontWeight: '600' },
  greeting: { fontSize: fontSize.lg, fontWeight: '600', color: colors.text },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  dutyLabel: { fontSize: fontSize.sm, color: colors.textSecondary, marginRight: spacing.sm, fontWeight: '500' },
  tabsContainer: { flexDirection: 'row', backgroundColor: colors.white, borderBottomWidth: 2, borderBottomColor: colors.border },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.md },
  tabActive: { borderBottomWidth: 3, borderBottomColor: colors.primary, marginBottom: -2 },
  tabText: { fontSize: fontSize.sm, fontWeight: '600', color: colors.tabInactive },
  tabTextActive: { color: colors.primary },
  tabBadge: { backgroundColor: colors.textMuted, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2, marginLeft: 4 },
  tabBadgeActive: { backgroundColor: colors.primary },
  tabBadgeText: { color: colors.white, fontSize: 11, fontWeight: '700' },
  listContent: { padding: spacing.md, paddingBottom: 80 },
  tripCard: { marginBottom: spacing.md, borderRadius: borderRadius.lg, overflow: 'hidden', backgroundColor: colors.white, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  cardHeader: { backgroundColor: colors.headerBg, padding: spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardTime: { fontSize: fontSize.md, fontWeight: '600', color: colors.white },
  cardPassenger: { fontSize: fontSize.lg, fontWeight: '700', color: colors.white, marginTop: 2 },
  cardConfirmation: { fontSize: fontSize.md, color: colors.white, opacity: 0.8 },
  cardBody: { padding: spacing.md },
  addressRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.md },
  addressBadge: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: spacing.sm },
  addressBadgeText: { color: colors.white, fontSize: 10, fontWeight: '700' },
  addressText: { flex: 1, fontSize: fontSize.md, color: colors.text, lineHeight: 20 },
  dropoffContainer: { flex: 1 },
  flightInfo: { backgroundColor: '#f8f9fa', borderRadius: borderRadius.sm, padding: spacing.sm, marginTop: spacing.sm },
  flightStatus: { fontSize: fontSize.sm, color: colors.textSecondary },
  flightStatusValue: { color: colors.success, fontWeight: '600' },
  flightDetails: { fontSize: fontSize.sm, color: colors.text, marginTop: 4 },
  vehicleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  vehicleIcon: { fontSize: 18, marginRight: spacing.sm },
  vehicleText: { fontSize: fontSize.md, color: colors.text },
  actionIcons: { flexDirection: 'row', justifyContent: 'flex-start', marginBottom: spacing.md, gap: spacing.sm },
  actionIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' },
  actionIconAlert: { backgroundColor: colors.primary },
  actionIconText: { fontSize: 18 },
  statusRow: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md },
  statusLabel: { fontSize: fontSize.sm, color: colors.textSecondary },
  statusButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  statusButtonText: { fontSize: fontSize.lg, fontWeight: '700', color: colors.success },
  statusArrow: { fontSize: 24, color: colors.primary },
  buttonsRow: { flexDirection: 'row', gap: spacing.sm },
  changeStatusBtn: { flex: 1, paddingVertical: spacing.sm, borderRadius: borderRadius.md, borderWidth: 2, borderColor: colors.border, alignItems: 'center' },
  changeStatusText: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text },
  startTripBtn: { flex: 1, paddingVertical: spacing.sm, borderRadius: borderRadius.md, backgroundColor: colors.primary, alignItems: 'center' },
  startTripText: { fontSize: fontSize.sm, fontWeight: '600', color: colors.white },
  emptyContainer: { alignItems: 'center', paddingVertical: spacing.xxl * 2 },
  emptyEmoji: { fontSize: 64, marginBottom: spacing.lg },
  emptyTitle: { fontSize: fontSize.xl, fontWeight: '600', color: colors.text, marginBottom: spacing.sm },
  emptySubtitle: { fontSize: fontSize.md, color: colors.textSecondary, textAlign: 'center' },
  bottomNav: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.border, paddingBottom: Platform.OS === 'ios' ? 20 : 0 },
  navItem: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm },
  navIcon: { fontSize: 24, opacity: 0.5 },
  navIconActive: { opacity: 1 },
});
