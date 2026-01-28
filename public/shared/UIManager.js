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
  unassigned: 'FU',
  farm_out_unassigned: 'FU',
  farmout_unassigned: 'FU',
  offered: 'FO',
  assigned: 'FA',
  farm_out_assigned: 'FA',
  farmout_assigned: 'FA',
  declined: 'FD',
  enroute: 'FER',
  'en_route': 'FER',
  arrived: 'FAR',
  passenger_onboard: 'POB',
  passenger_on_board: 'POB',
  completed: 'FC',
  in_house: 'IH',
  inhouse: 'IH',
  in_house_assigned: 'IHA',
  in_house_unassigned: 'IHU',
  offered_to_affiliate: 'OTA',
  affiliate_assigned: 'AA',
  affiliate_driver_assigned: 'ADA',
  driver_en_route: 'DER',
  on_the_way: 'OTW',
  driver_waiting_at_pickup: 'DWAP',
  waiting_at_pickup: 'WAP',
  driver_circling: 'DC',
  customer_in_car: 'CIC',
  driving_passenger: 'DP',
  cancelled: 'CAN',
  cancelled_by_affiliate: 'CBA',
  late_cancel: 'LC',
  late_cancelled: 'LC',
  no_show: 'NS',
  covid19_cancellation: 'C19',
  done: 'DONE'
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
    
    // Farmout search state
    this.farmoutSearchTerm = '';
    this.farmoutSearchField = 'all';
    this.farmoutDateFrom = '';
    this.farmoutDateTo = '';
    this.farmoutSortBy = 'pickup_datetime';
    this.farmoutOrderBy = 'asc';
    this.farmoutPageSize = 75;
    this.farmoutCurrentPage = 1;
    this.farmoutFilteredReservations = [];
    
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
    
    // Listen for farmout mode/status changes from reservation form
    document.addEventListener('farmoutModeChanged', (e) => {
      console.log('📋 Farmout mode changed event received:', e.detail);
      this.updateFarmoutTable();
      // Also update the mode toggle in detail panel if same reservation
      if (e.detail?.reservationId && String(e.detail.reservationId) === String(this.selectedFarmoutReservationId)) {
        this.updateModeToggle(e.detail.mode);
      }
    });

    // Listen for farmout offer sent events (from automation service)
    window.addEventListener('farmoutOfferSent', (e) => {
      console.log('📤 Farmout offer sent event received:', e.detail);
      if (e.detail?.reservationId && String(e.detail.reservationId) === String(this.selectedFarmoutReservationId)) {
        const reservation = this.reservationManager.getReservationById(this.selectedFarmoutReservationId);
        if (reservation) {
          // Inject offer data from event
          reservation.current_offer_driver_id = e.detail.driverId;
          reservation.current_offer_sent_at = e.detail.sentAt;
          reservation.current_offer_expires_at = e.detail.expiresAt;
          this.updateOfferStatusIndicator(reservation);
        }
      }
    });
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
    } else if (viewId === 'availabilityView') {
      document.getElementById('availabilityBtn')?.classList.add('active');
    } else if (viewId === 'activeDriversView') {
      document.getElementById('activeDriversBtn')?.classList.add('active');
    } else if (viewId === 'tripMonitorView') {
      document.getElementById('tripMonitorBtn')?.classList.add('active');
    } else if (viewId === 'reservationsIframeView') {
      document.getElementById('reservationsIframeBtn')?.classList.add('active');
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
            <span class="field-value">${(reservation.farmout_mode || reservation.farmoutMode || 'manual').toUpperCase()}</span>
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
    
    // CRITICAL: Only show reservations where farmout_status is an active farmout status
    // This means the reservation is actively in the farmout workflow.
    // If farmout_status is anything else (null, empty, 'completed', etc.), 
    // the reservation should NOT appear in the farmout list.
    reservations = reservations.filter(r => {
      // Get farmout_status from multiple possible locations
      const farmoutStatus = r.farmout_status || r.farmoutStatus || 
                            r.form_snapshot?.details?.farmoutStatus ||
                            r.formSnapshot?.details?.farmoutStatus || '';
      
      // Normalize the status value
      const normalizedStatus = (farmoutStatus || '').toLowerCase().replace(/[\s-]/g, '_');
      
      // Include if farmout_status is an active farmout workflow status
      const isActiveFarmout = normalizedStatus === 'assigned' || 
                              normalizedStatus === 'unassigned' ||
                              normalizedStatus === 'offered' ||
                              normalizedStatus === 'farmout_assigned' ||
                              normalizedStatus === 'farmout_unassigned' ||
                              normalizedStatus === 'farmout_offered';
      
      return isActiveFarmout;
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
      reservations = reservations.filter(r => {
        const mode = r.farmout_mode || r.farmoutMode || 'manual';
        return normalizeFarmoutKey(mode) === modeFilterNormalized;
      });
    }

    // Apply search/filter/sort/pagination from farmout search controls
    reservations = this.filterFarmoutReservations(reservations);

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
      const farmoutStatusValue = reservation.farmoutStatus || reservation.farmout_status || '';
      const farmoutStatus = canonicalizeFarmoutStatus(farmoutStatusValue) || '';
      const farmoutMode = reservation.farmout_mode || reservation.farmoutMode || '';
      const pickupLocation = reservation.pickupLocation || '—';
      const dropoffLocation = reservation.dropoffLocation || '—';
      const pickupDate = reservation.pickupDate || '—';
      const pickupTime = reservation.pickupTime || '—';
      const driverLabel = reservation.driverName || reservation.driverSnapshot?.name || '—';
      
      // Build farmout display with mode indicator
      let farmoutDisplay = '';
      const isFarmout = farmoutStatus && farmoutStatus !== '' && farmoutStatus !== 'in_house';
      if (isFarmout) {
        const modeNormalized = normalizeFarmoutKey(farmoutMode || 'manual');
        const modeLabel = modeNormalized === 'automatic' ? 'A' : 'M';
        const modeClass = modeNormalized === 'automatic' ? 'mode-auto' : 'mode-manual';
        farmoutDisplay = `
          <span class="farmout-chip ${farmoutStatus}">${this.formatFarmoutStatus(farmoutStatusValue)}</span>
          <span class="farmout-mode-indicator ${modeClass}" title="${modeNormalized === 'automatic' ? 'Automatic' : 'Manual'}">${modeLabel}</span>
        `;
      } else {
        farmoutDisplay = `<span class="farmout-chip">—</span>`;
      }

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
          <div class="table-cell">${farmoutDisplay}</div>
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

    // Sort reservations: automatic mode first, then by trip date
    const sortedReservations = [...reservations].sort((a, b) => {
      const modeA = normalizeFarmoutKey(a.farmout_mode || a.farmoutMode || 'manual');
      const modeB = normalizeFarmoutKey(b.farmout_mode || b.farmoutMode || 'manual');
      // Automatic first
      if (modeA === 'automatic' && modeB !== 'automatic') return -1;
      if (modeB === 'automatic' && modeA !== 'automatic') return 1;
      // Then by pickup date/time - use pickup_datetime (canonical) first
      const rawA = a.raw || a;
      const rawB = b.raw || b;
      const dateTimeA = rawA.pickup_datetime || rawA.pickup_at || a.pickupDate || a.pickup_date || '';
      const dateTimeB = rawB.pickup_datetime || rawB.pickup_at || b.pickupDate || b.pickup_date || '';
      // Parse as dates for accurate comparison
      const timeA = new Date(dateTimeA).getTime() || 0;
      const timeB = new Date(dateTimeB).getTime() || 0;
      return timeA - timeB;
    });

    // Find which reservation is actively being offered and which is next
    const activeOfferRes = sortedReservations.find(r => {
      const status = canonicalizeFarmoutStatus(r.farmoutStatus || 'unassigned');
      return status === 'offered' || status === 'searching';
    });
    const automaticReservations = sortedReservations.filter(r => 
      normalizeFarmoutKey(r.farmout_mode || r.farmoutMode || 'manual') === 'automatic' &&
      canonicalizeFarmoutStatus(r.farmoutStatus || 'unassigned') === 'unassigned'
    );
    const nextInQueueRes = activeOfferRes ? null : automaticReservations[0];

    let html = `
      <div class="table-row header farmout">
        <div class="table-cell">Status</div>
        <div class="table-cell">Conf #</div>
        <div class="table-cell">Passenger</div>
        <div class="table-cell">Trip Date</div>
        <div class="table-cell">Pickup Time</div>
        <div class="table-cell">Pickup Address</div>
        <div class="table-cell">Dropoff Address</div>
        <div class="table-cell">Payout</div>
        <div class="table-cell">Mode</div>
        <div class="table-cell">Driver</div>
        <div class="table-cell">Driver Status</div>
      </div>
    `;

    sortedReservations.forEach(reservation => {
      const rawFarmoutStatus = reservation.farmoutStatus || 'unassigned';
      const farmoutStatus = canonicalizeFarmoutStatus(rawFarmoutStatus) || 'unassigned';
      const isSelected = String(reservation.id) === String(this.selectedFarmoutReservationId);
      const confirmationLabel = this.resolveConfirmationNumber(reservation);
      const passengerLabel = this.resolvePassengerName(reservation);
      const tripDateLabel = this.resolveTripDate(reservation);
      const pickupTimeLabel = this.resolvePickupTime(reservation);
      const pickupLabel = this.resolveLocation(reservation, 'pickup');
      const dropoffLabel = this.resolveLocation(reservation, 'dropoff');
      const driverLabel = this.resolveDriverName(reservation);
      const driverStatusInfo = this.resolveDriverStatus(reservation);
      const payoutValue = this.resolveFarmoutPayout(reservation);
      const payoutLabel = this.formatCurrencyDisplay(payoutValue);
      const modeCanonical = normalizeFarmoutKey(reservation.farmout_mode || reservation.farmoutMode || 'manual') || 'manual';
      const modeLabel = modeCanonical === 'automatic' ? 'AUTO' : 'MANUAL';

      // Determine automation status note
      let automationNote = '';
      let automationClass = '';
      if (String(reservation.id) === String(activeOfferRes?.id)) {
        automationNote = '🔄 ACTIVE';
        automationClass = 'automation-active';
      } else if (String(reservation.id) === String(nextInQueueRes?.id)) {
        automationNote = '⏳ NEXT';
        automationClass = 'automation-next';
      }

      html += `
        <div class="table-row farmout ${isSelected ? 'selected' : ''} ${automationClass}" data-reservation-id="${reservation.id}">
          <div class="table-cell">
            <span class="farmout-chip ${farmoutStatus}">${this.formatFarmoutStatus(rawFarmoutStatus)}</span>
            ${automationNote ? `<span class="automation-badge ${automationClass}">${automationNote}</span>` : ''}
          </div>
          <div class="table-cell">${confirmationLabel}</div>
          <div class="table-cell">${passengerLabel}</div>
          <div class="table-cell">${tripDateLabel}</div>
          <div class="table-cell">${pickupTimeLabel}</div>
          <div class="table-cell">${pickupLabel}</div>
          <div class="table-cell">${dropoffLabel}</div>
          <div class="table-cell">${payoutLabel}</div>
          <div class="table-cell"><span class="mode-badge ${modeCanonical}">${modeLabel}</span></div>
          <div class="table-cell">${driverLabel}</div>
          <div class="table-cell"><span class="driver-status-badge ${driverStatusInfo.class}">${driverStatusInfo.label}</span></div>
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

    // Offer status indicator buttons
    const cancelOfferBtn = document.getElementById('cancelOfferBtn');
    if (cancelOfferBtn) {
      cancelOfferBtn.addEventListener('click', () => this.handleCancelOffer());
    }

    const resendOfferBtn = document.getElementById('resendOfferBtn');
    if (resendOfferBtn) {
      resendOfferBtn.addEventListener('click', () => this.handleResendOffer());
    }

    // Farmout search controls
    this.bindFarmoutSearchControls();
  }

  bindFarmoutSearchControls() {
    const searchBtn = document.getElementById('farmoutSearchBtn');
    const clearBtn = document.getElementById('farmoutClearSearchBtn');
    const searchFor = document.getElementById('farmoutSearchFor');
    const searchIn = document.getElementById('farmoutSearchIn');
    const dateFrom = document.getElementById('farmoutDateFrom');
    const dateTo = document.getElementById('farmoutDateTo');
    const sortBy = document.getElementById('farmoutSortBy');
    const orderBy = document.getElementById('farmoutOrderBy');
    const pageSize = document.getElementById('farmoutPageSize');

    if (searchBtn) {
      searchBtn.addEventListener('click', () => this.applyFarmoutSearch());
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clearFarmoutSearch());
    }

    // Enter key triggers search
    if (searchFor) {
      searchFor.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.applyFarmoutSearch();
      });
    }

    // Real-time filter on control changes
    [searchIn, dateFrom, dateTo, sortBy, orderBy, pageSize].forEach(control => {
      if (control) {
        control.addEventListener('change', () => this.applyFarmoutSearch());
      }
    });
  }

  applyFarmoutSearch() {
    // Get current values from controls
    this.farmoutSearchTerm = (document.getElementById('farmoutSearchFor')?.value || '').toLowerCase().trim();
    this.farmoutSearchField = document.getElementById('farmoutSearchIn')?.value || 'all';
    this.farmoutDateFrom = document.getElementById('farmoutDateFrom')?.value || '';
    this.farmoutDateTo = document.getElementById('farmoutDateTo')?.value || '';
    this.farmoutSortBy = document.getElementById('farmoutSortBy')?.value || 'pickup_datetime';
    this.farmoutOrderBy = document.getElementById('farmoutOrderBy')?.value || 'asc';
    this.farmoutPageSize = parseInt(document.getElementById('farmoutPageSize')?.value || '75', 10);
    this.farmoutCurrentPage = 1;

    // Update table with filters applied
    this.updateFarmoutTable();
  }

  clearFarmoutSearch() {
    // Reset control values
    const searchFor = document.getElementById('farmoutSearchFor');
    const searchIn = document.getElementById('farmoutSearchIn');
    const dateFrom = document.getElementById('farmoutDateFrom');
    const dateTo = document.getElementById('farmoutDateTo');
    const sortBy = document.getElementById('farmoutSortBy');
    const orderBy = document.getElementById('farmoutOrderBy');
    const pageSize = document.getElementById('farmoutPageSize');

    if (searchFor) searchFor.value = '';
    if (searchIn) searchIn.value = 'all';
    if (dateFrom) dateFrom.value = '';
    if (dateTo) dateTo.value = '';
    if (sortBy) sortBy.value = 'pickup_datetime';
    if (orderBy) orderBy.value = 'asc';
    if (pageSize) pageSize.value = '75';

    // Reset state
    this.farmoutSearchTerm = '';
    this.farmoutSearchField = 'all';
    this.farmoutDateFrom = '';
    this.farmoutDateTo = '';
    this.farmoutSortBy = 'pickup_datetime';
    this.farmoutOrderBy = 'asc';
    this.farmoutPageSize = 75;
    this.farmoutCurrentPage = 1;

    // Update table
    this.updateFarmoutTable();
  }

  filterFarmoutReservations(reservations) {
    let filtered = [...reservations];

    // Apply search term filter
    if (this.farmoutSearchTerm) {
      filtered = filtered.filter(res => {
        const searchTerm = this.farmoutSearchTerm;
        const raw = res.raw || res;
        
        const fieldsToSearch = {
          all: () => {
            const allText = [
              this.resolveConfirmationNumber(res),
              this.resolvePassengerName(res),
              raw.company_name || '',
              this.resolveDriverName(res),
              this.resolveLocation(res, 'pickup'),
              this.resolveLocation(res, 'dropoff')
            ].join(' ').toLowerCase();
            return allText.includes(searchTerm);
          },
          confirmation: () => (this.resolveConfirmationNumber(res) || '').toLowerCase().includes(searchTerm),
          passenger: () => (this.resolvePassengerName(res) || '').toLowerCase().includes(searchTerm),
          company: () => (raw.company_name || '').toLowerCase().includes(searchTerm),
          driver: () => (this.resolveDriverName(res) || '').toLowerCase().includes(searchTerm),
          pickup: () => (this.resolveLocation(res, 'pickup') || '').toLowerCase().includes(searchTerm),
          dropoff: () => (this.resolveLocation(res, 'dropoff') || '').toLowerCase().includes(searchTerm)
        };

        const searchFn = fieldsToSearch[this.farmoutSearchField] || fieldsToSearch.all;
        return searchFn();
      });
    }

    // Apply date range filter
    if (this.farmoutDateFrom || this.farmoutDateTo) {
      filtered = filtered.filter(res => {
        const raw = res.raw || res;
        const pickupDate = raw.pickup_datetime || raw.pickup_at || res.pickupDate || '';
        if (!pickupDate) return true;
        
        const resDate = new Date(pickupDate).toISOString().split('T')[0];
        
        if (this.farmoutDateFrom && resDate < this.farmoutDateFrom) return false;
        if (this.farmoutDateTo && resDate > this.farmoutDateTo) return false;
        return true;
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
      const rawA = a.raw || a;
      const rawB = b.raw || b;
      let valA, valB;

      switch (this.farmoutSortBy) {
        case 'pickup_datetime':
          valA = new Date(rawA.pickup_datetime || rawA.pickup_at || '').getTime() || 0;
          valB = new Date(rawB.pickup_datetime || rawB.pickup_at || '').getTime() || 0;
          break;
        case 'confirmation_number':
          valA = (this.resolveConfirmationNumber(a) || '').toLowerCase();
          valB = (this.resolveConfirmationNumber(b) || '').toLowerCase();
          break;
        case 'passenger_name':
          valA = (this.resolvePassengerName(a) || '').toLowerCase();
          valB = (this.resolvePassengerName(b) || '').toLowerCase();
          break;
        case 'company_name':
          valA = (rawA.company_name || '').toLowerCase();
          valB = (rawB.company_name || '').toLowerCase();
          break;
        case 'grand_total':
          valA = parseFloat(rawA.grand_total || rawA.payout || 0);
          valB = parseFloat(rawB.grand_total || rawB.payout || 0);
          break;
        case 'status':
          valA = (a.farmoutStatus || 'unassigned').toLowerCase();
          valB = (b.farmoutStatus || 'unassigned').toLowerCase();
          break;
        default:
          valA = '';
          valB = '';
      }

      if (typeof valA === 'string') {
        return this.farmoutOrderBy === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return this.farmoutOrderBy === 'asc' ? valA - valB : valB - valA;
    });

    // Store filtered reservations for pagination
    this.farmoutFilteredReservations = filtered;

    // Update result count display
    this.updateFarmoutResultCount(filtered.length, reservations.length);

    // Apply pagination
    const startIndex = (this.farmoutCurrentPage - 1) * this.farmoutPageSize;
    return filtered.slice(startIndex, startIndex + this.farmoutPageSize);
  }

  updateFarmoutResultCount(filtered, total) {
    const resultCountEl = document.getElementById('farmoutResultCount');
    if (resultCountEl) {
      if (this.farmoutSearchTerm || this.farmoutDateFrom || this.farmoutDateTo) {
        resultCountEl.textContent = `Showing ${filtered} of ${total} reservations`;
      } else {
        resultCountEl.textContent = `Showing all ${total} reservations`;
      }
    }
  }

  async handleCancelOffer() {
    if (!this.selectedFarmoutReservationId) return;
    
    const reservation = this.reservationManager.getReservationById(this.selectedFarmoutReservationId);
    if (!reservation) return;
    
    try {
      // Clear the offer fields
      await this.reservationManager.updateReservation(this.selectedFarmoutReservationId, {
        current_offer_driver_id: null,
        current_offer_sent_at: null,
        current_offer_expires_at: null
      });
      
      this.logFarmoutActivity(this.selectedFarmoutReservationId, 'Offer cancelled');
      
      // Refresh the UI
      const updated = this.reservationManager.getReservationById(this.selectedFarmoutReservationId);
      if (updated) {
        this.updateOfferStatusIndicator(updated);
        this.renderActivityLog(this.selectedFarmoutReservationId);
      }
    } catch (err) {
      console.error('Failed to cancel offer:', err);
      alert('Failed to cancel offer. Please try again.');
    }
  }

  handleResendOffer() {
    if (!this.selectedFarmoutReservationId) return;
    
    // Trigger the same flow as sending a new offer
    this.handleFarmoutOffer();
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

  // Open reservation in popup modal (double-click from farmout table)
  openReservationPopup(reservationId) {
    const reservation = this.reservationManager.getReservationById(reservationId);
    if (!reservation) {
      console.warn('[UIManager] Cannot open popup - reservation not found:', reservationId);
      return;
    }

    const modal = document.getElementById('reservationPopupModal');
    const frame = document.getElementById('reservationPopupFrame');
    const titleEl = document.getElementById('reservationPopupTitle');

    if (!modal || !frame) {
      console.warn('[UIManager] Reservation popup modal elements not found');
      return;
    }

    // Get confirmation number for the URL
    const confNumber = reservation.confirmationNumber || reservation.confirmation_number || reservation.id;
    const passengerName = reservation.passengerName || reservation.passenger_name || 'Reservation';

    // Set popup title
    if (titleEl) {
      titleEl.textContent = `#${confNumber} - ${passengerName}`;
    }

    // Load reservation form with conf number
    frame.src = `reservation-form.html?conf=${confNumber}&popup=1`;

    // Show modal
    modal.style.display = 'flex';

    // Close on Escape key
    this._popupEscHandler = (e) => {
      if (e.key === 'Escape') {
        this.closeReservationPopup();
      }
    };
    document.addEventListener('keydown', this._popupEscHandler);

    console.log('[UIManager] Opened reservation popup for:', confNumber);
  }

  closeReservationPopup() {
    const modal = document.getElementById('reservationPopupModal');
    const frame = document.getElementById('reservationPopupFrame');

    console.log('[UIManager] Closing reservation popup');

    if (modal) {
      modal.style.display = 'none';
    }
    if (frame) {
      frame.src = '';
    }

    // Remove escape key handler
    if (this._popupEscHandler) {
      document.removeEventListener('keydown', this._popupEscHandler);
      this._popupEscHandler = null;
    }

    // Refresh farmout table to show any changes
    this.updateFarmoutTable();
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
      // Single click - select reservation
      row.addEventListener('click', () => {
        const reservationId = row.dataset.reservationId;
        if (reservationId) {
          this.selectFarmoutReservation(reservationId);
        }
      });
      
      // Double click - open reservation in popup iframe
      row.addEventListener('dblclick', () => {
        const reservationId = row.dataset.reservationId;
        if (reservationId) {
          this.openReservationPopup(reservationId);
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
    this.updateOfferStatusIndicator(reservation);
    if (this.automationService) {
      this.automationService.handleReservationSelected(reservation);
    }
  }

  updateOfferStatusIndicator(reservation) {
    const indicatorEl = document.getElementById('farmoutOfferStatus');
    const driverNameEl = document.getElementById('offerDriverName');
    const countdownTextEl = document.getElementById('offerCountdownText');
    const countdownBarEl = document.getElementById('offerCountdownBar');
    
    if (!indicatorEl) return;
    
    // Clear any existing countdown timer
    if (this._offerCountdownTimer) {
      clearInterval(this._offerCountdownTimer);
      this._offerCountdownTimer = null;
    }
    
    // Get offer data from reservation (check both formats)
    const raw = this.getUnderlyingReservation ? this.getUnderlyingReservation(reservation) : reservation;
    const offerDriverId = raw?.current_offer_driver_id || reservation?.current_offer_driver_id;
    const offerSentAt = raw?.current_offer_sent_at || reservation?.current_offer_sent_at;
    const offerExpiresAt = raw?.current_offer_expires_at || reservation?.current_offer_expires_at;
    
    // If no active offer, hide the indicator
    if (!offerDriverId || !offerExpiresAt) {
      indicatorEl.classList.add('hidden');
      return;
    }
    
    // Show the indicator
    indicatorEl.classList.remove('hidden');
    
    // Find driver name from directory
    const driver = this.driverDirectory?.find(d => String(d.id) === String(offerDriverId));
    const driverName = driver?.name || `Driver #${offerDriverId.substring(0, 8)}...`;
    if (driverNameEl) {
      driverNameEl.textContent = driverName;
    }
    
    // Calculate time values
    const now = new Date();
    const sentTime = new Date(offerSentAt);
    const expiresTime = new Date(offerExpiresAt);
    const totalDuration = expiresTime - sentTime;
    
    // Start countdown timer
    const updateCountdown = () => {
      const currentTime = new Date();
      const remaining = expiresTime - currentTime;
      
      if (remaining <= 0) {
        // Offer expired
        indicatorEl.classList.add('expired');
        if (countdownTextEl) countdownTextEl.textContent = 'EXPIRED';
        if (countdownBarEl) countdownBarEl.style.setProperty('--countdown-progress', '0%');
        if (this._offerCountdownTimer) {
          clearInterval(this._offerCountdownTimer);
          this._offerCountdownTimer = null;
        }
        return;
      }
      
      indicatorEl.classList.remove('expired');
      
      // Format remaining time as MM:SS
      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      if (countdownTextEl) {
        countdownTextEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      }
      
      // Update progress bar
      const progressPercent = Math.max(0, Math.min(100, (remaining / totalDuration) * 100));
      if (countdownBarEl) {
        countdownBarEl.style.setProperty('--countdown-progress', `${progressPercent}%`);
      }
    };
    
    // Initial update
    updateCountdown();
    
    // Update every second
    this._offerCountdownTimer = setInterval(updateCountdown, 1000);
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
    // Priority: pickup_datetime (canonical DB column) first, then other sources
    const candidates = [
      reservation?.pickup_datetime,
      raw?.pickup_datetime,
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

  resolveTripDate(reservation) {
    const raw = this.getUnderlyingReservation(reservation);
    const snapshotDetails = raw?.form_snapshot?.details || {};
    // Priority: pickup_datetime (canonical DB column) first, then other sources
    const candidates = [
      reservation?.pickup_datetime,
      raw?.pickup_datetime,
      reservation?.pickupDate,
      reservation?.pickup_date,
      reservation?.tripDate,
      reservation?.trip_date,
      raw?.pickupDate,
      raw?.pickup_date,
      raw?.tripDate,
      raw?.trip_date,
      snapshotDetails?.pickupDate,
      snapshotDetails?.puDate,
      snapshotDetails?.tripDate
    ];
    for (const candidate of candidates) {
      if (candidate && typeof candidate === 'string' && candidate.trim()) {
        // Try to format nicely
        try {
          const date = new Date(candidate);
          if (!isNaN(date.getTime())) {
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          }
        } catch (e) {
          // Return as-is
        }
        return candidate.trim();
      }
    }
    return '—';
  }

  resolveDriverLevel(reservation) {
    const raw = this.getUnderlyingReservation(reservation);
    const snapshotDriver = raw?.form_snapshot?.driver || raw?.form_snapshot?.details?.driver || {};
    const candidates = [
      reservation?.driverLevel,
      reservation?.driver_level,
      reservation?.driverRating,
      reservation?.driver_rating,
      reservation?.driverSnapshot?.rating,
      reservation?.driverSnapshot?.level,
      reservation?.driver_snapshot?.rating,
      reservation?.driver_snapshot?.level,
      raw?.driverLevel,
      raw?.driver_level,
      raw?.driverRating,
      raw?.driver_rating,
      raw?.driverSnapshot?.rating,
      raw?.driverSnapshot?.level,
      snapshotDriver?.rating,
      snapshotDriver?.level,
      snapshotDriver?.driverRating,
      snapshotDriver?.driver_rating
    ];
    for (const candidate of candidates) {
      if (candidate !== undefined && candidate !== null && candidate !== '') {
        const level = parseInt(candidate, 10);
        if (!isNaN(level) && level >= 1 && level <= 10) {
          return `⭐ ${level}`;
        }
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

  /**
   * Resolve driver status for a reservation (trip status from driver app)
   */
  resolveDriverStatus(reservation) {
    const raw = this.getUnderlyingReservation(reservation);
    
    // Check multiple sources for driver/trip status
    const statusCandidates = [
      reservation?.driver_status,
      reservation?.driverStatus,
      reservation?.trip_status,
      reservation?.tripStatus,
      reservation?.status_detail_code,
      reservation?.statusDetailCode,
      raw?.driver_status,
      raw?.driverStatus,
      raw?.trip_status,
      raw?.tripStatus,
      raw?.status_detail_code,
      raw?.statusDetailCode,
      raw?.form_snapshot?.details?.driverStatus,
      raw?.form_snapshot?.details?.tripStatus
    ];
    
    let status = '';
    for (const candidate of statusCandidates) {
      if (candidate && typeof candidate === 'string' && candidate.trim()) {
        status = candidate.trim().toLowerCase();
        break;
      }
    }
    
    // Map status to display info
    const statusMap = {
      'getting_ready': { label: 'Getting Ready', class: 'status-getting-ready' },
      'on_the_way': { label: 'On The Way', class: 'status-on-the-way' },
      'enroute': { label: 'En Route', class: 'status-on-the-way' },
      'arrived': { label: 'Arrived', class: 'status-arrived' },
      'waiting': { label: 'Waiting', class: 'status-waiting' },
      'passenger_onboard': { label: 'Passenger Onboard', class: 'status-onboard' },
      'in_progress': { label: 'In Progress', class: 'status-in-progress' },
      'completed': { label: 'Completed', class: 'status-completed' },
      'done': { label: 'Completed', class: 'status-completed' },
      'cancelled': { label: 'Cancelled', class: 'status-cancelled' },
      'no_show': { label: 'No Show', class: 'status-no-show' }
    };
    
    // Normalize status key
    const normalizedStatus = status.replace(/[\s-]/g, '_');
    
    if (statusMap[normalizedStatus]) {
      return statusMap[normalizedStatus];
    }
    
    // Check if driver is assigned but no status yet
    const hasDriver = this.resolveDriverName(reservation) !== '—';
    if (hasDriver) {
      return { label: 'Assigned', class: 'status-assigned' };
    }
    
    return { label: '—', class: 'status-none' };
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

  async handleFarmoutAssignment() {
    if (!this.selectedFarmoutReservationId) return;
    const select = document.getElementById('farmoutDriverSelect');
    if (!select) return;

    const driverId = select.value;
    if (!driverId) {
      alert('Select a driver to assign.');
      return;
    }

    const driverInfo = this.driverDirectory.find(driver => String(driver.id) === String(driverId));
    if (!driverInfo) {
      alert('Driver not found.');
      return;
    }

    const reservation = this.reservationManager.getReservationById(this.selectedFarmoutReservationId);
    if (!reservation) return;

    // Assign the driver locally
    this.reservationManager.assignFarmoutDriver(this.selectedFarmoutReservationId, {
      id: driverInfo.id,
      name: driverInfo.name,
      affiliate: driverInfo.affiliate || '',
      phone: driverInfo.phone || driverInfo.cell_phone || '',
      email: driverInfo.email || '',
      vehicleType: driverInfo.vehicle
    });

    // Update database - set as assigned and upcoming for driver
    try {
      await this.reservationManager.updateReservation(this.selectedFarmoutReservationId, {
        assigned_driver_id: driverInfo.id,
        assigned_driver_name: driverInfo.name,
        farmout_status: 'assigned',
        status: 'farm_out_assigned',
        driver_status: 'assigned'
      });
      console.log('[Farmout] ✅ Driver assigned and saved to database');
    } catch (err) {
      console.error('[Farmout] Failed to update reservation:', err);
    }

    // Add to email queue - emails sent every 30 seconds
    if (driverInfo.email && window.driverEmailQueue) {
      window.driverEmailQueue.addToQueue(reservation, driverInfo, 'assignment');
      this.logFarmoutActivity(this.selectedFarmoutReservationId, `📧 Email queued for ${driverInfo.name}`);
    }

    this.logFarmoutActivity(this.selectedFarmoutReservationId, `✅ Assigned to ${driverInfo.name} - Trip is now UPCOMING`);
    this.renderActivityLog(this.selectedFarmoutReservationId);
    
    // Refresh the UI to show updated status
    const updatedRes = this.reservationManager.getReservationById(this.selectedFarmoutReservationId);
    if (updatedRes) {
      this.updateOfferStatusIndicator(updatedRes);
      this.updateFarmoutState(updatedRes);
    }
  }

  handleFarmoutClear() {
    if (!this.selectedFarmoutReservationId) return;
    this.reservationManager.clearFarmoutAssignment(this.selectedFarmoutReservationId);
    this.logFarmoutActivity(this.selectedFarmoutReservationId, 'Assignment cleared');
    this.renderActivityLog(this.selectedFarmoutReservationId);
    
    // Clear offer status indicator
    const updated = this.reservationManager.getReservationById(this.selectedFarmoutReservationId);
    if (updated) {
      this.updateOfferStatusIndicator(updated);
    }
  }

  async handleFarmoutOffer() {
    if (!this.selectedFarmoutReservationId) return;
    const reservation = this.reservationManager.getReservationById(this.selectedFarmoutReservationId);
    if (!reservation) return;

    const driverSelect = document.getElementById('farmoutDriverSelect');
    const selectedDriverId = driverSelect?.value;
    const driver = reservation.driverSnapshot || this.driverDirectory.find(d => String(d.id) === String(selectedDriverId));
    if (!driver) {
      alert('Assign or select a driver before sending an offer.');
      return;
    }
    
    // Set offer tracking fields (15-minute default timeout)
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000);
    
    try {
      await this.reservationManager.updateReservation(this.selectedFarmoutReservationId, {
        current_offer_driver_id: driver.id,
        current_offer_sent_at: now.toISOString(),
        current_offer_expires_at: expiresAt.toISOString(),
        farmout_status: 'offered'  // Set status to offered so driver portal sees it
      });
    } catch (err) {
      console.error('Failed to update offer tracking:', err);
    }
    
    const link = this.buildTripLink(reservation, driver);
    const message = `RELIALIMO offer: ${reservation.passengerName} on ${reservation.pickupDate} at ${reservation.pickupTime}. View trip details: ${link}`;

    const phone = driver?.phone;
    if (phone) {
      // Try to send via SMS service (Twilio)
      if (window.smsService) {
        try {
          await window.smsService.sendSms(phone, message);
          alert('Offer SMS sent successfully!');
        } catch (smsError) {
          console.error('SMS send failed:', smsError);
          // Fallback to clipboard if SMS fails
          if (navigator.clipboard) {
            await navigator.clipboard.writeText(message);
            alert(`SMS failed: ${smsError.message}\n\nMessage copied to clipboard instead.`);
          } else {
            alert(`SMS failed: ${smsError.message}\n\nMessage:\n${message}`);
          }
        }
      } else {
        // No SMS service available - copy to clipboard
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(message);
          alert('SMS service not configured. Offer message copied to clipboard.');
        } else {
          alert(`SMS service not configured.\n\nMessage:\n${message}`);
        }
      }
    } else {
      // No phone number - copy to clipboard
      if (navigator.clipboard) {
        navigator.clipboard.writeText(message).then(() => {
          alert('No phone number for driver. Offer copied to clipboard.');
        }).catch(() => {
          alert(message);
        });
      } else {
        alert(message);
      }
    }

    this.logFarmoutActivity(reservation.id, `Offer sent to ${driver.name || 'driver'}`);
    
    // Refresh the offer status indicator
    const updated = this.reservationManager.getReservationById(this.selectedFarmoutReservationId);
    if (updated) {
      // Inject offer data if not persisted yet
      updated.current_offer_driver_id = driver.id;
      updated.current_offer_sent_at = now.toISOString();
      updated.current_offer_expires_at = expiresAt.toISOString();
      this.updateOfferStatusIndicator(updated);
    }
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
