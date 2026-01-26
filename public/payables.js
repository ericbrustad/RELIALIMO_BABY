// ============================================
// Payables Module - Driver Payables Management
// ============================================

// Get Supabase config
function getSupabaseConfig() {
  return {
    url: window.ENV?.SUPABASE_URL || '',
    anonKey: window.ENV?.SUPABASE_ANON_KEY || ''
  };
}

// State
let driversPayables = [];
let currentFilter = 'all';

// ============================================
// Load Drivers with Payables from Database
// ============================================
async function loadDriverPayables() {
  const config = getSupabaseConfig();
  if (!config.url) {
    console.warn('[Payables] No Supabase config');
    return;
  }

  try {
    // Fetch driver payables with driver info
    const response = await fetch(
      `${config.url}/rest/v1/driver_payables?select=*,drivers(id,first_name,last_name,email,phone)&order=drivers(last_name).asc`,
      {
        headers: {
          'apikey': config.anonKey,
          'Authorization': `Bearer ${config.anonKey}`
        }
      }
    );

    if (response.ok) {
      driversPayables = await response.json();
      console.log('[Payables] Loaded', driversPayables.length, 'driver payables');
      renderDriversTable();
    } else {
      console.error('[Payables] Failed to load:', response.statusText);
      // Fallback: try loading directly from drivers
      await loadDriversDirectly();
    }
  } catch (err) {
    console.error('[Payables] Error loading payables:', err);
    await loadDriversDirectly();
  }
}

// Fallback: Load drivers directly and count their completed trips
async function loadDriversDirectly() {
  const config = getSupabaseConfig();
  
  try {
    // Get all drivers
    const driversRes = await fetch(
      `${config.url}/rest/v1/drivers?select=id,first_name,last_name,email&order=last_name.asc`,
      {
        headers: {
          'apikey': config.anonKey,
          'Authorization': `Bearer ${config.anonKey}`
        }
      }
    );

    if (driversRes.ok) {
      const drivers = await driversRes.json();
      
      // Get trip counts for each driver
      const tripsRes = await fetch(
        `${config.url}/rest/v1/reservations?select=driver_id,driver_pay,base_price&status=eq.completed&driver_id=not.is.null`,
        {
          headers: {
            'apikey': config.anonKey,
            'Authorization': `Bearer ${config.anonKey}`
          }
        }
      );
      
      const trips = tripsRes.ok ? await tripsRes.json() : [];
      
      // Count trips per driver
      const tripCounts = {};
      const tripAmounts = {};
      trips.forEach(t => {
        tripCounts[t.driver_id] = (tripCounts[t.driver_id] || 0) + 1;
        const pay = t.driver_pay || (t.base_price * 0.70) || 0;
        tripAmounts[t.driver_id] = (tripAmounts[t.driver_id] || 0) + pay;
      });
      
      // Build payables data
      driversPayables = drivers.map(d => ({
        driver_id: d.id,
        total_trips: tripCounts[d.id] || 0,
        unpaid_amount: tripAmounts[d.id] || 0,
        paid_amount: 0,
        drivers: d
      }));
      
      renderDriversTable();
    }
  } catch (err) {
    console.error('[Payables] Error loading drivers directly:', err);
  }
}

