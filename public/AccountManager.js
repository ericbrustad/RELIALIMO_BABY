export class AccountManager {
  constructor() {
    this.accounts = this.loadAccounts();
    this.nextId = this.accounts.length > 0
      ? Math.max(...this.accounts.map(a => a.id)) + 1 
      : 1001;
  }

  loadAccounts() {
    // Try to load from localStorage
    const stored = localStorage.getItem('limoAccounts');
    if (stored) {
      return JSON.parse(stored);
    }

    // Return sample accounts
    return [
      {
        id: 1001,
        firstName: 'John',
        lastName: 'Smith',
        company: 'Smith Corp',
        phone: '(555) 123-4567',
        email: 'john.smith@example.com',
        createdAt: '2024-01-10T10:00:00Z'
      },
      {
        id: 1002,
        firstName: 'Sarah',
        lastName: 'Johnson',
        company: 'Johnson Enterprises',
        phone: '(555) 234-5678',
        email: 'sarah.j@example.com',
        createdAt: '2024-01-11T14:30:00Z'
      },
      {
        id: 1003,
        firstName: 'Robert',
        lastName: 'Williams',
        company: '',
        phone: '(555) 345-6789',
        email: 'r.williams@example.com',
        createdAt: '2024-01-12T09:15:00Z'
      },
      {
        id: 1004,
        firstName: 'Emily',
        lastName: 'Davis',
        company: 'Davis & Associates',
        phone: '(555) 456-7890',
        email: 'emily.d@example.com',
        createdAt: '2024-01-13T11:45:00Z'
      },
      {
        id: 1005,
        firstName: 'Michael',
        lastName: 'Brown',
        company: 'Brown Industries',
        phone: '(555) 567-8901',
        email: 'm.brown@example.com',
        createdAt: '2024-01-14T16:20:00Z'
      }
    ];
  }

  saveAccounts() {
    localStorage.setItem('limoAccounts', JSON.stringify(this.accounts));
  }

  createAccount(accountData) {
    const newAccount = {
      id: this.nextId++,
      firstName: accountData.firstName,
      lastName: accountData.lastName,
      company: accountData.company || '',
      phone: accountData.phone || '',
      email: accountData.email || '',
      createdAt: new Date().toISOString()
    };

    this.accounts.push(newAccount);
    this.saveAccounts();

    return newAccount;
  }

  getAccountById(id) {
    return this.accounts.find(account => account.id === id);
  }

  findDuplicate(passengerInfo) {
    // Check for exact name match
    const nameMatches = this.accounts.filter(account => 
      account.firstName.toLowerCase() === passengerInfo.firstName.toLowerCase() &&
      account.lastName.toLowerCase() === passengerInfo.lastName.toLowerCase()
    );

    if (nameMatches.length > 0) {
      // If we have name matches, check for phone or email match
      const exactMatch = nameMatches.find(account => 
        (passengerInfo.phone && account.phone === passengerInfo.phone) ||
        (passengerInfo.email && account.email.toLowerCase() === passengerInfo.email.toLowerCase())
      );

      // Return exact match if found, otherwise return first name match
      return exactMatch || nameMatches[0];
    }

    // Check for phone match
    if (passengerInfo.phone) {
      const phoneMatch = this.accounts.find(account => 
        account.phone === passengerInfo.phone
      );
      if (phoneMatch) return phoneMatch;
    }

    // Check for email match
    if (passengerInfo.email) {
      const emailMatch = this.accounts.find(account => 
        account.email.toLowerCase() === passengerInfo.email.toLowerCase()
      );
      if (emailMatch) return emailMatch;
    }

    return null;
  }

  search(query) {
    const lowerQuery = query.toLowerCase();
    return this.accounts.filter(account => {
      const fullName = `${account.firstName} ${account.lastName}`.toLowerCase();
      const company = (account.company || '').toLowerCase();
      const phone = (account.phone || '').replace(/\D/g, '');
      const email = (account.email || '').toLowerCase();
      const id = account.id.toString();

      return fullName.includes(lowerQuery) ||
             company.includes(lowerQuery) ||
             phone.includes(lowerQuery.replace(/\D/g, '')) ||
             email.includes(lowerQuery) ||
             id.includes(lowerQuery);
    }).slice(0, 10); // Limit to 10 results
  }

  getAllAccounts() {
    return [...this.accounts];
  }

  updateAccount(id, updates) {
    const account = this.getAccountById(id);
    if (account) {
      Object.assign(account, updates);
      this.saveAccounts();
      return true;
    }
    return false;
  }

  deleteAccount(id) {
    const index = this.accounts.findIndex(account => account.id === id);
    if (index !== -1) {
      this.accounts.splice(index, 1);
      this.saveAccounts();
      return true;
    }
    return false;
  }
}