import { wireMainNav } from './navigation.js';

// Realtime service - loaded dynamically to prevent blocking if unavailable
let realtimeService = null;
let subscribeToReservations = null;

class ReservationsList {
  constructor() {
    this.sortBy = 'date';     // Default sort column
    this.sortOrder = 'desc';  // Default sort direction
    this.pageSize = 75;       // Default page size
    this.currentPage = 1;
    this.allReservations = []; // Store all loaded reservations
    this.filteredReservations = []; // Store filtered reservations
    this.unsubscribeRealtime = null;
    this.init();
  }

  async init() {
    await this.loadDbModule();
    this.loadSortSettings();
    this.setupEventListeners();
    this.setupTabSwitching();
    this.setupMessageListener();
    await this.loadReservations();
    this.handleOpenConfFromCalendar();
    // Setup realtime after page loads - don't block on this
    this.setupRealtimeSubscription();
  }
  
  /**
   * Setup real-time subscription for instant updates
   */
  async setupRealtimeSubscription() {
    try {
      // Dynamically import realtime service to prevent blocking
      const realtimeModule = await import('./realtime-service.js');
      realtimeService = realtimeModule.default;
      subscribeToReservations = realtimeModule.subscribeToReservations;
      
      await realtimeService.init();
      
      this.unsubscribeRealtime = subscribeToReservations((eventType, newRecord, oldRecord) => {
        console.log(`[ReservationsList] Real-time ${eventType}:`, newRecord?.confirmation_number || oldRecord?.confirmation_number);
        
        // Reload reservations on any change for instant sync
        this.loadReservations();
      });
      
      console.log('[ReservationsList] Real-time subscription active for instant updates');
    } catch (err) {
      console.warn('[ReservationsList] Real-time subscription not available:', err.message);
    }
  }
  
  /**
   * Load sort settings from CompanySettingsManager and sync with UI
   */
  loadSortSettings() {
    try {
      if (window.CompanySettingsManager) {
        const settingsManager = new window.CompanySettingsManager();
        this.sortBy = settingsManager.getSetting('defaultReservationSortBy') || 'date';
        this.sortOrder = settingsManager.getSetting('defaultReservationSortOrder') || 'desc';
        console.log(`📊 Loaded sort settings: sortBy=${this.sortBy}, sortOrder=${this.sortOrder}`);
        
        // Sync UI dropdowns with settings
        this.syncUIWithSettings();
        
        // Listen for settings changes to apply instantly
        window.addEventListener('companySettingsChanged', (e) => {
          const { settings, changedKeys } = e.detail || {};
          if (changedKeys.includes('defaultReservationSortBy') || changedKeys.includes('defaultReservationSortOrder')) {
            console.log('📊 Sort settings changed, reapplying...');
            this.sortBy = settings.defaultReservationSortBy || 'date';
            this.sortOrder = settings.defaultReservationSortOrder || 'desc';
            this.syncUIWithSettings();
            // Re-display with new sort
            this.applyFiltersAndSort();
          }
        });
      }
    } catch (e) {
      console.warn('⚠️ Could not load sort settings:', e);
    }
  }
  
  /**
   * Sync UI dropdowns with current settings
   */
  syncUIWithSettings() {
    const sortBySelect = document.getElementById('sortBy');
    const orderBySelect = document.getElementById('orderBy');
    const pageSizeSelect = document.getElementById('pageSize');
    
    if (sortBySelect) sortBySelect.value = this.sortBy;
    if (orderBySelect) orderBySelect.value = this.sortOrder;
    if (pageSizeSelect) pageSizeSelect.value = String(this.pageSize);
  }
  
