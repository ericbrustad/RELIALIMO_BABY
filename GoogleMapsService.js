/**
 * Google Maps Service for Address and Business Search
 * Uses Google Places API for autocomplete and detailed place searches
 */

export class GoogleMapsService {
  constructor(apiKey = null) {
    // Get API key from environment
    this.apiKey = apiKey || this.getGoogleApiKey();
    this.sessionToken = null;
    this.placesService = null; // legacy (kept for backward compat, no longer initialized)
    this.autocompleteService = null; // legacy (kept for backward compat, no longer initialized)
    this.geocoder = null;
    this.directionsService = null;
    this.geocodingCache = new Map();
    this.placeCache = new Map();
    this.mapsScriptPromise = null;
    this.placesReadyPromise = null;
    
    if (!this.apiKey) {
      console.warn('⚠️ Google Maps API key not configured. Add it to env.js as GOOGLE_MAPS_API_KEY');
    }
    
    this.initializeServices();
  }

  getGoogleApiKey() {
    // Check multiple possible sources for API key
    if (typeof window !== 'undefined' && window.ENV?.GOOGLE_MAPS_API_KEY) {
      return window.ENV.GOOGLE_MAPS_API_KEY;
    }
    return null;
  }

  async initializeServices() {
    // Generate a new session token for each user session
    this.sessionToken = this.generateSessionToken();
  }

  generateSessionToken() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Search for addresses with Google Places Autocomplete
   * @param {string} input - User input for address search
   * @param {object} options - Search options (location bias, types, etc.)
   * @returns {Promise<Array>} Array of address suggestions
   */
  async searchAddresses(input, options = {}) {
    if (!input || input.trim().length < 2) return [];
    
    const includePlaces = options.includeBusinessesAndLandmarks !== false;
    const normalizedOptions = { ...options };
    if (options.locationBias && typeof options.locationBias === 'object') {
      normalizedOptions.locationBias = {
        latitude: options.locationBias.latitude,
        longitude: options.locationBias.longitude
      };
    }
    const cacheKey = `address_${input}_${JSON.stringify(normalizedOptions)}`;
    if (this.geocodingCache.has(cacheKey)) {
      return this.geocodingCache.get(cacheKey);
    }

    if (!this.apiKey) {
      console.warn('[GoogleMapsService] No API key set; address search skipped');
      return [];
    }

    const results = [];

    try {
      const suggestions = await this.fetchAutocompleteSuggestions(input, options);
      results.push(...suggestions);
    } catch (error) {
      console.error('Address search error (autocomplete):', error);
    }

    // Fallback: use Places Text Search when autocomplete yields nothing (or when businesses requested)
    if (includePlaces && results.length === 0) {
      try {
        const placeResults = await this.findPlaceByText(input, {
          locationBias: options.locationBias,
          types: options.types || ['point_of_interest', 'establishment', 'premise']
        });
        results.push(...placeResults.map(place => this.mapPlaceToSuggestion(place, 'findplace')));
      } catch (error) {
        console.error('Address search fallback error (find place):', error);
      }
    }

    this.geocodingCache.set(cacheKey, results);
    return results;
  }

  async findPlaceByText(query, options = {}) {
    const response = await this.searchTextPlaces(query, options);
    return response;
  }

  mapPlaceToSuggestion(place, source = 'text') {
    return {
      placeId: place.place_id,
      description: place.formatted_address || place.name,
      mainText: place.name || place.formatted_address,
      secondaryText: place.formatted_address || place.vicinity || '',
      types: place.types,
      location: place.geometry?.location,
      source,
    };
  }

