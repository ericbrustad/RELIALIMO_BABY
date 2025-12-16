class ReservationsList {
  constructor() {
    this.init();
  }

  async init() {
    this.loadDbModule();
    this.setupEventListeners();
    this.setupTabSwitching();
    await this.loadReservations();
  }
  
  async loadDbModule() {
    try {
      const module = await import('./assets/db.js');
      this.db = module.db;
      console.log('✅ Database module loaded');
    } catch (error) {
      console.error('❌ Failed to load database module:', error);
    }
  }
  
  async loadReservations() {
    if (!this.db) {
      console.warn('⚠️ Database module not loaded yet');
      return;
    }
    
    try {
      const reservations = this.db.getAllReservations();
      console.log('📋 Loaded reservations:', reservations);
      
      if (reservations && reservations.length > 0) {
        this.displayReservations(reservations);
      } else {
        console.log('📭 No reservations found');
      }
    } catch (error) {
      console.error('❌ Error loading reservations:', error);
    }
  }
  
  displayReservations(reservations) {
    // Find the table body in the new reservations tab
    const tableBody = document.querySelector('#newReservationsTab tbody');
    if (!tableBody) {
      console.warn('⚠️ Could not find table body');
      return;
    }
    
    // Clear existing rows (except header)
    const existingRows = tableBody.querySelectorAll('tr');
    existingRows.forEach(row => {
      // Only remove data rows, not template rows
      if (!row.classList.contains('template')) {
        row.remove();
      }
    });
    
    // Add new rows for each reservation
    reservations.forEach(res => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td><input type="checkbox" class="row-checkbox" /></td>
        <td><a href="#" class="conf-link" data-conf="${res.confirmation_number || ''}">${res.confirmation_number || 'N/A'}</a></td>
        <td>${this.formatDate(res.pickup_at)}</td>
        <td>${this.formatTime(res.pickup_at)}</td>
        <td>${res.passenger_name || ''}</td>
        <td>${res.company_name || ''}</td>
        <td>${res.service_type || ''}</td>
        <td>${res.vehicle_type || ''}</td>
        <td>${res.status || 'confirmed'}</td>
        <td>$${(res.grand_total || 0).toFixed(2)}</td>
        <td><a href="#" class="select-link">Select</a></td>
      `;
      tableBody.appendChild(row);
    });
    
    // Re-attach event listeners to new elements
    this.attachRowListeners();
  }
  
  attachRowListeners() {
    // Conf # links
    document.querySelectorAll('.conf-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const confNumber = e.target.dataset.conf;
        window.location.href = `reservation-form.html?conf=${confNumber}`;
      });
    });

    // Select links
    document.querySelectorAll('.select-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const row = e.target.closest('tr');
        const confNumber = row.querySelector('.conf-link').dataset.conf;
        this.selectReservation(confNumber);
      });
    });
  }
  
  formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  }
  
  formatTime(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }

  setupTabSwitching() {
    // Handle tab switching
    document.querySelectorAll('.window-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const tabName = e.target.dataset.tab;
        
        // Update active state
        document.querySelectorAll('.window-tab').forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');
        
        // Hide all tab content
        document.getElementById('newReservationsTab').style.display = 'none';
        document.getElementById('onlineEfarmInTab').style.display = 'none';
        document.getElementById('unfinalizedTab').style.display = 'none';
        document.getElementById('deletedTab').style.display = 'none';
        document.getElementById('importTab').style.display = 'none';
        
        // Show selected tab
        switch(tabName) {
          case 'new-reservations':
            document.getElementById('newReservationsTab').style.display = 'flex';
            break;
          case 'online-efarm-in':
            document.getElementById('onlineEfarmInTab').style.display = 'block';
            break;
          case 'unfinalized':
            document.getElementById('unfinalizedTab').style.display = 'block';
            break;
          case 'deleted':
            document.getElementById('deletedTab').style.display = 'block';
            break;
          case 'import':
            document.getElementById('importTab').style.display = 'block';
            break;
        }
      });
    });
  }

  setupEventListeners() {
    // Main navigation buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const button = e.target.closest('.nav-btn');
        const section = button.dataset.section;
        
        if (section === 'office') {
          window.location.href = 'my-office.html';
        } else if (section === 'reservations') {
          // Already on reservations page
        } else {
          alert(`${section} section coming soon!`);
        }
      });
    });

    // View buttons (window-actions)
    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = e.target.dataset.action;
        
        if (action === 'user-view') {
          window.location.href = 'index.html?view=user';
        } else if (action === 'driver-view') {
          window.location.href = 'index.html?view=driver';
        } else if (action === 'reservations') {
          // Already on reservations page
        } else if (action === 'farm-out') {
          window.location.href = 'index.html?view=reservations';
        } else if (action === 'new-reservation') {
          window.location.href = 'reservation-form.html';
        }
      });
    });

    // Search button
    const searchBtn = document.querySelector('.btn-search');
    if (searchBtn) {
      searchBtn.addEventListener('click', () => {
        this.performSearch();
      });
    }

    // Conf # links
    document.querySelectorAll('.conf-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        // Navigate to reservation form with this reservation ID
        const confNumber = e.target.textContent;
        window.location.href = `reservation-form.html?conf=${confNumber}`;
      });
    });

    // Select links
    document.querySelectorAll('.select-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const row = e.target.closest('tr');
        const confNumber = row.querySelector('.conf-link').textContent;
        this.selectReservation(confNumber);
      });
    });
  }

  performSearch() {
    // Get search values
    const searchFor = document.querySelector('.search-input').value;
    const searchIn = document.querySelector('.search-select').value;
    
    console.log('Searching for:', searchFor, 'in:', searchIn);
    
    // Implement search logic here
    // This would filter the table based on search criteria
    alert('Search functionality will filter reservations based on your criteria');
  }

  selectReservation(confNumber) {
    console.log('Selected reservation:', confNumber);
    // Navigate to the reservation details
    window.location.href = `reservation-form.html?conf=${confNumber}`;
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new ReservationsList();
});
