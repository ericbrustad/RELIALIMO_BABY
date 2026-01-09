const FARMOUT_STATUS_ALIASES = {
  '': '',
  farm_out_unassigned: 'unassigned',
  farmout_unassigned: 'unassigned',
  created_farm_out_unassigned: 'unassigned',
  created_farmout_unassigned: 'unassigned',
  farm_out_assigned: 'assigned',
  farmout_assigned: 'assigned',
  created_farm_out_assigned: 'assigned',
  created_farmout_assigned: 'assigned',
  farm_out_offered: 'offered',
  farmout_offered: 'offered',
  farm_out_declined: 'declined',
  farmout_declined: 'declined',
  farm_out_completed: 'completed',
  farmout_completed: 'completed',
  done: 'completed',
  en_route: 'enroute',
  enroute: 'enroute',
  passenger_on_board: 'passenger_onboard',
  passenger_on_boarded: 'passenger_onboard',
  passenger_on_boarding: 'passenger_onboard',
  inhouse: 'in_house',
  'in-house': 'in_house',
  in_house_dispatch: 'in_house'
};

const FARMOUT_STATUS_LABELS = {
  unassigned: 'Farm-out Unassigned',
  farm_out_unassigned: 'Farm-out Unassigned',
  farmout_unassigned: 'Farm-out Unassigned',
  offered: 'Farm-out Offered',
  assigned: 'Farm-out Assigned',
  farm_out_assigned: 'Farm-out Assigned',
  farmout_assigned: 'Farm-out Assigned',
  declined: 'Farm-out Declined',
  enroute: 'Farm-out En Route',
  'en_route': 'Farm-out En Route',
  arrived: 'Farm-out Arrived',
  passenger_onboard: 'Passenger On Board',
  passenger_on_board: 'Passenger On Board',
  completed: 'Farm-out Completed',
  in_house: 'In-house Dispatch',
  inhouse: 'In-house Dispatch',
  offered_to_affiliate: 'Offered to Affiliate',
  affiliate_assigned: 'Affiliate Assigned',
  affiliate_driver_assigned: 'Affiliate Driver Assigned',
  driver_en_route: 'Driver En Route',
  on_the_way: 'Driver On The Way',
  driver_waiting_at_pickup: 'Driver Waiting at Pickup',
  waiting_at_pickup: 'Waiting at Pickup',
  driver_circling: 'Driver Circling',
  customer_in_car: 'Customer In Car',
  driving_passenger: 'Driving Passenger',
  cancelled: 'Farm-out Cancelled',
  cancelled_by_affiliate: 'Cancelled by Affiliate',
  late_cancel: 'Late Cancel',
  late_cancelled: 'Late Cancelled',
  no_show: 'No Show',
  covid19_cancellation: 'COVID-19 Cancellation',
  done: 'Trip Done'
};

