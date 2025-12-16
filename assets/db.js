// Local database module for RELIA🐂LIMO™
// Handles localStorage operations for accounts, reservations, quotes, etc.

const STORAGE_KEYS = {
  ACCOUNTS: 'relia_accounts',
  RESERVATIONS: 'relia_reservations',
  QUOTES: 'relia_quotes',
  PASSENGERS: 'relia_passengers',
  BOOKING_AGENTS: 'relia_booking_agents',
  NEXT_ACCOUNT_NUMBER: 'nextAccountNumber',
  NEXT_CONFIRMATION_NUMBER: 'nextConfirmationNumber'
};

export const db = {
  // ===================================
  // ACCOUNTS
  // ===================================
  
  saveAccount(accountData) {
    try {
      const accounts = this.getAllAccounts();
      
      // Check if account already exists (by id or email)
      const existingIndex = accounts.findIndex(a => 
        a.id === accountData.id || a.email === accountData.email
      );
      
      if (existingIndex >= 0) {
        // Update existing account
        accounts[existingIndex] = { ...accounts[existingIndex], ...accountData };
      } else {
        // Add new account
        accounts.push(accountData);
      }
      
      localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(accounts));
      return accountData;
    } catch (error) {
      console.error('Error saving account:', error);
      return null;
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
    if (!query || query.length < 2) return [];
    
    const accounts = this.getAllAccounts();
    const lowerQuery = query.toLowerCase();
    
    return accounts.filter(account => {
      const fullName = `${account.first_name} ${account.last_name}`.toLowerCase();
      const company = (account.company_name || '').toLowerCase();
      const phone = (account.phone || '').replace(/\D/g, '');
      const email = (account.email || '').toLowerCase();
      const id = (account.id || '').toString();
      
      return fullName.includes(lowerQuery) ||
             company.includes(lowerQuery) ||
             phone.includes(lowerQuery.replace(/\D/g, '')) ||
             email.includes(lowerQuery) ||
             id.includes(lowerQuery);
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
    const nextNum = localStorage.getItem(STORAGE_KEYS.NEXT_ACCOUNT_NUMBER);
    return nextNum ? parseInt(nextNum) : 30000;
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
      const reservations = this.getAllReservations();
      
      // Check if reservation exists
      const existingIndex = reservations.findIndex(r => 
        r.id === reservationData.id || r.confirmation_number === reservationData.confirmation_number
      );
      
      if (existingIndex >= 0) {
        // Update existing
        reservations[existingIndex] = { ...reservations[existingIndex], ...reservationData };
      } else {
        // Add new
        reservations.push(reservationData);
      }
      
      localStorage.setItem(STORAGE_KEYS.RESERVATIONS, JSON.stringify(reservations));
      return reservationData;
    } catch (error) {
      console.error('Error saving reservation:', error);
      return null;
    }
  },
  
  getAllReservations() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.RESERVATIONS);
      return stored ? JSON.parse(stored) : [];
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
  
  savePassenger(passenger) {
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
  
  saveBookingAgent(agent) {
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
