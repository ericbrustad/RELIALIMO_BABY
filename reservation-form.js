import { AccountManager } from './AccountManager.js';
import { CostCalculator } from './CostCalculator.js';
import { MapboxService } from './MapboxService.js';
import { AirlineService } from './AirlineService.js';
import { AffiliateService } from './AffiliateService.js';
import { db } from './assets/db.js';

class ReservationForm {
  constructor() {
    this.accountManager = new AccountManager();
    this.costCalculator = new CostCalculator();
    this.mapboxService = new MapboxService();
    this.airlineService = new AirlineService();
    this.affiliateService = new AffiliateService();
    this.stops = [];
    this.selectedAirline = null;
    this.selectedFlight = null;
    this.selectedAffiliate = null;
    
    this.init();
  }

  init() {
    console.log('🚀 ReservationForm initializing...');
    console.log('✅ this keyword available:', !!this);
    
    try {
      // Check if radio buttons exist
      const radioButtons = document.querySelectorAll('input[name="locationType"]');
      console.log('📻 Found location type radio buttons:', radioButtons.length);
      radioButtons.forEach(rb => {
        console.log('  - Radio button:', rb.id, rb.value);
      });
      
      // Initialize confirmation number
      this.initializeConfirmationNumber();
      console.log('✅ initializeConfirmationNumber complete');
      
      this.setupEventListeners();
      console.log('✅ setupEventListeners complete');
      
      this.initializeCostCalculations();
      console.log('✅ initializeCostCalculations complete');
      
      this.initializeDateTime();
      console.log('✅ initializeDateTime complete');
      
      this.setupTabSwitching();
      console.log('✅ setupTabSwitching complete');
      
      console.log('✅ ReservationForm.init() finished successfully');
    } catch (error) {
      console.error('❌ Error during init:', error);
    }
  }

  initializeConfirmationNumber() {
    const confNumberField = document.getElementById('confNumber');
    if (confNumberField) {
      const nextConfNumber = db.getNextConfirmationNumber();
      confNumberField.value = nextConfNumber;
      confNumberField.setAttribute('readonly', 'true');
      console.log('🔢 Confirmation number set to:', nextConfNumber);
    }
  }

  initializeDateTime() {
    // Set current date and time
    const now = new Date();
    const dateTimeString = now.toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    document.getElementById('resDateTime').value = dateTimeString;
  }

