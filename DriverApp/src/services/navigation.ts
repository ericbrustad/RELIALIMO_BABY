/**
 * Navigation Service
 * Opens external navigation apps (Google Maps, Apple Maps, Waze)
 */

import { Linking, Platform, Alert } from 'react-native';

export type NavigationApp = 'google' | 'apple' | 'waze' | 'default';

interface NavigationOptions {
  latitude: number;
  longitude: number;
  label?: string;
  travelMode?: 'driving' | 'walking' | 'transit';
}

/**
 * Build URL for Google Maps navigation
 */
function buildGoogleMapsUrl(options: NavigationOptions): string {
  const { latitude, longitude, label, travelMode = 'driving' } = options;
  const destination = `${latitude},${longitude}`;
  const modeParam = travelMode === 'driving' ? 'driving' : travelMode;
  
  // Use comgooglemaps:// scheme on iOS if available
  if (Platform.OS === 'ios') {
    return `comgooglemaps://?daddr=${destination}&directionsmode=${modeParam}`;
  }
  
  // Use intent on Android, fallback to web
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=${modeParam}`;
}

/**
 * Build URL for Apple Maps navigation
 */
function buildAppleMapsUrl(options: NavigationOptions): string {
  const { latitude, longitude, label } = options;
  const destination = `${latitude},${longitude}`;
  const nameParam = label ? `&q=${encodeURIComponent(label)}` : '';
  
  return `maps://app?daddr=${destination}${nameParam}&dirflg=d`;
}

/**
 * Build URL for Waze navigation
 */
function buildWazeUrl(options: NavigationOptions): string {
  const { latitude, longitude } = options;
  return `waze://?ll=${latitude},${longitude}&navigate=yes`;
}

/**
 * Build URL for address-based navigation (when coordinates aren't available)
 */
export function buildAddressNavigationUrl(
  address: string,
  app: NavigationApp = 'default'
): string {
  const encodedAddress = encodeURIComponent(address);
  
  switch (app) {
    case 'google':
      if (Platform.OS === 'ios') {
        return `comgooglemaps://?daddr=${encodedAddress}&directionsmode=driving`;
      }
      return `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}&travelmode=driving`;
    
    case 'apple':
      return `maps://app?daddr=${encodedAddress}&dirflg=d`;
    
    case 'waze':
      return `waze://?q=${encodedAddress}&navigate=yes`;
    
    default:
      if (Platform.OS === 'ios') {
        return `maps://app?daddr=${encodedAddress}&dirflg=d`;
      }
      return `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}&travelmode=driving`;
  }
}

/**
 * Check if a navigation app is available
 */
export async function isAppAvailable(app: NavigationApp): Promise<boolean> {
  try {
    switch (app) {
      case 'google':
        if (Platform.OS === 'ios') {
          return await Linking.canOpenURL('comgooglemaps://');
        }
        return true; // Google Maps web always available
      
      case 'apple':
        return Platform.OS === 'ios';
      
      case 'waze':
        return await Linking.canOpenURL('waze://');
      
      default:
        return true;
    }
  } catch {
    return false;
  }
}

/**
 * Open navigation to coordinates
 */
