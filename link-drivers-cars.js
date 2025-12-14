// Sample data
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
  
  // Set today's date as default
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('linkDate').value = today;
});
