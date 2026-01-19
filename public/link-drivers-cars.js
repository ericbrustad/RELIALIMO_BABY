// If Supabase is configured and user is logged in, we'll load drivers
// dynamically to ensure this list matches Company Resources.

async function loadDriversFromSupabase() {
  try {
    const supabaseUrl = window.ENV && window.ENV.SUPABASE_URL;
    const supabaseKey = window.ENV && window.ENV.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) return { success: false };
    const storedSession = localStorage.getItem('supabase_session');
    let authToken = supabaseKey;
    if (storedSession) {
      try { const s = JSON.parse(storedSession); if (s.access_token) authToken = s.access_token; } catch {}
    }
    const forcedOrg = window.VEHICLE_FORCE_ORG_ID || window.FORCED_ORG_ID || null;
    let orgId = forcedOrg;
    // Discover current org
    if (!orgId) {
      const orgRes = await fetch(`${supabaseUrl}/rest/v1/organization_members?select=organization_id&order=created_at.asc&limit=1`, {
        headers: { apikey: supabaseKey, Authorization: `Bearer ${authToken}` }
      });
      if (!orgRes.ok) return { success: false };
      const orgRows = await orgRes.json();
      orgId = orgRows && orgRows[0] && orgRows[0].organization_id;
      if (!orgId) return { success: false };
    }

    // Fetch drivers for this org
    const res = await fetch(`${supabaseUrl}/rest/v1/drivers?select=id,first_name,last_name,status&organization_id=eq.${encodeURIComponent(orgId)}&order=last_name`, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${authToken}` }
    });
    if (!res.ok) return { success: false };
    const drivers = await res.json();
    const sel = document.getElementById('driverSelect');
    if (!sel) return { success: false };
    // Clear existing options and populate
    sel.innerHTML = '<option value="">Select Driver</option>';
    drivers.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.id;
      opt.textContent = `${(d.last_name||'').trim()}, ${(d.first_name||'').trim()}`;
      sel.appendChild(opt);
    });
    return { success: drivers.length > 0, orgId, authToken };
  } catch (e) {
    // Silent fallback to sample data
    return { success: false };
  }
}

async function loadVehicleTypesFromSupabase(orgId, authToken) {
  try {
    const supabaseUrl = window.ENV && window.ENV.SUPABASE_URL;
    const supabaseKey = window.ENV && window.ENV.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) return false;

    const token = authToken || supabaseKey;
    const effectiveOrg = orgId || window.VEHICLE_FORCE_ORG_ID || window.FORCED_ORG_ID || '';
    const orgFilter = effectiveOrg ? `&organization_id=eq.${encodeURIComponent(effectiveOrg)}` : '';
    const res = await fetch(`${supabaseUrl}/rest/v1/vehicle_types?select=id,name,code,status&status=eq.ACTIVE${orgFilter}&order=sort_order.asc,name.asc`, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return false;
    const vehicleTypes = await res.json();
    const sel = document.getElementById('carSelect');
    if (!sel) return false;
    sel.innerHTML = '<option value="">Select Vehicle Type</option>';
    (vehicleTypes || []).forEach((vt) => {
      const opt = document.createElement('option');
      opt.value = vt.id || vt.code || vt.name;
      opt.textContent = vt.name || vt.code || 'Vehicle Type';
      sel.appendChild(opt);
    });
    return vehicleTypes.length > 0;
  } catch (e) {
    return false;
  }
}

// Sample data (fallback)
let linkedCars = [
  {
    id: 1,
    driver: 'Brostski, Eric',
    car: 'SUV VIP_ONE (SUBURBAN)',
    date: '08/28/2021'
  }
];

let selectedCars = [
  {
    id: 1,
    driver: 'Brostski, Eric',
    car: '_Cad_Suv (Cadilac Escalade)',
    selected: false
  }
];

// Close modal
function closeModal() {
  if (window.opener) {
    window.close();
  } else if (window.self !== window.top) {
    // If in iframe, send message to parent
    window.parent.postMessage({ action: 'closeModal' }, '*');
  } else {
    window.history.back();
  }
}

// Add new link
function addLink() {
  const driverSelect = document.getElementById('driverSelect');
  const carSelect = document.getElementById('carSelect');
  const dateInput = document.getElementById('linkDate');

  if (!driverSelect.value || !carSelect.value || !dateInput.value) {
    alert('Please select a driver, car, and date.');
    return;
  }

  const newLink = {
    id: linkedCars.length + 1,
    driver: driverSelect.options[driverSelect.selectedIndex].text,
    car: carSelect.options[carSelect.selectedIndex].text,
    date: formatDate(dateInput.value)
  };

  linkedCars.push(newLink);
  renderLinkedCars();
  
  // Reset form
  carSelect.value = '';
  alert('Driver-Car link added successfully!');
}

// Cancel add
function cancelAdd() {
  document.getElementById('carSelect').value = '';
  document.getElementById('linkDate').value = new Date().toISOString().split('T')[0];
}

// Edit link
function editLink(event, id) {
  event.preventDefault();
  const link = linkedCars.find(l => l.id === id);
  if (link) {
    alert(`Edit Link\n\nDriver: ${link.driver}\nCar: ${link.car}\nDate: ${link.date}\n\nIn a full implementation, this would open an edit form.`);
  }
}

// Remove link
function removeLink(event, id) {
  event.preventDefault();
  if (confirm('Are you sure you want to remove this driver-car link?')) {
    linkedCars = linkedCars.filter(l => l.id !== id);
    renderLinkedCars();
  }
}

// Remove selected car
function removeSelected(event, id) {
  event.preventDefault();
  if (confirm('Are you sure you want to remove this car from the driver selection?')) {
    selectedCars = selectedCars.filter(c => c.id !== id);
    renderSelectedCars();
  }
}

// Remove selected cars (bulk)
function removeSelectedCars() {
  const selected = selectedCars.filter(c => c.selected);
  if (selected.length === 0) {
    alert('No cars selected. Please select cars to remove.');
    return;
  }
  
  if (confirm(`Are you sure you want to remove ${selected.length} selected car(s)?`)) {
    selectedCars = selectedCars.filter(c => !c.selected);
    renderSelectedCars();
  }
}

// Select all cars
function selectAllCars() {
  const allSelected = selectedCars.every(c => c.selected);
  selectedCars.forEach(c => c.selected = !allSelected);
  renderSelectedCars();
}

// Format date from YYYY-MM-DD to MM/DD/YYYY
function formatDate(dateString) {
  const date = new Date(dateString);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

// Render linked cars table
function renderLinkedCars() {
  const tbody = document.getElementById('linkedCarsBody');
  tbody.innerHTML = '';

  if (linkedCars.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #999; padding: 20px;">No driver-car links found</td></tr>';
    return;
  }

  linkedCars.forEach(link => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td class="driver-cell">${link.driver}</td>
      <td class="car-cell">${link.car}</td>
      <td class="date-cell">${link.date}</td>
      <td class="actions-cell">
        <a href="#" class="action-link edit-link" onclick="editLink(event, ${link.id})">Edit</a>
        <a href="#" class="action-link remove-link" onclick="removeLink(event, ${link.id})">Remove</a>
      </td>
    `;
    tbody.appendChild(row);
  });
}

