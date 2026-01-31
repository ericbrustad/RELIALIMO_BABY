/**
 * OfferOverlay Component
 * Full-screen overlay for incoming trip offers
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Vibration,
  Animated,
  Dimensions,
} from 'react-native';
import type { TripOffer } from '../types';
import { formatTime, formatDate, formatCurrency, formatCountdown } from '../utils/formatters';
import { COLORS, SPACING, RADIUS } from '../utils/constants';

const { width, height } = Dimensions.get('window');

interface OfferOverlayProps {
  offer: TripOffer | null;
  visible: boolean;
  onAccept: (offerId: string) => void;
  onDecline: (offerId: string) => void;
  onClose: () => void;
}

export function OfferOverlay({
  offer,
  visible,
  onAccept,
  onDecline,
  onClose,
}: OfferOverlayProps) {
  const [countdown, setCountdown] = useState('5:00');
  const [isExpired, setIsExpired] = useState(false);
  const pulseAnim = new Animated.Value(1);

  useEffect(() => {
    if (visible && offer) {
      // Vibrate to alert driver
      Vibration.vibrate([0, 500, 200, 500]);
      
      // Start pulse animation
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();

      // Update countdown every second
      const interval = setInterval(() => {
        if (offer.expires_at) {
          const cd = formatCountdown(offer.expires_at);
          setCountdown(cd);
          if (cd === 'Expired') {
            setIsExpired(true);
            clearInterval(interval);
          }
        }
      }, 1000);

      return () => {
        clearInterval(interval);
        pulse.stop();
      };
    }
  }, [visible, offer]);

  if (!offer || !offer.reservation) return null;

  const reservation = offer.reservation;
  const pickupAddress = reservation.pickup_address || reservation.pickup_location || 'No address';
  const dropoffAddress = reservation.dropoff_address || reservation.dropoff_location || 'No address';

  const handleAccept = () => {
    if (!isExpired) {
      onAccept(offer.id);
    }
  };

  const handleDecline = () => {
    onDecline(offer.id);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <Animated.View style={[styles.header, { transform: [{ scale: pulseAnim }] }]}>
          <Text style={styles.headerEmoji}>🚗</Text>
          <Text style={styles.headerTitle}>New Trip Offer!</Text>
          <View style={[styles.countdownBadge, isExpired && styles.expiredBadge]}>
            <Text style={styles.countdownText}>{countdown}</Text>
          </View>
        </Animated.View>

        {/* Trip Details */}
        <View style={styles.content}>
          {/* Time */}
          <View style={styles.timeContainer}>
            <Text style={styles.pickupTime}>
              {formatTime(reservation.pickup_datetime)}
            </Text>
            <Text style={styles.pickupDate}>
              {formatDate(reservation.pickup_datetime)}
            </Text>
          </View>

          {/* Route */}
          <View style={styles.routeCard}>
            <View style={styles.routeRow}>
              <View style={styles.routeDot}>
                <View style={styles.pickupDot} />
              </View>
              <View style={styles.routeTextContainer}>
                <Text style={styles.routeLabel}>PICKUP</Text>
                <Text style={styles.routeAddress} numberOfLines={2}>
                  {pickupAddress}
                </Text>
              </View>
            </View>
            
            <View style={styles.routeLine} />
            
            <View style={styles.routeRow}>
              <View style={styles.routeDot}>
                <View style={styles.dropoffDot} />
              </View>
              <View style={styles.routeTextContainer}>
                <Text style={styles.routeLabel}>DROPOFF</Text>
                <Text style={styles.routeAddress} numberOfLines={2}>
                  {dropoffAddress}
                </Text>
              </View>
            </View>
          </View>

          {/* Pay and Details */}
          <View style={styles.detailsRow}>
            {offer.offer_amount != null && (
              <View style={styles.payContainer}>
                <Text style={styles.payLabel}>DRIVER PAY</Text>
                <Text style={styles.payAmount}>
                  {formatCurrency(offer.offer_amount)}
                </Text>
              </View>
            )}
            {reservation.vehicle_type && (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>VEHICLE</Text>
                <Text style={styles.detailValue}>{reservation.vehicle_type}</Text>
              </View>
            )}
            {reservation.passenger_count && (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>PASSENGERS</Text>
                <Text style={styles.detailValue}>{reservation.passenger_count}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.declineButton]}
            onPress={handleDecline}
            activeOpacity={0.8}
          >
            <Text style={styles.declineButtonText}>✕ Decline</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.acceptButton, isExpired && styles.disabledButton]}
            onPress={handleAccept}
            activeOpacity={0.8}
            disabled={isExpired}
          >
            <Text style={styles.acceptButtonText}>
              {isExpired ? 'Expired' : '✓ Accept'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primary,
  },
  header: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: SPACING.lg,
  },
  headerEmoji: {
    fontSize: 48,
    marginBottom: SPACING.sm,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: SPACING.md,
  },
  countdownBadge: {
    backgroundColor: COLORS.secondary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
  },
  expiredBadge: {
    backgroundColor: COLORS.error,
  },
  countdownText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  content: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.lg,
  },
  timeContainer: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  pickupTime: {
    fontSize: 36,
    fontWeight: '700',
    color: COLORS.text,
  },
  pickupDate: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  routeCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  routeDot: {
    width: 24,
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  pickupDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: COLORS.success,
  },
  dropoffDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: COLORS.error,
  },
  routeLine: {
    width: 2,
    height: 20,
    backgroundColor: COLORS.border,
    marginLeft: 11,
    marginVertical: 4,
  },
  routeTextContainer: {
    flex: 1,
  },
  routeLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginBottom: 4,
  },
  routeAddress: {
    fontSize: 16,
    color: COLORS.text,
    lineHeight: 22,
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
  },
  payContainer: {
    alignItems: 'center',
  },
  payLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginBottom: 4,
  },
  payAmount: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.success,
  },
  detailItem: {
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  actions: {
    flexDirection: 'row',
    padding: SPACING.lg,
    paddingBottom: 40,
    backgroundColor: COLORS.background,
  },
  declineButton: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: COLORS.error,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  declineButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.error,
  },
  acceptButton: {
    flex: 2,
    backgroundColor: COLORS.success,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
  },
  acceptButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  disabledButton: {
    backgroundColor: COLORS.textMuted,
  },
});
