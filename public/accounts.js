import { wireMainNav, navigateToSection } from './navigation.js';
import { setupPhoneEmailValidation, validateAllFields } from './validation-utils.js';

class Accounts {
  constructor() {
    this.currentTab = 'accounts';
    this.localRegion = this.getLocalRegionFromSettings();
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.init());
    } else {
      this.init();
    }
  }

  getLocalRegionFromSettings() {
    try {
      const settings = JSON.parse(localStorage.getItem('relia_company_settings') || '{}');
      const raw = (settings.tickerSearchCity || '').toString();
      const parts = raw.split(',').map(p => p.trim()).filter(Boolean);
      return {
        city: parts[0] || '',
        state: parts[1] || ''
      };
    } catch (e) {
      console.warn('⚠️ Failed to read tickerSearchCity setting:', e);
      return { city: '', state: '' };
    }
  }

  applyLocalRegionDefaults() {
    const { city, state } = this.localRegion || {};
    if (!city && !state) return;

    const cityEl = document.getElementById('acctCity');
    const stateEl = document.getElementById('acctState');

    if (cityEl && !cityEl.value) cityEl.value = city;
    if (stateEl && !stateEl.value) stateEl.value = state;
  }

  getSelectedAccountId() {
    // Prefer the currently loaded account number (readonly field)
    const fromForm = document.getElementById('accountNumber')?.value?.trim();
    if (fromForm) return fromForm;
    // Fallback to listbox selection
    const fromList = document.getElementById('accountsListbox')?.value?.trim();
    return fromList || null;
  }

  getCurrentAccountDisplayName() {
    const first = document.getElementById('acctFirstName')?.value?.trim() || '';
    const last = document.getElementById('acctLastName')?.value?.trim() || '';
    const company = document.getElementById('acctCompany')?.value?.trim() || '';

    const person = `${first} ${last}`.trim();
    return company || person || 'this account';
  }

  showAccountDetails() {
    // Make sure the accounts main area is visible and highlighted
    const accountsMain = document.querySelector('.accounts-main');
    if (accountsMain) {
      accountsMain.style.display = 'block';
      accountsMain.style.border = '2px solid #007bff';
      accountsMain.style.borderRadius = '8px';
      accountsMain.style.backgroundColor = '#f8f9fa';
      accountsMain.style.transition = 'all 0.3s ease';
      
      // Remove highlight after a brief moment
      setTimeout(() => {
        if (accountsMain.style.border === '2px solid #007bff') {
          accountsMain.style.border = '';
          accountsMain.style.backgroundColor = '';
        }
      }, 2000);
    }

    // Add "Currently Selected" indicator to the sidebar
    const sidebar = document.querySelector('.accounts-sidebar');
    let indicator = sidebar?.querySelector('.selected-account-indicator');
    if (sidebar && !indicator) {
      indicator = document.createElement('div');
      indicator.className = 'selected-account-indicator';
      indicator.innerHTML = `
        <div style="background: #28a745; color: white; padding: 5px 8px; border-radius: 3px; font-size: 11px; font-weight: bold; text-align: center; margin: 5px 0;">
          ✓ Account Selected - View Details →
        </div>
      `;
      // Insert after the search section
      const searchSection = sidebar.querySelector('.sidebar-section');
      if (searchSection) {
        searchSection.parentNode.insertBefore(indicator, searchSection.nextSibling);
      }
      
      // Auto-remove indicator after a few seconds
      setTimeout(() => {
        if (indicator && indicator.parentNode) {
          indicator.parentNode.removeChild(indicator);
        }
      }, 4000);
    }

    // Scroll to account details if needed
    const accountInfoTab = document.getElementById('accountInfoTab');
    if (accountInfoTab) {
      accountInfoTab.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      });
    }
  }

  activateAccountTab(tabName) {
    // Remove active class from all tabs and tab contents
    document.querySelectorAll('.account-tab').forEach(tab => {
      tab.classList.remove('active');
    });
    document.querySelectorAll('.account-tab-content').forEach(content => {
      content.classList.remove('active');
    });

    // Activate the specified tab
    const targetTab = document.querySelector(`[data-account-tab="${tabName}"]`);
    if (targetTab) {
      targetTab.classList.add('active');
    }

    // Show the corresponding tab content
    const tabContentMap = {
      'info': 'accountInfoTab',
      'financial': 'financialDataTab', 
      'addresses': 'addressesTab',
      'booking': 'bookingTab',
      'misc': 'miscTab'
    };

    const contentId = tabContentMap[tabName];
    if (contentId) {
      const content = document.getElementById(contentId);
      if (content) {
        content.classList.add('active');
      }
    }
  }

  isAccountLinkedToReservations(accountId) {
    if (!this.db) return false;

    try {
      const reservations = this.db.getAllReservations?.() || [];
      const id = (accountId ?? '').toString();
      return reservations.some(r => {
        // Primary supported linkage
        if ((r?.account_id ?? '').toString() === id) return true;

        // Back-compat / other storage patterns
        if ((r?.billing_account ?? '').toString() === id) return true;
        if ((r?.form_snapshot?.billing?.account ?? '').toString() === id) return true;

        return false;
      });
    } catch (e) {
      console.warn('⚠️ Failed to check reservation linkage:', e);
      return false;
    }
  }

  async makeAccountInactive(accountId) {
    if (!this.db) return false;
    try {
      const existing = await this.db.getAccountById?.(accountId);
      if (!existing) return false;

      const updated = {
        ...existing,
        status: 'inactive',
        updated_at: new Date().toISOString()
      };

      await this.db.saveAccount(updated);
      return true;
    } catch (e) {
      console.error('❌ Failed to make account inactive:', e);
      return false;
    }
  }

  async deleteSelectedAccount() {
    if (!this.db) {
      alert('Database module not available. Please refresh the page.');
      return;
    }

    const accountId = this.getSelectedAccountId();
    if (!accountId) {
      alert('Please select an account to delete.');
      return;
    }

    // Are-you-sure confirmation
    const confirmDelete = confirm(`Are you sure you want to delete account ${accountId}?`);
    if (!confirmDelete) return;

    // If linked to reservations, block delete and offer to mark inactive
    if (this.isAccountLinkedToReservations(accountId)) {
      const name = this.getCurrentAccountDisplayName();
      const makeInactive = confirm(
        `We can not delete due to this account being attached to a reservation.\n` +
        `You may make the account inactive.\n\n` +
        `Make "${name}" inactive?\n\nOK = Yes\nCancel = No`
      );

      if (!makeInactive) return;

      const ok = await this.makeAccountInactive(accountId);
      if (!ok) {
        alert('Unable to mark account inactive.');
        return;
      }

      await this.loadAccountsList();
      alert('Account marked inactive.');
      return;
    }

    const deleted = await this.db.deleteAccount(accountId);
    if (!deleted) {
      alert('Failed to delete account.');
      return;
    }

    // Also remove locally stored addresses for this account
    try {
      localStorage.removeItem(`relia_account_${accountId}_addresses`);
    } catch (e) {
      console.warn('⚠️ Failed to remove account addresses storage:', e);
    }

    // Clear form fields (best-effort)
    try {
      this.addNewAccount();
    } catch {
      // no-op
    }

    await this.loadAccountsList();
    alert('Account deleted.');
  }

  async init() {
    console.log('🔧 Initializing Accounts...');
    try {
      // Load database module
      await this.loadDbModule();
      
      // Load API service for Supabase
      await this.loadApiService();
      
      this.setupEventListeners();
      
      // Load accounts list
      await this.loadAccountsList();

      // Apply local region defaults on initial load if fields are empty
      this.applyLocalRegionDefaults();
      
      // Check URL parameters for mode and account
      const params = new URLSearchParams(window.location.search);
      const mode = params.get('mode');
      const accountId = params.get('account');
      const fromReservation = params.get('from') === 'reservation';
      
      if (mode === 'edit' && accountId) {
        // Edit existing account mode
        console.log('📝 Edit mode - loading account:', accountId);
        this.loadAccount(accountId);
        
        // Show notification that we're editing existing account
        if (fromReservation) {
          setTimeout(() => {
            const accountName = document.getElementById('acctFirstName')?.value + ' ' + 
                               document.getElementById('acctLastName')?.value;
            console.log(`✏️ Editing existing account: ${accountName.trim() || accountId}`);
          }, 100);
        }
      } else {
        // Always start with a fresh new account form
        this.addNewAccount();
        
        // Apply draft if present (used by Reservation "Create Account" and similar flows)
        // Add a small delay to ensure DOM elements are ready
        setTimeout(() => {
          this.applyDraftIfPresent();
        }, 100);
      }
      
      console.log('✅ Accounts initialization complete');
    } catch (error) {
      console.error('❌ Error initializing Accounts:', error);
    }
  }
  
  async loadApiService() {
    try {
      const module = await import('./api-service.js');
      this.api = module;
      await module.setupAPI();
      console.log('✅ API service loaded');
    } catch (error) {
      console.warn('⚠️ Failed to load API service:', error);
    }
  }
  
  async loadAccountsList() {
    try {
      // Load from Supabase (primary source)
      let allAccounts = [];
      if (this.db) {
        try {
          allAccounts = await this.db.getAllAccounts() || [];
          console.log(`☁️ Supabase accounts found: ${allAccounts.length}`);
        } catch (e) {
          console.warn('⚠️ Could not fetch accounts from Supabase:', e.message);
        }
      }
      
      // Populate the listbox; always clear to drop deleted accounts
      const listbox = document.getElementById('accountsListbox');
      if (listbox) {
        listbox.innerHTML = allAccounts.map(acc => {
          const inactiveLabel = (acc.status || '').toString().toLowerCase() === 'inactive' ? ' (INACTIVE)' : '';
          const displayName = `${acc.account_number || acc.id}${inactiveLabel} - ${acc.first_name || ''} ${acc.last_name || ''} ${acc.company_name ? '- ' + acc.company_name : ''}`.trim();
          return `<option value="${acc.id}">${displayName}</option>`; // Use acc.id for consistency
        }).join('');

        if (allAccounts.length === 0) {
          listbox.innerHTML = '<option value="">No accounts found</option>';
        }
      }
      
      console.log(`✅ Loaded ${allAccounts.length} accounts`);
    } catch (error) {
      console.error('❌ Error loading accounts list:', error);
    }
  }
  
  async loadDbModule() {
    try {
      const module = await import('./supabase-db.js');
      this.db = module.default;
      console.log('✅ Supabase database module loaded');
    } catch (error) {
      console.error('❌ Failed to load database module:', error);
      alert('⚠️ DATABASE CONNECTION FAILED\n\nPlease check your connection and reload.');
    }
  }
  
  async loadAccount(accountId) {
    if (!this.db) {
      console.warn('⚠️ Database module not loaded yet');
      return;
    }
    
    try {
      const accounts = await this.db.getAllAccounts();
      // Look for account by both id and account_number to handle both cases
      const account = accounts.find(a => a.id === accountId || a.account_number === accountId);
      if (!account) {
        console.warn('⚠️ Account not found:', accountId, 'in', accounts.length, 'accounts');
        // Debug: Show what we're looking for vs what's available
        console.log('Available account IDs:', accounts.map(a => ({ id: a.id, account_number: a.account_number })).slice(0, 5));
        return;
      }
      
      console.log('✅ Loading account:', account);
      
      // Activate the Account Info tab and show account details
      this.showAccountDetails();
      this.switchAccountTab('info');
      
      // Populate form fields with proper mapping
      const accountUUIDEl = document.getElementById('accountUUID');
      const accountNumberEl = document.getElementById('accountNumber');
      const firstNameEl = document.getElementById('acctFirstName');
      const lastNameEl = document.getElementById('acctLastName');
      const companyEl = document.getElementById('acctCompany');
      const cellPhone1El = document.getElementById('acctCellPhone1'); // Top-left cell field
      const cellularPhone1El = document.getElementById('acctCellularPhone1'); // Contact Info > Cellular Phone 1
      const emailEl = document.getElementById('acctEmail2'); // Maps to email
      
      // Store the actual UUID for later use in save operations
      if (accountUUIDEl) {
        accountUUIDEl.value = account.id || '';
        console.log('🔑 Stored account UUID:', account.id);
      }
      if (accountNumberEl) {
        accountNumberEl.value = account.account_number || account.id;
        accountNumberEl.setAttribute('readonly', true);
        accountNumberEl.style.backgroundColor = '#f5f5f5';
      }
      if (firstNameEl) firstNameEl.value = account.first_name || '';
      if (lastNameEl) lastNameEl.value = account.last_name || '';
      if (companyEl) companyEl.value = account.company_name || '';
      const cellValue = account.cell_phone || '';
      if (cellPhone1El) cellPhone1El.value = cellValue;
      if (cellularPhone1El) cellularPhone1El.value = cellValue;
      if (emailEl) emailEl.value = account.email || ''; // Accounts Email

      // Department and Job Title
      const departmentEl = document.getElementById('acctDepartment');
      const jobTitleEl = document.getElementById('acctJobTitle');
      if (departmentEl) departmentEl.value = account.department || '';
      if (jobTitleEl) jobTitleEl.value = account.job_title || '';
      
      // Address fields
      const address1El = document.getElementById('acctAddress1');
      const address2El = document.getElementById('acctAddress2');
      const cityEl = document.getElementById('acctCity');
      const stateEl = document.getElementById('acctState');
      const zipEl = document.getElementById('acctZip');
      const countryEl = document.getElementById('acctCountry');
      if (address1El) address1El.value = account.address_line1 || '';
      if (address2El) address2El.value = account.address_line2 || '';
      if (cityEl) cityEl.value = account.city || '';
      if (stateEl) stateEl.value = account.state || '';
      if (zipEl) zipEl.value = account.zip || '';
      if (countryEl) countryEl.value = account.country || 'US';
      
      // Notes fields
      const internalNotesEl = document.getElementById('acctInternalNotes');
      const tripNotesEl = document.getElementById('acctTripNotes');
      const notesOthersEl = document.getElementById('acctNotesOthers');
      if (internalNotesEl) internalNotesEl.value = account.internal_notes || '';
      if (tripNotesEl) tripNotesEl.value = account.trip_notes || '';
      if (notesOthersEl) notesOthersEl.value = account.notes_others || '';
      
      // Settings and restrictions
      const sourceEl = document.getElementById('acctSource');
      const rentalAgreementEl = document.getElementById('acctRentalAgreement');
      const settingsEl = document.getElementById('acctSettings');
      const statusEl = document.getElementById('acctStatus');
      const webAccessEl = document.getElementById('acctWebAccess');
      if (sourceEl) sourceEl.value = account.source || '';
      if (rentalAgreementEl) rentalAgreementEl.value = account.rental_agreement || '';
      if (settingsEl) settingsEl.value = account.account_settings || 'normal';
      if (statusEl) statusEl.value = account.status || 'active';
      if (webAccessEl) webAccessEl.value = account.web_access || 'allow';
      
      // Account type checkboxes
      const billingCheckEl = document.getElementById('acctTypeBilling');
      const passengerCheckEl = document.getElementById('acctTypePassenger');
      const bookingCheckEl = document.getElementById('acctTypeBooking');
      if (billingCheckEl) billingCheckEl.checked = account.is_billing_client || false;
      if (passengerCheckEl) passengerCheckEl.checked = account.is_passenger || false;
      if (bookingCheckEl) bookingCheckEl.checked = account.is_booking_contact || false;
      
      // Provider Type (for admin/driver accounts)
      const providerTypeSectionEl = document.getElementById('providerTypeSection');
      const providerTypeEl = document.getElementById('acctProviderType');
      if (providerTypeEl) providerTypeEl.value = account.provider_type || '';
      // Show provider type section if value is set
      if (providerTypeSectionEl && account.provider_type) {
        providerTypeSectionEl.style.display = 'block';
      }
      
      // Additional phone fields
      const officePhoneEl = document.getElementById('acctOfficePhone');
      const officePhoneExtEl = document.getElementById('acctOfficePhoneExt');
      const homePhoneEl = document.getElementById('acctHomePhone');
      const homePhoneExtEl = document.getElementById('acctHomePhoneExt');
      const cellPhone2El = document.getElementById('acctCellularPhone2');
      const cellPhone3El = document.getElementById('acctCellularPhone3');
      const fax1El = document.getElementById('acctFax1');
      const fax2El = document.getElementById('acctFax2');
      const fax3El = document.getElementById('acctFax3');
      if (officePhoneEl) officePhoneEl.value = account.office_phone || '';
      if (officePhoneExtEl) officePhoneExtEl.value = account.office_phone_ext || '';
      if (homePhoneEl) homePhoneEl.value = account.home_phone || '';
      if (homePhoneExtEl) homePhoneExtEl.value = account.home_phone_ext || '';
      if (cellPhone2El) cellPhone2El.value = account.cell_phone_2 || '';
      if (cellPhone3El) cellPhone3El.value = account.cell_phone_3 || '';
      if (fax1El) fax1El.value = account.fax_1 || '';
      if (fax2El) fax2El.value = account.fax_2 || '';
      if (fax3El) fax3El.value = account.fax_3 || '';
      
      // Email preferences (default to true if not set)
      const emailPrefAllEl = document.getElementById('emailPrefAll');
      const emailPrefConfirmationEl = document.getElementById('emailPrefConfirmation');
      const emailPrefPaymentReceiptEl = document.getElementById('emailPrefPaymentReceipt');
      const emailPrefInvoiceEl = document.getElementById('emailPrefInvoice');
      const emailPrefOtherEl = document.getElementById('emailPrefOther');
      if (emailPrefAllEl) emailPrefAllEl.checked = account.email_pref_all !== false;
      if (emailPrefConfirmationEl) emailPrefConfirmationEl.checked = account.email_pref_confirmation !== false;
      if (emailPrefPaymentReceiptEl) emailPrefPaymentReceiptEl.checked = account.email_pref_payment_receipt !== false;
      if (emailPrefInvoiceEl) emailPrefInvoiceEl.checked = account.email_pref_invoice !== false;
      if (emailPrefOtherEl) emailPrefOtherEl.checked = account.email_pref_other !== false;
      
      // Multi-select fields (restricted drivers/cars)
      this.setMultiSelectValues('acctRestrictedDrivers', account.restricted_drivers || []);
      this.setMultiSelectValues('acctRestrictedCars', account.restricted_cars || []);
      
      // ==========================================
      // Financial Data Tab fields
      // ==========================================
      const postMethodEl = document.getElementById('postMethod');
      const postTermsEl = document.getElementById('postTerms');
      const primaryAgentEl = document.getElementById('primaryAgent');
      const secondaryAgentEl = document.getElementById('secondaryAgent');
      if (postMethodEl) postMethodEl.value = account.post_method || '';
      if (postTermsEl) postTermsEl.value = account.post_terms || '';
      if (primaryAgentEl) primaryAgentEl.value = account.primary_agent_id || '';
      if (secondaryAgentEl) secondaryAgentEl.value = account.secondary_agent_id || '';
      
      // Credit Card fields (display last 4 only if stored)
      const ccNumberEl = document.getElementById('creditCardNumber');
      const expMonthEl = document.getElementById('expMonth');
      const expYearEl = document.getElementById('expYear');
      const nameOnCardEl = document.getElementById('nameOnCard');
      const ccTypeEl = document.getElementById('ccType');
      const ccBillingAddressEl = document.getElementById('billingAddressCC');
      const ccBillingCityEl = document.getElementById('billingCityCC');
      const ccBillingStateEl = document.getElementById('billingStateCC');
      const ccBillingZipEl = document.getElementById('billingZipCC');
      const ccBillingCountryEl = document.getElementById('billingCountryCC');
      const ccNotesEl = document.getElementById('creditCardNotes');
      
      if (ccNumberEl) ccNumberEl.value = account.cc_last_four ? `****-****-****-${account.cc_last_four}` : '';
      if (expMonthEl) expMonthEl.value = account.cc_exp_month || '';
      if (expYearEl) expYearEl.value = account.cc_exp_year || '';
      if (nameOnCardEl) nameOnCardEl.value = account.cc_name_on_card || '';
      if (ccTypeEl) ccTypeEl.value = account.cc_type || '';
      if (ccBillingAddressEl) ccBillingAddressEl.value = account.cc_billing_address || '';
      if (ccBillingCityEl) ccBillingCityEl.value = account.cc_billing_city || '';
      if (ccBillingStateEl) ccBillingStateEl.value = account.cc_billing_state || '';
      if (ccBillingZipEl) ccBillingZipEl.value = account.cc_billing_zip || '';
      if (ccBillingCountryEl) ccBillingCountryEl.value = account.cc_billing_country || 'United States';
      if (ccNotesEl) ccNotesEl.value = account.cc_notes || '';
      
      // ==========================================
      // Addresses Tab - Billing Contact fields
      // ==========================================
      const employeeIdEl = document.getElementById('employeeId');
      const vipNumberEl = document.getElementById('vipNumber');
      const myBillingContactEl = document.getElementById('myBillingContact');
      if (employeeIdEl) employeeIdEl.value = account.employee_id || '';
      if (vipNumberEl) vipNumberEl.value = account.vip_number || '';
      if (myBillingContactEl) myBillingContactEl.value = account.my_billing_contact_id || '';
      
      // ==========================================
      // Misc Tab fields
      // ==========================================
      const miscPrefixEl = document.getElementById('miscPrefix');
      const miscFirstNameEl = document.getElementById('miscFirstName');
      const miscLastNameEl = document.getElementById('miscLastName');
      const miscAccountNumberEl = document.getElementById('miscAccountNumber');
      const groundXchangeIdEl = document.getElementById('groundXchangeId');
      const gnetIdEl = document.getElementById('gnetId');
      
      if (miscPrefixEl) miscPrefixEl.value = account.prefix || '';
      if (miscFirstNameEl) miscFirstNameEl.value = account.first_name || '';
      if (miscLastNameEl) miscLastNameEl.value = account.last_name || '';
      if (miscAccountNumberEl) miscAccountNumberEl.value = account.account_number || '';
      if (groundXchangeIdEl) groundXchangeIdEl.value = account.groundxchange_id || '';
      if (gnetIdEl) gnetIdEl.value = account.gnet_id || '';
      
      // Email rules toggles
      const emailRulesEnabledEl = document.getElementById('emailRulesEnabled');
      const smsRulesEnabledEl = document.getElementById('smsRulesEnabled');
      if (emailRulesEnabledEl) emailRulesEnabledEl.checked = account.email_rules_enabled !== false;
      if (smsRulesEnabledEl) smsRulesEnabledEl.checked = account.sms_rules_enabled === true;
      
      // Customer Profile Info (read-only audit info)
      const createdByEl = document.getElementById('createdBy');
      const dateCreatedEl = document.getElementById('dateCreated');
      const updatedByEl = document.getElementById('updatedBy');
      const lastUpdatedEl = document.getElementById('lastUpdated');
      if (createdByEl) createdByEl.textContent = account.created_by || 'System';
      if (dateCreatedEl) dateCreatedEl.textContent = account.created_at ? new Date(account.created_at).toLocaleString() : '--';
      if (updatedByEl) updatedByEl.textContent = account.updated_by || 'System';
      if (lastUpdatedEl) lastUpdatedEl.textContent = account.updated_at ? new Date(account.updated_at).toLocaleString() : '--';
      
      // Switch to accounts tab
      this.switchAccountTab('info');
      
    } catch (error) {
      console.error('❌ Error loading account:', error);
    }
  }
  
  // Helper function to get values from multi-select
  getMultiSelectValues(elementId) {
    const el = document.getElementById(elementId);
    if (!el) return [];
    return Array.from(el.selectedOptions)
      .map(opt => opt.value)
      .filter(v => v && v !== '');
  }
  
  // Helper function to set values on multi-select
  setMultiSelectValues(elementId, values) {
    const el = document.getElementById(elementId);
    if (!el || !Array.isArray(values)) return;
    Array.from(el.options).forEach(opt => {
      opt.selected = values.includes(opt.value);
    });
  }
  
  // Address verification using OpenStreetMap Nominatim
  async verifyAddress() {
    const address1 = document.getElementById('acctAddress1')?.value?.trim() || '';
    const city = document.getElementById('acctCity')?.value?.trim() || '';
    const state = document.getElementById('acctState')?.value || '';
    const zip = document.getElementById('acctZip')?.value?.trim() || '';
    const country = document.getElementById('acctCountry')?.value || 'US';
    
    if (!address1 || !city) {
      alert('Please enter at least Address and City to verify.');
      return;
    }
    
    const fullAddress = `${address1}, ${city}, ${state} ${zip}, ${country}`;
    console.log('🔍 Verifying address:', fullAddress);
    
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullAddress)}&limit=5&addressdetails=1`,
        {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'RELIA-LIMO-APP'
          }
        }
      );
      
      if (!response.ok) {
        throw new Error('Address verification service unavailable');
      }
      
      const results = await response.json();
      
      if (results.length === 0) {
        alert('⚠️ Address could not be verified. Please check the address and try again.');
        return;
      }
      
      const best = results[0];
      const addr = best.address || {};
      
      // Show verification result
      const verified = confirm(
        `✅ ADDRESS VERIFIED\n\n` +
        `Verified Address:\n${best.display_name}\n\n` +
        `Would you like to update the form with the verified address?\n\n` +
        `Street: ${addr.road || addr.house_number ? (addr.house_number || '') + ' ' + (addr.road || '') : address1}\n` +
        `City: ${addr.city || addr.town || addr.village || city}\n` +
        `State: ${addr.state || state}\n` +
        `Zip: ${addr.postcode || zip}\n` +
        `Country: ${addr.country || country}`
      );
      
      if (verified) {
        // Update fields with verified data
        if (addr.road) {
          const streetNum = addr.house_number || '';
          document.getElementById('acctAddress1').value = (streetNum + ' ' + addr.road).trim();
        }
        if (addr.city || addr.town || addr.village) {
          document.getElementById('acctCity').value = addr.city || addr.town || addr.village;
        }
        if (addr.postcode) {
          document.getElementById('acctZip').value = addr.postcode;
        }
        // Try to match state abbreviation
        if (addr.state) {
          const stateEl = document.getElementById('acctState');
          const stateAbbr = this.getStateAbbreviation(addr.state);
          if (stateAbbr && stateEl) {
            stateEl.value = stateAbbr;
          }
        }
        console.log('✅ Address updated with verified data');
      }
    } catch (error) {
      console.error('❌ Address verification error:', error);
      alert('Error verifying address: ' + error.message);
    }
  }
  
  // Helper to convert state name to abbreviation
  getStateAbbreviation(stateName) {
    const states = {
      'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR', 'california': 'CA',
      'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE', 'florida': 'FL', 'georgia': 'GA',
      'hawaii': 'HI', 'idaho': 'ID', 'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA',
      'kansas': 'KS', 'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
      'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS', 'missouri': 'MO',
      'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
      'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH',
      'oklahoma': 'OK', 'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
      'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT', 'vermont': 'VT',
      'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV', 'wisconsin': 'WI', 'wyoming': 'WY',
      'district of columbia': 'DC'
    };
    return states[stateName.toLowerCase()] || null;
  }

  applyDraftIfPresent() {
    console.log('🔍 applyDraftIfPresent() called');
    
    // Check if there's a draft account from the reservation form
    const raw = localStorage.getItem('relia_account_draft');
    if (!raw) {
      console.log('❌ No draft found in localStorage');
      return;
    }

    try {
      const draft = JSON.parse(raw);
      console.log('✅ Draft account found, prefilling fields:', draft);

      // Switch to Accounts tab first (in case we're not already there)
      console.log('🔄 Switching to accounts tab...');
      this.switchTab('accounts');
      
      // Wait a bit more for tab switch to complete
      setTimeout(() => {
        this.fillFormFromDraft(draft);
      }, 150);
      
    } catch (error) {
      console.error('Error parsing draft account:', error);
      localStorage.removeItem('relia_account_draft');
    }
  }

  fillFormFromDraft(draft) {
    console.log('📝 fillFormFromDraft called with:', draft);

    const setIfEmpty = (el, value) => {
      if (!el) {
        console.warn('⚠️ Element not found for setIfEmpty:', el);
        return;
      }
      const current = (el.value ?? '').toString().trim();
      const next = (value ?? '').toString();
      if (!next) {
        console.log('📝 No value to set for', el.id);
        return;
      }
      if (!current) {
        console.log('✏️ Setting', el.id, 'to:', next);
        el.value = next;
      } else {
        console.log('⏭️ Skipping', el.id, '- already has value:', current);
      }
    };

    // Use the IDs we just added to accounts.html
    const firstNameEl = document.getElementById('acctFirstName');
    const lastNameEl = document.getElementById('acctLastName');
    const companyEl = document.getElementById('acctCompany');
    const cellPhone1El = document.getElementById('acctCellPhone1');
    const cellularPhone1El = document.getElementById('acctCellularPhone1');
    const emailEl = document.getElementById('acctEmail2');
    const phoneEl = document.getElementById('acctPhone');

    console.log('🔍 Form elements found:', {
      firstNameEl: !!firstNameEl,
      lastNameEl: !!lastNameEl,
      companyEl: !!companyEl,
      cellPhone1El: !!cellPhone1El,
      emailEl: !!emailEl,
      phoneEl: !!phoneEl
    });

    // Fill basic info (do not overwrite existing values)
    setIfEmpty(firstNameEl, draft.first_name);
    setIfEmpty(lastNameEl, draft.last_name);
    setIfEmpty(companyEl, draft.company_name);

    // Auto-fill phone fields
    // Reservation/Billing "phone" should be treated as CELL and go into Cellular Phone 1.
    // Do not auto-fill Office Phone from the draft.
    const draftCell = draft.cell_phone || draft.phone;
    setIfEmpty(cellPhone1El, draftCell);
    setIfEmpty(cellularPhone1El, draftCell);

    // If Office Phone is empty, keep it empty (never fill from draft)
    if (phoneEl && !(phoneEl.value ?? '').toString().trim()) {
      // no-op
    }

    // Auto-fill email fields
    setIfEmpty(emailEl, draft.email);

    // Also fill the Contact Info email section (if it exists)
    const acctEmailContactEl = document.getElementById('acctEmail');
    setIfEmpty(acctEmailContactEl, draft.email);

    // Prefill account type tickers
    const types = draft.types || {};
    const billingTicker = document.getElementById('acctTypeBilling');
    const passengerTicker = document.getElementById('acctTypePassenger');
    const bookingTicker = document.getElementById('acctTypeBooking');

    console.log('🎯 Setting account type checkboxes:', types);
    if (billingTicker && types.billing) {
      billingTicker.checked = true;
      console.log('✅ Set billing checkbox');
    }
    if (passengerTicker && types.passenger) {
      passengerTicker.checked = true;
      console.log('✅ Set passenger checkbox');
    }
    if (bookingTicker && types.booking) {
      bookingTicker.checked = true;
      console.log('✅ Set booking checkbox');
    }

    // Prefill address tab fields if present
    const addr = draft.address || {};
    const addressTypeEl = document.getElementById('addressType');
    const addressNameEl = document.getElementById('addressName');
    const primaryAddressEl = document.getElementById('primaryAddress');
    const addressCityEl = document.getElementById('addressCity');
    const addressStateEl = document.getElementById('addressState');
    const addressZipEl = document.getElementById('addressZip');
    const addressAptEl = document.getElementById('addressApt');
    const addressCountryEl = document.getElementById('addressCountry');

    console.log('🏠 Filling address fields:', addr);
    if (addr && typeof addr === 'object') {
      // For selects, only set if empty/current default
      if (addressTypeEl && (addressTypeEl.value ?? '').toString().trim() === '') {
        addressTypeEl.value = addr.address_type || addressTypeEl.value;
      }
      setIfEmpty(addressNameEl, addr.address_name);
      setIfEmpty(primaryAddressEl, addr.address_line1);
      setIfEmpty(addressAptEl, addr.address_line2);
      setIfEmpty(addressCityEl, addr.city);
      if (addressStateEl && (addressStateEl.value ?? '').toString().trim() === '') {
        addressStateEl.value = addr.state || addressStateEl.value;
      }
      setIfEmpty(addressZipEl, addr.zip);
      if (addressCountryEl && (addressCountryEl.value ?? '').toString().trim() === '') {
        addressCountryEl.value = addr.country || addressCountryEl.value;
      }
    }

    // Clear the draft so it doesn't keep refilling
    localStorage.removeItem('relia_account_draft');
    console.log('✅ Draft applied and cleared');

    // Focus first name field for immediate entry
    if (firstNameEl) {
      setTimeout(() => {
        firstNameEl.focus();
        console.log('🎯 Focused on first name field');
      }, 100);
    }
  }

  setupEventListeners() {
    console.log('🔧 Setting up Accounts event listeners...');
    
    // Save Account button
    const saveAccountBtn = document.getElementById('saveAccountBtn');
    if (saveAccountBtn) {
      saveAccountBtn.addEventListener('click', () => {
        console.log('💾 Save Account button clicked');
        this.saveAccount();
      });
      console.log('✅ Save Account button listener attached');
    } else {
      console.warn('⚠️ saveAccountBtn not found');
    }

    // New Account button (next to SAVE)
    const newAccountBtn = document.getElementById('newAccountBtn');
    if (newAccountBtn) {
      newAccountBtn.addEventListener('click', () => {
        console.log('🆕 New Account button clicked');
        this.addNewAccount();
      });
      console.log('✅ New Account button listener attached');
    }

    // Clear Account form button (next to SAVE)
    const clearAccountFormBtn = document.getElementById('clearAccountFormBtn');
    if (clearAccountFormBtn) {
      clearAccountFormBtn.addEventListener('click', () => {
        console.log('🧹 Clear Account form button clicked');
        this.addNewAccount();
      });
      console.log('✅ Clear Account form button listener attached');
    }
    
    // Verify Address button
    const verifyAddressBtn = document.getElementById('verifyAddressBtn');
    if (verifyAddressBtn) {
      verifyAddressBtn.addEventListener('click', () => {
        console.log('🔍 Verify Address button clicked');
        this.verifyAddress();
      });
      console.log('✅ Verify Address button listener attached');
    }
    
    // Main navigation buttons
    wireMainNav();

    // Sidebar buttons: Delete / Reservation / Edit
    const sidebarButtons = document.querySelectorAll('.sidebar-buttons button');
    sidebarButtons.forEach((btn) => {
      const label = (btn.textContent || '').trim().toLowerCase();
      if (label === 'delete') {
        btn.addEventListener('click', () => this.deleteSelectedAccount());
      }
    });

    // Window tabs (Companies, Accounts, Export Customers, Email Lists)
    document.querySelectorAll('.window-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const tabName = e.target.dataset.tab;
        this.switchTab(tabName);
      });
    });

    // View buttons
    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = e.target.dataset.action;
        
        if (action === 'user-view') {
          window.location.href = 'index.html?view=user';
        } else if (action === 'driver-view') {
          window.location.href = 'index.html?view=driver';
        } else if (action === 'reservations') {
          window.location.href = 'reservations-list.html';
        } else if (action === 'farm-out') {
          window.location.href = 'reservations-list.html?filter=farm-out';
        } else if (action === 'new-reservation') {
          window.location.href = 'reservation-form.html';
        }
      });
    });

    // Add Company button
    const addCompanyBtn = document.getElementById('addCompanyBtn');
    if (addCompanyBtn) {
      addCompanyBtn.addEventListener('click', () => {
        this.addCompany();
      });
    }

    // Edit Company button
    const editCompanyBtn = document.getElementById('editCompanyBtn');
    if (editCompanyBtn) {
      editCompanyBtn.addEventListener('click', () => {
        this.editCompany();
      });
    }

    // Create New Account button (prominent sidebar button)
    const createNewAccountBtn = document.getElementById('createNewAccountBtn');
    if (createNewAccountBtn) {
      createNewAccountBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.addNewAccount();
      });
      console.log('✅ Create New Account button listener attached');
    }

    // Add New Account link (legacy support)
    const addNewAccountLink = document.querySelector('.link-add');
    if (addNewAccountLink) {
      addNewAccountLink.addEventListener('click', (e) => {
        e.preventDefault();
        this.addNewAccount();
      });
      console.log('✅ Add New Account link listener attached');
    }

    // Accounts listbox selection
    const accountsListbox = document.getElementById('accountsListbox');
    if (accountsListbox) {
      accountsListbox.addEventListener('change', (e) => {
        const accountId = e.target.value;
        if (accountId) {
          // Add visual feedback for selection
          const selectedOption = e.target.selectedOptions[0];
          if (selectedOption) {
            // Briefly highlight the selected option
            selectedOption.style.backgroundColor = '#007bff';
            selectedOption.style.color = 'white';
            setTimeout(() => {
              selectedOption.style.backgroundColor = '';
              selectedOption.style.color = '';
            }, 1000);
          }
          
          // Show loading indicator while account loads
          const accountsMain = document.querySelector('.accounts-main');
          if (accountsMain) {
            accountsMain.style.opacity = '0.7';
            accountsMain.style.pointerEvents = 'none';
          }
          
          this.loadAccount(accountId).then(() => {
            // Remove loading state
            if (accountsMain) {
              accountsMain.style.opacity = '';
              accountsMain.style.pointerEvents = '';
            }
          }).catch(error => {
            console.error('❌ Error loading account:', error);
            // Remove loading state even on error
            if (accountsMain) {
              accountsMain.style.opacity = '';
              accountsMain.style.pointerEvents = '';
            }
          });
        }
      });
      console.log('✅ Accounts listbox listener attached');
    }

    // Sidebar search
    const searchInput = document.querySelector('.sidebar-input');
    const searchBtn = document.querySelector('.btn-go');
    if (searchInput && searchBtn) {
      searchBtn.addEventListener('click', () => {
        this.searchAccounts(searchInput.value);
      });
      searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.searchAccounts(searchInput.value);
        }
      });
      console.log('✅ Search listeners attached');
    }

    // Clear search
    const clearSearchBtn = document.getElementById('clearAccountsSearchBtn');
    if (clearSearchBtn) {
      clearSearchBtn.addEventListener('click', () => {
        const input = document.querySelector('.sidebar-input');
        if (input) input.value = '';
        this.searchAccounts('');
      });
    }

    // Companies list selection
    const companiesList = document.getElementById('companiesList');
    if (companiesList) {
      companiesList.addEventListener('dblclick', () => {
        this.editCompany();
      });
    }

    // Account sub-tabs (Account Info / Financial Data / Addresses / Booking / Misc)
    document.querySelectorAll('.account-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const btn = e.target.closest('.account-tab');
        const accountTab = btn?.dataset?.accountTab;
        if (!accountTab) return;
        this.switchAccountTab(accountTab);
      });
    });

    // Financial tab SAVE button (no id in HTML)
    const financialSaveBtn = document.querySelector('#financialDataTab button.btn.btn-primary');
    if (financialSaveBtn && financialSaveBtn.textContent.trim().toUpperCase() === 'SAVE') {
      financialSaveBtn.addEventListener('click', () => this.saveAccount());
    }

    // Addresses tab ADD button
    const addAddressBtn = document.getElementById('addAddressBtn');
    if (addAddressBtn) {
      addAddressBtn.addEventListener('click', () => this.addAddress());
    }

    // Email Lists - Include All Dates checkbox
    const emailIncludeAllDates = document.getElementById('emailIncludeAllDates');
    if (emailIncludeAllDates) {
      emailIncludeAllDates.addEventListener('change', (e) => {
        const dateFrom = document.getElementById('emailDateFrom');
        const dateTo = document.getElementById('emailDateTo');
        if (e.target.checked) {
          dateFrom.value = 'ALL DATES';
          dateTo.value = 'ALL DATES';
          dateFrom.disabled = true;
          dateTo.disabled = true;
        } else {
          dateFrom.value = '';
          dateTo.value = '';
          dateFrom.disabled = false;
          dateTo.disabled = false;
        }
      });
    }

    // Generate Email Export button
    const generateEmailExportBtn = document.getElementById('generateEmailExportBtn');
    if (generateEmailExportBtn) {
      generateEmailExportBtn.addEventListener('click', () => {
        this.generateEmailExport();
      });
    }
    
    // Setup phone and email validation
    this.setupPhoneEmailValidation();
  }
  
  /**
   * Setup phone and email field validation
   */
  setupPhoneEmailValidation() {
    const phoneFieldIds = [
      'acctOfficePhone',
      'acctHomePhone',
      'acctCellularPhone1',
      'acctCellularPhone2',
      'acctCellularPhone3',
      'acctFax1',
      'acctFax2',
      'acctFax3',
      'acctCellPhone1'
    ];
    
    const emailFieldIds = [
      'acctEmail',
      'acctEmail2',
      'acctEmailContact'
    ];
    
    setupPhoneEmailValidation(phoneFieldIds, emailFieldIds);
  }

  switchAccountTab(tabName) {
    // Update account tab active state
    document.querySelectorAll('.account-tab').forEach(tab => {
      tab.classList.remove('active');
      if (tab.dataset.accountTab === tabName) {
        tab.classList.add('active');
      }
    });

    // Hide all account tab contents
    document.querySelectorAll('.account-tab-content').forEach(content => {
      content.classList.remove('active');
      content.style.display = 'none';
    });

    // Show the appropriate content
    if (tabName === 'info') {
      const el = document.getElementById('accountInfoTab');
      if (el) {
        el.classList.add('active');
        el.style.display = '';
      }
    } else if (tabName === 'financial') {
      const el = document.getElementById('financialDataTab');
      if (el) {
        el.classList.add('active');
        el.style.display = '';
      }
    } else if (tabName === 'addresses') {
      const el = document.getElementById('addressesTab');
      if (el) {
        el.classList.add('active');
        el.style.display = '';
      }
      this.loadStoredAddresses();
    } else if (tabName === 'booking') {
      const el = document.getElementById('bookingTab');
      if (el) {
        el.classList.add('active');
        el.style.display = '';
      }
      this.loadBookingContacts();
    } else if (tabName === 'misc') {
      const el = document.getElementById('miscTab');
      if (el) {
        el.classList.add('active');
        el.style.display = '';
      }
      this.loadMiscInfo();
    }
  }
  
  loadStoredAddresses() {
    const accountId = this.getCurrentAccountId();
    const container = document.getElementById('storedAddressesList');
    if (!container) return;

    if (!accountId) {
      container.innerHTML = '<p style="color: #999; text-align: center;">Save the account first to store addresses</p>';
      return;
    }

    const addresses = this.db?.getAccountAddresses(accountId) || [];
    if (!addresses.length) {
      container.innerHTML = '<p style="color: #999; text-align: center;">No stored addresses yet</p>';
      return;
    }

    container.innerHTML = addresses
      .slice()
      .sort((a, b) => (b.last_used_at || '').localeCompare(a.last_used_at || ''))
      .map(a => {
        const line2 = a.address_line2 ? ` ${a.address_line2}` : '';
        const city = a.city ? `, ${a.city}` : '';
        const state = a.state ? `, ${a.state}` : '';
        const zip = a.zip_code ? ` ${a.zip_code}` : '';
        const label = `${a.address_name || a.address_type || 'Address'}: ${a.address_line1 || ''}${line2}${city}${state}${zip}`;
        return `<div style="padding: 6px 8px; border-bottom: 1px solid #eee;">${label}</div>`;
      })
      .join('');
  }

  getCurrentAccountId() {
    const accountNumber = document.getElementById('accountNumber')?.value?.trim();
    if (accountNumber) return accountNumber;
    const selected = document.getElementById('accountsListbox')?.value?.trim();
    return selected || null;
  }

  async addAddress() {
    const accountId = this.getCurrentAccountId();
    if (!accountId) {
      alert('Please SAVE the account first (to get an Account#), then add addresses.');
      return;
    }

    const addressData = {
      address_type: document.getElementById('addressType')?.value?.trim() || 'primary',
      address_name: document.getElementById('addressName')?.value?.trim() || '',
      address_line1: document.getElementById('primaryAddress')?.value?.trim() || '',
      address_line2: document.getElementById('addressApt')?.value?.trim() || '',
      city: document.getElementById('addressCity')?.value?.trim() || '',
      state: document.getElementById('addressState')?.value?.trim() || '',
      zip_code: document.getElementById('addressZip')?.value?.trim() || '',
      country: document.getElementById('addressCountry')?.value?.trim() || 'United States'
    };

    if (!addressData.address_line1) {
      alert('Primary Address is required.');
      return;
    }

    // Check for duplicate address before saving
    const existingAddresses = this.db?.getAccountAddresses(accountId) || [];
    const duplicate = existingAddresses.find(addr => 
      addr.address_line1?.toLowerCase() === addressData.address_line1?.toLowerCase() &&
      addr.city?.toLowerCase() === addressData.city?.toLowerCase() &&
      addr.zip_code === addressData.zip_code
    );

    if (duplicate) {
      const dupLabel = `${duplicate.address_name || duplicate.address_type || 'Address'}: ${duplicate.address_line1}, ${duplicate.city || ''} ${duplicate.zip_code || ''}`;
      const proceed = confirm(`⚠️ Duplicate Address Found!\n\nThis address already exists:\n${dupLabel}\n\nDo you want to update the existing record instead?`);
      if (!proceed) {
        return; // User cancelled
      }
    }

    const saved = await this.db?.saveAccountAddress(accountId, addressData);
    if (!saved) {
      alert('Failed to save address.');
      return;
    }

    // Clear the input fields after successful save
    ['primaryAddress', 'addressApt', 'addressCity', 'addressState', 'addressZip', 'addressName'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const addressTypeEl = document.getElementById('addressType');
    if (addressTypeEl) addressTypeEl.value = 'primary';

    this.loadStoredAddresses();
    
    if (duplicate) {
      alert('✅ Existing address record updated successfully.');
    } else {
      alert('✅ New address saved successfully.');
    }
  }
  
  loadBookingContacts() {
    // TODO: Load booking contacts from db
    console.log('Loading booking contacts...');
  }
  
  loadMiscInfo() {
    console.log('Loading misc info...');
    const accountId = this.getCurrentAccountId();
    
    // Sync name fields from Account Info tab
    const firstName = document.getElementById('acctFirstName')?.value || '';
    const lastName = document.getElementById('acctLastName')?.value || '';
    const accountNumber = document.getElementById('accountNumber')?.value || '';
    
    const miscFirstNameEl = document.getElementById('miscFirstName');
    const miscLastNameEl = document.getElementById('miscLastName');
    const miscAccountNumberEl = document.getElementById('miscAccountNumber');
    
    if (miscFirstNameEl) miscFirstNameEl.value = firstName;
    if (miscLastNameEl) miscLastNameEl.value = lastName;
    if (miscAccountNumberEl) miscAccountNumberEl.value = accountNumber;
    
    // Load email rules from account data or defaults
    this.loadEmailRules(accountId);
    this.loadEmailTemplates();
    
    // Wire up email rules UI
    this.wireEmailRulesUI();
  }
  
  async loadEmailRules(accountId) {
    console.log('📧 Loading email rules for account:', accountId);
    
    // Default values (all enabled)
    const defaultRules = {
      email_rules_enabled: true,
      sms_rules_enabled: false,
      rule_driver_on_the_way: true,
      rule_driver_arrived: true,
      rule_passenger_on_board: true,
      rule_passenger_dropped_off: true,
      rule_driver_info_affiliate: false
    };
    
    // Try to load from Supabase if account exists
    let rules = { ...defaultRules };
    if (accountId && this.db && window.supabase) {
      try {
        const { data, error } = await window.supabase
          .from('account_email_rules')
          .select('*')
          .eq('account_id', accountId)
          .single();
        
        if (data && !error) {
          rules = { ...defaultRules, ...data };
        }
      } catch (e) {
        console.warn('Could not load email rules:', e);
      }
    }
    
    // Populate UI
    const emailRulesEnabledEl = document.getElementById('emailRulesEnabled');
    const smsRulesEnabledEl = document.getElementById('smsRulesEnabled');
    
    if (emailRulesEnabledEl) emailRulesEnabledEl.checked = rules.email_rules_enabled !== false;
    if (smsRulesEnabledEl) smsRulesEnabledEl.checked = rules.sms_rules_enabled === true;
    
    // Driver status rules
    const ruleMapping = {
      'ruleOnTheWay': 'rule_driver_on_the_way',
      'ruleArrived': 'rule_driver_arrived',
      'rulePassengerOnBoard': 'rule_passenger_on_board',
      'rulePassengerDroppedOff': 'rule_passenger_dropped_off',
      'ruleDriverInfoAffiliate': 'rule_driver_info_affiliate'
    };
    
    Object.entries(ruleMapping).forEach(([elId, ruleKey]) => {
      const el = document.getElementById(elId);
      if (el) el.checked = rules[ruleKey] !== false;
    });
    
    this.updateSelectAllState();
  }
  
  async loadEmailTemplates() {
    const selectEl = document.getElementById('scheduledEmailRules');
    if (!selectEl) return;
    
    // Clear and add default option
    selectEl.innerHTML = '<option value="">- - - NOT SELECTED - - -</option>';
    
    if (!window.supabase) {
      console.warn('Supabase not available for loading templates');
      return;
    }
    
    try {
      const { data: templates, error } = await window.supabase
        .from('email_templates')
        .select('id, name, trigger_event')
        .eq('is_active', true)
        .order('name');
      
      if (templates && !error) {
        templates.forEach(t => {
          const option = document.createElement('option');
          option.value = t.id;
          option.textContent = `${t.name} (${t.trigger_event.replace(/_/g, ' ')})`;
          selectEl.appendChild(option);
        });
      }
    } catch (e) {
      console.warn('Could not load email templates:', e);
    }
  }
  
  wireEmailRulesUI() {
    // Select All toggle
    const selectAllEl = document.getElementById('selectAllEmailRules');
    if (selectAllEl) {
      selectAllEl.addEventListener('change', (e) => {
        const checked = e.target.checked;
        document.querySelectorAll('.email-rule-toggle').forEach(cb => {
          cb.checked = checked;
        });
      });
    }
    
    // Individual rule toggles update Select All state
    document.querySelectorAll('.email-rule-toggle').forEach(cb => {
      cb.addEventListener('change', () => this.updateSelectAllState());
    });
    
    // Save Email Rules button
    const saveEmailRulesBtn = document.getElementById('saveEmailRulesBtn');
    if (saveEmailRulesBtn) {
      saveEmailRulesBtn.addEventListener('click', () => this.saveEmailRules());
    }
    
    // Save Partner Prefs button
    const savePartnerPrefsBtn = document.getElementById('savePartnerPrefsBtn');
    if (savePartnerPrefsBtn) {
      savePartnerPrefsBtn.addEventListener('click', () => this.savePartnerPreferences());
    }
  }
  
  updateSelectAllState() {
    const allToggles = document.querySelectorAll('.email-rule-toggle');
    const checkedCount = Array.from(allToggles).filter(cb => cb.checked).length;
    const selectAllEl = document.getElementById('selectAllEmailRules');
    
    if (selectAllEl) {
      selectAllEl.checked = checkedCount === allToggles.length;
      selectAllEl.indeterminate = checkedCount > 0 && checkedCount < allToggles.length;
    }
  }
  
  async saveEmailRules() {
    const accountId = this.getCurrentAccountId();
    const accountUUID = document.getElementById('accountUUID')?.value?.trim();
    
    if (!accountUUID) {
      alert('Please save the account first before setting email rules.');
      return;
    }
    
    const rules = {
      account_id: accountUUID,
      organization_id: window.ENV?.ORGANIZATION_ID || localStorage.getItem('relia_organization_id') || null,
      rule_driver_on_the_way: document.getElementById('ruleOnTheWay')?.checked ?? true,
      rule_driver_arrived: document.getElementById('ruleArrived')?.checked ?? true,
      rule_passenger_on_board: document.getElementById('rulePassengerOnBoard')?.checked ?? true,
      rule_passenger_dropped_off: document.getElementById('rulePassengerDroppedOff')?.checked ?? true,
      rule_driver_info_affiliate: document.getElementById('ruleDriverInfoAffiliate')?.checked ?? false,
      all_rules_enabled: document.getElementById('emailRulesEnabled')?.checked ?? true,
      prefer_email: document.getElementById('emailRulesEnabled')?.checked ?? true,
      prefer_sms: document.getElementById('smsRulesEnabled')?.checked ?? false,
      updated_at: new Date().toISOString()
    };
    
    console.log('💾 Saving email rules:', rules);
    
    if (!window.supabase) {
      alert('Database not available. Settings saved locally.');
      localStorage.setItem(`email_rules_${accountId}`, JSON.stringify(rules));
      return;
    }
    
    try {
      const { data, error } = await window.supabase
        .from('account_email_rules')
        .upsert(rules, { onConflict: 'account_id' });
      
      if (error) throw error;
      
      // Also update the main accounts table flags
      await window.supabase
        .from('accounts')
        .update({
          email_rules_enabled: rules.all_rules_enabled,
          sms_rules_enabled: rules.prefer_sms
        })
        .eq('id', accountUUID);
      
      alert('✅ Email rules saved successfully!');
    } catch (e) {
      console.error('Error saving email rules:', e);
      alert('Error saving email rules: ' + e.message);
    }
  }
  
  async savePartnerPreferences() {
    const accountUUID = document.getElementById('accountUUID')?.value?.trim();
    
    if (!accountUUID) {
      alert('Please save the account first.');
      return;
    }
    
    const prefs = {
      groundxchange_id: document.getElementById('groundXchangeId')?.value?.trim() || null,
      gnet_id: document.getElementById('gnetId')?.value?.trim() || null
    };
    
    console.log('💾 Saving partner preferences:', prefs);
    
    if (!window.supabase) {
      alert('Database not available.');
      return;
    }
    
    try {
      const { error } = await window.supabase
        .from('accounts')
        .update(prefs)
        .eq('id', accountUUID);
      
      if (error) throw error;
      alert('✅ Partner preferences saved!');
    } catch (e) {
      console.error('Error saving partner prefs:', e);
      alert('Error: ' + e.message);
    }
  }

  addNewAccount() {
    console.log('🆕 Add New Account / Clear Form');
    
    // Clear all basic form fields
    const textFields = [
      'acctFirstName', 'acctLastName', 'acctCompany', 'acctDepartment', 'acctJobTitle',
      'acctCellPhone1', 'acctCellularPhone1', 'acctEmail2',
      // Phone fields
      'acctOfficePhone', 'acctOfficePhoneExt', 'acctHomePhone', 'acctHomePhoneExt',
      'acctCellularPhone2', 'acctCellularPhone3', 'acctFax1', 'acctFax2', 'acctFax3',
      // Address fields
      'acctAddress1', 'acctAddress2', 'acctCity', 'acctZip',
      // Notes fields
      'acctInternalNotes', 'acctTripNotes', 'acctNotesOthers'
    ];
    
    textFields.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    
    // Reset dropdowns to defaults
    const selectDefaults = {
      'acctState': '',
      'acctCountry': 'US',
      'acctSource': '',
      'acctRentalAgreement': '',
      'acctSettings': 'normal',
      'acctStatus': 'active',
      'acctWebAccess': 'allow',
      'acctProviderType': ''
    };
    
    Object.entries(selectDefaults).forEach(([id, defaultVal]) => {
      const el = document.getElementById(id);
      if (el) el.value = defaultVal;
    });
    
    // Hide provider type section on new accounts
    const providerTypeSectionEl = document.getElementById('providerTypeSection');
    if (providerTypeSectionEl) providerTypeSectionEl.style.display = 'none';

    // Apply local region defaults after clearing
    this.applyLocalRegionDefaults();
    
    // Reset checkboxes
    const checkboxDefaults = {
      'acctTypeBilling': false,
      'acctTypePassenger': false,
      'acctTypeBooking': false,
      // Email preferences default to true
      'emailPrefAll': true,
      'emailPrefConfirmation': true,
      'emailPrefPaymentReceipt': true,
      'emailPrefInvoice': true,
      'emailPrefOther': true
    };
    
    Object.entries(checkboxDefaults).forEach(([id, defaultVal]) => {
      const el = document.getElementById(id);
      if (el) el.checked = defaultVal;
    });
    
    // Clear multi-selects
    this.setMultiSelectValues('acctRestrictedDrivers', []);
    this.setMultiSelectValues('acctRestrictedCars', []);
    
    // Clear account number (will be assigned on save)
    const accountNumberEl = document.getElementById('accountNumber');
    if (accountNumberEl) {
      accountNumberEl.value = '';
      accountNumberEl.placeholder = 'Will be assigned on save';
      accountNumberEl.setAttribute('readonly', true);
      accountNumberEl.style.backgroundColor = '#f5f5f5';
    }
    
    // Clear UUID field (new accounts should have no UUID)
    const accountUUIDEl = document.getElementById('accountUUID');
    if (accountUUIDEl) {
      accountUUIDEl.value = '';
    }
    
    // Clear misc account number too
    const miscAccountNumberEl = document.getElementById('miscAccountNumber');
    if (miscAccountNumberEl) {
      miscAccountNumberEl.value = '';
      miscAccountNumberEl.placeholder = 'Will be assigned on save';
    }
    
    // Switch to Account Info tab
    this.switchAccountTab('info');

    // Prefill with the next available account number so the user sees it immediately
    this.prefillNextAccountNumber();
    
    // Focus first name field
    setTimeout(() => {
      document.getElementById('acctFirstName')?.focus();
    }, 100);
    
    console.log('✅ New account form ready - account number will be assigned on save');
  }

  async prefillNextAccountNumber() {
    const accountNumberEl = document.getElementById('accountNumber');
    const miscAccountNumberEl = document.getElementById('miscAccountNumber');
    if (!accountNumberEl) return;

    accountNumberEl.value = '';
    accountNumberEl.placeholder = 'Fetching next account number...';

    try {
      if (window.SUPABASE_POLICY_ERROR) {
        console.warn('⚠️ SUPABASE_POLICY_ERROR set; skipping next account number fetch');
        accountNumberEl.placeholder = 'Will be assigned on save';
        return;
      }

      const nextNum = await this.db?.getNextAccountNumber?.();
      if (!nextNum) throw new Error('No next account number returned');

      const numStr = nextNum.toString();
      accountNumberEl.value = numStr;
      accountNumberEl.placeholder = '';
      accountNumberEl.setAttribute('readonly', true);
      accountNumberEl.style.backgroundColor = '#f5f5f5';

      if (miscAccountNumberEl) {
        miscAccountNumberEl.value = numStr;
        miscAccountNumberEl.placeholder = '';
      }
    } catch (e) {
      console.warn('⚠️ Failed to prefill next account number:', e);
      accountNumberEl.placeholder = 'Will be assigned on save';
    }
  }

  searchAccounts(query) {
    if (!query || !query.trim()) {
      // Show all accounts if no query
      this.loadAccountsList();
      return;
    }
    
    const searchTerm = query.toLowerCase().trim();
    
    // Require at least 3 characters before searching
    if (searchTerm.length < 3) {
      console.log('🔍 Search requires at least 3 characters');
      return;
    }
    
    console.log('🔍 Searching accounts for:', searchTerm);
    
    // Get all accounts
    const allAccounts = this.db?.getAllAccounts() || [];
    
    // Search across ALL fields - only match if first 3 letters match
    const filtered = allAccounts.filter(acc => {
      // Check each field for a match starting with the search term
      const fieldsToSearch = [
        acc.account_number,
        acc.first_name,
        acc.last_name,
        acc.company_name,
        acc.email,
        acc.phone,
        acc.cell_phone
      ].filter(Boolean);
      
      // Match if any field STARTS WITH the search term (first 3+ chars)
      return fieldsToSearch.some(field => 
        field.toLowerCase().startsWith(searchTerm)
      );
    });
    
    // Update listbox
    const listbox = document.getElementById('accountsListbox');
    if (listbox && filtered.length > 0) {
      listbox.innerHTML = filtered.map(acc => {
        const inactiveLabel = (acc.status || '').toString().toLowerCase() === 'inactive' ? ' (INACTIVE)' : '';
        const displayName = `${acc.account_number || acc.id}${inactiveLabel} - ${acc.first_name || ''} ${acc.last_name || ''} ${acc.company_name ? '- ' + acc.company_name : ''}`.trim();
        return `<option value="${acc.account_number || acc.id}">${displayName}</option>`;
      }).join('');
    } else if (listbox) {
      listbox.innerHTML = '<option value="">-- No matches found --</option>';
    }
    
    console.log(`✅ Found ${filtered.length} matching accounts`);
  }

  navigateToSection(section) {
    navigateToSection(section);
  }

  switchTab(tabName) {
    // Update tab active state
    document.querySelectorAll('.window-tab').forEach(tab => {
      tab.classList.remove('active');
      if (tab.dataset.tab === tabName) {
        tab.classList.add('active');
      }
    });

    // Hide all sections
    document.querySelectorAll('.accounts-section').forEach(section => {
      section.classList.remove('active');
      section.style.display = 'none';
    });

    // Show the appropriate section
    let sectionId = '';
    if (tabName === 'companies') {
      sectionId = 'companies-tab';
    } else if (tabName === 'accounts') {
      sectionId = 'accounts-tab';
    } else if (tabName === 'export-customers') {
      sectionId = 'export-customers-tab';
    } else if (tabName === 'email-lists') {
      sectionId = 'email-lists-tab';
    }

    const sectionElement = document.getElementById(sectionId);
    if (sectionElement) {
      sectionElement.classList.add('active');
      sectionElement.style.display = 'block';
    }

    this.currentTab = tabName;
  }

  addCompany() {
    // Get form values
    const companyNameInput = document.querySelector('.company-form-panel input[type="text"]');
    const companyName = companyNameInput ? companyNameInput.value.trim() : '';

    if (!companyName) {
      alert('Please enter a company name');
      return;
    }

    // In a real application, this would send data to the server
    console.log('Adding company:', companyName);
    
    // Add to list
    const companiesList = document.getElementById('companiesList');
    if (companiesList) {
      const option = document.createElement('option');
      option.value = Date.now().toString();
      option.textContent = companyName;
      companiesList.appendChild(option);
      
      // Select the new option
      option.selected = true;
    }

    // Clear form
    if (companyNameInput) {
      companyNameInput.value = '';
    }

    alert('Company added successfully!');
  }

  editCompany() {
    const companiesList = document.getElementById('companiesList');
    if (!companiesList) return;

    const selectedOption = companiesList.options[companiesList.selectedIndex];
    if (!selectedOption) {
      alert('Please select a company to edit');
      return;
    }

    const companyName = selectedOption.textContent;
    alert(`Edit company: ${companyName}\n\nFull company editing form will be available here.`);
  }

  async saveAccount() {
    console.log('💾 saveAccount() called');
    
    try {
      // Auto-fill: Email → Account Emails
      const email = document.getElementById('acctEmail2')?.value?.trim();

      // Use Contact Info "Cellular Phone 1" if present; otherwise use the top-left cell field
      const cellPhone =
        document.getElementById('acctCellularPhone1')?.value?.trim() ||
        document.getElementById('acctCellPhone1')?.value?.trim() ||
        '';

      // Keep the two cell fields in sync (best-effort)
      const topCellEl = document.getElementById('acctCellPhone1');
      const contactCellEl = document.getElementById('acctCellularPhone1');
      if (cellPhone) {
        if (topCellEl && !topCellEl.value) topCellEl.value = cellPhone;
        if (contactCellEl && !contactCellEl.value) contactCellEl.value = cellPhone;
      }
      
      // Auto-fill contact info email if empty
      const acctEmailContactEl = document.getElementById('acctEmail');
      if (acctEmailContactEl && email && !acctEmailContactEl.value) {
        acctEmailContactEl.value = email;
      }
      
      // Get account number (readonly field) or assign new one
      let accountNumber = document.getElementById('accountNumber')?.value?.trim();
      const isNewAccount = !accountNumber;
      
      // If no account number, this is a NEW account - assign next number
      if (isNewAccount) {
        accountNumber = (await this.db.getNextAccountNumber()).toString();
        console.log('🆕 New account - assigning account number:', accountNumber);
        
        // Update the form with the new account number
        const accountNumberEl = document.getElementById('accountNumber');
        if (accountNumberEl) {
          accountNumberEl.value = accountNumber;
          accountNumberEl.style.backgroundColor = '#f5f5f5';
        }
        
        // Update misc account number too
        const miscAccountNumberEl = document.getElementById('miscAccountNumber');
        if (miscAccountNumberEl) {
          miscAccountNumberEl.value = accountNumber;
        }
        
        // Note: Counter is incremented in supabase-db.js saveAccount() on success
      }
      
      // Get the UUID for existing accounts (for updates)
      // New accounts should NOT have an 'id' - Supabase will auto-generate UUID
      const existingUUID = document.getElementById('accountUUID')?.value?.trim();
      
      // Get organization_id for multi-tenant support
      const organizationId = window.ENV?.ORGANIZATION_ID || localStorage.getItem('relia_organization_id') || null;
      
      // Collect form data with proper field mappings
      const accountData = {
        account_number: accountNumber,
        organization_id: organizationId,
        first_name: document.getElementById('acctFirstName')?.value?.trim() || '',
        last_name: document.getElementById('acctLastName')?.value?.trim() || '',
        company_name: document.getElementById('acctCompany')?.value?.trim() || '',
        department: document.getElementById('acctDepartment')?.value?.trim() || '',
        job_title: document.getElementById('acctJobTitle')?.value?.trim() || '',
        
        // Phone numbers
        office_phone: document.getElementById('acctOfficePhone')?.value?.trim() || '',
        office_phone_ext: document.getElementById('acctOfficePhoneExt')?.value?.trim() || '',
        home_phone: document.getElementById('acctHomePhone')?.value?.trim() || '',
        home_phone_ext: document.getElementById('acctHomePhoneExt')?.value?.trim() || '',
        cell_phone: cellPhone, // Cellular Phone 1
        cell_phone_2: document.getElementById('acctCellularPhone2')?.value?.trim() || '',
        cell_phone_3: document.getElementById('acctCellularPhone3')?.value?.trim() || '',
        fax_1: document.getElementById('acctFax1')?.value?.trim() || '',
        fax_2: document.getElementById('acctFax2')?.value?.trim() || '',
        fax_3: document.getElementById('acctFax3')?.value?.trim() || '',
        
        // Legacy phone field (for backwards compatibility)
        phone: document.getElementById('acctOfficePhone')?.value?.trim() || '',
        
        email: document.getElementById('acctEmail2')?.value?.trim() || '', // Accounts Email
        
        // Email preferences (all default to true)
        email_pref_all: document.getElementById('emailPrefAll')?.checked ?? true,
        email_pref_confirmation: document.getElementById('emailPrefConfirmation')?.checked ?? true,
        email_pref_payment_receipt: document.getElementById('emailPrefPaymentReceipt')?.checked ?? true,
        email_pref_invoice: document.getElementById('emailPrefInvoice')?.checked ?? true,
        email_pref_other: document.getElementById('emailPrefOther')?.checked ?? true,
        
        // Address fields
        address_line1: document.getElementById('acctAddress1')?.value?.trim() || '',
        address_line2: document.getElementById('acctAddress2')?.value?.trim() || '',
        city: document.getElementById('acctCity')?.value?.trim() || '',
        state: document.getElementById('acctState')?.value || '',
        zip: document.getElementById('acctZip')?.value?.trim() || '',
        country: document.getElementById('acctCountry')?.value || 'US',
        
        // Notes fields
        internal_notes: document.getElementById('acctInternalNotes')?.value?.trim() || '',
        trip_notes: document.getElementById('acctTripNotes')?.value?.trim() || '',
        notes_others: document.getElementById('acctNotesOthers')?.value?.trim() || '',
        
        // Restrictions
        restricted_drivers: this.getMultiSelectValues('acctRestrictedDrivers'),
        restricted_cars: this.getMultiSelectValues('acctRestrictedCars'),
        
        // Settings
        source: document.getElementById('acctSource')?.value || '',
        rental_agreement: document.getElementById('acctRentalAgreement')?.value || '',
        account_settings: document.getElementById('acctSettings')?.value || 'normal',
        status: document.getElementById('acctStatus')?.value || 'active',
        web_access: document.getElementById('acctWebAccess')?.value || 'allow',
        
        // Account type checkboxes
        is_billing_client: document.getElementById('acctTypeBilling')?.checked || false,
        is_passenger: document.getElementById('acctTypePassenger')?.checked || false,
        is_booking_contact: document.getElementById('acctTypeBooking')?.checked || false,
        
        // Financial Data tab fields
        post_method: document.getElementById('postMethod')?.value || '',
        post_terms: document.getElementById('postTerms')?.value?.trim() || '',
        primary_agent_id: document.getElementById('primaryAgent')?.value || null,
        secondary_agent_id: document.getElementById('secondaryAgent')?.value || null,
        
        // Credit Card (note: only store last 4 digits in production)
        cc_last_four: (document.getElementById('creditCardNumber')?.value || '').slice(-4) || '',
        cc_exp_month: document.getElementById('expMonth')?.value?.trim() || '',
        cc_exp_year: document.getElementById('expYear')?.value?.trim() || '',
        cc_name_on_card: document.getElementById('nameOnCard')?.value?.trim() || '',
        cc_type: document.getElementById('ccType')?.value || '',
        cc_billing_address: document.getElementById('billingAddressCC')?.value?.trim() || '',
        cc_billing_city: document.getElementById('billingCityCC')?.value?.trim() || '',
        cc_billing_state: document.getElementById('billingStateCC')?.value || '',
        cc_billing_zip: document.getElementById('billingZipCC')?.value?.trim() || '',
        cc_billing_country: document.getElementById('billingCountryCC')?.value || 'United States',
        cc_notes: document.getElementById('creditCardNotes')?.value?.trim() || '',
        
        // Addresses tab - Billing Contact fields
        employee_id: document.getElementById('employeeId')?.value?.trim() || '',
        vip_number: document.getElementById('vipNumber')?.value?.trim() || '',
        my_billing_contact_id: document.getElementById('myBillingContact')?.value || null,
        
        // Misc tab fields
        prefix: document.getElementById('miscPrefix')?.value || '',
        groundxchange_id: document.getElementById('groundXchangeId')?.value?.trim() || '',
        gnet_id: document.getElementById('gnetId')?.value?.trim() || '',
        
        // Email rules toggles
        email_rules_enabled: document.getElementById('emailRulesEnabled')?.checked ?? true,
        sms_rules_enabled: document.getElementById('smsRulesEnabled')?.checked ?? false,
        
        // Provider Type (for admin/driver accounts)
        provider_type: document.getElementById('acctProviderType')?.value || null,
        
        type: 'individual',
        updated_at: new Date().toISOString()
      };
      
      // For existing accounts, set the UUID id for update operation
      // New accounts should NOT have id - Supabase auto-generates UUID
      if (existingUUID) {
        accountData.id = existingUUID;
        console.log('📝 Updating existing account with UUID:', existingUUID);
      } else {
        console.log('🆕 Creating new account (no UUID set)');
      }

      console.log('📝 Account data to save:', accountData);

      // Validate required fields
      if (!accountData.first_name || !accountData.last_name || !accountData.email) {
        alert('First Name, Last Name, and Email are required');
        console.warn('⚠️ Required fields missing');
        return;
      }

      // Use existing db module
      if (!this.db) {
        console.error('❌ Database module not loaded');
        alert('Database module not available. Please refresh the page.');
        return;
      }
      
      console.log('✅ Saving account with Supabase sync...');
      const result = await this.db.saveAccount(accountData);
      
      // Handle duplicate detection
      if (result && result.duplicateDetected) {
        console.warn('⚠️ Duplicate account detected:', result.duplicates);
        
        // Build duplicate info message
        const dupList = result.duplicates.map(d => {
          const name = `${d.first_name || ''} ${d.last_name || ''}`.trim() || d.company_name || 'Unknown';
          const acctNum = d.account_number || d.id || '?';
          return `• ${name} (Acct #${acctNum}) - ${d.matchReason}`;
        }).join('\n');
        
        const confirmCreate = confirm(
          `⚠️ POTENTIAL DUPLICATE DETECTED\n\n` +
          `The following existing account(s) may be duplicates:\n\n${dupList}\n\n` +
          `Do you want to create this account anyway?\n\n` +
          `Click OK to create the account, or Cancel to review existing accounts.`
        );
        
        if (!confirmCreate) {
          console.log('🚫 User cancelled duplicate account creation');
          // Optionally select the first duplicate for review
          if (result.duplicates.length > 0) {
            const firstDup = result.duplicates[0];
            this.selectAccount(firstDup.id || firstDup.account_number);
          }
          return;
        }
        
        // User confirmed - force create
        console.log('✅ User confirmed duplicate creation, forcing save...');
        const forcedResult = await this.db.saveAccount(accountData, { forceCreate: true });
        if (!forcedResult || !forcedResult.success) {
          console.error('❌ Forced saveAccount failed:', forcedResult);
          alert('Error saving account. Please try again.');
          return;
        }
        console.log('✅ Account saved (user override):', forcedResult.account);
      } else if (!result || !result.success) {
        console.error('❌ saveAccount returned error:', result);
        alert(result?.error || 'Error saving account. Please try again.');
        return;
      } else {
        console.log('✅ Account saved successfully:', result.account);
      }
      
      const saved = result?.account || accountData;
      
      // Store the new UUID if we got one back from Supabase (for newly created accounts)
      if (saved.id && !existingUUID) {
        const accountUUIDEl = document.getElementById('accountUUID');
        if (accountUUIDEl) {
          accountUUIDEl.value = saved.id;
          console.log('🔑 Stored new account UUID:', saved.id);
        }
      }

      // ALWAYS notify parent/opener that account was saved (for dynamic data sync)
      const payload = {
        action: 'relia:accountSaved',
        accountId: saved.id || accountNumber,
        accountNumber: accountNumber,
        companyName: accountData.company_name || '',
        accountName: this.getCurrentAccountDisplayName?.() || ''
      };
      
      // Send to parent (when in iframe)
      if (window.parent && window.parent !== window) {
        console.log('📤 Sending accountSaved to parent:', payload);
        window.parent.postMessage(payload, '*');
      }
      
      // Send to opener (when in popup)
      if (window.opener && !window.opener.closed) {
        console.log('📤 Sending accountSaved to opener:', payload);
        window.opener.postMessage(payload, '*');
      }

      // Handle return-to-reservation flow if applicable
      try {
        const params = new URLSearchParams(window.location.search);
        const from = (params.get('from') || '').toLowerCase();

        if (from === 'reservation') {
          if (window.opener && !window.opener.closed) {
            // Close popup if possible
            setTimeout(() => {
              try { window.close(); } catch { /* ignore */ }
            }, 150);
          } else {
            // Fallback: same-window return
            const returnUrl = localStorage.getItem('relia_return_to_reservation_url');
            if (returnUrl) {
              try {
                const u = new URL(returnUrl, window.location.origin);
                u.searchParams.set('newAccountId', accountNumber);
                localStorage.removeItem('relia_return_to_reservation_url');
                window.location.href = u.toString();
              } catch {
                window.location.href = 'reservation-form.html';
              }
            }
          }
        }
      } catch (e) {
        console.warn('⚠️ Failed to return-to-reservation flow:', e);
      }

      if (isNewAccount) {
        // Reload accounts list first to show new account
        await this.loadAccountsList();
        
        // Select the newly created account in the listbox
        const listbox = document.getElementById('accountsListbox');
        if (listbox && saved.id) {
          listbox.value = saved.id;
          console.log('✅ Selected newly created account in listbox:', saved.id);
        }
        
        // 🎉 Send Welcome Email and SMS to new account
        try {
          if (window.CustomerNotificationService) {
            console.log('📧 Sending welcome notifications to new account...');
            const welcomeResults = await window.CustomerNotificationService.sendAccountWelcome(saved);
            console.log('📬 Welcome notification results:', welcomeResults);
          } else {
            console.warn('⚠️ CustomerNotificationService not loaded, skipping welcome notifications');
          }
        } catch (welcomeError) {
          console.error('❌ Failed to send welcome notifications:', welcomeError);
          // Don't block the save operation if notification fails
        }
        
        // Show success notification
        const btn = document.getElementById('saveAccountBtn');
        if (btn) {
          const originalText = btn.textContent;
          btn.textContent = '✓ Saved!';
          btn.style.background = '#28a745';
          btn.disabled = true;

          setTimeout(() => {
            btn.textContent = originalText;
            btn.style.background = '';
            btn.disabled = false;
          }, 2000);
        }
        
        // Optionally create reservation for new account
        // await this.createReservationForAccount(saved, { redirect: true, notify: true });
        return;
      }

      // Success notification will be shown by supabase-db.js
      // Just update the button UI to show it saved
      const btn = document.getElementById('saveAccountBtn');
      if (btn) {
        const originalText = btn.textContent;
        btn.textContent = '✓ Saved!';
        btn.style.background = '#28a745';
        btn.disabled = true;

        setTimeout(() => {
          btn.textContent = originalText;
          btn.style.background = '';
          btn.disabled = false;
        }, 2000);
      }
      
      // Reload accounts list
      await this.loadAccountsList();
      
      // Re-select the saved account in the listbox
      const listbox = document.getElementById('accountsListbox');
      if (listbox && saved.id) {
        listbox.value = saved.id;
        console.log('✅ Re-selected saved account in listbox:', saved.id);
      }
    } catch (error) {
      console.error('❌ Error saving account:', error);
    }
  }

  async createReservationForAccount(accountData, options = {}) {
    if (!accountData) {
      console.warn('⚠️ No account data provided for reservation creation.');
      return null;
    }

    if (!this.db || typeof this.db.createReservationFromAccount !== 'function') {
      console.warn('⚠️ Reservation helper is unavailable.');
      return null;
    }

    const { redirect = false, notify = false } = options;
    let reservationRecord = null;

    try {
      reservationRecord = await this.db.createReservationFromAccount(accountData);
    } catch (error) {
      console.error('❌ Failed to generate reservation from account:', error);
      return null;
    }

    if (!reservationRecord) {
      console.warn('⚠️ Reservation record could not be created from account data.');
      return null;
    }

    const firstName = accountData.first_name || accountData.firstName || '';
    const lastName = accountData.last_name || accountData.lastName || '';
    const company = accountData.company_name || accountData.company || '';
    const phone = accountData.cell_phone || accountData.cellPhone || accountData.phone || '';
    const email = accountData.email || '';
    const accountId = reservationRecord.billing_account || accountData.account_number || accountData.id || '';

    if (this.api && typeof this.api.createReservation === 'function') {
      try {
        await this.api.createReservation({
          status: reservationRecord.status,
          status_detail_code: reservationRecord.status_detail_code,
          status_detail_label: reservationRecord.status_detail_label,
          status_detail_category: reservationRecord.status_detail_category,
          statusDetail: {
            code: reservationRecord.status_detail_code,
            label: reservationRecord.status_detail_label,
            category: reservationRecord.status_detail_category,
            status: reservationRecord.status
          },
          billingAccount: {
            account: accountId,
            company,
            firstName,
            lastName,
            phone,
            email
          },
          bookedBy: {
            firstName,
            lastName,
            phone,
            email
          },
          passenger: {
            firstName,
            lastName,
            phone,
            email
          },
          routing: {
            stops: [],
            tripNotes: reservationRecord.trip_notes || '',
            billPaxNotes: reservationRecord.bill_pax_notes || '',
            dispatchNotes: reservationRecord.dispatch_notes || ''
          },
          details: {
            efarmStatus: reservationRecord.efarm_status || 'Farm-out Unassigned'
          },
          costs: {
            flat: { qty: '0', rate: '0' },
            hour: { qty: '0', rate: '0' },
            unit: { qty: '0', rate: '0' },
            ot: { qty: '0', rate: '0' },
            stops: { qty: '0', rate: '0' }
          },
          grandTotal: reservationRecord.grand_total || 0
        });
      } catch (error) {
        console.warn('⚠️ Could not sync stub reservation to Supabase:', error);
      }
    }

    if (notify) {
      const confirmationNumber = reservationRecord.confirmation_number || reservationRecord.id || 'new';
      alert(
        `Account saved successfully!\nReservation #${confirmationNumber} created and added to the list.`
      );
    }

    if (redirect) {
      try {
        localStorage.removeItem('relia_reservation_draft');
      } catch {
        // ignore storage errors
      }

      const confirmationNumber = reservationRecord.confirmation_number || reservationRecord.id;
      if (confirmationNumber) {
        window.location.href = `reservations-list.html?openConf=${encodeURIComponent(confirmationNumber)}`;
      } else {
        window.location.href = 'reservations-list.html';
      }
    }

    return reservationRecord;
  }

  generateEmailExport() {
    // Get filter values
    const occasion = document.getElementById('emailOccasion')?.value || 'All';
    const referralSource = document.getElementById('emailReferralSource')?.value || 'All';
    const vehicleType = document.getElementById('emailVehicleType')?.value || 'All';
    const reservationStatus = document.getElementById('emailReservationStatus')?.value || 'All';

    // Get selected fields
    const selectedFields = [];
    if (document.getElementById('emailFieldPassengerName')?.checked) selectedFields.push('Passenger Name');
    if (document.getElementById('emailFieldEmail')?.checked) selectedFields.push('Email');
    if (document.getElementById('emailFieldOccasion')?.checked) selectedFields.push('Occasion');
    if (document.getElementById('emailFieldVehicleType')?.checked) selectedFields.push('Vehicle Type');
    if (document.getElementById('emailFieldReferralSource')?.checked) selectedFields.push('Referral Source');
    if (document.getElementById('emailFieldPrimaryPhone')?.checked) selectedFields.push('Primary Phone Number');
    if (document.getElementById('emailFieldDateOfQuote')?.checked) selectedFields.push('Date of Quote');

    // Get export type
    const exportType = document.querySelector('input[name="emailExportType"]:checked')?.value || 'remove-duplicates';

    // In a real application, this would generate and download the CSV file
    console.log('Generating email export with filters:', {
      occasion,
      referralSource,
      vehicleType,
      reservationStatus,
      selectedFields,
      exportType
    });

    // Show success message (no alert in sandbox)
    console.log('Email export file generated!');
  }
}

