// Tab Navigation
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');

tabButtons.forEach(button => {
    button.addEventListener('click', () => {
        const targetTab = button.getAttribute('data-tab');
        
        // Remove active class from all tabs and contents
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));
        
        // Add active class to clicked tab and corresponding content
        button.classList.add('active');
        document.getElementById(targetTab).classList.add('active');
    });
});

// Generate Report Buttons
const generateButtons = document.querySelectorAll('.generate-btn');

generateButtons.forEach(button => {
    button.addEventListener('click', function() {
        const originalText = this.textContent;
        this.textContent = 'GENERATING...';
        this.disabled = true;
        
        // Simulate report generation
        setTimeout(() => {
            this.textContent = originalText;
            this.disabled = false;
            
            // Show success message
            showNotification('Report generated successfully!', 'success');
            
            // Special handling for driver payment report
            if (this.textContent === 'VIEW PAYMENT REPORT') {
                const driverSelect = document.getElementById('driver-select');
                if (driverSelect.value) {
                    showDriverPaymentResults();
                } else {
                    showNotification('Please select a driver first', 'error');
                }
            }
        }, 1500);
    });
});

// Show Driver Payment Results
function showDriverPaymentResults() {
    const resultsDiv = document.getElementById('driver-payment-results');
    resultsDiv.style.display = 'block';
    resultsDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Notification System
function showNotification(message, type = 'info') {
    // Remove any existing notifications
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Style the notification
    Object.assign(notification.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        padding: '15px 25px',
        backgroundColor: type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3',
        color: 'white',
        borderRadius: '4px',
        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
        zIndex: '10000',
        fontSize: '14px',
        fontWeight: 'bold',
        animation: 'slideIn 0.3s ease-out'
    });
    
    document.body.appendChild(notification);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Add animation styles
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Action Links
const actionLinks = document.querySelectorAll('.action-link');

actionLinks.forEach(link => {
    link.addEventListener('click', function(e) {
        e.preventDefault();
        const action = this.textContent.trim();
        showNotification(`${action} clicked`, 'info');
    });
});

// Date Picker Auto-Fill for Today
document.addEventListener('DOMContentLoaded', () => {
    const today = new Date().toISOString().split('T')[0];
    
    // Auto-fill any date fields that don't have a value
    const dateInputs = document.querySelectorAll('input[type="date"]');
    dateInputs.forEach(input => {
        if (!input.value) {
            input.value = today;
        }
    });
});

// Radio Button Changes
const radioButtons = document.querySelectorAll('input[type="radio"]');

radioButtons.forEach(radio => {
    radio.addEventListener('change', function() {
        const label = this.nextElementSibling;
        if (label) {
            console.log(`Selected: ${label.textContent}`);
        }
    });
});

// Checkbox Changes
const checkboxes = document.querySelectorAll('input[type="checkbox"]');

checkboxes.forEach(checkbox => {
    checkbox.addEventListener('change', function() {
        const label = this.nextElementSibling || this.parentElement.querySelector('label');
        if (label) {
            console.log(`${label.textContent}: ${this.checked ? 'Checked' : 'Unchecked'}`);
        }
    });
});

// Driver Select Change
const driverSelect = document.getElementById('driver-select');
if (driverSelect) {
    driverSelect.addEventListener('change', function() {
        if (this.value) {
            console.log(`Driver selected: ${this.value}`);
        }
    });
}

// Dropdown Changes
const dropdowns = document.querySelectorAll('select');

dropdowns.forEach(select => {
    select.addEventListener('change', function() {
        console.log(`Dropdown changed: ${this.value}`);
    });
});

// Export Functionality (placeholder)
function exportReport(format = 'pdf') {
    showNotification(`Exporting report as ${format.toUpperCase()}...`, 'info');
    
    setTimeout(() => {
        showNotification(`Report exported successfully as ${format.toUpperCase()}!`, 'success');
    }, 2000);
}

// Print Functionality
function printReport() {
    showNotification('Preparing report for printing...', 'info');
    
    setTimeout(() => {
        window.print();
    }, 500);
}

// Keyboard Shortcuts
document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + P for Print
    if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        printReport();
    }
    
    // Ctrl/Cmd + E for Export
    if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault();
        exportReport('pdf');
    }
    
    // Ctrl/Cmd + G for Generate
    if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
        e.preventDefault();
        const activeTab = document.querySelector('.tab-content.active');
        const firstGenerateBtn = activeTab.querySelector('.generate-btn');
        if (firstGenerateBtn) {
            firstGenerateBtn.click();
        }
    }
});

// Form Validation
function validateForm(formElement) {
    const requiredFields = formElement.querySelectorAll('[required]');
    let isValid = true;
    
    requiredFields.forEach(field => {
        if (!field.value) {
            field.style.borderColor = 'red';
            isValid = false;
        } else {
            field.style.borderColor = '#ccc';
        }
    });
    
    if (!isValid) {
        showNotification('Please fill in all required fields', 'error');
    }
    
    return isValid;
}

// Auto-save Form State
function saveFormState() {
    const forms = document.querySelectorAll('form');
    forms.forEach((form, index) => {
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        localStorage.setItem(`reportForm_${index}`, JSON.stringify(data));
    });
}

// Restore Form State
function restoreFormState() {
    const forms = document.querySelectorAll('form');
    forms.forEach((form, index) => {
        const savedData = localStorage.getItem(`reportForm_${index}`);
        if (savedData) {
            const data = JSON.parse(savedData);
            Object.keys(data).forEach(key => {
                const field = form.querySelector(`[name="${key}"]`);
                if (field) {
                    field.value = data[key];
                }
            });
        }
    });
}

// Initialize
console.log('Reports module initialized');
console.log('Keyboard shortcuts:');
console.log('- Ctrl/Cmd + P: Print report');
console.log('- Ctrl/Cmd + E: Export report');
console.log('- Ctrl/Cmd + G: Generate report');

// Add tooltip functionality
const tooltipElements = document.querySelectorAll('[title]');
tooltipElements.forEach(element => {
    element.addEventListener('mouseenter', function() {
        const tooltip = document.createElement('div');
        tooltip.className = 'custom-tooltip';
        tooltip.textContent = this.getAttribute('title');
        tooltip.style.cssText = `
            position: absolute;
            background: #333;
            color: white;
            padding: 5px 10px;
            border-radius: 4px;
            font-size: 11px;
            z-index: 10001;
            pointer-events: none;
        `;
        document.body.appendChild(tooltip);
        
        const rect = this.getBoundingClientRect();
        tooltip.style.left = rect.left + 'px';
        tooltip.style.top = (rect.bottom + 5) + 'px';
        
        this.tooltipElement = tooltip;
    });
    
    element.addEventListener('mouseleave', function() {
        if (this.tooltipElement) {
            this.tooltipElement.remove();
            this.tooltipElement = null;
        }
    });
});
