// Sample print queue data (starts empty, but can be populated)
let printQueue = [];

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    updateQueueTable();
});

// Tab Switching
document.querySelectorAll('.tools-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        // Remove active class from all tabs and contents
        document.querySelectorAll('.tools-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tools-content').forEach(c => c.classList.remove('active'));
        
        // Add active class to clicked tab
        tab.classList.add('active');
        
        // Show corresponding content
        const tabName = tab.getAttribute('data-tab');
        document.getElementById(tabName).classList.add('active');
    });
});

// Toggle Select All
function toggleSelectAll(checkbox) {
    const checkboxes = document.querySelectorAll('.queue-item-row input[type="checkbox"]');
    checkboxes.forEach(cb => {
        cb.checked = checkbox.checked;
    });
}

// Remove Selected Items
function removeSelected() {
    const checkboxes = document.querySelectorAll('.queue-item-row input[type="checkbox"]:checked');
    
    if (checkboxes.length === 0) {
        alert('Please select items to remove from the queue.');
        return;
    }
    
    if (confirm(`Remove ${checkboxes.length} item(s) from print queue?`)) {
        checkboxes.forEach(checkbox => {
            const row = checkbox.closest('tr');
            const itemName = row.querySelector('td:first-child').textContent;
            
            // Remove from queue array
            printQueue = printQueue.filter(item => item.name !== itemName);
        });
        
        // Update table
        updateQueueTable();
        
        // Uncheck select all
        document.getElementById('selectAll').checked = false;
        
        alert(`${checkboxes.length} item(s) removed from queue.`);
    }
}

// Print Selected Items
function printSelected() {
    const checkboxes = document.querySelectorAll('.queue-item-row input[type="checkbox"]:checked');
    
    if (checkboxes.length === 0) {
        alert('Please select items to print.');
        return;
    }
    
    const itemNames = Array.from(checkboxes).map(cb => {
        return cb.closest('tr').querySelector('td:first-child').textContent;
    });
    
    alert(`Printing ${checkboxes.length} item(s):\n\n${itemNames.join('\n')}\n\nDocuments would be sent to the printer.`);
    
    // In a real system, this would trigger actual printing
    // For now, we'll just remove them from the queue after "printing"
    checkboxes.forEach(checkbox => {
        const row = checkbox.closest('tr');
        const itemName = row.querySelector('td:first-child').textContent;
        
        // Remove from queue array
        printQueue = printQueue.filter(item => item.name !== itemName);
    });
    
    // Update table
    updateQueueTable();
    
    // Uncheck select all
    document.getElementById('selectAll').checked = false;
}

// View/Print Individual Item
function printItem(itemName) {
    alert(`Printing: ${itemName}\n\nDocument would be sent to the printer.`);
    
    // Remove from queue after printing
    printQueue = printQueue.filter(item => item.name !== itemName);
    updateQueueTable();
}

// Change Page Size
function changePageSize() {
    const pageSize = document.getElementById('pageSize').value;
    console.log('Page size changed to:', pageSize);
    updateQueueTable();
}

// Update Queue Table
function updateQueueTable() {
    const tbody = document.getElementById('queueTableBody');
    
    if (printQueue.length === 0) {
        tbody.innerHTML = `
            <tr class="empty-row">
                <td colspan="4" class="empty-message">Print Queue is Empty</td>
            </tr>
        `;
    } else {
        tbody.innerHTML = printQueue.map(item => `
            <tr class="queue-item-row">
                <td>${item.name}</td>
                <td class="status-${item.status.toLowerCase()}">${item.status}</td>
                <td>
                    <a href="#" class="action-link" onclick="printItem('${item.name}'); return false;">Print</a>
                </td>
                <td class="checkbox-col">
                    <input type="checkbox">
                </td>
            </tr>
        `).join('');
    }
}

// Add sample items to queue (for testing)
function addSampleItems() {
    printQueue = [
        { name: 'Reservation Confirmation #12345', status: 'Ready' },
        { name: 'Invoice #334', status: 'Ready' },
        { name: 'Driver Manifest - 12/30/2024', status: 'Ready' },
        { name: 'Daily Summary Report', status: 'Pending' },
        { name: 'Passenger Receipt #98765', status: 'Ready' }
    ];
    updateQueueTable();
}

// Keyboard shortcut: Ctrl+P to add sample items (for demo purposes)
document.addEventListener('keydown', function(e) {
    if (e.ctrlKey && e.key === 'p' && printQueue.length === 0) {
        e.preventDefault();
        if (confirm('Add sample items to print queue for demonstration?')) {
            addSampleItems();
        }
    }
});

console.log('Tools module initialized');
console.log('Tip: Press Ctrl+P to add sample items to the print queue');
