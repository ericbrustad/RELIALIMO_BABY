import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore, useTripStore } from '../store';
import { colors, spacing, fontSize, borderRadius } from '../config/theme';
import type { TripOffer, RootStackParamList } from '../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function OffersScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { driver } = useAuthStore();
  const { offers, fetchOffers, acceptOffer, declineOffer, isLoading } = useTripStore();
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  const onRefresh = useCallback(async () => {
    if (!driver?.id) return;
    setRefreshing(true);
    await fetchOffers(driver.id);
    setRefreshing(false);
  }, [driver?.id]);
  
  const formatDateTime = (datetime: string) => {
    const date = new Date(datetime);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    let dateStr = '';
    if (date.toDateString() === today.toDateString()) {
      dateStr = 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      dateStr = 'Tomorrow';
    } else {
      dateStr = date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
    }
    
    const timeStr = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    
    return { date: dateStr, time: timeStr };
  };
  
  const getExpiresIn = (expiresAt: string) => {
    const expires = new Date(expiresAt);
    const now = new Date();
    const diffMs = expires.getTime() - now.getTime();
    
    if (diffMs <= 0) return 'Expired';
    
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 60) return `${minutes} min left`;
    
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m left`;
  };
  
  const handleAccept = async (offer: TripOffer) => {
    Alert.alert(
      'Accept Trip Offer',
      'Are you sure you want to accept this trip?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          onPress: async () => {
            setProcessingId(offer.id);
            const result = await acceptOffer(offer.id);
            setProcessingId(null);
            
            if (result.success) {
              Alert.alert('Success!', 'Trip has been assigned to you.');
              if (driver?.id) {
                fetchOffers(driver.id);
              }
            } else {
              Alert.alert('Error', result.error || 'Failed to accept offer');
            }
          },
        },
      ]
    );
  };
  
  const handleDecline = async (offer: TripOffer) => {
    Alert.alert(
      'Decline Trip Offer',
      'Are you sure you want to decline this trip?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            setProcessingId(offer.id);
            const result = await declineOffer(offer.id);
            setProcessingId(null);
            
            if (!result.success) {
              Alert.alert('Error', result.error || 'Failed to decline offer');
            }
          },
        },
      ]
    );
  };
  
  const getPassengerName = (offer: TripOffer) => {
    const res = offer.reservation;
    if (!res) return 'Unknown';
    if (res.passenger_name) return res.passenger_name;
    if (res.passenger_first_name) {
      return `${res.passenger_first_name} ${res.passenger_last_name || ''}`.trim();
    }
    return 'Passenger';
  };
  
  const renderOffer = ({ item: offer }: { item: TripOffer }) => {
    const res = offer.reservation;
    if (!res) return null;
    
    const { date, time } = formatDateTime(res.pickup_datetime);
    const expiresIn = getExpiresIn(offer.expires_at);
    const isExpired = expiresIn === 'Expired';
    const isProcessing = processingId === offer.id;
    
    return (
      <View style={[styles.offerCard, isExpired && styles.offerCardExpired]}>
        {/* Expires Banner */}
        <View style={[styles.expiresBanner, isExpired && styles.expiresBannerExpired]}>
          <Text style={styles.expiresText}>⏱️ {expiresIn}</Text>
        </View>
        
        {/* Trip Info */}
        <View style={styles.offerContent}>
          <View style={styles.tripHeader}>
            <View>
              <Text style={styles.tripDate}>{date}</Text>
              <Text style={styles.tripTime}>{time}</Text>
            </View>
            {offer.offer_amount && (
              <View style={styles.payBadge}>
                <Text style={styles.payAmount}>${offer.offer_amount.toFixed(0)}</Text>
              </View>
            )}
          </View>
          
          <Text style={styles.passengerName}>{getPassengerName(offer)}</Text>
          
          {/* Locations */}
          <View style={styles.locationContainer}>
            <View style={styles.locationRow}>
              <View style={[styles.dot, { backgroundColor: colors.success }]} />
              <Text style={styles.locationText} numberOfLines={1}>
                {res.pickup_address || res.pickup_location || 'Pickup TBD'}
              </Text>
            </View>
            <View style={styles.locationRow}>
              <View style={[styles.dot, { backgroundColor: colors.danger }]} />
              <Text style={styles.locationText} numberOfLines={1}>
                {res.dropoff_address || res.dropoff_location || 'Dropoff TBD'}
              </Text>
            </View>
          </View>
          
          {res.vehicle_type && (
            <Text style={styles.vehicleType}>{res.vehicle_type}</Text>
          )}
        </View>
        
        {/* Action Buttons */}
        {!isExpired && (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.declineButton, isProcessing && styles.buttonDisabled]}
              onPress={() => handleDecline(offer)}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color={colors.danger} />
              ) : (
                <Text style={styles.declineButtonText}>Decline</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.acceptButton, isProcessing && styles.buttonDisabled]}
              onPress={() => handleAccept(offer)}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.acceptButtonText}>Accept</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };
  
  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyEmoji}>📭</Text>
      <Text style={styles.emptyTitle}>No Trip Offers</Text>
      <Text style={styles.emptySubtitle}>
        You don't have any pending trip offers.{'\n'}
        New offers will appear here.
      </Text>
    </View>
  );
  
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <FlatList
        data={offers}
        renderItem={renderOffer}
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
  listContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    flexGrow: 1,
  },
  offerCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  offerCardExpired: {
    opacity: 0.6,
  },
  expiresBanner: {
    backgroundColor: colors.warning + '20',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  expiresBannerExpired: {
    backgroundColor: colors.danger + '20',
  },
  expiresText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.warning,
  },
  offerContent: {
    padding: spacing.md,
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
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
  payBadge: {
    backgroundColor: colors.success + '20',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
  },
  payAmount: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.success,
  },
  passengerName: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },
  locationContainer: {
    marginBottom: spacing.sm,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.sm,
  },
  locationText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  vehicleType: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  actionRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  declineButton: {
    flex: 1,
    padding: spacing.md,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  declineButtonText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.danger,
  },
  acceptButton: {
    flex: 1,
    padding: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.success,
  },
  acceptButtonText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: '#fff',
  },
  buttonDisabled: {
    opacity: 0.6,
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