  /**
   * Sort reservations based on current sort settings
   */
  sortReservations(reservations) {
    if (!reservations || reservations.length === 0) return reservations;
    
    const sorted = [...reservations].sort((a, b) => {
      let comparison = 0;
      
      switch (this.sortBy) {
        case 'confirmation_number':
          // Sort by confirmation number numerically
          const confA = parseInt(a.confirmation_number) || 0;
          const confB = parseInt(b.confirmation_number) || 0;
          comparison = confA - confB;
          break;
          
        case 'price':
          // Sort by grand_total
          const priceA = parseFloat(a.grand_total) || 0;
          const priceB = parseFloat(b.grand_total) || 0;
          comparison = priceA - priceB;
          break;
          
        case 'date':
        default:
          // Sort by pickup_datetime (default)
          const dateA = new Date(a.pickup_datetime || a.pickup_at || 0);
          const dateB = new Date(b.pickup_datetime || b.pickup_at || 0);
          comparison = dateA - dateB;
          break;
      }
      
      // Apply sort order (ascending or descending)
      return this.sortOrder === 'asc' ? comparison : -comparison;
    });
    
    console.log(`📊 Sorted ${sorted.length} reservations by ${this.sortBy} (${this.sortOrder})`);
    return sorted;
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
      console.log('🔄 Loading reservations from database...');
      
      // Load all data in parallel for efficiency
      const [reservations, accounts, vehicleTypes] = await Promise.all([
        this.db.getAllReservations(),
        this.db.getAllAccounts(),
        this.db.getAllVehicleTypes()
      ]);
      
      console.log('📋 Loaded reservations:', reservations?.length || 0);
      console.log('👥 Loaded accounts:', accounts?.length || 0);
      console.log('🚗 Loaded vehicle types:', vehicleTypes?.length || 0);
      
      // Debug: log first few reservations
      if (reservations && reservations.length > 0) {
        console.log('📋 First 3 reservations:', reservations.slice(0, 3).map(r => ({
          id: r.id,
          conf: r.confirmation_number,
          status: r.status,
          pickup: r.pickup_datetime
        })));
      }
      
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
      
      // Store all reservations for filtering
      this.allReservations = reservations || [];
      
      // Apply filters and display
      this.applyFiltersAndSort();
      
      if (!reservations || reservations.length === 0) {
        console.log('📭 No reservations found in database');
      }
    } catch (error) {
      console.error('❌ Error loading reservations:', error);
    }
  }
  
  /**
   * Apply current filters and sort settings, then display
   */
  applyFiltersAndSort() {
    // Get filter values from UI
    const searchFor = document.getElementById('searchFor')?.value?.trim().toLowerCase() || '';
    const searchIn = document.getElementById('searchIn')?.value || 'all';
    const dateFrom = document.getElementById('dateFrom')?.value || '';
    const dateTo = document.getElementById('dateTo')?.value || '';
    
    // Get sort values from UI (these override settings)
    const sortByUI = document.getElementById('sortBy')?.value;
    const orderByUI = document.getElementById('orderBy')?.value;
    const pageSizeUI = document.getElementById('pageSize')?.value;
    
    if (sortByUI) this.sortBy = sortByUI;
    if (orderByUI) this.sortOrder = orderByUI;
    if (pageSizeUI) this.pageSize = parseInt(pageSizeUI) || 75;
    
    console.log(`🔍 Filtering: search="${searchFor}" in="${searchIn}" from="${dateFrom}" to="${dateTo}"`);
    console.log(`📊 Sort: by="${this.sortBy}" order="${this.sortOrder}" pageSize=${this.pageSize}`);
    
    // Filter reservations
    let filtered = [...this.allReservations];
    
    // Apply text search filter
    if (searchFor) {
      filtered = filtered.filter(res => {
        const confNum = String(res.confirmation_number || '').toLowerCase();
        const passengerFirst = (res.lead_passenger_first_name || '').toLowerCase();
        const passengerLast = (res.lead_passenger_last_name || '').toLowerCase();
        const passengerName = `${passengerFirst} ${passengerLast}`;
        const companyName = (res.account_name || res.company_name || '').toLowerCase();
        const vehicleType = (res.vehicle_type || res.vehicle_type_name || '').toLowerCase();
        
        switch (searchIn) {
          case 'conf':
            return confNum.includes(searchFor);
          case 'passenger':
            return passengerName.includes(searchFor);
          case 'company':
            return companyName.includes(searchFor);
          case 'vehicle':
            return vehicleType.includes(searchFor);
          case 'all':
          default:
            return confNum.includes(searchFor) || 
                   passengerName.includes(searchFor) || 
                   companyName.includes(searchFor) ||
                   vehicleType.includes(searchFor);
        }
      });
    }
    
    // Apply date range filter
    if (dateFrom || dateTo) {
      filtered = filtered.filter(res => {
        const pickupDate = res.pickup_datetime || res.pickup_at;
        if (!pickupDate) return false;
        
        const resDate = new Date(pickupDate);
        if (isNaN(resDate.getTime())) return false;
        
        // Reset time for date-only comparison
        resDate.setHours(0, 0, 0, 0);
        
        if (dateFrom) {
          const fromDate = new Date(dateFrom);
          fromDate.setHours(0, 0, 0, 0);
          if (resDate < fromDate) return false;
        }
        
        if (dateTo) {
          const toDate = new Date(dateTo);
          toDate.setHours(23, 59, 59, 999);
          if (resDate > toDate) return false;
        }
        
        return true;
      });
    }
    
    // Store filtered results
    this.filteredReservations = filtered;
    
    // Sort the results
    const sorted = this.sortReservations(filtered);
    
    // Apply pagination
    const startIdx = (this.currentPage - 1) * this.pageSize;
    const paginated = sorted.slice(startIdx, startIdx + this.pageSize);
    
    console.log(`📋 Showing ${paginated.length} of ${sorted.length} filtered (${this.allReservations.length} total)`);
    
    // Display results
    this.displayReservations(paginated);
    
    // Update result count display
    this.updateResultCount(sorted.length, this.allReservations.length);
  }
  
  /**
   * Update the result count display
   */
  updateResultCount(filtered, total) {
    let countEl = document.getElementById('resultCount');
    if (!countEl) {
      // Create it if it doesn't exist
      const searchSection = document.querySelector('.search-section');
      if (searchSection) {
        countEl = document.createElement('div');
        countEl.id = 'resultCount';
        countEl.className = 'result-count';
        countEl.style.cssText = 'padding: 8px 12px; background: #f0f0f0; border-radius: 4px; margin-top: 10px; font-size: 14px;';
        searchSection.appendChild(countEl);
      }
    }
    if (countEl) {
      if (filtered === total) {
        countEl.textContent = `Showing ${Math.min(this.pageSize, filtered)} of ${total} reservations`;
      } else {
        countEl.textContent = `Showing ${Math.min(this.pageSize, filtered)} of ${filtered} filtered (${total} total)`;
      }
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
    
    // Log total reservations received
    console.log(`📋 displayReservations received ${(reservations || []).length} reservations`);

    // Drop settled trips from the visible list (all other statuses are shown)
    const totalReceived = (reservations || []).length;
    let filtered = (reservations || []).filter(res => {
      const status = (res.status || '').toString().toLowerCase();
      return status !== 'settled';
    });
    
    const settledCount = totalReceived - filtered.length;
    if (settledCount > 0) {
      console.log(`📊 Hiding ${settledCount} settled reservations, showing ${filtered.length}`);
    }
    
    // Apply sorting based on company settings
    filtered = this.sortReservations(filtered);
    console.log(`📊 After sorting: ${filtered.length} reservations (sortBy=${this.sortBy}, sortOrder=${this.sortOrder})`);
    
    if (filtered.length === 0) {
      // Show empty state message with more details
      const emptyRow = document.createElement('tr');
      emptyRow.innerHTML = `
        <td colspan="11" style="text-align: center; padding: 40px; color: #666;">
          <div>
            <h3>📭 No Reservations Found</h3>
            <p>Total from database: ${totalReceived} | Settled (hidden): ${settledCount}</p>
            <p>Try creating a new reservation or check your database connection.</p>
            <button onclick="location.reload()" class="btn btn-primary" style="margin-top: 10px;">🔄 Refresh</button>
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
      
      // Get driver name from various possible sources
      const driverName = res.driver_name || res.driverName || 
                         res.form_snapshot?.driver?.name || 
                         res.form_snapshot?.details?.driverName || 
                         (res.assigned_driver_id ? 'Assigned' : 'N/A');
      
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
        <td>${driverName}</td>
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
    const searchBtn = document.getElementById('searchBtn');
    if (searchBtn) {
      searchBtn.addEventListener('click', () => {
        this.currentPage = 1; // Reset to first page on new search
        this.applyFiltersAndSort();
      });
    }
    
    // Clear button
    const clearBtn = document.getElementById('clearBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.clearFilters();
      });
    }
    
    // Enter key in search field triggers search
    const searchFor = document.getElementById('searchFor');
    if (searchFor) {
      searchFor.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.currentPage = 1;
          this.applyFiltersAndSort();
        }
      });
    }
    
    // Sort/Order dropdowns trigger immediate re-sort
    const sortBy = document.getElementById('sortBy');
    const orderBy = document.getElementById('orderBy');
    const pageSize = document.getElementById('pageSize');
    
    if (sortBy) {
      sortBy.addEventListener('change', () => {
        this.sortBy = sortBy.value;
        this.applyFiltersAndSort();
      });
    }
    
    if (orderBy) {
      orderBy.addEventListener('change', () => {
        this.sortOrder = orderBy.value;
        this.applyFiltersAndSort();
      });
    }
    
    if (pageSize) {
      pageSize.addEventListener('change', () => {
        this.pageSize = parseInt(pageSize.value) || 75;
        this.currentPage = 1;
        this.applyFiltersAndSort();
      });
    }

    // Conf # links - delegated event handling
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('conf-link')) {
        e.preventDefault();
        const confNumber = e.target.dataset.conf || e.target.textContent;
        this.openReservationInParent(confNumber);
      }
      if (e.target.classList.contains('select-link')) {
        e.preventDefault();
        const row = e.target.closest('tr');
        const confNumber = row?.querySelector('.conf-link')?.dataset?.conf;
        if (confNumber) this.selectReservation(confNumber);
      }
    });
  }
  
  /**
   * Clear all filters and show all reservations
   */
  clearFilters() {
    const searchFor = document.getElementById('searchFor');
    const searchIn = document.getElementById('searchIn');
    const dateFrom = document.getElementById('dateFrom');
    const dateTo = document.getElementById('dateTo');
    
    if (searchFor) searchFor.value = '';
    if (searchIn) searchIn.value = 'all';
    if (dateFrom) dateFrom.value = '';
    if (dateTo) dateTo.value = '';
    
    this.currentPage = 1;
    this.applyFiltersAndSort();
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
