/**
 * StatusButton Component
 * Button for advancing trip status with visual feedback
 */

import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
} from 'react-native';
import type { DriverStatus } from '../types';
import { STATUS_META } from '../types';
import { NEXT_STATUS, STATUS_BUTTON_LABELS, COLORS, SPACING, RADIUS } from '../utils/constants';

interface StatusButtonProps {
  currentStatus: DriverStatus;
  onPress: (nextStatus: DriverStatus) => void;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export function StatusButton({
  currentStatus,
  onPress,
  loading = false,
  disabled = false,
  style,
}: StatusButtonProps) {
  const nextStatus = NEXT_STATUS[currentStatus] as DriverStatus | undefined;
  
  if (!nextStatus) {
    // Trip is complete or no next status
    return null;
  }

  const nextStatusMeta = STATUS_META[nextStatus];
  const buttonLabel = STATUS_BUTTON_LABELS[currentStatus] || `Go to ${nextStatusMeta.label}`;

  const handlePress = () => {
    if (!loading && !disabled) {
      onPress(nextStatus);
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        { backgroundColor: nextStatusMeta.color },
        disabled && styles.disabled,
        style,
      ]}
      onPress={handlePress}
      activeOpacity={0.8}
      disabled={loading || disabled}
    >
      {loading ? (
        <ActivityIndicator color="#fff" size="small" />
      ) : (
        <Text style={styles.buttonText}>
          {nextStatusMeta.emoji} {buttonLabel}
        </Text>
      )}
    </TouchableOpacity>
  );
}

interface QuickActionButtonProps {
  label: string;
  emoji?: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'outline';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  size?: 'small' | 'medium' | 'large';
}

export function QuickActionButton({
  label,
  emoji,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
  size = 'medium',
}: QuickActionButtonProps) {
  const getBackgroundColor = () => {
    switch (variant) {
      case 'primary':
        return COLORS.primary;
      case 'secondary':
        return COLORS.textSecondary;
      case 'danger':
        return COLORS.error;
      case 'outline':
        return 'transparent';
      default:
        return COLORS.primary;
    }
  };

  const getTextColor = () => {
    if (variant === 'outline') {
      return COLORS.primary;
    }
    return '#fff';
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return { paddingVertical: SPACING.xs, paddingHorizontal: SPACING.sm };
      case 'large':
        return { paddingVertical: SPACING.lg, paddingHorizontal: SPACING.xl };
      default:
        return { paddingVertical: SPACING.md, paddingHorizontal: SPACING.lg };
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.actionButton,
        { backgroundColor: getBackgroundColor() },
        variant === 'outline' && styles.outlineButton,
        getSizeStyles(),
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      activeOpacity={0.8}
      disabled={loading || disabled}
    >
      {loading ? (
        <ActivityIndicator color={getTextColor()} size="small" />
      ) : (
        <Text style={[styles.actionButtonText, { color: getTextColor() }]}>
          {emoji ? `${emoji} ` : ''}{label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.5,
  },
  actionButton: {
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  outlineButton: {
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
});
