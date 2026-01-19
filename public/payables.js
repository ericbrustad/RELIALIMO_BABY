// Tab Switching
document.querySelectorAll('.payables-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        // Remove active class from all tabs and contents
        document.querySelectorAll('.payables-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.payables-content').forEach(c => c.classList.remove('active'));
        
        // Add active class to clicked tab
        tab.classList.add('active');
        
        // Show corresponding content
        const tabName = tab.getAttribute('data-tab');
        document.getElementById(tabName).classList.add('active');
    });
});

// Filter Buttons
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        // Remove active from siblings
        this.parentElement.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        // Add active to clicked button
        this.classList.add('active');
        
        // TODO: Implement filtering logic
        console.log('Filter by:', this.getAttribute('data-status'));
    });
});

// Expand/Collapse Rows
document.querySelectorAll('.expand-icon').forEach(icon => {
    icon.addEventListener('click', function() {
        if (this.textContent === '+') {
            this.textContent = '-';
            // TODO: Show expanded row details
            console.log('Expand row');
        } else {
            this.textContent = '+';
            // TODO: Hide expanded row details
            console.log('Collapse row');
        }
    });
});

// Pay Driver Buttons
document.querySelectorAll('.pay-driver-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        const row = this.closest('.driver-row');
        const driverName = row.querySelector('.driver-name').textContent;
        const tripCount = row.querySelector('.trip-count strong').textContent;
        
        alert(`Processing payment for ${driverName}\nTrips: ${tripCount}\n\nPayment form would open here.`);
    });
});

// Pay Affiliate Buttons
document.querySelectorAll('.pay-affiliate-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        const row = this.closest('.affiliate-row');
        const affiliateName = row.querySelector('.affiliate-name').textContent;
        const tripCount = row.querySelector('.trip-count strong').textContent;
        
        alert(`Processing payment for ${affiliateName}\nTrips: ${tripCount}\n\nPayment form would open here.`);
    });
});

// Pay Agent Buttons
document.querySelectorAll('.pay-agent-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        const row = this.closest('.agent-row');
        const agentName = row.querySelector('.agent-name').textContent;
        const tripCount = row.querySelector('.trip-count strong').textContent;
        
        alert(`Processing commission payment for ${agentName}\nTrips: ${tripCount}\n\nPayment form would open here.`);
    });
});

// Search Buttons
document.querySelectorAll('.search-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        console.log('Search triggered');
        alert('Search functionality would filter results based on selected criteria.');
    });
});

// Percent Button (Date range helper)
document.querySelectorAll('.percent-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        console.log('Date range helper clicked');
        alert('Date range picker would open here.');
    });
});

console.log('Payables module initialized');
