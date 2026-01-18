import { getSupabaseConfig } from './config.js';

export class AffiliateService {
  constructor() {
    this.supabaseConfig = null;
    this.cache = null;
    this.cacheTime = null;
    this.cacheExpiry = 5 * 60 * 1000; // Cache for 5 minutes
    this.initSupabase();
  }

  initSupabase() {
    try {
      this.supabaseConfig = getSupabaseConfig();
    } catch (err) {
      console.error('AffiliateService: Failed to get Supabase config', err);
    }
  }

  getHeaders() {
    if (!this.supabaseConfig) {
      this.initSupabase();
    }
    return {
      'apikey': this.supabaseConfig?.anonKey || '',
      'Authorization': `Bearer ${this.supabaseConfig?.anonKey || ''}`,
      'Content-Type': 'application/json'
    };
  }

  getBaseUrl() {
    if (!this.supabaseConfig) {
      this.initSupabase();
    }
    return this.supabaseConfig?.url || '';
  }

  /**
   * Get all affiliates from Supabase (with caching)
   * @returns {Promise<Array>} Array of affiliate objects
   */
  async getAllAffiliates() {
    // Return cached data if still valid
    if (this.cache && this.cacheTime && (Date.now() - this.cacheTime < this.cacheExpiry)) {
      return [...this.cache];
    }

    try {
      const baseUrl = this.getBaseUrl();
      if (!baseUrl) {
        console.error('AffiliateService: No Supabase URL configured');
        return [];
      }

      const response = await fetch(
        `${baseUrl}/rest/v1/affiliates?is_active=eq.true&order=company_name.asc`,
        { headers: this.getHeaders() }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Transform to consistent format
      const affiliates = data.map(row => this.transformAffiliate(row));
      
      // Cache the results
      this.cache = affiliates;
      this.cacheTime = Date.now();
      
      console.log(`AffiliateService: Loaded ${affiliates.length} affiliates from Supabase`);
      return affiliates;
    } catch (err) {
      console.error('AffiliateService: Error fetching affiliates', err);
      return this.cache || [];
    }
  }

  /**
   * Search affiliates with autocomplete (minimum 2 characters)
   * Searches company_name, first_name, last_name, city, email
   * @param {string} query - Search query (minimum 2 characters)
   * @returns {Promise<Array>} Array of matching affiliate objects
   */
  async searchAffiliates(query) {
    if (!query || query.length < 2) {
      return [];
    }

    const searchTerm = query.toLowerCase().trim();

    try {
      const baseUrl = this.getBaseUrl();
      if (!baseUrl) {
        console.error('AffiliateService: No Supabase URL configured');
        return [];
      }

      // Use ilike for case-insensitive search with wildcards
      // Search across company_name, first_name, last_name, city, email
      const searchPattern = `%${searchTerm}%`;
      const orFilter = `company_name.ilike.${encodeURIComponent(searchPattern)},first_name.ilike.${encodeURIComponent(searchPattern)},last_name.ilike.${encodeURIComponent(searchPattern)},city.ilike.${encodeURIComponent(searchPattern)},email.ilike.${encodeURIComponent(searchPattern)}`;
      
      const response = await fetch(
        `${baseUrl}/rest/v1/affiliates?is_active=eq.true&or=(${orFilter})&order=company_name.asc&limit=20`,
        { headers: this.getHeaders() }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const affiliates = data.map(row => this.transformAffiliate(row));
      
      console.log(`AffiliateService: Found ${affiliates.length} affiliates matching "${query}"`);
      return affiliates;
    } catch (err) {
      console.error('AffiliateService: Error searching affiliates', err);
      
      // Fallback to cached data if available
      if (this.cache) {
        return this.cache.filter(affiliate => 
          affiliate.company.toLowerCase().includes(searchTerm) ||
          affiliate.contact.toLowerCase().includes(searchTerm) ||
          affiliate.location.toLowerCase().includes(searchTerm) ||
          affiliate.email.toLowerCase().includes(searchTerm) ||
          affiliate.phone.includes(searchTerm)
        );
      }
      return [];
    }
  }

  /**
   * Get affiliate by ID
   * @param {string} id - Affiliate UUID
   * @returns {Promise<Object|null>} Affiliate object or null
   */
  async getAffiliateById(id) {
    if (!id) return null;

    try {
      const baseUrl = this.getBaseUrl();
      if (!baseUrl) return null;

      const response = await fetch(
        `${baseUrl}/rest/v1/affiliates?id=eq.${id}`,
        { headers: this.getHeaders() }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      if (data && data.length > 0) {
        return this.transformAffiliate(data[0]);
      }
      return null;
    } catch (err) {
      console.error('AffiliateService: Error fetching affiliate by ID', err);
      return null;
    }
  }

  /**
   * Get affiliate by company name
   * @param {string} companyName - Company name to search
   * @returns {Promise<Object|null>} Affiliate object or null
   */
  async getAffiliateByCompany(companyName) {
    if (!companyName) return null;

    try {
      const baseUrl = this.getBaseUrl();
      if (!baseUrl) return null;

      const response = await fetch(
        `${baseUrl}/rest/v1/affiliates?company_name=ilike.${encodeURIComponent(companyName)}`,
        { headers: this.getHeaders() }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      if (data && data.length > 0) {
        return this.transformAffiliate(data[0]);
      }
      return null;
    } catch (err) {
      console.error('AffiliateService: Error fetching affiliate by company', err);
      return null;
    }
  }

  /**
   * Transform database row to consistent affiliate object format
   * @param {Object} row - Database row
   * @returns {Object} Transformed affiliate object
   */
  transformAffiliate(row) {
    const firstName = row.first_name || '';
    const lastName = row.last_name || '';
    const contact = `${firstName} ${lastName}`.trim() || 'No Contact';
    const city = row.city || '';
    const state = row.state || '';
    const location = [city, state].filter(Boolean).join(', ') || 'Unknown Location';

    return {
      id: row.id,
      company: row.company_name || 'Unknown Company',
      contact: contact,
      phone: row.phone || '',
      email: row.email || '',
      location: location,
      address: row.primary_address || '',
      city: city,
      state: state,
      zip: row.zip || '',
      fax: row.fax || '',
      firstName: firstName,
      lastName: lastName,
      isActive: row.is_active,
      status: row.status,
      sendTripEmail: row.send_trip_email,
      sendTripSms: row.send_trip_sms,
      sendTripFax: row.send_trip_fax,
      notes: row.notes || '',
      createdAt: row.created_at
    };
  }

  /**
   * Clear the cache to force fresh data on next request
   */
  clearCache() {
    this.cache = null;
    this.cacheTime = null;
  }
}

