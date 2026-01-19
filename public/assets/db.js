// Local database module for RELIA🐂LIMO™
// Handles localStorage operations for accounts, reservations, quotes, etc.

const STORAGE_KEYS = {
  ACCOUNTS: 'relia_accounts',
  RESERVATIONS: 'relia_reservations',
  QUOTES: 'relia_quotes',
  PASSENGERS: 'relia_passengers',
  BOOKING_AGENTS: 'relia_booking_agents',
  RESERVATION_STATUS_DETAILS: 'relia_reservation_status_details',
  NEXT_ACCOUNT_NUMBER: 'nextAccountNumber',
  NEXT_CONFIRMATION_NUMBER: 'nextConfirmationNumber'
};

const ENV_CONFIG = (typeof window !== 'undefined' && window.ENV) ? window.ENV : {};

function toTrimmedString(value) {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : null;
  }
  if (typeof value === 'object') {
    const idCandidate = value.id || value.value;
    return toTrimmedString(idCandidate);
  }
  const fallback = String(value).trim();
  return fallback.length > 0 ? fallback : null;
}

const ACTIVE_ORGANIZATION_ID = (() => {
  const candidates = [
    ENV_CONFIG.SUPABASE_UUID,
    ENV_CONFIG.SUPABASE_ORGANIZATION_ID,
    ENV_CONFIG.ORGANIZATION_ID,
    ENV_CONFIG.ORGANISATION_ID,
    ENV_CONFIG.ORG_ID
  ];
  for (const candidate of candidates) {
    const normalized = toTrimmedString(candidate);
    if (normalized) {
      return normalized;
    }
  }
  return null;
})();

