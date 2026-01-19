# Google Maps Integration for Reservation Address Search

## Overview
This document outlines the integration of Google Maps Places API for address autocomplete and business search functionality in the Reservation Form.

## Files Created
1. **GoogleMapsService.js** - Core Google Maps API integration service
2. **ReservationAddressSearchModule.js** - Address search UI module for the reservation form

## Files Modified
1. **env.js** - Added `GOOGLE_MAPS_API_KEY` configuration
2. **reservation-form.js** - (Ready for integration)
3. **GoogleMapsService.js** - (Created, awaiting reservation-form.js integration)

## Setup Instructions

### Step 1: Obtain Google Maps API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable these APIs:
   - **Places API** (for address autocomplete & business search)
   - **Maps JavaScript API** (for map display)
   - **Geocoding API** (for coordinate conversion)
   - **Static Maps API** (for map images)

4. Create API key (Credentials > Create Credentials > API Key)
5. Set restrictions:
   - **Application restrictions**: HTTP referrers
   - **API restrictions**: 
     - Maps JavaScript API
     - Places API
     - Geocoding API
     - Static Maps API

6. Copy the API key to **env.js**:
   ```javascript
   GOOGLE_MAPS_API_KEY: "YOUR_ACTUAL_API_KEY_HERE"
   ```

### Step 2: Update reservation-form.js

Add imports at the top of the file (after existing imports):

```javascript
import { googleMapsService } from './GoogleMapsService.js';
import { reservationAddressSearchModule } from './ReservationAddressSearchModule.js';
```

### Step 3: Initialize Address Search (In reservation-form.js constructor or init method)

Replace the Mapbox initialization with Google Maps:

```javascript
// After DOM is loaded or in component init method
const addressInput = document.getElementById('address1');
const suggestionsContainer = document.getElementById('addressSuggestions'); // or create one

if (addressInput && suggestionsContainer) {
  reservationAddressSearchModule.initializeAddressSearch(
    addressInput,
    suggestionsContainer,
    {
      country: 'US', // Can be customized
      locationBias: null // Can add user's current location
    }
  );
}
```

### Step 4: Handle Address Selection

Add event listener to respond to address selection:

```javascript
const addressInput = document.getElementById('address1');
addressInput.addEventListener('addressSelected', (event) => {
  const addressData = event.detail;
  console.log('Address selected:', addressData);
  
  // Auto-populate related fields if needed
  // Update map if map view is present
  // Perform any other business logic
});
```

### Step 5: Update HTML Form Structure (if needed)

Ensure your reservation form has these elements:

```html
<!-- Address Input Group -->
<div style="position: relative;">
  <input 
    type="text" 
    id="address1" 
    placeholder="Enter street address"
    autocomplete="off"
  />
  
  <!-- Suggestions dropdown container -->
  <div id="addressSuggestions"></div>
</div>

<!-- Additional address fields (auto-populated) -->
<input type="text" id="address2" placeholder="Apt, suite, etc." />
<input type="text" id="city" placeholder="City" />
<input type="text" id="state" placeholder="State" />
<input type="text" id="zipCode" placeholder="ZIP Code" />
```

## API Methods Reference

### GoogleMapsService

#### searchAddresses(query, options)
```javascript
const results = await googleMapsService.searchAddresses('1600 Pennsylvania', {
  country: 'US',
  types: 'geocode,establishment'
});
// Returns: [{placeId, description, mainText, secondaryText}, ...]
```

#### searchBusinesses(query, options)
```javascript
const businesses = await googleMapsService.searchBusinesses('restaurants', {
  location: { lat: 40.7128, lng: -74.0060 },
  radius: 5000 // meters
});
// Returns: [{placeId, name, address, rating, geometry}, ...]
```

#### getPlaceDetails(placeId)
```javascript
const details = await googleMapsService.getPlaceDetails(placeId);
// Returns: {
//   address: string,
//   coordinates: {lat, lng},
//   addressComponents: {city, state, country, postalCode, etc},
//   phone: string,
//   website: string,
//   hours: {...}
// }
```

#### geocodeAddress(address)
```javascript
const location = await googleMapsService.geocodeAddress('New York, NY');
// Returns: {lat: number, lng: number}
```