// Render selected cars table
function renderSelectedCars() {
  const tbody = document.getElementById('selectedCarsBody');
  tbody.innerHTML = '';

  if (selectedCars.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: #999; padding: 20px;">No cars selected by driver</td></tr>';
    return;
  }

  selectedCars.forEach(car => {
    const row = document.createElement('tr');
    row.style.background = car.selected ? '#e6f2ff' : '';
    row.innerHTML = `
      <td class="driver-cell">
        <label style="display: flex; align-items: center; cursor: pointer;">
          <input type="checkbox" ${car.selected ? 'checked' : ''} 
                 onchange="toggleCarSelection(${car.id})" 
                 style="margin-right: 8px;">
          ${car.driver}
        </label>
      </td>
      <td class="car-cell">${car.car}</td>
      <td class="actions-cell">
        <a href="#" class="action-link remove-link" onclick="removeSelected(event, ${car.id})">Remove</a>
      </td>
    `;
    tbody.appendChild(row);
  });
}

// Toggle car selection
function toggleCarSelection(id) {
  const car = selectedCars.find(c => c.id === id);
  if (car) {
    car.selected = !car.selected;
    renderSelectedCars();
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  renderLinkedCars();
  renderSelectedCars();
  // Try to load drivers and active vehicle types from Supabase; fallback to static options if unavailable
  loadDriversFromSupabase().then(({ success, orgId, authToken }) => {
    if (success) {
      loadVehicleTypesFromSupabase(orgId, authToken);
    }
  });
  
  // Set today's date as default
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('linkDate').value = today;
});
