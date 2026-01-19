class DispatchGrid {
  constructor() {
    this.map = null;
    this.gpsMap = null;
    this.markers = [];
    this.vehicleMarkers = [];
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.updateCurrentTime();
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
      // Map already initialized, just invalidate size
      setTimeout(() => {
        this.map.invalidateSize();
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

    // Add reservation markers
    this.addReservationMarkers();

    // Setup map controls
    this.setupMapControls();

    // Setup reservation list interactions
    this.setupMapReservationList();
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
    // Make reservation rows clickable to show details and center map
    document.querySelectorAll('.map-reservation-row').forEach(row => {
      row.addEventListener('click', (e) => {
        const conf = row.dataset.conf;
        
        // Toggle active state
        document.querySelectorAll('.map-reservation-row').forEach(r => r.classList.remove('active'));
        row.classList.add('active');

        // Toggle detail row
        const detailRow = document.querySelector(`.map-reservation-detail[data-conf="${conf}"]`);
        document.querySelectorAll('.map-reservation-detail').forEach(d => d.classList.remove('show'));
        if (detailRow) {
          detailRow.classList.add('show');
        }

        // Center map on this reservation's markers
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
    // Sample vehicle locations
    const vehicles = [
      {
        id: 'car-suv',
        lat: 44.9778,
        lng: -93.2650,
        name: '7 Passenger Suv',
        driver: 'Eric Brustad',
        status: 'available'
      },
      {
        id: 'black-suv',
        lat: 44.9500,
        lng: -93.2200,
        name: 'BLACK_SUV',
        driver: 'Eric B',
        status: 'busy'
      },
      {
        id: 'sedan',
        lat: 45.0000,
        lng: -93.2900,
        name: 'Sedan',
        driver: 'Tony Arroyo',
        status: 'available'
      }
    ];

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
          Status: ${vehicle.status === 'available' ? 'Available' : 'On Trip'}
        `);

      this.vehicleMarkers.push({ id: vehicle.id, marker, vehicle });
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
