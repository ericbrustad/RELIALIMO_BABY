// Receivables Management JavaScript
console.log('Receivables JS loaded');

// Tab Navigation
document.querySelectorAll('.receivables-tab').forEach(tab => {
    tab.addEventListener('click', function() {
        const tabName = this.dataset.tab;
        
        // Update active tab button
        document.querySelectorAll('.receivables-tab').forEach(t => t.classList.remove('active'));
        this.classList.add('active');
        
        // Update active tab content
        document.querySelectorAll('.receivables-tab-content').forEach(content => {
            content.classList.remove('active');
        });
        
        // Show selected tab content
        const tabContentMap = {
            'create-invoices': 'createInvoicesTab',
            'receive-payments': 'receivePaymentsTab',
            'invoices': 'invoicesTab',
            'closed-invoices': 'closedInvoicesTab',
            'pending-transactions': 'pendingTransactionsTab'
        };
        
        const contentId = tabContentMap[tabName];
        if (contentId) {
            document.getElementById(contentId).classList.add('active');
        }
    });
});

// Include Unconfirmed Trips Checkbox
const includeUnconfirmedCheckbox = document.getElementById('includeUnconfirmed');
if (includeUnconfirmedCheckbox) {
    includeUnconfirmedCheckbox.addEventListener('change', function() {
        console.log('Include unconfirmed trips:', this.checked);
        showNotification(
            this.checked ? 'Including unconfirmed trips in search' : 'Excluding unconfirmed trips from search',
            'info'
        );
    });
}

// Invoice Search Form (Create Invoices)
const invoiceSearchForm = document.getElementById('invoiceSearchForm');
if (invoiceSearchForm) {
    invoiceSearchForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const formData = new FormData(this);
        const searchParams = {
            groupBy: formData.get('groupBy'),
            searchFor: formData.get('searchFor'),
            searchIn: formData.get('searchIn'),
            dateFrom: formData.get('dateFrom'),
            dateTo: formData.get('dateTo'),
            includeUnconfirmed: includeUnconfirmedCheckbox?.checked || false
        };
        
        console.log('Searching for invoiceable trips:', searchParams);
        
        // Show loading state
        showLoadingState();
        
        // Simulate search
        setTimeout(() => {
            showNotification('Search completed - No outstanding trips found', 'info');
            hideLoadingState();
        }, 1000);
    });
}

// All other search forms
document.querySelectorAll('.invoice-search-form').forEach(form => {
    if (form.id !== 'invoiceSearchForm') { // Skip the main one we already handled
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const formData = new FormData(this);
            console.log('Searching...', Object.fromEntries(formData));
            
            showNotification('Searching records...', 'info');
            
            setTimeout(() => {
                showNotification('Search completed', 'success');
            }, 1000);
        });
    }
});

// Apply Payment Links - Receive Payments Tab
document.querySelectorAll('.apply-payment-link').forEach(link => {
    link.addEventListener('click', function(e) {
        e.preventDefault();
        
        const accountRow = this.closest('.account-row');
        const accountName = accountRow.querySelector('.account-name')?.textContent;
        
        if (accountName) {
            showPaymentModal(accountName);
        }
    });
});

// Account Checkboxes - Receive Payments Tab
document.querySelectorAll('.account-checkbox-input').forEach(checkbox => {
    checkbox.addEventListener('change', function() {
        const accountRow = this.closest('.account-row');
        if (this.checked) {
            accountRow.style.background = '#e3f2fd';
        } else {
            accountRow.style.background = '#fff';
        }
    });
});

