import React, { useCallback, useState, useMemo, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore, useTripStore } from '../store';
import { useSettingsStore } from '../store/useSettingsStore';
import { useTheme } from '../context';
import { spacing, fontSize, borderRadius } from '../config/theme';
import { STATUS_META } from '../types';
import type { Reservation, RootStackParamList } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function DashboardScreen() {
  const navigation = useNavigation<Nav>();
  const { driver } = useAuthStore();
  const { trips, offers, fetchAllDriverData, isLoading, subscribeToRealtime, unsubscribeFromRealtime } = useTripStore();
  const { darkMode, toggleDarkMode } = useSettingsStore();
  const { colors, isDark } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [driverStatus, setDriverStatus] = useState<'available' | 'busy' | 'offline'>('available');

  // Create dynamic styles based on current theme
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Filter out completed trips from dashboard
  const activeTrips = useMemo(() => 
    trips.filter(trip => !['done', 'completed'].includes(trip.driver_status || '')),
    [trips]
  );

  // Set up real-time subscription when component mounts
  useEffect(() => {
    if (driver?.id) {
      subscribeToRealtime(driver.id);
    }
    return () => {
      unsubscribeFromRealtime();
    };
  }, [driver?.id]);

  useFocusEffect(useCallback(() => { 
    if (driver?.id) { 
      fetchAllDriverData(driver.id); 
    } 
  }, [driver?.id]));

  const onRefresh = useCallback(async () => {
    if (!driver?.id) return;
    setRefreshing(true);
    await fetchAllDriverData(driver.id);
    setRefreshing(false);
  }, [driver?.id]);

  const formatDateTime = (dt: string) => {
    const d = new Date(dt), today = new Date(), tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = d.toDateString() === today.toDateString() ? 'Today' : d.toDateString() === tomorrow.toDateString() ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    return { date: dateStr, time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) };
  };

  const getName = (t: Reservation) => t.passenger_name || (t.passenger_first_name ? `${t.passenger_first_name} ${t.passenger_last_name || ''}`.trim() : 'Passenger');

  const toggleStatus = () => {
    const statusOrder: Array<'available' | 'busy' | 'offline'> = ['available', 'busy', 'offline'];
    const currentIndex = statusOrder.indexOf(driverStatus);
    setDriverStatus(statusOrder[(currentIndex + 1) % 3]);
  };

  const getStatusColor = () => {
    switch (driverStatus) {
      case 'available': return colors.success;
      case 'busy': return colors.warning;
      case 'offline': return colors.textSecondary;
    }
  };

  const renderTrip = ({ item: trip }: { item: Reservation }) => {
    const { date, time } = formatDateTime(trip.pickup_datetime);
    const status = trip.driver_status || 'assigned';
    const meta = STATUS_META[status] || STATUS_META.assigned;
    // Active statuses that go to ActiveTrip screen (including 'assigned' now)
    const isActiveStatus = ['assigned', 'enroute', 'arrived', 'waiting', 'passenger_onboard'].includes(status);
    return (
      <TouchableOpacity style={styles.tripCard} onPress={() => { isActiveStatus ? navigation.navigate('ActiveTrip', { tripId: trip.id }) : navigation.navigate('TripDetail', { tripId: trip.id }); }}>
        <View style={styles.tripHeader}>
          <View><Text style={styles.tripDate}>{date}</Text><Text style={styles.tripTime}>{time}</Text></View>
          <View style={[styles.statusBadge, { backgroundColor: meta.color + '20' }]}><Text style={styles.statusEmoji}>{meta.emoji}</Text><Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text></View>
        </View>
        <Text style={styles.passengerName}>{getName(trip)}</Text>
        <View style={styles.locationContainer}>
          <View style={styles.locationRow}><View style={[styles.dot, { backgroundColor: colors.success }]} /><Text style={styles.locationText} numberOfLines={1}>{trip.pickup_address || 'Pickup TBD'}</Text></View>
          <View style={styles.locationRow}><View style={[styles.dot, { backgroundColor: colors.danger }]} /><Text style={styles.locationText} numberOfLines={1}>{trip.dropoff_address || 'Dropoff TBD'}</Text></View>
        </View>
      </TouchableOpacity>
    );
  };

  if (isLoading && activeTrips.length === 0) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={colors.primary} /><Text style={styles.loadingText}>Loading trips...</Text></View>;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <FlatList data={activeTrips} renderItem={renderTrip} keyExtractor={i => String(i.id)} contentContainerStyle={styles.listContent}
        ListHeaderComponent={() => (
          <View style={styles.header}>
            {/* Status Toggle Row */}
            <View style={styles.statusRow}>
              <TouchableOpacity style={styles.statusToggle} onPress={toggleStatus}>
                <View style={[styles.statusIndicator, { backgroundColor: getStatusColor() }]} />
                <Text style={styles.statusLabel}>{driverStatus.charAt(0).toUpperCase() + driverStatus.slice(1)}</Text>
                <Text style={styles.statusTapHint}>Tap to change</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.themeToggle} onPress={toggleDarkMode}>
                <Text style={styles.themeIcon}>{darkMode ? '🌙' : '☀️'}</Text>
              </TouchableOpacity>
            </View>
            
            <Text style={styles.greeting}>Hello, {driver?.first_name || 'Driver'}! 👋</Text>
            
            {/* Quick Stats */}
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{activeTrips.length}</Text>
                <Text style={styles.statLabel}>Upcoming</Text>
              </View>
              <TouchableOpacity style={[styles.statCard, offers.length > 0 && styles.statCardHighlight]} onPress={() => navigation.navigate('Offers')}>
                <Text style={[styles.statNumber, offers.length > 0 && styles.statNumberHighlight]}>{offers.length}</Text>
                <Text style={[styles.statLabel, offers.length > 0 && styles.statLabelHighlight]}>Offers</Text>
              </TouchableOpacity>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>$0</Text>
                <Text style={styles.statLabel}>Today</Text>
              </View>
            </View>
            
            {offers.length > 0 && <TouchableOpacity style={styles.offersBanner} onPress={() => navigation.navigate('Offers')}><Text style={styles.offersBannerText}>🔔 {offers.length} new offer{offers.length > 1 ? 's' : ''} - Tap to view</Text><Text style={styles.offersBannerArrow}>→</Text></TouchableOpacity>}
            <Text style={styles.sectionTitle}>Your Trips</Text>
          </View>
        )}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>📅</Text>
            <Text style={styles.emptyTitle}>No Trips Scheduled</Text>
            <Text style={styles.emptySubtitle}>When you're assigned trips, they'll appear here.</Text>
            <TouchableOpacity style={styles.emptyButton} onPress={() => navigation.navigate('Offers')}>
              <Text style={styles.emptyButtonText}>Check Trip Offers</Text>
            </TouchableOpacity>
          </View>
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      />
      
      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem}>
          <Text style={styles.navIcon}>🏠</Text>
          <Text style={[styles.navLabel, styles.navLabelActive]}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Messages')}>
          <Text style={styles.navIcon}>💬</Text>
          <Text style={styles.navLabel}>Messages</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Calendar')}>
          <Text style={styles.navIcon}>📅</Text>
          <Text style={styles.navLabel}>Calendar</Text>
          {activeTrips.length > 0 && <View style={styles.navBadge}><Text style={styles.navBadgeText}>{activeTrips.length}</Text></View>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Settings')}>
          <View style={styles.settingsAvatar}>
            <Text style={styles.settingsAvatarText}>
              {driver?.first_name?.[0]?.toUpperCase() || '?'}
            </Text>
          </View>
          <Text style={styles.navLabel}>Settings</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// Create dynamic styles based on theme colors
const createStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  loadingText: { marginTop: spacing.md, fontSize: fontSize.md, color: colors.textSecondary },
  listContent: { padding: spacing.lg, paddingBottom: 100 },
  header: { marginBottom: spacing.lg },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  statusToggle: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, padding: spacing.md, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border },
  statusIndicator: { width: 12, height: 12, borderRadius: 6, marginRight: spacing.sm },
  statusLabel: { fontSize: fontSize.lg, fontWeight: '600', color: colors.text, flex: 1 },
  statusTapHint: { fontSize: fontSize.sm, color: colors.textSecondary },
  themeToggle: { width: 48, height: 48, backgroundColor: colors.surface, borderRadius: borderRadius.lg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  themeIcon: { fontSize: 24 },
  greeting: { fontSize: fontSize.xxl, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  statCard: { flex: 1, backgroundColor: colors.surface, padding: spacing.md, borderRadius: borderRadius.lg, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  statCardHighlight: { backgroundColor: colors.primary, borderColor: colors.primary },
  statNumber: { fontSize: fontSize.xxl, fontWeight: '700', color: colors.text },
  statNumberHighlight: { color: colors.white },
  statLabel: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  statLabelHighlight: { color: colors.white + 'cc' },
  offersBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.primary + '20', borderWidth: 1, borderColor: colors.primary, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.lg },
  offersBannerText: { fontSize: fontSize.md, fontWeight: '600', color: colors.primary },
  offersBannerArrow: { fontSize: fontSize.lg, color: colors.primary },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  tripCard: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  tripHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.sm },
  tripDate: { fontSize: fontSize.sm, color: colors.textSecondary },
  tripTime: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: borderRadius.full, gap: 4 },
  statusEmoji: { fontSize: 14 },
  statusText: { fontSize: fontSize.sm, fontWeight: '600' },
  passengerName: { fontSize: fontSize.lg, fontWeight: '600', color: colors.text, marginBottom: spacing.sm },
  locationContainer: { marginBottom: spacing.xs },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: spacing.sm },
  locationText: { flex: 1, fontSize: fontSize.sm, color: colors.textSecondary },
  emptyContainer: { alignItems: 'center', paddingVertical: spacing.xxl * 2 },
  emptyEmoji: { fontSize: 64, marginBottom: spacing.lg },
  emptyTitle: { fontSize: fontSize.xl, fontWeight: '600', color: colors.text, marginBottom: spacing.sm },
  emptySubtitle: { fontSize: fontSize.md, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.lg },
  emptyButton: { backgroundColor: colors.primary, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: borderRadius.lg },
  emptyButtonText: { color: colors.white, fontSize: fontSize.md, fontWeight: '600' },
  bottomNav: { flexDirection: 'row', backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  navItem: { flex: 1, alignItems: 'center', position: 'relative' },
  navIcon: { fontSize: 24, marginBottom: 2 },
  navLabel: { fontSize: fontSize.xs, color: colors.textSecondary },
  navLabelActive: { color: colors.primary, fontWeight: '600' },
  navBadge: { position: 'absolute', top: -4, right: '25%', backgroundColor: colors.danger, borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  navBadgeText: { color: colors.white, fontSize: 10, fontWeight: '700' },
  settingsAvatar: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  settingsAvatarText: { color: colors.white, fontSize: 12, fontWeight: '700' },
});
