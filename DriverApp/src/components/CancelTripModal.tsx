/**
 * CancelTripModal Component
 * Shows confirmation dialog with reason input when cancelling a trip
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useTheme } from '../context';
import { spacing, fontSize, borderRadius } from '../config/theme';

interface CancelTripModalProps {
  visible: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const PRESET_REASONS = [
  'Vehicle breakdown',
  'Emergency - personal',
  'Emergency - family',
  'Traffic/accident - cannot make pickup',
  'Dispatch instructed cancellation',
  'Customer requested cancellation',
  'Weather conditions unsafe',
  'Other',
];

export default function CancelTripModal({
  visible,
  onConfirm,
  onCancel,
  isLoading = false,
}: CancelTripModalProps) {
  const { colors } = useTheme();
  const [step, setStep] = useState<'confirm' | 'reason'>('confirm');
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [customReason, setCustomReason] = useState('');
  
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const handleYes = () => {
    setStep('reason');
  };
  
  const handleNo = () => {
    resetAndClose();
  };
  
  const handleReasonSelect = (reason: string) => {
    setSelectedReason(reason);
    if (reason !== 'Other') {
      setCustomReason('');
    }
  };
  
  const handleSubmit = () => {
    const finalReason = selectedReason === 'Other' 
      ? customReason.trim() || 'Other (no details provided)'
      : selectedReason;
    
    if (finalReason) {
      onConfirm(finalReason);
    }
  };
  
  const resetAndClose = () => {
    setStep('confirm');
    setSelectedReason(null);
    setCustomReason('');
    onCancel();
  };
  
  const canSubmit = selectedReason && (selectedReason !== 'Other' || customReason.trim().length > 0);
  
  return (
    <Modal visible={visible} transparent animationType="fade">
      <KeyboardAvoidingView 
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.container}>
          {step === 'confirm' ? (
            // Step 1: Confirmation
            <>
              <Text style={styles.warningIcon}>⚠️</Text>
              <Text style={styles.title}>Cancel This Trip?</Text>
              <Text style={styles.message}>
                Are you sure we are going to cancel this trip?
              </Text>
              
              <View style={styles.buttonRow}>
                <TouchableOpacity 
                  style={[styles.button, styles.noButton]} 
                  onPress={handleNo}
                >
                  <Text style={styles.noButtonText}>No</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.button, styles.yesButton]} 
                  onPress={handleYes}
                >
                  <Text style={styles.yesButtonText}>Yes</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            // Step 2: Reason selection
            <>
              <Text style={styles.title}>Cancellation Reason</Text>
              <Text style={styles.subtitle}>
                Please select or enter a reason for cancelling:
              </Text>
              
              <ScrollView style={styles.reasonList} showsVerticalScrollIndicator={false}>
                {PRESET_REASONS.map((reason) => (
                  <TouchableOpacity
                    key={reason}
                    style={[
                      styles.reasonOption,
                      selectedReason === reason && styles.reasonOptionSelected,
                    ]}
                    onPress={() => handleReasonSelect(reason)}
                  >
                    <View style={[
                      styles.radioOuter,
                      selectedReason === reason && styles.radioOuterSelected,
                    ]}>
                      {selectedReason === reason && <View style={styles.radioInner} />}
                    </View>
                    <Text style={[
                      styles.reasonText,
                      selectedReason === reason && styles.reasonTextSelected,
                    ]}>
                      {reason}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              
              {selectedReason === 'Other' && (
                <TextInput
                  style={styles.customInput}
                  placeholder="Please describe the reason..."
                  placeholderTextColor={colors.textMuted}
                  value={customReason}
                  onChangeText={setCustomReason}
                  multiline
                  maxLength={500}
                  autoFocus
                />
              )}
              
              <View style={styles.buttonRow}>
                <TouchableOpacity 
                  style={[styles.button, styles.backButton]} 
                  onPress={() => setStep('confirm')}
                  disabled={isLoading}
                >
                  <Text style={styles.backButtonText}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[
                    styles.button, 
                    styles.submitButton,
                    !canSubmit && styles.buttonDisabled,
                  ]} 
                  onPress={handleSubmit}
                  disabled={!canSubmit || isLoading}
                >
                  <Text style={styles.submitButtonText}>
                    {isLoading ? 'Cancelling...' : 'Cancel Trip'}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  container: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    alignItems: 'center',
  },
  warningIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  message: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.md,
    width: '100%',
  },
  button: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  noButton: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
  },
  noButtonText: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text,
  },
  yesButton: {
    backgroundColor: colors.danger,
  },
  yesButtonText: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.white,
  },
  backButton: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
  },
  backButtonText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
  },
  submitButton: {
    backgroundColor: colors.danger,
  },
  submitButtonText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.white,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  reasonList: {
    width: '100%',
    maxHeight: 250,
    marginBottom: spacing.md,
  },
  reasonOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xs,
  },
  reasonOptionSelected: {
    backgroundColor: colors.danger + '15',
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    marginRight: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioOuterSelected: {
    borderColor: colors.danger,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.danger,
  },
  reasonText: {
    fontSize: fontSize.md,
    color: colors.text,
    flex: 1,
  },
  reasonTextSelected: {
    fontWeight: '600',
    color: colors.danger,
  },
  customInput: {
    width: '100%',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: fontSize.md,
    color: colors.text,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: spacing.md,
  },
});