// Initialize the app
const app = new Accounts();

// Global helper functions for Account Emails section - Setup event delegation
document.addEventListener('DOMContentLoaded', function() {
  // Add New Email button handler
  document.addEventListener('click', function(e) {
    if (e.target.classList.contains('add-new-email-btn')) {
      e.preventDefault();
      addNewAccountEmail();
    }
  });
  
  // Email type dropdown button handler
  document.addEventListener('click', function(e) {
    if (e.target.closest('.email-type-button')) {
      e.preventDefault();
      const button = e.target.closest('.email-type-button');
      toggleEmailTypeDropdown(button);
    }
  });
  
  // Email type checkbox handler
  document.addEventListener('change', function(e) {
    if (e.target.classList.contains('email-type-option')) {
      if (e.target.value === 'select-all') {
        toggleSelectAll(e.target);
      } else {
        updateSelectedTypes(e.target);
      }
    }
    
    // Email active checkbox handler (for scheduled messaging toggle)
    if (e.target.classList.contains('email-active-checkbox')) {
      toggleScheduledMessagingPlaceholder(e.target);
    }
  });
});

function toggleScheduledMessagingPlaceholder(checkbox) {
  const emailRow = checkbox.closest('.account-email-row');
  const emailInput = emailRow.querySelector('.email-input');
  
  if (emailInput) {
    if (checkbox.checked) {
      emailInput.placeholder = 'Exclude from scheduled messaging';
    } else {
      emailInput.placeholder = 'Include in scheduled messaging';
    }
  }
}

