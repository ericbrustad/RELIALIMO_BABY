/**
 * Rate Section - Standalone rate calculator for reservation form iframe
 * Communicates with parent window via postMessage API
 */

class RateSection {
  constructor() {
    this.rates = {
      flat: { qty: 1, rate: 0, total: 0 },
      hour: { qty: 0, rate: 0, total: 0 },
      hourTrip: { qty: 0, rate: 0, total: 0 }, // Per Hour (per trip) - uses PU to DO time
      pass: { qty: 0, rate: 0, total: 0 },
      mile: { qty: 0, rate: 0, total: 0 },
      airport: { qty: 0, rate: 15, total: 0 } // MAC/Baggage handling fee - $15 for airport trips
    };
    this.additionalRates = []; // From Rate Management (fixed, percentage, multiplier)
    this.vehicleRates = null;
    this.pricingBasis = 'flat'; // flat, hour, hourTrip, pass, mile
    this.subtotal = 0;
    this.gratuityPercent = 20; // Default 20% gratuity
    this.gratuityTotal = 0;
    this.grandTotal = 0;
    this.payments = 0;
    this.init();
  }

  /**
   * Format a number as currency (USD)
   */
  formatCurrency(value) {
    const num = parseFloat(value) || 0;
    return '$' + num.toFixed(2);
  }

  init() {
    this.bindEvents();
    this.setupParentCommunication();
    this.calculateAll();
    this.notifyHeight();
  }

  /**
   * Notify parent of current content height for iframe resizing
   */
  notifyHeight() {
    const height = document.body.scrollHeight;
    this.notifyParent('resize', { height: height + 20 }); // Add padding
  }

