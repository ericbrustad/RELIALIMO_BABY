import { wireMainNav } from './navigation.js';

class ReservationsList {
  constructor() {
    this.init();
  }

  async init() {
    await this.loadDbModule();
    this.setupEventListeners();
    this.setupTabSwitching();
    this.setupMessageListener();
    await this.loadReservations();
    this.handleOpenConfFromCalendar();
  }
  
  setupMessageListener() {
    // Listen for messages from parent window (e.g., to refresh after save)
    window.addEventListener('message', async (event) => {
      if (event.data && event.data.action === 'refreshReservations') {
        console.log('📥 Received refreshReservations message, reloading list...');
        await this.loadReservations();
      } else if (event.data && event.data.action === 'openReservation') {
        const confNumber = event.data.conf || event.data.openConf;
        if (confNumber) {
          console.log('📥 Received openReservation message for:', confNumber);
          this.openReservationInParent(confNumber);
        }
      }
    });
    console.log('👂 Message listener set up for reservations list');
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
  
  async loadReservations() {
    if (!this.db) {
      console.warn('⚠️ Database module not loaded yet');
      return;
    }
    
    try {
      // Load all data in parallel for efficiency
      const [reservations, accounts, vehicleTypes] = await Promise.all([
        this.db.getAllReservations(),
        this.db.getAllAccounts(),
        this.db.getAllVehicleTypes()
      ]);
      
      console.log('📋 Loaded reservations:', reservations?.length || 0);
      console.log('👥 Loaded accounts:', accounts?.length || 0);
      console.log('🚗 Loaded vehicle types:', vehicleTypes?.length || 0);
      
      // Create lookup maps for fast access
      this.accountsMap = new Map();
      (accounts || []).forEach(acc => {
        this.accountsMap.set(acc.id, acc);
        if (acc.account_number) {
          // Store by account_number as both number and string
          this.accountsMap.set(acc.account_number, acc);
          this.accountsMap.set(String(acc.account_number), acc);
        }
      });
      console.log('🗺️ AccountsMap keys:', Array.from(this.accountsMap.keys()).slice(0, 10));
      
      this.vehicleTypesMap = new Map();
      (vehicleTypes || []).forEach(vt => {
        this.vehicleTypesMap.set(vt.id, vt);
        if (vt.name) {
          this.vehicleTypesMap.set(vt.name.toLowerCase(), vt);
        }
      });
      
      if (reservations && reservations.length > 0) {
        this.displayReservations(reservations);
      } else {
        this.displayReservations([]);
        console.log('📭 No reservations found');
      }
    } catch (error) {
      console.error('❌ Error loading reservations:', error);
    }
  }
  
  // Helper to resolve vehicle type name from ID or name
  resolveVehicleTypeName(vehicleTypeValue) {
    if (!vehicleTypeValue) return '';
    
    // Check if it's a UUID (looks like: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(vehicleTypeValue);
    
    if (isUUID && this.vehicleTypesMap) {
      const vt = this.vehicleTypesMap.get(vehicleTypeValue);
      if (vt) {
        return vt.name || vt.display_name || vehicleTypeValue;
      }
    }
    
    // Already a name or not found
    return vehicleTypeValue;
  }
  
  // Helper to resolve company name from account_id (prioritize dynamic lookup)
  resolveCompanyName(reservation) {
    // Try multiple fields to find the account link
    const accountId = reservation.account_id || reservation.billing_account || reservation.accountId;
    console.log(`🔍 resolveCompanyName for ${reservation.confirmation_number}: account_id=${accountId}, billing_account=${reservation.billing_account}, stored company_name=${reservation.company_name}`);
    
    if (accountId && this.accountsMap) {
      // Try direct lookup
      let account = this.accountsMap.get(accountId);
      
      // Try as string if not found
      if (!account && accountId) {
        account = this.accountsMap.get(String(accountId));
      }
      
      console.log(`   → Account lookup result:`, account ? `found: ${account.company_name}` : 'not found in map');
      if (account && account.company_name) {
        return account.company_name;
      }
    }
    
    // Fallback to stored company_name (for reservations without linked account)
    if (reservation.company_name) {
      console.log(`   → Using stored company_name: ${reservation.company_name}`);
      return reservation.company_name;
    }
    
    return '';
  }
  
  // Derive display status from farm_option + farmout_status 
  // (database status column has CHECK constraint, can't store "farmout unassigned")
  deriveDisplayStatus(res) {
    const farmOption = (res.farm_option || 'in-house').toString().toLowerCase().replace(/-/g, '_');
    const farmoutStatus = (res.farmout_status || '').toString().toLowerCase();
    const dbStatus = (res.status || 'pending').toString().toLowerCase();
    
    // Check if this is a farm-out reservation
    const isFarmOut = farmOption === 'farm_out' || farmOption === 'farmout';
    
    if (isFarmOut) {
      // Derive status from farmout_status
      if (farmoutStatus === 'assigned') {
        return { class: 'farmout_assigned', label: 'Farmout Assigned' };
      } else {
        return { class: 'farmout_unassigned', label: 'Farmout Unassigned' };
      }
    }
    
    // Try to get UI status from form_snapshot (stores the original form selection)
    const snapshot = res.form_snapshot;
    if (snapshot && snapshot.details) {
      const uiStatusLabel = snapshot.details.resStatusLabel;
      const uiStatus = snapshot.details.resStatus;
      if (uiStatusLabel) {
        const cssClass = (uiStatus || uiStatusLabel).toLowerCase().replace(/[^a-z0-9]+/g, '_');
        return { class: cssClass, label: uiStatusLabel };
      }
      if (uiStatus) {
        const formatLabel = (s) => s.split(/[_\s-]+/).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        const cssClass = uiStatus.toLowerCase().replace(/[^a-z0-9]+/g, '_');
        return { class: cssClass, label: formatLabel(uiStatus) };
      }
    }
    
    // Fallback: Use the actual database status value directly
    // Format it nicely for display (capitalize first letter of each word)
    const formatLabel = (s) => s.split(/[_\s-]+/).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    
    return { class: dbStatus.replace(/[^a-z0-9]/g, '_'), label: formatLabel(dbStatus) };
  }
  
  displayReservations(reservations) {
    // Find the table body in the new reservations tab
    const tableBody = document.querySelector('#newReservationsTab tbody');
    if (!tableBody) {
      console.warn('⚠️ Could not find table body for reservations');
      return;
    }
    
    // Clear existing rows
    tableBody.innerHTML = '';

    // Drop settled trips from the visible list
    const filtered = (reservations || []).filter(res => {
      const status = (res.status || '').toString().toLowerCase();
      return status !== 'settled';
    });
    
    if (filtered.length === 0) {
      // Show empty state message
      const emptyRow = document.createElement('tr');
      emptyRow.innerHTML = `
        <td colspan="11" style="text-align: center; padding: 40px; color: #666;">
          <div>
            <h3>📭 No Reservations Found</h3>
            <p>The reservations database is empty or no reservations match the current filter.</p>
            <p>Try creating a new reservation or check your database connection.</p>
          </div>
        </td>
      `;
      tableBody.appendChild(emptyRow);
      console.log('📭 Displayed empty state message');
      return;
    }
    
    // Add new rows for each reservation
    filtered.forEach(res => {
      // Debug: show what confirmation_number and id look like
      console.log(`📋 Res: confirmation_number=${res.confirmation_number}, id=${res.id}, company_name=${res.company_name}, account_id=${res.account_id}`);
      
      // Resolve company name from account (dynamic lookup)
      const companyName = this.resolveCompanyName(res);
      
      // Resolve vehicle type name (in case it's stored as UUID)
      const vehicleTypeName = this.resolveVehicleTypeName(res.vehicle_type);
      
      // Derive display status from farm_option + farmout_status (database status column has constraint)
      const displayStatus = this.deriveDisplayStatus(res);
      
      // Build farmout mode indicator (M/A) for farmout reservations
      let modeIndicator = '';
      const farmOption = (res.farm_option || '').toString().toLowerCase().replace(/-/g, '_');
      const farmoutStatus = (res.farmout_status || '').toString().toLowerCase();
      const isFarmout = (farmOption === 'farm_out' || farmOption === 'farmout') || 
                        (farmoutStatus && farmoutStatus !== '' && farmoutStatus !== 'in_house');
      if (isFarmout) {
        const farmoutMode = (res.farmout_mode || 'manual').toString().toLowerCase().replace(/[^a-z0-9]+/g, '_');
        const modeLabel = farmoutMode === 'automatic' ? 'A' : 'M';
        const modeClass = farmoutMode === 'automatic' ? 'mode-auto' : 'mode-manual';
        const modeTitle = farmoutMode === 'automatic' ? 'Automatic' : 'Manual';
        modeIndicator = `<span class="farmout-mode-indicator ${modeClass}" title="${modeTitle}">${modeLabel}</span>`;
      }
      
      // Use pickup_datetime (database column) with fallback to pickup_at for compatibility
      const pickupDateTime = res.pickup_datetime || res.pickup_at;
      
      const row = document.createElement('tr');
      row.innerHTML = `
        <td><a href="#" class="conf-link" data-conf="${res.confirmation_number || ''}">${res.confirmation_number || 'N/A'}</a></td>
        <td>${this.formatDate(pickupDateTime)}</td>
        <td>${this.formatTime(pickupDateTime)}</td>
        <td>${res.passenger_name || [res.passenger_first_name, res.passenger_last_name].filter(Boolean).join(' ') || ''}</td>
        <td>${companyName}</td>
        <td>${vehicleTypeName}</td>
        <td>$${Number(res.grand_total || 0).toFixed(2)}</td>
        <td>${res.payment_type || ''}</td>
        <td><span class="status-badge ${displayStatus.class}">${displayStatus.label}</span>${modeIndicator}</td>
        <td>${res.group_name || ''}</td>
        <td><a href="#" class="select-link">Select >></a></td>
      `;
      tableBody.appendChild(row);
    });
    
    console.log(`✅ Displayed ${filtered.length} reservations (settled hidden)`);
    
    // Re-attach event listeners to new elements
    this.attachRowListeners();
  }

  activateTab(tabName) {
    // Update active state
    document.querySelectorAll('.window-tab').forEach(t => t.classList.remove('active'));
    const tabBtn = document.querySelector(`.window-tab[data-tab="${tabName}"]`);
    if (tabBtn) tabBtn.classList.add('active');

    // Hide all tab content
    const ids = ['newReservationsTab', 'onlineEfarmInTab', 'unfinalizedTab', 'deletedTab', 'importTab'];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });

