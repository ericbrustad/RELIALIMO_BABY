/**
 * QUICK INTEGRATION TEMPLATE FOR RESERVATION-FORM.JS
 * 
 * Copy and adapt this code into your reservation-form.js file
 * to quickly enable Google Maps address search functionality.
 * 
 * Instructions:
 * 1. Add imports to the top of reservation-form.js (after existing imports)
 * 2. Copy initializeAddressSearch() method to your form class
 * 3. Copy the HTML template into your form's HTML structure
 * 4. Call initializeAddressSearch() when form loads
 */

// ============================================
// STEP 1: ADD THESE IMPORTS TO THE TOP OF reservation-form.js
// ============================================

import { googleMapsService } from './GoogleMapsService.js';
import { reservationAddressSearchModule } from './ReservationAddressSearchModule.js';

export const googleMapsIntegrationTemplate = {


// ============================================
// STEP 2: ADD THIS METHOD TO YOUR FORM CLASS
// ============================================

/**
 * Initialize Google Maps address search for the reservation form
 * Call this method when the form initializes or after DOM is loaded
 */
  initializeAddressSearch() {
  const addressInput = document.getElementById('address1');
  const suggestionsContainer = document.getElementById('addressSuggestions');

  if (!addressInput || !suggestionsContainer) {
    console.warn('Address search elements not found in DOM');
    return;
  }

  // Initialize the address search module
  reservationAddressSearchModule.initializeAddressSearch(
    addressInput,
    suggestionsContainer,
    {
      country: 'US', // Change to your default country
      locationBias: null // Can set to user's current location for better results
    }
  );

  // Listen for address selection
  addressInput.addEventListener('addressSelected', (event) => {
    const addressData = event.detail;
    console.log('Address selected:', addressData);

    // Update your form state or trigger any additional logic
    if (this.updateLocation) {
      this.updateLocation(addressData);
    }

    // Show success feedback
    this.showAddressConfirmed(addressData);
  });

  console.log('✅ Google Maps address search initialized');
  },

/**
 * Optional: Show user feedback when address is selected
 */
  showAddressConfirmed(addressData) {
  // You can add a visual indicator that address was successfully selected
  const addressInput = document.getElementById('address1');
  if (addressInput) {
    addressInput.style.borderColor = '#4caf50';
    addressInput.style.backgroundColor = '#f1f8f4';
    
    // Reset styling after 2 seconds
    setTimeout(() => {
      addressInput.style.borderColor = '';
      addressInput.style.backgroundColor = '';
    }, 2000);
  }
  },

/**
 * Optional: Search for nearby businesses when address is confirmed
 */
  async searchNearbyBusinesses(businessType = 'hotels') {
  try {
    const addressData = reservationAddressSearchModule.getSelectedAddressData();
    
    if (!addressData) {
      console.log('Please select an address first');
      return;
    }

    const coords = await reservationAddressSearchModule.getAddressCoordinates();
    const businesses = await reservationAddressSearchModule.searchNearbyBusinesses(
      businessType,
      coords,
      5000 // 5km radius
    );

    console.log(`Found ${businesses.length} nearby ${businessType}:`, businesses);
    return businesses;
  } catch (error) {
    console.error('Business search error:', error);
    return [];
  }
  },

/**
 * Optional: Clear address selection
 */
  clearAddressSelection() {
  reservationAddressSearchModule.clearAddressData();
  console.log('Address cleared');
  },


// ============================================
// STEP 3: ADD THIS HTML TEMPLATE TO YOUR FORM
// ============================================

/*
<!-- ADDRESS INPUT SECTION (add to your reservation form HTML) -->
<div class="form-section">
  <h3>Pickup Address</h3>
  
  <!-- Address Input with Google Maps Autocomplete -->
  <div style="position: relative; margin-bottom: 10px;">
    <label for="address1">Street Address *</label>
    <input 
      type="text" 
      id="address1" 
      placeholder="Enter street address"
      autocomplete="off"
      style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;"
    />
    
    <!-- Suggestions dropdown (auto-populated by Google Maps) -->
    <div id="addressSuggestions"></div>
  </div>

  <!-- Additional Address Fields (auto-populated on selection) -->
  <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 10px;">
    <div>
      <label for="address2">Apt/Suite</label>
      <input 
        type="text" 
        id="address2" 
        placeholder="Apt, suite, floor, etc."
        style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px;"
      />
    </div>
    
    <div>
      <label for="city">City</label>
      <input 
        type="text" 
        id="city" 
        placeholder="City"
        style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px;"
      />
    </div>
    
    <div>
      <label for="state">State</label>
      <input 
        type="text" 
        id="state" 
        placeholder="State"
        style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px;"
      />
    </div>
    
    <div>
      <label for="zipCode">ZIP Code</label>
      <input 
        type="text" 
        id="zipCode" 
        placeholder="ZIP"
        style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px;"
      />
    </div>
  </div>

  <!-- Optional: Business Search Section -->
  <div style="margin-top: 15px; padding: 15px; background: #f9f9f9; border-radius: 4px;">
    <label for="businessSearch">Search Nearby Businesses (Optional)</label>
    <input 
      type="text" 
      id="businessSearch" 
      placeholder="e.g., hotels, restaurants, airport"
      style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; margin-bottom: 10px;"
    />
    <div id="businessResults" style="max-height: 200px; overflow-y: auto;"></div>
  </div>
</div>
*/


// ============================================
// STEP 4: CALL THE INIT METHOD IN YOUR FORM LIFECYCLE
// ============================================

/*
Example 1: If your form has a constructor or init method:

constructor(formElement) {
  this.formElement = formElement;
  this.initializeAddressSearch(); // Add this line
}

Example 2: If your form uses DOMContentLoaded:

document.addEventListener('DOMContentLoaded', () => {
  const reservationForm = new ReservationForm();
  reservationForm.initializeAddressSearch(); // Add this line
});

Example 3: If your form is a singleton and inits on first use:

const reservationForm = {
  init() {
    this.initializeAddressSearch(); // Add this line
    // ... other init code
  },
  
  initializeAddressSearch() {
    // ... code from STEP 2 above
  }
};
*/


// ============================================
// OPTIONAL: BUSINESS SEARCH HANDLER
// ============================================

/**
 * Add this event listener if you want business search functionality
 * This code searches for businesses when user types in businessSearch field
 */
  setupBusinessSearchHandler() {
  const businessSearchInput = document.getElementById('businessSearch');
  if (!businessSearchInput) return;

  const resultsContainer = document.getElementById('businessResults');
  if (!resultsContainer) return;

  let searchTimeout;

  businessSearchInput.addEventListener('input', async (e) => {
    const query = e.target.value.trim();

    // Clear timeout for previous search
    clearTimeout(searchTimeout);

    // Don't search for very short queries
    if (query.length < 2) {
      resultsContainer.innerHTML = '';
      return;
    }

    // Wait 500ms before searching (debounce)
    searchTimeout = setTimeout(async () => {
      try {
        // Check if address was selected
        const addressData = reservationAddressSearchModule.getSelectedAddressData();
        if (!addressData) {
          resultsContainer.innerHTML = 
            '<p style="padding: 10px; color: #f57c00;">📍 Please select a pickup address first</p>';
          return;
        }

        // Get address coordinates
        const coords = await reservationAddressSearchModule.getAddressCoordinates();

        // Search for businesses
        const businesses = await reservationAddressSearchModule.searchNearbyBusinesses(
          query,
          coords,
          5000 // 5km radius
        );

        // Display results
        if (businesses.length === 0) {
          resultsContainer.innerHTML = 
            '<p style="padding: 10px; color: #999;">No businesses found</p>';
          return;
        }

        const resultsHtml = businesses.map(business => `
          <div style="padding: 10px; border-bottom: 1px solid #eee; cursor: pointer; hover-background: #f5f5f5;">
            <strong>${business.name}</strong>
            ${business.rating ? `<span style="color: #ffc107;">⭐ ${business.rating}</span>` : ''}
            <div style="font-size: 12px; color: #666; margin-top: 5px;">
              ${business.address || 'Address not available'}
            </div>
          </div>
        `).join('');

        resultsContainer.innerHTML = resultsHtml;

      } catch (error) {
        console.error('Business search error:', error);
        resultsContainer.innerHTML = 
          '<p style="padding: 10px; color: #d32f2f;">Error searching businesses</p>';
      }
    }, 500);
  });

  console.log('✅ Business search handler setup complete');
  }
};


