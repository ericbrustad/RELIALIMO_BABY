import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context';
import { spacing, fontSize, borderRadius } from '../config/theme';

interface CalendarAccount {
  id: string;
  name: string;
  email: string;
  provider: 'google' | 'apple' | 'outlook';
  isConnected: boolean;
  lastSync?: string;
}

const CALENDAR_PROVIDERS = [
  { id: 'google', name: 'Google Calendar', icon: '📅', color: '#4285F4' },
  { id: 'apple', name: 'Apple Calendar', icon: '🍎', color: '#000000' },
  { id: 'outlook', name: 'Outlook Calendar', icon: '📧', color: '#0078D4' },
];

export default function CalendarSyncScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const [connectedAccounts, setConnectedAccounts] = useState<CalendarAccount[]>([]);
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [autoAddTrips, setAutoAddTrips] = useState(true);
  const [reminderTime, setReminderTime] = useState<'15min' | '30min' | '1hour' | '2hours'>('30min');

  const handleConnectCalendar = (providerId: string) => {
    const provider = CALENDAR_PROVIDERS.find(p => p.id === providerId);
    
    Alert.alert(
      `Connect ${provider?.name}`,
      'This will open your browser to authenticate with your calendar account.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Continue',
          onPress: () => {
            // In production, this would initiate OAuth flow
            Alert.alert(
              'Coming Soon',
              'Calendar sync integration will be available in a future update.',
              [{ text: 'OK' }]
            );
          }
        },
      ]
    );
  };

  const handleDisconnect = (accountId: string) => {
    Alert.alert(
      'Disconnect Account',
      'Are you sure you want to disconnect this calendar?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Disconnect',
          style: 'destructive',
          onPress: () => {
            setConnectedAccounts(prev => prev.filter(a => a.id !== accountId));
          }
        },
      ]
    );
  };

  const getReminderLabel = () => {
    switch (reminderTime) {
      case '15min': return '15 minutes before';
      case '30min': return '30 minutes before';
      case '1hour': return '1 hour before';
      case '2hours': return '2 hours before';
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <Text style={styles.infoIcon}>📅</Text>
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Sync Your Trips</Text>
            <Text style={styles.infoText}>
              Connect your calendar to automatically add trips and receive reminders.
            </Text>
          </View>
        </View>

        {/* Connected Accounts */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>CONNECTED CALENDARS</Text>
          
          {connectedAccounts.length > 0 ? (
            connectedAccounts.map((account) => {
              const provider = CALENDAR_PROVIDERS.find(p => p.id === account.provider);
              return (
                <View key={account.id} style={styles.accountItem}>
                  <View style={[styles.accountIcon, { backgroundColor: provider?.color + '20' }]}>
                    <Text style={styles.accountIconText}>{provider?.icon}</Text>
                  </View>
                  <View style={styles.accountInfo}>
                    <Text style={styles.accountName}>{account.name}</Text>
                    <Text style={styles.accountEmail}>{account.email}</Text>
                    {account.lastSync && (
                      <Text style={styles.lastSync}>Last synced: {account.lastSync}</Text>
                    )}
                  </View>
                  <TouchableOpacity 
                    style={styles.disconnectButton}
                    onPress={() => handleDisconnect(account.id)}
                  >
                    <Text style={styles.disconnectText}>✕</Text>
                  </TouchableOpacity>
                </View>
              );
            })
          ) : (
            <View style={styles.noAccounts}>
              <Text style={styles.noAccountsText}>No calendars connected</Text>
            </View>
          )}
        </View>

        {/* Add Calendar */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ADD CALENDAR</Text>
          
          {CALENDAR_PROVIDERS.map((provider) => (
            <TouchableOpacity
              key={provider.id}
              style={styles.providerButton}
              onPress={() => handleConnectCalendar(provider.id)}
            >
              <View style={[styles.providerIcon, { backgroundColor: provider.color + '15' }]}>
                <Text style={styles.providerIconText}>{provider.icon}</Text>
              </View>
              <Text style={styles.providerName}>{provider.name}</Text>
              <Text style={styles.providerArrow}>+</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Sync Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SYNC SETTINGS</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Enable Sync</Text>
              <Text style={styles.settingHint}>Automatically sync trips to calendar</Text>
            </View>
            <Switch
              value={syncEnabled}
              onValueChange={setSyncEnabled}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.white}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Auto-add New Trips</Text>
              <Text style={styles.settingHint}>Add accepted trips to calendar</Text>
            </View>
            <Switch
              value={autoAddTrips}
              onValueChange={setAutoAddTrips}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.white}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Reminder</Text>
              <Text style={styles.settingValue}>{getReminderLabel()}</Text>
            </View>
          </View>

          <View style={styles.reminderOptions}>
            {(['15min', '30min', '1hour', '2hours'] as const).map((time) => (
              <TouchableOpacity
                key={time}
                style={[
                  styles.reminderOption,
                  reminderTime === time && styles.reminderOptionSelected,
                ]}
                onPress={() => setReminderTime(time)}
              >
                <Text style={[
                  styles.reminderOptionText,
                  reminderTime === time && styles.reminderOptionTextSelected,
                ]}>
                  {time === '15min' ? '15m' : time === '30min' ? '30m' : time === '1hour' ? '1h' : '2h'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Help Text */}
        <Text style={styles.helpText}>
          💡 Calendar events will include pickup time, passenger name, and addresses
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

  infoBanner: {
    flexDirection: 'row',
    backgroundColor: colors.primary + '15',
    borderWidth: 1,
    borderColor: colors.primary + '30',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  infoIcon: {
    fontSize: 32,
    marginRight: spacing.md,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  infoText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
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

  accountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  accountIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  accountIconText: {
    fontSize: 20,
  },
  accountInfo: {
    flex: 1,
  },
  accountName: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
  },
  accountEmail: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  lastSync: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  disconnectButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.danger + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disconnectText: {
    color: colors.danger,
    fontWeight: '600',
  },

  noAccounts: {
    backgroundColor: colors.surface,
    padding: spacing.xl,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  noAccountsText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },

  providerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  providerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  providerIconText: {
    fontSize: 20,
  },
  providerName: {
    flex: 1,
    fontSize: fontSize.md,
    fontWeight: '500',
    color: colors.text,
  },
  providerArrow: {
    fontSize: fontSize.xl,
    color: colors.primary,
    fontWeight: '600',
  },

  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  settingContent: {
    flex: 1,
  },
  settingLabel: {
    fontSize: fontSize.md,
    fontWeight: '500',
    color: colors.text,
  },
  settingHint: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  settingValue: {
    fontSize: fontSize.sm,
    color: colors.primary,
    marginTop: 2,
  },

  reminderOptions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  reminderOption: {
    flex: 1,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  reminderOptionSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  reminderOptionText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
  },
  reminderOptionTextSelected: {
    color: colors.white,
  },

  helpText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});
