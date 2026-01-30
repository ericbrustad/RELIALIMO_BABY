import { Alert, Linking, Platform } from 'react-native';
import { useSettingsStore, NavigationApp } from '../store/useSettingsStore';

export const openNavigationApp = (
  address: string,
  app: NavigationApp
): void => {
  const encodedAddress = encodeURIComponent(address);
  
  switch (app) {
    case 'google':
      const googleUrl = Platform.OS === 'ios'
        ? `comgooglemaps://?daddr=${encodedAddress}&directionsmode=driving`
        : `google.navigation:q=${encodedAddress}`;
      Linking.openURL(googleUrl).catch(() => {
        Linking.openURL(`https://maps.google.com/maps?daddr=${encodedAddress}`);
      });
      break;
      
    case 'apple':
      Linking.openURL(`maps://?daddr=${encodedAddress}`);
      break;
      
    case 'waze':
      Linking.openURL(`waze://?q=${encodedAddress}&navigate=yes`).catch(() => {
        Linking.openURL(`https://waze.com/ul?q=${encodedAddress}&navigate=yes`);
      });
      break;
  }
};

export const navigateToAddress = (
  address: string,
  preferredApp: NavigationApp,
  hasSetPreference: boolean,
  setNavigationApp: (app: NavigationApp) => void
): void => {
  // If user has already set a preference, use it directly
  if (hasSetPreference && preferredApp) {
    openNavigationApp(address, preferredApp);
    return;
  }
  
  // First time - ask user to choose and save preference
  Alert.alert(
    '🗺️ Choose Your Navigation App',
    'This will be your default map for all future trips. You can change it later in Settings.',
    [
      {
        text: 'Google Maps',
        onPress: () => {
          setNavigationApp('google');
          openNavigationApp(address, 'google');
        },
      },
      {
        text: 'Apple Maps',
        onPress: () => {
          setNavigationApp('apple');
          openNavigationApp(address, 'apple');
        },
      },
      {
        text: 'Waze',
        onPress: () => {
          setNavigationApp('waze');
          openNavigationApp(address, 'waze');
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]
  );
};

// Hook for easy use in components
export const useNavigation = () => {
  const { preferredNavigationApp, hasSetNavigationPreference, setNavigationApp } = useSettingsStore();
  
  const navigate = (address: string) => {
    navigateToAddress(address, preferredNavigationApp, hasSetNavigationPreference, setNavigationApp);
  };
  
  return { navigate };
};