#### reverseGeocode(latitude, longitude)
```javascript
const address = await googleMapsService.reverseGeocode(40.7128, -74.0060);
// Returns: {address: string, addressComponents: {...}}
```

### ReservationAddressSearchModule

#### initializeAddressSearch(inputElement, suggestionsElement, options)
```javascript
reservationAddressSearchModule.initializeAddressSearch(
  document.getElementById('address1'),
  document.getElementById('addressSuggestions'),
  { country: 'US' }
);
```

#### searchNearbyBusinesses(query, location, radius)
```javascript
const results = await reservationAddressSearchModule.searchNearbyBusinesses(
  'hotels',
  { lat: 40.7128, lng: -74.0060 },
  5000
);
```

#### getAddressCoordinates()
```javascript
const coords = await reservationAddressSearchModule.getAddressCoordinates();
// Returns: {latitude: number, longitude: number} or null
```

#### getSelectedAddressData()
```javascript
const addressData = reservationAddressSearchModule.getSelectedAddressData();
// Returns: Full address details object
```

#### clearAddressData()
```javascript
reservationAddressSearchModule.clearAddressData();
// Clears all address data and input field
```

## Business Search Feature (Optional)

To add business search capability to reservations:

```javascript
// In your HTML, add a business search input
<input type="text" id="businessSearch" placeholder="Search nearby businesses" />

// In your JavaScript
const businessSearchInput = document.getElementById('businessSearch');
businessSearchInput.addEventListener('input', async (e) => {
  const query = e.target.value;
  if (query.length < 2) return;
  
  const addressData = reservationAddressSearchModule.getSelectedAddressData();
  if (!addressData) {
    console.log('Please select a pickup address first');
    return;
  }
  
  const coords = await reservationAddressSearchModule.getAddressCoordinates();
  const businesses = await reservationAddressSearchModule.searchNearbyBusinesses(
    query,
    coords,
    5000 // 5km radius
  );
  
  // Display business results
  displayBusinessResults(businesses);
});
```

## Error Handling

Both services include error handling:

```javascript
try {
  const results = await googleMapsService.searchAddresses(query);
  // Handle results
} catch (error) {
  console.error('Address search failed:', error);
  // Show user-friendly error message
}
```

## Performance Optimizations

Both services implement:
- **Request debouncing**: 300ms delay before API call
- **Result caching**: Recent searches cached to reduce API calls
- **Session tokens**: Google Places session tokens for quota optimization
- **Lazy loading**: Services only initialize when needed

## Testing the Integration

1. Ensure Google Maps API key is valid in env.js
2. Open reservation form in browser
3. Start typing in address field
4. Verify autocomplete suggestions appear
5. Click a suggestion to populate address fields
6. Verify address data is correctly parsed

## Troubleshooting

### No suggestions appearing
- Check browser console for errors
- Verify Google Maps API key in env.js
- Ensure Places API is enabled in Google Cloud Console
- Check API rate limits haven't been exceeded

### Address fields not populating
- Verify HTML input IDs match: `address2`, `city`, `state`, `zipCode`
- Check console for parsing errors
- Ensure place details are being fetched correctly

### Business search not working
- Verify Geocoding API is enabled
- Check address coordinates are valid
- Ensure business search UI is correctly implemented

## Migration from Mapbox to Google Maps

To fully replace Mapbox with Google Maps in reservation-form.js:

1. Remove MapboxService initialization
2. Replace all `this.mapboxService.geocodeAddress()` calls with `googleMapsService.searchAddresses()`
3. Update response handling for new format
4. Remove Mapbox token from env.js (when ready)

Alternative: Keep both services and use Google Maps for new features while maintaining Mapbox for backward compatibility.

## API Rate Limits

Google Maps Places API has usage limits:
- **Sessions**: Use session tokens to optimize quota usage
- **Caching**: Results are cached automatically
- **Billing**: Enable billing in Google Cloud Console to increase limits

See [Google Maps Pricing](https://developers.google.com/maps/billing-and-pricing) for details.

## Support & Resources

- [Google Places API Documentation](https://developers.google.com/maps/documentation/places/web-service/overview)
- [Google Maps JavaScript API](https://developers.google.com/maps/documentation/javascript)
- [Google Geocoding API](https://developers.google.com/maps/documentation/geocoding)
- [Google Cloud Console](https://console.cloud.google.com/)
