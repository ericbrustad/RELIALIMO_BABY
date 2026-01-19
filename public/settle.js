// Settle Management JavaScript
console.log('Settle JS loaded');

// Tab Navigation
document.querySelectorAll('.settle-tab').forEach(tab => {
    tab.addEventListener('click', function() {
        const tabName = this.dataset.tab;
        
        // Update active tab button
        document.querySelectorAll('.settle-tab').forEach(t => t.classList.remove('active'));
        this.classList.add('active');
        
        // Update active tab content
        document.querySelectorAll('.settle-tab-content').forEach(content => {
            content.classList.remove('active');
        });
        
        // Show selected tab content
        const tabContentMap = {
            'payments-needed': 'paymentsNeededTab',
            'ready-to-settle': 'readyToSettleTab',
            'settled-reservations': 'settledReservationsTab'
        };
        
        const contentId = tabContentMap[tabName];
        if (contentId) {
            document.getElementById(contentId).classList.add('active');
        }
    });
});

// Select All Checkbox
const selectAllCheckbox = document.getElementById('selectAll');
if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener('change', function() {
        const checkboxes = document.querySelectorAll('.row-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = this.checked;
        });
    });
}

// Individual Row Checkboxes
document.querySelectorAll('.row-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', function() {
        const allCheckboxes = document.querySelectorAll('.row-checkbox');
        const checkedCheckboxes = document.querySelectorAll('.row-checkbox:checked');
        const selectAll = document.getElementById('selectAll');
        
        if (selectAll) {
            selectAll.checked = allCheckboxes.length === checkedCheckboxes.length;
        }
    });
});

// Search Form Submission
document.querySelectorAll('.settle-search-form').forEach(form => {
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const formData = new FormData(this);
        const searchParams = {
            searchFor: formData.get('searchFor'),
            searchIn: formData.get('searchIn'),
            dateFrom: formData.get('dateFrom'),
            dateTo: formData.get('dateTo'),
            sortBy: formData.get('sortBy'),
            orderBy: formData.get('orderBy'),
            pageSize: formData.get('pageSize')
        };
        
        console.log('Searching settlements:', searchParams);
        
        // Show loading state
        showLoadingState();
        
        // Simulate search
        setTimeout(() => {
            showNotification('Search completed', 'success');
            hideLoadingState();
        }, 1000);
    });
});

// Settle Button Click
document.querySelectorAll('.btn-icon').forEach(button => {
    button.addEventListener('click', function(e) {
        e.preventDefault();
        
        const row = this.closest('tr');
        const confNumber = row.querySelector('.conf-link')?.textContent;
        
        if (confNumber) {
            showSettleModal(confNumber);
        }
    });
});

// Pagination
const firstPageLink = document.getElementById('firstPage');
const lastPageLink = document.getElementById('lastPage');

if (firstPageLink) {
    firstPageLink.addEventListener('click', function(e) {
        e.preventDefault();
        console.log('Go to first page');
        showNotification('Navigating to first page', 'info');
    });
}

if (lastPageLink) {
    lastPageLink.addEventListener('click', function(e) {
        e.preventDefault();
        console.log('Go to last page');
        showNotification('Navigating to last page', 'info');
    });
}

// Page Selector
const pageSelector = document.getElementById('pageSelector');
if (pageSelector) {
    pageSelector.addEventListener('change', function() {
        console.log('Changed to page:', this.value);
        showNotification(`Loading page ${this.value}`, 'info');
    });
}

// Show Settle Modal
function showSettleModal(confNumber) {
    const modal = document.createElement('div');
    modal.className = 'settle-modal';
    modal.innerHTML = `
        <div class="modal-overlay"></div>
        <div class="modal-content">
            <div class="modal-header">
                <h2>Settle Reservation #${confNumber}</h2>
                <button class="modal-close" onclick="this.closest('.settle-modal').remove()">×</button>
            </div>
            <div class="modal-body">
                <div class="settle-info">
                    <div class="info-row">
                        <span class="info-label">Confirmation #:</span>
                        <span class="info-value">${confNumber}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Total Due:</span>
                        <span class="info-value">$250.00</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Payment Method:</span>
                        <span class="info-value">Credit Card</span>
                    </div>
                </div>
                <div class="settle-actions">
                    <button class="btn btn-primary" onclick="processSettle('${confNumber}')">Process Settlement</button>
                    <button class="btn btn-secondary" onclick="this.closest('.settle-modal').remove()">Cancel</button>
                </div>
            </div>
        </div>
    `;
    
    // Add modal styles
    const style = document.createElement('style');
    style.textContent = `
        .settle-modal {
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
            max-width: 500px;
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
        }
        .settle-info {
            margin-bottom: 25px;
        }
        .info-row {
            display: flex;
            justify-content: space-between;
            padding: 10px 0;
            border-bottom: 1px solid #f0f0f0;
        }
        .info-label {
            font-weight: 600;
            color: #555;
        }
        .info-value {
            color: #333;
        }
        .settle-actions {
            display: flex;
            gap: 10px;
            justify-content: flex-end;
        }
        .btn-primary {
            background: #0066cc;
            color: #fff;
        }
        .btn-primary:hover {
            background: #0052a3;
        }
        .btn-secondary {
            background: #e0e0e0;
            color: #333;
        }
        .btn-secondary:hover {
            background: #d0d0d0;
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

// Process Settlement
window.processSettle = function(confNumber) {
    console.log('Processing settlement for:', confNumber);
    
    showNotification('Processing settlement...', 'info');
    
    // Simulate processing
    setTimeout(() => {
        const modal = document.querySelector('.settle-modal');
        if (modal) {
            modal.remove();
        }
        showNotification(`Reservation #${confNumber} settled successfully!`, 'success');
    }, 1500);
};

