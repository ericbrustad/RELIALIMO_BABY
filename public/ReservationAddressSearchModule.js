/**
 * Google Maps Address Search Integration for Reservation Form
 * Provides address autocomplete and business search functionality
 */

import { googleMapsService } from './GoogleMapsService.js';

export class ReservationAddressSearchModule {
  constructor() {
    this.googleMapsService = googleMapsService;
    this.searchInput = null;
    this.suggestionsContainer = null;
    this.selectedAddressData = null;
    this.debounceTimer = null;
    this.debounceDelay = 300;
  }

  /**
   * Initialize address search for a specific input element
   * @param {HTMLElement} inputElement - Address input field
   * @param {HTMLElement} suggestionsElement - Container for suggestions dropdown
   * @param {Object} options - Configuration options
   */
  initializeAddressSearch(inputElement, suggestionsElement, options = {}) {
    this.searchInput = inputElement;
    this.suggestionsContainer = suggestionsElement;
    const localRegion = (() => {
      if (window.LOCAL_CITY_STATE && (window.LOCAL_CITY_STATE.city || window.LOCAL_CITY_STATE.state)) {
        return window.LOCAL_CITY_STATE;
      }
      try {
        const settings = JSON.parse(localStorage.getItem('relia_company_settings') || '{}');
        const parts = (settings.tickerSearchCity || '').toString().split(',').map(p => p.trim()).filter(Boolean);
        return { city: parts[0] || '', state: parts[1] || '' };
      } catch (e) {
        console.warn('⚠️ Unable to read tickerSearchCity for address bias:', e);
        return { city: '', state: '' };
      }
    })();

    const locationBias = options.locationBias
      || [localRegion.city, localRegion.state].filter(Boolean).join(', ')
      || undefined;

    this.localRegion = localRegion;
    this.options = {
      country: options.country || 'US',
      locationBias,
      ...options
    };

    // Add event listeners
    this.searchInput.addEventListener('input', (e) => this.handleAddressInput(e));
    this.searchInput.addEventListener('focus', (e) => this.handleAddressFocus(e));
    this.searchInput.addEventListener('blur', () => this.handleAddressBlur());

    // Setup styling for suggestions
    this.styleSuggestionsContainer();
  }

  styleSuggestionsContainer() {
    if (!this.suggestionsContainer) return;

    this.suggestionsContainer.style.cssText = `
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: white;
      border: 1px solid #ddd;
      border-top: none;
      border-radius: 0 0 4px 4px;
      max-height: 300px;
      overflow-y: auto;
      z-index: 1000;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      display: none;
    `;
  }

  handleAddressInput(event) {
    const input = event.target.value.trim();

    // Clear previous timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Hide suggestions if input is too short
    if (input.length < 2) {
      this.hideSuggestions();
      return;
    }

    // Debounce the search
    this.debounceTimer = setTimeout(() => {
      this.performAddressSearch(input);
    }, this.debounceDelay);
  }

  handleAddressFocus(event) {
    const input = event.target.value.trim();
    if (input.length >= 2) {
      this.performAddressSearch(input);
    }
  }

  handleAddressBlur() {
    // Hide suggestions after a brief delay to allow selection
    setTimeout(() => {
      this.hideSuggestions();
    }, 200);
  }

  async performAddressSearch(query) {
    try {
      // Show loading indicator
      this.showLoading();

      // Search for addresses using Google Maps
      let results = await this.googleMapsService.searchAddresses(query, {
        country: this.options.country || 'US',
        locationBias: this.options.locationBias,
        includeBusinessesAndLandmarks: true
      });

      // Fall back to landmark search if no hits (business/POI names)
      if ((!results || results.length === 0) && this.googleMapsService.searchLandmarks) {
        const landmarkResults = await this.googleMapsService.searchLandmarks(query, {
          location: this.options.locationBias,
          radius: 8000
        });
        results = landmarkResults || [];
      }

      // Prefer in-state/in-city results based on company settings bias
      if (results && results.length && this.localRegion) {
        const cityHint = (this.localRegion.city || '').toUpperCase();
        const stateHint = (this.localRegion.state || '').toUpperCase();

        // First, drop out-of-state if we have a state configured and at least one match in-state
        if (stateHint) {
          const filtered = results.filter(r => {
            const text = (r.description || r.mainText || '').toUpperCase();
            const secondary = (r.secondaryText || '').toUpperCase();
            return text.includes(stateHint) || secondary.includes(stateHint);
          });
          if (filtered.length) {
            results = filtered;
          }
        }

        const score = (r) => {
          const text = (r.description || r.mainText || '').toUpperCase();
          const secondary = (r.secondaryText || '').toUpperCase();
          let s = 0;
          if (stateHint && (text.includes(stateHint) || secondary.includes(stateHint))) s += 2;
          if (cityHint && (text.includes(cityHint) || secondary.includes(cityHint))) s += 1;
          return s;
        };
        results = results.slice().sort((a, b) => score(b) - score(a));
      }

      if (results.length === 0) {
        this.showNoResults();
        return;
      }

      this.displayAddressSuggestions(results);
    } catch (error) {
      console.error('Address search error:', error);
      this.showError('Unable to search addresses. Please try again.');
    }
  }

