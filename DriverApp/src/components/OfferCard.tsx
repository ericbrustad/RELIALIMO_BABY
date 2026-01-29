import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
  Vibration,
  Platform,
} from 'react-native';
import { colors, spacing, fontSize, borderRadius } from '../config/theme';
import type { Reservation } from '../types';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.3;

interface OfferCardProps {
  trip: Reservation;
  expiresAt: string;
  onAccept: () => void;
  onDecline: () => void;
  onPress: () => void;
}

export default function OfferCard({
  trip,
  expiresAt,
  onAccept,
  onDecline,
  onPress,
}: OfferCardProps) {
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isExpired, setIsExpired] = useState(false);
  const position = useRef(new Animated.ValueXY()).current;
  const scale = useRef(new Animated.Value(1)).current;
  
  // Calculate time remaining
  useEffect(() => {
    const calculateRemaining = () => {
      const now = new Date().getTime();
      const expires = new Date(expiresAt).getTime();
      const remaining = Math.max(0, Math.floor((expires - now) / 1000));
      setTimeRemaining(remaining);
      
      if (remaining <= 0) {
        setIsExpired(true);
        onDecline(); // Auto-decline when expired
      }
    };
    
    calculateRemaining();
    const interval = setInterval(calculateRemaining, 1000);
    
    return () => clearInterval(interval);
  }, [expiresAt]);
  
  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Get urgency color based on time remaining
  const getUrgencyColor = () => {
    if (timeRemaining <= 60) return colors.danger; // Last minute - red
    if (timeRemaining <= 180) return colors.warning; // Last 3 mins - orange
    return colors.success; // Plenty of time - green
  };
  
  // Pan responder for swipe gestures
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 10,
      
      onPanResponderGrant: () => {
        Animated.spring(scale, { toValue: 0.98, useNativeDriver: true }).start();
      },
      
      onPanResponderMove: (_, gesture) => {
        position.setValue({ x: gesture.dx, y: 0 });
      },
      
      onPanResponderRelease: (_, gesture) => {
        Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();
        
        if (gesture.dx > SWIPE_THRESHOLD) {
          // Swiped right - Accept
          if (Platform.OS !== 'web') Vibration.vibrate(50);
          Animated.timing(position, {
            toValue: { x: SCREEN_WIDTH, y: 0 },
            duration: 200,
            useNativeDriver: true,
          }).start(onAccept);
        } else if (gesture.dx < -SWIPE_THRESHOLD) {
          // Swiped left - Decline
          if (Platform.OS !== 'web') Vibration.vibrate(50);
          Animated.timing(position, {
            toValue: { x: -SCREEN_WIDTH, y: 0 },
            duration: 200,
            useNativeDriver: true,
          }).start(onDecline);
        } else {
          // Snap back
          Animated.spring(position, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;
  
  // Interpolate background colors for swipe feedback
  const backgroundColorInterpolate = position.x.interpolate({
    inputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
    outputRange: ['#ff4444', colors.white, '#44ff44'],
    extrapolate: 'clamp',
  });
  
  const leftOpacity = position.x.interpolate({
    inputRange: [-100, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  
  const rightOpacity = position.x.interpolate({
    inputRange: [0, 100],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  
  const formatDateTime = (datetime: string) => {
    const date = new Date(datetime);
    return {
      time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
      date: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
    };
  };
  
  const getPassengerName = () => {
    if (trip.passenger_name) return trip.passenger_name;
    if (trip.passenger_first_name) {
      return `${trip.passenger_first_name} ${trip.passenger_last_name || ''}`.trim();
    }
    return 'Passenger';
  };
  
  const { time, date } = formatDateTime(trip.pickup_datetime);
  
  if (isExpired) return null;
  
  return (
    <View style={styles.container}>
      {/* Background swipe indicators */}
      <View style={styles.swipeBackground}>
        <Animated.View style={[styles.swipeAction, styles.swipeLeft, { opacity: leftOpacity }]}>
          <Text style={styles.swipeText}>✕ DECLINE</Text>
        </Animated.View>
        <Animated.View style={[styles.swipeAction, styles.swipeRight, { opacity: rightOpacity }]}>
          <Text style={styles.swipeText}>✓ ACCEPT</Text>
        </Animated.View>
      </View>
      
      <Animated.View
        style={[
          styles.card,
          {
            transform: [
              { translateX: position.x },
              { scale: scale },
            ],
          },
        ]}
        {...panResponder.panHandlers}
      >
        {/* Timer Badge */}
        <View style={[styles.timerBadge, { backgroundColor: getUrgencyColor() }]}>
          <Text style={styles.timerIcon}>⏱</Text>
          <Text style={styles.timerText}>{formatTime(timeRemaining)}</Text>
        </View>
        
        {/* NEW TRIP Label */}
        <View style={styles.newTripBadge}>
          <Text style={styles.newTripText}>🔔 NEW TRIP OFFER</Text>
        </View>
        
        <TouchableOpacity activeOpacity={0.9} onPress={onPress}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.time}>{time}</Text>
              <Text style={styles.date}>{date}</Text>
            </View>
            <Text style={styles.confirmation}>#{trip.confirmation_number}</Text>
          </View>
          
          {/* Passenger */}
          <Text style={styles.passenger}>{getPassengerName()}</Text>
          
          {/* Addresses */}
          <View style={styles.addressSection}>
            <View style={styles.addressRow}>
              <View style={[styles.dot, { backgroundColor: colors.success }]} />
              <Text style={styles.address} numberOfLines={2}>
                {trip.pickup_address || trip.pickup_location || 'Pickup TBD'}
              </Text>
            </View>
            <View style={styles.line} />
            <View style={styles.addressRow}>
              <View style={[styles.dot, { backgroundColor: colors.danger }]} />
              <Text style={styles.address} numberOfLines={2}>
                {trip.dropoff_address || trip.dropoff_location || 'Dropoff TBD'}
              </Text>
            </View>
          </View>
          
          {/* Vehicle Type */}
          {trip.vehicle_type && (
            <View style={styles.vehicleRow}>
              <Text style={styles.vehicleIcon}>🚗</Text>
              <Text style={styles.vehicleText}>{trip.vehicle_type}</Text>
            </View>
          )}
          
          {/* Pay if available */}
          {trip.driver_pay && (
            <View style={styles.payRow}>
              <Text style={styles.payLabel}>Your Pay</Text>
              <Text style={styles.payAmount}>${trip.driver_pay.toFixed(2)}</Text>
            </View>
          )}
        </TouchableOpacity>
        
        {/* Action Buttons */}
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.declineBtn} onPress={onDecline}>
            <Text style={styles.declineText}>DECLINE</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.acceptBtn} onPress={onAccept}>
            <Text style={styles.acceptText}>ACCEPT</Text>
          </TouchableOpacity>
        </View>
        
        {/* Swipe hint */}
        <Text style={styles.swipeHint}>← Swipe to decline or accept →</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  swipeBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
  },
  swipeAction: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  swipeLeft: {
    backgroundColor: colors.danger + '30',
    alignItems: 'flex-start',
    borderRadius: borderRadius.lg,
  },
  swipeRight: {
    backgroundColor: colors.success + '30',
    alignItems: 'flex-end',
    borderRadius: borderRadius.lg,
  },
  swipeText: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.text,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  timerBadge: {
    position: 'absolute',
    top: -12,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    zIndex: 1,
  },
  timerIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  timerText: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.white,
  },
  newTripBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary + '20',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: spacing.sm,
  },
  newTripText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.primary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  time: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text,
  },
  date: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  confirmation: {
    fontSize: fontSize.md,
    color: colors.textMuted,
  },
  passenger: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },
  addressSection: {
    marginBottom: spacing.md,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: spacing.sm,
    marginTop: 4,
  },
  line: {
    width: 2,
    height: 20,
    backgroundColor: colors.border,
    marginLeft: 5,
    marginVertical: 2,
  },
  address: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.text,
    lineHeight: 20,
  },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginBottom: spacing.sm,
  },
  vehicleIcon: {
    fontSize: 18,
    marginRight: spacing.sm,
  },
  vehicleText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  payRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.success + '15',
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.md,
  },
  payLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  payAmount: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.success,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  declineBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.danger + '15',
    alignItems: 'center',
  },
  declineText: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.danger,
  },
  acceptBtn: {
    flex: 2,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.success,
    alignItems: 'center',
  },
  acceptText: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.white,
  },
  swipeHint: {
    textAlign: 'center',
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
});