  /**
   * Search for businesses (restaurants, hotels, etc.)
   * @param {string} query - Business search query
   * @param {object} options - Search options (location, type, etc.)
   * @returns {Promise<Array>} Array of business results
   */
  async searchBusinesses(query, options = {}) {
    if (!query || query.trim().length < 2) return [];

    const normalizedOptions = { ...options };
    if (options.location) {
      normalizedOptions.location = { latitude: options.location.latitude, longitude: options.location.longitude };
    }
    const cacheKey = `business_${query}_${JSON.stringify(normalizedOptions)}`;
    if (this.placeCache.has(cacheKey)) {
      return this.placeCache.get(cacheKey);
    }

    try {
      const mapped = await this.searchTextPlaces(query, {
        locationBias: options.location,
        radius: options.radius,
        type: options.type
      });

      const normalized = (mapped || []).map(place => ({
        placeId: place.placeId,
        name: place.name,
        address: place.address,
        types: place.types,
        location: place.location,
        rating: place.rating,
        userRatingsTotal: place.userRatingsTotal,
        openNow: place.openNow,
        photoReference: place.photoReference,
        businessStatus: place.businessStatus,
      }));

      this.placeCache.set(cacheKey, normalized);
      return normalized;
    } catch (error) {
      console.error('Business search error:', error);
      return [];
    }
  }

  /**
   * Search for landmarks (points of interest, attractions)
   */
  async searchLandmarks(query, options = {}) {
    if (!query || query.trim().length < 2) return [];

    const normalizedOptions = { ...options };
    if (options.location) {
      normalizedOptions.location = { latitude: options.location.latitude, longitude: options.location.longitude };
    }
    const cacheKey = `landmark_${query}_${JSON.stringify(normalizedOptions)}`;
    if (this.placeCache.has(cacheKey)) {
      return this.placeCache.get(cacheKey);
    }

    try {
      const places = await this.searchTextPlaces(query, {
        locationBias: options.location,
        radius: options.radius,
        type: 'point_of_interest'
      });

      const results = (places || []).map(place => this.mapPlaceToSuggestion({
        place_id: place.placeId,
        formatted_address: place.address,
        name: place.name,
        vicinity: place.address,
        geometry: { location: place.location },
        types: place.types
      }, 'landmark'));

      this.placeCache.set(cacheKey, results);
      return results;
    } catch (error) {
      console.error('Landmark search error:', error);
      return [];
    }
  }

  /**
   * Get detailed information about a place
   * @param {string} placeId - Google Place ID
   * @returns {Promise<Object>} Detailed place information
   */
  async getPlaceDetails(placeId) {
    if (!placeId) return null;

    if (this.placeCache.has(placeId)) {
      return this.placeCache.get(placeId);
    }

    try {
      const details = await this.fetchPlaceDetails(placeId);
      if (!details) return null;

      const parsed = {
        placeId: details.placeId,
        name: details.name,
        address: details.address,
        coordinates: details.location,
        phone: details.phone,
        website: details.website,
        googleMapsUrl: details.googleMapsUrl,
        addressComponents: this.parseAddressComponents(details.addressComponentsRaw),
        businessStatus: details.businessStatus,
        openingHours: details.openingHours,
      };

      this.placeCache.set(placeId, parsed);
      return parsed;
    } catch (error) {
      console.error('Place details error:', error);
      return null;
    }
  }

  /**
   * Parse address components into structured format
   * @param {Array} components - Google address components
   * @returns {Object} Parsed address parts
   */
  parseAddressComponents(components) {
    const address = {
      streetNumber: '',
      streetName: '',
      city: '',
      state: '',
      stateName: '',
      postalCode: '',
      country: '',
      countryCode: ''
    };

    if (!components) return address;

    const cityTypes = ['locality', 'postal_town', 'administrative_area_level_3', 'sublocality', 'sublocality_level_1'];

    components.forEach(component => {
      if (component.types.includes('street_number')) {
        address.streetNumber = component.short_name;
      } else if (component.types.includes('route')) {
        address.streetName = component.long_name;
      } else if (cityTypes.some(type => component.types.includes(type))) {
        // Prefer locality, but allow fallbacks for outskirts/PO boxes
        if (!address.city) address.city = component.long_name;
      } else if (component.types.includes('administrative_area_level_1')) {
        address.state = component.short_name; // USPS/ISO code
        address.stateName = component.long_name;
      } else if (component.types.includes('postal_code')) {
        address.postalCode = component.short_name;
      } else if (component.types.includes('country')) {
        address.country = component.long_name;
        address.countryCode = component.short_name;
      }
    });

    return address;
  }

