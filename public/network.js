// Network Management JavaScript
console.log('Network JS loaded');

// Navigation between sections
document.querySelectorAll('.sidebar-link').forEach(link => {
    link.addEventListener('click', function(e) {
        e.preventDefault();
        
        const page = this.dataset.page;
        
        // Update active link
        document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
        this.classList.add('active');
        
        // Hide all sections
        document.querySelectorAll('.network-section').forEach(section => {
            section.classList.remove('active');
        });
        
        // Show selected section
        const sectionMap = {
            'company-profile': 'companyProfileSection',
            'locate-affiliates': 'locateAffiliatesSection',
            'network-requests': 'networkRequestsSection',
            'partner-trips': 'partnerTripsSection',
            'partner-trip-updates': null,
            'partners': null,
            'vehicle-types-mapping': null,
            'rates-mapping': null,
            'farm-in-settings': null
        };
        
        const sectionId = sectionMap[page];
        if (sectionId) {
            document.getElementById(sectionId).classList.add('active');
        } else if (page && !sectionId) {
            // Show placeholder for not yet implemented sections
            showComingSoon(page);
        }
    });
});

function showComingSoon(pageName) {
    const formattedName = pageName.split('-').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
    
    alert(`${formattedName} feature is coming soon!`);
}

// Form submission
const companyProfileForm = document.getElementById('companyProfileForm');
if (companyProfileForm) {
    companyProfileForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Get form data
        const formData = new FormData(this);
        
        // In a real application, this would send to backend
        console.log('Updating company profile...');
        
        // Show success message
        showNotification('Company profile updated successfully!', 'success');
    });
}

// Phone number formatting
document.querySelectorAll('input[type="tel"]').forEach(input => {
    input.addEventListener('blur', function() {
        formatPhoneNumber(this);
    });
});

function formatPhoneNumber(input) {
    let value = input.value.replace(/\D/g, '');
    
    if (value.length === 10) {
        input.value = `(${value.substring(0, 3)}) ${value.substring(3, 6)}-${value.substring(6)}`;
    } else if (value.length === 11 && value[0] === '1') {
        input.value = `(${value.substring(1, 4)}) ${value.substring(4, 7)}-${value.substring(7)}`;
    }
}

// Show notification
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Style notification
    Object.assign(notification.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        padding: '15px 25px',
        background: type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : '#2196F3',
        color: 'white',
        borderRadius: '4px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        zIndex: '10000',
        fontSize: '14px',
        fontWeight: '500',
        animation: 'slideInRight 0.3s ease-out'
    });
    
    // Add animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideInRight {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        @keyframes slideOutRight {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease-out';
        setTimeout(() => {
            notification.remove();
            style.remove();
        }, 300);
    }, 3000);
}

// Auto-save functionality (optional)
let autoSaveTimeout;
const formInputs = document.querySelectorAll('.company-profile-form input, .company-profile-form textarea, .company-profile-form select');

formInputs.forEach(input => {
    input.addEventListener('input', function() {
        clearTimeout(autoSaveTimeout);
        autoSaveTimeout = setTimeout(() => {
            console.log('Auto-saving...');
            // In a real application, this would save to backend
        }, 2000);
    });
});

// Character counter for textareas (optional)
document.querySelectorAll('.form-textarea').forEach(textarea => {
    textarea.addEventListener('input', function() {
        const maxLength = this.getAttribute('maxlength');
        if (maxLength) {
            const remaining = maxLength - this.value.length;
            // Could add character counter display here
        }
    });
});

// Country code flag update
document.querySelectorAll('.country-code').forEach(select => {
    select.addEventListener('change', function() {
        console.log('Country code changed:', this.value);
    });
});

// Validation
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function validatePhone(phone) {
    const re = /^\(\d{3}\)\s\d{3}-\d{4}$/;
    return re.test(phone);
}

