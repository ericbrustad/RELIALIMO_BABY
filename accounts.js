class Accounts {
  constructor() {
    this.currentTab = 'accounts';
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.init());
    } else {
      this.init();
    }
  }

  async init() {
    console.log('🔧 Initializing Accounts...');
    try {
      // Load database module
      await this.loadDbModule();
      
      this.setupEventListeners();
      
      // Check if we should load a specific account
      const currentAccountId = localStorage.getItem('currentAccountId');
      if (currentAccountId) {
        this.loadAccount(currentAccountId);
        localStorage.removeItem('currentAccountId'); // Clear after loading
      } else {
        this.applyDraftIfPresent();
      }
      
      console.log('✅ Accounts initialization complete');
    } catch (error) {
      console.error('❌ Error initializing Accounts:', error);
    }
  }
  
  async loadDbModule() {
    try {
      const module = await import('./assets/db.js');
      this.db = module.db;
      console.log('✅ Database module loaded');
    } catch (error) {
      console.error('❌ Failed to load database module:', error);
    }
  }
  
  loadAccount(accountId) {
    if (!this.db) {
      console.warn('⚠️ Database module not loaded yet');
      return;
    }
    
    try {
      const account = this.db.getAccountById(accountId);
      if (!account) {
        console.warn('⚠️ Account not found:', accountId);
        return;
      }
      
      console.log('✅ Loading account:', account);
      
      // Populate form fields
      const accountNumberEl = document.getElementById('accountNumber');
      const firstNameEl = document.getElementById('acctFirstName');
      const lastNameEl = document.getElementById('acctLastName');
      const companyEl = document.getElementById('acctCompany');
      const cellPhone1El = document.getElementById('acctCellPhone1');
      const emailEl = document.getElementById('acctEmail2');
      
      if (accountNumberEl) {
        accountNumberEl.value = account.account_number || account.id;
        accountNumberEl.setAttribute('readonly', true);
      }
      if (firstNameEl) firstNameEl.value = account.first_name || '';
      if (lastNameEl) lastNameEl.value = account.last_name || '';
      if (companyEl) companyEl.value = account.company_name || '';
      if (cellPhone1El) cellPhone1El.value = account.phone || '';
      if (emailEl) emailEl.value = account.email || '';
      
      // Switch to accounts tab
      this.switchAccountTab('info');
      
    } catch (error) {
      console.error('❌ Error loading account:', error);
    }
  }

  applyDraftIfPresent() {
    // Check if there's a draft account from the reservation form
    const raw = localStorage.getItem('relia_account_draft');
    if (!raw) return;

    try {
      const draft = JSON.parse(raw);
      console.log('✅ Draft account found, prefilling fields:', draft);

      // Switch to Accounts tab (in case we're not already there)
      this.switchTab('accounts');

      // Use the IDs we just added to accounts.html
      const firstNameEl = document.getElementById('acctFirstName');
      const lastNameEl = document.getElementById('acctLastName');
      const companyEl = document.getElementById('acctCompany');
      const cellPhone1El = document.getElementById('acctCellPhone1');
      const emailEl = document.getElementById('acctEmail2');

      // Fill basic info
      if (firstNameEl) firstNameEl.value = draft.first_name || '';
      if (lastNameEl) lastNameEl.value = draft.last_name || '';
      if (companyEl) companyEl.value = draft.company_name || '';
      
      // Auto-fill cell phone 1 from phone/cell phone
      if (cellPhone1El) cellPhone1El.value = draft.phone || draft.cell_phone || '';
      
      // Auto-fill email from email field
      if (emailEl) emailEl.value = draft.email || '';

      // Also fill the Contact Info email section (if it exists)
      const acctEmailContactEl = document.getElementById('acctEmail');
      if (acctEmailContactEl) acctEmailContactEl.value = draft.email || '';

      // Clear the draft so it doesn't keep refilling
      localStorage.removeItem('relia_account_draft');
      console.log('✅ Draft applied and cleared');

      // Focus first name field for immediate entry
      if (firstNameEl) {
        setTimeout(() => firstNameEl.focus(), 100);
      }
    } catch (error) {
      console.error('Error parsing draft account:', error);
      localStorage.removeItem('relia_account_draft');
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
    
    // Main navigation buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const section = e.target.dataset.section;
        this.navigateToSection(section);
      });
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

    // Companies list selection
    const companiesList = document.getElementById('companiesList');
    if (companiesList) {
      companiesList.addEventListener('dblclick', () => {
        this.editCompany();
      });
    }

    // Account sub-tabs (Account Info / Financial Data)
    document.querySelectorAll('.account-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const accountTab = e.target.dataset.accountTab;
        this.switchAccountTab(accountTab);
      });
    });

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
      content.style.display = 'none';
    });

    // Show the appropriate content
    if (tabName === 'info') {
      document.getElementById('accountInfoTab').style.display = 'block';
    } else if (tabName === 'financial') {
      document.getElementById('financialDataTab').style.display = 'block';
    } else if (tabName === 'addresses') {
      document.getElementById('addressesTab').style.display = 'block';
      this.loadStoredAddresses();
    } else if (tabName === 'booking') {
      document.getElementById('bookingTab').style.display = 'block';
      this.loadBookingContacts();
    } else if (tabName === 'misc') {
      document.getElementById('miscTab').style.display = 'block';
      this.loadMiscInfo();
    }
  }
  
  loadStoredAddresses() {
    // TODO: Load stored addresses from db
    console.log('Loading stored addresses...');
  }
  
  loadBookingContacts() {
    // TODO: Load booking contacts from db
    console.log('Loading booking contacts...');
  }
  
  loadMiscInfo() {
    // TODO: Load misc info
    console.log('Loading misc info...');
  }

  navigateToSection(section) {
    // Navigate to different main sections
    if (section === 'office') {
      window.location.href = 'my-office.html';
    } else if (section === 'accounts') {
      window.location.href = 'accounts.html';
    } else if (section === 'quotes') {
      window.location.href = 'quotes.html';
    } else if (section === 'calendar') {
      window.location.href = 'calendar.html';
    } else if (section === 'reservations') {
      window.location.href = 'reservations-list.html';
    } else {
      // Placeholder for other sections
      alert(`${section} section coming soon`);
    }
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

  saveAccount() {
    console.log('💾 saveAccount() called');
    
    try {
      // Collect form data from the Account Info tab
      const accountData = {
        first_name: document.getElementById('acctFirstName')?.value?.trim() || '',
        last_name: document.getElementById('acctLastName')?.value?.trim() || '',
        company_name: document.getElementById('acctCompany')?.value?.trim() || '',
        phone: document.getElementById('acctPhone')?.value?.trim() || '',
        email: document.getElementById('acctEmail')?.value?.trim() || '',
        status: 'active',
        type: 'individual'
      };

      console.log('📝 Account data to save:', accountData);

      // Validate required fields
      if (!accountData.first_name || !accountData.last_name) {
        console.warn('⚠️ First Name and Last Name are required');
        return;
      }

      // Import db module and save
      import('./assets/db.js').then(module => {
        try {
          const db = module.db;
          
          if (!db) {
            console.error('❌ db module not found');
            return;
          }
          
          console.log('✅ db module loaded:', db);
          const saved = db.saveAccount(accountData);
          
          if (!saved) {
            console.error('❌ saveAccount returned null/false');
            return;
          }
          
          console.log('✅ Account saved successfully:', saved);

          // Show success feedback
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
        } catch (innerError) {
          console.error('❌ Error in save handler:', innerError);
        }
      }).catch(error => {
        console.error('❌ Error importing db module:', error);
      });
    } catch (error) {
      console.error('❌ Error saving account:', error);
    }
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
