/**
 * BackButton Component
 * A large, prominent back button for navigation
 */

import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context';

interface BackButtonProps {
  onPress?: () => void;
  title?: string;
  showTitle?: boolean;
}

export default function BackButton({ onPress, title, showTitle = true }: BackButtonProps) {
  const navigation = useNavigation();
  const { colors } = useTheme();

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.button, { backgroundColor: colors.surface }]}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        <Text style={styles.arrow}>←</Text>
        {showTitle && title && (
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {title}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  arrow: {
    fontSize: 28,
    fontWeight: '600',
    marginRight: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
});