// ============================================
// USAGE EXAMPLES
// ============================================

/*

// Example 1: Initialize both address and business search
const form = new ReservationForm();
form.initializeAddressSearch();
form.setupBusinessSearchHandler();

// Example 2: Get selected address data programmatically
const addressData = reservationAddressSearchModule.getSelectedAddressData();
console.log('Selected address:', addressData);
// Output: {
//   address: "1600 Pennsylvania Avenue NW, Washington, DC 20500, USA",
//   coordinates: {lat: 38.8949, lng: -77.0369},
//   addressComponents: {
//     streetNumber: "1600",
//     streetName: "Pennsylvania Avenue",
//     city: "Washington",
//     state: "DC",
//     country: "United States",
//     postalCode: "20500"
//   },
//   phone: "+1 202-456-1111",
//   website: "http://www.whitehouse.gov/",
//   hours: {...}
// }

// Example 3: Get address coordinates
const coords = await reservationAddressSearchModule.getAddressCoordinates();
console.log('Latitude:', coords.latitude, 'Longitude:', coords.longitude);

// Example 4: Search for restaurants near address
const restaurants = await form.searchNearbyBusinesses('restaurants');
console.log('Found restaurants:', restaurants);

// Example 5: Clear address selection
form.clearAddressSelection();

*/


// ============================================
// TROUBLESHOOTING
// ============================================

/*

ISSUE: "undefined googleMapsService" error
SOLUTION: 
1. Ensure GoogleMapsService.js file exists in the same directory
2. Check import path is correct: import { googleMapsService } from './GoogleMapsService.js';
3. Verify API key is in env.js under GOOGLE_MAPS_API_KEY

ISSUE: No suggestions appear when typing address
SOLUTION:
1. Check browser console (F12) for errors
2. Verify Google Maps API key is valid in env.js
3. Ensure Places API is enabled in Google Cloud Console
4. Check that addressSuggestions div exists in HTML
5. Try typing a longer, more specific query (e.g., "1600 Pennsylvania Ave, Washington")

ISSUE: Address fields don't populate after selecting suggestion
SOLUTION:
1. Verify HTML element IDs match exactly: address1, address2, city, state, zipCode
2. Check browser console for JavaScript errors
3. Ensure getPlaceDetails() is successfully fetching data
4. Try selecting a different address suggestion to narrow down the issue

ISSUE: Business search not working
SOLUTION:
1. Ensure address is selected first (try selecting address again)
2. Check if Geocoding API is enabled in Google Cloud Console
3. Verify business search input ID is 'businessSearch'
4. Check browser network tab for API errors
5. Look for error messages in browser console

*/