// Show Payment Modal
function showPaymentModal(accountName) {
    const modal = document.createElement('div');
    modal.className = 'payment-modal';
    modal.innerHTML = `
        <div class="modal-overlay"></div>
        <div class="modal-content">
            <div class="modal-header">
                <h2>Apply Payment</h2>
                <button class="modal-close" onclick="this.closest('.payment-modal').remove()">×</button>
            </div>
            <div class="modal-body">
                <div class="payment-info">
                    <div class="info-row">
                        <span class="info-label">Account:</span>
                        <span class="info-value">${accountName}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Total Outstanding:</span>
                        <span class="info-value">$828.34</span>
                    </div>
                </div>
                <form class="payment-form">
                    <div class="form-group">
                        <label>Payment Amount</label>
                        <input type="number" class="form-input" step="0.01" placeholder="0.00" required>
                    </div>
                    <div class="form-group">
                        <label>Payment Method</label>
                        <select class="form-input" required>
                            <option value="">Select method...</option>
                            <option value="cash">Cash</option>
                            <option value="check">Check</option>
                            <option value="credit-card">Credit Card</option>
                            <option value="bank-transfer">Bank Transfer</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Payment Date</label>
                        <input type="date" class="form-input" value="${new Date().toISOString().split('T')[0]}" required>
                    </div>
                    <div class="form-group">
                        <label>Notes (Optional)</label>
                        <textarea class="form-input" rows="3" placeholder="Add payment notes..."></textarea>
                    </div>
                    <div class="payment-actions">
                        <button type="submit" class="btn btn-primary">Apply Payment</button>
                        <button type="button" class="btn btn-secondary" onclick="this.closest('.payment-modal').remove()">Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    // Add modal styles
    const style = document.createElement('style');
    style.textContent = `
        .payment-modal {
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
            max-height: 90vh;
            overflow-y: auto;
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
        .payment-info {
            background: #f8f9fa;
            border-radius: 6px;
            padding: 15px;
            margin-bottom: 25px;
        }
        .info-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
        }
        .info-label {
            font-weight: 600;
            color: #555;
        }
        .info-value {
            color: #333;
        }
        .form-group {
            margin-bottom: 20px;
        }
        .form-group label {
            display: block;
            font-weight: 600;
            color: #555;
            margin-bottom: 8px;
            font-size: 14px;
        }
        .form-input {
            width: 100%;
            padding: 10px 12px;
            border: 1px solid #ccc;
            border-radius: 4px;
            font-size: 14px;
            font-family: inherit;
            transition: border-color 0.2s;
        }
        .form-input:focus {
            outline: none;
            border-color: #0066cc;
            box-shadow: 0 0 0 3px rgba(0, 102, 204, 0.1);
        }
        textarea.form-input {
            resize: vertical;
        }
        .payment-actions {
            display: flex;
            gap: 10px;
            justify-content: flex-end;
            margin-top: 25px;
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
    
    // Handle form submission
    modal.querySelector('.payment-form').addEventListener('submit', function(e) {
        e.preventDefault();
        console.log('Processing payment for:', accountName);
        showNotification('Payment applied successfully!', 'success');
        modal.remove();
        style.remove();
    });
    
    document.body.appendChild(modal);
}

// Show Loading State
function showLoadingState() {
    const resultsSection = document.querySelector('#createInvoicesTab .results-section');
    if (resultsSection) {
        resultsSection.innerHTML = `
            <div class="loading-state">
                <div class="loading-spinner"></div>
                <p style="margin-top: 15px; color: #666;">Searching for trips to invoice...</p>
            </div>
        `;
    }
}

// Hide Loading State (restore original message)
function hideLoadingState() {
    const resultsSection = document.querySelector('#createInvoicesTab .results-section');
    if (resultsSection) {
        resultsSection.innerHTML = `
            <div class="notice-banner notice-warning">
                ⚠️ No outstanding trips to be billed
            </div>
        `;
    }
}

// Show notification
function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notif => notif.remove());
    
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

// Filter Buttons - Invoices Tab
document.querySelectorAll('.filter-btn').forEach(button => {
    button.addEventListener('click', function() {
        // Get all buttons in the same group
        const group = this.parentElement;
        const buttonsInGroup = group.querySelectorAll('.filter-btn');
        
        // Remove active from all buttons in group
        buttonsInGroup.forEach(btn => btn.classList.remove('active'));
        
        // Add active to clicked button
        this.classList.add('active');
        
        console.log('Filter changed:', this.dataset.filter);
    });
});

// Select All Invoices Checkbox
const selectAllInvoices = document.getElementById('selectAllInvoices');
if (selectAllInvoices) {
    selectAllInvoices.addEventListener('change', function() {
        const checkboxes = document.querySelectorAll('.row-checkbox-invoice');
        checkboxes.forEach(checkbox => {
            checkbox.checked = this.checked;
        });
    });
}

// Individual Invoice Row Checkboxes
document.querySelectorAll('.row-checkbox-invoice').forEach(checkbox => {
    checkbox.addEventListener('change', function() {
        const allCheckboxes = document.querySelectorAll('.row-checkbox-invoice');
        const checkedCheckboxes = document.querySelectorAll('.row-checkbox-invoice:checked');
        const selectAll = document.getElementById('selectAllInvoices');
        
        if (selectAll) {
            selectAll.checked = allCheckboxes.length === checkedCheckboxes.length;
        }
    });
});