  /**
   * Geocode address string to coordinates
   * @param {string} address - Address to geocode
   * @returns {Promise<Object>} Coordinates and details
   */
  async geocodeAddress(address) {
    if (!address) return null;

    if (!this.apiKey) {
      console.warn('[GoogleMapsService] No API key set; geocode skipped');
      return null;
    }

    const cacheKey = `geocode_${address}`;
    if (this.geocodingCache.has(cacheKey)) {
      return this.geocodingCache.get(cacheKey);
    }

    try {
      await this.ensurePlacesReady();
      if (!this.geocoder) {
        console.warn('[GoogleMapsService] Geocoder not ready');
        return null;
      }

      const result = await new Promise((resolve, reject) => {
        this.geocoder.geocode({ address }, (res, status) => {
          if (status !== google.maps.GeocoderStatus.OK) {
            reject(new Error(`Geocoding error: ${status}`));
            return;
          }
          resolve(res || []);
        });
      });

      if (!result.length) return null;
      const hit = result[0];
      const coords = hit.geometry.location;
      const addressComponents = this.parseAddressComponents(hit.address_components);

      const geocodeResult = {
        address: hit.formatted_address,
        latitude: coords.lat(),
        longitude: coords.lng(),
        placeId: hit.place_id,
        addressComponents,
        types: hit.types,
      };

      this.geocodingCache.set(cacheKey, geocodeResult);
      return geocodeResult;
    } catch (error) {
      console.error('Geocoding error:', error);
      return null;
    }
  }

  /**
   * Reverse geocode coordinates to address
   * @param {number} latitude
   * @param {number} longitude
   * @returns {Promise<string>} Formatted address
   */
  async reverseGeocode(latitude, longitude) {
    if (!latitude || !longitude) return null;

    const cacheKey = `reverse_${latitude}_${longitude}`;
    if (this.geocodingCache.has(cacheKey)) {
      return this.geocodingCache.get(cacheKey);
    }

    try {
      await this.ensurePlacesReady();
      if (!this.geocoder) return null;

      const address = await new Promise((resolve, reject) => {
        this.geocoder.geocode({ location: { lat: latitude, lng: longitude } }, (res, status) => {
          if (status !== google.maps.GeocoderStatus.OK) {
            reject(new Error(`Reverse geocoding error: ${status}`));
            return;
          }
          resolve((res?.[0]?.formatted_address) || null);
        });
      });

      if (address) {
        this.geocodingCache.set(cacheKey, address);
      }

      return address;
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      return null;
    }
  }

