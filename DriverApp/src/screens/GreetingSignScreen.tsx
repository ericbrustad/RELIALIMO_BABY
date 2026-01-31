import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useTripStore, useAuthStore } from '../store';
import { useTheme } from '../context';
import { spacing, fontSize, borderRadius } from '../config/theme';
import type { Reservation } from '../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Base sign styles (coral will use dynamic theme color)
const getSignStyles = (primaryColor: string) => [
  { id: 'classic', name: 'Classic', bg: '#000000', text: '#FFFFFF' },
  { id: 'elegant', name: 'Elegant', bg: '#1a1a2e', text: '#c9a227' },
  { id: 'bright', name: 'Bright', bg: '#FFFFFF', text: '#000000' },
  { id: 'coral', name: 'Coral', bg: primaryColor, text: '#FFFFFF' },
  { id: 'green', name: 'Nature', bg: '#2d5a27', text: '#FFFFFF' },
];

export default function GreetingSignScreen() {
  const { driver } = useAuthStore();
  const { trips, fetchTrips } = useTripStore();
  const { colors } = useTheme();
  
  // Create dynamic styles and sign styles based on current theme
  const styles = useMemo(() => createStyles(colors), [colors]);
  const SIGN_STYLES = useMemo(() => getSignStyles(colors.primary), [colors.primary]);
  
  const [passengerName, setPassengerName] = useState('');
  const [selectedTrip, setSelectedTrip] = useState<Reservation | null>(null);
  const [selectedStyle, setSelectedStyle] = useState(SIGN_STYLES[0]);
  const [showFullScreen, setShowFullScreen] = useState(false);

  useFocusEffect(useCallback(() => {
    if (driver?.id) {
      fetchTrips(driver.id);
    }
  }, [driver?.id]));

  // Get upcoming trips for quick selection
  const upcomingTrips = trips.slice(0, 5);

  const selectTrip = (trip: Reservation) => {
    setSelectedTrip(trip);
    const name = trip.passenger_name || 
      (trip.passenger_first_name ? `${trip.passenger_first_name} ${trip.passenger_last_name || ''}`.trim() : '');
    setPassengerName(name);
  };

  const displayName = passengerName.trim() || 'PASSENGER NAME';

  if (showFullScreen) {
    return (
      <TouchableOpacity 
        style={[styles.fullScreenSign, { backgroundColor: selectedStyle.bg }]}
        onPress={() => setShowFullScreen(false)}
        activeOpacity={1}
      >
        <Text style={[styles.fullScreenName, { color: selectedStyle.text }]}>
          {displayName.toUpperCase()}
        </Text>
        <Text style={[styles.fullScreenHint, { color: selectedStyle.text + '60' }]}>
          Tap to exit
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Preview */}
        <View style={styles.previewSection}>
          <Text style={styles.sectionTitle}>PREVIEW</Text>
          <TouchableOpacity 
            style={[styles.signPreview, { backgroundColor: selectedStyle.bg }]}
            onPress={() => setShowFullScreen(true)}
          >
            <Text style={[styles.signName, { color: selectedStyle.text }]}>
              {displayName.toUpperCase()}
            </Text>
          </TouchableOpacity>
          <Text style={styles.tapHint}>Tap preview for full screen</Text>
        </View>

        {/* Name Input */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PASSENGER NAME</Text>
          <TextInput
            style={styles.nameInput}
            value={passengerName}
            onChangeText={setPassengerName}
            placeholder="Enter passenger name..."
            placeholderTextColor={colors.textMuted}
            autoCapitalize="words"
          />
        </View>

        {/* Quick Select from Trips */}
        {upcomingTrips.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>QUICK SELECT FROM TRIPS</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {upcomingTrips.map((trip) => {
                const name = trip.passenger_name || 
                  (trip.passenger_first_name ? `${trip.passenger_first_name} ${trip.passenger_last_name || ''}`.trim() : 'Unknown');
                const time = new Date(trip.pickup_datetime).toLocaleTimeString('en-US', { 
                  hour: 'numeric', 
                  minute: '2-digit' 
                });
                
                return (
                  <TouchableOpacity
                    key={trip.id}
                    style={[
                      styles.tripChip,
                      selectedTrip?.id === trip.id && styles.tripChipSelected,
                    ]}
                    onPress={() => selectTrip(trip)}
                  >
                    <Text style={[
                      styles.tripChipName,
                      selectedTrip?.id === trip.id && styles.tripChipTextSelected,
                    ]}>
                      {name}
                    </Text>
                    <Text style={[
                      styles.tripChipTime,
                      selectedTrip?.id === trip.id && styles.tripChipTextSelected,
                    ]}>
                      {time}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Style Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SIGN STYLE</Text>
          <View style={styles.stylesRow}>
            {SIGN_STYLES.map((style) => (
              <TouchableOpacity
                key={style.id}
                style={[
                  styles.styleOption,
                  { backgroundColor: style.bg },
                  selectedStyle.id === style.id && styles.styleOptionSelected,
                ]}
                onPress={() => setSelectedStyle(style)}
              >
                <Text style={[styles.styleText, { color: style.text }]}>
                  Aa
                </Text>
                {selectedStyle.id === style.id && (
                  <View style={styles.styleCheck}>
                    <Text style={styles.styleCheckText}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Full Screen Button */}
        <TouchableOpacity 
          style={styles.fullScreenButton}
          onPress={() => setShowFullScreen(true)}
        >
          <Text style={styles.fullScreenButtonIcon}>📱</Text>
          <Text style={styles.fullScreenButtonText}>Show Full Screen Sign</Text>
        </TouchableOpacity>

        <Text style={styles.helpText}>
          💡 Tip: Use this at the airport or pickup location to help passengers find you
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// Create dynamic styles based on theme colors
const createStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollView: { flex: 1 },
  content: { padding: spacing.lg },

  previewSection: {
    marginBottom: spacing.xl,
  },
  signPreview: {
    aspectRatio: 16 / 9,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  signName: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 2,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  tapHint: {
    textAlign: 'center',
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },

  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.textMuted,
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },

  nameInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    fontSize: fontSize.lg,
    color: colors.text,
  },

  tripChip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginRight: spacing.sm,
    minWidth: 120,
  },
  tripChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tripChipName: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
  },
  tripChipTime: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  tripChipTextSelected: {
    color: colors.white,
  },

  stylesRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  styleOption: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  styleOptionSelected: {
    borderColor: colors.primary,
  },
  styleText: {
    fontSize: fontSize.xl,
    fontWeight: '700',
  },
  styleCheck: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  styleCheckText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },

  fullScreenButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
  },
  fullScreenButtonIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  fullScreenButtonText: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.white,
  },

  helpText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },

  fullScreenSign: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullScreenName: {
    fontSize: 56,
    fontWeight: '700',
    letterSpacing: 4,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
  fullScreenHint: {
    position: 'absolute',
    bottom: 60,
    fontSize: fontSize.md,
  },
});
