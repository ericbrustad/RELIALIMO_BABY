import React, { useCallback, useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore, useTripStore } from '../store';
import { useTheme } from '../context';
import { spacing, fontSize, borderRadius } from '../config/theme';
import { STATUS_META } from '../types';
import type { Reservation, RootStackParamList } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 
                'July', 'August', 'September', 'October', 'November', 'December'];

export default function CalendarScreen() {
  const navigation = useNavigation<Nav>();
  const { driver } = useAuthStore();
  const { trips, fetchAllDriverData } = useTripStore();
  const { colors } = useTheme();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  // Create dynamic styles based on current theme
  const styles = useMemo(() => createStyles(colors), [colors]);

  useFocusEffect(useCallback(() => {
    if (driver?.id) {
      fetchAllDriverData(driver.id);
    }
  }, [driver?.id]));

  // Get trips for selected date
  const selectedDateTrips = useMemo(() => {
    const dateStr = selectedDate.toDateString();
    return trips.filter(trip => {
      const tripDate = new Date(trip.pickup_datetime);
      return tripDate.toDateString() === dateStr;
    }).sort((a, b) => 
      new Date(a.pickup_datetime).getTime() - new Date(b.pickup_datetime).getTime()
    );
  }, [trips, selectedDate]);

  // Get days with trips for indicators
  const daysWithTrips = useMemo(() => {
    const days = new Set<string>();
    trips.forEach(trip => {
      const tripDate = new Date(trip.pickup_datetime);
      days.add(tripDate.toDateString());
    });
    return days;
  }, [trips]);

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    
    const days: (Date | null)[] = [];
    
    // Add padding for days before month starts
    for (let i = 0; i < startPadding; i++) {
      days.push(null);
    }
    
    // Add days of month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    
    return days;
  }, [currentMonth]);

  const goToPrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentMonth(today);
    setSelectedDate(today);
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isSelected = (date: Date) => {
    return date.toDateString() === selectedDate.toDateString();
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    });
  };

  const getName = (trip: Reservation) => 
    trip.passenger_name || 
    (trip.passenger_first_name ? `${trip.passenger_first_name} ${trip.passenger_last_name || ''}`.trim() : 'Passenger');

  const renderTripItem = ({ item: trip }: { item: Reservation }) => {
    const status = trip.driver_status || 'available';
    const meta = STATUS_META[status] || STATUS_META.available;
    
    return (
      <TouchableOpacity 
        style={styles.tripItem}
        onPress={() => navigation.navigate('TripDetail', { tripId: trip.id })}
      >
        <View style={[styles.tripTime, { borderLeftColor: meta.color }]}>
          <Text style={styles.tripTimeText}>{formatTime(trip.pickup_datetime)}</Text>
        </View>
        <View style={styles.tripInfo}>
          <Text style={styles.tripPassenger}>{getName(trip)}</Text>
          <Text style={styles.tripLocation} numberOfLines={1}>
            📍 {trip.pickup_address || 'Pickup TBD'}
          </Text>
        </View>
        <View style={[styles.statusDot, { backgroundColor: meta.color }]} />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Calendar Header */}
      <View style={styles.calendarHeader}>
        <TouchableOpacity onPress={goToPrevMonth} style={styles.navButton}>
          <Text style={styles.navButtonText}>‹</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={goToToday}>
          <Text style={styles.monthTitle}>
            {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={goToNextMonth} style={styles.navButton}>
          <Text style={styles.navButtonText}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Day Labels */}
      <View style={styles.dayLabels}>
        {DAYS.map(day => (
          <View key={day} style={styles.dayLabel}>
            <Text style={styles.dayLabelText}>{day}</Text>
          </View>
        ))}
      </View>

      {/* Calendar Grid */}
      <View style={styles.calendarGrid}>
        {calendarDays.map((date, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.dayCell,
              date && isToday(date) && styles.todayCell,
              date && isSelected(date) && styles.selectedCell,
            ]}
            onPress={() => date && setSelectedDate(date)}
            disabled={!date}
          >
            {date && (
              <>
                <Text style={[
                  styles.dayText,
                  isToday(date) && styles.todayText,
                  isSelected(date) && styles.selectedText,
                ]}>
                  {date.getDate()}
                </Text>
                {daysWithTrips.has(date.toDateString()) && (
                  <View style={[
                    styles.tripIndicator,
                    isSelected(date) && styles.tripIndicatorSelected,
                  ]} />
                )}
              </>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Selected Date Trips */}
      <View style={styles.tripsSection}>
        <Text style={styles.tripsTitle}>
          {selectedDate.toLocaleDateString('en-US', { 
            weekday: 'long', 
            month: 'long', 
            day: 'numeric' 
          })}
        </Text>
        
        {selectedDateTrips.length > 0 ? (
          <FlatList
            data={selectedDateTrips}
            renderItem={renderTripItem}
            keyExtractor={item => String(item.id)}
            style={styles.tripsList}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <View style={styles.noTrips}>
            <Text style={styles.noTripsEmoji}>📅</Text>
            <Text style={styles.noTripsText}>No trips scheduled</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

// Create dynamic styles based on theme colors
const createStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  navButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.lg,
    backgroundColor: colors.background,
  },
  navButtonText: {
    fontSize: 28,
    color: colors.text,
    fontWeight: '300',
  },
  monthTitle: {
    fontSize: fontSize.xl,
    fontWeight: '600',
    color: colors.text,
  },

  dayLabels: {
    flexDirection: 'row',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  dayLabel: {
    flex: 1,
    alignItems: 'center',
  },
  dayLabelText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textSecondary,
  },

  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xs,
  },
  todayCell: {
    backgroundColor: colors.primary + '20',
    borderRadius: borderRadius.lg,
  },
  selectedCell: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
  },
  dayText: {
    fontSize: fontSize.md,
    color: colors.text,
  },
  todayText: {
    color: colors.primary,
    fontWeight: '700',
  },
  selectedText: {
    color: colors.white,
    fontWeight: '700',
  },
  tripIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginTop: 2,
  },
  tripIndicatorSelected: {
    backgroundColor: colors.white,
  },

  tripsSection: {
    flex: 1,
    padding: spacing.lg,
  },
  tripsTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },
  tripsList: {
    flex: 1,
  },

  tripItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tripTime: {
    borderLeftWidth: 3,
    paddingLeft: spacing.sm,
    marginRight: spacing.md,
  },
  tripTimeText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
  },
  tripInfo: {
    flex: 1,
  },
  tripPassenger: {
    fontSize: fontSize.md,
    fontWeight: '500',
    color: colors.text,
  },
  tripLocation: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  noTrips: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noTripsEmoji: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  noTripsText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
});
