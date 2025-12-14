import { ReservationManager } from './ReservationManager.js';
import { MapManager } from './MapManager.js';
import { UIManager } from './UIManager.js';
import { MapboxService } from './MapboxService.js';
import { DriverTracker } from './DriverTracker.js';

class LimoReservationSystem {
  constructor() {
    this.reservationManager = new ReservationManager();
    this.mapManager = new MapManager();
    this.uiManager = new UIManager(this.reservationManager, this.mapManager);
    this.mapboxService = new MapboxService();
    this.driverTracker = new DriverTracker();
    this.pickupData = null;
    this.dropoffData = null;
    this.companyLocation = null;
    
    this.init();
  }

  async init() {
    // Initialize UI
    this.uiManager.init();
    
    // Get company location from zip code
    await this.getCompanyLocation();
    
    // Initialize maps with company location
    const center = this.companyLocation || [44.8848, -93.2223]; // Default to Minneapolis if geocoding fails
    this.mapManager.initUserMap('userMap', center);
    this.mapManager.initDriverMap('driverMap', center);
    
    // Set driver tracker base location
    this.driverTracker.setBaseLocation(center);
    
    // Load initial data (will use company location)
    this.loadInitialData();
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Setup address autocomplete
    this.setupAddressAutocomplete();
    
    // Start driver tracking
    this.startDriverTracking();
    
    // Start auto-update
    this.startAutoUpdate();
    
    // Handle URL parameters for view switching
    this.handleURLParameters();
  }
  
  handleURLParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    const view = urlParams.get('view');
    
