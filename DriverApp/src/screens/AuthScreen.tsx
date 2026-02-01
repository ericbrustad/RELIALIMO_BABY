import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '../store';
import { useTheme } from '../context';
import { spacing, fontSize, borderRadius } from '../config/theme';
import { supabase } from '../config/supabase';
import type { RootStackParamList } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const LOGO_URL = 'https://siumiadylwcrkaqsfwkj.supabase.co/storage/v1/object/public/images/reliabull%20limo%20logowhitecropped.png';

export default function AuthScreen() {
  const navigation = useNavigation<Nav>();
  const { signIn, isLoading, error, clearError } = useAuthStore();
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  
  // Create dynamic styles based on current theme
  const styles = useMemo(() => createStyles(colors), [colors]);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }
    clearError();
    const result = await signIn(email.trim(), password);
    if (!result.success) {
      Alert.alert('Login Failed', result.error || 'Please check your credentials');
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      if (Platform.OS === 'web') {
        // For web, use direct redirect to Supabase OAuth
        const supabaseUrl = 'https://siumiadylwcrkaqsfwkj.supabase.co';
        const redirectUrl = window.location.origin + window.location.pathname;
        console.log('[AuthScreen] Starting Google OAuth with redirect:', redirectUrl);
        
        const authUrl = `${supabaseUrl}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectUrl)}`;
        window.location.href = authUrl;
      } else {
        // For native, use Supabase OAuth with deep linking
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: 'relialimo://auth/callback',
          },
        });
        
        if (error) {
          console.error('[AuthScreen] Google OAuth error:', error);
          Alert.alert('Error', error.message || 'Google sign-in failed');
        }
      }
    } catch (err: any) {
      console.error('[AuthScreen] Google sign-in error:', err);
      Alert.alert('Error', 'Google sign-in failed. Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleRegister = () => {
    navigation.navigate('Register');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Image
              source={{ uri: LOGO_URL }}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.subtitle}>Driver Portal</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="driver@example.com"
                placeholderTextColor={colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordWrapper}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity 
                  style={styles.eyeButton}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Text style={styles.eyeIcon}>{showPassword ? '👁️' : '👁️‍🗨️'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {error && <Text style={styles.errorText}>{error}</Text>}

            <TouchableOpacity
              style={[styles.button, isLoading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={isLoading}
            >
              {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign In</Text>}
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Google Sign In */}
            <TouchableOpacity
              style={[styles.googleButton, googleLoading && styles.buttonDisabled]}
              onPress={handleGoogleSignIn}
              disabled={googleLoading}
            >
              {googleLoading ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <>
                  <Text style={styles.googleIcon}>G</Text>
                  <Text style={styles.googleButtonText}>Continue with Google</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Register Link */}
            <View style={styles.registerContainer}>
              <Text style={styles.registerText}>New driver? </Text>
              <TouchableOpacity onPress={handleRegister}>
                <Text style={styles.registerLink}>Create Account</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.footer}>Contact dispatch if you need account access</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Create dynamic styles based on theme colors
const createStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  keyboardView: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', padding: spacing.xl },
  header: { alignItems: 'center', marginBottom: spacing.xxxl },
  logo: { width: 200, height: 80, marginBottom: spacing.md },
  subtitle: { fontSize: fontSize.lg, color: colors.textSecondary, marginTop: spacing.xs },
  form: { gap: spacing.lg },
  inputContainer: { gap: spacing.xs },
  label: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textSecondary, marginLeft: spacing.xs },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.md, padding: spacing.md, fontSize: fontSize.md, color: colors.text },
  passwordWrapper: { position: 'relative' as const },
  passwordInput: { paddingRight: 50 },
  eyeButton: { position: 'absolute' as const, right: spacing.md, top: 0, bottom: 0, justifyContent: 'center' as const },
  eyeIcon: { fontSize: 20 },
  button: { backgroundColor: colors.primary, borderRadius: borderRadius.md, padding: spacing.md, alignItems: 'center' as const, marginTop: spacing.md },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { fontSize: fontSize.lg, fontWeight: '600', color: '#fff' },
  divider: { flexDirection: 'row' as const, alignItems: 'center' as const, marginVertical: spacing.md },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { paddingHorizontal: spacing.md, color: colors.textSecondary, fontSize: fontSize.sm },
  googleButton: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.md, padding: spacing.md, gap: spacing.sm },
  googleIcon: { fontSize: 20, fontWeight: '700' as const, color: '#4285F4' },
  googleButtonText: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  registerContainer: { flexDirection: 'row' as const, justifyContent: 'center' as const, marginTop: spacing.lg },
  registerText: { fontSize: fontSize.md, color: colors.textSecondary },
  registerLink: { fontSize: fontSize.md, fontWeight: '600', color: colors.primary },
  errorText: { color: colors.danger, fontSize: fontSize.sm, textAlign: 'center' as const },
  footer: { fontSize: fontSize.sm, color: colors.textMuted, textAlign: 'center' as const, marginTop: spacing.xxl },
});