function addNewAccountEmail() {
  const container = document.getElementById('account-emails-container');
  if (!container) return;
  
  // Create new email row
  const newRow = document.createElement('div');
  newRow.className = 'account-email-row';
  newRow.style.cssText = 'display: flex; gap: 10px; align-items: center; margin-bottom: 8px; position: relative;';
  
  newRow.innerHTML = `
    <input type="checkbox" class="email-active-checkbox" style="width: 16px; height: 16px;" />
    <input type="text" class="form-control email-input" placeholder="Include in scheduled messaging" style="flex: 1;" />
    <div class="email-type-selector" style="position: relative; width: 300px;">
      <button type="button" class="form-control email-type-button" style="text-align: left; cursor: pointer; background: white; display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; border: 1px solid #ccc;">
        <span class="selected-types-display">Select email types...</span>
        <span style="color: #999;">▼</span>
      </button>
      <div class="email-type-dropdown-menu" style="display: none; position: absolute; top: 100%; left: 0; right: 0; background: white; border: 1px solid #666; margin-top: 1px; z-index: 1000; box-shadow: 0 2px 6px rgba(0,0,0,0.2);">
        <label style="display: flex; align-items: center; padding: 6px 12px; cursor: pointer; font-size: 12px; border-bottom: 1px solid #e0e0e0;" onmouseover="this.style.background='#e8f4ff'" onmouseout="this.style.background='white'">
          <input type="checkbox" class="email-type-option" value="select-all" style="margin-right: 10px; width: 16px; height: 16px; cursor: pointer;" />
          <span class="checkbox-label">Select All</span>
        </label>
        <label style="display: flex; align-items: center; padding: 6px 12px; cursor: pointer; font-size: 12px; border-bottom: 1px solid #e0e0e0;" onmouseover="this.style.background='#e8f4ff'" onmouseout="this.style.background='white'">
          <input type="checkbox" class="email-type-option" value="confirmation" style="margin-right: 10px; width: 16px; height: 16px; cursor: pointer;" />
          <span class="checkbox-label">Confirmation</span>
        </label>
        <label style="display: flex; align-items: center; padding: 6px 12px; cursor: pointer; font-size: 12px; border-bottom: 1px solid #e0e0e0;" onmouseover="this.style.background='#e8f4ff'" onmouseout="this.style.background='white'">
          <input type="checkbox" class="email-type-option" value="payment-receipt" style="margin-right: 10px; width: 16px; height: 16px; cursor: pointer;" />
          <span class="checkbox-label">Payment Receipt</span>
        </label>
        <label style="display: flex; align-items: center; padding: 6px 12px; cursor: pointer; font-size: 12px; border-bottom: 1px solid #e0e0e0;" onmouseover="this.style.background='#e8f4ff'" onmouseout="this.style.background='white'">
          <input type="checkbox" class="email-type-option" value="invoices" style="margin-right: 10px; width: 16px; height: 16px; cursor: pointer;" />
          <span class="checkbox-label">Invoices</span>
        </label>
        <label style="display: flex; align-items: center; padding: 6px 12px; cursor: pointer; font-size: 12px;" onmouseover="this.style.background='#e8f4ff'" onmouseout="this.style.background='white'">
          <input type="checkbox" class="email-type-option" value="other" style="margin-right: 10px; width: 16px; height: 16px; cursor: pointer;" />
          <span class="checkbox-label">Other</span>
        </label>
      </div>
    </div>
  `;
  
  container.appendChild(newRow);
  
  // Focus on the new email input
  const newEmailInput = newRow.querySelector('.email-input');
  if (newEmailInput) {
    newEmailInput.focus();
  }
}

