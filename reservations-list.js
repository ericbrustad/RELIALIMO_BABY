import { wireMainNav } from './navigation.js';

class ReservationsList {
  constructor() {
    this.init();
  }

  async init() {
    await this.loadDbModule();
    this.setupEventListeners();
    this.setupTabSwitching();
    await this.loadReservations();
    this.handleOpenConfFromCalendar();
  }
  
  async loadDbModule() {
    try {
      const module = await import('./supabase-db.js');
      this.db = module.default;
      console.log('✅ Supabase database module loaded');
    } catch (error) {
      console.error('❌ Failed to load database module:', error);
      alert('⚠️ DATABASE CONNECTION FAILED\n\nPlease check your connection and reload.');
    }
  }
  
  async loadReservations() {
    if (!this.db) {
      console.warn('⚠️ Database module not loaded yet');
      return;
    }
    
    try {
      const reservations = await this.db.getAllReservations();
      console.log('📋 Loaded reservations:', reservations);
      
      if (reservations && reservations.length > 0) {
        this.displayReservations(reservations);
      } else {
        this.displayReservations([]);
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
      console.warn('⚠️ Could not find table body for reservations');
      return;
    }
    
    // Clear existing rows
    tableBody.innerHTML = '';
    
    if (reservations.length === 0) {
      // Show empty state message
      const emptyRow = document.createElement('tr');
      emptyRow.innerHTML = `
        <td colspan="11" style="text-align: center; padding: 40px; color: #666;">
          <div>
            <h3>📭 No Reservations Found</h3>
            <p>The reservations database is empty or no reservations match the current filter.</p>
            <p>Try creating a new reservation or check your database connection.</p>
          </div>
        </td>
      `;
      tableBody.appendChild(emptyRow);
      console.log('📭 Displayed empty state message');
      return;
    }
    
    // Add new rows for each reservation
    reservations.forEach(res => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td><a href="#" class="conf-link" data-conf="${res.confirmation_number || ''}">${res.confirmation_number || 'N/A'}</a></td>
        <td>${this.formatDate(res.pickup_at)}</td>
        <td>${this.formatTime(res.pickup_at)}</td>
        <td>${res.passenger_name || res.passenger_first_name + ' ' + res.passenger_last_name || ''}</td>
        <td>${res.company_name || ''}</td>
        <td>${res.vehicle_type || ''}</td>
        <td>$${(res.grand_total || 0).toFixed(2)}</td>
        <td>${res.payment_type || ''}</td>
        <td>${res.status || 'confirmed'}</td>
        <td>${res.group_name || ''}</td>
        <td><a href="#" class="select-link">Select >></a></td>
      `;
      tableBody.appendChild(row);
    });
    
    console.log(`✅ Displayed ${reservations.length} reservations`);
    
    // Re-attach event listeners to new elements
    this.attachRowListeners();
  }

  activateTab(tabName) {
    // Update active state
    document.querySelectorAll('.window-tab').forEach(t => t.classList.remove('active'));
    const tabBtn = document.querySelector(`.window-tab[data-tab="${tabName}"]`);
    if (tabBtn) tabBtn.classList.add('active');

    // Hide all tab content
    const ids = ['newReservationsTab', 'onlineEfarmInTab', 'unfinalizedTab', 'deletedTab', 'importTab'];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });

    // Show selected tab
    if (tabName === 'new-reservations') {
      const el = document.getElementById('newReservationsTab');
      if (el) el.style.display = 'flex';
    } else if (tabName === 'online-efarm-in') {
      const el = document.getElementById('onlineEfarmInTab');
      if (el) el.style.display = 'block';
    } else if (tabName === 'unfinalized') {
      const el = document.getElementById('unfinalizedTab');
      if (el) el.style.display = 'block';
    } else if (tabName === 'deleted') {
      const el = document.getElementById('deletedTab');
      if (el) el.style.display = 'block';
    } else if (tabName === 'import') {
      const el = document.getElementById('importTab');
      if (el) el.style.display = 'block';
    }
  }

  handleOpenConfFromCalendar() {
    try {
      const url = new URL(window.location.href);
      const openConf = url.searchParams.get('openConf');
      if (!openConf) return;

      // Always activate the normal list tab first (matches the user's workflow)
      this.activateTab('new-reservations');

      // Try to open via the same click path the table uses
      const link = document.querySelector(`#newReservationsTab .conf-link[data-conf="${CSS.escape(openConf)}"]`);
      if (link) {
        link.click();
        return;
      }

      // Fallback if the row isn't rendered
      window.location.href = `reservation-form.html?conf=${encodeURIComponent(openConf)}`;
    } catch (e) {
      console.warn('⚠️ Failed to open reservation from calendar:', e);
    }
  }
  
  attachRowListeners() {
    // Conf # links
    document.querySelectorAll('.conf-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const confNumber = e.target.dataset.conf;
        this.openReservationInParent(confNumber);
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

    // Make entire row clickable to open reservation
    document.querySelectorAll('#newReservationsTab tbody tr').forEach(row => {
      // Exclude header row
      if (row.querySelector('.conf-link')) {
        row.style.cursor = 'pointer';
        
        row.addEventListener('click', (e) => {
          // Don't trigger if clicking on a link
          if (e.target.tagName === 'A') return;
          
          const confLink = row.querySelector('.conf-link');
          if (confLink) {
            const confNumber = confLink.dataset.conf;
            this.openReservationInParent(confNumber);
          }
        });

        // Add hover effect
        row.addEventListener('mouseenter', () => {
          row.style.backgroundColor = 'rgba(102, 126, 234, 0.1)';
        });

        row.addEventListener('mouseleave', () => {
          row.style.backgroundColor = '';
        });
      }
    });
  }

  /**
   * Open reservation in parent frame (if running in iframe)
   * Falls back to direct navigation if not in iframe
   */
  openReservationInParent(confNumber) {
    try {
      // Check if we're in an iframe
      if (window.self !== window.top) {
        // Send message to parent to open reservation
        window.parent.postMessage({
          action: 'openReservation',
          conf: confNumber
        }, '*');
        console.log('📤 Sent openReservation message to parent for conf:', confNumber);
      } else {
        // Not in iframe, navigate directly
        window.location.href = `reservation-form.html?conf=${confNumber}`;
        console.log('🔗 Navigating directly to reservation-form for conf:', confNumber);
      }
    } catch (error) {
      console.error('❌ Error opening reservation:', error);
      // Fallback to direct navigation
      window.location.href = `reservation-form.html?conf=${confNumber}`;
    }
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
    wireMainNav();

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
        const confNumber = row.querySelector('.conf-link')?.dataset?.conf;
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
    if (!confNumber) {
      console.warn('⚠️ No confirmation number provided to selectReservation');
      return;
    }
    console.log('Selected reservation:', confNumber);
    this.openReservationInParent(confNumber);
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new ReservationsList();
});
