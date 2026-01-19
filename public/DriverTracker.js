import { fetchDrivers } from './api-service.js';

export class DriverTracker {
  constructor() {
    this.drivers = [];
    this.trackingInterval = null;
    this.updateFrequency = 5000; // Update every 5 seconds
    this.baseLocation = [44.8848, -93.2223]; // Default to Minneapolis (near 55431)
    this.onDriversUpdate = null; // Callback for driver updates
    this.isLoading = false;
  }

  setBaseLocation(location) {
    this.baseLocation = location;
  }

  // Convert raw driver data to tracked driver format
  convertToTrackedDriver(d, idx) {
    const [baseLat, baseLng] = this.baseLocation;
    const jitter = () => (Math.random() - 0.5) * 0.08; // ~5 mile scatter

    const first = d.first_name || d.first || '';
    const last = d.last_name || d.last || '';
    const name = [first, last].filter(Boolean).join(' ').trim() || d.name || `Driver ${idx + 1}`;
    // Priority: vehicle (full display name) > vehicle_type > car_type > fallback
    const vehicle = d.vehicle || d.vehicle_type || d.car_type || 'Not Assigned';
    const phone = d.cell_phone || d.mobile_phone || d.phone || d.phone_number || '';
    const affiliate = d.affiliate || d.affiliate_name || d.company || 'RELIA Fleet';
    const isActive = d.is_active !== false && d.status !== 'INACTIVE';

    // Check if we already have a tracked driver with this ID to preserve position
    const existingDriver = this.drivers.find(existing => existing.id === d.id);

    return {
      id: d.id || idx + 1,
      name,
      status: existingDriver?.status || (isActive ? 'available' : 'offline'),
      vehicle,
      affiliate,
      phone,
      position: existingDriver?.position || [baseLat + jitter(), baseLng + jitter()],
      heading: existingDriver?.heading || Math.random() * 360,
      speed: existingDriver?.speed || (0.0006 + Math.random() * 0.0006),
      assignedReservationId: existingDriver?.assignedReservationId || null,
      notes: existingDriver?.notes || ''
    };
  }

  // Load drivers from localStorage cache
  pullCachedDrivers() {
    try {
      const raw = localStorage.getItem('relia_driver_directory');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.warn('[DriverTracker] Unable to read cached drivers:', e.message);
      return [];
    }
  }

  // Fetch drivers from Supabase API
  async fetchDriversFromAPI() {
    try {
      console.log('[DriverTracker] Fetching drivers from Supabase...');
      const drivers = await fetchDrivers();
      if (drivers && Array.isArray(drivers)) {
        // Cache to localStorage for offline use
        try {
          localStorage.setItem('relia_driver_directory', JSON.stringify(drivers));
        } catch (e) {
          console.warn('[DriverTracker] Unable to cache drivers:', e.message);
        }
        console.log(`[DriverTracker] ✅ Loaded ${drivers.length} drivers from API`);
        return drivers;
      }
      return [];
    } catch (error) {
      console.error('[DriverTracker] Failed to fetch drivers from API:', error);
      return [];
    }
  }

  // Initialize drivers - tries cache first, then API
  async initializeDrivers(forceRefresh = false) {
    if (this.isLoading) return;
    this.isLoading = true;

    const [baseLat, baseLng] = this.baseLocation;
    let rawDrivers = [];

    if (!forceRefresh) {
      rawDrivers = this.pullCachedDrivers();
    }

    // If no cached drivers or force refresh, fetch from API
    if (rawDrivers.length === 0 || forceRefresh) {
      rawDrivers = await this.fetchDriversFromAPI();
    }

    if (rawDrivers.length > 0) {
      this.drivers = rawDrivers.map((d, idx) => this.convertToTrackedDriver(d, idx));
      this.applyStatusOverrides();
      console.log(`[DriverTracker] Initialized ${this.drivers.length} drivers`);
    } else {
      console.warn('[DriverTracker] No drivers available for tracking');
      this.drivers = [];
    }

    this.isLoading = false;
  }

  // Refresh drivers from API without stopping tracking
  async refreshDrivers() {
    const rawDrivers = await this.fetchDriversFromAPI();
    if (rawDrivers.length > 0) {
      this.drivers = rawDrivers.map((d, idx) => this.convertToTrackedDriver(d, idx));
      this.applyStatusOverrides();
      console.log(`[DriverTracker] Refreshed ${this.drivers.length} drivers`);
      
      // Trigger callback if set
      if (this.onDriversUpdate) {
        this.onDriversUpdate(this.drivers);
      }
    }
    return this.drivers;
  }