function toggleEmailTypeDropdown(button) {
  const dropdown = button.nextElementSibling;
  const allDropdowns = document.querySelectorAll('.email-type-dropdown-menu');
  
  // Close all other dropdowns
  allDropdowns.forEach(d => {
    if (d !== dropdown) {
      d.style.display = 'none';
    }
  });
  
  // Toggle current dropdown
  dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
}

function toggleSelectAll(selectAllCheckbox) {
  const dropdown = selectAllCheckbox.closest('.email-type-dropdown-menu');
  const checkboxes = dropdown.querySelectorAll('.email-type-option:not([value="select-all"])');
  
  checkboxes.forEach(checkbox => {
    checkbox.checked = selectAllCheckbox.checked;
  });
  
  updateSelectedTypes(selectAllCheckbox);
}

function updateSelectedTypes(checkbox) {
  const dropdown = checkbox.closest('.email-type-dropdown-menu');
  const button = dropdown.previousElementSibling;
  const display = button.querySelector('.selected-types-display');
  const checkboxes = dropdown.querySelectorAll('.email-type-option:not([value="select-all"])');
  const selectAllCheckbox = dropdown.querySelector('[value="select-all"]');
  
  // Update checkbox labels with checkmarks
  const allOptions = dropdown.querySelectorAll('.email-type-option');
  allOptions.forEach(opt => {
    const label = opt.parentElement.querySelector('.checkbox-label');
    if (label) {
      const text = label.textContent.replace('☑ ', '').replace('☐ ', '');
      if (opt.checked) {
        label.textContent = '☑ ' + text;
        label.style.color = '#2196F3';
        label.style.fontWeight = '500';
      } else {
        label.textContent = text;
        label.style.color = '#333';
        label.style.fontWeight = 'normal';
      }
    }
  });
  
  // Get selected values
  const selected = [];
  const selectedLabels = [];
  checkboxes.forEach(cb => {
    if (cb.checked) {
      const labelText = cb.parentElement.querySelector('.checkbox-label').textContent.replace('☑ ', '').replace('☐ ', '').trim();
      selected.push(cb.value);
      selectedLabels.push(labelText);
    }
  });
  
  // Update select all checkbox state
  const allChecked = Array.from(checkboxes).every(cb => cb.checked);
  if (selectAllCheckbox) {
    selectAllCheckbox.checked = allChecked;
    const selectAllLabel = selectAllCheckbox.parentElement.querySelector('span');
    if (selectAllLabel) {
      if (allChecked) {
        selectAllLabel.textContent = '☑ Select All';
        selectAllLabel.style.color = '#2196F3';
        selectAllLabel.style.fontWeight = '500';
      } else {
        selectAllLabel.textContent = 'Select All';
        selectAllLabel.style.color = '#333';
        selectAllLabel.style.fontWeight = 'normal';
      }
    }
  }
  
  // Update display text
  if (selected.length === 0) {
    display.textContent = 'Select email types...';
  } else if (selected.length === checkboxes.length) {
    display.textContent = 'Confirmation, Payment Receipt, Invoice, Oth...';
  } else {
    const displayText = selectedLabels.join(', ');
    display.textContent = displayText.length > 45 ? displayText.substring(0, 42) + '...' : displayText;
  }
}

// Close dropdowns when clicking outside
document.addEventListener('click', function(event) {
  if (!event.target.closest('.email-type-selector')) {
    document.querySelectorAll('.email-type-dropdown-menu').forEach(dropdown => {
      dropdown.style.display = 'none';
    });
  }
});