// ============================================
// Render Drivers Table
// ============================================
function renderDriversTable() {
  const tbody = document.querySelector('#pay-drivers .drivers-table tbody');
  if (!tbody) return;

  // Filter based on current filter
  let filtered = driversPayables;
  if (currentFilter === 'paid') {
    filtered = driversPayables.filter(p => p.unpaid_amount <= 0);
  } else if (currentFilter === 'unpaid') {
    filtered = driversPayables.filter(p => p.unpaid_amount > 0);
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align: center; padding: 40px; color: #666;">
          No drivers found. Drivers will appear here when they complete trips.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(p => {
    const driver = p.drivers || {};
    const name = `${driver.last_name || ''} ${driver.first_name || ''}`.trim() || 'Unknown Driver';
    const tripCount = p.total_trips || 0;
    const unpaidAmount = p.unpaid_amount || 0;
    
    return `
      <tr class="driver-row" data-driver-id="${p.driver_id}">
        <td class="expand-cell"><span class="expand-icon">+</span></td>
        <td class="driver-name">${name}</td>
        <td class="trip-count">Trips: <strong>${tripCount}</strong></td>
        <td class="unpaid-amount">Unpaid: <strong>$${unpaidAmount.toFixed(2)}</strong></td>
        <td class="action-cell">
          <button class="pay-driver-btn" ${unpaidAmount <= 0 ? 'disabled' : ''}>
            ${unpaidAmount > 0 ? 'Pay Driver' : 'Paid'}
          </button>
        </td>
      </tr>
      <tr class="driver-details-row" style="display: none;">
        <td colspan="5">
          <div class="driver-details-content">
            <p>Loading trips...</p>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Re-attach event listeners
  attachDriverRowListeners();
}

// ============================================
// Attach Event Listeners to Driver Rows
// ============================================
function attachDriverRowListeners() {
  // Expand/Collapse
  document.querySelectorAll('#pay-drivers .expand-icon').forEach(icon => {
    icon.addEventListener('click', async function() {
      const row = this.closest('.driver-row');
      const detailsRow = row.nextElementSibling;
      const driverId = row.dataset.driverId;
      
      if (this.textContent === '+') {
        this.textContent = '-';
        detailsRow.style.display = 'table-row';
        await loadDriverTrips(driverId, detailsRow.querySelector('.driver-details-content'));
      } else {
        this.textContent = '+';
        detailsRow.style.display = 'none';
      }
    });
  });

  // Pay Driver buttons
  document.querySelectorAll('#pay-drivers .pay-driver-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      if (this.disabled) return;
      
      const row = this.closest('.driver-row');
      const driverId = row.dataset.driverId;
      const driverName = row.querySelector('.driver-name').textContent;
      const unpaidText = row.querySelector('.unpaid-amount strong').textContent;
      
      openPaymentModal(driverId, driverName, unpaidText);
    });
  });
}

// ============================================
// Load Driver's Unpaid Trips
// ============================================
async function loadDriverTrips(driverId, container) {
  const config = getSupabaseConfig();
  
  try {
    const response = await fetch(
      `${config.url}/rest/v1/reservations?select=id,confirmation_number,pickup_datetime,pickup_address,dropoff_address,driver_pay,base_price,status&driver_id=eq.${driverId}&status=eq.completed&order=pickup_datetime.desc&limit=20`,
      {
        headers: {
          'apikey': config.anonKey,
          'Authorization': `Bearer ${config.anonKey}`
        }
      }
    );

    if (response.ok) {
      const trips = await response.json();
      
      if (trips.length === 0) {
        container.innerHTML = '<p style="color: #666;">No completed trips found.</p>';
        return;
      }

      container.innerHTML = `
        <table class="trips-detail-table">
          <thead>
            <tr>
              <th><input type="checkbox" class="select-all-trips"></th>
              <th>Conf #</th>
              <th>Date</th>
              <th>Pickup</th>
              <th>Dropoff</th>
              <th>Pay</th>
            </tr>
          </thead>
          <tbody>
            ${trips.map(t => {
              const pay = t.driver_pay || (t.base_price * 0.70) || 0;
              const date = t.pickup_datetime ? new Date(t.pickup_datetime).toLocaleDateString() : '--';
              return `
                <tr data-trip-id="${t.id}">
                  <td><input type="checkbox" class="trip-checkbox" value="${t.id}"></td>
                  <td>${t.confirmation_number || t.id?.slice(0,8)}</td>
                  <td>${date}</td>
                  <td>${(t.pickup_address || '').substring(0, 30)}...</td>
                  <td>${(t.dropoff_address || '').substring(0, 30)}...</td>
                  <td>$${pay.toFixed(2)}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;

      // Select all checkbox
      container.querySelector('.select-all-trips')?.addEventListener('change', function() {
        container.querySelectorAll('.trip-checkbox').forEach(cb => cb.checked = this.checked);
      });
    }
  } catch (err) {
    console.error('[Payables] Error loading trips:', err);
    container.innerHTML = '<p style="color: red;">Error loading trips.</p>';
  }
}

// ============================================
// Payment Modal
// ============================================
function openPaymentModal(driverId, driverName, unpaidAmount) {
  // Create modal if not exists
  let modal = document.getElementById('paymentModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'paymentModal';
    modal.className = 'payment-modal';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="payment-modal-content">
      <div class="payment-modal-header">
        <h3>💳 Pay Driver</h3>
        <button class="close-modal">&times;</button>
      </div>
      <div class="payment-modal-body">
        <p><strong>Driver:</strong> ${driverName}</p>
        <p><strong>Amount Owed:</strong> ${unpaidAmount}</p>
        
        <div class="form-group">
          <label>Payment Amount:</label>
          <input type="number" id="paymentAmount" value="${unpaidAmount.replace('$', '')}" step="0.01" min="0">
        </div>
        
        <div class="form-group">
          <label>Payment Method:</label>
          <select id="paymentMethod">
            <option value="check">Check</option>
            <option value="direct_deposit">Direct Deposit</option>
            <option value="cash">Cash</option>
            <option value="venmo">Venmo</option>
            <option value="zelle">Zelle</option>
            <option value="other">Other</option>
          </select>
        </div>
        
        <div class="form-group">
          <label>Reference # (optional):</label>
          <input type="text" id="paymentReference" placeholder="Check number, transaction ID, etc.">
        </div>
        
        <div class="form-group">
          <label>Notes (optional):</label>
          <textarea id="paymentNotes" rows="2" placeholder="Payment notes..."></textarea>
        </div>
      </div>
      <div class="payment-modal-footer">
        <button class="btn-cancel" onclick="closePaymentModal()">Cancel</button>
        <button class="btn-pay" onclick="processPayment('${driverId}')">Process Payment</button>
      </div>
    </div>
  `;

  modal.style.display = 'flex';
  modal.querySelector('.close-modal').addEventListener('click', closePaymentModal);
}

function closePaymentModal() {
  const modal = document.getElementById('paymentModal');
  if (modal) modal.style.display = 'none';
}

async function processPayment(driverId) {
  const config = getSupabaseConfig();
  const amount = parseFloat(document.getElementById('paymentAmount').value);
  const method = document.getElementById('paymentMethod').value;
  const reference = document.getElementById('paymentReference').value;
  const notes = document.getElementById('paymentNotes').value;

  if (!amount || amount <= 0) {
    alert('Please enter a valid payment amount.');
    return;
  }

  try {
    // Call the record_driver_payment function
    const response = await fetch(`${config.url}/rest/v1/rpc/record_driver_payment`, {
      method: 'POST',
      headers: {
        'apikey': config.anonKey,
        'Authorization': `Bearer ${config.anonKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        p_driver_id: driverId,
        p_amount: amount,
        p_payment_method: method,
        p_payment_reference: reference || null,
        p_notes: notes || null,
        p_paid_by: 'admin'
      })
    });

    if (response.ok) {
      alert('Payment recorded successfully!');
      closePaymentModal();
      await loadDriverPayables(); // Refresh the list
    } else {
      const error = await response.text();
      console.error('[Payables] Payment error:', error);
      alert('Failed to record payment. Please try again.');
    }
  } catch (err) {
    console.error('[Payables] Payment error:', err);
    alert('Error processing payment.');
  }
}

// Make functions available globally
window.closePaymentModal = closePaymentModal;
window.processPayment = processPayment;

// ============================================
// Tab Switching
// ============================================
document.querySelectorAll('.payables-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.payables-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.payables-content').forEach(c => c.classList.remove('active'));
        
        tab.classList.add('active');
        const tabName = tab.getAttribute('data-tab');
        document.getElementById(tabName).classList.add('active');
    });
});

// Filter Buttons
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        this.parentElement.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        
        currentFilter = this.getAttribute('data-status');
        renderDriversTable();
    });
});

// Search Button
document.querySelectorAll('.search-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        const searchInput = document.getElementById('search-in-driver');
        const searchTerm = searchInput?.value?.toLowerCase() || '';
        
        if (searchTerm) {
          // Filter by name
          const filtered = driversPayables.filter(p => {
            const name = `${p.drivers?.first_name || ''} ${p.drivers?.last_name || ''}`.toLowerCase();
            return name.includes(searchTerm);
          });
          renderDriversTableFiltered(filtered);
        } else {
          renderDriversTable();
        }
    });
});

function renderDriversTableFiltered(filtered) {
  const tbody = document.querySelector('#pay-drivers .drivers-table tbody');
  if (!tbody) return;

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align: center; padding: 40px; color: #666;">
          No matching drivers found.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(p => {
    const driver = p.drivers || {};
    const name = `${driver.last_name || ''} ${driver.first_name || ''}`.trim() || 'Unknown Driver';
    const tripCount = p.total_trips || 0;
    const unpaidAmount = p.unpaid_amount || 0;
    
    return `
      <tr class="driver-row" data-driver-id="${p.driver_id}">
        <td class="expand-cell"><span class="expand-icon">+</span></td>
        <td class="driver-name">${name}</td>
        <td class="trip-count">Trips: <strong>${tripCount}</strong></td>
        <td class="unpaid-amount">Unpaid: <strong>$${unpaidAmount.toFixed(2)}</strong></td>
        <td class="action-cell">
          <button class="pay-driver-btn" ${unpaidAmount <= 0 ? 'disabled' : ''}>
            ${unpaidAmount > 0 ? 'Pay Driver' : 'Paid'}
          </button>
        </td>
      </tr>
    `;
  }).join('');

  attachDriverRowListeners();
}

// ============================================
// Initialize on page load
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  loadDriverPayables();
});

console.log('Payables module initialized with Supabase integration');