  setupTabSwitching() {
    // Billing tabs
    document.querySelectorAll('.billing-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = tab.getAttribute('data-billing-tab');
        
        document.querySelectorAll('.billing-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.billing-tab-content').forEach(c => c.classList.remove('active'));
        
        tab.classList.add('active');
        
        if (tabName === 'account') {
          document.getElementById('accountTab').classList.add('active');
        } else if (tabName === 'payment') {
          document.getElementById('paymentTab').classList.add('active');
        }
      });
    });

    // Cost tabs
    document.querySelectorAll('.cost-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.cost-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.cost-tab-content').forEach(c => c.classList.remove('active'));
        
        tab.classList.add('active');
        const tabName = tab.dataset.tab;
        document.getElementById(`${tabName}CostTab`).classList.add('active');
      });
    });

    // Assignment tabs
    document.querySelectorAll('.assignment-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.assignment-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.assignment-content').forEach(c => c.classList.remove('active'));
        
        tab.classList.add('active');
        const tabName = tab.dataset.tab;
        document.getElementById(`${tabName}Assignment`).classList.add('active');
      });
    });
  }

  setupEventListeners() {
    console.log('🔧 Setting up event listeners...');
    
    // Back button (removed from UI but keeping check)
    const backBtn = document.getElementById('backBtn');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        window.location.href = 'index.html';
      });
    }

    // Save button - wire both old and new selectors
    const saveBtn = document.querySelector('.btn-save') || document.getElementById('saveBtn');
    if (saveBtn) {
      saveBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.saveReservation();
      });
    }

    // Main navigation buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        // Get the button element (in case emoji was clicked)
        const button = e.target.closest('.nav-btn');
        const section = button.dataset.section;
        
        if (section === 'office') {
          window.location.href = 'my-office.html';
        } else if (section === 'reservations') {
          window.location.href = 'reservations-list.html';
        } else {
          alert(`${section} section coming soon!`);
        }
      });
    });

    // View buttons (window-actions)
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
          window.location.href = 'index.html?view=reservations';
        } else if (action === 'new-reservation') {
          window.location.href = 'reservation-form.html';
        }
      });
    });

    // Safety wrapper for DOM access
    const safeAddListener = (id, event, callback) => {
      const elem = document.getElementById(id);
      if (elem) {
        elem.addEventListener(event, callback);
        console.log(`✅ Listener attached to ${id}`);
      } else {
        console.warn(`⚠️ Element ${id} not found, skipping listener`);
      }
    };
    
    // Copy passenger info button
    safeAddListener('copyPassengerBtn', 'click', () => {
      this.copyPassengerInfo();
    });

    // Create stop button
    safeAddListener('createStopBtn', 'click', () => {
      this.createAddressRow();
    });

    // Location type radio buttons
    const radioButtons = document.querySelectorAll('input[name="locationType"]');
    if (radioButtons && radioButtons.length > 0) {
      radioButtons.forEach(radio => {
        radio.addEventListener('change', (e) => {
          console.log('🔘 Location type changed to:', e.target.value);
          this.handleLocationTypeChange(e.target.value);
        });
      });
    }

    // Account search - Billing Accounts section
    const billingAccountInput = document.getElementById('billingAccountSearch');
    if (billingAccountInput) {
      billingAccountInput.addEventListener('input', (e) => {
        this.searchAccounts(e.target.value);
      });

      // Auto-fill other billing fields when account is selected
      billingAccountInput.addEventListener('blur', () => {
        const suggestions = document.getElementById('accountSuggestions');
        if (suggestions) {
          setTimeout(() => {
            suggestions.classList.remove('active');
          }, 200);
        }
      });
    }

    // Setup address autocomplete for initial stops
    try {
      this.setupAddressAutocomplete();
    } catch (e) {
      console.warn('⚠️ setupAddressAutocomplete failed:', e);
    }

    // Setup location name POI search
    try {
      this.setupLocationNameSearch();
    } catch (e) {
      console.warn('⚠️ setupLocationNameSearch failed:', e);
    }

    // Setup notes tabs
    try {
      this.setupNotesTabs();
    } catch (e) {
      console.warn('⚠️ setupNotesTabs failed:', e);
    }

    // Cost calculation inputs
    try {
      this.setupCostCalculationListeners();
    } catch (e) {
      console.warn('⚠️ setupCostCalculationListeners failed:', e);
    }

    // Add Account button
    const addAccountBtn = document.getElementById('addAccountBtn');
    if (addAccountBtn) {
      addAccountBtn.addEventListener('click', () => {
        this.openAddContactModal();
      });
    }

    // Create Account button
    const createAccountBtn = document.getElementById('createAccountBtn');
    console.log('🔍 Looking for createAccountBtn:', createAccountBtn);
    if (createAccountBtn) {
      createAccountBtn.addEventListener('click', () => {
        console.log('✅ Create Account button clicked!');
        this.createAccountFromBilling();
      });
      console.log('✅ Create Account button listener attached');
    } else {
      console.error('❌ createAccountBtn not found in DOM!');
    }

    // Copy Passenger Info checkbox
    const copyPassengerCheckbox = document.getElementById('copyPassengerInfoCheckbox');
    if (copyPassengerCheckbox) {
      copyPassengerCheckbox.addEventListener('change', () => {
        if (copyPassengerCheckbox.checked) {
          this.copyPassengerToBilling();
        }
      });
    }
    
    // Auto-detect when passenger/booking matches billing
    this.setupMatchDetection();

    // Add Contact Modal
    document.getElementById('closeContactModal').addEventListener('click', () => {
      this.closeAddContactModal();
    });

    document.getElementById('cancelContact').addEventListener('click', () => {
      this.closeAddContactModal();
    });

    document.getElementById('saveContact').addEventListener('click', () => {
      this.saveNewContact();
    });

    // Close modal on outside click
    document.getElementById('addContactModal').addEventListener('click', (e) => {
      if (e.target.id === 'addContactModal') {
        this.closeAddContactModal();
      }
    });

    // Modal close
    document.getElementById('closeModal').addEventListener('click', () => {
      this.closeModal();
    });

    document.getElementById('cancelAccount').addEventListener('click', () => {
      this.closeModal();
    });

    document.getElementById('createAccount').addEventListener('click', () => {
      this.createNewAccount();
    });

    // Close modal on outside click
    document.getElementById('accountModal').addEventListener('click', (e) => {
      if (e.target.id === 'accountModal') {
        this.closeModal();
      }
    });



    // Affiliate search and modal
    this.setupAffiliateSearch();
    
    document.getElementById('openAffiliateListBtn').addEventListener('click', () => {
      this.openAffiliateModal();
    });

    document.getElementById('closeAffiliateModal').addEventListener('click', () => {
      this.closeAffiliateModal();
    });

    document.getElementById('closeAffiliateListBtn').addEventListener('click', () => {
      this.closeAffiliateModal();
    });

    document.getElementById('affiliateModal').addEventListener('click', (e) => {
      if (e.target.id === 'affiliateModal') {
        this.closeAffiliateModal();
      }
    });
  }

  setupAffiliateSearch() {
    const affiliateInput = document.getElementById('affiliate');
    const suggestionsContainer = document.getElementById('affiliateSuggestions');
    let debounceTimer;

    affiliateInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      const query = e.target.value;

      if (query.length < 2) {
        suggestionsContainer.classList.remove('active');
        return;
      }

      debounceTimer = setTimeout(() => {
        const results = this.affiliateService.searchAffiliates(query);
        this.showAffiliateSuggestions(results);
      }, 200);
    });

    affiliateInput.addEventListener('blur', () => {
      setTimeout(() => suggestionsContainer.classList.remove('active'), 200);
    });
  }

  showAffiliateSuggestions(affiliates) {
    const container = document.getElementById('affiliateSuggestions');

    if (!affiliates || affiliates.length === 0) {
      container.classList.remove('active');
      return;
    }

    container.innerHTML = affiliates.map(affiliate => `
      <div class="affiliate-suggestion-item" data-id="${affiliate.id}">
        <span class="affiliate-company">${affiliate.company}</span>
        <span class="affiliate-contact">${affiliate.contact} • ${affiliate.phone}</span>
        <span class="affiliate-location">${affiliate.location}</span>
      </div>
    `).join('');

    container.querySelectorAll('.affiliate-suggestion-item').forEach(item => {
      item.addEventListener('click', () => {
        const affiliateId = parseInt(item.dataset.id);
        const affiliate = this.affiliateService.getAffiliateById(affiliateId);
        this.selectAffiliate(affiliate);
      });
    });

    container.classList.add('active');
  }

  selectAffiliate(affiliate) {
    this.selectedAffiliate = affiliate;
    document.getElementById('affiliate').value = affiliate.company;
    document.getElementById('affiliateSuggestions').classList.remove('active');
    
    // Update eFarm status when affiliate is selected
    this.updateEFarmStatus('PENDING');
  }

  updateEFarmStatus(status) {
    const statusInput = document.getElementById('eFarmStatus');
    statusInput.value = status;
  }

  openAffiliateModal() {
    const modal = document.getElementById('affiliateModal');
    const modalSearchInput = document.getElementById('affiliateModalSearch');
    
    // Populate affiliate list
    this.populateAffiliateList(this.affiliateService.getAllAffiliates());
    
    // Setup search in modal
    modalSearchInput.addEventListener('input', (e) => {
      const query = e.target.value;
      const results = query.length >= 2 
        ? this.affiliateService.searchAffiliates(query)
        : this.affiliateService.getAllAffiliates();
      this.populateAffiliateList(results);
    });
    
    modal.classList.add('active');
  }

  populateAffiliateList(affiliates) {
    const tbody = document.getElementById('affiliateListBody');
    
    if (!affiliates || affiliates.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">No affiliates found</td></tr>';
      return;
    }

    tbody.innerHTML = affiliates.map(affiliate => `
      <tr>
        <td>${affiliate.company}</td>
        <td>${affiliate.contact}</td>
        <td>${affiliate.phone}</td>
        <td>${affiliate.email}</td>
        <td>${affiliate.location}</td>
        <td>
          <button class="btn-select" data-id="${affiliate.id}">Select</button>
        </td>
      </tr>
    `).join('');

    // Add click handlers for select buttons
    tbody.querySelectorAll('.btn-select').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const affiliateId = parseInt(e.target.dataset.id);
        const affiliate = this.affiliateService.getAffiliateById(affiliateId);
        this.selectAffiliate(affiliate);
        this.closeAffiliateModal();
      });
    });
  }

  closeAffiliateModal() {
    document.getElementById('affiliateModal').classList.remove('active');
  }

  handleLocationTypeChange(locationType) {
    console.log('📍 handleLocationTypeChange called with:', locationType);
    
    // Hide all dropdowns
    document.getElementById('storedAddressDropdown').style.display = 'none';
    document.getElementById('airportDropdown').style.display = 'none';
    document.getElementById('fboDropdown').style.display = 'none';

    // Show the selected dropdown
    if (locationType === 'stored') {
      console.log('Showing stored address dropdown');
      document.getElementById('storedAddressDropdown').style.display = 'block';
    } else if (locationType === 'airport') {
      console.log('Showing airport dropdown and setting up autocomplete');
      document.getElementById('airportDropdown').style.display = 'block';
      this.setupAirlineAutocomplete();
    } else if (locationType === 'fbo') {
      console.log('Showing FBO dropdown');
      document.getElementById('fboDropdown').style.display = 'block';
    }
  }

  setupAirlineAutocomplete() {
    const airportSearch = document.getElementById('airportSearch');
    const airportSuggestions = document.getElementById('airportSuggestions');
    const airportSelect = document.getElementById('airportSelect');
    const airlineSection = document.getElementById('airlineSection');
    const airlineSearch = document.getElementById('airlineSearch');
    const airlineSuggestions = document.getElementById('airlineSuggestions');
    const flightNumberInput = document.getElementById('flightNumber');
    const flightSuggestions = document.getElementById('flightSuggestions');

    console.log('✈️ Airport search setup initiated');
    console.log('airportSearch element:', airportSearch);
    console.log('airportSuggestions element:', airportSuggestions);

    // Setup airport search with autocomplete
    if (airportSearch) {
      let airportDebounceTimer;
      
      airportSearch.addEventListener('input', (e) => {
        console.log('🔤 Airport search input:', e.target.value);
        clearTimeout(airportDebounceTimer);
        const query = e.target.value;
        
        if (query.length < 1) {
          airportSuggestions?.classList.remove('active');
          return;
        }
        
        airportDebounceTimer = setTimeout(async () => {
          console.log('🔍 Searching airports for:', query);
          await this.searchAirportsList(query);
        }, 200);
      });

      airportSearch.addEventListener('blur', () => {
        console.log('✈️ Airport search blur');
        setTimeout(() => airportSuggestions?.classList.remove('active'), 200);
      });
      
      console.log('✅ Airport search listeners attached');
    } else {
      console.error('❌ airportSearch element not found!');
    }

    // Show airline section when airport is selected
    airportSelect.addEventListener('change', (e) => {
      if (e.target.value) {
        airlineSection.style.display = 'block';
      } else {
        airlineSection.style.display = 'none';
      }
    });

    // Airline search autocomplete
    let airlineDebounceTimer;
    airlineSearch.addEventListener('input', (e) => {
      clearTimeout(airlineDebounceTimer);
      const query = e.target.value;
      
      if (query.length < 1) {
        airlineSuggestions.classList.remove('active');
        return;
      }
      
      airlineDebounceTimer = setTimeout(() => {
        const results = this.airlineService.searchAirlines(query);
        this.showAirlineSuggestions(results);
      }, 200);
    });

    airlineSearch.addEventListener('blur', () => {
      setTimeout(() => airlineSuggestions.classList.remove('active'), 200);
    });

    // Flight number input
    flightNumberInput.addEventListener('input', async (e) => {
      const flightNum = e.target.value.trim();
      
      if (!this.selectedAirline || !flightNum) {
        flightSuggestions.classList.remove('active');
        return;
      }

      // Auto-search when flight number has 3+ digits
      if (flightNum.length >= 3) {
        await this.searchFlight(this.selectedAirline.code, flightNum);
      }
    });

    flightNumberInput.addEventListener('blur', () => {
      setTimeout(() => flightSuggestions.classList.remove('active'), 200);
    });
  }

  showAirlineSuggestions(airlines) {
    const container = document.getElementById('airlineSuggestions');
    
    if (!airlines || airlines.length === 0) {
      container.classList.remove('active');
      return;
    }

    container.innerHTML = airlines.map(airline => `
      <div class="airline-suggestion-item" data-code="${airline.code}">
        <span class="airline-code">${airline.code}</span>
        <span class="airline-name">${airline.name}</span>
      </div>
    `).join('');

    container.querySelectorAll('.airline-suggestion-item').forEach(item => {
      item.addEventListener('click', () => {
        const code = item.dataset.code;
        const airline = this.airlineService.getAirlineByCode(code);
        this.selectAirline(airline);
        container.classList.remove('active');
      });
    });

    container.classList.add('active');
  }

  async searchAirportsList(query) {
    try {
      console.log('📍 searchAirportsList called with query:', query);
      const { searchAirports } = await import('./api-service.js');
      console.log('✅ searchAirports function imported');
      const airports = await searchAirports(query);
      console.log('✅ Airports found:', airports);
      this.showAirportSuggestions(airports);
    } catch (error) {
      console.error('❌ Airport search error:', error);
      // Show fallback message
      const container = document.getElementById('airportSuggestions');
      if (container) {
        container.innerHTML = '<div class="airport-suggestion-item" style="color: red;">Error searching airports. Please try again.</div>';
        container.classList.add('active');
      }
    }
  }

  showAirportSuggestions(airports) {
    const container = document.getElementById('airportSuggestions');
    
    if (!airports || airports.length === 0) {
      container.classList.remove('active');
      return;
    }

    container.innerHTML = airports.slice(0, 8).map(airport => `
      <div class="airport-suggestion-item" data-code="${airport.code}">
        <span class="airport-code">${airport.code}</span>
        <span class="airport-name">${airport.name}</span>
        <span class="airport-city">${airport.city}, ${airport.state || airport.country}</span>
      </div>
    `).join('');

    container.querySelectorAll('.airport-suggestion-item').forEach(item => {
      item.addEventListener('click', () => {
        const code = item.dataset.code;
        const airportName = item.querySelector('.airport-name').textContent;
        this.selectAirport(code, airportName);
      });
    });

    container.classList.add('active');
  }

  selectAirport(code, name) {
    document.getElementById('airportSearch').value = `${code} - ${name}`;
    document.getElementById('airportSelect').value = code;
    document.getElementById('airportSuggestions').classList.remove('active');
    
    // Show airline section
    document.getElementById('airlineSection').style.display = 'block';
    
    // Focus on airline search
    setTimeout(() => {
      document.getElementById('airlineSearch').focus();
    }, 100);
  }

  selectAirline(airline) {
    this.selectedAirline = airline;
    document.getElementById('airlineSearch').value = `${airline.code} - ${airline.name}`;
    document.getElementById('airlineCode').value = airline.code;
    document.getElementById('airlineName').value = airline.name;
    
    // Focus on flight number input
    document.getElementById('flightNumber').focus();
  }

  async searchFlight(airlineCode, flightNumber) {
    try {
      const flightData = await this.airlineService.searchFlights(airlineCode, flightNumber);
      this.populateFlightData(flightData);
    } catch (error) {
      console.error('Flight search error:', error);
    }
  }

  populateFlightData(flightData) {
    document.getElementById('terminalGate').value = `${flightData.terminal} / ${flightData.gate}`;
    document.getElementById('flightStatus').value = flightData.status.toUpperCase();
    document.getElementById('scheduledArrival').value = flightData.scheduledArrival;
    document.getElementById('estimatedArrival').value = flightData.estimatedArrival;
    document.getElementById('originAirport').value = flightData.origin;

    // Show success indicator
    const indicator = document.getElementById('flightStatusIndicator');
    indicator.style.display = 'flex';
    
    // Add status color
    const statusInput = document.getElementById('flightStatus');
    statusInput.style.color = flightData.status === 'on-time' ? '#155724' : 
                              flightData.status === 'delayed' ? '#856404' : '#721c24';
    statusInput.style.fontWeight = '600';

    setTimeout(() => {
      indicator.style.display = 'none';
    }, 3000);
  }

  async createAddressRow() {
    // Get form values
    const stopType = document.querySelector('input[name="stopType"]:checked').value;
    const locationName = document.getElementById('locationName').value || 'N/A';
    const address1 = document.getElementById('address1').value;
    const address2 = document.getElementById('address2').value;
    const city = document.getElementById('city').value;
    const state = document.getElementById('state').value;
    const zipCode = document.getElementById('zipCode').value;
    const timeIn = document.getElementById('timeIn').value || 'N/A';

    // Validate required fields
    if (!address1 && !locationName) {
      alert('Please enter a location name or address.');
      return;
    }

    // Check if we should verify the address
    if (address1 && address1.length > 3) {
      // Search for similar addresses
      const suggestions = await this.mapboxService.geocodeAddress(address1);
      
      if (suggestions && suggestions.length > 0) {
        // Show confirmation modal
        const confirmed = await this.showAddressConfirmation(suggestions, {
          locationName,
          address1,
          address2,
          city,
          state,
          zipCode,
          timeIn,
          stopType
        });

        if (!confirmed) {
          return; // User cancelled
        }
      }
    }

    // Build full address string
    let fullAddress = address1;
    if (address2) fullAddress += `, ${address2}`;
    if (city) fullAddress += `, ${city}`;
    if (state) fullAddress += ` ${state}`;
    if (zipCode) fullAddress += ` ${zipCode}`;

    // Get table body
    const tableBody = document.getElementById('addressTableBody');
    
    // Remove empty message row if it exists
    const emptyRow = tableBody.querySelector('.empty-row');
    if (emptyRow) {
      emptyRow.remove();
    }

    // Create new row
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><span class="stop-type-badge ${stopType}">${stopType}</span></td>
      <td>${locationName}</td>
      <td>${fullAddress}</td>
      <td>${timeIn}</td>
      <td><button class="btn-remove" onclick="this.closest('tr').remove()">Remove</button></td>
    `;

    tableBody.appendChild(row);

    // Clear form fields
    this.clearAddressForm();

    // Show success feedback
    const createBtn = document.getElementById('createStopBtn');
    const originalText = createBtn.textContent;
    createBtn.textContent = '✓ Added!';
    createBtn.style.background = '#28a745';
    
    setTimeout(() => {
      createBtn.textContent = originalText;
      createBtn.style.background = '';
    }, 1500);
  }

  clearAddressForm() {
    document.getElementById('locationName').value = '';
    document.getElementById('address1').value = '';
    document.getElementById('address2').value = '';
    document.getElementById('city').value = '';
    document.getElementById('state').value = '';
    document.getElementById('zipCode').value = '';
    document.getElementById('locationNotes').value = '';
    document.getElementById('locationPhone').value = '';
    document.getElementById('timeIn').value = '';
    document.querySelector('input[name="stopType"][value="pickup"]').checked = true;
  }

  showAddressConfirmation(suggestions, customData) {
    return new Promise((resolve) => {
      const modal = document.getElementById('addressConfirmModal');
      const listContainer = document.getElementById('addressConfirmList');
      const customPreview = document.getElementById('customAddressPreview');

      // Build custom address preview
      let customText = `${customData.locationName}\n${customData.address1}`;
      if (customData.address2) customText += `, ${customData.address2}`;
      if (customData.city) customText += `\n${customData.city}`;
      if (customData.state) customText += `, ${customData.state}`;
      if (customData.zipCode) customText += ` ${customData.zipCode}`;
      customPreview.textContent = customText;

      // Populate suggestions
      listContainer.innerHTML = suggestions.slice(0, 5).map((suggestion, index) => `
        <label class="address-option-item">
          <input type="radio" name="addressChoice" value="${index}" />
          <div class="address-option-content">
            <strong>${suggestion.name}</strong>
            <div class="address-details">${suggestion.address}</div>
          </div>
        </label>
      `).join('');

      // Show modal
      modal.classList.add('active');

      // Handle confirmation
      const confirmBtn = document.getElementById('confirmAddressSelection');
      const cancelBtn = document.getElementById('cancelAddressConfirm');
      const closeBtn = document.getElementById('closeAddressConfirmModal');

      const handleConfirm = () => {
        const selectedRadio = document.querySelector('input[name="addressChoice"]:checked');
        
        if (selectedRadio.value === 'custom') {
          // Use custom text - do nothing, fields are already set
          cleanup();
          resolve(true);
        } else {
          // Use suggested address
          const suggestionIndex = parseInt(selectedRadio.value);
          const selectedAddress = suggestions[suggestionIndex];
          
          // Update form fields with selected address
          this.selectAddress(document.getElementById('address1'), selectedAddress);
          cleanup();
          resolve(true);
        }
      };

      const handleCancel = () => {
        cleanup();
        resolve(false);
      };

      const cleanup = () => {
        modal.classList.remove('active');
        confirmBtn.removeEventListener('click', handleConfirm);
        cancelBtn.removeEventListener('click', handleCancel);
        closeBtn.removeEventListener('click', handleCancel);
      };

      confirmBtn.addEventListener('click', handleConfirm);
      cancelBtn.addEventListener('click', handleCancel);
      closeBtn.addEventListener('click', handleCancel);
    });
  }

  copyPassengerInfo() {
    // Get passenger information
    const passengerFirstName = document.getElementById('passengerFirstName').value;
    const passengerLastName = document.getElementById('passengerLastName').value;
    const passengerPhone = document.getElementById('passengerPhone').value;
    const passengerEmail = document.getElementById('passengerEmail').value;

    if (!passengerFirstName || !passengerLastName) {
      alert('Please enter passenger name first.');
      return;
    }

    // Copy to Booked By section (not Billing Accounts section)
    document.getElementById('bookedByFirstName').value = passengerFirstName;
    document.getElementById('bookedByLastName').value = passengerLastName;
    document.getElementById('bookedByPhone').value = passengerPhone;
    document.getElementById('bookedByEmail').value = passengerEmail;

    // Visual feedback
    const copyBtn = document.getElementById('copyPassengerBtn');
    const originalText = copyBtn.textContent;
    copyBtn.textContent = '✓ Copied!';
    copyBtn.style.background = '#28a745';
    
    setTimeout(() => {
      copyBtn.textContent = originalText;
      copyBtn.style.background = '';
    }, 2000);
  }

  useExistingAccount(account) {
    // Populate Billing Accounts section with existing account (using db field names)
    document.getElementById('billingAccountSearch').value = `${account.id} - ${account.first_name} ${account.last_name}`;
    document.getElementById('billingCompany').value = account.company_name || '';
    document.getElementById('billingFirstName').value = account.first_name;
    document.getElementById('billingLastName').value = account.last_name;
    document.getElementById('billingPhone').value = account.phone;
    document.getElementById('billingEmail').value = account.email;

    this.closeModal();
  }

  createNewAccount(passengerInfo) {
    // Get data from modal form fields
    const modal = document.getElementById('accountModal');
    const firstName = modal.querySelector('#accountFirstName')?.value?.trim() || '';
    const lastName = modal.querySelector('#accountLastName')?.value?.trim() || '';
    const company = modal.querySelector('#accountCompany')?.value?.trim() || '';
    const phone = modal.querySelector('#accountPhone')?.value?.trim() || '';
    const email = modal.querySelector('#accountEmail')?.value?.trim() || '';

    // Validate required fields
    if (!firstName || !lastName || !email) {
      alert('First Name, Last Name, and Email are required.');
      return;
    }

    // Get next account number using db module
    const nextAccountNumber = db.getNextAccountNumber();
    
    // Prepare account data for db module
    const accountData = {
      id: nextAccountNumber.toString(),
      account_number: nextAccountNumber.toString(),
      first_name: firstName,
      last_name: lastName,
      company_name: company,
      phone: phone,
      email: email,
      type: 'individual',
      status: 'active',
      created_at: new Date().toISOString()
    };

    // Save account using db module
    const saved = db.saveAccount(accountData);
    
    if (!saved) {
      alert('Error saving account. Please try again.');
      return;
    }

    // Increment account number for next account
    db.setNextAccountNumber(nextAccountNumber + 1);

    // Update billing account search field with account number
    const billingAccountSearch = document.getElementById('billingAccountSearch');
    billingAccountSearch.value = nextAccountNumber.toString();
    billingAccountSearch.setAttribute('readonly', true);
    billingAccountSearch.style.backgroundColor = '#f5f5f5';
    billingAccountSearch.style.cursor = 'not-allowed';

    this.closeModal();

    // Show success message and ask if user wants to open account page
    if (confirm(`New account created successfully!\nAccount Number: ${nextAccountNumber}\n\nWould you like to open the account page to add more details?`)) {
      // Store account ID for accounts page to load
      localStorage.setItem('currentAccountId', nextAccountNumber.toString());
      
      // Open accounts page in parent window or new tab
      if (window.parent && window.parent !== window) {
        // If in iframe, tell parent to navigate
        window.parent.postMessage({ action: 'navigate', url: 'accounts.html' }, '*');
      } else {
        // Otherwise open in new tab
        window.open('accounts.html', '_blank');
      }
    }
  }

  closeModal() {
    document.getElementById('accountModal').classList.remove('active');
  }

  // Add Contact Modal Methods
  openAddContactModal() {
    const modal = document.getElementById('addContactModal');
    // Clear form
    document.getElementById('contactCompany').value = '';
    document.getElementById('contactFirstName').value = '';
    document.getElementById('contactLastName').value = '';
    document.getElementById('contactPhone').value = '';
    document.getElementById('contactEmail').value = '';
    document.getElementById('contactAddress').value = '';
    document.getElementById('contactCity').value = '';
    document.getElementById('contactState').value = '';
    document.getElementById('contactZip').value = '';
    document.getElementById('contactCountry').value = 'United States';
    document.getElementById('contactNotes').value = '';
    modal.classList.add('active');
  }

  closeAddContactModal() {
    document.getElementById('addContactModal').classList.remove('active');
  }

  openAddAccountModal() {
    const modal = document.getElementById('accountModal');
    const modalBody = document.getElementById('modalBody');
    
    // Build account form in modal
    modalBody.innerHTML = `
      <div class="form-section">
        <div class="form-row-2">
          <div class="form-group">
            <label>First Name *</label>
            <input type="text" id="accountFirstName" class="form-control" placeholder="First name" required />
          </div>
          <div class="form-group">
            <label>Last Name *</label>
            <input type="text" id="accountLastName" class="form-control" placeholder="Last name" required />
          </div>
        </div>
        
        <div class="form-group">
          <label>Company Name</label>
          <input type="text" id="accountCompany" class="form-control" placeholder="Company name (optional)" />
        </div>
        
        <div class="form-row-2">
          <div class="form-group">
            <label>Phone</label>
            <input type="text" id="accountPhone" class="form-control" placeholder="Phone number" />
          </div>
          <div class="form-group">
            <label>Email *</label>
            <input type="email" id="accountEmail" class="form-control" placeholder="Email address" required />
          </div>
        </div>
      </div>
    `;
    
    modal.classList.add('active');
  }

  saveNewContact() {
    // Validate required fields
    const firstName = document.getElementById('contactFirstName').value.trim();
    const lastName = document.getElementById('contactLastName').value.trim();

    if (!firstName || !lastName) {
      alert('First name and last name are required.');
      return;
    }

    // Build contact data (using db schema field names)
    const contactData = {
      first_name: firstName,
      last_name: lastName,
      company_name: document.getElementById('contactCompany').value.trim(),
      phone: document.getElementById('contactPhone').value.trim(),
      email: document.getElementById('contactEmail').value.trim(),
      address1: document.getElementById('contactAddress').value.trim(),
      city: document.getElementById('contactCity').value.trim(),
      state_prov: document.getElementById('contactState').value.trim(),
      zip_post: document.getElementById('contactZip').value.trim(),
      country: document.getElementById('contactCountry').value.trim(),
      notes_private: document.getElementById('contactNotes').value.trim(),
      type: 'individual',
      status: 'active'
    };

    // Save to db
    try {
      const saved = db.saveAccount(contactData);
      console.log('✅ Contact saved:', saved);

      // Close modal
      this.closeAddContactModal();

      // Auto-populate the account field
      const displayName = `${firstName} ${lastName}${contactData.company_name ? ' - ' + contactData.company_name : ''}`;
      document.getElementById('billingAccountSearch').value = displayName;
      
      // Also populate billing fields
      document.getElementById('billingFirstName').value = firstName;
      document.getElementById('billingLastName').value = lastName;
      document.getElementById('billingCompany').value = contactData.company_name;
      document.getElementById('billingPhone').value = contactData.phone;
      document.getElementById('billingEmail').value = contactData.email;

      // Show success feedback
      alert(`Contact "${firstName} ${lastName}" saved successfully!`);
    } catch (error) {
      console.error('Error saving contact:', error);
      alert('Error saving contact: ' + error.message);
    }
  }

  copyPassengerToBilling() {
    console.log('🚀 copyPassengerToBilling() called');
    
    try {
      // Get passenger data
      const firstName = document.getElementById('passengerFirstName')?.value?.trim() || '';
      const lastName = document.getElementById('passengerLastName')?.value?.trim() || '';
      const phone = document.getElementById('passengerPhone')?.value?.trim() || '';
      const email = document.getElementById('passengerEmail')?.value?.trim() || '';

      console.log('📝 Passenger data:', { firstName, lastName, phone, email });

      if (!firstName && !lastName && !phone && !email) {
        console.warn('⚠️ No passenger data to copy');
        return;
      }

      // Copy passenger → billing fields
      const billingFirstName = document.getElementById('billingFirstName');
      const billingLastName = document.getElementById('billingLastName');
      const billingPhone = document.getElementById('billingPhone');
      const billingEmail = document.getElementById('billingEmail');
      const billingAccountSearch = document.getElementById('billingAccountSearch');

      if (billingFirstName && firstName) billingFirstName.value = firstName;
      if (billingLastName && lastName) billingLastName.value = lastName;
      if (billingPhone && phone) billingPhone.value = phone;
      if (billingEmail && email) billingEmail.value = email;
      if (billingAccountSearch && (firstName || lastName)) {
        billingAccountSearch.value = `${firstName} ${lastName}`.trim();
      }

      console.log('✅ Passenger → Billing fields copied');
    } catch (error) {
      console.error('❌ Error in copyPassengerToBilling:', error);
    }
  }

  setupMatchDetection() {
    // Watch for changes in billing, passenger, and booking fields
    const billingFields = ['billingFirstName', 'billingLastName', 'billingEmail'];
    const passengerFields = ['passengerFirstName', 'passengerLastName', 'passengerEmail'];
    const bookingFields = ['bookedByFirstName', 'bookedByLastName', 'bookedByEmail'];
    
    const checkMatches = () => {
      // Check if passenger matches billing
      const passengerMatches = billingFields.every((field, index) => {
        const billingValue = document.getElementById(field)?.value?.toLowerCase().trim() || '';
        const passengerField = passengerFields[index];
        const passengerValue = document.getElementById(passengerField)?.value?.toLowerCase().trim() || '';
        return billingValue && passengerValue && billingValue === passengerValue;
      });
      
      // Check if booking agent matches billing
      const bookingMatches = billingFields.every((field, index) => {
        const billingValue = document.getElementById(field)?.value?.toLowerCase().trim() || '';
        const bookingField = bookingFields[index];
        const bookingValue = document.getElementById(bookingField)?.value?.toLowerCase().trim() || '';
        return billingValue && bookingValue && billingValue === bookingValue;
      });
      
      // Log matches for debugging
      if (passengerMatches) {
        console.log('✅ Passenger matches billing');
      }
      if (bookingMatches) {
        console.log('✅ Booking agent matches billing');
      }
      
      // Store match status for use during save
      this.passengerMatchesBilling = passengerMatches;
      this.bookingMatchesBilling = bookingMatches;
    };
    
    // Add listeners to all relevant fields
    [...billingFields, ...passengerFields, ...bookingFields].forEach(fieldId => {
      const field = document.getElementById(fieldId);
      if (field) {
        field.addEventListener('blur', checkMatches);
        field.addEventListener('change', checkMatches);
      }
    });
  }

  createAccountFromBilling() {
    console.log('🚀 createAccountFromBilling() called');
    
    try {
      // Get billing data
      const firstName = document.getElementById('billingFirstName')?.value?.trim() || '';
      const lastName = document.getElementById('billingLastName')?.value?.trim() || '';
      const phone = document.getElementById('billingPhone')?.value?.trim() || '';
      const email = document.getElementById('billingEmail')?.value?.trim() || '';
      const company = document.getElementById('billingCompany')?.value?.trim() || '';

      console.log('📝 Billing data:', { firstName, lastName, phone, email, company });

      if (!firstName || !lastName || !email) {
        alert('Please enter First Name, Last Name, and Email in the billing section before creating an account.');
        return;
      }

      // Open the account modal for editing
      this.openAddAccountModal();

      // Pre-fill the modal with billing data
      setTimeout(() => {
        const modal = document.getElementById('accountModal');
        if (modal) {
          const modalFirstName = modal.querySelector('#accountFirstName');
          const modalLastName = modal.querySelector('#accountLastName');
          const modalPhone = modal.querySelector('#accountPhone');
          const modalEmail = modal.querySelector('#accountEmail');
          const modalCompany = modal.querySelector('#accountCompany');

          if (modalFirstName) modalFirstName.value = firstName;
          if (modalLastName) modalLastName.value = lastName;
          if (modalPhone) modalPhone.value = phone;
          if (modalEmail) modalEmail.value = email;
          if (modalCompany) modalCompany.value = company;

          console.log('✅ Account modal pre-filled with billing data');
        }
      }, 100);
    } catch (error) {
      console.error('❌ Error in createAccountFromBilling:', error);
      alert('Error creating account: ' + error.message);
    }
  }

  copyPassengerToBillingAndOpenAccounts() {
    console.log('🚀 copyPassengerToBillingAndOpenAccounts() called');
    
    try {
      // Get passenger data
      const firstName = document.getElementById('passengerFirstName')?.value?.trim() || '';
      const lastName = document.getElementById('passengerLastName')?.value?.trim() || '';
      const phone = document.getElementById('passengerPhone')?.value?.trim() || '';
      const email = document.getElementById('passengerEmail')?.value?.trim() || '';

      console.log('📝 Passenger data:', { firstName, lastName, phone, email });

      if (!firstName || !lastName) {
        console.warn('⚠️ Passenger first and last name required');
        return;
      }

      // Step 1: Copy passenger → billing fields
      const billingFirstName = document.getElementById('billingFirstName');
      const billingLastName = document.getElementById('billingLastName');
      const billingPhone = document.getElementById('billingPhone');
      const billingEmail = document.getElementById('billingEmail');
      const billingAccountSearch = document.getElementById('billingAccountSearch');
      const billingCompany = document.getElementById('billingCompany');

      if (!billingFirstName || !billingLastName) {
        console.error('❌ Billing fields not found in DOM!');
        return;
      }

      billingFirstName.value = firstName;
      billingLastName.value = lastName;
      billingPhone.value = phone;
      billingEmail.value = email;
      billingAccountSearch.value = `${firstName} ${lastName}`;

      console.log('✅ Passenger → Billing fields copied');

      // Step 2: Stash draft account for Accounts page to prefill
      const draft = {
        first_name: firstName,
        last_name: lastName,
        company_name: billingCompany?.value?.trim() || '',
        phone: phone,
        email: email,
        type: 'individual',
        status: 'active'
      };

      localStorage.setItem('relia_account_draft', JSON.stringify(draft));
      console.log('✅ Account draft saved to localStorage:', draft);

      // Step 3: Show success feedback and open Accounts page
      const btn = document.getElementById('copyPassengerToAccountBtn');
      if (btn) {
        const originalText = btn.textContent;
        btn.textContent = '✓ Opening Accounts...';
        btn.style.background = '#28a745';
        btn.style.color = 'white';
        btn.disabled = true;

        // Open Accounts page after brief delay
        setTimeout(() => {
          console.log('🌐 Navigating to accounts.html');
          window.location.href = 'accounts.html?mode=new';
        }, 800);
      }
    } catch (error) {
      console.error('❌ Error in copyPassengerToBillingAndOpenAccounts:', error);
    }
  }

  searchAccounts(query) {
    if (!query || query.length < 2) {
      document.getElementById('accountSuggestions').classList.remove('active');
      return;
    }

    // Search using db instead of accountManager
    const results = db.searchAccounts(query);
    const container = document.getElementById('accountSuggestions');
    
    if (results.length === 0) {
      container.classList.remove('active');
      return;
    }

    container.innerHTML = results.map(account => `
      <div class="suggestion-item" data-account-id="${account.id}">
        ${account.id} - ${account.first_name} ${account.last_name} (${account.company_name || 'Individual'})
      </div>
    `).join('');

    container.classList.add('active');

    // Add click listeners to suggestions
    container.querySelectorAll('.suggestion-item').forEach(item => {
      item.addEventListener('click', () => {
        const accountId = item.dataset.accountId;
        const account = db.getAccountById(accountId);
        if (account) {
          this.useExistingAccount(account);
          container.classList.remove('active');
        }
      });
    });
  }

  setupNotesTabs() {
    const tabs = document.querySelectorAll('.notes-tab');
    const panels = document.querySelectorAll('.notes-panel');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;

        // Remove active class from all tabs and panels
        tabs.forEach(t => t.classList.remove('active'));
        panels.forEach(p => p.classList.remove('active'));

        // Add active class to clicked tab and corresponding panel
        tab.classList.add('active');
        if (tabName === 'trip') {
          document.getElementById('tripNotesPanel').classList.add('active');
        } else if (tabName === 'billpax') {
          document.getElementById('billPaxNotesPanel').classList.add('active');
        }
      });
    });
  }

  setupLocationNameSearch() {
    const locationNameInput = document.getElementById('locationName');
    const suggestionsContainer = document.getElementById('locationNameSuggestions');
    let debounceTimer;

    locationNameInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      const query = e.target.value;

      if (query.length < 3) {
        suggestionsContainer.classList.remove('active');
        return;
      }

      debounceTimer = setTimeout(async () => {
        await this.searchLocationPOI(query);
      }, 300);
    });

    locationNameInput.addEventListener('blur', () => {
      setTimeout(() => suggestionsContainer.classList.remove('active'), 200);
    });
  }

  async searchLocationPOI(query) {
    try {
      const results = await this.mapboxService.searchPOI(query);
      this.showLocationSuggestions(results);
    } catch (error) {
      console.error('POI search error:', error);
    }
  }

  showLocationSuggestions(results) {
    const container = document.getElementById('locationNameSuggestions');

    if (!results || results.length === 0) {
      container.classList.remove('active');
      return;
    }

    container.innerHTML = results.map((result, index) => `
      <div class="location-suggestion-item" data-index="${index}">
        <span class="poi-name">${result.name}</span>
        <span class="poi-address">${result.address}</span>
        ${result.category ? `<span class="poi-category">${result.category}</span>` : ''}
      </div>
    `).join('');

    container.querySelectorAll('.location-suggestion-item').forEach((item, index) => {
      item.addEventListener('click', () => {
        this.selectLocationPOI(results[index]);
      });
    });

    container.classList.add('active');
  }

  selectLocationPOI(poiData) {
    // Fill location name
    document.getElementById('locationName').value = poiData.name;
    
    // Auto-fill address fields
    document.getElementById('address1').value = poiData.address;
    
    if (poiData.context) {
      if (poiData.context.city) {
        document.getElementById('city').value = poiData.context.city;
      }
      if (poiData.context.state) {
        const stateInput = document.getElementById('state');
        const stateOptions = stateInput.querySelectorAll('option');
        stateOptions.forEach(option => {
          if (option.value === poiData.context.state || option.text === poiData.context.state) {
            stateInput.value = option.value;
          }
        });
      }
      if (poiData.context.zipcode) {
        document.getElementById('zipCode').value = poiData.context.zipcode;
      }
    }

    document.getElementById('locationNameSuggestions').classList.remove('active');
  }

  setupAddressAutocomplete() {
    const addressInputs = document.querySelectorAll('.address-input');
    
    addressInputs.forEach(input => {
      let debounceTimer;
      
      input.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        const query = e.target.value;
        
        if (query.length < 3) {
          this.hideAddressSuggestions(input);
          return;
        }
        
        debounceTimer = setTimeout(async () => {
          await this.searchAddress(input, query);
        }, 300);
      });

      input.addEventListener('blur', () => {
        setTimeout(() => this.hideAddressSuggestions(input), 200);
      });
    });
  }

  async searchAddress(inputElement, query) {
    try {
      const results = await this.mapboxService.geocodeAddress(query);
      this.showAddressSuggestions(inputElement, results);
    } catch (error) {
      console.error('Address search error:', error);
    }
  }

  showAddressSuggestions(inputElement, results) {
    const suggestionsContainer = inputElement.parentElement.querySelector('.address-suggestions');
    
    if (!results || results.length === 0) {
      this.hideAddressSuggestions(inputElement);
      return;
    }

    suggestionsContainer.innerHTML = results.map((result, index) => `
      <div class="address-suggestion-item" data-index="${index}">
        <div class="suggestion-main">${result.name}</div>
        <div class="suggestion-secondary">${result.address}</div>
      </div>
    `).join('');

    // Add click handlers
    suggestionsContainer.querySelectorAll('.address-suggestion-item').forEach((item, index) => {
      item.addEventListener('click', () => {
        this.selectAddress(inputElement, results[index]);
      });
    });

    suggestionsContainer.classList.add('active');
  }

  hideAddressSuggestions(inputElement) {
    const suggestionsContainer = inputElement.parentElement.querySelector('.address-suggestions');
    if (suggestionsContainer) {
      suggestionsContainer.classList.remove('active');
    }
  }

  selectAddress(inputElement, addressData) {
    // Fill in the address field - use the street address only
    const streetAddress = addressData.address.split(',')[0].trim();
    inputElement.value = streetAddress;
    
    // Fill in location name with full address for clarity
    const locationNameInput = document.getElementById('locationName');
    if (locationNameInput) {
      locationNameInput.value = addressData.name || addressData.address;
    }

    // Fill in city, state, zip if available
    if (addressData.context) {
      if (addressData.context.city) {
        const cityInput = document.getElementById('city');
        if (cityInput) cityInput.value = addressData.context.city;
      }
      if (addressData.context.state) {
        const stateInput = document.getElementById('state');
        if (stateInput) {
          // Try to match state abbreviation
          const stateOptions = stateInput.querySelectorAll('option');
          stateOptions.forEach(option => {
            if (option.value === addressData.context.state || option.text === addressData.context.state) {
              stateInput.value = option.value;
            }
          });
        }
      }
      if (addressData.context.zipcode) {
        const zipInput = document.getElementById('zipCode');
        if (zipInput) zipInput.value = addressData.context.zipcode;
      }
      if (addressData.context.country) {
        const countryInput = document.getElementById('country');
        if (countryInput) {
          // Match country code
          if (addressData.context.country === 'United States') {
            countryInput.value = 'US';
          } else if (addressData.context.country === 'Canada') {
            countryInput.value = 'CA';
          } else if (addressData.context.country === 'Mexico') {
            countryInput.value = 'MX';
          }
        }
      }
    }

    this.hideAddressSuggestions(inputElement);
  }

  async calculateRoute() {
    // Get all stops with coordinates
    const validStops = this.stops.filter(stop => stop && stop.coordinates);
    
    if (validStops.length < 2) {
      document.getElementById('routeInfo').style.display = 'none';
      return;
    }

    try {
      const coordinates = validStops.map(stop => stop.coordinates);
      const route = await this.mapboxService.getRoute(coordinates);
      
      this.displayRouteInfo(route);
    } catch (error) {
      console.error('Route calculation error:', error);
    }
  }

  displayRouteInfo(route) {
    const routeInfo = document.getElementById('routeInfo');
    const distanceEl = document.getElementById('routeDistance');
    const durationEl = document.getElementById('routeDuration');
    const directionsEl = document.getElementById('routeDirections');

    distanceEl.textContent = route.distance;
    durationEl.textContent = route.duration;

    // Display turn-by-turn directions
    directionsEl.innerHTML = route.steps.map((step, index) => `
      <div class="direction-step">
        <strong>${index + 1}.</strong> ${step.instruction}
        <span class="step-distance">(${step.distance})</span>
      </div>
    `).join('');

    routeInfo.style.display = 'block';
  }

  addStop() {
    const container = document.getElementById('stopsContainer');
    const stopIndex = this.stops.length;
    const stopRow = document.createElement('div');
    stopRow.className = 'stop-row';
    stopRow.dataset.stopIndex = stopIndex;
    stopRow.innerHTML = `
      <div class="form-group-inline">
        <label>Type</label>
        <select class="form-control stop-type">
          <option value="pickup">Pick-up</option>
          <option value="dropoff">Drop-off</option>
          <option value="stop" selected>Stop</option>
        </select>
      </div>
      <div class="form-group-inline">
        <label>Location Description / Name</label>
        <input type="text" class="form-control location-name" placeholder="Location name" readonly />
      </div>
      <div class="form-group-inline">
        <label>Address 1</label>
        <input type="text" class="form-control address-input" placeholder="Start typing address..." />
        <div class="address-suggestions"></div>
      </div>
    `;
    container.appendChild(stopRow);
    
    // Setup autocomplete for the new input
    const newInput = stopRow.querySelector('.address-input');
    let debounceTimer;
    
    newInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      const query = e.target.value;
      
      if (query.length < 3) {
        this.hideAddressSuggestions(newInput);
        return;
      }
      
      debounceTimer = setTimeout(async () => {
        await this.searchAddress(newInput, query);
      }, 300);
    });

    newInput.addEventListener('blur', () => {
      setTimeout(() => this.hideAddressSuggestions(newInput), 200);
    });
  }

  setupCostCalculationListeners() {
    // All cost input fields
    const costInputs = [
      'flatQty', 'flatRate',
      'hourQty', 'hourRate',
      'unitQty', 'unitRate',
      'otQty', 'otRate',
      'stopsQty', 'stopsRate',
      'gratuityQty',
      'fuelQty',
      'discountQty',
      'passQty', 'passRate',
      'mileQty', 'mileRate',
      'surfaceQty',
      'baseRateQty',
      'adminQty', 'adminRate'
    ];

    costInputs.forEach(inputId => {
      const input = document.getElementById(inputId);
      if (input) {
        input.addEventListener('input', () => {
          this.calculateCosts();
        });
      }
    });
  }

  initializeCostCalculations() {
    this.calculateCosts();
  }

  calculateCosts() {
    const costs = {
      flat: {
        qty: parseFloat(document.getElementById('flatQty').value) || 0,
        rate: parseFloat(document.getElementById('flatRate').value) || 0
      },
      hour: {
        qty: parseFloat(document.getElementById('hourQty').value) || 0,
        rate: parseFloat(document.getElementById('hourRate').value) || 0
      },
      unit: {
        qty: parseFloat(document.getElementById('unitQty').value) || 0,
        rate: parseFloat(document.getElementById('unitRate').value) || 0
      },
      ot: {
        qty: parseFloat(document.getElementById('otQty').value) || 0,
        rate: parseFloat(document.getElementById('otRate').value) || 0
      },
      stops: {
        qty: parseFloat(document.getElementById('stopsQty').value) || 0,
        rate: parseFloat(document.getElementById('stopsRate').value) || 0
      },
      gratuity: parseFloat(document.getElementById('gratuityQty').value) || 0,
      fuel: parseFloat(document.getElementById('fuelQty').value) || 0,
      discount: parseFloat(document.getElementById('discountQty').value) || 0,
      pass: {
        qty: parseFloat(document.getElementById('passQty').value) || 0,
        rate: parseFloat(document.getElementById('passRate').value) || 0
      },
      mile: {
        qty: parseFloat(document.getElementById('mileQty').value) || 0,
        rate: parseFloat(document.getElementById('mileRate').value) || 0
      },
      surface: parseFloat(document.getElementById('surfaceQty').value) || 0,
      baseRate: parseFloat(document.getElementById('baseRateQty').value) || 0,
      admin: {
        qty: parseFloat(document.getElementById('adminQty').value) || 0,
        rate: parseFloat(document.getElementById('adminRate').value) || 0
      }
    };

    const result = this.costCalculator.calculate(costs);

    // Update extended values
    document.getElementById('flatExt').value = result.flat.toFixed(2);
    document.getElementById('hourExt').value = result.hour.toFixed(2);
    document.getElementById('unitExt').value = result.unit.toFixed(2);
    document.getElementById('otExt').value = result.ot.toFixed(2);
    document.getElementById('stopsExt').value = result.stops.toFixed(2);
    document.getElementById('gratuityExt').value = result.gratuity.toFixed(2);
    document.getElementById('fuelExt').value = result.fuel.toFixed(2);
    document.getElementById('discountExt').value = result.discount.toFixed(2);
    document.getElementById('passExt').value = result.pass.toFixed(2);
    document.getElementById('mileExt').value = result.mile.toFixed(2);
    document.getElementById('surfaceExt').value = result.surface.toFixed(2);
    document.getElementById('baseRateExt').value = result.baseRate.toFixed(2);
    document.getElementById('adminExt').value = result.admin.toFixed(2);

    // Update totals
    document.getElementById('grandTotal').textContent = result.grandTotal.toFixed(2);
    document.getElementById('payments').textContent = '0.00'; // Would come from payment system
  }

  async saveReservation() {
    // Validate required fields
    if (!this.validateForm()) {
      return;
    }

    // Show loading state
    const saveBtn = document.querySelector('.btn-save');
    const originalText = saveBtn.textContent;
    saveBtn.disabled = true;
    saveBtn.textContent = '⏳ Saving...';

    try {
      // Collect all form data
      const reservationData = {
        billingAccount: {
          account: document.getElementById('billingAccountSearch').value,
          company: document.getElementById('billingCompany').value,
          firstName: document.getElementById('billingFirstName').value,
          lastName: document.getElementById('billingLastName').value,
          cellPhone: document.getElementById('billingPhone').value,
          email: document.getElementById('billingEmail').value
        },
        bookedBy: {
          firstName: document.getElementById('bookedByFirstName').value,
          lastName: document.getElementById('bookedByLastName').value,
          phone: document.getElementById('bookedByPhone').value,
          email: document.getElementById('bookedByEmail').value
        },
        passenger: {
          firstName: document.getElementById('passengerFirstName').value,
          lastName: document.getElementById('passengerLastName').value,
          phone: document.getElementById('passengerPhone').value,
          email: document.getElementById('passengerEmail').value,
          altContactName: document.getElementById('altContactName').value,
          altContactPhone: document.getElementById('altContactPhone').value
        },
        routing: {
          stops: this.getStops(),
          tripNotes: document.getElementById('tripNotes').value,
          billPaxNotes: document.getElementById('billPaxNotes').value,
          dispatchNotes: document.getElementById('dispatchNotes').value,
          partnerNotes: document.getElementById('partnerNotes').value
        },
        details: {
          efarmStatus: document.getElementById('efarmStatus').value,
          affiliate: document.getElementById('affiliate').value,
          referenceNum: document.getElementById('referenceNum').value,
          driver: document.getElementById('driverAssignment').value
        },
        costs: this.getCostData(),
        grandTotal: parseFloat(document.getElementById('grandTotal').textContent)
      };

      // Get current confirmation number and increment for next reservation
      const currentConfNumber = document.getElementById("confNumber")?.value || db.getNextConfirmationNumber();
      db.setNextConfirmationNumber(parseInt(currentConfNumber) + 1);
      
      // Save to LocalStorage via db module
      const saved = db.saveReservation({
        status: "confirmed",
        passenger_name: `${reservationData.passenger.firstName} ${reservationData.passenger.lastName}`,
        company_name: reservationData.billingAccount.company,
        confirmation_number: currentConfNumber,
        service_type: document.getElementById("serviceType")?.value || "",
        vehicle_type: document.getElementById("vehicleTypeRes")?.value || "",
        pickup_at: document.getElementById("puDate")?.value || null,
        time_zone: "America/Chicago",
        currency_abbr: "USD",
        passengers_count: parseInt(document.getElementById("numPax")?.value || "1") || 1,
        luggage_count: parseInt(document.getElementById("luggage")?.value || "0") || 0,
        is_accessible: document.getElementById("accessible")?.checked || false,
        grand_total: parseFloat(document.getElementById("grandTotal")?.textContent || "0") || 0,
        trip_notes: reservationData.routing.tripNotes || "",
        bill_pax_notes: reservationData.routing.billPaxNotes || "",
        dispatch_notes: reservationData.routing.dispatchNotes || "",
        farm_option: document.querySelector('input[name="farmOption"]:checked')?.value || "in_house",
        efarm_status: document.getElementById("eFarmStatus")?.value || "NOT FARMED OUT",
        affiliate_reference: reservationData.details.affiliate || "",
      });

      console.log('💾 Reservation saved to db:', saved);
      
      // Save passenger to passengers database
      if (reservationData.passenger.firstName || reservationData.passenger.lastName) {
        const passengerSaved = db.savePassenger({
          firstName: reservationData.passenger.firstName,
          lastName: reservationData.passenger.lastName,
          phone: reservationData.passenger.phone,
          email: reservationData.passenger.email,
          altContactName: reservationData.passenger.altContactName,
          altContactPhone: reservationData.passenger.altContactPhone,
          notes: `From reservation ${currentConfNumber}`
        });
        console.log('👤 Passenger saved to db:', passengerSaved);
      }
      
      // Save booking agent to booking agents database
      if (reservationData.bookedBy.firstName || reservationData.bookedBy.lastName) {
        const bookingAgentSaved = db.saveBookingAgent({
          firstName: reservationData.bookedBy.firstName,
          lastName: reservationData.bookedBy.lastName,
          phone: reservationData.bookedBy.phone,
          email: reservationData.bookedBy.email,
          notes: `From reservation ${currentConfNumber}`
        });
        console.log('📞 Booking agent saved to db:', bookingAgentSaved);
      }

      // Save route stops if available
      if (reservationData.routing.stops && reservationData.routing.stops.length > 0) {
        db.saveRouteStops(saved.id, reservationData.routing.stops);
        console.log('✅ Route stops saved to db');
        
        // Save addresses to account if account number exists
        const accountNumber = reservationData.billingAccount.account;
        if (accountNumber && accountNumber.trim()) {
          // Find account by number
          const account = db.getAllAccounts().find(a => a.id === accountNumber || a.account_number === accountNumber);
          
          if (account) {
            console.log('📍 Saving addresses to account:', account.id);
            
            // Save each stop address to the account
            reservationData.routing.stops.forEach(stop => {
              if (stop.address1 && stop.city) {
                const addressData = {
                  address_type: stop.stopType || 'waypoint',
                  address_name: stop.locationName || '',
                  address_line1: stop.address1,
                  address_line2: stop.address2 || '',
                  city: stop.city,
                  state: stop.state || '',
                  zip_code: stop.zipCode || '',
                  country: 'United States'
                };
                
                db.saveAccountAddress(account.id, addressData);
              }
            });
            
            console.log('✅ Addresses saved to account');
          }
        }
      }

      // Try to also save via API for backup
      try {
        const { setupAPI, createReservation } = await import('./api-service.js');
        await setupAPI();
        await createReservation(reservationData);
        console.log('✅ Reservation also synced to API');
      } catch (apiError) {
        console.warn('⚠️ API sync failed, but local save succeeded:', apiError);
      }
      
      if (saved) {
        console.log('✅ Reservation saved successfully:', saved);
        saveBtn.textContent = '✓ Saved!';
        saveBtn.style.background = '#28a745';
        
        // Wait and redirect to reservations list
        setTimeout(() => {
          if (confirm('Reservation saved! View reservations list?')) {
            window.location.href = 'reservations-list.html';
          } else {
            // Reset button and initialize new confirmation number for next reservation
            this.initializeConfirmationNumber();
            saveBtn.disabled = false;
            saveBtn.textContent = originalText;
            saveBtn.style.background = '';
          }
        }, 1500);
      } else {
        throw new Error('Failed to save reservation');
      }
    } catch (error) {
      console.error('❌ Error saving reservation:', error);
      alert(`Error saving reservation: ${error.message}`);
      
      // Reset button
      saveBtn.disabled = false;
      saveBtn.textContent = originalText;
      saveBtn.style.background = '';
    }
  }

  getStops() {
    const stops = [];
    document.querySelectorAll('.stop-row').forEach(row => {
      const type = row.querySelector('.stop-type').value;
      const location = row.querySelectorAll('.form-control')[0].value;
      const address = row.querySelectorAll('.form-control')[1].value;
      
      if (location || address) {
        stops.push({ type, location, address });
      }
    });
    return stops;
  }

  getCostData() {
    return {
      flat: { qty: document.getElementById('flatQty').value, rate: document.getElementById('flatRate').value },
      hour: { qty: document.getElementById('hourQty').value, rate: document.getElementById('hourRate').value },
      unit: { qty: document.getElementById('unitQty').value, rate: document.getElementById('unitRate').value },
      ot: { qty: document.getElementById('otQty').value, rate: document.getElementById('otRate').value },
      stops: { qty: document.getElementById('stopsQty').value, rate: document.getElementById('stopsRate').value },
      gratuity: document.getElementById('gratuityQty').value,
      fuel: document.getElementById('fuelQty').value,
      discount: document.getElementById('discountQty').value,
      pass: { qty: document.getElementById('passQty').value, rate: document.getElementById('passRate').value },
      mile: { qty: document.getElementById('mileQty').value, rate: document.getElementById('mileRate').value },
      surface: document.getElementById('surfaceQty').value,
      baseRate: document.getElementById('baseRateQty').value,
      admin: { qty: document.getElementById('adminQty').value, rate: document.getElementById('adminRate').value }
    };
  }

  validateForm() {
    // Check required fields
    const passengerFirstName = document.getElementById('passengerFirstName').value;
    const passengerLastName = document.getElementById('passengerLastName').value;

    if (!passengerFirstName || !passengerLastName) {
      alert('Please enter passenger name.');
      return false;
    }

    // Check if at least one stop is defined
    const stops = this.getStops();
    if (stops.length === 0) {
      alert('Please add at least one stop (pickup or dropoff).');
      return false;
    }

    return true;
  }
}

// Initialize when DOM is ready
console.log('📄 reservation-form.js loaded - document.readyState:', document.readyState);
console.log('🔍 ReservationForm class defined:', typeof ReservationForm);

function initializeReservationForm() {
  try {
    console.log('🔧 Creating ReservationForm instance...');
    window.reservationFormInstance = new ReservationForm();
    console.log('✅ ReservationForm instance created:', window.reservationFormInstance);
    console.log('✅ Instance available as window.reservationFormInstance');
    console.log('🎯 copyPassengerToBillingAndOpenAccounts method exists:', typeof window.reservationFormInstance.copyPassengerToBillingAndOpenAccounts);
  } catch (error) {
    console.error('❌ Failed to create ReservationForm instance:', error);
  }
}

if (document.readyState === 'loading') {
  console.log('⏳ DOM still loading, waiting for DOMContentLoaded...');
  document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ DOMContentLoaded event fired');
    initializeReservationForm();
  });
} else {
  // DOM is already loaded, initialize immediately
  console.log('⚡ DOM already loaded, initializing immediately');
  initializeReservationForm();
}

// Global backup function for onclick handler
window.copyPassengerToBillingAndOpenAccounts = function() {
  console.log('🎯 Global copyPassengerToBillingAndOpenAccounts() called');
  
  if (window.reservationFormInstance && typeof window.reservationFormInstance.copyPassengerToBillingAndOpenAccounts === 'function') {
    console.log('✅ Calling instance method');
    window.reservationFormInstance.copyPassengerToBillingAndOpenAccounts();
  } else {
    console.log('⚠️ Instance not ready, executing inline backup...');
    
    // Direct implementation as backup
    const firstName = document.getElementById('passengerFirstName')?.value?.trim() || '';
    const lastName = document.getElementById('passengerLastName')?.value?.trim() || '';
    const phone = document.getElementById('passengerPhone')?.value?.trim() || '';
    const email = document.getElementById('passengerEmail')?.value?.trim() || '';
    
    if (!firstName || !lastName) {
      console.warn('⚠️ Please enter passenger first and last name');
      return;
    }
    
    // Copy to billing
    document.getElementById('billingFirstName').value = firstName;
    document.getElementById('billingLastName').value = lastName;
    document.getElementById('billingPhone').value = phone;
    document.getElementById('billingEmail').value = email;
    document.getElementById('billingAccountSearch').value = `${firstName} ${lastName}`;
    
    console.log('✅ Copied to billing fields');
    
    // Save draft
    const draft = {
      first_name: firstName,
      last_name: lastName,
      company_name: document.getElementById('billingCompany')?.value?.trim() || '',
      phone: phone,
      email: email,
      type: 'individual',
      status: 'active'
    };
    
    localStorage.setItem('relia_account_draft', JSON.stringify(draft));
    console.log('✅ Draft saved to localStorage');
    
    // Update button and navigate
    const btn = document.getElementById('copyPassengerToAccountBtn');
    if (btn) {
      btn.textContent = '✓ Opening Accounts...';
      btn.style.background = '#28a745';
      btn.style.color = 'white';
      btn.disabled = true;
    }
    
    setTimeout(() => {
      console.log('🌐 Navigating to accounts.html');
      window.location.href = 'accounts.html?mode=new';
    }, 800);
  }
};