  async ensurePlacesReady() {
    if (!this.apiKey) {
      console.warn('[GoogleMapsService] No API key set; cannot load Places');
      return null;
    }

    if (this.geocoder) {
      return true;
    }

    if (!this.mapsScriptPromise) {
      this.mapsScriptPromise = new Promise((resolve, reject) => {
        if (window.google?.maps?.places && window.google.maps.Geocoder) {
          resolve();
          return;
        }

        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${this.apiKey}&libraries=places`;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = (err) => reject(err);
        document.head.appendChild(script);
      });
    }

    if (!this.placesReadyPromise) {
      this.placesReadyPromise = this.mapsScriptPromise.then(() => {
        if (!window.google?.maps) {
          throw new Error('Google Maps library not available after load');
        }
        this.geocoder = new google.maps.Geocoder();
        this.sessionToken = new (google.maps.places?.AutocompleteSessionToken || function(){ return { toString(){ return `session_${Date.now()}`; } }; })();
        this.directionsService = new google.maps.DirectionsService();
      });
    }

    return this.placesReadyPromise;
  }

  /**
   * Clear cache to save memory
   */
  clearCache() {
    this.geocodingCache.clear();
    this.placeCache.clear();
  }

  /**
   * Get driving distance/duration between an origin/destination with optional waypoints
   * @param {object} params
   * @param {string|object} params.origin
   * @param {string|object} params.destination
   * @param {Array<string|object>} [params.waypoints]
   * @returns {Promise<{distanceMeters:number,durationSeconds:number,distanceText:string,durationText:string}>}
   */
  async getRouteSummary({ origin, destination, waypoints = [] }) {
    await this.ensurePlacesReady();
    if (!this.directionsService) {
      throw new Error('Directions service not ready');
    }

    const request = {
      origin,
      destination,
      travelMode: google.maps.TravelMode.DRIVING,
      optimizeWaypoints: true
    };

    if (waypoints && waypoints.length) {
      request.waypoints = waypoints.map(wp => ({ location: wp, stopover: true }));
    }

    const result = await new Promise((resolve, reject) => {
      this.directionsService.route(request, (response, status) => {
        if (status === 'ZERO_RESULTS') {
          resolve(null);
          return;
        }
        const okStatus = (google?.maps?.DirectionsStatus?.OK) || 'OK';
        if (status !== okStatus && status !== 'OK') {
          reject(new Error(`Directions failed: ${status}`));
          return;
        }
        resolve(response);
      });
    });

    if (!result || !result.routes?.length) {
      return {
        distanceMeters: 0,
        durationSeconds: 0,
        distanceText: '-',
        durationText: '-',
        steps: []
      };
    }

    const legs = result.routes[0].legs || [];

    const totals = legs.reduce((acc, leg) => {
      acc.distanceMeters += leg.distance?.value || 0;
      acc.durationSeconds += leg.duration?.value || 0;
      return acc;
    }, { distanceMeters: 0, durationSeconds: 0 });

    const steps = legs.flatMap(leg => (leg.steps || []).map(step => ({
      instruction: this.stripHtml(step.instructions || step.html_instructions || ''),
      distance: step.distance?.text || '',
      duration: step.duration?.text || ''
    })));

    const distanceMeters = totals.distanceMeters || 0;
    const durationSeconds = totals.durationSeconds || 0;

    return {
      distanceMeters,
      durationSeconds,
      distanceText: distanceMeters ? `${(distanceMeters / 1609.344).toFixed(1)} mi` : '-',
      durationText: durationSeconds ? this.formatDuration(durationSeconds) : '-',
      steps
    };
  }

  formatDuration(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.round((totalSeconds % 3600) / 60);
    if (hours === 0) return `${minutes} min`;
    if (minutes === 0) return `${hours} hr`;
    return `${hours} hr ${minutes} min`;
  }

  /**
   * Get static map image URL for embedding
   * @param {number} latitude
   * @param {number} longitude
   * @param {number} zoom - Zoom level (1-21, default 15)
   * @param {number} width - Image width in pixels
   * @param {number} height - Image height in pixels
   * @returns {string} Google Static Maps URL
   */
  getStaticMapUrl(latitude, longitude, zoom = 15, width = 400, height = 300) {
    if (!this.apiKey) return null;
    
    return `https://maps.googleapis.com/maps/api/staticmap?center=${latitude},${longitude}&zoom=${zoom}&size=${width}x${height}&markers=color:red%7C${latitude},${longitude}&key=${this.apiKey}`;
  }

  stripHtml(input) {
    if (!input) return '';
    return input.replace(/<[^>]+>/g, '').trim();
  }

  /**
   * Modern Places autocomplete via Places API (v1) to avoid deprecated AutocompleteService.
   */
  async fetchAutocompleteSuggestions(input, options = {}) {
    if (!this.apiKey) return [];

    const body = {
      input,
      sessionToken: this.sessionToken,
      languageCode: options.languageCode || 'en',
      includedPrimaryTypes: options.types,
    };

    // Address-only
    if (options.includeBusinessesAndLandmarks === false) {
      body.includedPrimaryTypes = ['street_address', 'premise', 'route'];
    }

    const bias = this.buildLocationBias(options.locationBias || options.location);
    if (bias) body.locationBias = bias;

    const resp = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': this.apiKey,
        'X-Goog-FieldMask': 'suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat,suggestions.placePrediction.types'
      },
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      console.warn('[GoogleMapsService] autocomplete response not ok:', resp.status);
      return [];
    }

    const data = await resp.json();
    const suggestions = data?.suggestions || [];

    return suggestions.map(s => {
      const p = s.placePrediction || {};
      return {
        placeId: p.placeId,
        description: p.text?.text || '',
        mainText: p.structuredFormat?.mainText?.text || p.text?.text || '',
        secondaryText: p.structuredFormat?.secondaryText?.text || '',
        types: p.types || [],
        source: 'autocomplete'
      };
    });
  }

  /**
   * Places API Text Search (v1) replacement for legacy PlacesService text/nearby search.
   */
  async searchTextPlaces(query, options = {}) {
    if (!this.apiKey) return [];
    const body = {
      textQuery: query,
      pageSize: 10
    };

    const bias = this.buildLocationBias(options.locationBias || options.location);
    if (bias) body.locationBias = bias;
    if (options.radius) {
      const center = bias?.circle?.center
        || bias?.rectangle?.high
        || (options.locationBias && options.locationBias.latitude && options.locationBias.longitude
            ? { latitude: options.locationBias.latitude, longitude: options.locationBias.longitude }
            : null);
      if (center) {
        body.locationBias = {
          circle: {
            center,
            radius: options.radius
          }
        };
      }
    }

    // Type filtering via includedPrimaryTypes when provided
    if (options.type) {
      body.includedPrimaryTypes = [options.type];
    }

    const resp = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': this.apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.types,places.rating,places.userRatingCount,places.businessStatus'
      },
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      console.warn('[GoogleMapsService] searchText response not ok:', resp.status);
      return [];
    }

