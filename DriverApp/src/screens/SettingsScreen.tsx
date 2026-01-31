import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '../store';
import { useSettingsStore } from '../store/useSettingsStore';
import { useTheme } from '../context';
import { spacing, fontSize, borderRadius } from '../config/theme';
import type { RootStackParamList } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const MAP_PROVIDERS = [
  { id: 'google', name: 'Google Maps', icon: '🗺️' },
  { id: 'apple', name: 'Apple Maps', icon: '🍎' },
  { id: 'waze', name: 'Waze', icon: '👻' },
];

export default function SettingsScreen() {
  const navigation = useNavigation<Nav>();
  const { driver, signOut } = useAuthStore();
  const { preferredNavApp, setPreferredNavApp, darkMode, toggleDarkMode } = useSettingsStore();
  const { colors } = useTheme();
  const [showMapPicker, setShowMapPicker] = useState(false);
  
  // Create dynamic styles based on current theme
  const styles = useMemo(() => createStyles(colors), [colors]);

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Log Out', 
          style: 'destructive',
          onPress: async () => {
            await signOut();
          }
        },
      ]
    );
  };

  const getMapProviderName = () => {
    const provider = MAP_PROVIDERS.find(p => p.id === preferredNavApp);
    return provider ? `${provider.icon} ${provider.name}` : '🗺️ Google Maps';
  };

  const getInitials = () => {
    if (!driver) return '??';
    const first = driver.first_name?.[0] || '';
    const last = driver.last_name?.[0] || '';
    return `${first}${last}`.toUpperCase() || '??';
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials()}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>
              {driver?.first_name} {driver?.last_name}
            </Text>
            <Text style={styles.profileEmail}>{driver?.email}</Text>
          </View>
        </View>

        {/* Settings Sections */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ACCOUNT</Text>
          
          <TouchableOpacity 
            style={styles.settingsItem} 
            onPress={() => navigation.navigate('Profile')}
          >
            <Text style={styles.settingsIcon}>👤</Text>
            <View style={styles.settingsContent}>
              <Text style={styles.settingsLabel}>Profile</Text>
              <Text style={styles.settingsHint}>Edit your information</Text>
            </View>
            <Text style={styles.settingsArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.settingsItem}
            onPress={() => navigation.navigate('GreetingSign')}
          >
            <Text style={styles.settingsIcon}>📝</Text>
            <View style={styles.settingsContent}>
              <Text style={styles.settingsLabel}>Greeting Sign Maker</Text>
              <Text style={styles.settingsHint}>Create passenger signs</Text>
            </View>
            <Text style={styles.settingsArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.settingsItem}
            onPress={() => navigation.navigate('TripHistory')}
          >
            <Text style={styles.settingsIcon}>📋</Text>
            <View style={styles.settingsContent}>
              <Text style={styles.settingsLabel}>Trip History</Text>
              <Text style={styles.settingsHint}>View completed trips & earnings</Text>
            </View>
            <Text style={styles.settingsArrow}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PREFERENCES</Text>
          
          <TouchableOpacity 
            style={styles.settingsItem}
            onPress={() => setShowMapPicker(!showMapPicker)}
          >
            <Text style={styles.settingsIcon}>🗺️</Text>
            <View style={styles.settingsContent}>
              <Text style={styles.settingsLabel}>Map Provider</Text>
              <Text style={styles.settingsValue}>{getMapProviderName()}</Text>
            </View>
            <Text style={styles.settingsArrow}>{showMapPicker ? '▼' : '›'}</Text>
          </TouchableOpacity>

          {showMapPicker && (
            <View style={styles.pickerContainer}>
              {MAP_PROVIDERS.map((provider) => (
                <TouchableOpacity
                  key={provider.id}
                  style={[
                    styles.pickerOption,
                    preferredNavApp === provider.id && styles.pickerOptionSelected,
                  ]}
                  onPress={() => {
                    setPreferredNavApp(provider.id as 'google' | 'apple' | 'waze');
                    setShowMapPicker(false);
                  }}
                >
                  <Text style={styles.pickerIcon}>{provider.icon}</Text>
                  <Text style={[
                    styles.pickerLabel,
                    preferredNavApp === provider.id && styles.pickerLabelSelected,
                  ]}>
                    {provider.name}
                  </Text>
                  {preferredNavApp === provider.id && (
                    <Text style={styles.pickerCheck}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}

          <TouchableOpacity 
            style={styles.settingsItem}
            onPress={() => navigation.navigate('CalendarSync')}
          >
            <Text style={styles.settingsIcon}>📅</Text>
            <View style={styles.settingsContent}>
              <Text style={styles.settingsLabel}>Calendar Sync</Text>
              <Text style={styles.settingsHint}>Google Calendar integration</Text>
            </View>
            <Text style={styles.settingsArrow}>›</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.settingsItem}
            onPress={toggleDarkMode}
          >
            <Text style={styles.settingsIcon}>{darkMode ? '🌙' : '☀️'}</Text>
            <View style={styles.settingsContent}>
              <Text style={styles.settingsLabel}>Appearance</Text>
              <Text style={styles.settingsValue}>{darkMode ? 'Dark Mode' : 'Light Mode'}</Text>
            </View>
            <Text style={styles.settingsArrow}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SUPPORT</Text>
          
          <TouchableOpacity style={styles.settingsItem}>
            <Text style={styles.settingsIcon}>❓</Text>
            <View style={styles.settingsContent}>
              <Text style={styles.settingsLabel}>Help & Support</Text>
              <Text style={styles.settingsHint}>FAQs and contact</Text>
            </View>
            <Text style={styles.settingsArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingsItem}>
            <Text style={styles.settingsIcon}>📋</Text>
            <View style={styles.settingsContent}>
              <Text style={styles.settingsLabel}>Terms & Privacy</Text>
              <Text style={styles.settingsHint}>Legal information</Text>
            </View>
            <Text style={styles.settingsArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutIcon}>🚪</Text>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Version 1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// Create dynamic styles based on theme colors
const createStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollView: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: borderRadius.xl,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: fontSize.xxl,
    fontWeight: '700',
    color: colors.white,
  },
  profileInfo: {
    marginLeft: spacing.lg,
    flex: 1,
  },
  profileName: {
    fontSize: fontSize.xl,
    fontWeight: '600',
    color: colors.text,
  },
  profileEmail: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
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
    marginLeft: spacing.xs,
  },

  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  settingsIcon: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  settingsContent: {
    flex: 1,
  },
  settingsLabel: {
    fontSize: fontSize.md,
    fontWeight: '500',
    color: colors.text,
  },
  settingsHint: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  settingsValue: {
    fontSize: fontSize.sm,
    color: colors.primary,
    marginTop: 2,
  },
  settingsArrow: {
    fontSize: fontSize.xl,
    color: colors.textMuted,
  },

  pickerContainer: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickerOptionSelected: {
    backgroundColor: colors.primary + '15',
  },
  pickerIcon: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  pickerLabel: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.text,
  },
  pickerLabelSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  pickerCheck: {
    fontSize: fontSize.lg,
    color: colors.primary,
    fontWeight: '700',
  },

  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.danger + '15',
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.danger + '30',
  },
  logoutIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  logoutText: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.danger,
  },

  version: {
    textAlign: 'center',
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: spacing.xl,
  },
});
