/**
 * MississippiCountdown Component
 * Shows a 3-2-1 countdown after tap before proceeding
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Vibration,
  Platform,
} from 'react-native';
import { COLORS, SPACING, RADIUS } from '../utils/constants';

interface MississippiCountdownProps {
  visible: boolean;
  targetCount?: number;
  onComplete: () => void;
  onCancel: () => void;
  actionLabel?: string;
  color?: string;
  actionColor?: string;
}

export default function MississippiCountdown({
  visible,
  targetCount = 3,
  onComplete,
  onCancel,
  actionLabel = 'Confirm',
  color = COLORS.primary,
  actionColor,
}: MississippiCountdownProps) {
  const buttonColor = actionColor || color;
  const [countdown, setCountdown] = useState(targetCount);
  const [isCountingDown, setIsCountingDown] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible) {
      setCountdown(targetCount);
      setIsCountingDown(false);
    }
  }, [visible, targetCount]);

  // Auto-start countdown when modal becomes visible
  useEffect(() => {
    if (visible && !isCountingDown) {
      startCountdown();
    }
  }, [visible]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isCountingDown && countdown > 0) {
      // Vibrate on each count
      if (Platform.OS !== 'web') {
        Vibration.vibrate(50);
      }
      
      // Pulse animation for each number
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.3,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();

      interval = setInterval(() => {
        setCountdown((prev) => {
          const newCount = prev - 1;
          if (newCount <= 0) {
            setIsCountingDown(false);
            // Final vibration
            if (Platform.OS !== 'web') {
              Vibration.vibrate([0, 100, 50, 100]);
            }
            setTimeout(() => onComplete(), 200);
          }
          return newCount;
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isCountingDown, countdown]);

  const startCountdown = () => {
    setCountdown(targetCount);
    setIsCountingDown(true);
  };

  const handleCancel = () => {
    setIsCountingDown(false);
    setCountdown(targetCount);
    onCancel();
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>{actionLabel}</Text>
          
          <Animated.View style={[styles.countdownCircle, { 
            backgroundColor: buttonColor,
            transform: [{ scale: scaleAnim }]
          }]}>
            <Text style={styles.countdownNumber}>
              {countdown > 0 ? countdown : '✓'}
            </Text>
          </Animated.View>
          
          <Text style={styles.subtitle}>
            {countdown > 0 ? 'Updating status...' : 'Done!'}
          </Text>

          <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    margin: SPACING.lg,
    alignItems: 'center',
    width: '85%',
    maxWidth: 350,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.lg,
  },
  countdownCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  countdownNumber: {
    fontSize: 56,
    fontWeight: '800',
    color: '#fff',
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: SPACING.lg,
  },
  cancelButton: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
  },
  cancelText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
});