  bindEvents() {
    // Rate tab switching
    document.querySelectorAll('.rate-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const tabName = e.target.dataset.tab;
        this.switchTab(tabName);
      });
    });

    // Vehicle matrix toggle
    // Rate input changes
    document.querySelectorAll('.rate-input').forEach(input => {
      if (!input.readOnly) {
        input.addEventListener('input', () => this.onInputChange(input));
        input.addEventListener('change', () => this.onInputChange(input));
      }
    });

    // Gratuity percentage input
    const gratuityInput = document.getElementById('gratuityPercent');
    if (gratuityInput) {
      gratuityInput.addEventListener('input', () => {
        this.gratuityPercent = parseFloat(gratuityInput.value) || 0;
        this.calculateAll();
      });
      gratuityInput.addEventListener('change', () => {
        this.gratuityPercent = parseFloat(gratuityInput.value) || 0;
        this.calculateAll();
      });
    }
  }

  setupParentCommunication() {
    // Listen for messages from parent window
    window.addEventListener('message', (event) => {
      if (event.data && event.data.type) {
        this.handleParentMessage(event.data);
      }
    });

    // Notify parent that rate section is ready
    this.notifyParent('ready', {});
  }

  handleParentMessage(message) {
    switch (message.type) {
      case 'requestReady':
        this.notifyParent('ready', {});
        break;
      case 'setVehicleRates':
        this.setVehicleRates(message.data);
        break;
      case 'setRates':
        // Update allowed pricing types if provided
        if (message.allowedPricingTypes) {
          this.allowedPricingTypes = message.allowedPricingTypes;
          this.updateVisibleRateRows();
        }
        this.setRates(message.data);
        break;
      case 'setRouteData':
        this.setRouteData(message.data);
        break;
      case 'setAirportFee':
        // Set airport fee for airport trips (MAC/Baggage handling)
        if (message.data) {
          const qty = message.data.qty !== undefined ? message.data.qty : (message.data.isAirportTrip ? 1 : 0);
          const rate = message.data.rate !== undefined ? message.data.rate : 15;
          this.setInputValue('airportQty', qty);
          this.setInputValue('airportRate', rate);
          this.calculateAll();
        }
        break;
      case 'setTieredDistanceTotal':
        // Tiered distance formula total goes directly into flat rate
        if (message.data && message.data.total !== undefined) {
          this.setInputValue('flatQty', 1);
          this.setInputValue('flatRate', message.data.total);
          this.calculateAll();
        }
        break;
      case 'setGratuity':
        if (message.data && message.data.percent !== undefined) {
          this.setGratuityPercent(message.data.percent);
          this.calculateAll();
        }
        break;
      case 'getRates':
        this.notifyParent('ratesData', this.getRatesData());
        break;
      case 'setPayments':
        this.payments = message.data.amount || 0;
        this.updatePaymentsDisplay();
        break;
      case 'setAdditionalRates':
        this.setAdditionalRates(message.data);
        break;
      case 'setPricingBasis':
        this.setPricingBasis(message.data);
        break;
      case 'clear':
        this.clearAll();
        break;
    }
  }

  notifyParent(type, data) {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ source: 'rateSection', type, data }, '*');
    }
  }

  switchTab(tabName) {
    document.querySelectorAll('.rate-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabName);
    });
    document.querySelectorAll('.rate-tab-content').forEach(content => {
      content.classList.toggle('active', content.id === `${tabName}Tab`);
    });
  }

  setVehicleRates(vehicleData) {
    this.vehicleRates = vehicleData;
    // Always apply vehicle rates - toggle controls whether user can override
    this.applyVehicleRates();
  }

  applyVehicleRates() {
    if (!this.vehicleRates || !this.vehicleRates.rates) return;

    const rates = this.vehicleRates.rates;

    // Apply hourly rate
    if (rates.perHour) {
      const hourRateInput = document.getElementById('hourRate');
      if (hourRateInput) {
        hourRateInput.value = rates.perHour.ratePerHour || 0;
      }
      // Apply gratuity from hourly rates if defined
      if (rates.perHour.gratuity !== undefined) {
        this.setGratuityPercent(rates.perHour.gratuity);
      }
    }

    // Apply per passenger rate
    if (rates.perPassenger) {
      const passRateInput = document.getElementById('passRate');
      if (passRateInput) {
        passRateInput.value = rates.perPassenger.ratePerPassenger || 0;
      }
      // Apply gratuity from passenger rates if defined
      if (rates.perPassenger.gratuity !== undefined) {
        this.setGratuityPercent(rates.perPassenger.gratuity);
      }
    }

    // Apply distance rate
    if (rates.distance) {
      const mileRateInput = document.getElementById('mileRate');
      if (mileRateInput) {
        mileRateInput.value = rates.distance.ratePerMile || 0;
      }
      // Also set flat rate from base fare if available
      if (rates.distance.baseFare || rates.distance.minimumFare) {
        const flatRateInput = document.getElementById('flatRate');
        if (flatRateInput) {
          flatRateInput.value = rates.distance.baseFare || rates.distance.minimumFare || 0;
        }
      }
      // Apply gratuity from distance rates if defined
      if (rates.distance.gratuity !== undefined) {
        this.setGratuityPercent(rates.distance.gratuity);
      }
    }

    this.calculateAll();
  }

  /**
   * Set gratuity percentage and update UI
   */
  setGratuityPercent(percent) {
    this.gratuityPercent = parseFloat(percent) || 0;
    const gratuityInput = document.getElementById('gratuityPercent');
    if (gratuityInput) {
      gratuityInput.value = this.gratuityPercent;
    }
  }

  /**
   * Set the pricing basis based on service type
   */
  setPricingBasis(data) {
    const basis = (data.basis || 'flat').toLowerCase();
    const allowedTypes = data.allowedTypes || [];
    
    // Map service type pricing to rate section row
    // Handle both short form (distance) and display form (flat rate, per passenger)
    const basisMap = {
      'distance': 'mile',
      'hours': 'hour',
      'hourly': 'hour',
      'passenger': 'pass',
      'per passenger': 'pass',
      'fixed': 'flat',
      'flat': 'flat',
      'flat rate': 'flat',
      'hybrid': 'flat'
    };
    this.pricingBasis = basisMap[basis] || 'flat';
    this.allowedPricingTypes = allowedTypes;
    
    // Show/hide rate rows based on allowed pricing types
    this.updateVisibleRateRows();
    
    // Highlight the active pricing row
    this.highlightActivePricingRow();
  }

  /**
   * Show/hide rate rows based on allowed pricing types from service type
   */
  updateVisibleRateRows() {
    const allowedTypes = (this.allowedPricingTypes || []).map(t => t.toUpperCase());
    
    // If no allowed types specified, show all rows
    if (allowedTypes.length === 0) {
      document.querySelectorAll('.rate-row').forEach(row => {
        row.style.display = '';
      });
      return;
    }
    
    // Map row IDs to pricing types
    // Flat rate is ALWAYS shown - it's a universal baseline option
    const rowTypeMap = {
      'flatQty': null, // null = always show
      'hourQty': ['HOURS', 'HOURLY', 'PER_HOUR'],
      'hourTripQty': ['HOURS', 'HOURLY', 'PER_HOUR'], // Same as hourQty
      'passQty': ['PASSENGER', 'PER_PASSENGER'],
      'mileQty': ['DISTANCE', 'PER_MILE']
    };
    
    // Check if any of the row's types are in the allowed list
    const isRowAllowed = (rowTypes) => {
      if (rowTypes === null) return true; // Always show
      return rowTypes.some(t => allowedTypes.includes(t));
    };
    
    // Show/hide each rate row
    Object.entries(rowTypeMap).forEach(([inputId, rowTypes]) => {
      const input = document.getElementById(inputId);
      if (input) {
        const row = input.closest('.rate-row');
        if (row) {
          const allowed = isRowAllowed(rowTypes);
          row.style.display = allowed ? '' : 'none';
          
          // Clear values for hidden rows so they don't affect totals
          if (!allowed) {
            const qtyInput = row.querySelector('input[id$="Qty"]');
            const rateInput = row.querySelector('input[id$="Rate"]');
            if (qtyInput) qtyInput.value = '';
            if (rateInput) rateInput.value = '';
          }
        }
      }
    });
  }

  /**
   * Highlight the row corresponding to the pricing basis
   */
  highlightActivePricingRow() {
    // Remove any existing highlights
    document.querySelectorAll('.rate-row').forEach(row => {
      row.classList.remove('active-pricing');
    });

    // Add highlight to active row
    const rowIds = { flat: 'flatQty', hour: 'hourQty', pass: 'passQty', mile: 'mileQty' };
    const inputId = rowIds[this.pricingBasis];
    if (inputId) {
      const input = document.getElementById(inputId);
      if (input) {
        const row = input.closest('.rate-row');
        if (row) {
          row.classList.add('active-pricing');
        }
      }
    }
  }

  /**
   * Set additional rates from Rate Management
   */
  setAdditionalRates(rates) {
    // Filter only active rates
    this.additionalRates = (rates || []).filter(r => r.status === 'active');
    this.renderAdditionalRates();
    this.calculateAll();
  }

  /**
   * Render additional rates in the UI
   */
  renderAdditionalRates() {
    const section = document.getElementById('additionalRatesSection');
    const table = document.getElementById('additionalRatesTable');
    
    if (!section || !table) {
      return;
    }

    if (this.additionalRates.length === 0) {
      section.style.display = 'none';
      return;
    }

    section.style.display = 'block';
    
    table.innerHTML = this.additionalRates.map((rate, index) => {
      const typeBadge = `<span class="rate-type-badge ${rate.type}">${rate.type}</span>`;
      
      if (rate.type === 'fixed') {
        return `
          <div class="rate-row additional-rate" data-rate-index="${index}">
            <div class="rate-cell">${rate.name}${typeBadge}</div>
            <div class="rate-cell">
              <input type="number" class="rate-input additional-qty" data-index="${index}" value="1" min="0" step="1">
            </div>
            <div class="rate-cell">
              <input type="number" class="rate-input" value="${rate.amount || 0}" readonly style="background: #f5f5f5;">
            </div>
            <div class="rate-cell">
              <span class="additional-total" data-index="${index}">${(rate.amount || 0).toFixed(2)}</span>
            </div>
          </div>
        `;
      } else if (rate.type === 'percentage') {
        return `
          <div class="rate-row additional-rate" data-rate-index="${index}">
            <div class="rate-cell">${rate.name}${typeBadge}</div>
            <div class="rate-cell">-</div>
            <div class="rate-cell">${rate.value || 0}%</div>
            <div class="rate-cell">
              <span class="additional-total percentage" data-index="${index}" data-percent="${rate.value || 0}">0.00</span>
            </div>
          </div>
        `;
      } else if (rate.type === 'multiplier') {
        return `
          <div class="rate-row additional-rate" data-rate-index="${index}">
            <div class="rate-cell">${rate.name}${typeBadge}</div>
            <div class="rate-cell">-</div>
            <div class="rate-cell">×${rate.value || 1}</div>
            <div class="rate-cell">
              <span class="additional-total multiplier" data-index="${index}" data-multiplier="${rate.value || 1}">0.00</span>
            </div>
          </div>
        `;
      }
      return '';
    }).join('');

    // Bind events for additional rate qty inputs
    table.querySelectorAll('.additional-qty').forEach(input => {
      input.addEventListener('input', () => this.calculateAll());
      input.addEventListener('change', () => this.calculateAll());
    });

    // Notify parent to resize iframe after rendering additional rates
    setTimeout(() => this.notifyHeight(), 50);
  }

  setRates(data) {
    // Vehicle type rates should ONLY set RATE fields, NOT qty fields
    // Qty fields come from route data (distance, duration) and passenger count
    
    if (data.flat) {
      // Flat qty is always 1 for flat rate
      if (data.flat.qty !== undefined && data.flat.qty > 0) {
        this.setInputValue('flatQty', data.flat.qty);
      }
      if (data.flat.rate !== undefined && data.flat.rate > 0) {
        this.setInputValue('flatRate', data.flat.rate);
      }
    }
    if (data.hour) {
      // Only set hour rate - qty comes from route duration
      if (data.hour.rate !== undefined && data.hour.rate > 0) {
        this.setInputValue('hourRate', data.hour.rate);
      }
    }
    if (data.hourTrip) {
      // Only set hourTrip rate - qty comes from PU to DO time duration
      if (data.hourTrip.rate !== undefined && data.hourTrip.rate > 0) {
        this.setInputValue('hourTripRate', data.hourTrip.rate);
      }
    }
    if (data.pass) {
      // Only set passenger rate - qty comes from passenger count
      if (data.pass.rate !== undefined && data.pass.rate > 0) {
        this.setInputValue('passRate', data.pass.rate);
      }
    }
    if (data.mile) {
      // Only set mile rate - qty comes from route distance
      if (data.mile.rate !== undefined && data.mile.rate > 0) {
        this.setInputValue('mileRate', data.mile.rate);
      }
    }
    if (data.payments !== undefined) {
      this.payments = data.payments;
    }
    this.calculateAll();
  }

  setRouteData(data) {
    // Route data from Google Maps should ALWAYS populate qty fields
    // This is not rate data - it's actual trip measurements
    
    // Update mile qty with distance
    if (data.miles !== undefined) {
      this.setInputValue('mileQty', data.miles.toFixed(1));
    }
    // Update hour qty with route duration (from Google Maps)
    if (data.hours !== undefined) {
      this.setInputValue('hourQty', data.hours.toFixed(2));
    }
    // Update hourTrip qty with trip duration (from PU time to DO time)
    if (data.tripHours !== undefined) {
      this.setInputValue('hourTripQty', data.tripHours.toFixed(2));
    }
    // Update passenger qty if provided
    if (data.passengers !== undefined) {
      this.setInputValue('passQty', data.passengers);
    }
    this.calculateAll();
  }

  setInputValue(id, value) {
    const input = document.getElementById(id);
    if (input) {
      input.value = value ?? 0;
    }
  }

  getInputValue(id) {
    const input = document.getElementById(id);
    return input ? (parseFloat(input.value) || 0) : 0;
  }

  onInputChange(input) {
    this.calculateAll();
  }

  calculateAll() {
    // Calculate each row: qty × rate = total
    const rows = ['flat', 'hour', 'hourTrip', 'pass', 'mile', 'airport'];

    rows.forEach(row => {
      const qty = this.getInputValue(`${row}Qty`);
      const rate = this.getInputValue(`${row}Rate`);
      const total = qty * rate;

      this.rates[row] = { qty, rate, total };

      const totalInput = document.getElementById(`${row}Total`);
      if (totalInput) {
        totalInput.value = total.toFixed(2);
      }
    });
    
    // Show/hide airport fee row based on qty
    const airportRow = document.getElementById('airportFeeRow');
    if (airportRow) {
      airportRow.style.display = this.rates.airport?.qty > 0 ? '' : 'none';
    }

    // Calculate subtotal from base rates
    this.subtotal = rows.reduce((sum, row) => sum + (this.rates[row]?.total || 0), 0);
    
    // Update subtotal display
    const subtotalEl = document.getElementById('subtotal');
    if (subtotalEl) {
      subtotalEl.textContent = this.formatCurrency(this.subtotal);
    }

    // Calculate gratuity based on subtotal
    this.gratuityTotal = this.subtotal * (this.gratuityPercent / 100);
    const gratuityTotalEl = document.getElementById('gratuityTotal');
    if (gratuityTotalEl) {
      gratuityTotalEl.textContent = this.formatCurrency(this.gratuityTotal);
    }

    // Calculate additional rates
    let additionalTotal = 0;
    
    this.additionalRates.forEach((rate, index) => {
      let rateTotal = 0;
      const totalEl = document.querySelector(`.additional-total[data-index="${index}"]`);
      
      if (rate.type === 'fixed') {
        const qtyInput = document.querySelector(`.additional-qty[data-index="${index}"]`);
        const qty = qtyInput ? (parseFloat(qtyInput.value) || 0) : 1;
        rateTotal = qty * (rate.amount || 0);
      } else if (rate.type === 'percentage') {
        rateTotal = this.subtotal * ((rate.value || 0) / 100);
      } else if (rate.type === 'multiplier') {
        // Multiplier adjusts the subtotal
        const multiplierAdjustment = this.subtotal * ((rate.value || 1) - 1);
        rateTotal = multiplierAdjustment;
      }
      
      if (totalEl) {
        totalEl.textContent = rateTotal.toFixed(2);
      }
      
      additionalTotal += rateTotal;
    });

    // Calculate grand total (subtotal + gratuity + additional rates)
    this.grandTotal = this.subtotal + this.gratuityTotal + additionalTotal;

    // Update display
    this.updateGrandTotalDisplay();
    this.updatePaymentsDisplay();

    // Notify parent of changes
    this.notifyParent('ratesChanged', this.getRatesData());
  }

  updateGrandTotalDisplay() {
    const grandTotalEl = document.getElementById('grandTotal');
    if (grandTotalEl) {
      grandTotalEl.textContent = this.formatCurrency(this.grandTotal);
    }
  }

  updatePaymentsDisplay() {
    const paymentsEl = document.getElementById('paymentsAmount');
    if (paymentsEl) {
      paymentsEl.textContent = this.formatCurrency(this.payments);
    }

    const balanceEl = document.getElementById('balanceDue');
    if (balanceEl) {
      const balance = this.grandTotal - this.payments;
      balanceEl.textContent = this.formatCurrency(balance);
    }
  }

  getRatesData() {
    return {
      rates: { ...this.rates },
      additionalRates: this.additionalRates,
      subtotal: this.subtotal,
      gratuityPercent: this.gratuityPercent,
      gratuityTotal: this.gratuityTotal,
      grandTotal: this.grandTotal,
      payments: this.payments,
      balanceDue: this.grandTotal - this.payments,
      pricingBasis: this.pricingBasis
    };
  }

  clearAll() {
    ['flat', 'hour', 'pass', 'mile'].forEach(row => {
      this.setInputValue(`${row}Qty`, row === 'flat' ? 1 : 0);
      this.setInputValue(`${row}Rate`, 0);
    });
    this.payments = 0;
    this.gratuityPercent = 20;
    this.setGratuityPercent(20);
    // Reset additional rate quantities
    document.querySelectorAll('.additional-qty').forEach(input => {
      input.value = 1;
    });
    this.calculateAll();
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.rateSection = new RateSection();
});