    const data = await resp.json();
    return (data?.places || []).map(p => ({
      placeId: p.id,
      name: p.displayName?.text || p.displayName,
      address: p.formattedAddress,
      types: p.types,
      location: p.location ? { lat: () => p.location.latitude, lng: () => p.location.longitude } : null,
      rating: p.rating,
      userRatingsTotal: p.userRatingCount,
      businessStatus: p.businessStatus,
    }));
  }

  /**
   * Places API fetch place details (v1) replacement for legacy getDetails.
   */
  async fetchPlaceDetails(placeId) {
    if (!this.apiKey || !placeId) return null;

    const fields = [
      'id',
      'displayName',
      'formattedAddress',
      'location',
      'internationalPhoneNumber',
      'websiteUri',
      'googleMapsUri',
      'addressComponents',
      'businessStatus',
      'currentOpeningHours'
    ].join(',');

    const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?fields=${fields}`;

    const resp = await fetch(url, {
      headers: {
        'X-Goog-Api-Key': this.apiKey,
      }
    });

    if (!resp.ok) {
      console.warn('[GoogleMapsService] place details response not ok:', resp.status);
      return null;
    }

    const p = await resp.json();
    return {
      placeId: p.id,
      name: p.displayName?.text || p.displayName,
      address: p.formattedAddress,
      location: p.location ? { lat: () => p.location.latitude, lng: () => p.location.longitude } : null,
      phone: p.internationalPhoneNumber,
      website: p.websiteUri,
      googleMapsUrl: p.googleMapsUri,
      addressComponentsRaw: (p.addressComponents || []).map(c => ({
        long_name: c.longText,
        short_name: c.shortText,
        types: c.types || []
      })),
      businessStatus: p.businessStatus,
      openingHours: p.currentOpeningHours,
    };
  }

  buildLocationBias(location) {
    if (!location?.latitude || !location?.longitude) return null;
    return {
      circle: {
        center: { latitude: location.latitude, longitude: location.longitude },
        radius: 5000
      }
    };
  }
}

// Export singleton instance
export const googleMapsService = new GoogleMapsService();
