class DispatchGrid {
  constructor() {
    this.map = null;
    this.gpsMap = null;
    this.markers = [];
    this.vehicleMarkers = [];
    this.useLiveLocations = false; // Toggle state: false = rendered, true = live
    this.liveLocationInterval = null;
    this.renderedDrivers = []; // Simulated driver positions
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.updateCurrentTime();
    this.initDriverLocationToggle();
    this.initRenderedDrivers();
  }

  // Initialize the Live/Rendered toggle
  initDriverLocationToggle() {
    const toggle = document.getElementById('liveDriverToggle');
    const renderedLabel = document.getElementById('renderedLabel');
    const liveLabel = document.getElementById('liveLabel');
    
    if (!toggle) return;
    
    // Set initial state
    renderedLabel?.classList.add('active');
    
    toggle.addEventListener('change', () => {
      this.useLiveLocations = toggle.checked;
      
      // Update label styles
      if (this.useLiveLocations) {
        renderedLabel?.classList.remove('active');
        liveLabel?.classList.add('active');
        console.log('[DispatchGrid] Switched to LIVE driver locations');
        this.startLiveLocationTracking();
      } else {
        liveLabel?.classList.remove('active');
        renderedLabel?.classList.add('active');
        console.log('[DispatchGrid] Switched to RENDERED driver locations');
        this.stopLiveLocationTracking();
        this.refreshVehicleMarkers();
      }
    });
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
    if (!this.gpsMap) return;
    
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
    // This would load data from backend
  }

  performSearch(query) {
    console.log('Searching for:', query);
    if (!query) return;
    
    const rows = document.querySelectorAll('.dispatch-grid-table tbody tr');
    rows.forEach(row => {
      const text = row.textContent.toLowerCase();
      if (text.includes(query.toLowerCase())) {
        row.style.display = '';
      } else {
        row.style.display = 'none';
      }
    });
  }

  applyFilters() {
    console.log('Applying filters...');
    // This would filter the grid based on checked filters
    const filters = {
      newLeg: document.querySelector('.filter-checkbox:nth-child(1) input').checked,
      settled: document.querySelector('.filter-checkbox:nth-child(2) input').checked,
      inHouse: document.querySelector('.filter-checkbox:nth-child(3) input').checked,
      farmIn: document.querySelector('.filter-checkbox:nth-child(4) input').checked,
      farmOut: document.querySelector('.filter-checkbox:nth-child(5) input').checked,
      quotes: document.querySelector('.filter-checkbox:nth-child(6) input').checked
    };
    console.log('Active filters:', filters);
  }

  sortColumn(columnName) {
    console.log('Sorting by:', columnName);
    // This would sort the table by the selected column
  }

  openReservation(confNum) {
    console.log('Opening reservation:', confNum);
    window.location.href = `reservation-form.html?conf=${confNum}`;
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
    // Clear existing driver markers on map
    if (this.mapDriverMarkers) {
      this.mapDriverMarkers.forEach(marker => this.map.removeLayer(marker));
    }
    this.mapDriverMarkers = [];
    this.mapDriverMarkersById = {};
    
    // Use rendered drivers or fetch live based on toggle
    const drivers = this.useLiveLocations ? [] : this.renderedDrivers;
    
    drivers.forEach(driver => {
      const statusColor = driver.status === 'available' ? '#28a745' : 
                          driver.status === 'busy' ? '#ffc107' : '#6c757d';
      
      const markerIcon = L.divIcon({
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
      });

      const marker = L.marker([driver.lat, driver.lng], { icon: markerIcon })
        .addTo(this.map)
        .bindPopup(`
          <strong>${driver.driver}</strong><br>
          Vehicle: ${driver.name}<br>
          Status: ${driver.status === 'available' ? '🟢 Available' : '🟡 On Trip'}
        `);

      this.mapDriverMarkers.push(marker);
      this.mapDriverMarkersById[driver.id] = { marker, driver };
    });
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