    if (view === 'user') {
      this.uiManager.switchView('userView');
    } else if (view === 'driver') {
      this.uiManager.switchView('driverView');
    } else if (view === 'reservations') {
      this.uiManager.switchView('farm-out_reservations_View');
    }
  }

  async getCompanyLocation() {
    try {
      // Get company zip code from global variable
      const companyZip = window.COMPANY_ZIP_CODE || '55431';
      
      console.log('Geocoding company zip code:', companyZip);
      
      // Geocode the zip code to get coordinates
      const results = await this.mapboxService.geocodeAddress(companyZip);
      
      if (results && results.length > 0) {
        // Convert from [lng, lat] to [lat, lng] for Leaflet
        this.companyLocation = [results[0].coordinates[1], results[0].coordinates[0]];
        console.log('✓ Company location set to:', this.companyLocation, '(' + companyZip + ')');
      } else {
        console.warn('No geocoding results for zip code:', companyZip);
      }
    } catch (error) {
      console.error('Error getting company location:', error);
      // Will use default location
    }
  }

  startDriverTracking() {
    // Start tracking drivers and update map with their positions
    this.driverTracker.startTracking((drivers) => {
      this.mapManager.updateLiveDrivers(drivers);
      this.updateDriverStatusPanel(drivers);
    });
  }

  updateDriverStatusPanel(drivers) {
    const driverCountEl = document.getElementById('driverCount');
    const driverListEl = document.getElementById('driverStatusList');
    
    if (!driverCountEl || !driverListEl) return;
    
    // Update count
    const availableCount = drivers.filter(d => d.status === 'available').length;
    driverCountEl.textContent = availableCount;
    
    // Update list
    driverListEl.innerHTML = drivers.map(driver => {
      const statusEmoji = {
        'available': '🟢',
        'enroute': '🟡',
        'busy': '🔴',
        'offline': '⚫'
      }[driver.status] || '🟢';
      
      return `
        <div class="driver-status-item ${driver.status}" data-driver-id="${driver.id}">
          <span class="driver-status-icon">${statusEmoji}</span>
          <div class="driver-status-info">
            <div class="driver-status-name">${driver.name}</div>
            <div class="driver-status-details">${driver.vehicle} • ${driver.status}</div>
          </div>
        </div>
      `;
    }).join('');
    
    // Add click handlers to show directions
    driverListEl.querySelectorAll('.driver-status-item').forEach(item => {
      item.addEventListener('click', async () => {
        const driverId = parseInt(item.dataset.driverId);
        await this.showDriverDirections(driverId, drivers);
      });
    });
  }

  async showDriverDirections(driverId, drivers) {
    const driver = drivers.find(d => d.id === driverId);
    if (!driver || !this.mapManager.userMap) return;

    // Get a nearby reservation (for demo, get first pending reservation)
    const reservations = this.reservationManager.getAllReservations();
    const targetReservation = reservations.find(r => r.status === 'pending' || r.status === 'accepted');
    
    if (!targetReservation || !targetReservation.pickupCoords) {
      // Just focus on driver if no target
      this.mapManager.userMap.setView(driver.position, 15);
      const markerId = `user-${driver.id}`;
      const marker = this.mapManager.liveDriverMarkers.get(markerId);
      if (marker) {
        marker.openPopup();
      }
      return;
    }

    try {
      // Get route from driver to pickup location
      // Convert from [lat, lng] to [lng, lat] for Mapbox
      const driverCoords = [driver.position[1], driver.position[0]];
      const pickupCoords = [targetReservation.pickupCoords[1], targetReservation.pickupCoords[0]];
      
      const routeData = await this.mapboxService.getRoute([driverCoords, pickupCoords]);
      
      // Display route on map
      this.mapManager.showDriverRoute(routeData, driver.position, targetReservation.pickupCoords);
      
      // Focus on driver and show route info
      const markerId = `user-${driver.id}`;
      const marker = this.mapManager.liveDriverMarkers.get(markerId);
      if (marker) {
        marker.setPopupContent(`
          <div class="popup-content">
            <div class="popup-title">🚗 ${driver.name}</div>
            <div class="popup-info">
              <div class="popup-field">
                <span class="popup-label">Status:</span>
                <span class="popup-value" style="color: #4caf50; font-weight: 600;">
                  ${driver.status.charAt(0).toUpperCase() + driver.status.slice(1)}
                </span>
              </div>
              <div class="popup-field">
                <span class="popup-label">Vehicle:</span>
                <span class="popup-value">${driver.vehicle}</span>
              </div>
              <div class="popup-field">
                <span class="popup-label">To Pickup:</span>
                <span class="popup-value" style="font-weight: 600; color: #2196f3;">${routeData.distance}</span>
              </div>
              <div class="popup-field">
                <span class="popup-label">ETA:</span>
                <span class="popup-value" style="font-weight: 600; color: #2196f3;">${routeData.duration}</span>
              </div>
            </div>
          </div>
        `);
        marker.openPopup();
      }
    } catch (error) {
      console.error('Error showing driver directions:', error);
      // Fallback to just focusing on driver
      this.mapManager.userMap.setView(driver.position, 15);
    }
  }

  loadInitialData() {
    // Use company location for sample data
    const [baseLat, baseLng] = this.companyLocation || [44.8848, -93.2223];
    
    // Add some sample reservations around company location
    const sampleReservations = [
      {
        passengerName: 'John Smith',
        phone: '(555) 123-4567',
        email: 'john.smith@example.com',
        pickupLocation: 'Minneapolis-St Paul Airport, MN',
        dropoffLocation: 'Downtown Minneapolis, MN',
        pickupDate: '2024-01-15',
        pickupTime: '14:30',
        vehicleType: 'stretch',
        passengers: 4,
        specialInstructions: 'VIP client, provide champagne',
        status: 'pending',
        pickupCoords: [baseLat - 0.05, baseLng - 0.06],
        dropoffCoords: [baseLat + 0.02, baseLng + 0.01]
      },
      {
        passengerName: 'Sarah Johnson',
        phone: '(555) 234-5678',
        email: 'sarah.j@example.com',
        pickupLocation: 'Mall of America, Bloomington, MN',
        dropoffLocation: 'Target Center, Minneapolis, MN',
        pickupDate: '2024-01-15',
        pickupTime: '09:00',
        vehicleType: 'suv',
        passengers: 6,
        specialInstructions: 'Family trip, child seats needed',
        status: 'accepted',
        driverName: 'Mike Driver',
        pickupCoords: [baseLat - 0.03, baseLng - 0.02],
        dropoffCoords: [baseLat + 0.01, baseLng]
      },
      {
        passengerName: 'Robert Williams',
        phone: '(555) 345-6789',
        email: 'r.williams@example.com',
        pickupLocation: 'St. Paul Hotel, St. Paul, MN',
        dropoffLocation: 'Minneapolis Convention Center, MN',
        pickupDate: '2024-01-14',
        pickupTime: '18:00',
        vehicleType: 'luxury',
        passengers: 2,
        specialInstructions: 'Anniversary celebration',
        status: 'completed',
        driverName: 'Lisa Driver',
        pickupCoords: [baseLat, baseLng + 0.04],
        dropoffCoords: [baseLat + 0.01, baseLng - 0.01]
      },
      {
        passengerName: 'Emily Davis',
        phone: '(555) 456-7890',
        email: 'emily.d@example.com',
        pickupLocation: 'University of Minnesota, Minneapolis, MN',
        dropoffLocation: 'Walker Art Center, Minneapolis, MN',
        pickupDate: '2024-01-15',
        pickupTime: '11:00',
        vehicleType: 'sedan',
        passengers: 2,
        specialInstructions: 'Tourist sightseeing tour',
        status: 'pending',
        pickupCoords: [baseLat + 0.03, baseLng - 0.02],
        dropoffCoords: [baseLat + 0.01, baseLng - 0.01]
      },
      {
        passengerName: 'Michael Brown',
        phone: '(555) 567-8901',
        email: 'm.brown@example.com',
        pickupLocation: 'Edina Galleria, Edina, MN',
        dropoffLocation: 'US Bank Stadium, Minneapolis, MN',
        pickupDate: '2024-01-15',
        pickupTime: '16:45',
        vehicleType: 'suv',
        passengers: 5,
        specialInstructions: 'Group tour, flexible schedule',
        status: 'pending',
        pickupCoords: [baseLat - 0.02, baseLng - 0.03],
        dropoffCoords: [baseLat, baseLng]
      }
    ];

    sampleReservations.forEach(reservation => {
      this.reservationManager.addReservation(reservation);
    });

    // Update all views
    this.uiManager.updateAllViews();
  }

  setupEventListeners() {
    // View switching
    document.getElementById('userViewBtn').addEventListener('click', () => {
      this.uiManager.switchView('userView');
    });

    document.getElementById('driverViewBtn').addEventListener('click', () => {
      this.uiManager.switchView('driverView');
    });

    // Reservations button removed from UI
    const reservationsBtn = document.getElementById('reservationsBtn');
    if (reservationsBtn) {
      reservationsBtn.addEventListener('click', () => {
        // Check if we're in an iframe, if so tell parent to switch to reservations
        if (window.self !== window.top) {
          window.parent.postMessage({ action: 'switchSection', section: 'reservations' }, '*');
        } else {
          this.uiManager.switchView('reservationsView');
        }
      });
    }

    document.getElementById('farmOutBtn').addEventListener('click', () => {
      // Switch to the farm-out reservations view (dark table)
      this.uiManager.switchView('farm-out_reservations_View');
    });

    // Form submission
    document.getElementById('reservationForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleNewReservation();
    });

    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        const filter = e.target.dataset.filter;
        this.uiManager.filterReservations(filter);
      });
    });

    // Map view selectors
    document.getElementById('userMapView').addEventListener('change', (e) => {
      this.mapManager.changeMapLayer(e.target.value, 'user');
    });

    document.getElementById('driverMapView').addEventListener('change', (e) => {
      this.mapManager.changeMapLayer(e.target.value, 'driver');
    });
  }

  setupAddressAutocomplete() {
    // Pickup location autocomplete
    const pickupInput = document.getElementById('pickupLocation');
    const pickupSuggestions = document.getElementById('pickupSuggestions');
    let pickupDebounceTimer;

    pickupInput.addEventListener('input', (e) => {
      clearTimeout(pickupDebounceTimer);
      const query = e.target.value;
      
      if (query.length < 3) {
        pickupSuggestions.classList.remove('active');
        return;
      }
      
      pickupDebounceTimer = setTimeout(async () => {
        await this.searchAddress(pickupInput, pickupSuggestions, 'pickup');
      }, 300);
    });

    pickupInput.addEventListener('blur', () => {
      setTimeout(() => pickupSuggestions.classList.remove('active'), 200);
    });

    // Dropoff location autocomplete
    const dropoffInput = document.getElementById('dropoffLocation');
    const dropoffSuggestions = document.getElementById('dropoffSuggestions');
    let dropoffDebounceTimer;

    dropoffInput.addEventListener('input', (e) => {
      clearTimeout(dropoffDebounceTimer);
      const query = e.target.value;
      
      if (query.length < 3) {
        dropoffSuggestions.classList.remove('active');
        return;
      }
      
      dropoffDebounceTimer = setTimeout(async () => {
        await this.searchAddress(dropoffInput, dropoffSuggestions, 'dropoff');
      }, 300);
    });

    dropoffInput.addEventListener('blur', () => {
      setTimeout(() => dropoffSuggestions.classList.remove('active'), 200);
    });
  }

  async searchAddress(inputElement, suggestionsContainer, type) {
    try {
      const results = await this.mapboxService.geocodeAddress(inputElement.value);
      this.showAddressSuggestions(inputElement, suggestionsContainer, results, type);
    } catch (error) {
      console.error('Address search error:', error);
    }
  }

  showAddressSuggestions(inputElement, suggestionsContainer, results, type) {
    if (!results || results.length === 0) {
      suggestionsContainer.classList.remove('active');
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
        this.selectAddress(inputElement, results[index], type);
        suggestionsContainer.classList.remove('active');
      });
    });

    suggestionsContainer.classList.add('active');
  }

  selectAddress(inputElement, addressData, type) {
    // Fill in the location field
    inputElement.value = addressData.name || addressData.address;
    
    // Store the full data
    if (type === 'pickup') {
      this.pickupData = addressData;
      // Fill pickup detail fields
      document.getElementById('pickupAddress').value = addressData.address || '';
      document.getElementById('pickupCity').value = addressData.context?.city || '';
      document.getElementById('pickupState').value = addressData.context?.state || '';
      document.getElementById('pickupZip').value = addressData.context?.postcode || '';
    } else {
      this.dropoffData = addressData;
      // Fill dropoff detail fields
      document.getElementById('dropoffAddress').value = addressData.address || '';
      document.getElementById('dropoffCity').value = addressData.context?.city || '';
      document.getElementById('dropoffState').value = addressData.context?.state || '';
      document.getElementById('dropoffZip').value = addressData.context?.postcode || '';
    }
  }

  handleNewReservation() {
    const form = document.getElementById('reservationForm');
    
    // Use stored coordinates from geocoding or generate random ones
    const pickupCoords = this.pickupData?.coordinates || [
      34.0522 + (Math.random() - 0.5) * 0.2,
      -118.2437 + (Math.random() - 0.5) * 0.2
    ];
    const dropoffCoords = this.dropoffData?.coordinates || [
      34.0522 + (Math.random() - 0.5) * 0.2,
      -118.2437 + (Math.random() - 0.5) * 0.2
    ];

    const firstName = document.getElementById('passengerFirstName').value;
    const lastName = document.getElementById('passengerLastName').value;
    const passengerName = `${firstName} ${lastName}`;

    const reservation = {
      passengerName: passengerName,
      phone: document.getElementById('phone').value,
      email: document.getElementById('email').value,
      pickupLocation: document.getElementById('pickupLocation').value,
      dropoffLocation: document.getElementById('dropoffLocation').value,
      pickupDate: document.getElementById('pickupDate').value,
      pickupTime: document.getElementById('pickupTime').value,
      vehicleType: document.getElementById('vehicleType').value,
      passengers: document.getElementById('passengers').value,
      specialInstructions: document.getElementById('specialInstructions').value,
      status: 'pending',
      pickupCoords,
      dropoffCoords
    };

    this.reservationManager.addReservation(reservation);
    this.uiManager.updateAllViews();
    
    // Show success message
    alert('Reservation created successfully!');
    
    // Reset form and stored data
    form.reset();
    this.pickupData = null;
    this.dropoffData = null;
    
    // Clear address detail fields
    document.getElementById('pickupAddress').value = '';
    document.getElementById('pickupCity').value = '';
    document.getElementById('pickupState').value = '';
    document.getElementById('pickupZip').value = '';
    document.getElementById('dropoffAddress').value = '';
    document.getElementById('dropoffCity').value = '';
    document.getElementById('dropoffState').value = '';
    document.getElementById('dropoffZip').value = '';
  }

  startAutoUpdate() {
    // Simulate real-time updates every 30 seconds
    setInterval(() => {
      // Randomly update a pending reservation to accepted (10% chance)
      const pendingReservations = this.reservationManager.getReservationsByStatus('pending');
      if (pendingReservations.length > 0 && Math.random() < 0.1) {
        const randomReservation = pendingReservations[Math.floor(Math.random() * pendingReservations.length)];
        const driverNames = ['Mike Driver', 'Lisa Driver', 'Tom Driver', 'Sarah Driver', 'John Driver'];
        const randomDriver = driverNames[Math.floor(Math.random() * driverNames.length)];
        this.reservationManager.acceptReservation(randomReservation.id, randomDriver);
        this.uiManager.updateAllViews();
      }
    }, 30000);
  }
}

// Initialize the system when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new LimoReservationSystem();
});