  async startTracking(callback) {
    await this.initializeDrivers();
    
    // Store callback for later use
    this.onDriversUpdate = callback;
    
    // Initial callback
    if (callback) {
      callback(this.drivers);
    }

    // Update driver positions periodically
    this.trackingInterval = setInterval(() => {
      this.applyStatusOverrides();
      this.updateDriverPositions();
      if (callback) {
        callback(this.drivers);
      }
    }, this.updateFrequency);
  }

  stopTracking() {
    if (this.trackingInterval) {
      clearInterval(this.trackingInterval);
      this.trackingInterval = null;
    }
  }

  updateDriverPositions() {
    this.drivers.forEach(driver => {
      // Simulate realistic GPS movement
      if (driver.status === 'available' || driver.status === 'enroute') {
        // Calculate new position based on heading and speed
        const headingRad = (driver.heading * Math.PI) / 180;
        const latChange = Math.cos(headingRad) * driver.speed;
        const lngChange = Math.sin(headingRad) * driver.speed;

        driver.position = [
          driver.position[0] + latChange,
          driver.position[1] + lngChange
        ];

        // Randomly adjust heading slightly (simulate turns)
        if (Math.random() < 0.3) {
          driver.heading += (Math.random() - 0.5) * 30;
          // Keep heading between 0 and 360
          if (driver.heading < 0) driver.heading += 360;
          if (driver.heading >= 360) driver.heading -= 360;
        }

        // Keep drivers within LA area boundaries
        this.constrainToArea(driver);
      }
    });
  }

  constrainToArea(driver) {
    // Create boundaries around base location (approx 20 mile radius)
    const [baseLat, baseLng] = this.baseLocation;
    const bounds = {
      north: baseLat + 0.3,
      south: baseLat - 0.3,
      east: baseLng + 0.3,
      west: baseLng - 0.3
    };

    // Bounce off boundaries by reversing heading
    if (driver.position[0] > bounds.north || driver.position[0] < bounds.south) {
      driver.heading = (180 - driver.heading + 360) % 360;
      driver.position[0] = Math.max(bounds.south, Math.min(bounds.north, driver.position[0]));
    }
    if (driver.position[1] > bounds.east || driver.position[1] < bounds.west) {
      driver.heading = (360 - driver.heading) % 360;
      driver.position[1] = Math.max(bounds.west, Math.min(bounds.east, driver.position[1]));
    }
  }

  assignDriver(driverId, reservationId) {
    const driver = this.drivers.find(d => d.id === driverId);
    if (driver) {
      driver.assignedReservationId = reservationId;
      driver.status = 'enroute';
      this.persistStatusOverrides();
    }
  }

  updateDriverStatus(driverId, status) {
    const driver = this.drivers.find(d => d.id === driverId);
    if (driver) {
      driver.status = status;
      if (status === 'available') {
        driver.assignedReservationId = null;
      }
      this.persistStatusOverrides();
    }
  }

  applyStatusOverrides() {
    try {
      const raw = localStorage.getItem('relia_driver_status_overrides');
      if (!raw) return;
      const overrides = JSON.parse(raw);
      if (!Array.isArray(overrides)) return;
      overrides.forEach(override => {
        const driver = this.drivers.find(d => d.id === override.id);
        if (!driver) return;
        if (override.status) {
          driver.status = override.status;
        }
        if (override.notes) {
          driver.notes = override.notes;
        }
      });
    } catch (error) {
      console.warn('[DriverTracker] Unable to apply driver status overrides:', error);
    }
  }

  persistStatusOverrides() {
    try {
      const overrides = this.drivers.map(driver => ({
        id: driver.id,
        status: driver.status,
        notes: driver.notes || ''
      }));
      localStorage.setItem('relia_driver_status_overrides', JSON.stringify(overrides));
    } catch (error) {
      console.warn('[DriverTracker] Unable to persist driver status overrides:', error);
    }
  }

  getDriverById(driverId) {
    return this.drivers.find(d => d.id === driverId);
  }

  getAvailableDrivers() {
    return this.drivers.filter(d => d.status === 'available');
  }

  getAllDrivers() {
    return this.drivers;
  }

  // Navigate driver towards a destination
  navigateToDestination(driverId, destination) {
    const driver = this.drivers.find(d => d.id === driverId);
    if (driver) {
      // Calculate heading towards destination
      const latDiff = destination[0] - driver.position[0];
      const lngDiff = destination[1] - driver.position[1];
      driver.heading = (Math.atan2(lngDiff, latDiff) * 180) / Math.PI;
      
      // Increase speed when enroute
      driver.speed = 0.0015;
      driver.status = 'enroute';
    }
  }
}