// Bulk Action Buttons
document.getElementById('invoiceSelected')?.addEventListener('click', function() {
    const checked = document.querySelectorAll('.row-checkbox-invoice:checked').length;
    if (checked === 0) {
        showNotification('Please select at least one invoice', 'info');
    } else {
        showNotification(`Processing ${checked} selected invoice(s)...`, 'info');
    }
});

document.getElementById('unfinalizeSelected')?.addEventListener('click', function() {
    const checked = document.querySelectorAll('.row-checkbox-invoice:checked').length;
    if (checked === 0) {
        showNotification('Please select at least one invoice', 'info');
    } else {
        showNotification(`Unfinalizing ${checked} selected invoice(s)...`, 'success');
    }
});

document.getElementById('closeSelected')?.addEventListener('click', function() {
    const checked = document.querySelectorAll('.row-checkbox-invoice:checked').length;
    if (checked === 0) {
        showNotification('Please select at least one invoice', 'info');
    } else {
        showNotification(`Closing ${checked} selected invoice(s)...`, 'success');
    }
});

// Action Mini Buttons
document.querySelectorAll('.action-mini-btn').forEach(button => {
    button.addEventListener('click', function() {
        const action = this.textContent.trim();
        const row = this.closest('tr');
        const invoiceNumber = row.querySelector('.invoice-number')?.textContent;
        
        console.log(`${action} invoice #${invoiceNumber}`);
        showNotification(`${action} invoice #${invoiceNumber}`, 'success');
    });
});

// Invoice Number Links
document.querySelectorAll('.invoice-number').forEach(link => {
    link.addEventListener('click', function(e) {
        e.preventDefault();
        const invoiceNum = this.textContent;
        showNotification(`Opening invoice #${invoiceNum}...`, 'info');
    });
});

// Select All Closed Invoices Checkbox
const selectAllClosed = document.getElementById('selectAllClosed');
if (selectAllClosed) {
    selectAllClosed.addEventListener('change', function() {
        const checkboxes = document.querySelectorAll('.row-checkbox-closed');
        checkboxes.forEach(checkbox => {
            checkbox.checked = this.checked;
        });
    });
}

// Individual Closed Invoice Row Checkboxes
document.querySelectorAll('.row-checkbox-closed').forEach(checkbox => {
    checkbox.addEventListener('change', function() {
        const allCheckboxes = document.querySelectorAll('.row-checkbox-closed');
        const checkedCheckboxes = document.querySelectorAll('.row-checkbox-closed:checked');
        const selectAll = document.getElementById('selectAllClosed');
        
        if (selectAll) {
            selectAll.checked = allCheckboxes.length === checkedCheckboxes.length;
        }
    });
});

// Reopen Selected Button
document.getElementById('reopenSelected')?.addEventListener('click', function() {
    const checked = document.querySelectorAll('.row-checkbox-closed:checked').length;
    if (checked === 0) {
        showNotification('Please select at least one invoice', 'info');
    } else {
        showNotification(`Reopening ${checked} selected invoice(s)...`, 'success');
    }
});

// Pending Transactions Sub-tabs
document.querySelectorAll('.pending-subtab').forEach(tab => {
    tab.addEventListener('click', function() {
        const subtabName = this.dataset.subtab;
        
        // Update active subtab button
        document.querySelectorAll('.pending-subtab').forEach(t => t.classList.remove('active'));
        this.classList.add('active');
        
        // Update active subtab content
        document.querySelectorAll('.pending-subtab-content').forEach(content => {
            content.classList.remove('active');
        });
        
        // Show selected subtab content
        const subtabContentMap = {
            'invoices': 'pendingInvoicesSubtab',
            'reservations': 'pendingReservationsSubtab'
        };
        
        const contentId = subtabContentMap[subtabName];
        if (contentId) {
            document.getElementById(contentId).classList.add('active');
        }
        
        console.log('Switched to pending subtab:', subtabName);
    });
});

// Pending Search Forms
document.querySelectorAll('.pending-search-form').forEach(form => {
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        console.log('Searching pending transactions...');
        showNotification('Searching transactions...', 'info');
    });
});

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    console.log('Receivables page initialized');
});
