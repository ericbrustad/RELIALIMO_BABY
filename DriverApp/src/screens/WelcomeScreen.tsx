import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Dimensions,
  Animated,
  Linking,
  Alert,
  Platform,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';

const { width } = Dimensions.get('window');

const LOGO_URL = 'https://siumiadylwcrkaqsfwkj.supabase.co/storage/v1/object/public/images/reliabull%20limo%20logowhitecropped.png';

type RootStackParamList = {
  Welcome: { driverName: string; driverId: string };
  Dashboard: undefined;
};

type RouteParams = RouteProp<RootStackParamList, 'Welcome'>;

export function WelcomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteParams>();
  const { driverName, driverId } = route.params;
  
  const [locationGranted, setLocationGranted] = useState(false);
  const [requestingLocation, setRequestingLocation] = useState(false);
  const [showDashboardBtn, setShowDashboardBtn] = useState(false);
  
  // Animations
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const scaleAnim = React.useRef(new Animated.Value(0.8)).current;
  
  useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 20,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);
  
  // Request location permission
  const handleEnableLocation = async () => {
    setRequestingLocation(true);
    
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status === 'granted') {
        setLocationGranted(true);
        setShowDashboardBtn(true);
        
        // Also request background location if needed
        if (Platform.OS === 'ios') {
          await Location.requestBackgroundPermissionsAsync();
        }
      } else {
        Alert.alert(
          'Location Permission',
          'Location access helps dispatch track your progress and show you nearby trips.',
          [
            { text: 'Skip for Now', onPress: () => setShowDashboardBtn(true) },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
      }
    } catch (error) {
      console.error('[WelcomeScreen] Location error:', error);
      setShowDashboardBtn(true);
    } finally {
      setRequestingLocation(false);
    }
  };
  
  // Skip location for now
  const handleSkipLocation = () => {
    setShowDashboardBtn(true);
  };
  
  // Go to dashboard
  const handleGoDashboard = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Dashboard' }],
    });
  };
  
  // Generate driver portal URL
  const portalUrl = `driver.relialimo.com/${driverName.toLowerCase().replace(/\s+/g, '_')}`;
  
  return (
    <SafeAreaView style={styles.container}>
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* Celebration Icon */}
        <View style={styles.celebrationIcon}>
          <Text style={styles.celebrationEmoji}>🎉</Text>
        </View>
        
        {/* Title */}
        <Text style={styles.title}>Congratulations!</Text>
        <Text style={styles.subtitle}>
          Your driver account has been created successfully
        </Text>
        
        {/* Welcome Card */}
        <View style={styles.welcomeCard}>
          <Image
            source={{ uri: LOGO_URL }}
            style={styles.cardLogo}
            resizeMode="contain"
          />
          <Text style={styles.driverName}>Welcome, {driverName}!</Text>
          <Text style={styles.welcomeText}>
            You're now part of the RELIALIMO driver network
          </Text>
        </View>
        
        {/* Portal URL Box */}
        <View style={styles.portalUrlBox}>
          <Text style={styles.portalUrlLabel}>📱 Your Personal Portal URL:</Text>
          <TouchableOpacity>
            <Text style={styles.portalUrl}>{portalUrl}</Text>
          </TouchableOpacity>
          <Text style={styles.portalUrlHint}>
            Bookmark this link to access your portal anytime!
          </Text>
        </View>
        
        {/* Location Permission */}
        {!locationGranted && !showDashboardBtn && (
          <View style={styles.locationBox}>
            <Text style={styles.locationIcon}>📍</Text>
            <Text style={styles.locationTitle}>Enable Location Services</Text>
            <Text style={styles.locationText}>
              We need your location to show you nearby trip offers and help dispatch track your progress.
            </Text>
            <TouchableOpacity
              style={[styles.locationBtn, requestingLocation && styles.btnDisabled]}
              onPress={handleEnableLocation}
              disabled={requestingLocation}
            >
              <Text style={styles.locationBtnText}>
                {requestingLocation ? 'Requesting...' : '📍 Enable Location'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSkipLocation}>
              <Text style={styles.skipText}>Skip for now</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {/* Location Granted */}
        {locationGranted && (
          <View style={styles.locationGranted}>
            <View style={styles.successCheck}>
              <Text style={styles.successCheckText}>✓</Text>
            </View>
            <Text style={styles.locationGrantedText}>Location services enabled!</Text>
          </View>
        )}
        
        {/* Go to Dashboard Button */}
        {showDashboardBtn && (
          <TouchableOpacity style={styles.dashboardBtn} onPress={handleGoDashboard}>
            <Text style={styles.dashboardBtnText}>🚀 Go to Dashboard</Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    alignItems: 'center',
  },
  celebrationIcon: {
    marginBottom: 16,
  },
  celebrationEmoji: {
    fontSize: 64,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#aaa',
    textAlign: 'center',
    marginBottom: 32,
  },
  welcomeCard: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    marginBottom: 24,
  },
  cardLogo: {
    width: 100,
    height: 50,
    marginBottom: 12,
  },
  driverName: {
    fontSize: 22,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
  },
  welcomeText: {
    fontSize: 14,
    color: '#aaa',
    textAlign: 'center',
  },
  portalUrlBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 24,
  },
  portalUrlLabel: {
    fontSize: 14,
    color: '#aaa',
    marginBottom: 8,
  },
  portalUrl: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6366f1',
    textDecorationLine: 'underline',
  },
  portalUrlHint: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  locationBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  locationIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  locationTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
  },
  locationText: {
    fontSize: 14,
    color: '#aaa',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  locationBtn: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginBottom: 12,
  },
  locationBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  skipText: {
    color: '#888',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  locationGranted: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    justifyContent: 'center',
    marginBottom: 24,
  },
  successCheck: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#22c55e',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  successCheckText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  locationGrantedText: {
    color: '#22c55e',
    fontSize: 16,
    fontWeight: '500',
  },
  dashboardBtn: {
    backgroundColor: '#22c55e',
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 48,
    marginTop: 16,
  },
  dashboardBtnText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  btnDisabled: {
    opacity: 0.6,
  },
});

export default WelcomeScreen;