function normalizeFarmoutKey(value) {
  return value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/__+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function canonicalizeFarmoutStatus(status) {
  if (!status) {
    return '';
  }
  const normalized = normalizeFarmoutKey(status);
  const alias = FARMOUT_STATUS_ALIASES[normalized];
  return alias || normalized;
}

export class UIManager {
  constructor(reservationManager, mapManager) {
    this.reservationManager = reservationManager;
    this.mapManager = mapManager;
    this.currentView = 'userView';
    this.currentFilter = 'all';
    this.currentFarmoutReservationFilter = 'all';
    this.currentFarmoutStatusFilter = 'all';
    this.currentFarmoutModeFilter = 'all';
    this.selectedFarmoutReservationId = null;
    this.driverDirectory = [];
    this.farmoutActivity = [];
    this.interactionGuardInstalled = false;
    this.automationService = null;
    this.boundHandleDelegatedClick = this.handleDelegatedClick.bind(this);
    try {
      this.currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
    } catch (error) {
      console.warn('Currency formatter unavailable:', error);
      this.currencyFormatter = null;
    }
  }

  init() {
    // Set initial date/time
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const time = now.toTimeString().slice(0, 5);
    
    document.getElementById('pickupDate').value = today;
    document.getElementById('pickupTime').value = time;

    this.bindFarmoutControls();
        this.installInteractionGuards();
  }

  setAutomationService(service) {
    this.automationService = service || null;
  }

  switchView(viewId) {
    // Hide all views
    document.querySelectorAll('.view').forEach(view => {
      view.classList.remove('active');
    });

    // Show selected view
    document.getElementById(viewId).classList.add('active');

    // Update active tab
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.remove('active');
    });

    if (viewId === 'userView') {
      document.getElementById('userViewBtn').classList.add('active');
    } else if (viewId === 'driverView') {
      document.getElementById('driverViewBtn').classList.add('active');
    } else if (viewId === 'reservationsView') {
      document.getElementById('reservationsBtn').classList.add('active');
    } else if (viewId === 'farm-out_reservations_View') {
      document.getElementById('farmOutBtn').classList.add('active');
    }

    this.currentView = viewId;

    // Update maps when switching views
    setTimeout(() => {
      if (viewId === 'userView') {
        this.mapManager.userMap.invalidateSize();
        this.updateUserMap();
      } else if (viewId === 'driverView') {
        this.mapManager.driverMap.invalidateSize();
        this.updateDriverView();
      } else if (viewId === 'farm-out_reservations_View') {
        this.updateFarmoutTable();
      }
    }, 100);
  }

  updateAllViews() {
    this.updateUserMap();
    this.updateDriverView();
    this.updateReservationsTable();
  }

  updateUserMap() {
    const allReservations = this.reservationManager.getAllReservations();
    this.mapManager.addUserMapMarkers(allReservations);
  }

  updateDriverView() {
    const pendingReservations = this.reservationManager.getReservationsByStatus('pending');
    const container = document.getElementById('availableReservations');

    if (pendingReservations.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🚗</div>
          <div class="empty-state-text">No available reservations at the moment</div>
        </div>
      `;
    } else {
      container.innerHTML = pendingReservations.map(reservation => 
        this.createReservationCard(reservation, true)
      ).join('');

      // Add event listeners for accept buttons
      container.querySelectorAll('.btn-success').forEach((btn, index) => {
        btn.addEventListener('click', () => {
          this.handleAcceptReservation(pendingReservations[index].id);
        });
      });

      // Add event listeners for view on map buttons
      container.querySelectorAll('.btn-secondary').forEach((btn, index) => {
        btn.addEventListener('click', () => {
          this.mapManager.focusOnReservation(pendingReservations[index], this.mapManager.driverMap);
        });
      });
    }

    // Update driver map
    const allReservations = this.reservationManager.getAllReservations();
    this.mapManager.addDriverMapMarkers(allReservations);
  }

  createReservationCard(reservation, showAcceptButton = false) {
    return `
      <div class="reservation-card ${reservation.status}">
        <div class="card-header">
          <span class="card-id">Reservation #${reservation.id}</span>
          <span class="status-badge ${reservation.status}">${reservation.status}</span>
        </div>
        <div class="card-body">
          <div class="card-field">
            <span class="field-label">Passenger:</span>
            <span class="field-value">${reservation.passengerName}</span>
          </div>
          <div class="card-field">
            <span class="field-label">Phone:</span>
            <span class="field-value">${reservation.phone}</span>
          </div>
          <div class="card-field">
            <span class="field-label">Pickup:</span>
            <span class="field-value">${reservation.pickupLocation}</span>
          </div>
          <div class="card-field">
            <span class="field-label">Dropoff:</span>
            <span class="field-value">${reservation.dropoffLocation}</span>
          </div>
          <div class="card-field">
            <span class="field-label">Date/Time:</span>
            <span class="field-value">${reservation.pickupDate} ${reservation.pickupTime}</span>
          </div>
          <div class="card-field">
            <span class="field-label">Vehicle:</span>
            <span class="field-value">${this.reservationManager.getVehicleTypeLabel(reservation.vehicleType)}</span>
          </div>
          <div class="card-field">
            <span class="field-label">Passengers:</span>
            <span class="field-value">${reservation.passengers}</span>
          </div>
          <div class="card-field">
            <span class="field-label">Farm-out:</span>
            <span class="field-value farmout-tag ${canonicalizeFarmoutStatus(reservation.farmoutStatus || 'unassigned') || 'unassigned'}">${this.formatFarmoutStatus(reservation.farmoutStatus || 'unassigned')}</span>
          </div>
          <div class="card-field">
            <span class="field-label">Mode:</span>
            <span class="field-value">${(reservation.farmoutMode || 'manual').toUpperCase()}</span>
          </div>
          ${reservation.specialInstructions ? `
            <div class="card-field">
              <span class="field-label">Instructions:</span>
              <span class="field-value">${reservation.specialInstructions}</span>
            </div>
          ` : ''}
          ${reservation.driverName ? `
            <div class="card-field">
              <span class="field-label">Driver:</span>
              <span class="field-value">${reservation.driverName}</span>
            </div>
          ` : ''}
          ${reservation.driverSnapshot ? `
            <div class="card-field">
              <span class="field-label">Affiliate:</span>
              <span class="field-value">${reservation.driverSnapshot.affiliate || '-'}</span>
            </div>
          ` : ''}
        </div>
        ${showAcceptButton ? `
          <div class="card-actions">
            <button class="btn btn-success">Accept Reservation</button>
            <button class="btn btn-secondary">View on Map</button>
          </div>
        ` : ''}
      </div>
    `;
  }

  handleAcceptReservation(reservationId) {
    const driverName = prompt('Enter driver name:');
    if (driverName && driverName.trim()) {
      this.reservationManager.acceptReservation(reservationId, driverName.trim());
      this.updateAllViews();
      alert(`Reservation #${reservationId} accepted successfully!`);
    }
  }

  filterReservations(filter, context = 'reservations') {
    if (context === 'farmout') {
      this.currentFarmoutReservationFilter = filter;
      this.updateFarmoutTable();
    } else {
      this.currentFilter = filter;
      this.updateAllReservationsTable();
    }
  }

  updateReservationsTable() {
    this.updateFarmoutTable();
    this.updateAllReservationsTable();
  }

  renderReservationsFromDb(allReservations, farmOutReservations) {
    this.renderStandardReservationTable(
      document.getElementById('allReservationsList'),
      allReservations || []
    );
    this.renderFarmoutTable(
      document.getElementById('allReservations'),
      farmOutReservations || []
    );
  }
  updateAllReservationsTable() {
    const container = document.getElementById('allReservationsList');
    if (!container) return;

    let reservations = this.reservationManager.getAllReservations();
    if (this.currentFilter !== 'all') {
      reservations = reservations.filter(r => r.status === this.currentFilter);
    }

    this.renderStandardReservationTable(container, reservations);
  }

  updateFarmoutTable() {
    const container = document.getElementById('allReservations');
    if (!container) return;

    let reservations = this.reservationManager.getAllReservations();
    
    // CRITICAL: Only show reservations that are explicitly marked for farmout
    // A reservation must have:
    // 1. farmOption set to "farm-out" (radio button selected in affiliate field)
    // AND/OR
    // 2. Status is farmout_unassigned or farmout_assigned
    reservations = reservations.filter(r => {
      // Check if farmOption is set to farm-out (check multiple possible locations)
      const farmOptionRaw = r.farmOption || r.farm_option || 
                            r.form_snapshot?.details?.farmOption ||
                            r.formSnapshot?.details?.farmOption || '';
      const farmOptionNormalized = normalizeFarmoutKey(farmOptionRaw);
      const hasFarmOutOption = farmOptionNormalized === 'farm_out' || farmOptionNormalized === 'farmout';
      
      // Check if status indicates farmout
      const status = (r.status || '').toLowerCase().replace(/[\s-]/g, '_');
      const isFarmoutStatus = status === 'farmout_unassigned' || 
                              status === 'farmout_assigned' ||
                              status === 'created_farmout_unassigned' ||
                              status === 'created_farmout_assigned';
      
      // Only include if BOTH conditions are met, or at least the farmOption is set
      // The farmOption radio button is the primary indicator
      return hasFarmOutOption || isFarmoutStatus;
    });

    if (this.currentFarmoutReservationFilter !== 'all') {
      reservations = reservations.filter(r => (r.status || 'pending') === this.currentFarmoutReservationFilter);
    }

    if (this.currentFarmoutStatusFilter !== 'all') {
      const statusFilterCanonical = canonicalizeFarmoutStatus(this.currentFarmoutStatusFilter) || 'unassigned';
      reservations = reservations.filter(r => canonicalizeFarmoutStatus(r.farmoutStatus || 'unassigned') === statusFilterCanonical);
    }

    if (this.currentFarmoutModeFilter !== 'all') {
      const modeFilterNormalized = normalizeFarmoutKey(this.currentFarmoutModeFilter) || 'manual';
      reservations = reservations.filter(r => normalizeFarmoutKey(r.farmoutMode || 'manual') === modeFilterNormalized);
    }

    this.renderFarmoutTable(container, reservations);
  }

  renderStandardReservationTable(container, reservations) {
    if (!container) return;

    if (!reservations.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📋</div>
          <div class="empty-state-text">No reservations found</div>
        </div>
      `;
      return;
    }

    let html = `
      <div class="table-row header">
        <div class="table-cell">ID</div>
        <div class="table-cell">Passenger</div>
        <div class="table-cell">Pickup</div>
        <div class="table-cell">Dropoff</div>
        <div class="table-cell">Date</div>
        <div class="table-cell">Time</div>
        <div class="table-cell">Status</div>
        <div class="table-cell">Farm-out</div>
        <div class="table-cell">Driver</div>
      </div>
    `;

    reservations.forEach(reservation => {
      const statusClass = (reservation.status || '').toString().toLowerCase() || 'pending';
      const statusLabel = reservation.statusLabel || reservation.status || '—';
      const passengerName = reservation.passengerName || '—';
      const farmoutStatusValue = reservation.farmoutStatus || 'unassigned';
      const farmoutStatus = canonicalizeFarmoutStatus(farmoutStatusValue) || 'unassigned';
      const pickupLocation = reservation.pickupLocation || '—';
      const dropoffLocation = reservation.dropoffLocation || '—';
      const pickupDate = reservation.pickupDate || '—';
      const pickupTime = reservation.pickupTime || '—';
      const driverLabel = reservation.driverName || reservation.driverSnapshot?.name || '—';

      html += `
        <div class="table-row">
          <div class="table-cell">#${reservation.id}</div>
          <div class="table-cell">${passengerName}</div>
          <div class="table-cell">${pickupLocation}</div>
          <div class="table-cell">${dropoffLocation}</div>
          <div class="table-cell">${pickupDate}</div>
          <div class="table-cell">${pickupTime}</div>
          <div class="table-cell">
            <span class="status-badge ${statusClass}">${statusLabel}</span>
          </div>
          <div class="table-cell">
            <span class="farmout-chip ${farmoutStatus}">${this.formatFarmoutStatus(farmoutStatusValue)}</span>
          </div>
          <div class="table-cell">${driverLabel}</div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  renderFarmoutTable(container, reservations) {
    if (!container) return;

    if (!reservations.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📋</div>
          <div class="empty-state-text">No farm-out reservations</div>
        </div>
      `;
      this.hideFarmoutDetailPanel();
      return;
    }

    let html = `
      <div class="table-row header farmout">
        <div class="table-cell">Confirmation #</div>
        <div class="table-cell">Passenger</div>
        <div class="table-cell">Pickup Time</div>
        <div class="table-cell">Pickup Address</div>
        <div class="table-cell">Dropoff Address</div>
        <div class="table-cell">Farm-out</div>
        <div class="table-cell">Mode</div>
        <div class="table-cell">Payout</div>
        <div class="table-cell">Driver</div>
      </div>
    `;

    reservations.forEach(reservation => {
      const rawFarmoutStatus = reservation.farmoutStatus || 'unassigned';
      const farmoutStatus = canonicalizeFarmoutStatus(rawFarmoutStatus) || 'unassigned';
      const isSelected = String(reservation.id) === String(this.selectedFarmoutReservationId);
      const confirmationLabel = this.resolveConfirmationNumber(reservation);
      const passengerLabel = this.resolvePassengerName(reservation);
      const pickupTimeLabel = this.resolvePickupTime(reservation);
      const pickupLabel = this.resolveLocation(reservation, 'pickup');
      const dropoffLabel = this.resolveLocation(reservation, 'dropoff');
      const driverLabel = this.resolveDriverName(reservation);
      const payoutValue = this.resolveFarmoutPayout(reservation);
      const payoutLabel = this.formatCurrencyDisplay(payoutValue);
      const modeCanonical = normalizeFarmoutKey(reservation.farmoutMode || 'manual') || 'manual';
      const modeLabel = modeCanonical === 'automatic' ? 'AUTOMATIC' : modeCanonical.toUpperCase();

      html += `
        <div class="table-row farmout ${isSelected ? 'selected' : ''}" data-reservation-id="${reservation.id}">
          <div class="table-cell">${confirmationLabel}</div>
          <div class="table-cell">${passengerLabel}</div>
          <div class="table-cell">${pickupTimeLabel}</div>
          <div class="table-cell">${pickupLabel}</div>
          <div class="table-cell">${dropoffLabel}</div>
          <div class="table-cell">
            <span class="farmout-chip ${farmoutStatus}">${this.formatFarmoutStatus(rawFarmoutStatus)}</span>
          </div>
          <div class="table-cell">${modeLabel}</div>
          <div class="table-cell">${payoutLabel}</div>
          <div class="table-cell">${driverLabel}</div>
        </div>
      `;
    });

    container.innerHTML = html;
    this.bindFarmoutRowEvents(container);
  }

  hideFarmoutDetailPanel() {
    const panel = document.getElementById('farmoutDetailPanel');
    if (!panel) return;
    panel.classList.add('hidden');
    this.selectedFarmoutReservationId = null;

    const titleEl = document.getElementById('farmoutDetailTitle');
    if (titleEl) {
      titleEl.textContent = 'Select a reservation to manage farm-out workflow';
    }

    const statusEl = document.getElementById('farmoutDetailStatus');
    if (statusEl) {
      statusEl.className = 'status-badge pending';
      statusEl.textContent = 'PENDING';
    }

    const snapshotEl = document.getElementById('farmoutDriverSnapshot');
    if (snapshotEl) {
      snapshotEl.classList.add('empty');
      snapshotEl.innerHTML = '<p>No driver assigned.</p>';
    }

    const activityEl = document.getElementById('farmoutActivityLog');
    if (activityEl) {
      activityEl.innerHTML = '<p class="activity-empty">No farm-out activity yet.</p>';
    }

    if (this.automationService) {
      this.automationService.updateAutomationStatusDisplay(null);
    }
  }

  bindFarmoutControls() {
    const statusFilter = document.getElementById('farmoutStatusFilter');
    if (statusFilter) {
      statusFilter.addEventListener('change', (event) => {
        this.currentFarmoutStatusFilter = event.target.value;
        this.updateFarmoutTable();
      });
    }

    const modeFilter = document.getElementById('farmoutModeFilter');
    if (modeFilter) {
      modeFilter.addEventListener('change', (event) => {
        this.currentFarmoutModeFilter = event.target.value;
        this.updateFarmoutTable();
      });
    }

    const refreshBtn = document.getElementById('farmoutRefreshMap');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.updateUserMap();
        this.mapManager.addDriverMapMarkers(this.reservationManager.getAllReservations());
      });
    }

    const availabilityBtn = document.getElementById('farmoutAvailabilityBtn');
    if (availabilityBtn) {
      availabilityBtn.addEventListener('click', () => {
        this.showFarmoutToolShell('driver-availability.html', 'Availability Console');
      });
    }

    const tripStatusBtn = document.getElementById('farmoutTripStatusBtn');
    if (tripStatusBtn) {
      tripStatusBtn.addEventListener('click', () => {
        this.showFarmoutToolShell('driver-trip-monitor.html', 'Trip Monitor');
      });
    }

    const farmoutToolBack = document.getElementById('farmoutToolBack');
    if (farmoutToolBack) {
      farmoutToolBack.addEventListener('click', () => {
        this.hideFarmoutToolShell();
        this.switchView('farm-out_reservations_View');
      });
    }
    const modeToggle = document.getElementById('farmoutModeToggle');
    if (modeToggle) {
      modeToggle.querySelectorAll('button').forEach(button => {
        button.addEventListener('click', () => {
          const mode = button.dataset.mode;
          this.handleFarmoutModeChange(mode);
        });
      });
    }

    const assignBtn = document.getElementById('farmoutAssignBtn');
    if (assignBtn) {
      assignBtn.addEventListener('click', () => this.handleFarmoutAssignment());
    }

    const clearBtn = document.getElementById('farmoutClearBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.handleFarmoutClear());
    }

    const sendOfferBtn = document.getElementById('farmoutSendOffer');
    if (sendOfferBtn) {
      sendOfferBtn.addEventListener('click', () => this.handleFarmoutOffer());
    }

    const copyLinkBtn = document.getElementById('farmoutCopyLink');
    if (copyLinkBtn) {
      copyLinkBtn.addEventListener('click', () => this.handleTripLinkCopy());
    }
  }

  showFarmoutToolShell(url, label) {
    const shell = document.getElementById('farmoutToolShell');
    const frame = document.getElementById('farmoutToolFrame');
    const labelEl = document.getElementById('farmoutToolLabel');
    const main = document.getElementById('mainContent');
    const toolButtons = Array.from(document.querySelectorAll('.farmout-tool-btn'));
    if (!shell || !frame || !main) return;

    if (labelEl) {
      labelEl.textContent = label || 'Farm-out Tool';
    }
    if (url) {
      frame.src = url;
    }

    shell.style.display = 'block';
    main.classList.add('hidden');

    if (toolButtons.length) {
      toolButtons.forEach(btn => {
        const isActive = btn.dataset.toolUrl === url;
        btn.classList.toggle('active', Boolean(isActive));
      });
    }
  }

  hideFarmoutToolShell() {
    const shell = document.getElementById('farmoutToolShell');
    const main = document.getElementById('mainContent');
    const toolButtons = Array.from(document.querySelectorAll('.farmout-tool-btn'));
    if (shell) shell.style.display = 'none';
    if (main) main.classList.remove('hidden');
    if (toolButtons.length) {
      toolButtons.forEach(btn => btn.classList.remove('active'));
    }
  }

  installInteractionGuards() {
    if (this.interactionGuardInstalled) {
      return;
    }

    document.addEventListener('click', this.boundHandleDelegatedClick, true);
    this.interactionGuardInstalled = true;
    this.verifyTabGuardHealth();
  }

  handleDelegatedClick(event) {
    try {
      const appRoot = document.getElementById('app');
      if (!appRoot || !event.target || !appRoot.contains(event.target)) {
        return;
      }

      const tabButton = event.target.closest('.tab-btn');
      if (tabButton) {
        // Allow farmout tool buttons to bubble to their own handlers
        if (tabButton.classList.contains('farmout-tool-btn')) {
          return;
        }
        const viewId = this.resolveViewIdFromTab(tabButton);
        if (viewId) {
          event.preventDefault();
          this.guardedSwitchView(viewId, tabButton);
        }
        return;
      }

      const filterButton = event.target.closest('.filter-btn');
      if (filterButton) {
        const bar = filterButton.closest('.filter-bar');
        const context = bar?.dataset.context === 'farmout' ? 'farmout' : 'reservations';
        const filter = filterButton.dataset.filter || 'all';
        event.preventDefault();
        this.guardedApplyFilter(filterButton, bar, filter, context);
      }
    } catch (error) {
      console.error('[UIManager] Delegated interaction guard failure:', error);
    }
  }

  resolveViewIdFromTab(button) {
    if (!button) {
      return null;
    }

    const id = button.id || '';
    if (id === 'userViewBtn') return 'userView';
    if (id === 'driverViewBtn') return 'driverView';
    if (id === 'reservationsBtn') return 'reservationsView';
    if (id === 'farmOutBtn') return 'farm-out_reservations_View';

    const target = button.dataset?.view;
    return target || null;
  }

  guardedSwitchView(viewId, sourceEl) {
    try {
      this.switchView(viewId);
    } catch (error) {
      console.error('[UIManager] Failed to switch view', { viewId, sourceEl, error });
    }
  }

  guardedApplyFilter(button, bar, filter, context) {
    try {
      if (bar) {
        bar.querySelectorAll('.filter-btn').forEach(node => node.classList.remove('active'));
      }
      if (button) {
        button.classList.add('active');
      }
      this.filterReservations(filter, context);
    } catch (error) {
      console.error('[UIManager] Failed to apply filter', { filter, context, error });
    }
  }

  verifyTabGuardHealth() {
    try {
      const expectedTabs = ['userViewBtn', 'driverViewBtn', 'reservationsBtn', 'farmOutBtn'];
      const missing = expectedTabs.filter(id => !document.getElementById(id));
      if (missing.length) {
        console.warn('[UIManager] Tab guard health warning: missing tab button(s):', missing.join(', '));
      }

      document.querySelectorAll('.filter-bar').forEach(bar => {
        if (!bar.querySelector('.filter-btn')) {
          console.warn('[UIManager] Filter guard health warning: filter bar missing buttons:', bar);
        }
      });
    } catch (error) {
      console.error('[UIManager] Unable to verify tab guard health:', error);
    }
  }

  bindFarmoutRowEvents(container) {
    container.querySelectorAll('.table-row.farmout[data-reservation-id]').forEach(row => {
      row.addEventListener('click', () => {
        const reservationId = parseInt(row.dataset.reservationId, 10);
        if (!Number.isNaN(reservationId)) {
          this.selectFarmoutReservation(reservationId);
        }
      });
    });
  }

  selectFarmoutReservation(reservationId) {
    const reservation = this.reservationManager.getReservationById(reservationId);
    if (!reservation) {
      alert('Interactive farm-out controls are available for local reservations only.');
      return;
    }

    this.selectedFarmoutReservationId = String(reservation.id);
    this.showFarmoutDetail(reservation);
    this.updateFarmoutTable();
  }

  showFarmoutDetail(reservation) {
    const panel = document.getElementById('farmoutDetailPanel');
    const titleEl = document.getElementById('farmoutDetailTitle');
    const statusEl = document.getElementById('farmoutDetailStatus');
    if (!panel || !titleEl || !statusEl) return;

    panel.classList.remove('hidden');
    titleEl.textContent = `#${reservation.id} • ${reservation.passengerName}`;
    this.updateFarmoutStatusBadge(statusEl, reservation.farmoutStatus || 'unassigned');
    this.updateModeToggle(reservation.farmoutMode || 'manual');
    this.populateDriverSelect(reservation.driverId);
    this.updateDriverSnapshot(reservation.driverSnapshot);
    this.renderActivityLog(reservation.id);
    if (this.automationService) {
      this.automationService.handleReservationSelected(reservation);
    }
  }

  updateModeToggle(activeMode) {
    const modeToggle = document.getElementById('farmoutModeToggle');
    if (!modeToggle) return;

    const activeCanonical = normalizeFarmoutKey(activeMode || 'manual') || 'manual';

    modeToggle.querySelectorAll('button').forEach(button => {
      const buttonCanonical = normalizeFarmoutKey(button.dataset.mode || '');
      if (buttonCanonical === activeCanonical) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    });
  }

  populateDriverSelect(selectedDriverId = null) {
    const select = document.getElementById('farmoutDriverSelect');
    if (!select) return;

    const previous = select.value;
    select.innerHTML = '<option value="">Select available driver</option>';

    this.driverDirectory
      .filter(driver => driver.status === 'available' || String(driver.id) === String(selectedDriverId))
      .forEach(driver => {
        const option = document.createElement('option');
        option.value = driver.id;
        option.textContent = `${driver.name} • ${driver.vehicle}`;
        if (selectedDriverId && String(driver.id) === String(selectedDriverId)) {
          option.selected = true;
        }
        select.appendChild(option);
      });

    if (!selectedDriverId && previous) {
      select.value = previous;
    }
  }

  updateDriverSnapshot(snapshot) {
    const snapshotEl = document.getElementById('farmoutDriverSnapshot');
    if (!snapshotEl) return;

    if (!snapshot) {
      snapshotEl.classList.add('empty');
      snapshotEl.innerHTML = '<p>No driver assigned.</p>';
      return;
    }

    snapshotEl.classList.remove('empty');
    snapshotEl.innerHTML = `
      <div class="snapshot-name">${snapshot.name || 'Driver'}</div>
      <div class="snapshot-meta">${snapshot.vehicleType || 'Vehicle not set'}</div>
      <div class="snapshot-meta">Affiliate: ${snapshot.affiliate || 'N/A'}</div>
      <div class="snapshot-meta">Phone: ${snapshot.phone || 'N/A'}</div>
    `;
  }

  updateFarmoutStatusBadge(element, status) {
    const canonical = canonicalizeFarmoutStatus(status) || 'unassigned';
    element.textContent = this.formatFarmoutStatus(canonical).toUpperCase();
    element.className = `status-badge ${canonical}`;
  }

  formatFarmoutStatus(status) {
    const canonical = canonicalizeFarmoutStatus(status);
    if (!canonical) {
      return FARMOUT_STATUS_LABELS.unassigned;
    }

    const mapped = FARMOUT_STATUS_LABELS[canonical];
    if (mapped) {
      return mapped;
    }

    return canonical
      .split(/[_\-\s]+/)
      .filter(Boolean)
      .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(' ');
  }

  resolveConfirmationNumber(reservation) {
    const raw = this.getUnderlyingReservation(reservation);
    const snapshotDetails = raw?.form_snapshot?.details || {};
    const candidates = [
      reservation?.confirmationNumber,
      reservation?.confirmation_number,
      raw?.confirmationNumber,
      raw?.confirmation_number,
      raw?.confirmation,
      snapshotDetails?.confirmationNumber,
      snapshotDetails?.confirmation_number,
      reservation?.id,
      raw?.id
    ];
    const value = this.pickFirstStringValue(candidates);
    return value || '—';
  }

  resolvePassengerName(reservation) {
    const raw = this.getUnderlyingReservation(reservation);
    const snapshotPassenger = raw?.form_snapshot?.passenger || raw?.form_snapshot?.details?.passenger || {};
    const leadFullName = `${raw?.lead_passenger_first_name || ''} ${raw?.lead_passenger_last_name || ''}`.trim();
    const snapshotFullName = snapshotPassenger?.fullName || `${snapshotPassenger?.firstName || ''} ${snapshotPassenger?.lastName || ''}`.trim();
    const candidates = [
      reservation?.passengerName,
      reservation?.passenger_name,
      raw?.passengerName,
      raw?.passenger_name,
      raw?.customerName,
      leadFullName,
      snapshotFullName
    ];
    const value = this.pickFirstStringValue(candidates);
    return value || '—';
  }

  resolvePickupTime(reservation) {
    const raw = this.getUnderlyingReservation(reservation);
    const snapshotDetails = raw?.form_snapshot?.details || {};
    const candidates = [
      reservation?.pickupTime,
      reservation?.pickup_time,
      raw?.pickupTime,
      raw?.pickup_time,
      reservation?.pickup_at,
      raw?.pickup_at,
      snapshotDetails?.pickupTime,
      snapshotDetails?.puTime
    ];
    for (const candidate of candidates) {
      const formatted = this.formatPickupTimeCandidate(candidate);
      if (formatted) {
        return formatted;
      }
    }
    return '—';
  }

  resolveLocation(reservation, type) {
    const raw = this.getUnderlyingReservation(reservation);
    const normalized = type === 'dropoff' ? 'dropoff' : 'pickup';
    const snapshotDetails = raw?.form_snapshot?.details || {};
    const keyRoot = normalized.charAt(0).toUpperCase() + normalized.slice(1);
    const candidates = [
      reservation?.[`${normalized}Location`],
      reservation?.[`${normalized}_location`],
      reservation?.[`${normalized}Address`],
      reservation?.[`${normalized}_address`],
      raw?.[`${normalized}Location`],
      raw?.[`${normalized}_location`],
      raw?.[`${normalized}Address`],
      raw?.[`${normalized}_address`],
      raw?.[`${normalized}LocationName`],
      raw?.[`${normalized}_location_name`],
      snapshotDetails?.[`${normalized}Address`],
      snapshotDetails?.[`${keyRoot}Address`],
      snapshotDetails?.[`${normalized}Location`]
    ];
    const value = this.pickFirstStringValue(candidates);
    return value || '—';
  }

  resolveDriverName(reservation) {
    const raw = this.getUnderlyingReservation(reservation);
    const snapshotDriver = raw?.form_snapshot?.driver || raw?.form_snapshot?.details?.driver || {};
    const candidates = [
      reservation?.driverSnapshot?.name,
      reservation?.driver_snapshot?.name,
      reservation?.driverName,
      reservation?.driver_name,
      raw?.driverSnapshot?.name,
      raw?.driver_snapshot?.name,
      raw?.driverName,
      raw?.driver_name,
      snapshotDriver?.name
    ];
    const value = this.pickFirstStringValue(candidates);
    return value || '—';
  }

  resolveFarmoutPayout(reservation) {
    const raw = this.getUnderlyingReservation(reservation);
    const financial = raw?.form_snapshot?.financial || {};
    const details = raw?.form_snapshot?.details || {};
    const candidates = [
      reservation?.farmoutPayout,
      reservation?.farmout_payout,
      reservation?.farmOutPayout,
      reservation?.farm_out_payout,
      reservation?.driverPayout,
      reservation?.driver_payout,
      reservation?.payout,
      reservation?.payoutAmount,
      reservation?.payout_amount,
      reservation?.affiliatePayout,
      reservation?.affiliate_payout,
      raw?.farmoutPayout,
      raw?.farmout_payout,
      raw?.farmOutPayout,
      raw?.farm_out_payout,
      raw?.driverPayout,
      raw?.driver_payout,
      raw?.payout,
      raw?.payoutAmount,
      raw?.payout_amount,
      raw?.affiliatePayout,
      raw?.affiliate_payout,
      financial?.farmoutPayout,
      financial?.farmOutPayout,
      financial?.affiliatePayout,
      financial?.driverPayout,
      financial?.payout,
      financial?.payoutAmount,
      financial?.payout_amount,
      details?.farmoutPayout,
      details?.farmOutPayout,
      details?.affiliatePayout,
      details?.driverPayout
    ];

    for (const candidate of candidates) {
      const amount = this.parseCurrencyValue(candidate);
      if (amount !== null) {
        return amount;
      }
    }
    return null;
  }

  pickFirstStringValue(candidates) {
    for (const candidate of candidates) {
      if (candidate === null || candidate === undefined) {
        continue;
      }
      if (Array.isArray(candidate)) {
        const joined = candidate.filter(Boolean).join(' ').trim();
        if (joined) {
          return joined;
        }
        continue;
      }
      const text = String(candidate).trim();
      if (text) {
        return text;
      }
    }
    return null;
  }

  getUnderlyingReservation(reservation) {
    if (!reservation || typeof reservation !== 'object') {
      return {};
    }
    const raw = reservation.raw;
    return raw && typeof raw === 'object' ? raw : reservation;
  }

  formatPickupTimeCandidate(candidate) {
    if (!candidate) {
      return null;
    }
    if (candidate instanceof Date && !Number.isNaN(candidate.getTime())) {
      return candidate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }
    if (Array.isArray(candidate)) {
      return null;
    }
    const text = String(candidate).trim();
    if (!text) {
      return null;
    }
    if (/^\d{1,2}:\d{2}/.test(text)) {
      return text;
    }
    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }
    return text;
  }

  parseCurrencyValue(value) {
    if (value === null || value === undefined) {
      return null;
    }
    if (Array.isArray(value)) {
      for (const entry of value) {
        const parsed = this.parseCurrencyValue(entry);
        if (parsed !== null) {
          return parsed;
        }
      }
      return null;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (value && typeof value === 'object') {
      if (typeof value.amount === 'number' && Number.isFinite(value.amount)) {
        return value.amount;
      }
      if (typeof value.amount === 'string') {
        return this.parseCurrencyValue(value.amount);
      }
      return null;
    }
    if (typeof value === 'string') {
      const normalized = value.replace(/[^0-9.\-]/g, '');
      if (!normalized) {
        return null;
      }
      const parsed = Number.parseFloat(normalized);
      return Number.isNaN(parsed) ? null : parsed;
    }
    return null;
  }

  formatCurrencyDisplay(value) {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return '—';
    }
    if (this.currencyFormatter) {
      try {
        return this.currencyFormatter.format(value);
      } catch (error) {
        console.warn('Currency format failed:', error);
      }
    }
    return `$${Number(value).toFixed(2)}`;
  }

  handleFarmoutModeChange(mode) {
    if (!this.selectedFarmoutReservationId) return;
    const canonicalMode = normalizeFarmoutKey(mode || 'manual') || 'manual';
    this.reservationManager.setFarmoutMode(this.selectedFarmoutReservationId, canonicalMode);
    this.updateModeToggle(canonicalMode);
    this.logFarmoutActivity(this.selectedFarmoutReservationId, `Mode set to ${canonicalMode.toUpperCase()}`);
  }

  handleFarmoutAssignment() {
    if (!this.selectedFarmoutReservationId) return;
    const select = document.getElementById('farmoutDriverSelect');
    if (!select) return;

    const driverId = parseInt(select.value, 10);
    if (Number.isNaN(driverId)) {
      alert('Select a driver to assign.');
      return;
    }

    const driverInfo = this.driverDirectory.find(driver => driver.id === driverId);
    if (!driverInfo) {
      alert('Driver not found.');
      return;
    }

    this.reservationManager.assignFarmoutDriver(this.selectedFarmoutReservationId, {
      id: driverInfo.id,
      name: driverInfo.name,
      affiliate: driverInfo.affiliate || '',
      phone: driverInfo.phone || '',
      vehicleType: driverInfo.vehicle
    });

    this.logFarmoutActivity(this.selectedFarmoutReservationId, `Assigned to ${driverInfo.name}`);
    this.renderActivityLog(this.selectedFarmoutReservationId);
  }

  handleFarmoutClear() {
    if (!this.selectedFarmoutReservationId) return;
    this.reservationManager.clearFarmoutAssignment(this.selectedFarmoutReservationId);
    this.logFarmoutActivity(this.selectedFarmoutReservationId, 'Assignment cleared');
    this.renderActivityLog(this.selectedFarmoutReservationId);
  }

  handleFarmoutOffer() {
    if (!this.selectedFarmoutReservationId) return;
    const reservation = this.reservationManager.getReservationById(this.selectedFarmoutReservationId);
    if (!reservation) return;

    const driver = reservation.driverSnapshot || this.driverDirectory.find(d => d.id === parseInt(document.getElementById('farmoutDriverSelect')?.value || '', 10));
    if (!driver) {
      alert('Assign or select a driver before sending an offer.');
      return;
    }
    const link = this.buildTripLink(reservation, driver);
    const message = `RELIALIMO offer: ${reservation.passengerName} on ${reservation.pickupDate} at ${reservation.pickupTime}. View trip details: ${link}`;

    const phone = driver?.phone;
    if (phone) {
      const smsUrl = `sms:${phone}?&body=${encodeURIComponent(message)}`;
      window.open(smsUrl, '_blank');
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(message).then(() => {
        alert('Offer copied to clipboard. Paste into your SMS tool.');
      }).catch(() => {
        alert(message);
      });
    } else {
      alert(message);
    }

    this.logFarmoutActivity(reservation.id, 'Offer prepared for driver');
  }

  handleTripLinkCopy() {
    if (!this.selectedFarmoutReservationId) return;
    const reservation = this.reservationManager.getReservationById(this.selectedFarmoutReservationId);
    if (!reservation) return;

    const link = this.buildTripLink(reservation, reservation.driverSnapshot);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(link).then(() => {
        alert('Trip link copied to clipboard.');
      }).catch(() => {
        alert(link);
      });
    } else {
      alert(link);
    }

    this.logFarmoutActivity(reservation.id, 'Trip link copied');
  }

  buildTripLink(reservation, driverSnapshot) {
    const url = new URL('driver-trip-status.html', window.location.href);
    url.searchParams.set('reservation', reservation.id);
    if (driverSnapshot?.id) {
      url.searchParams.set('driver', driverSnapshot.id);
    }
    return url.toString();
  }

  logFarmoutActivity(reservationId, message) {
    this.farmoutActivity.push({
      reservationId,
      message,
      timestamp: new Date().toISOString()
    });

    if (String(this.selectedFarmoutReservationId) === String(reservationId)) {
      this.renderActivityLog(reservationId);
    }
  }

  renderActivityLog(reservationId) {
    const logEl = document.getElementById('farmoutActivityLog');
    if (!logEl) return;

    const entries = this.farmoutActivity.filter(entry => entry.reservationId === reservationId).slice(-12).reverse();
    if (!entries.length) {
      logEl.innerHTML = '<p class="activity-empty">No farm-out activity yet.</p>';
      return;
    }

    const formatter = new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      month: 'short',
      day: 'numeric'
    });

    logEl.innerHTML = entries.map(entry => {
      const time = formatter.format(new Date(entry.timestamp));
      return `<div class="activity-entry"><span class="activity-time">${time}</span><span class="activity-text">${entry.message}</span></div>`;
    }).join('');
  }

  updateFarmoutState(reservation) {
    if (!reservation) return;
    if (this.selectedFarmoutReservationId === reservation.id) {
      this.showFarmoutDetail(reservation);
    }
    this.updateFarmoutTable();
    this.updateAllReservationsTable();
    if (this.automationService) {
      this.automationService.updateAutomationStatusDisplay(reservation.id);
    }
  }

  updateDriverDirectory(drivers) {
    this.driverDirectory = drivers || [];
    const selectedReservation = this.selectedFarmoutReservationId
      ? this.reservationManager.getReservationById(this.selectedFarmoutReservationId)
      : null;
    this.populateDriverSelect(selectedReservation?.driverId || null);
  }
}
