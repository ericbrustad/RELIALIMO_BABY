export class MapManager {
  constructor() {
    this.userMap = null;
    this.driverMap = null;
    this.userMarkers = [];
    this.driverMarkers = [];
    this.liveDriverMarkers = new Map(); // Store driver markers by driver ID
    this.currentUserLayer = null;
    this.currentDriverLayer = null;
    this.currentRoute = null;
    
    // Custom marker icons
    this.pickupIcon = this.createCustomIcon('#4a90e2');
    this.dropoffIcon = this.createCustomIcon('#c44536');
    this.driverIcon = this.createCustomIcon('#4caf50');
    
    // Available map tile layers
    this.mapLayers = {
      'OpenStreetMap': {
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
      },
      'OpenStreetMap Dark': {
        url: 'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png',
        attribution: '© Stadia Maps © OpenMapTiles © OpenStreetMap contributors',
        maxZoom: 20
      },
      'Satellite': {
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attribution: '© Esri © DigitalGlobe © GeoEye © Earthstar Geographics © CNES/Airbus DS © USDA © USGS © AeroGRID © IGN © IGP',
        maxZoom: 19
      },
      'Street (Carto Light)': {
        url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
        attribution: '© OpenStreetMap contributors © CARTO',
        maxZoom: 19
      },
      'Street (Carto Dark)': {
        url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        attribution: '© OpenStreetMap contributors © CARTO',
        maxZoom: 19
      },
      'Topographic': {
        url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
        attribution: '© OpenStreetMap contributors © OpenTopoMap',
        maxZoom: 17
      },
      'Transport': {
        url: 'https://{s}.tile.thunderforest.com/transport/{z}/{x}/{y}.png?apikey=',
        attribution: '© OpenStreetMap contributors © Thunderforest',
        maxZoom: 19,
        note: 'Note: Transport map may show default OSM tiles without API key'
      }
    };
  }

  createCustomIcon(color) {
    return L.divIcon({
      className: 'custom-marker',
      html: `<div style="
        background-color: ${color};
        width: 24px;
        height: 24px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.5);
      "></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
  }

  createDriverIcon(status) {
    const colors = {
      'available': '#4caf50',
      'enroute': '#ffa726',
      'arrived': '#ffd54f',
      'passenger_onboard': '#81c784',
      'busy': '#ef5350',
      'offline': '#9e9e9e'
    };
    const color = colors[status] || '#4caf50';
    
    return L.divIcon({
      className: 'driver-marker',
      html: `<div style="
        background-color: ${color};
        width: 32px;
        height: 32px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 3px 10px rgba(0,0,0,0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        position: relative;
      ">🚗</div>
      <div style="
        position: absolute;
        top: -6px;
        right: -6px;
        width: 12px;
        height: 12px;
        background: ${color};
        border: 2px solid white;
        border-radius: 50%;
        animation: pulse 2s infinite;
      "></div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });
  }

  initUserMap(containerId, center = [44.8848, -93.2223]) {
    // Use provided center or default to Minneapolis [lat, lng]
    this.userMap = L.map(containerId).setView(center, 11);
    
    // Add default tile layer
    this.currentUserLayer = this.createTileLayer('OpenStreetMap');
    this.currentUserLayer.addTo(this.userMap);

    return this.userMap;
  }

  initDriverMap(containerId, center = [44.8848, -93.2223]) {
    // Use provided center or default to Minneapolis [lat, lng]
    this.driverMap = L.map(containerId).setView(center, 11);
    
    // Add default tile layer
    this.currentDriverLayer = this.createTileLayer('OpenStreetMap');
    this.currentDriverLayer.addTo(this.driverMap);

    // Add driver position marker at center
    L.marker(center, { icon: this.driverIcon })
      .addTo(this.driverMap)
      .bindPopup(`
        <div class="popup-content">
          <div class="popup-title">Your Location</div>
          <div class="popup-info">
            <div class="popup-field">
              <span class="popup-label">Status:</span>
              <span class="popup-value">Available</span>
            </div>
          </div>
        </div>
      `);

    return this.driverMap;
  }

  createTileLayer(layerName) {
    const layerConfig = this.mapLayers[layerName];
    return L.tileLayer(layerConfig.url, {
      attribution: layerConfig.attribution,
      maxZoom: layerConfig.maxZoom
    });
  }

  changeMapLayer(layerName, mapType) {
    const map = mapType === 'user' ? this.userMap : this.driverMap;
    const currentLayer = mapType === 'user' ? this.currentUserLayer : this.currentDriverLayer;
    
    if (!map) return;
    
    // Remove current layer
    if (currentLayer) {
      map.removeLayer(currentLayer);
    }
    
    // Add new layer
    const newLayer = this.createTileLayer(layerName);
    newLayer.addTo(map);
    
    // Store reference to current layer
    if (mapType === 'user') {
      this.currentUserLayer = newLayer;
    } else {
      this.currentDriverLayer = newLayer;
    }
  }

  getAvailableMapLayers() {
    return Object.keys(this.mapLayers);
  }

  clearUserMarkers() {
    this.userMarkers.forEach(marker => marker.remove());
    this.userMarkers = [];
  }

  clearDriverMarkers() {
    this.driverMarkers.forEach(marker => marker.remove());
    this.driverMarkers = [];
  }

  addUserMapMarkers(reservations) {
    this.clearUserMarkers();

    reservations.forEach(reservation => {
      if (reservation.pickupCoords && reservation.dropoffCoords) {
        // Pickup marker
        const pickupMarker = L.marker(reservation.pickupCoords, { icon: this.pickupIcon })
          .addTo(this.userMap)
          .bindPopup(`
            <div class="popup-content">
              <div class="popup-title">Pickup Location</div>
              <div class="popup-info">
                <div class="popup-field">
                  <span class="popup-label">ID:</span>
                  <span class="popup-value">#${reservation.id}</span>
                </div>
                <div class="popup-field">
                  <span class="popup-label">Passenger:</span>
                  <span class="popup-value">${reservation.passengerName}</span>
                </div>
                <div class="popup-field">
                  <span class="popup-label">Location:</span>
                  <span class="popup-value">${reservation.pickupLocation}</span>
                </div>
                <div class="popup-field">
                  <span class="popup-label">Time:</span>
                  <span class="popup-value">${reservation.pickupDate} ${reservation.pickupTime}</span>
                </div>
              </div>
            </div>
          `);

        // Dropoff marker
        const dropoffMarker = L.marker(reservation.dropoffCoords, { icon: this.dropoffIcon })
          .addTo(this.userMap)
          .bindPopup(`
            <div class="popup-content">
              <div class="popup-title">Dropoff Location</div>
              <div class="popup-info">
                <div class="popup-field">
                  <span class="popup-label">ID:</span>
                  <span class="popup-value">#${reservation.id}</span>
                </div>
                <div class="popup-field">
                  <span class="popup-label">Location:</span>
                  <span class="popup-value">${reservation.dropoffLocation}</span>
                </div>
              </div>
            </div>
          `);

        // Draw line between pickup and dropoff
        const line = L.polyline(
          [reservation.pickupCoords, reservation.dropoffCoords],
          {
            color: '#4a90e2',
            weight: 2,
            opacity: 0.6,
            dashArray: '5, 10'
          }
        ).addTo(this.userMap);

        this.userMarkers.push(pickupMarker, dropoffMarker, line);
      }
    });

    // Fit bounds if there are markers
    if (this.userMarkers.length > 0) {
      const group = L.featureGroup(this.userMarkers.filter(m => m instanceof L.Marker));
      if (group.getBounds().isValid()) {
        this.userMap.fitBounds(group.getBounds(), { padding: [50, 50] });
      }
    }
  }

  addDriverMapMarkers(reservations) {
    this.clearDriverMarkers();

    // Only show pending and accepted reservations for driver
    const relevantReservations = reservations.filter(r => 
      r.status === 'pending' || r.status === 'accepted'
    );

    relevantReservations.forEach(reservation => {
      if (reservation.pickupCoords && reservation.dropoffCoords) {
        const statusColor = reservation.status === 'pending' ? '#ffa726' : '#4caf50';
        const pickupIcon = L.divIcon({
          className: 'custom-marker',
          html: `<div style="
            background-color: ${statusColor};
            width: 24px;
            height: 24px;
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.5);
          "></div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });

        // Pickup marker
        const pickupMarker = L.marker(reservation.pickupCoords, { icon: pickupIcon })
          .addTo(this.driverMap)
          .bindPopup(`
            <div class="popup-content">
              <div class="popup-title">Reservation #${reservation.id}</div>
              <div class="popup-info">
                <div class="popup-field">
                  <span class="popup-label">Status:</span>
                  <span class="popup-value">${reservation.status}</span>
                </div>
                <div class="popup-field">
                  <span class="popup-label">Passenger:</span>
                  <span class="popup-value">${reservation.passengerName}</span>
                </div>
                <div class="popup-field">
                  <span class="popup-label">Pickup:</span>
                  <span class="popup-value">${reservation.pickupLocation}</span>
                </div>
                <div class="popup-field">
                  <span class="popup-label">Time:</span>
                  <span class="popup-value">${reservation.pickupDate} ${reservation.pickupTime}</span>
                </div>
              </div>
            </div>
          `);

        // Dropoff marker
        const dropoffMarker = L.marker(reservation.dropoffCoords, { icon: this.dropoffIcon })
          .addTo(this.driverMap)
          .bindPopup(`
            <div class="popup-content">
              <div class="popup-title">Dropoff Location</div>
              <div class="popup-info">
                <div class="popup-field">
                  <span class="popup-label">Location:</span>
                  <span class="popup-value">${reservation.dropoffLocation}</span>
                </div>
              </div>
            </div>
          `);

        // Draw line between pickup and dropoff
        const line = L.polyline(
          [reservation.pickupCoords, reservation.dropoffCoords],
          {
            color: statusColor,
            weight: 2,
            opacity: 0.6,
            dashArray: '5, 10'
          }
        ).addTo(this.driverMap);

        this.driverMarkers.push(pickupMarker, dropoffMarker, line);
      }
    });

    // Fit bounds if there are markers
    if (this.driverMarkers.length > 0) {
      const group = L.featureGroup(this.driverMarkers.filter(m => m instanceof L.Marker));
      if (group.getBounds().isValid()) {
        this.driverMap.fitBounds(group.getBounds(), { padding: [50, 50] });
      }
    }
  }

  focusOnReservation(reservation, map) {
    const targetMap = map || this.driverMap;
    if (reservation.pickupCoords && reservation.dropoffCoords) {
      const bounds = L.latLngBounds([reservation.pickupCoords, reservation.dropoffCoords]);
      targetMap.fitBounds(bounds, { padding: [100, 100] });
    }
  }

  updateLiveDrivers(drivers) {
    // Update drivers on both maps
    if (this.userMap) {
      this.updateDriversOnMap(drivers, this.userMap, 'user');
    }
    if (this.driverMap) {
      this.updateDriversOnMap(drivers, this.driverMap, 'driver');
    }
  }

  updateDriversOnMap(drivers, map, mapType) {
    drivers.forEach(driver => {
      const markerId = `${mapType}-${driver.id}`;
      
      if (this.liveDriverMarkers.has(markerId)) {
        // Update existing marker position
        const marker = this.liveDriverMarkers.get(markerId);
        marker.setLatLng(driver.position);
        marker.setIcon(this.createDriverIcon(driver.status));
        
        // Update popup content
        marker.setPopupContent(this.createDriverPopupContent(driver));
      } else {
        // Create new marker
        const marker = L.marker(driver.position, { 
          icon: this.createDriverIcon(driver.status),
          zIndexOffset: 1000 // Ensure drivers appear above other markers
        })
          .addTo(map)
          .bindPopup(this.createDriverPopupContent(driver));
        
        this.liveDriverMarkers.set(markerId, marker);
      }
    });
  }

  createDriverPopupContent(driver) {
    const statusColors = {
      'available': '#4caf50',
      'enroute': '#ffa726',
      'busy': '#ef5350',
      'offline': '#9e9e9e'
    };
    const statusColor = statusColors[driver.status] || '#4caf50';
    
    return `
      <div class="popup-content">
        <div class="popup-title">🚗 ${driver.name}</div>
        <div class="popup-info">
          <div class="popup-field">
            <span class="popup-label">Status:</span>
            <span class="popup-value" style="color: ${statusColor}; font-weight: 600;">
              ${driver.status.charAt(0).toUpperCase() + driver.status.slice(1)}
            </span>
          </div>
          <div class="popup-field">
            <span class="popup-label">Vehicle:</span>
            <span class="popup-value">${driver.vehicle}</span>
          </div>
          <div class="popup-field">
            <span class="popup-label">Position:</span>
            <span class="popup-value">${driver.position[0].toFixed(4)}, ${driver.position[1].toFixed(4)}</span>
          </div>
          ${driver.assignedReservationId ? `
          <div class="popup-field">
            <span class="popup-label">Assigned to:</span>
            <span class="popup-value">Reservation #${driver.assignedReservationId}</span>
          </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  removeDriverMarker(driverId, mapType) {
    const markerId = `${mapType}-${driverId}`;
    if (this.liveDriverMarkers.has(markerId)) {
      const marker = this.liveDriverMarkers.get(markerId);
      marker.remove();
      this.liveDriverMarkers.delete(markerId);
    }
  }

  clearAllDriverMarkers() {
    this.liveDriverMarkers.forEach(marker => marker.remove());
    this.liveDriverMarkers.clear();
  }

  showDriverRoute(routeData, driverPosition, destinationPosition) {
    // Remove any existing route
    this.clearRoute();

    if (!routeData || !routeData.geometry || !this.userMap) return;

    // Convert GeoJSON geometry to Leaflet format
    // Mapbox returns [lng, lat], Leaflet expects [lat, lng]
    const coordinates = routeData.geometry.coordinates.map(coord => [coord[1], coord[0]]);

    // Draw the route with a shadow/outline effect
    const routeShadow = L.polyline(coordinates, {
      color: '#000000',
      weight: 6,
      opacity: 0.3,
      smoothFactor: 1
    }).addTo(this.userMap);

    const routeLine = L.polyline(coordinates, {
      color: '#2196f3',
      weight: 4,
      opacity: 0.8,
      smoothFactor: 1,
      dashArray: '10, 5'
    }).addTo(this.userMap);

    // Store both polylines
    this.currentRoute = L.layerGroup([routeShadow, routeLine]);

    // Fit the map to show the entire route
    const bounds = L.latLngBounds([driverPosition, destinationPosition]);
    this.userMap.fitBounds(bounds, { padding: [80, 80] });
  }

  clearRoute() {
    if (this.currentRoute) {
      this.currentRoute.remove();
      this.currentRoute = null;
    }
  }
}
