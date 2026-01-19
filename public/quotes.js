import { wireMainNav } from './navigation.js';

class Quotes {
  constructor() {
    this.currentTab = 'manage-quotes';
    this.quotes = [];
    this.filters = {
      searchFor: '',
      searchIn: '',
      dateFrom: '',
      dateTo: '',
      sortBy: 'when-requested',
      orderBy: 'desc',
      pageSize: 25
    };
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.loadQuotes();
  }

  setupEventListeners() {
    // Main navigation buttons
    wireMainNav();

    // Window tabs (Manage Quotes, Response Templates, Initial Response)
    document.querySelectorAll('.window-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const tabName = e.target.dataset.tab;
        this.switchTab(tabName);
      });
    });

    // Response Template items
    document.querySelectorAll('.response-template-item').forEach(item => {
      item.addEventListener('click', (e) => {
        // Update active state
        document.querySelectorAll('.response-template-item').forEach(i => {
          i.classList.remove('active');
        });
        e.currentTarget.classList.add('active');
        
        // Load template data
        const templateName = e.currentTarget.textContent.trim();
        this.loadResponseTemplate(templateName);
      });
    });

    // Response Templates - Trip Tags Button
    const responseTemplateInsertTripTagsBtn = document.getElementById('responseTemplateInsertTripTagsBtn');
    if (responseTemplateInsertTripTagsBtn) {
      responseTemplateInsertTripTagsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const editor = document.getElementById('responseTemplateEditor');
        window.openTripTagSelector(editor);
      });
    }

    // Response Templates - Rate Tags Button
    const responseTemplateInsertRateTagsBtn = document.getElementById('responseTemplateInsertRateTagsBtn');
    if (responseTemplateInsertRateTagsBtn) {
      responseTemplateInsertRateTagsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const editor = document.getElementById('responseTemplateEditor');
        window.openRateTagSelector(editor);
      });
    }

    // Initial Response - Trip Tags Button
    const initialResponseInsertTripTagsBtn = document.getElementById('initialResponseInsertTripTagsBtn');
    if (initialResponseInsertTripTagsBtn) {
      initialResponseInsertTripTagsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const editor = document.getElementById('initialResponseEditor');
        window.openTripTagSelector(editor);
      });
    }

    // Initial Response - Rate Tags Button
    const initialResponseInsertRateTagsBtn = document.getElementById('initialResponseInsertRateTagsBtn');
    if (initialResponseInsertRateTagsBtn) {
      initialResponseInsertRateTagsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const editor = document.getElementById('initialResponseEditor');
        window.openRateTagSelector(editor);
      });
    }

    // Initial Response items
    document.querySelectorAll('.initial-response-item').forEach(item => {
      item.addEventListener('click', (e) => {
        // Update active state
        document.querySelectorAll('.initial-response-item').forEach(i => {
          i.classList.remove('active');
        });
        e.currentTarget.classList.add('active');
        
        // Load recipient data
        const recipientType = e.currentTarget.dataset.recipient;
        this.loadInitialResponse(recipientType);
      });
    });



    // Search button
    const searchBtn = document.getElementById('searchQuotes');
    if (searchBtn) {
      searchBtn.addEventListener('click', () => {
        this.performSearch();
      });
    }

    // Enter key on search inputs
    const searchInputs = document.querySelectorAll('.search-input, .search-select');
    searchInputs.forEach(input => {
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.performSearch();
        }
      });
    });

    // Filter changes
    const searchFor = document.getElementById('searchFor');
    const searchIn = document.getElementById('searchIn');
    const dateFrom = document.getElementById('dateFrom');
    const dateTo = document.getElementById('dateTo');
    const sortBy = document.getElementById('sortBy');
    const orderBy = document.getElementById('orderBy');
    const pageSize = document.getElementById('pageSize');

    if (searchFor) {
      searchFor.addEventListener('change', (e) => {
        this.filters.searchFor = e.target.value;
      });
    }

    if (searchIn) {
      searchIn.addEventListener('change', (e) => {
        this.filters.searchIn = e.target.value;
      });
    }

    if (dateFrom) {
      dateFrom.addEventListener('change', (e) => {
        this.filters.dateFrom = e.target.value;
      });
    }

    if (dateTo) {
      dateTo.addEventListener('change', (e) => {
        this.filters.dateTo = e.target.value;
      });
    }

    if (sortBy) {
      sortBy.addEventListener('change', (e) => {
        this.filters.sortBy = e.target.value;
      });
    }

    if (orderBy) {
      orderBy.addEventListener('change', (e) => {
        this.filters.orderBy = e.target.value;
      });
    }

    if (pageSize) {
      pageSize.addEventListener('change', (e) => {
        this.filters.pageSize = parseInt(e.target.value);
      });
    }
  }

  navigateToSection(section) {
    // Navigate to different main sections
    if (section === 'office') {
      window.location.href = 'my-office.html';
    } else if (section === 'accounts') {
      window.location.href = 'accounts.html';
    } else if (section === 'calendar') {
      window.location.href = 'calendar.html';
    } else if (section === 'reservations') {
      window.location.href = 'reservations-list.html';
    } else if (section === 'quotes') {
      window.location.href = 'quotes.html';
    }
  }

  switchTab(tabName) {
    // Update tab active state
    document.querySelectorAll('.window-tab').forEach(tab => {
      tab.classList.remove('active');
      if (tab.dataset.tab === tabName) {
        tab.classList.add('active');
      }
    });

    // Hide all sections
    document.querySelectorAll('.quotes-section').forEach(section => {
      section.classList.remove('active');
      section.style.display = 'none';
    });

    // Show the appropriate section
    let sectionId = '';
    if (tabName === 'manage-quotes') {
      sectionId = 'manage-quotes-tab';
    } else if (tabName === 'response-templates') {
      sectionId = 'response-templates-tab';
    } else if (tabName === 'initial-response') {
      sectionId = 'initial-response-tab';
    }

    const sectionElement = document.getElementById(sectionId);
    if (sectionElement) {
      sectionElement.classList.add('active');
      sectionElement.style.display = 'block';
      
      // Reinitialize editors when switching to response templates or initial response
      if (tabName === 'response-templates' || tabName === 'initial-response') {
        setTimeout(() => {
          if (window.initializeAllEditors) {
            window.initializeAllEditors();
          }
          if (window.reinitializeDragDrop) {
            window.reinitializeDragDrop();
          }
        }, 100);
      }
    }

    this.currentTab = tabName;
  }

  loadResponseTemplate(templateName) {
    // Update the template name input
    const templateNameInput = document.getElementById('responseTemplateName');
    if (templateNameInput) {
      templateNameInput.value = templateName;
    }
    
    // In a real application, this would load template content from the server
    console.log(`Loading response template: ${templateName}`);
  }

  loadInitialResponse(recipientType) {
    // Update the recipient dropdown
    const recipientSelect = document.getElementById('initialResponseRecipient');
    if (recipientSelect) {
      recipientSelect.value = recipientType;
    }
    
    // In a real application, this would load initial response content from the server
    console.log(`Loading initial response for: ${recipientType}`);
  }

  performSearch() {
    // Get current filter values
    this.filters.searchFor = document.getElementById('searchFor')?.value || '';
    this.filters.searchIn = document.getElementById('searchIn')?.value || '';
    this.filters.dateFrom = document.getElementById('dateFrom')?.value || '';
    this.filters.dateTo = document.getElementById('dateTo')?.value || '';
    this.filters.sortBy = document.getElementById('sortBy')?.value || 'when-requested';
    this.filters.orderBy = document.getElementById('orderBy')?.value || 'desc';
    this.filters.pageSize = parseInt(document.getElementById('pageSize')?.value || 25);

    console.log('Performing search with filters:', this.filters);

    // In a real application, this would make an API call to fetch filtered quotes
    this.loadQuotes();

    // Show feedback
    let filterMessage = 'Searching quotes';
    if (this.filters.searchFor) {
      filterMessage += `\n- Search term: "${this.filters.searchFor}"`;
    }
    if (this.filters.searchIn) {
      filterMessage += `\n- Search in: ${this.filters.searchIn}`;
    }
    if (this.filters.dateFrom) {
      filterMessage += `\n- From: ${this.filters.dateFrom}`;
    }
    if (this.filters.dateTo) {
      filterMessage += `\n- To: ${this.filters.dateTo}`;
    }
    filterMessage += `\n- Sort by: ${this.filters.sortBy} (${this.filters.orderBy})`;
    filterMessage += `\n- Page size: ${this.filters.pageSize}`;

    console.log(filterMessage);
  }

  loadQuotes() {
    // In a real application, this would fetch quotes from the server
    // For now, we'll display the "No results found" message
    const tbody = document.getElementById('quotesTableBody');
    if (!tbody) return;

    // Sample data structure (currently empty to show "No results found")
    this.quotes = [];
    
    // Uncomment below to show sample quotes:
    /*
    this.quotes = [
      {
        ref: 'Q-2023-001',
        puDate: '2023-12-25',
        time: '10:00 AM',
        passenger: 'John Smith',
        vehicleType: 'Sedan',
        quote: '$150.00',
        phone: '555-1234',
        whenRequested: '2023-12-20 09:30 AM'
      },
      {
        ref: 'Q-2023-002',
        puDate: '2023-12-26',
        time: '2:00 PM',
        passenger: 'Jane Doe',
        vehicleType: 'SUV',
        quote: '$200.00',
        phone: '555-5678',
        whenRequested: '2023-12-21 11:15 AM'
      }
    ];
    */

    this.renderQuotes();
  }

  renderQuotes() {
    const tbody = document.getElementById('quotesTableBody');
    if (!tbody) return;

    // Clear existing rows
    tbody.innerHTML = '';

    if (this.quotes.length === 0) {
      // Show "No results found"
      const row = document.createElement('tr');
      row.className = 'no-results-row';
      row.innerHTML = '<td colspan="9" class="no-results">No results found</td>';
      tbody.appendChild(row);
    } else {
      // Render quote rows
      this.quotes.forEach(quote => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${quote.ref}</td>
          <td>${quote.puDate}</td>
          <td>${quote.time}</td>
          <td>${quote.passenger}</td>
          <td>${quote.vehicleType}</td>
          <td>${quote.quote}</td>
          <td>${quote.phone}</td>
          <td>${quote.whenRequested}</td>
          <td><input type="checkbox" class="quote-checkbox" data-ref="${quote.ref}" /></td>
        `;
        tbody.appendChild(row);
      });

      // Add click handlers to checkboxes
      document.querySelectorAll('.quote-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
          const ref = e.target.dataset.ref;
          this.toggleQuoteSelection(ref, e.target.checked);
        });
      });
    }
  }

  toggleQuoteSelection(ref, selected) {
    console.log(`Quote ${ref} ${selected ? 'selected' : 'deselected'}`);
    // In a real application, this would track selected quotes for bulk actions
  }

  // Helper method to format date
  formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    });
  }

  // Helper method to format currency
  formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }
}

// Initialize the quotes manager
const quotesManager = new Quotes();
