import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore, useSettingsStore } from '../store';
import { useTheme } from '../context';
import { spacing, fontSize, borderRadius } from '../config/theme';

const NAV_APP_LABELS: Record<string, string> = {
  google: 'Google Maps',
  apple: 'Apple Maps',
  waze: 'Waze',
};

export default function ProfileScreen() {
  const { driver, signOut } = useAuthStore();
  const { preferredNavigationApp, hasSetNavigationPreference, setNavigationApp, resetNavigationPreference } = useSettingsStore();
  const { colors } = useTheme();
  
  // Create dynamic styles based on current theme
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: signOut,
        },
      ]
    );
  };
  
  const handleChangeNavigationApp = () => {
    Alert.alert(
      '🗺️ Default Navigation App',
      'Choose your preferred navigation app for driving directions',
      [
        {
          text: 'Google Maps',
          onPress: () => setNavigationApp('google'),
        },
        {
          text: 'Apple Maps',
          onPress: () => setNavigationApp('apple'),
        },
        {
          text: 'Waze',
          onPress: () => setNavigationApp('waze'),
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };
  
  const getFullName = () => {
    if (!driver) return 'Driver';
    return `${driver.first_name || ''} ${driver.last_name || ''}`.trim() || 'Driver';
  };
  
  const getInitials = () => {
    const name = getFullName();
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };
  
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials()}</Text>
          </View>
          <Text style={styles.name}>{getFullName()}</Text>
          {driver?.email && (
            <Text style={styles.email}>{driver.email}</Text>
          )}
        </View>
        
        {/* Info Cards */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Information</Text>
          
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{driver?.email || 'Not set'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Phone</Text>
              <Text style={styles.infoValue}>{driver?.phone || 'Not set'}</Text>
            </View>
          </View>
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Driver Information</Text>
          
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Status</Text>
              <Text style={styles.infoValue}>{driver?.status || 'Available'}</Text>
            </View>
            {driver?.vehicle_type && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Vehicle Type</Text>
                <Text style={styles.infoValue}>{driver.vehicle_type}</Text>
              </View>
            )}
          </View>
        </View>
        
        {/* App Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App</Text>
          
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Version</Text>
              <Text style={styles.infoValue}>1.0.0</Text>
            </View>
          </View>
        </View>
        
        {/* Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>
          
          <View style={styles.infoCard}>
            <TouchableOpacity style={styles.settingsRow} onPress={handleChangeNavigationApp}>
              <View>
                <Text style={styles.infoLabel}>Default Navigation App</Text>
                <Text style={styles.settingsValue}>
                  {hasSetNavigationPreference && preferredNavigationApp 
                    ? NAV_APP_LABELS[preferredNavigationApp] 
                    : 'Not set - tap to choose'}
                </Text>
              </View>
              <Text style={styles.settingsArrow}>›</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Sign Out */}
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutButtonText}>Sign Out</Text>
        </TouchableOpacity>
        
        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// Create dynamic styles based on theme colors
const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
    padding: spacing.lg,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatarText: {
    fontSize: 36,
    fontWeight: '700',
    color: '#fff',
  },
  name: {
    fontSize: fontSize.xxl,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  email: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infoLabel: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  infoValue: {
    fontSize: fontSize.md,
    fontWeight: '500',
    color: colors.text,
  },
  signOutButton: {
    backgroundColor: colors.danger + '20',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  signOutButtonText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.danger,
  },
  settingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  settingsValue: {
    fontSize: fontSize.sm,
    color: colors.primary,
    marginTop: 2,
  },
  settingsArrow: {
    fontSize: 24,
    color: colors.textMuted,
  },
});