    // Show selected tab
    if (tabName === 'new-reservations') {
      const el = document.getElementById('newReservationsTab');
      if (el) el.style.display = 'flex';
    } else if (tabName === 'online-efarm-in') {
      const el = document.getElementById('onlineEfarmInTab');
      if (el) el.style.display = 'block';
    } else if (tabName === 'unfinalized') {
      const el = document.getElementById('unfinalizedTab');
      if (el) el.style.display = 'block';
    } else if (tabName === 'deleted') {
      const el = document.getElementById('deletedTab');
      if (el) el.style.display = 'block';
    } else if (tabName === 'import') {
      const el = document.getElementById('importTab');
      if (el) el.style.display = 'block';
    }
  }

  handleOpenConfFromCalendar() {
    try {
      const url = new URL(window.location.href);
      const openConf = url.searchParams.get('openConf');
      if (!openConf) return;

      // Always activate the normal list tab first (matches the user's workflow)
      this.activateTab('new-reservations');

      // Try to open via the same click path the table uses
      const link = document.querySelector(`#newReservationsTab .conf-link[data-conf="${CSS.escape(openConf)}"]`);
      if (link) {
        link.click();
        return;
      }

      // Fallback if the row isn't rendered
      window.location.href = `reservation-form.html?conf=${encodeURIComponent(openConf)}`;
    } catch (e) {
      console.warn('⚠️ Failed to open reservation from calendar:', e);
    }
  }
  
  attachRowListeners() {
    // Conf # links
    document.querySelectorAll('.conf-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const confNumber = e.target.dataset.conf;
        this.openReservationInParent(confNumber);
      });
    });

    // Select links
    document.querySelectorAll('.select-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const row = e.target.closest('tr');
        const confNumber = row.querySelector('.conf-link').dataset.conf;
        this.selectReservation(confNumber);
      });
    });

    // Make entire row clickable to open reservation
    document.querySelectorAll('#newReservationsTab tbody tr').forEach(row => {
      // Exclude header row
      if (row.querySelector('.conf-link')) {
        row.style.cursor = 'pointer';
        
        row.addEventListener('click', (e) => {
          // Don't trigger if clicking on a link
          if (e.target.tagName === 'A') return;
          
          const confLink = row.querySelector('.conf-link');
          if (confLink) {
            const confNumber = confLink.dataset.conf;
            this.openReservationInParent(confNumber);
          }
        });

        // Add hover effect
        row.addEventListener('mouseenter', () => {
          row.style.backgroundColor = 'rgba(102, 126, 234, 0.1)';
        });

        row.addEventListener('mouseleave', () => {
          row.style.backgroundColor = '';
        });
      }
    });
  }

  /**
   * Open reservation in parent frame (if running in iframe)
   * Falls back to direct navigation if not in iframe
   */
  openReservationInParent(confNumber) {
    try {
      // Check if we're in an iframe
      if (window.self !== window.top) {
        // Send message to parent to open reservation
        window.parent.postMessage({
          action: 'openReservation',
          conf: confNumber
        }, '*');
        console.log('📤 Sent openReservation message to parent for conf:', confNumber);
      } else {
        // Not in iframe, navigate directly
        window.location.href = `reservation-form.html?conf=${confNumber}`;
        console.log('🔗 Navigating directly to reservation-form for conf:', confNumber);
      }
    } catch (error) {
      console.error('❌ Error opening reservation:', error);
      // Fallback to direct navigation
      window.location.href = `reservation-form.html?conf=${confNumber}`;
    }
  }
  
  formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  }
  
  formatTime(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }

  setupTabSwitching() {
    // Handle tab switching
    document.querySelectorAll('.window-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const tabName = e.target.dataset.tab;
        
        // Update active state
        document.querySelectorAll('.window-tab').forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');
        
        // Hide all tab content
        document.getElementById('newReservationsTab').style.display = 'none';
        document.getElementById('onlineEfarmInTab').style.display = 'none';
        document.getElementById('unfinalizedTab').style.display = 'none';
        document.getElementById('deletedTab').style.display = 'none';
        document.getElementById('importTab').style.display = 'none';
        
        // Show selected tab
        switch(tabName) {
          case 'new-reservations':
            document.getElementById('newReservationsTab').style.display = 'flex';
            break;
          case 'online-efarm-in':
            document.getElementById('onlineEfarmInTab').style.display = 'block';
            break;
          case 'unfinalized':
            document.getElementById('unfinalizedTab').style.display = 'block';
            break;
          case 'deleted':
            document.getElementById('deletedTab').style.display = 'block';
            break;
          case 'import':
            document.getElementById('importTab').style.display = 'block';
            break;
        }
      });
    });
  }

  setupEventListeners() {
    // Main navigation buttons
    wireMainNav();

    // View buttons (window-actions)
    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = e.target.dataset.action;
        
        if (action === 'user-view') {
          window.location.href = 'index.html?view=user';
        } else if (action === 'driver-view') {
          window.location.href = 'index.html?view=driver';
        } else if (action === 'reservations') {
          // Already on reservations page
        } else if (action === 'farm-out') {
          window.location.href = 'index.html?view=reservations';
        } else if (action === 'new-reservation') {
          window.location.href = 'reservation-form.html';
        }
      });
    });

    // Search button
    const searchBtn = document.querySelector('.btn-search');
    if (searchBtn) {
      searchBtn.addEventListener('click', () => {
        this.performSearch();
      });
    }

    // Conf # links
    document.querySelectorAll('.conf-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        // Navigate to reservation form with this reservation ID
        const confNumber = e.target.textContent;
        window.location.href = `reservation-form.html?conf=${confNumber}`;
      });
    });

    // Select links
    document.querySelectorAll('.select-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const row = e.target.closest('tr');
        const confNumber = row.querySelector('.conf-link')?.dataset?.conf;
        this.selectReservation(confNumber);
      });
    });
  }

  performSearch() {
    // Get search values
    const searchFor = document.querySelector('.search-input').value;
    const searchIn = document.querySelector('.search-select').value;
    
    console.log('Searching for:', searchFor, 'in:', searchIn);
    
    // Implement search logic here
    // This would filter the table based on search criteria
    alert('Search functionality will filter reservations based on your criteria');
  }

  selectReservation(confNumber) {
    if (!confNumber) {
      console.warn('⚠️ No confirmation number provided to selectReservation');
      return;
    }
    console.log('Selected reservation:', confNumber);
    this.openReservationInParent(confNumber);
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new ReservationsList();
});