  displayAddressSuggestions(results) {
    if (!this.suggestionsContainer) return;

    this.suggestionsContainer.innerHTML = '';

    results.forEach((result, index) => {
      const item = document.createElement('div');
      item.className = 'address-suggestion-item';
      item.innerHTML = `
        <div style="padding: 12px; cursor: pointer; border-bottom: 1px solid #eee; hover-background: #f5f5f5;">
          <div style="font-weight: 600; color: #333; margin-bottom: 4px;">
            ${this.highlightMatch(result.mainText, this.searchInput.value)}
          </div>
          <div style="font-size: 12px; color: #666;">
            ${result.secondaryText || ''}
          </div>
        </div>
      `;

      item.addEventListener('click', () => {
        this.selectAddressSuggestion(result);
      });

      item.addEventListener('mouseenter', () => {
        item.style.backgroundColor = '#f5f5f5';
      });

      item.addEventListener('mouseleave', () => {
        item.style.backgroundColor = 'white';
      });

      this.suggestionsContainer.appendChild(item);
    });

    this.showSuggestions();
  }

  highlightMatch(text, query) {
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<strong style="color: #667eea;">$1</strong>');
  }

  async selectAddressSuggestion(suggestion) {
    try {
      // Fetch detailed place information
      const details = await this.googleMapsService.getPlaceDetails(suggestion.placeId);

      if (details) {
        this.selectedAddressData = details;

        // Populate form fields with address components
        this.populateAddressFields(details);

        // Trigger change event (use CustomEvent so `detail` is standardized)
        const event = new CustomEvent('addressSelected', { bubbles: true, detail: details });
        this.searchInput.dispatchEvent(event);

        this.hideSuggestions();
      }
    } catch (error) {
      console.error('Error fetching place details:', error);
      this.showError('Unable to fetch address details. Please try again.');
    }
  }

  populateAddressFields(details) {
    if (!details.addressComponents) return;

    // Set the address in the input field
    this.searchInput.value = details.address;

    // Try to populate other address fields if they exist
    const address2Input = document.getElementById('address2');
    const cityInput = document.getElementById('city');
    const stateInput = document.getElementById('state');
    const zipInput = document.getElementById('zipCode');

    const components = details.addressComponents;

    // Street number + name as address 1 (already set above)
    if (address2Input && components.streetNumber && components.streetName) {
      address2Input.value = ''; // Clear address 2 if not needed
    }

    if (cityInput) {
      cityInput.value = components.city || '';
    }

    if (stateInput) {
      stateInput.value = components.state || '';
    }

    if (zipInput) {
      zipInput.value = components.postalCode || '';
    }
  }

  showLoading() {
    if (!this.suggestionsContainer) return;

    this.suggestionsContainer.innerHTML = `
      <div style="padding: 12px; text-align: center; color: #999;">
        🔍 Searching...
      </div>
    `;
    this.showSuggestions();
  }

  showNoResults() {
    if (!this.suggestionsContainer) return;

    this.suggestionsContainer.innerHTML = `
      <div style="padding: 12px; text-align: center; color: #999;">
        ❌ No addresses found. Try a different search.
      </div>
    `;
    this.showSuggestions();
  }

  showError(message) {
    if (!this.suggestionsContainer) return;

    this.suggestionsContainer.innerHTML = `
      <div style="padding: 12px; text-align: center; color: #d32f2f;">
        ⚠️ ${message}
      </div>
    `;
    this.showSuggestions();
  }

  showSuggestions() {
    if (this.suggestionsContainer) {
      this.suggestionsContainer.style.display = 'block';
    }
  }

  hideSuggestions() {
    if (this.suggestionsContainer) {
      this.suggestionsContainer.style.display = 'none';
    }
  }

  /**
   * Search for nearby businesses
   * @param {string} query - Business search query (restaurant, hotel, etc.)
   * @param {Object} location - Location object with latitude/longitude
   * @param {number} radius - Search radius in meters (default 5000)
   * @returns {Promise<Array>} Array of business results
   */
  async searchNearbyBusinesses(query, location = null, radius = 5000) {
    try {
      const options = { radius };
      
      if (location) {
        options.location = location;
      }

      return await this.googleMapsService.searchBusinesses(query, options);
    } catch (error) {
      console.error('Business search error:', error);
      return [];
    }
  }

  /**
   * Get current coordinates if address is set
   * @returns {Promise<Object>} Coordinates object or null
   */
  async getAddressCoordinates() {
    if (!this.selectedAddressData) {
      return null;
    }

    return {
      latitude: this.selectedAddressData.coordinates.lat,
      longitude: this.selectedAddressData.coordinates.lng,
    };
  }

  /**
   * Get the selected address data
   * @returns {Object} Selected address details
   */
  getSelectedAddressData() {
    return this.selectedAddressData;
  }

  /**
   * Clear all address data
   */
  clearAddressData() {
    this.selectedAddressData = null;
    if (this.searchInput) {
      this.searchInput.value = '';
    }
    this.hideSuggestions();
  }
}

// Export singleton
export const reservationAddressSearchModule = new ReservationAddressSearchModule();
