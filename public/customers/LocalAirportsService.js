/**
 * LocalAirportsService.js
 * ========================
 * Provides local airport data from Supabase as primary source or fallback
 * when external airport APIs are unavailable.
 * 
 * Works with local_airports and airport_settings tables.
 * 
 * Usage:
 *   import { LocalAirportsService } from './LocalAirportsService.js';
 *   const airports = await LocalAirportsService.getAirports(organizationId);
 *   const airports = await LocalAirportsService.searchAirports('MSP', organizationId);
 */

import { getSupabaseCredentials } from '/shared/supabase-config.js';

class LocalAirportsServiceClass {
  constructor() {
    this.cache = new Map();
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
    this.settings = null;
  }

  /**
   * Get Supabase credentials
   */
  getCredentials() {
    return getSupabaseCredentials();
  }

  /**
   * Get airport settings for an organization
   */
  async getSettings(organizationId) {
    if (!organizationId) return { use_local_airports_only: false, fallback_to_local: true };
    
    try {
      const creds = this.getCredentials();
      const response = await fetch(
        `${creds.url}/rest/v1/airport_settings?organization_id=eq.${organizationId}&select=*`,
        {
          headers: {
            'apikey': creds.anonKey,
            'Authorization': `Bearer ${creds.anonKey}`
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data && data.length > 0) {
          this.settings = data[0];
          return this.settings;
        }
      }
    } catch (err) {
      console.warn('[LocalAirportsService] Could not fetch settings:', err);
    }
    
    // Return defaults
    return { use_local_airports_only: false, fallback_to_local: true };
  }

  /**
   * Get all local airports for an organization
   */
  async getLocalAirports(organizationId) {
    if (!organizationId) {
      console.warn('[LocalAirportsService] No organization ID provided');
      return [];
    }

    // Check cache
    const cacheKey = `airports_${organizationId}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.data;
    }

    try {
      const creds = this.getCredentials();
      const response = await fetch(
        `${creds.url}/rest/v1/local_airports?organization_id=eq.${organizationId}&is_active=eq.true&select=*&order=is_primary.desc,sort_order.asc,name.asc`,
        {
          headers: {
            'apikey': creds.anonKey,
            'Authorization': `Bearer ${creds.anonKey}`
          }
        }
      );

      if (response.ok) {
        const airports = await response.json();
        
        // Cache the results
        this.cache.set(cacheKey, {
          data: airports,
          timestamp: Date.now()
        });
        
        console.log(`[LocalAirportsService] Loaded ${airports.length} local airports`);
        return airports;
      }
    } catch (err) {
      console.error('[LocalAirportsService] Failed to fetch local airports:', err);
    }

    return [];
  }

  /**
   * Search local airports by query (code, name, or city)
   */
  async searchLocalAirports(query, organizationId) {
    if (!query || query.length < 2) return [];
    
    const airports = await this.getLocalAirports(organizationId);
    const searchTerm = query.toLowerCase().trim();
    
    return airports.filter(airport => {
      const iata = (airport.iata_code || '').toLowerCase();
      const icao = (airport.icao_code || '').toLowerCase();
      const name = (airport.name || '').toLowerCase();
      const displayName = (airport.display_name || '').toLowerCase();
      const city = (airport.city || '').toLowerCase();
      
      return iata.includes(searchTerm) ||
             icao.includes(searchTerm) ||
             name.includes(searchTerm) ||
             displayName.includes(searchTerm) ||
             city.includes(searchTerm);
    });
  }

  /**
   * Get airports with fallback logic
   * First tries external API, falls back to local if enabled
   */
  async getAirports(organizationId, externalApiFn = null) {
    const settings = await this.getSettings(organizationId);
    
    // If configured to use local only, return local airports
    if (settings.use_local_airports_only) {
      console.log('[LocalAirportsService] Using local airports only (setting enabled)');
      return await this.getLocalAirports(organizationId);
    }
    
    // Try external API first if provided
    if (externalApiFn && settings.fallback_to_local) {
      try {
        const externalAirports = await externalApiFn();
        if (externalAirports && externalAirports.length > 0) {
          return externalAirports;
        }
      } catch (err) {
        console.warn('[LocalAirportsService] External API failed, falling back to local:', err);
      }
    }
    
    // Fallback to local airports
    if (settings.fallback_to_local) {
      console.log('[LocalAirportsService] Falling back to local airports');
      return await this.getLocalAirports(organizationId);
    }
    
    return [];
  }

  /**
   * Search airports with fallback logic
   */
  async searchAirports(query, organizationId, externalSearchFn = null) {
    const settings = await this.getSettings(organizationId);
    
    // If configured to use local only, search local airports
    if (settings.use_local_airports_only) {
      console.log('[LocalAirportsService] Searching local airports only (setting enabled)');
      return await this.searchLocalAirports(query, organizationId);
    }
    
    // Try external API first if provided
    if (externalSearchFn) {
      try {
        const results = await externalSearchFn(query);
        if (results && results.length > 0) {
          return results;
        }
      } catch (err) {
        console.warn('[LocalAirportsService] External search failed, falling back to local:', err);
      }
    }
    
    // Fallback to local search
    if (settings.fallback_to_local) {
      console.log('[LocalAirportsService] Falling back to local airport search');
      return await this.searchLocalAirports(query, organizationId);
    }
    
    return [];
  }

  /**
   * Format local airport for dropdown/display
   */
  formatAirport(airport) {
    return {
      code: airport.iata_code || airport.icao_code,
      iata_code: airport.iata_code,
      icao_code: airport.icao_code,
      name: airport.display_name || airport.name,
      fullName: airport.name,
      city: airport.city,
      state: airport.state,
      country: airport.country || 'US',
      address: airport.address,
      latitude: airport.latitude,
      longitude: airport.longitude,
      timezone: airport.timezone,
      is_international: airport.is_international,
      is_primary: airport.is_primary,
      airport_fee: airport.airport_fee,
      pickup_instructions: airport.pickup_instructions,
      terminal_info: airport.terminal_info,
      source: 'local'
    };
  }

  /**
   * Get formatted airports ready for UI
   */
  async getFormattedAirports(organizationId) {
    const airports = await this.getLocalAirports(organizationId);
    return airports.map(a => this.formatAirport(a));
  }

  /**
   * Manually trigger a refresh of local airports from company settings
   */
  async refreshAirports(organizationId) {
    try {
      const creds = this.getCredentials();
      const response = await fetch(
        `${creds.url}/rest/v1/rpc/refresh_local_airports`,
        {
          method: 'POST',
          headers: {
            'apikey': creds.anonKey,
            'Authorization': `Bearer ${creds.anonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            p_organization_id: organizationId,
            p_source: 'manual'
          })
        }
      );

      if (response.ok) {
        const result = await response.json();
        // Clear cache to get fresh data
        this.cache.delete(`airports_${organizationId}`);
        console.log('[LocalAirportsService] Airports refreshed:', result);
        return result;
      }
    } catch (err) {
      console.error('[LocalAirportsService] Failed to refresh airports:', err);
    }
    return null;
  }

  /**
   * Clear cache for an organization
   */
  clearCache(organizationId = null) {
    if (organizationId) {
      this.cache.delete(`airports_${organizationId}`);
    } else {
      this.cache.clear();
    }
    this.settings = null;
  }
}

// Export singleton instance
export const LocalAirportsService = new LocalAirportsServiceClass();
export default LocalAirportsService;
