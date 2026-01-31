import React, { useEffect, useMemo } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuthStore } from '../store';
import { useTheme } from '../context';
import { fontSize, spacing } from '../config/theme';

export default function SplashScreen() {
  const { initialize } = useAuthStore();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  useEffect(() => { initialize(); }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>🚗</Text>
      <Text style={styles.title}>ReliaLimo</Text>
      <Text style={styles.subtitle}>Driver App</Text>
      <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
    </View>
  );
}

// Create dynamic styles based on theme colors
const createStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  logo: { fontSize: 80, marginBottom: spacing.md },
  title: { fontSize: fontSize.display, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: fontSize.lg, color: colors.textSecondary, marginTop: spacing.xs },
  loader: { marginTop: spacing.xxl },
});
