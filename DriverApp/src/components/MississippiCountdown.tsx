import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Animated,
  Platform,
  Vibration,
} from 'react-native';
import { colors, spacing, fontSize, borderRadius } from '../config/theme';

interface MississippiCountdownProps {
  visible: boolean;
  onComplete: () => void;
  onCancel: () => void;
  actionLabel: string;
  actionColor?: string;
}

const MISSISSIPPI_COUNT = 3;

export default function MississippiCountdown({
  visible,
  onComplete,
  onCancel,
  actionLabel,
  actionColor = colors.primary,
}: MississippiCountdownProps) {
  const [displayNumber, setDisplayNumber] = useState(1);
  const [mississippiText, setMississippiText] = useState('1 Mississippi');
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const onCompleteRef = useRef(onComplete);
  
  // Keep the ref updated
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    // Clear any existing interval first
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    if (!visible) {
      // Reset when modal closes
      setDisplayNumber(1);
      setMississippiText('1 Mississippi');
      scaleAnim.setValue(1);
      opacityAnim.setValue(1);
      progressAnim.setValue(0);
      return;
    }

    // Start the countdown - show 1, then 2, then 3, then complete
    let currentNumber = 1;
    let completed = false;
    setDisplayNumber(1);
    setMississippiText('1 Mississippi');

    console.log('🔢 Mississippi countdown started!');

    // Animate progress bar
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: MISSISSIPPI_COUNT * 1000,
      useNativeDriver: false,
    }).start();

    // Initial haptic
    if (Platform.OS !== 'web') {
      Vibration.vibrate(50);
    }

    intervalRef.current = setInterval(() => {
      currentNumber++;
      console.log(`🔢 Mississippi count: ${currentNumber}`);
      
      // Haptic feedback
      if (Platform.OS !== 'web') {
        Vibration.vibrate(50);
      }

      // Animate the number change
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scaleAnim, {
            toValue: 1.3,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0.5,
            duration: 100,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 100,
            useNativeDriver: true,
          }),
        ]),
      ]).start();

      if (currentNumber <= MISSISSIPPI_COUNT) {
        setDisplayNumber(currentNumber);
        setMississippiText(currentNumber === 3 ? '3 Mississippi!' : `${currentNumber} Mississippi`);
      } else if (!completed) {
        completed = true;
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        // Final vibration
        if (Platform.OS !== 'web') {
          Vibration.vibrate([0, 100, 50, 100, 50, 100]);
        }
        console.log('🔢 Mississippi complete! Calling onComplete...');
        onCompleteRef.current();
      }
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [visible]); // Only depend on visible, use ref for onComplete

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Action being confirmed */}
          <View style={[styles.actionBadge, { backgroundColor: actionColor + '20' }]}>
            <Text style={[styles.actionLabel, { color: actionColor }]}>
              {actionLabel}
            </Text>
          </View>

          {/* Big countdown number */}
          <Animated.View
            style={[
              styles.countContainer,
              {
                transform: [{ scale: scaleAnim }],
                opacity: opacityAnim,
              },
            ]}
          >
            <Text style={[styles.countNumber, { color: actionColor }]}>
              {displayNumber}
            </Text>
          </Animated.View>

          {/* Mississippi text */}
          <Animated.Text
            style={[
              styles.mississippiText,
              {
                transform: [{ scale: scaleAnim }],
                opacity: opacityAnim,
              },
            ]}
          >
            {mississippiText}
          </Animated.Text>

          {/* Progress bar */}
          <View style={styles.progressContainer}>
            <Animated.View
              style={[
                styles.progressBar,
                {
                  backgroundColor: actionColor,
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>

          {/* Cancel button */}
          <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
            <Text style={styles.cancelText}>✕ Tap to Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    minWidth: 280,
    maxWidth: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
  },
  actionBadge: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    marginBottom: spacing.lg,
  },
  actionLabel: {
    fontSize: fontSize.md,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  countContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
    borderWidth: 4,
    borderColor: colors.border,
  },
  countNumber: {
    fontSize: 64,
    fontWeight: '800',
  },
  mississippiText: {
    fontSize: fontSize.xl,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
  progressContainer: {
    width: '100%',
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  cancelButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  cancelText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    fontWeight: '500',
  },
});
