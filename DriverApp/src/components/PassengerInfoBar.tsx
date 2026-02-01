/**
 * PassengerInfoBar Component
 * A persistent bar showing passenger name and phone that stays visible on all trip screens
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Platform,
} from 'react-native';
import { useTheme } from '../context';
import { spacing, fontSize, borderRadius } from '../config/theme';

interface PassengerInfoBarProps {
  passengerName: string;
  passengerPhone?: string | null;
  passengerCount?: number | null;
  compact?: boolean;
}

export default function PassengerInfoBar({
  passengerName,
  passengerPhone,
  passengerCount,
  compact = false,
}: PassengerInfoBarProps) {
  const { colors } = useTheme();
  
  const handleCall = () => {
    if (passengerPhone) {
      Linking.openURL(`tel:${passengerPhone}`);
    }
  };
  
  const handleText = () => {
    if (passengerPhone) {
      Linking.openURL(`sms:${passengerPhone}`);
    }
  };
  
  const styles = createStyles(colors, compact);
  
  return (
    <View style={styles.container}>
      <View style={styles.infoSection}>
        <Text style={styles.name} numberOfLines={1}>
          👤 {passengerName}
        </Text>
        {passengerCount && passengerCount > 1 && (
          <Text style={styles.count}>+{passengerCount - 1}</Text>
        )}
      </View>
      
      {passengerPhone && (
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionBtn} onPress={handleCall}>
            <Text style={styles.actionIcon}>📞</Text>
            {!compact && <Text style={styles.actionText}>Call</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={handleText}>
            <Text style={styles.actionIcon}>💬</Text>
            {!compact && <Text style={styles.actionText}>Text</Text>}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const createStyles = (colors: any, compact: boolean) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primary + '15',
    paddingHorizontal: spacing.md,
    paddingVertical: compact ? spacing.xs : spacing.sm,
    borderRadius: compact ? borderRadius.sm : borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
  infoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  name: {
    fontSize: compact ? fontSize.md : fontSize.lg,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  count: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.primary,
    backgroundColor: colors.primary + '20',
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    marginLeft: spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: compact ? spacing.sm : spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  actionIcon: {
    fontSize: compact ? 14 : 16,
  },
  actionText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.white,
  },
});
