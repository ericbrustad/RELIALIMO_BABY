/**
 * Navigation Utilities
 * Re-exports navigation functions from services for backward compatibility
 */

export {
  navigateTo,
  navigateToAddress,
  showNavigationPicker,
  showAddressNavigationPicker,
  isAppAvailable,
  buildAddressNavigationUrl,
  type NavigationApp,
} from '../services/navigation';

// Re-export geocodeAddress from location service
export { geocodeAddress } from '../services/location';
