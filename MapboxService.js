export class MapboxService {
  constructor() {
    // Mapbox access token
    this.accessToken = 'pk.eyJ1IjoiZXJpeGNvYWNoIiwiYSI6ImNtaDdocXI0NDB1dW4yaW9tZWFka3NocHAifQ.h1czc1VBwbBJQbdJTU5HHA';
    this.geocodeCache = new Map();
    this.routeCache = new Map();
    
    // Check if token is set
    if (this.accessToken === 'YOUR_MAPBOX_TOKEN_HERE') {
      console.warn('⚠️ Mapbox token not set! Geocoding and routing will not work.');
      console.warn('Sign up at https://www.mapbox.com/ to get a free token.');
      console.warn('Then update the token in MapboxService.js');
    }
  }

  getLocalRegion() {
    try {
      const settings = JSON.parse(localStorage.getItem('relia_company_settings') || '{}');
      const raw = (settings.tickerSearchCity || '').toString();
      return raw.trim();
    } catch (e) {
      console.warn('⚠️ Failed to read tickerSearchCity for geocode bias:', e);
      return '';
    }
  }

  async geocodeAddress(query) {
    // Check if token is set
    if (this.accessToken === 'YOUR_MAPBOX_TOKEN_HERE') {
      console.error('Mapbox token not configured. Please add your token to MapboxService.js');
      return [];
    }

    // Bias queries to the configured local city/state
    const localRegion = this.getLocalRegion();
    const effectiveQuery = localRegion ? `${query} ${localRegion}` : query;

    // Check cache first
    const cacheKey = localRegion ? `${effectiveQuery}|local` : query;
    if (this.geocodeCache.has(cacheKey)) {
      return this.geocodeCache.get(cacheKey);
    }

    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(effectiveQuery)}.json?access_token=${this.accessToken}&types=address,poi&limit=5`
      );

      if (!response.ok) {
        throw new Error(`Geocoding request failed: ${response.status}`);
      }

      const data = await response.json();
      
      const results = data.features.map(feature => ({
        name: feature.text,
        address: feature.place_name,
        coordinates: feature.geometry.coordinates, // [lng, lat]
        context: this.parseContext(feature.context)
      }));

      // Cache the result
      this.geocodeCache.set(cacheKey, results);

      return results;
    } catch (error) {
      console.error('Geocoding error:', error);
      return [];
    }
  }

  async searchPOI(query) {
    // POI search specifically for landmarks, businesses, and points of interest
    if (this.accessToken === 'YOUR_MAPBOX_TOKEN_HERE') {
      console.error('Mapbox token not configured. Please add your token to MapboxService.js');
      return [];
    }

    // Check cache first
    const cacheKey = `poi:${query}`;
    if (this.geocodeCache.has(cacheKey)) {
      return this.geocodeCache.get(cacheKey);
    }

    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${this.accessToken}&types=poi,address&limit=10`
      );

      if (!response.ok) {
        throw new Error(`POI search request failed: ${response.status}`);
      }

      const data = await response.json();
      
      const results = data.features.map(feature => ({
        name: feature.text,
        address: feature.place_name,
        coordinates: feature.geometry.coordinates, // [lng, lat]
        category: feature.properties?.category || (feature.place_type?.includes('poi') ? 'Point of Interest' : 'Address'),
        context: this.parseContext(feature.context)
      }));

      // Cache the result
      this.geocodeCache.set(cacheKey, results);

      return results;
    } catch (error) {
      console.error('POI search error:', error);
      return [];
    }
  }

  parseContext(context) {
    if (!context) return {};

    const parsed = {};
    context.forEach(item => {
      const [type] = item.id.split('.');
      if (type === 'place') parsed.city = item.text;
      if (type === 'region') parsed.state = item.text;
      if (type === 'postcode') parsed.zipcode = item.text;
      if (type === 'country') parsed.country = item.text;
    });

    return parsed;
  }

  async getRoute(coordinates) {
    // Check if token is set
    if (this.accessToken === 'YOUR_MAPBOX_TOKEN_HERE') {
      console.error('Mapbox token not configured. Please add your token to MapboxService.js');
      throw new Error('Mapbox token not configured');
    }

    // coordinates should be array of [lng, lat] pairs
    if (!coordinates || coordinates.length < 2) {
      throw new Error('Need at least 2 coordinates for route');
    }

    // Create cache key from coordinates
    const cacheKey = coordinates.map(c => `${c[0]},${c[1]}`).join('|');
    
    // Check cache
    if (this.routeCache.has(cacheKey)) {
      return this.routeCache.get(cacheKey);
    }

    try {
      // Build coordinates string for API
      const coordsString = coordinates.map(c => `${c[0]},${c[1]}`).join(';');

      const response = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/driving/${coordsString}?steps=true&geometries=geojson&access_token=${this.accessToken}`
      );

      if (!response.ok) {
        throw new Error(`Directions request failed: ${response.status}`);
      }

      const data = await response.json();

      if (!data.routes || data.routes.length === 0) {
        throw new Error('No route found');
      }

      const route = data.routes[0];

      const result = {
        distance: this.formatDistance(route.distance), // meters to miles/km
        distanceMeters: route.distance,
        duration: this.formatDuration(route.duration), // seconds to readable format
        durationSeconds: route.duration,
        geometry: route.geometry,
        steps: this.parseSteps(route.legs[0].steps),
        bounds: this.calculateBounds(route.geometry.coordinates)
      };

      // Cache the result
      this.routeCache.set(cacheKey, result);

      return result;
    } catch (error) {
      console.error('Routing error:', error);
      throw error;
    }
  }

  parseSteps(steps) {
    return steps.map(step => ({
      instruction: step.maneuver.instruction,
      distance: this.formatDistance(step.distance),
      distanceMeters: step.distance
    }));
  }

  formatDistance(meters) {
    const miles = meters * 0.000621371;
    if (miles < 0.1) {
      return `${Math.round(meters * 3.28084)} ft`;
    }
    return `${miles.toFixed(2)} mi`;
  }

  formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours} hr ${minutes} min`;
    }
    return `${minutes} min`;
  }

  calculateBounds(coordinates) {
    if (!coordinates || coordinates.length === 0) return null;

    let minLng = coordinates[0][0];
    let maxLng = coordinates[0][0];
    let minLat = coordinates[0][1];
    let maxLat = coordinates[0][1];

    coordinates.forEach(coord => {
      minLng = Math.min(minLng, coord[0]);
      maxLng = Math.max(maxLng, coord[0]);
      minLat = Math.min(minLat, coord[1]);
      maxLat = Math.max(maxLat, coord[1]);
    });

    return [
      [minLng, minLat],
      [maxLng, maxLat]
    ];
  }

  clearCache() {
    this.geocodeCache.clear();
    this.routeCache.clear();
  }
}
