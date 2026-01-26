class DispatchGrid {
  constructor() {
    this.map = null;
    this.gpsMap = null;
    this.markers = [];
    this.vehicleMarkers = [];
    this.useLiveLocations = false; // Toggle state: false = rendered, true = live
    this.liveLocationInterval = null;
    this.renderedDrivers = []; // Simulated driver positions
    this.liveDrivers = []; // Live driver positions from database
    this.gridData = []; // All reservations data
    this.filteredData = []; // Filtered reservations
    this.sortColumn = null; // Current sort column
    this.sortDirection = 'asc'; // 'asc' or 'desc'
    this.activeFilters = {
      newLeg: true,    // Show new/pending/assigned reservations
      settled: false,  // Hide settled/complete reservations by default
      inHouse: true,
      farmIn: true,
      farmOut: true,
      quotes: false
    };
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.updateCurrentTime();
    this.initDriverLocationToggle();
    this.initRenderedDrivers();
    this.loadGridData(); // Load grid reservations
  }

  // Initialize the Live/Rendered mode from settings
  initDriverLocationToggle() {
    // Read setting from localStorage (set in Portal Settings > Driver Portal)
    const savedSettings = localStorage.getItem('portalSettings');
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        this.useLiveLocations = settings.useLiveDriverLocations === true;
        console.log('[DispatchGrid] Driver location mode from settings:', this.useLiveLocations ? 'LIVE' : 'RENDERED');
      } catch (e) {
        console.warn('[DispatchGrid] Could not parse portal settings');
      }
    }
    
    // Also check for individual setting
    const liveSetting = localStorage.getItem('useLiveDriverLocations');
    if (liveSetting !== null) {
      this.useLiveLocations = liveSetting === 'true';
      console.log('[DispatchGrid] Driver location mode from localStorage:', this.useLiveLocations ? 'LIVE' : 'RENDERED');
    }
    
    // Start live tracking if enabled
    if (this.useLiveLocations) {
      console.log('[DispatchGrid] Starting live location tracking (from settings)');
      this.startLiveLocationTracking();
    }
  }

  // Initialize simulated/rendered driver positions
  initRenderedDrivers() {
    this.renderedDrivers = [
      {
        id: 'car-suv',
        lat: 44.9778,
        lng: -93.2650,
        name: '7 Passenger Suv',
        driver: 'Eric Brustad',
        status: 'available',
        heading: Math.random() * 360,
        speed: 0.0008
      },
      {
        id: 'black-suv',
        lat: 44.9500,
        lng: -93.2200,
        name: 'BLACK_SUV',
        driver: 'Eric B',
        status: 'busy',
        heading: Math.random() * 360,
        speed: 0.0006
      },
      {
        id: 'sedan',
        lat: 45.0000,
        lng: -93.2900,
        name: 'Sedan',
        driver: 'Tony Arroyo',
        status: 'available',
        heading: Math.random() * 360,
        speed: 0.0007
      }
    ];
    
    // Start simulated movement
    setInterval(() => {
      if (!this.useLiveLocations) {
        this.updateRenderedDriverPositions();
        this.refreshVehicleMarkers();
      }
    }, 3000);
  }

  // Simulate rendered driver movement
  updateRenderedDriverPositions() {
    const baseLat = 44.9778;
    const baseLng = -93.2650;
    const bounds = { north: baseLat + 0.15, south: baseLat - 0.15, east: baseLng + 0.2, west: baseLng - 0.2 };
    
    this.renderedDrivers.forEach(driver => {
      if (driver.status === 'available' || driver.status === 'busy') {
        const headingRad = (driver.heading * Math.PI) / 180;
        driver.lat += Math.cos(headingRad) * driver.speed;
        driver.lng += Math.sin(headingRad) * driver.speed;
        
        // Random heading adjustment
        if (Math.random() < 0.3) {
          driver.heading += (Math.random() - 0.5) * 40;
          driver.heading = (driver.heading + 360) % 360;
        }
        
        // Bounce off boundaries
        if (driver.lat > bounds.north || driver.lat < bounds.south) {
          driver.heading = (180 - driver.heading + 360) % 360;
          driver.lat = Math.max(bounds.south, Math.min(bounds.north, driver.lat));
        }
        if (driver.lng > bounds.east || driver.lng < bounds.west) {
          driver.heading = (360 - driver.heading) % 360;
          driver.lng = Math.max(bounds.west, Math.min(bounds.east, driver.lng));
        }
      }
    });
  }

  // Start tracking live GPS locations from database
  startLiveLocationTracking() {
    this.fetchLiveDriverLocations();
    this.liveLocationInterval = setInterval(() => {
      this.fetchLiveDriverLocations();
    }, 5000); // Poll every 5 seconds
  }

  stopLiveLocationTracking() {
    if (this.liveLocationInterval) {
      clearInterval(this.liveLocationInterval);
      this.liveLocationInterval = null;
    }
  }

  // Fetch real driver locations from Supabase
  async fetchLiveDriverLocations() {
    try {
      // Check if supabase client is available
      if (typeof window.supabaseClient === 'undefined') {
        console.warn('[DispatchGrid] Supabase client not available for live locations');
        this.showNoLiveDataMessage();
        return;
      }
      
      // First check if table exists by doing a simple query
      const { data, error } = await window.supabaseClient
        .from('driver_locations')
        .select('id, driver_id, latitude, longitude, heading, speed, created_at')
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) {
        // Table might not exist yet
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          console.warn('[DispatchGrid] driver_locations table not set up yet');
          this.showNoLiveDataMessage('Table not configured. Run driver-locations-setup.sql in Supabase.');
        } else {
          console.error('[DispatchGrid] Error fetching live locations:', error);
          this.showNoLiveDataMessage('Error loading live data');
        }
        return;
      }
      
      if (data && data.length > 0) {
        console.log(`[DispatchGrid] Received ${data.length} live driver locations`);
        this.updateLiveVehicleMarkers(data);
      } else {
        console.log('[DispatchGrid] No live driver locations available');
        this.showNoLiveDataMessage('No live driver locations yet. Drivers need to share their location.');
      }
    } catch (err) {
      console.error('[DispatchGrid] Failed to fetch live locations:', err);
      this.showNoLiveDataMessage('Connection error');
    }
  }

  // Show message when no live data available
  showNoLiveDataMessage(message = 'No live driver data available') {
    if (!this.gpsMap) return;
    
    // Remove existing message popup
    if (this.noDataPopup) {
      this.gpsMap.closePopup(this.noDataPopup);
    }
    
    // Show centered popup with message
    this.noDataPopup = L.popup()
      .setLatLng([44.9778, -93.2650])
      .setContent(`<div style="text-align:center;padding:10px;"><strong>🔴 Live Mode</strong><br>${message}</div>`)
      .openOn(this.gpsMap);
  }

  // Update markers with live location data
  updateLiveVehicleMarkers(liveData) {
    // Store live drivers for use by addDriverMarkersToMap
    this.liveDrivers = liveData.map(loc => ({
      id: loc.driver_id,
      lat: loc.latitude,
      lng: loc.longitude,
      name: `Driver ${loc.driver_id?.substring(0, 8) || 'Unknown'}`,
      driver: loc.driver_id ? `Driver ${loc.driver_id.substring(0, 8)}...` : 'Unknown',
      status: 'available',
      heading: loc.heading || 0,
      speed: loc.speed || 0,
      updatedAt: loc.created_at
    }));

    // Update GPS Map if it exists
    if (this.gpsMap) {
      // Close any "no data" popup
      if (this.noDataPopup) {
        this.gpsMap.closePopup(this.noDataPopup);
        this.noDataPopup = null;
      }
      
      // Clear existing markers
      this.vehicleMarkers.forEach(({ marker }) => {
        this.gpsMap.removeLayer(marker);
      });
      this.vehicleMarkers = [];
      
      liveData.forEach(loc => {
        const driverName = loc.driver_id ? `Driver ${loc.driver_id.substring(0, 8)}...` : 'Unknown Driver';
        
        const markerIcon = L.divIcon({
          className: 'vehicle-marker available live-marker',
          html: '📍',
          iconSize: [40, 40]
        });

        const marker = L.marker([loc.latitude, loc.longitude], { icon: markerIcon })
          .addTo(this.gpsMap)
          .bindPopup(`
            <strong>🟢 LIVE</strong><br>
            Driver: ${driverName}<br>
            Speed: ${loc.speed ? (loc.speed * 2.237).toFixed(1) + ' mph' : 'N/A'}<br>
            Updated: ${new Date(loc.created_at).toLocaleTimeString()}
          `);

        this.vehicleMarkers.push({ id: loc.driver_id, marker, vehicle: loc });
      });
    }
    
    // Also update main Map view with live drivers
    if (this.map) {
      this.addDriverMarkersToMap();
    }
  }

  setupEventListeners() {
    // Tab switching
    document.querySelectorAll('.dispatch-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const view = e.target.dataset.view;
        this.switchView(view);
      });
    });

    // Date navigation
    const dateInput = document.getElementById('dispatchDate');
    const dateNavBtn = document.querySelector('.date-nav-btn');
    
    if (dateNavBtn) {
      dateNavBtn.addEventListener('click', () => {
        const currentDate = new Date(dateInput.value);
        currentDate.setDate(currentDate.getDate() + 1);
        dateInput.value = currentDate.toISOString().split('T')[0];
        this.loadDispatchData();
      });
    }

    if (dateInput) {
      dateInput.addEventListener('change', () => {
        this.loadDispatchData();
      });
    }

    // Search functionality
    const searchBtn = document.querySelector('.search-btn');
    if (searchBtn) {
      searchBtn.addEventListener('click', () => {
        const searchValue = document.querySelector('.quick-search-input').value;
        this.performSearch(searchValue);
      });
    }

    // Quick search on Enter
    const searchInput = document.querySelector('.quick-search-input');
    if (searchInput) {
      searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.performSearch(searchInput.value);
        }
      });
    }

    // Refresh button
    const refreshBtn = document.querySelector('.refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.loadDispatchData();
      });
    }

    // Filter checkboxes
    document.querySelectorAll('.filter-checkbox input').forEach(checkbox => {
      checkbox.addEventListener('change', () => {
        this.applyFilters();
      });
    });

    // Sortable columns
    document.querySelectorAll('.sortable').forEach(header => {
      header.addEventListener('click', (e) => {
        const column = e.target.textContent.trim().replace('▼', '').trim();
        this.sortColumn(column);
      });
    });

    // Conf# links
    document.querySelectorAll('.conf-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const confNum = e.target.textContent;
        this.openReservation(confNum);
      });
    });

    // Manage Resources link
    const manageResourcesLink = document.getElementById('manageResourcesLink');
    if (manageResourcesLink) {
      manageResourcesLink.addEventListener('click', (e) => {
        e.preventDefault();
        this.openManageResources();
      });
    }

    // Link Drivers and Cars link
    const linkDriversCarsLink = document.getElementById('linkDriversCarsLink');
    if (linkDriversCarsLink) {
      linkDriversCarsLink.addEventListener('click', (e) => {
        e.preventDefault();
        this.openLinkDriversCars();
      });
    }
  }

  updateCurrentTime() {
    const timeElement = document.getElementById('currentTime');
    if (timeElement) {
      const now = new Date();
      timeElement.textContent = now.toLocaleString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
      
      // Update every minute
      setInterval(() => {
        const now = new Date();
        timeElement.textContent = now.toLocaleString('en-US', {
          month: '2-digit',
          day: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });
      }, 60000);
    }
  }

  loadDispatchData() {
    console.log('Loading dispatch data for date:', document.getElementById('dispatchDate').value);
    this.loadGridData();
  }

  // Load reservations from Supabase for the grid
  async loadGridData() {
    try {
      const dateInput = document.getElementById('dispatchDate');
      
      // Set today's date if not already set
      if (dateInput && !dateInput.dataset.userSet) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.value = today;
      }
      
      const selectedDate = dateInput ? dateInput.value : new Date().toISOString().split('T')[0];
      
      // Check if supabase client is available
      if (typeof window.supabaseClient === 'undefined') {
        console.warn('[DispatchGrid] Supabase client not available, using sample data');
        this.loadSampleGridData();
        return;
      }

      console.log('[DispatchGrid] Loading grid data for', selectedDate);
      
      // Try to load reservations for selected date first
      let { data, error } = await window.supabaseClient
        .from('reservations')
        .select('*')
        .gte('pickup_datetime', `${selectedDate}T00:00:00`)
        .lte('pickup_datetime', `${selectedDate}T23:59:59`)
        .order('pickup_datetime', { ascending: true });

      if (error) {
        console.error('[DispatchGrid] Error loading grid data:', error);
        this.loadSampleGridData();
        return;
      }

      if (data && data.length > 0) {
        console.log(`[DispatchGrid] Loaded ${data.length} reservations for ${selectedDate}`);
        this.gridData = this.mapReservationsToGrid(data);
      } else {
        // No reservations for this specific date, try loading recent reservations
        console.log('[DispatchGrid] No reservations for this date, trying to load recent...');
        
        const { data: recentData, error: recentError } = await window.supabaseClient
          .from('reservations')
          .select('*')
          .order('pickup_datetime', { ascending: false })
          .limit(50);
        
        if (recentData && recentData.length > 0) {
          console.log(`[DispatchGrid] Loaded ${recentData.length} recent reservations`);
          this.gridData = this.mapReservationsToGrid(recentData);
        } else {
          console.log('[DispatchGrid] No reservations found, using sample data');
          this.loadSampleGridData();
          return;
        }
      }
      
      this.applyFiltersAndRender();
      this.updateTripCount();
    } catch (err) {
      console.error('[DispatchGrid] Failed to load grid data:', err);
      this.loadSampleGridData();
    }
  }

  // Map Supabase reservation data to grid columns
  mapReservationsToGrid(reservations) {
    return reservations.map(res => {
      const pickupDate = new Date(res.pickup_datetime);
      const status = this.determineReservationStatus(res);
      
      return {
        id: res.id,
        svcType: res.service_type || 'Transfer',
        confNum: res.confirmation_number || res.id?.toString().slice(-5),
        status: status,
        reqPuDate: pickupDate.toLocaleDateString('en-US'),
        puTime: pickupDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        type: res.trip_type || 'One Way',
        puLocation: res.pickup_address || '',
        doLocation: res.dropoff_address || '',
        veh: res.vehicle_type || '',
        driver: res.assigned_driver_name || 'Unassigned',
        car: res.assigned_vehicle || '',
        passengerName: res.passenger_name || res.account_name || '',
        passCount: res.passenger_count || 1,
        luggage: res.luggage_count || 0,
        currTm: '',
        affiliateName: res.affiliate_name || '',
        recordedTm: '',
        fitActTm: '',
        fitTmDte: '',
        fitStatus: '',
        origins: res.trip_origin || 'In-House',
        fotNum: '',
        // Keep raw data for filtering
        _raw: res
      };
    });
  }

  // Determine reservation status based on data
  determineReservationStatus(res) {
    if (res.status) return res.status;
    if (res.is_cancelled) return 'Cancelled';
    if (res.is_complete) return 'Complete';
    if (res.assigned_driver_id) return 'Assigned';
    return 'Pending';
  }

  // Load sample data when Supabase not available
  loadSampleGridData() {
    const today = new Date().toLocaleDateString('en-US');
    
    this.gridData = [
      {
        id: 1,
        svcType: 'Transfer',
        confNum: '22456',
        status: 'Assigned',
        reqPuDate: today,
        puTime: '8:00 AM',
        type: 'One Way',
        puLocation: '123 Main St, Minneapolis, MN',
        doLocation: 'MSP Airport Terminal 1',
        veh: 'SUV',
        driver: 'Eric Brustad',
        car: 'Black SUV',
        passengerName: 'John Smith',
        passCount: 2,
        luggage: 3,
        currTm: '',
        affiliateName: '',
        recordedTm: '',
        fitActTm: '',
        fitTmDte: '',
        fitStatus: '',
        origins: 'In-House',
        fotNum: '',
        _raw: { trip_origin: 'In-House' }
      },
      {
        id: 2,
        svcType: 'Hourly',
        confNum: '22457',
        status: 'Pending',
        reqPuDate: today,
        puTime: '10:30 AM',
        type: 'Hourly',
        puLocation: 'Downtown Hilton',
        doLocation: 'Multiple Stops',
        veh: 'Sedan',
        driver: 'Unassigned',
        car: '',
        passengerName: 'Jane Doe',
        passCount: 1,
        luggage: 1,
        currTm: '',
        affiliateName: 'ABC Limo',
        recordedTm: '',
        fitActTm: '',
        fitTmDte: '',
        fitStatus: '',
        origins: 'Farm-In',
        fotNum: 'F-1234',
        _raw: { trip_origin: 'Farm-In' }
      },
      {
        id: 3,
        svcType: 'Transfer',
        confNum: '22458',
        status: 'Settled',
        reqPuDate: today,
        puTime: '2:00 PM',
        type: 'Round Trip',
        puLocation: 'MSP Airport Terminal 2',
        doLocation: '456 Oak Ave, St Paul, MN',
        veh: 'SUV',
        driver: 'Tony Arroyo',
        car: '7 Passenger SUV',
        passengerName: 'Robert Johnson',
        passCount: 4,
        luggage: 6,
        currTm: '',
        affiliateName: '',
        recordedTm: '',
        fitActTm: '',
        fitTmDte: '',
        fitStatus: '',
        origins: 'In-House',
        fotNum: '',
        _raw: { trip_origin: 'In-House' }
      }
    ];
    this.applyFiltersAndRender();
    this.updateTripCount();
  }

  // Apply filters and re-render grid
  applyFiltersAndRender() {
    // Read current filter states
    const checkboxes = document.querySelectorAll('.filter-checkbox input');
    if (checkboxes.length >= 6) {
      this.activeFilters = {
        newLeg: checkboxes[0].checked,
        settled: checkboxes[1].checked,
        inHouse: checkboxes[2].checked,
        farmIn: checkboxes[3].checked,
        farmOut: checkboxes[4].checked,
        quotes: checkboxes[5].checked
      };
    }

    console.log('[DispatchGrid] Active filters:', this.activeFilters);

    // Filter data
    this.filteredData = this.gridData.filter(row => {
      const origin = (row.origins || row._raw?.trip_origin || 'In-House').toLowerCase().replace('-', '');
      const status = (row.status || 'pending').toLowerCase();
      
      // STATUS FILTERS (NewLeg, Settled)
      // NewLeg = new, pending, assigned (active reservations)
      // Settled = settled, complete, cancelled
      const isActiveStatus = ['new', 'pending', 'assigned', 'confirmed'].includes(status);
      const isSettledStatus = ['settled', 'complete', 'completed', 'cancelled'].includes(status);
      const isQuoteStatus = status === 'quote';
      
      // ORIGIN FILTERS (In-House, Farm-In, Farm-Out)
      const isInHouse = origin === '' || origin === 'inhouse' || origin === 'in house';
      const isFarmIn = origin === 'farmin' || origin === 'farm in';
      const isFarmOut = origin === 'farmout' || origin === 'farm out';
      
      // Check status - must match at least one checked status filter
      let statusMatch = false;
      if (isActiveStatus && this.activeFilters.newLeg) statusMatch = true;
      if (isSettledStatus && this.activeFilters.settled) statusMatch = true;
      if (isQuoteStatus && this.activeFilters.quotes) statusMatch = true;
      // If no specific status filters apply, check if it's a regular active reservation
      if (!isActiveStatus && !isSettledStatus && !isQuoteStatus) {
        // Unknown status - show if newLeg is checked (default active)
        if (this.activeFilters.newLeg) statusMatch = true;
      }
      
      // Check origin - must match at least one checked origin filter
      let originMatch = false;
      if (isInHouse && this.activeFilters.inHouse) originMatch = true;
      if (isFarmIn && this.activeFilters.farmIn) originMatch = true;
      if (isFarmOut && this.activeFilters.farmOut) originMatch = true;
      // If no origin specified, treat as In-House
      if (!isInHouse && !isFarmIn && !isFarmOut && this.activeFilters.inHouse) {
        originMatch = true;
      }
      
      // Must pass both status AND origin filters
      const passes = statusMatch && originMatch;
      
      if (!passes) {
        console.log(`[DispatchGrid] Filtered out: ${row.confNum} (status: ${status}/${statusMatch}, origin: ${origin}/${originMatch})`);
      }
      
      return passes;
    });

    console.log(`[DispatchGrid] Filtered ${this.filteredData.length} of ${this.gridData.length} reservations`);

    // Apply current sort if any
    if (this.currentSortColumn) {
      this.sortGridData(this.currentSortColumn, false);
    }

    this.renderGrid();
  }

  // Render the grid table body
  renderGrid() {
    const tbody = document.querySelector('.dispatch-grid-table tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (this.filteredData.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="22" style="text-align: center; padding: 40px; color: #666;">
            No reservations found for the selected date and filters.
          </td>
        </tr>
      `;
      return;
    }

    this.filteredData.forEach(row => {
      const tr = document.createElement('tr');
      tr.className = 'grid-row';
      tr.dataset.confNum = row.confNum;
      tr.dataset.id = row.id;
      
      // Add status-based styling
      if (row.status === 'Assigned') tr.classList.add('status-assigned');
      else if (row.status === 'Pending') tr.classList.add('status-pending');
      else if (row.status === 'Settled') tr.classList.add('status-settled');
      else if (row.status === 'Cancelled') tr.classList.add('status-cancelled');
      
      tr.innerHTML = `
        <td>${row.svcType}</td>
        <td><a href="#" class="conf-link">${row.confNum}</a></td>
        <td><span class="status-badge status-${row.status.toLowerCase()}">${row.status}</span></td>
        <td>${row.reqPuDate}</td>
        <td>${row.puTime}</td>
        <td>${row.type}</td>
        <td class="truncate" title="${row.puLocation}">${row.puLocation}</td>
        <td class="truncate" title="${row.doLocation}">${row.doLocation}</td>
        <td>${row.veh}</td>
        <td>${row.driver}</td>
        <td>${row.car}</td>
        <td>${row.passengerName}</td>
        <td>${row.passCount}</td>
        <td>${row.luggage}</td>
        <td>${row.currTm}</td>
        <td>${row.affiliateName}</td>
        <td>${row.recordedTm}</td>
        <td>${row.fitActTm}</td>
        <td>${row.fitTmDte}</td>
        <td>${row.fitStatus}</td>
        <td>${row.origins}</td>
        <td>${row.fotNum}</td>
      `;

      // Click to open reservation in edit mode
      tr.addEventListener('click', (e) => {
        // Don't trigger if clicking the conf link
        if (e.target.classList.contains('conf-link')) return;
        this.openReservation(row.confNum);
      });

      tbody.appendChild(tr);
    });

    // Re-attach conf link handlers
    tbody.querySelectorAll('.conf-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const confNum = e.target.textContent;
        this.openReservation(confNum);
      });
    });
  }

  // Update trip count display
  updateTripCount() {
    const tripCountEl = document.querySelector('.dispatch-info strong');
    if (tripCountEl && tripCountEl.parentElement.textContent.includes('Trip Count')) {
      tripCountEl.textContent = this.filteredData.length;
    }
  }

  performSearch(query) {
    console.log('Searching for:', query);
    if (!query) {
      // Reset to filtered data
      this.applyFiltersAndRender();
      return;
    }
    
    const searchLower = query.toLowerCase();
    
    // Filter the already filtered data by search term
    this.filteredData = this.filteredData.filter(row => {
      return (
        row.confNum?.toLowerCase().includes(searchLower) ||
        row.passengerName?.toLowerCase().includes(searchLower) ||
        row.driver?.toLowerCase().includes(searchLower) ||
        row.puLocation?.toLowerCase().includes(searchLower) ||
        row.doLocation?.toLowerCase().includes(searchLower) ||
        row.affiliateName?.toLowerCase().includes(searchLower) ||
        row.status?.toLowerCase().includes(searchLower)
      );
    });
    
    this.renderGrid();
    this.updateTripCount();
  }

  applyFilters() {
    console.log('Applying filters...');
    this.applyFiltersAndRender();
    this.updateTripCount();
  }

  // Sort column implementation
  sortColumn(columnName) {
    console.log('Sorting by:', columnName);
    this.sortGridData(columnName, true);
    this.renderGrid();
  }

  // Sort grid data by column
  sortGridData(columnName, toggleDirection = true) {
    // Map display column names to data keys
    const columnMap = {
      'Svc Type': 'svcType',
      'Conf#': 'confNum',
      'Status': 'status',
      'Req/PU Date': 'reqPuDate',
      'PU Time': 'puTime',
      'Type': 'type',
      'PU Location': 'puLocation',
      'DO Location': 'doLocation',
      'Veh': 'veh',
      'Driver': 'driver',
      'Car': 'car',
      'Passenger Name': 'passengerName',
      'Pass#': 'passCount',
      'Lug': 'luggage',
      'Affiliate Name': 'affiliateName',
      'Origins': 'origins'
    };

    const key = columnMap[columnName];
    if (!key) return;

    // Toggle direction if clicking same column
    if (toggleDirection) {
      if (this.currentSortColumn === columnName) {
        this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        this.currentSortColumn = columnName;
        this.sortDirection = 'asc';
      }
    }

    // Update sort arrows in header
    document.querySelectorAll('.sortable .sort-arrow').forEach(arrow => {
      arrow.textContent = '▼';
      arrow.parentElement.classList.remove('sorted-asc', 'sorted-desc');
    });
    
    const activeHeader = Array.from(document.querySelectorAll('.sortable')).find(h => 
      h.textContent.trim().startsWith(columnName)
    );
    if (activeHeader) {
      const arrow = activeHeader.querySelector('.sort-arrow');
      if (arrow) {
        arrow.textContent = this.sortDirection === 'asc' ? '▲' : '▼';
      }
      activeHeader.classList.add(this.sortDirection === 'asc' ? 'sorted-asc' : 'sorted-desc');
    }

    // Sort the data
    this.filteredData.sort((a, b) => {
      let valA = a[key] || '';
      let valB = b[key] || '';

      // Handle numeric values
      if (key === 'passCount' || key === 'luggage') {
        valA = parseInt(valA) || 0;
        valB = parseInt(valB) || 0;
      } else if (key === 'puTime') {
        // Convert time to sortable format
        valA = this.timeToMinutes(valA);
        valB = this.timeToMinutes(valB);
      } else {
        valA = valA.toString().toLowerCase();
        valB = valB.toString().toLowerCase();
      }

      if (valA < valB) return this.sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return this.sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }

  // Convert time string to minutes for sorting
  timeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
    if (!match) return 0;
    let hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    const period = match[3]?.toUpperCase();
    
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    
    return hours * 60 + minutes;
  }

  openReservation(confNum) {
    console.log('Opening reservation:', confNum);
    // Open reservation form in edit mode
    window.location.href = `reservation-form.html?conf=${confNum}&mode=edit`;
  }

  switchView(view) {
    // Update active tab
    document.querySelectorAll('.dispatch-tab').forEach(tab => {
      tab.classList.remove('active');
      if (tab.dataset.view === view) {
        tab.classList.add('active');
      }
    });

    // Hide all views
    document.getElementById('gridView').style.display = 'none';
    document.getElementById('mapView').style.display = 'none';
    document.getElementById('graphView').style.display = 'none';
    document.getElementById('gpsView').style.display = 'none';

    // Show selected view
    switch(view) {
      case 'grid':
        document.getElementById('gridView').style.display = 'block';
        break;
      case 'map':
        document.getElementById('mapView').style.display = 'block';
        this.initializeMap();
        break;
      case 'graph':
        document.getElementById('graphView').style.display = 'block';
        break;
      case 'gps':
        document.getElementById('gpsView').style.display = 'flex';
        this.initializeGPSMap();
        break;
    }
  }

  initializeMap() {
    if (this.map) {
      // Map already initialized, just invalidate size and refresh drivers
      setTimeout(() => {
        this.map.invalidateSize();
        this.addDriverMarkersToMap();
      }, 100);
      return;
    }

    // Initialize Leaflet map centered on Minneapolis
    this.map = L.map('dispatchMap').setView([44.9778, -93.2650], 11);

    // Add OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(this.map);

    // Load and add reservation markers
    this.loadMapReservations();
    
    // Add driver markers
    this.addDriverMarkersToMap();

    // Setup map controls
    this.setupMapControls();
    
    // Start driver position updates on map
    this.startMapDriverUpdates();
  }

  // Load reservations from Supabase for the map view
  async loadMapReservations() {
    try {
      if (typeof window.supabaseClient === 'undefined') {
        console.warn('[DispatchGrid] Supabase client not available for reservations');
        return;
      }
      
      // Get today's date for filtering
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await window.supabaseClient
        .from('reservations')
        .select('id, confirmation_number, status, pickup_datetime, dropoff_datetime, pickup_address, dropoff_address, passenger_name, assigned_driver_id, assigned_driver_name')
        .gte('pickup_datetime', today)
        .order('pickup_datetime', { ascending: true })
        .limit(50);
      
      if (error) {
        console.error('[DispatchGrid] Error loading reservations:', error);
        return;
      }
      
      this.mapReservations = data || [];
      console.log(`[DispatchGrid] Loaded ${this.mapReservations.length} reservations for map`);
      
      // Populate sidebar
      this.populateMapReservationsSidebar();
      
    } catch (err) {
      console.error('[DispatchGrid] Failed to load reservations:', err);
    }
  }

  // Populate the reservations sidebar
  populateMapReservationsSidebar() {
    const tbody = document.querySelector('.map-reservations-table tbody');
    if (!tbody || !this.mapReservations) return;
    
    tbody.innerHTML = this.mapReservations.map(res => {
      const puDate = res.pickup_datetime ? new Date(res.pickup_datetime).toLocaleDateString() : '-';
      const puTime = res.pickup_datetime ? new Date(res.pickup_datetime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '-';
      const doTime = res.dropoff_datetime ? new Date(res.dropoff_datetime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '-';
      const hasDriver = res.assigned_driver_id || res.assigned_driver_name;
      const driverBadge = hasDriver ? '🟢' : '🔴';
      
      return `
        <tr class="map-reservation-row" data-conf="${res.confirmation_number}" data-driver-id="${res.assigned_driver_id || ''}">
          <td>${driverBadge} ${res.confirmation_number || res.id.substring(0,8)}</td>
          <td>${puDate}</td>
          <td>${puTime}</td>
          <td>${doTime}</td>
        </tr>
        <tr class="map-reservation-detail" data-conf="${res.confirmation_number}">
          <td colspan="4">
            <div class="res-detail-content">
              <strong>${res.passenger_name || 'No passenger'}</strong><br>
              <small>PU: ${res.pickup_address || 'N/A'}</small><br>
              <small>DO: ${res.dropoff_address || 'N/A'}</small><br>
              <small>Driver: ${hasDriver ? (res.assigned_driver_name || 'Assigned') : '<span style="color:red">UNASSIGNED</span>'}</small>
            </div>
          </td>
        </tr>
      `;
    }).join('');
    
    // Setup click handlers
    this.setupMapReservationList();
  }

  // Add driver markers to the main map view
  addDriverMarkersToMap() {
    if (!this.map) return;
    
    // Clear existing driver markers on map
    if (this.mapDriverMarkers) {
      this.mapDriverMarkers.forEach(marker => this.map.removeLayer(marker));
    }
    this.mapDriverMarkers = [];
    this.mapDriverMarkersById = {};
    
    // Use live drivers or rendered drivers based on toggle
    const drivers = this.useLiveLocations ? (this.liveDrivers || []) : this.renderedDrivers;
    
    if (this.useLiveLocations && (!this.liveDrivers || this.liveDrivers.length === 0)) {
      // Show message if no live data
      console.log('[DispatchGrid] No live drivers to display on map');
      return;
    }
    
    drivers.forEach(driver => {
      const statusColor = driver.status === 'available' ? '#28a745' : 
                          driver.status === 'busy' ? '#ffc107' : '#6c757d';
      
      // Different icon for live vs rendered
      const iconEmoji = this.useLiveLocations ? '📍' : '🚗';
      
      const markerIcon = L.divIcon({
        className: `driver-map-marker ${this.useLiveLocations ? 'live-marker' : ''}`,
        html: `<div style="
          background: ${statusColor};
          color: white;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          border: 2px solid ${this.useLiveLocations ? '#00ff00' : 'white'};
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        ">${iconEmoji}</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      const marker = L.marker([driver.lat, driver.lng], { icon: markerIcon })
        .addTo(this.map)
        .bindPopup(`
          <strong>${this.useLiveLocations ? '🟢 LIVE - ' : ''}${driver.driver || driver.name}</strong><br>
          Vehicle: ${driver.name}<br>
          Status: ${driver.status === 'available' ? '🟢 Available' : '🟡 On Trip'}
          ${this.useLiveLocations && driver.updatedAt ? '<br>Updated: ' + new Date(driver.updatedAt).toLocaleTimeString() : ''}
        `);

      this.mapDriverMarkers.push(marker);
      this.mapDriverMarkersById[driver.id] = { marker, driver };
    });
    
    console.log(`[DispatchGrid] Added ${drivers.length} ${this.useLiveLocations ? 'live' : 'rendered'} driver markers to map`);
  }

  // Highlight a specific driver on the map
  highlightDriverOnMap(driverId) {
    // Reset all driver markers to normal
    if (this.mapDriverMarkers) {
      this.mapDriverMarkers.forEach((marker, idx) => {
        const driver = this.renderedDrivers[idx];
        if (driver) {
          const statusColor = driver.status === 'available' ? '#28a745' : 
                              driver.status === 'busy' ? '#ffc107' : '#6c757d';
          marker.setIcon(L.divIcon({
            className: 'driver-map-marker',
            html: `<div style="
              background: ${statusColor};
              color: white;
              width: 32px;
              height: 32px;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 16px;
              border: 2px solid white;
              box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            ">🚗</div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 16]
          }));
        }
      });
    }
    
    // Highlight the selected driver
    if (driverId && this.mapDriverMarkersById && this.mapDriverMarkersById[driverId]) {
      const { marker, driver } = this.mapDriverMarkersById[driverId];
      marker.setIcon(L.divIcon({
        className: 'driver-map-marker highlighted',
        html: `<div style="
          background: #ff4757;
          color: white;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          border: 3px solid #fff;
          box-shadow: 0 0 15px rgba(255,71,87,0.8);
          animation: pulse 1s infinite;
        ">🚗</div>`,
        iconSize: [44, 44],
        iconAnchor: [22, 22]
      }));
      marker.openPopup();
      this.map.setView(marker.getLatLng(), 13);
    }
  }
  
  // Start updating driver positions on map
  startMapDriverUpdates() {
    if (this.mapDriverInterval) return;
    
    this.mapDriverInterval = setInterval(() => {
      if (this.map && !this.useLiveLocations) {
        // Update marker positions
        this.renderedDrivers.forEach((driver, idx) => {
          if (this.mapDriverMarkers && this.mapDriverMarkers[idx]) {
            this.mapDriverMarkers[idx].setLatLng([driver.lat, driver.lng]);
          }
        });
      }
    }, 3000);
  }

  addReservationMarkers() {
    // Sample reservation data with coordinates - now empty
    const reservations = [];

    reservations.forEach(res => {
      // Pickup marker (green)
      const pickupIcon = L.divIcon({
        className: 'custom-marker pickup-marker',
        html: '<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">P</div>',
        iconSize: [30, 30]
      });

      const pickupMarker = L.marker([res.pickup.lat, res.pickup.lng], { icon: pickupIcon })
        .addTo(this.map)
        .bindPopup(`<strong>Pickup - Conf# ${res.conf}</strong><br>${res.pickup.name}`);

      // Dropoff marker (red)
      const dropoffIcon = L.divIcon({
        className: 'custom-marker dropoff-marker',
        html: '<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">D</div>',
        iconSize: [30, 30]
      });

      const dropoffMarker = L.marker([res.dropoff.lat, res.dropoff.lng], { icon: dropoffIcon })
        .addTo(this.map)
        .bindPopup(`<strong>Dropoff - Conf# ${res.conf}</strong><br>${res.dropoff.name}`);

      // Draw route line
      const routeLine = L.polyline(
        [[res.pickup.lat, res.pickup.lng], [res.dropoff.lat, res.dropoff.lng]],
        { color: '#17a2b8', weight: 3, opacity: 0.6, dashArray: '10, 10' }
      ).addTo(this.map);

      this.markers.push({ conf: res.conf, pickup: pickupMarker, dropoff: dropoffMarker, route: routeLine });
    });
  }

  setupMapControls() {
    // Recenter button
    document.getElementById('recenterBtn')?.addEventListener('click', () => {
      this.map.setView([44.9778, -93.2650], 11);
    });

    // Zoom in button
    document.getElementById('zoomInBtn')?.addEventListener('click', () => {
      this.map.zoomIn();
    });

    // Zoom out button
    document.getElementById('zoomOutBtn')?.addEventListener('click', () => {
      this.map.zoomOut();
    });
  }

  setupMapReservationList() {
    // Make reservation rows clickable to show details and highlight driver
    document.querySelectorAll('.map-reservation-row').forEach(row => {
      row.addEventListener('click', (e) => {
        const conf = row.dataset.conf;
        const driverId = row.dataset.driverId;
        
        // Toggle active state
        document.querySelectorAll('.map-reservation-row').forEach(r => r.classList.remove('active'));
        row.classList.add('active');

        // Toggle detail row
        const detailRow = document.querySelector(`.map-reservation-detail[data-conf="${conf}"]`);
        document.querySelectorAll('.map-reservation-detail').forEach(d => d.classList.remove('show'));
        if (detailRow) {
          detailRow.classList.add('show');
        }

        // Highlight the assigned driver on the map
        if (driverId) {
          this.highlightDriverOnMap(driverId);
        } else {
          // No driver - show popup for unassigned
          L.popup()
            .setLatLng([44.9778, -93.2650])
            .setContent(`<div style="text-align:center;padding:10px;"><strong>🔴 UNASSIGNED</strong><br>Conf# ${conf} has no driver assigned</div>`)
            .openOn(this.map);
        }

        // Center map on reservation markers if they exist
        const markerSet = this.markers.find(m => m.conf === conf);
        if (markerSet) {
          const group = L.featureGroup([markerSet.pickup, markerSet.dropoff]);
          this.map.fitBounds(group.getBounds().pad(0.2));
        }
      });
    });
  }

  initializeGPSMap() {
    if (this.gpsMap) {
      // Map already initialized, just invalidate size
      setTimeout(() => {
        this.gpsMap.invalidateSize();
      }, 100);
      return;
    }

    // Initialize Leaflet map centered on Minneapolis
    this.gpsMap = L.map('gpsMap').setView([44.9778, -93.2650], 12);

    // Add OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(this.gpsMap);

    // Add vehicle markers
    this.addVehicleMarkers();

    // Setup GPS controls
    this.setupGPSControls();

    // Setup vehicle card interactions
    this.setupVehicleCardInteractions();
  }

  addVehicleMarkers() {
    // Use rendered drivers array (simulated positions)
    const vehicles = this.renderedDrivers;

    vehicles.forEach(vehicle => {
      // Create vehicle marker
      const markerIcon = L.divIcon({
        className: `vehicle-marker ${vehicle.status}`,
        html: '🚗',
        iconSize: [40, 40]
      });

      const marker = L.marker([vehicle.lat, vehicle.lng], { icon: markerIcon })
        .addTo(this.gpsMap)
        .bindPopup(`
          <strong>${vehicle.name}</strong><br>
          Driver: ${vehicle.driver}<br>
          Status: ${vehicle.status === 'available' ? 'Available' : 'On Trip'}<br>
          <em style="color: #ffa500;">🔸 Rendered Location</em>
        `);

      this.vehicleMarkers.push({ id: vehicle.id, marker, vehicle });
    });
  }

  // Refresh vehicle markers with current positions
  refreshVehicleMarkers() {
    if (!this.gpsMap) return;
    
    this.vehicleMarkers.forEach(({ marker, vehicle }) => {
      // Find updated position from rendered drivers
      const updated = this.renderedDrivers.find(d => d.id === vehicle.id);
      if (updated) {
        marker.setLatLng([updated.lat, updated.lng]);
      }
    });
  }

  setupGPSControls() {
    // Recenter button
    document.getElementById('gpsRecenterBtn')?.addEventListener('click', () => {
      this.gpsMap.setView([44.9778, -93.2650], 12);
    });

    // Zoom in button
    document.getElementById('gpsZoomInBtn')?.addEventListener('click', () => {
      this.gpsMap.zoomIn();
    });

    // Zoom out button
    document.getElementById('gpsZoomOutBtn')?.addEventListener('click', () => {
      this.gpsMap.zoomOut();
    });
  }

  setupVehicleCardInteractions() {
    // Make vehicle cards clickable to center map on vehicle
    document.querySelectorAll('.gps-vehicle-card').forEach((card, index) => {
      card.addEventListener('click', () => {
        // Update active state
        document.querySelectorAll('.gps-vehicle-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');

        // Center map on vehicle
        if (this.vehicleMarkers[index]) {
          const { marker } = this.vehicleMarkers[index];
          this.gpsMap.setView(marker.getLatLng(), 15);
          marker.openPopup();
        }
      });
    });
  }

  openManageResources() {
    // Show modal with breadcrumb, then redirect
    // Check if we're in an iframe (embedded in the main app)
    if (window.self !== window.top) {
      // Open modal in a new window or show inline modal
      const modalWindow = window.open('manage-resources-modal.html', 'ManageResources', 'width=600,height=400,centerscreen=yes');
      
      // If popup is blocked or user closes it, fallback to direct navigation
      if (!modalWindow) {
        window.parent.postMessage({
          action: 'navigateToSystemMapping'
        }, '*');
      }
    } else {
      // Open modal page directly
      window.location.href = 'manage-resources-modal.html';
    }
  }

  openLinkDriversCars() {
    // Open Link Drivers and Cars modal in a popup window
    const width = 850;
    const height = 650;
    const left = (screen.width - width) / 2;
    const top = (screen.height - height) / 2;
    
    window.open(
      'link-drivers-cars.html',
      'LinkDriversCars',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new DispatchGrid();
});
