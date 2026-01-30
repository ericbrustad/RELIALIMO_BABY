import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore, useTripStore } from '../store';
import { colors, spacing, fontSize, borderRadius } from '../config/theme';
import { STATUS_META } from '../types';
import type { Reservation, RootStackParamList } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function DashboardScreen() {
  const navigation = useNavigation<Nav>();
  const { driver } = useAuthStore();
  const { trips, offers, fetchTrips, fetchOffers, isLoading } = useTripStore();
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(useCallback(() => { if (driver?.id) { fetchTrips(driver.id); fetchOffers(driver.id); } }, [driver?.id]));

  const onRefresh = useCallback(async () => {
    if (!driver?.id) return;
    setRefreshing(true);
    await Promise.all([fetchTrips(driver.id), fetchOffers(driver.id)]);
    setRefreshing(false);
  }, [driver?.id]);

  const formatDateTime = (dt: string) => {
    const d = new Date(dt), today = new Date(), tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = d.toDateString() === today.toDateString() ? 'Today' : d.toDateString() === tomorrow.toDateString() ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    return { date: dateStr, time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) };
  };

  const getName = (t: Reservation) => t.passenger_name || (t.passenger_first_name ? `${t.passenger_first_name} ${t.passenger_last_name || ''}`.trim() : 'Passenger');

  const renderTrip = ({ item: trip }: { item: Reservation }) => {
    const { date, time } = formatDateTime(trip.pickup_datetime);
    const status = trip.driver_status || 'available';
    const meta = STATUS_META[status] || STATUS_META.available;
    return (
      <TouchableOpacity style={styles.tripCard} onPress={() => { ['getting_ready', 'enroute', 'arrived', 'waiting', 'passenger_onboard'].includes(status) ? navigation.navigate('ActiveTrip', { tripId: trip.id }) : navigation.navigate('TripDetail', { tripId: trip.id }); }}>
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

  if (isLoading && trips.length === 0) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={colors.primary} /><Text style={styles.loadingText}>Loading trips...</Text></View>;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList data={trips} renderItem={renderTrip} keyExtractor={i => String(i.id)} contentContainerStyle={styles.listContent}
        ListHeaderComponent={() => (
          <View style={styles.header}>
            <Text style={styles.greeting}>Hello, {driver?.first_name || 'Driver'}! 👋</Text>
            {offers.length > 0 && <TouchableOpacity style={styles.offersBanner} onPress={() => navigation.navigate('Offers')}><Text style={styles.offersBannerText}>🔔 {offers.length} new offer{offers.length > 1 ? 's' : ''}</Text><Text style={styles.offersBannerArrow}>→</Text></TouchableOpacity>}
            <Text style={styles.sectionTitle}>Your Trips</Text>
          </View>
        )}
        ListEmptyComponent={() => <View style={styles.emptyContainer}><Text style={styles.emptyEmoji}>📅</Text><Text style={styles.emptyTitle}>No Trips Scheduled</Text><Text style={styles.emptySubtitle}>Check back later.</Text></View>}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  loadingText: { marginTop: spacing.md, fontSize: fontSize.md, color: colors.textSecondary },
  listContent: { padding: spacing.lg, paddingBottom: spacing.xxl },
  header: { marginBottom: spacing.lg },
  greeting: { fontSize: fontSize.xxl, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
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
  emptySubtitle: { fontSize: fontSize.md, color: colors.textSecondary, textAlign: 'center' },
});
