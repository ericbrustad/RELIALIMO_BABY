/**
 * TripCard Component
 * Displays a trip summary in a card format
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import type { Reservation } from '../types';
import { STATUS_META } from '../types';
import { formatTime, formatDate, formatCurrency, formatPassengerName } from '../utils/formatters';
import { COLORS, SPACING, RADIUS } from '../utils/constants';

interface TripCardProps {
  trip: Reservation;
  onPress?: () => void;
  style?: ViewStyle;
  showDate?: boolean;
  compact?: boolean;
}

export function TripCard({
  trip,
  onPress,
  style,
  showDate = false,
  compact = false,
}: TripCardProps) {
  const status = trip.driver_status || 'assigned';
  const statusMeta = STATUS_META[status] || STATUS_META.assigned;
  
  const pickupAddress = trip.pickup_address || trip.pickup_location || 'No pickup address';
  const dropoffAddress = trip.dropoff_address || trip.dropoff_location || 'No dropoff address';
  const passengerName = formatPassengerName(
    trip.passenger_first_name,
    trip.passenger_last_name,
    trip.passenger_name
  );

  if (compact) {
    return (
      <TouchableOpacity
        style={[styles.compactCard, style]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <View style={styles.compactTimeContainer}>
          <Text style={styles.compactTime}>
            {formatTime(trip.pickup_datetime)}
          </Text>
          {showDate && (
            <Text style={styles.compactDate}>
              {formatDate(trip.pickup_datetime)}
            </Text>
          )}
        </View>
        <View style={styles.compactContent}>
          <Text style={styles.compactPassenger} numberOfLines={1}>
            {passengerName}
          </Text>
          <Text style={styles.compactAddress} numberOfLines={1}>
            {pickupAddress}
          </Text>
        </View>
        <View style={[styles.statusDot, { backgroundColor: statusMeta.color }]} />
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.card, style]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.timeContainer}>
          <Text style={styles.time}>{formatTime(trip.pickup_datetime)}</Text>
          {showDate && (
            <Text style={styles.date}>{formatDate(trip.pickup_datetime)}</Text>
          )}
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusMeta.color + '20' }]}>
          <Text style={[styles.statusText, { color: statusMeta.color }]}>
            {statusMeta.emoji} {statusMeta.label}
          </Text>
        </View>
      </View>

      {/* Passenger */}
      <Text style={styles.passengerName}>{passengerName}</Text>
      
      {/* Route */}
      <View style={styles.routeContainer}>
        <View style={styles.routeIconContainer}>
          <View style={styles.pickupDot} />
          <View style={styles.routeLine} />
          <View style={styles.dropoffDot} />
        </View>
        <View style={styles.addressContainer}>
          <Text style={styles.address} numberOfLines={2}>
            {pickupAddress}
          </Text>
          <Text style={styles.address} numberOfLines={2}>
            {dropoffAddress}
          </Text>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        {trip.vehicle_type && (
          <Text style={styles.vehicleType}>{trip.vehicle_type}</Text>
        )}
        {trip.passenger_count && (
          <Text style={styles.passengerCount}>
            👥 {trip.passenger_count}
          </Text>
        )}
        {trip.driver_pay != null && (
          <Text style={styles.pay}>
            {formatCurrency(trip.driver_pay)}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  compactCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  timeContainer: {
    flexDirection: 'column',
  },
  time: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  date: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  passengerName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  routeContainer: {
    flexDirection: 'row',
    marginBottom: SPACING.sm,
  },
  routeIconContainer: {
    width: 16,
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  pickupDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.success,
  },
  routeLine: {
    width: 2,
    flex: 1,
    backgroundColor: COLORS.border,
    marginVertical: 4,
  },
  dropoffDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.error,
  },
  addressContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
  address: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  vehicleType: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginRight: SPACING.md,
  },
  passengerCount: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginRight: SPACING.md,
  },
  pay: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.success,
    marginLeft: 'auto',
  },
  compactTimeContainer: {
    width: 70,
  },
  compactTime: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  compactDate: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  compactContent: {
    flex: 1,
    marginLeft: SPACING.sm,
  },
  compactPassenger: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  compactAddress: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginLeft: SPACING.sm,
  },
});