export async function navigateTo(
  options: NavigationOptions,
  app: NavigationApp = 'default'
): Promise<boolean> {
  try {
    let url: string;
    
    switch (app) {
      case 'google':
        url = buildGoogleMapsUrl(options);
        break;
      
      case 'apple':
        if (Platform.OS !== 'ios') {
          console.log('[Navigation] Apple Maps only available on iOS');
          return navigateTo(options, 'google');
        }
        url = buildAppleMapsUrl(options);
        break;
      
      case 'waze':
        url = buildWazeUrl(options);
        break;
      
      default:
        // Use platform default
        if (Platform.OS === 'ios') {
          url = buildAppleMapsUrl(options);
        } else {
          url = buildGoogleMapsUrl(options);
        }
    }
    
    const canOpen = await Linking.canOpenURL(url);
    
    if (!canOpen) {
      // Fallback to Google Maps web
      const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${options.latitude},${options.longitude}&travelmode=driving`;
      await Linking.openURL(webUrl);
      return true;
    }
    
    await Linking.openURL(url);
    return true;
  } catch (error) {
    console.error('[Navigation] Error opening navigation:', error);
    return false;
  }
}

/**
 * Open navigation to address string
 * If hasSetPreference is false and setNavigationApp is provided,
 * it will prompt the user to choose and save their preference
 */
export async function navigateToAddress(
  address: string,
  appOrDefault: NavigationApp = 'default',
  hasSetPreference?: boolean,
  setNavigationApp?: (app: NavigationApp) => void
): Promise<boolean> {
  try {
    // If preference hasn't been set and we have a setter, prompt user to choose
    if (hasSetPreference === false && setNavigationApp) {
      return new Promise((resolve) => {
        promptForNavigationApp(address, setNavigationApp, resolve);
      });
    }
    
    const url = buildAddressNavigationUrl(address, appOrDefault);
    const canOpen = await Linking.canOpenURL(url);
    
    if (!canOpen && appOrDefault !== 'default') {
      // Fallback to default
      return navigateToAddress(address, 'default');
    }
    
    await Linking.openURL(url);
    return true;
  } catch (error) {
    console.error('[Navigation] Error opening navigation:', error);
    return false;
  }
}

/**
 * Prompt user to choose navigation app and save preference
 */
function promptForNavigationApp(
  address: string,
  setNavigationApp: (app: NavigationApp) => void,
  resolve: (value: boolean) => void
): void {
  const apps: { name: string; app: NavigationApp }[] = [
    { name: 'Google Maps', app: 'google' },
    { name: 'Apple Maps', app: 'apple' },
    { name: 'Waze', app: 'waze' },
  ];
  
  const buttons: any[] = apps.map(({ name, app }) => ({
    text: name,
    onPress: async () => {
      setNavigationApp(app);
      const url = buildAddressNavigationUrl(address, app);
      try {
        await Linking.openURL(url);
        resolve(true);
      } catch {
        resolve(false);
      }
    },
  }));
  buttons.push({ text: 'Cancel', style: 'cancel', onPress: () => resolve(false) });
  
  Alert.alert(
    'Choose Navigation App',
    'This will be saved for future trips',
    buttons,
    { cancelable: true }
  );
}

/**
 * Show navigation app picker
 */
export async function showNavigationPicker(
  latitude: number,
  longitude: number,
  label?: string
): Promise<void> {
  const options: NavigationOptions = { latitude, longitude, label };
  
  const apps: { name: string; app: NavigationApp; available: boolean }[] = [
    { name: 'Google Maps', app: 'google', available: await isAppAvailable('google') },
    { name: 'Apple Maps', app: 'apple', available: await isAppAvailable('apple') },
    { name: 'Waze', app: 'waze', available: await isAppAvailable('waze') },
  ];
  
  const availableApps = apps.filter(a => a.available);
  
  if (availableApps.length === 0) {
    // Fallback to Google Maps web
    navigateTo(options, 'google');
    return;
  }
  
  if (availableApps.length === 1) {
    navigateTo(options, availableApps[0].app);
    return;
  }
  
  const buttons: any[] = availableApps.map(({ name, app }) => ({
    text: name,
    onPress: () => { navigateTo(options, app); },
  }));
  buttons.push({ text: 'Cancel', style: 'cancel', onPress: () => {} });
  
  Alert.alert('Open with', 'Choose a navigation app', buttons, { cancelable: true });
}

/**
 * Show navigation picker for address
 */
export async function showAddressNavigationPicker(address: string): Promise<void> {
  const apps: { name: string; app: NavigationApp; available: boolean }[] = [
    { name: 'Google Maps', app: 'google', available: await isAppAvailable('google') },
    { name: 'Apple Maps', app: 'apple', available: await isAppAvailable('apple') },
    { name: 'Waze', app: 'waze', available: await isAppAvailable('waze') },
  ];
  
  const availableApps = apps.filter(a => a.available);
  
  if (availableApps.length === 0) {
    navigateToAddress(address, 'google');
    return;
  }
  
  if (availableApps.length === 1) {
    navigateToAddress(address, availableApps[0].app);
    return;
  }
  
  const buttons: any[] = availableApps.map(({ name, app }) => ({
    text: name,
    onPress: () => { navigateToAddress(address, app); },
  }));
  buttons.push({ text: 'Cancel', style: 'cancel', onPress: () => {} });
  
  Alert.alert('Navigate to', address, buttons, { cancelable: true });
}