// Form validation on submit
if (companyProfileForm) {
    companyProfileForm.addEventListener('submit', function(e) {
        let isValid = true;
        const errors = [];
        
        // Check required fields
        const requiredFields = this.querySelectorAll('.form-label.required');
        requiredFields.forEach(label => {
            const input = label.parentElement.querySelector('input, textarea, select');
            if (input && !input.value.trim()) {
                isValid = false;
                errors.push(`${label.textContent} is required`);
                input.style.borderColor = '#f44336';
            } else if (input) {
                input.style.borderColor = '#ccc';
            }
        });
        
        // Validate emails
        const emailInputs = this.querySelectorAll('input[type="email"]');
        emailInputs.forEach(input => {
            if (input.value && !validateEmail(input.value)) {
                isValid = false;
                errors.push(`Invalid email: ${input.value}`);
                input.style.borderColor = '#f44336';
            }
        });
        
        if (!isValid) {
            e.preventDefault();
            showNotification(errors[0], 'error');
        }
    });
}

// Listen for messages from parent
window.addEventListener('message', function(event) {
    if (event.data.action === 'navigateToSection') {
        const section = event.data.section;
        const link = document.querySelector(`.sidebar-link[data-page="${section}"]`);
        if (link) {
            link.click();
        }
    }
});

// Country search functionality
const countrySearch = document.getElementById('countrySearch');
if (countrySearch) {
    countrySearch.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase().trim();
        const countryItems = document.querySelectorAll('.country-item');
        
        countryItems.forEach(item => {
            const countryName = item.dataset.country;
            const countryLinkText = item.querySelector('.country-link').dataset.countryName.toLowerCase();
            
            if (countryName.includes(searchTerm) || countryLinkText.includes(searchTerm)) {
                item.classList.remove('hidden');
            } else {
                item.classList.add('hidden');
            }
        });
    });
}

// Country link click handling
document.querySelectorAll('.country-link').forEach(link => {
    link.addEventListener('click', function(e) {
        e.preventDefault();
        const countryName = this.dataset.countryName;
        
        // Show modal or search results
        showCountrySearchModal(countryName);
    });
});

function showCountrySearchModal(countryName) {
    // Create modal overlay
    const modal = document.createElement('div');
    modal.className = 'country-search-modal';
    modal.innerHTML = `
        <div class="modal-overlay"></div>
        <div class="modal-content">
            <div class="modal-header">
                <h2>Search Affiliates in ${countryName}</h2>
                <button class="modal-close" onclick="this.closest('.country-search-modal').remove()">×</button>
            </div>
            <div class="modal-body">
                <div class="search-form">
                    <input type="text" class="form-input" placeholder="Company name...">
                    <input type="text" class="form-input" placeholder="City...">
                    <button class="btn btn-primary">Search</button>
                </div>
                <div class="search-results">
                    <p style="text-align: center; color: #666; padding: 40px 20px;">
                        Enter search criteria to find affiliates in ${countryName}
                    </p>
                </div>
            </div>
        </div>
    `;
    
    // Add modal styles
    const style = document.createElement('style');
    style.textContent = `
        .country-search-modal {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .modal-overlay {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
        }
        .modal-content {
            position: relative;
            background: white;
            border-radius: 8px;
            width: 90%;
            max-width: 600px;
            max-height: 80vh;
            display: flex;
            flex-direction: column;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
        }
        .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px 25px;
            border-bottom: 1px solid #e0e0e0;
        }
        .modal-header h2 {
            margin: 0;
            font-size: 20px;
            color: #333;
        }
        .modal-close {
            background: none;
            border: none;
            font-size: 32px;
            color: #999;
            cursor: pointer;
            line-height: 1;
            padding: 0;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 4px;
            transition: all 0.2s;
        }
        .modal-close:hover {
            background: #f5f5f5;
            color: #333;
        }
        .modal-body {
            padding: 25px;
            overflow-y: auto;
        }
        .search-form {
            display: flex;
            flex-direction: column;
            gap: 15px;
            margin-bottom: 25px;
        }
        .search-results {
            border-top: 1px solid #e0e0e0;
            padding-top: 20px;
        }
    `;
    document.head.appendChild(style);
    
    // Close on overlay click
    modal.querySelector('.modal-overlay').addEventListener('click', function() {
        modal.remove();
        style.remove();
    });
    
    document.body.appendChild(modal);
}