// Show Loading State
function showLoadingState() {
    const tableBody = document.getElementById('settleTableBody');
    if (tableBody) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="13">
                    <div class="loading-state">
                        <div class="loading-spinner"></div>
                        <p style="margin-top: 15px; color: #666;">Searching...</p>
                    </div>
                </td>
            </tr>
        `;
    }
}

// Hide Loading State
function hideLoadingState() {
    const tableBody = document.getElementById('settleTableBody');
    if (tableBody) {
        // Restore original content or show no results
        tableBody.innerHTML = `
            <tr>
                <td><input type="checkbox" class="row-checkbox"></td>
                <td><a href="#" class="conf-link">44289</a></td>
                <td>FarmOut</td>
                <td>Done</td>
                <td>11/07/2018 11:00 PM</td>
                <td>Gallardo, Jessie</td>
                <td>Limo, Inc.</td>
                <td>N/A</td>
                <td>BLACK SUV</td>
                <td>Credit Card</td>
                <td>UNPAID</td>
                <td>$250.00</td>
                <td>
                    <button class="btn-icon" title="SETTLE">💳</button>
                </td>
            </tr>
        `;
        
        // Re-attach event listeners
        attachRowCheckboxListeners();
        attachSettleButtonListeners();
    }
}

// Attach event listeners to newly added elements
function attachRowCheckboxListeners() {
    document.querySelectorAll('.row-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const allCheckboxes = document.querySelectorAll('.row-checkbox');
            const checkedCheckboxes = document.querySelectorAll('.row-checkbox:checked');
            const selectAll = document.getElementById('selectAll');
            
            if (selectAll) {
                selectAll.checked = allCheckboxes.length === checkedCheckboxes.length;
            }
        });
    });
}

function attachSettleButtonListeners() {
    document.querySelectorAll('.btn-icon').forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            
            const row = this.closest('tr');
            const confNumber = row.querySelector('.conf-link')?.textContent;
            
            if (confNumber) {
                showSettleModal(confNumber);
            }
        });
    });
}

// Show notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    Object.assign(notification.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        padding: '15px 25px',
        background: type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : '#2196F3',
        color: 'white',
        borderRadius: '4px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        zIndex: '10001',
        fontSize: '14px',
        fontWeight: '500',
        animation: 'slideInRight 0.3s ease-out'
    });
    
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOutRight {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease-out';
        setTimeout(() => {
            notification.remove();
            style.remove();
        }, 300);
    }, 3000);
}

// Settled Tab - Select All Checkbox
const selectAllSettled = document.getElementById('selectAllSettled');
if (selectAllSettled) {
    selectAllSettled.addEventListener('change', function() {
        const checkboxes = document.querySelectorAll('.row-checkbox-settled');
        checkboxes.forEach(checkbox => {
            checkbox.checked = this.checked;
        });
    });
}

// Settled Tab - Individual Row Checkboxes
document.querySelectorAll('.row-checkbox-settled').forEach(checkbox => {
    checkbox.addEventListener('change', function() {
        const allCheckboxes = document.querySelectorAll('.row-checkbox-settled');
        const checkedCheckboxes = document.querySelectorAll('.row-checkbox-settled:checked');
        const selectAll = document.getElementById('selectAllSettled');
        
        if (selectAll) {
            selectAll.checked = allCheckboxes.length === checkedCheckboxes.length;
        }
    });
});

// Settled Tab Pagination
const settledPageSelector = document.getElementById('settledPageSelector');
if (settledPageSelector) {
    settledPageSelector.addEventListener('change', function() {
        console.log('Changed to page:', this.value);
        showNotification(`Loading page ${this.value}`, 'info');
    });
}

const settledFirstPage = document.getElementById('settledFirstPage');
if (settledFirstPage) {
    settledFirstPage.addEventListener('click', function(e) {
        e.preventDefault();
        console.log('Go to first page');
        showNotification('Navigating to first page', 'info');
    });
}

const settledLastPage = document.getElementById('settledLastPage');
if (settledLastPage) {
    settledLastPage.addEventListener('click', function(e) {
        e.preventDefault();
        console.log('Go to last page');
        showNotification('Navigating to last page', 'info');
    });
}

// Settled Search Form
const settledSearchForm = document.getElementById('settledSearchForm');
if (settledSearchForm) {
    settledSearchForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const formData = new FormData(this);
        const searchParams = {
            searchFor: formData.get('searchFor'),
            searchIn: formData.get('searchIn'),
            dateFrom: formData.get('dateFrom'),
            dateTo: formData.get('dateTo'),
            sortBy: formData.get('sortBy'),
            orderBy: formData.get('orderBy'),
            pageSize: formData.get('pageSize')
        };
        
        console.log('Searching settled reservations:', searchParams);
        showNotification('Searching settled reservations...', 'info');
        
        // Simulate search
        setTimeout(() => {
            showNotification('Search completed', 'success');
        }, 1000);
    });
}

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    console.log('Settle page initialized');
});