/**
 * Loading Component
 * Full-screen and inline loading indicators
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { COLORS, SPACING } from '../utils/constants';

interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message = 'Loading...' }: LoadingScreenProps) {
  return (
    <View style={styles.fullScreen}>
      <ActivityIndicator size="large" color={COLORS.primary} />
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
}

export function LoadingOverlay({ visible, message = 'Please wait...' }: LoadingOverlayProps) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.overlayContent}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.overlayMessage}>{message}</Text>
        </View>
      </View>
    </Modal>
  );
}

interface LoadingInlineProps {
  size?: 'small' | 'large';
  color?: string;
}

export function LoadingInline({
  size = 'small',
  color = COLORS.primary,
}: LoadingInlineProps) {
  return (
    <View style={styles.inline}>
      <ActivityIndicator size={size} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  message: {
    marginTop: SPACING.md,
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  overlayContent: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 150,
  },
  overlayMessage: {
    marginTop: SPACING.md,
    fontSize: 16,
    color: COLORS.text,
  },
  inline: {
    padding: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