// Search link toggle
document.querySelectorAll('.search-link').forEach(link => {
    link.addEventListener('click', function(e) {
        e.preventDefault();
        
        // Update active link
        document.querySelectorAll('.search-link').forEach(l => l.classList.remove('active'));
        this.classList.add('active');
        
        const searchType = this.dataset.search;
        console.log('Search type:', searchType);
        
        // In a real application, this would change the search form
        if (searchType === 'conf') {
            showNotification('Switch to Conf # search mode', 'info');
        } else {
            showNotification('Switch to Reservations search mode', 'info');
        }
    });
});

// Trip search form submission
const tripSearchForm = document.getElementById('tripSearchForm');
if (tripSearchForm) {
    tripSearchForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const formData = new FormData(this);
        const searchParams = {
            dateFrom: formData.get('dateFrom'),
            dateTo: formData.get('dateTo'),
            sortBy: formData.get('sortBy'),
            orderBy: formData.get('orderBy'),
            customer: formData.get('customer')
        };
        
        console.log('Searching partner trips:', searchParams);
        
        // Simulate search results
        const tbody = document.getElementById('tripsTableBody');
        tbody.innerHTML = `
            <tr class="no-results">
                <td colspan="7">
                    <div class="no-results-message">
                        <span class="no-results-icon">🔍</span>
                        <p>Searching partner trips...</p>
                        <small>Please wait while we search for matching trips</small>
                    </div>
                </td>
            </tr>
        `;
        
        // Simulate delay
        setTimeout(() => {
            tbody.innerHTML = `
                <tr class="no-results">
                    <td colspan="7">
                        <div class="no-results-message">
                            <span class="no-results-icon">📋</span>
                            <p>No Records Found</p>
                            <small>Try adjusting your search criteria</small>
                        </div>
                    </td>
                </tr>
            `;
            
            showNotification('Search completed - No results found', 'info');
        }, 1000);
    });
}

// Pagination functionality
document.querySelectorAll('.page-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        if (this.textContent === '«' || this.textContent === '»') {
            // Previous/Next buttons
            const pagination = this.closest('.pagination');
            const currentPage = pagination.querySelector('.page-active');
            const allPages = Array.from(pagination.querySelectorAll('.page-btn')).filter(b => 
                b.textContent !== '«' && b.textContent !== '»'
            );
            
            if (this.textContent === '«') {
                // Previous
                const currentIndex = allPages.indexOf(currentPage);
                if (currentIndex > 0) {
                    currentPage.classList.remove('page-active');
                    allPages[currentIndex - 1].classList.add('page-active');
                }
            } else {
                // Next
                const currentIndex = allPages.indexOf(currentPage);
                if (currentIndex < allPages.length - 1) {
                    currentPage.classList.remove('page-active');
                    allPages[currentIndex + 1].classList.add('page-active');
                }
            }
        } else {
            // Number buttons
            const pagination = this.closest('.pagination');
            pagination.querySelectorAll('.page-btn').forEach(b => b.classList.remove('page-active'));
            this.classList.add('page-active');
        }
        
        // In a real application, this would load the corresponding page of data
        console.log('Loading page:', this.textContent);
    });
});

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    console.log('Network page initialized');
    
    // Load saved form data from localStorage (optional)
    const savedData = localStorage.getItem('companyProfile');
    if (savedData) {
        try {
            const data = JSON.parse(savedData);
            // Could restore form data here
            console.log('Loaded saved profile data');
        } catch (e) {
            console.error('Error loading saved data:', e);
        }
    }
});