function resolveOrganizationId(record) {
  if (!record || typeof record !== 'object') {
    return null;
  }

  const candidates = [
    record.organization_id,
    record.org_id,
    record.organizationId,
    record.organization?.id,
    record.org?.id,
    record.raw?.organization_id,
    record.raw?.organizationId,
    record.raw?.organization?.id,
    record.form_snapshot?.organization_id,
    record.form_snapshot?.organizationId,
    record.form_snapshot?.organization?.id,
    record.form_snapshot?.details?.organization_id,
    record.form_snapshot?.details?.organizationId,
    record.form_snapshot?.details?.organization?.id,
    record.details?.organization_id,
    record.details?.organizationId
  ];

  for (const candidate of candidates) {
    const normalized = toTrimmedString(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

function dedupeReservations(records) {
  if (!Array.isArray(records) || records.length === 0) {
    return [];
  }

  const map = new Map();
  const spill = [];

  records.forEach((record) => {
    if (!record || typeof record !== 'object') {
      return;
    }

    const key = toTrimmedString(record.confirmation_number) || toTrimmedString(record.id);
    if (!key) {
      spill.push(record);
      return;
    }

    if (!map.has(key)) {
      map.set(key, record);
      return;
    }

    const existing = map.get(key);
    const existingOrg = resolveOrganizationId(existing);
    const recordOrg = resolveOrganizationId(record);

    if (ACTIVE_ORGANIZATION_ID) {
      const recordMatches = recordOrg === ACTIVE_ORGANIZATION_ID;
      const existingMatches = existingOrg === ACTIVE_ORGANIZATION_ID;

      if (recordMatches && !existingMatches) {
        map.set(key, record);
        return;
      }

      if (!recordMatches && existingMatches) {
        return;
      }
    }

    const existingTs = Date.parse(existing.updated_at || existing.updatedAt || existing.modified_at || existing.modifiedAt || 0) || 0;
    const recordTs = Date.parse(record.updated_at || record.updatedAt || record.modified_at || record.modifiedAt || 0) || 0;

    if (recordTs > existingTs) {
      map.set(key, record);
    }
  });

  return [...map.values(), ...spill];
}

export const db = {
  // ===================================
  // ACCOUNTS
  // ===================================
  
  /**
   * Check for potential duplicate accounts
   * @param {Object} accountData - The account data to check
   * @param {boolean} excludeSelf - If true, excludes the account with matching id from results
   * @returns {Object} { isDuplicate: boolean, duplicates: Array, matchType: string }
   */
  checkForDuplicateAccount(accountData, excludeSelf = false) {
    const accounts = this.getAllAccounts();
    const duplicates = [];
    let matchType = '';
    
    const normalizePhone = (phone) => (phone || '').replace(/\D/g, '');
    const normalizeEmail = (email) => (email || '').toLowerCase().trim();
    const normalizeName = (name) => (name || '').toLowerCase().trim();
    
    const inputEmail = normalizeEmail(accountData.email);
    const inputPhone = normalizePhone(accountData.phone || accountData.cell_phone);
    const inputFirstName = normalizeName(accountData.first_name);
    const inputLastName = normalizeName(accountData.last_name);
    const inputCompany = normalizeName(accountData.company_name);
    
    for (const account of accounts) {
      // Skip self when updating
      if (excludeSelf && (account.id === accountData.id || account.account_number === accountData.account_number)) {
        continue;
      }
      
      const acctEmail = normalizeEmail(account.email);
      const acctPhone = normalizePhone(account.phone || account.cell_phone);
      const acctFirstName = normalizeName(account.first_name);
      const acctLastName = normalizeName(account.last_name);
      const acctCompany = normalizeName(account.company_name);
      
      // Exact email match (strongest indicator)
      if (inputEmail && acctEmail && inputEmail === acctEmail) {
        duplicates.push({ ...account, matchReason: 'Same email address' });
        matchType = matchType || 'email';
        continue;
      }
      
      // Exact phone match
      if (inputPhone && acctPhone && inputPhone.length >= 10 && inputPhone === acctPhone) {
        duplicates.push({ ...account, matchReason: 'Same phone number' });
        matchType = matchType || 'phone';
        continue;
      }
      
      // Exact name match (first + last)
      if (inputFirstName && inputLastName && acctFirstName && acctLastName) {
        if (inputFirstName === acctFirstName && inputLastName === acctLastName) {
          duplicates.push({ ...account, matchReason: 'Same first and last name' });
          matchType = matchType || 'name';
          continue;
        }
      }
      
      // Company name match (if both have company names)
      if (inputCompany && acctCompany && inputCompany === acctCompany) {
        duplicates.push({ ...account, matchReason: 'Same company name' });
        matchType = matchType || 'company';
        continue;
      }
    }
    
    return {
      isDuplicate: duplicates.length > 0,
      duplicates: duplicates.slice(0, 5), // Limit to 5 potential matches
      matchType
    };
  },
  
  async saveAccount(accountData, options = {}) {
    const { skipDuplicateCheck = false, forceCreate = false } = options;
    
    try {
      const accounts = this.getAllAccounts();
      
      // Check if this is an update (has existing id)
      const isUpdate = accountData.id && accounts.some(a => a.id === accountData.id);
      
      // Check for duplicates on new accounts (unless skipped or forced)
      if (!isUpdate && !skipDuplicateCheck && !forceCreate) {
        const duplicateCheck = this.checkForDuplicateAccount(accountData, false);
        if (duplicateCheck.isDuplicate) {
          console.warn('⚠️ Potential duplicate account detected:', duplicateCheck);
          // Return duplicate info so caller can handle it
          return {
            success: false,
            duplicateDetected: true,
            duplicates: duplicateCheck.duplicates,
            matchType: duplicateCheck.matchType,
            accountData: accountData
          };
        }
      }
      
      // Check if account already exists (by id or email) for update
      const existingIndex = accounts.findIndex(a => 
        a.id === accountData.id || (accountData.email && a.email === accountData.email)
      );
      
      if (existingIndex >= 0) {
        // Update existing account
        accounts[existingIndex] = { ...accounts[existingIndex], ...accountData };
      } else {
        // Add new account
        accounts.push(accountData);
      }
      
      localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(accounts));
      
      // Also sync to Supabase
      try {
        const apiModule = await import('../api-service.js');
        await apiModule.saveAccountToSupabase(accountData);
        console.log('✅ Account synced to Supabase');
      } catch (error) {
        console.warn('⚠️ Could not sync account to Supabase:', error.message);
      }
      
      return { success: true, account: accountData };
    } catch (error) {
      console.error('Error saving account:', error);
      return { success: false, error: error.message };
    }
  },
  
  getAllAccounts() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.ACCOUNTS);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error loading accounts:', error);
      return [];
    }
  },
  
  getAccountById(id) {
    const accounts = this.getAllAccounts();
    return accounts.find(a => a.id === id || a.id === id.toString());
  },
  
  searchAccounts(query) {
    if (!query || query.length < 3) return [];
    
    const accounts = this.getAllAccounts();
    const lowerQuery = query.toLowerCase();
    
    return accounts.filter(account => {
      const firstName = (account.first_name || '').toLowerCase();
      const lastName = (account.last_name || '').toLowerCase();
      const fullName = `${firstName} ${lastName}`;
      const company = (account.company_name || '').toLowerCase();
      const phone = (account.phone || '').replace(/\D/g, '');
      const email = (account.email || '').toLowerCase();
      const id = (account.id || '').toString();
      const accountNumber = (account.account_number || '').toString();
      
      // Match if query starts with the beginning of any field (prefix match)
      return firstName.startsWith(lowerQuery) ||
             lastName.startsWith(lowerQuery) ||
             fullName.startsWith(lowerQuery) ||
             company.startsWith(lowerQuery) ||
             phone.startsWith(lowerQuery.replace(/\D/g, '')) ||
             email.startsWith(lowerQuery) ||
             id.startsWith(lowerQuery) ||
             accountNumber.startsWith(lowerQuery);
    }).slice(0, 10); // Limit to 10 results
  },

  searchAccountsByCompany(query) {
    if (!query || query.length < 3) return [];
    
    const accounts = this.getAllAccounts();
    const lowerQuery = query.toLowerCase();
    
    return accounts.filter(account => {
      const company = (account.company_name || '').toLowerCase();
      // Only match if company name starts with query
      return company && company.startsWith(lowerQuery);
    }).slice(0, 10); // Limit to 10 results
  },
  
  deleteAccount(id) {
    try {
      const accounts = this.getAllAccounts();
      const filtered = accounts.filter(a => a.id !== id && a.id !== id.toString());
      localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(filtered));
      return true;
    } catch (error) {
      console.error('Error deleting account:', error);
      return false;
    }
  },
  
  getNextAccountNumber() {
    // Get company settings for account start number
    try {
      const settingsRaw = localStorage.getItem('relia_company_settings');
      const settings = settingsRaw ? JSON.parse(settingsRaw) : {};
      const accountStartNumber = parseInt(settings.accountStartNumber, 10) || 30000;
      const lastUsedAccountNumber = parseInt(settings.lastUsedAccountNumber, 10) || null;
      
      // Get the stored next number from legacy storage
      const legacyNextNum = localStorage.getItem(STORAGE_KEYS.NEXT_ACCOUNT_NUMBER);
      const legacyNum = legacyNextNum ? parseInt(legacyNextNum) : null;
      
      // Use the highest of: accountStartNumber, lastUsedAccountNumber + 1, or legacyNum
      let nextNum = accountStartNumber;
      if (lastUsedAccountNumber !== null && !isNaN(lastUsedAccountNumber)) {
        nextNum = Math.max(nextNum, lastUsedAccountNumber + 1);
      }
      if (legacyNum !== null && !isNaN(legacyNum)) {
        nextNum = Math.max(nextNum, legacyNum);
      }
      
      return nextNum;
    } catch (e) {
      console.warn('Error reading company settings for account number:', e);
      const nextNum = localStorage.getItem(STORAGE_KEYS.NEXT_ACCOUNT_NUMBER);
      return nextNum ? parseInt(nextNum) : 30000;
    }
  },
  
  setNextAccountNumber(num) {
    localStorage.setItem(STORAGE_KEYS.NEXT_ACCOUNT_NUMBER, num.toString());
  },
  
  getNextConfirmationNumber() {
    const nextNum = localStorage.getItem(STORAGE_KEYS.NEXT_CONFIRMATION_NUMBER);
    return nextNum ? parseInt(nextNum) : 100000;
  },
  
  setNextConfirmationNumber(num) {
    localStorage.setItem(STORAGE_KEYS.NEXT_CONFIRMATION_NUMBER, num.toString());
  },
  
  // ===================================
  // RESERVATIONS
  // ===================================
  
  saveReservation(reservationData) {
    try {
      const normalizedReservation = { ...reservationData };
      const resolvedOrgId = resolveOrganizationId(normalizedReservation) || ACTIVE_ORGANIZATION_ID;
      if (resolvedOrgId) {
        normalizedReservation.organization_id = resolvedOrgId;
      }

      const reservations = this.getAllReservations();

      // Check if reservation exists
      const existingIndex = reservations.findIndex(r =>
        (r.id !== undefined && r.id === normalizedReservation.id) ||
        (r.confirmation_number !== undefined && r.confirmation_number === normalizedReservation.confirmation_number)
      );

      if (existingIndex >= 0) {
        // Update existing
        reservations[existingIndex] = { ...reservations[existingIndex], ...normalizedReservation };
      } else {
        // Add new
        reservations.push(normalizedReservation);
      }

      const cleanedReservations = dedupeReservations(reservations);
      localStorage.setItem(STORAGE_KEYS.RESERVATIONS, JSON.stringify(cleanedReservations));
      return normalizedReservation;
    } catch (error) {
      console.error('Error saving reservation:', error);
      return null;
    }
  },
  
  getAllReservations() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.RESERVATIONS);
      const parsed = stored ? JSON.parse(stored) : [];
      if (!Array.isArray(parsed) || parsed.length === 0) {
        return [];
      }

      let mutated = false;

      const normalized = parsed
        .filter(item => item && typeof item === 'object')
        .map(item => {
          const orgId = resolveOrganizationId(item);
          if (orgId && item.organization_id !== orgId) {
            item.organization_id = orgId;
            mutated = true;
          }
          return item;
        });

      let filtered = normalized;
      if (ACTIVE_ORGANIZATION_ID) {
        filtered = normalized.filter(item => {
          const orgId = resolveOrganizationId(item);
          if (!orgId) {
            return true;
          }
          if (orgId === ACTIVE_ORGANIZATION_ID) {
            return true;
          }
          mutated = true;
          return false;
        });
      }

      const deduped = dedupeReservations(filtered);

      if (mutated || deduped.length !== parsed.length) {
        localStorage.setItem(STORAGE_KEYS.RESERVATIONS, JSON.stringify(deduped));
      }

      return deduped;
    } catch (error) {
      console.error('Error loading reservations:', error);
      return [];
    }
  },
  
  getReservationById(id) {
    const reservations = this.getAllReservations();
    return reservations.find(r => r.id === id || r.confirmation_number === id);
  },
  
  // ===================================
  // RESERVATION STATUS DETAILS
  // ===================================
  
  getReservationStatusDetails() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.RESERVATION_STATUS_DETAILS);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error loading reservation status details:', error);
      return [];
    }
  },
  
  saveReservationStatusDetails(details) {
    try {
      if (!Array.isArray(details)) {
        console.warn('saveReservationStatusDetails: expected array, got', typeof details);
        return false;
      }
      localStorage.setItem(STORAGE_KEYS.RESERVATION_STATUS_DETAILS, JSON.stringify(details));
      return true;
    } catch (error) {
      console.error('Error saving reservation status details:', error);
      return false;
    }
  },
  
  // ===================================
  // QUOTES
  // ===================================
  
  saveQuote(quoteData) {
    try {
      const quotes = this.getAllQuotes();
      
      const existingIndex = quotes.findIndex(q => q.id === quoteData.id);
      
      if (existingIndex >= 0) {
        quotes[existingIndex] = { ...quotes[existingIndex], ...quoteData };
      } else {
        quotes.push(quoteData);
      }
      
      localStorage.setItem(STORAGE_KEYS.QUOTES, JSON.stringify(quotes));
      return quoteData;
    } catch (error) {
      console.error('Error saving quote:', error);
      return null;
    }
  },
  
  getAllQuotes() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.QUOTES);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error loading quotes:', error);
      return [];
    }
  },
  
  getQuoteById(id) {
    const quotes = this.getAllQuotes();
    return quotes.find(q => q.id === id);
  },
  
  // ===================================
  // ACCOUNT ADDRESSES
  // ===================================
  
  saveAccountAddress(accountId, addressData) {
    try {
      const addresses = this.getAccountAddresses(accountId);
      
      // Check for duplicate address (same address_line1, city, zip)
      const isDuplicate = addresses.some(addr => 
        addr.address_line1?.toLowerCase() === addressData.address_line1?.toLowerCase() &&
        addr.city?.toLowerCase() === addressData.city?.toLowerCase() &&
        addr.zip_code === addressData.zip_code
      );
      
      if (isDuplicate) {
        // Update use_count and last_used_at for existing address
        const existingAddr = addresses.find(addr => 
          addr.address_line1?.toLowerCase() === addressData.address_line1?.toLowerCase() &&
          addr.city?.toLowerCase() === addressData.city?.toLowerCase() &&
          addr.zip_code === addressData.zip_code
        );
        
        if (existingAddr) {
          existingAddr.use_count = (existingAddr.use_count || 1) + 1;
          existingAddr.last_used_at = new Date().toISOString();
          const key = `relia_account_${accountId}_addresses`;
          localStorage.setItem(key, JSON.stringify(addresses));
        }
        
        return existingAddr;
      }
      
      // Add new address
      const newAddress = {
        id: `addr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        account_id: accountId,
        ...addressData,
        use_count: 1,
        last_used_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      };
      
      addresses.push(newAddress);
      const key = `relia_account_${accountId}_addresses`;
      localStorage.setItem(key, JSON.stringify(addresses));
      
      return newAddress;
    } catch (error) {
      console.error('Error saving account address:', error);
      return null;
    }
  },
  
  getAccountAddresses(accountId) {
    try {
      const key = `relia_account_${accountId}_addresses`;
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error loading account addresses:', error);
      return [];
    }
  },
  
  deleteAccountAddress(accountId, addressId) {
    try {
      const addresses = this.getAccountAddresses(accountId);
      const filtered = addresses.filter(a => a.id !== addressId);
      const key = `relia_account_${accountId}_addresses`;
      localStorage.setItem(key, JSON.stringify(filtered));
      return true;
    } catch (error) {
      console.error('Error deleting account address:', error);
      return false;
    }
  },

  // ===================================
  // PASSENGERS
  // ===================================

  async savePassenger(passenger) {
    try {
      const passengers = this.getAllPassengers();
      
      // Check for duplicate by name and email
      const existingIndex = passengers.findIndex(p =>
        p.firstName?.toLowerCase() === passenger.firstName?.toLowerCase() &&
        p.lastName?.toLowerCase() === passenger.lastName?.toLowerCase() &&
        p.email?.toLowerCase() === passenger.email?.toLowerCase()
      );
      
      if (existingIndex !== -1) {
        // Update existing passenger
        passengers[existingIndex] = {
          ...passengers[existingIndex],
          ...passenger,
          updatedAt: new Date().toISOString()
        };
      } else {
        // Add new passenger
        passenger.id = passenger.id || Date.now().toString();
        passenger.createdAt = new Date().toISOString();
        passengers.push(passenger);
      }
      
      localStorage.setItem(STORAGE_KEYS.PASSENGERS, JSON.stringify(passengers));
      
      // Also sync to Supabase
      try {
        const apiModule = await import('../api-service.js');
        await apiModule.savePassengerToSupabase(passenger);
        console.log('✅ Passenger synced to Supabase');
      } catch (error) {
        console.warn('⚠️ Could not sync passenger to Supabase:', error.message);
      }
      
      return passenger;
    } catch (error) {
      console.error('Error saving passenger:', error);
      return null;
    }
  },
  
  getAllPassengers() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PASSENGERS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting passengers:', error);
      return [];
    }
  },
  
  searchPassengers(query) {
    const passengers = this.getAllPassengers();
    if (!query) return passengers;
    
    const q = query.toLowerCase();
    return passengers.filter(p =>
      p.firstName?.toLowerCase().includes(q) ||
      p.lastName?.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q) ||
      p.phone?.includes(q)
    );
  },
  
  // ===================================
  // BOOKING AGENTS
  // ===================================
  
  async saveBookingAgent(agent) {
    try {
      const agents = this.getAllBookingAgents();
      
      // Check for duplicate by name and email
      const existingIndex = agents.findIndex(a => 
        a.firstName?.toLowerCase() === agent.firstName?.toLowerCase() &&
        a.lastName?.toLowerCase() === agent.lastName?.toLowerCase() &&
        a.email?.toLowerCase() === agent.email?.toLowerCase()
      );
      
      if (existingIndex !== -1) {
        // Update existing agent
        agents[existingIndex] = {
          ...agents[existingIndex],
          ...agent,
          updatedAt: new Date().toISOString()
        };
      } else {
        // Add new agent
        agent.id = agent.id || Date.now().toString();
        agent.createdAt = new Date().toISOString();
        agents.push(agent);
      }
      
      localStorage.setItem(STORAGE_KEYS.BOOKING_AGENTS, JSON.stringify(agents));
      
      // Also sync to Supabase
      try {
        const apiModule = await import('../api-service.js');
        await apiModule.saveBookingAgentToSupabase(agent);
        console.log('✅ Booking agent synced to Supabase');
      } catch (error) {
        console.warn('⚠️ Could not sync booking agent to Supabase:', error.message);
      }
      
      return agent;
    } catch (error) {
      console.error('Error saving booking agent:', error);
      return null;
    }
  },
  
  getAllBookingAgents() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.BOOKING_AGENTS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting booking agents:', error);
      return [];
    }
  },
  
  searchBookingAgents(query) {
    const agents = this.getAllBookingAgents();
    if (!query) return agents;
    
    const q = query.toLowerCase();
    return agents.filter(a =>
      a.firstName?.toLowerCase().includes(q) ||
      a.lastName?.toLowerCase().includes(q) ||
      a.email?.toLowerCase().includes(q) ||
      a.phone?.includes(q)
    );
  },
  
  // ===================================
  // UTILITIES
  // ===================================
  
  clearAllData() {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  },
  
  exportData() {
    return {
      accounts: this.getAllAccounts(),
      reservations: this.getAllReservations(),
      quotes: this.getAllQuotes(),
      nextAccountNumber: this.getNextAccountNumber()
    };
  },
  
  importData(data) {
    if (data.accounts) {
      localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(data.accounts));
    }
    if (data.reservations) {
      localStorage.setItem(STORAGE_KEYS.RESERVATIONS, JSON.stringify(data.reservations));
    }
    if (data.quotes) {
      localStorage.setItem(STORAGE_KEYS.QUOTES, JSON.stringify(data.quotes));
    }
    if (data.nextAccountNumber) {
      this.setNextAccountNumber(data.nextAccountNumber);
    }
  }
};

// Initialize default account number if not set
if (!localStorage.getItem(STORAGE_KEYS.NEXT_ACCOUNT_NUMBER)) {
  localStorage.setItem(STORAGE_KEYS.NEXT_ACCOUNT_NUMBER, '30000');
}

console.log('✅ db.js module loaded');
