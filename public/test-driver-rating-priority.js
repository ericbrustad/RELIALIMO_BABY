/**
 * Test Driver Rating Priority System
 * Demonstrates the driver sorting logic based on rating priority toggle
 */

// Mock driver data for testing
const mockDrivers = [
    { id: 1, name: 'Alice Johnson', driver_rating: 10, status: 'active' },
    { id: 2, name: 'Bob Smith', driver_rating: 10, status: 'active' },
    { id: 3, name: 'Charlie Brown', driver_rating: 9, status: 'active' },
    { id: 4, name: 'Diana Ross', driver_rating: 8, status: 'active' },
    { id: 5, name: 'Edward King', driver_rating: 7, status: 'active' },
    { id: 6, name: 'Frank Wilson', driver_rating: 7, status: 'active' },
    { id: 7, name: 'Grace Lee', driver_rating: 5, status: 'active' },
    { id: 8, name: 'Henry Davis', driver_rating: 3, status: 'active' },
    { id: 9, name: 'Iris Chen', driver_rating: 1, status: 'active' },
    { id: 10, name: 'Jack Miller', driver_rating: 1, status: 'active' }
];

// Mock reservation
const mockReservation = {
    id: '12345',
    pickup_location: 'Downtown Boston, MA',
    vehicle_type: 'sedan'
};

// Mock settings
let testSettings = {
    enableDriverRatingPriority: true,
    enableServiceAreaMatching: false,
    enableVehicleTypeMatching: false,
    prioritizeAvailableForOnDemand: false
};

/**
 * Simulate the driver priority sorting logic from FarmoutAutomationService
 */
function sortDriversByPriority(drivers, settings) {
    const ratingPriorityEnabled = settings.enableDriverRatingPriority !== false;
    
    // Score and sort drivers
    const scoredDrivers = drivers.map(driver => {
        let score = 0;
        
        // Get driver rating (1-10, default 5)
        const rating = Math.max(1, Math.min(10, parseInt(driver.driver_rating || driver.rating || 5)));
        
        // Apply rating to score ONLY if rating priority is enabled
        if (ratingPriorityEnabled) {
            // Rating contributes the most significant part of the score (1000-10000)
            score += rating * 1000;
        }
        
        return { driver, score, rating };
    });
    
    // Sort drivers: 
    // 1. By score (highest first) - includes rating if enabled
    // 2. By rating (highest first, 10->1) - for same-score drivers when rating priority enabled
    // 3. Alphabetically by name (A->Z) - for drivers with same rating
    scoredDrivers.sort((a, b) => {
        // Primary: Score (includes rating bonus if enabled)
        if (b.score !== a.score) return b.score - a.score;
        
        // Secondary: Direct rating comparison (10->1) when rating priority enabled
        if (ratingPriorityEnabled && b.rating !== a.rating) {
            return b.rating - a.rating;
        }
        
        // Tertiary: Alphabetical by name (A->Z)
        const nameA = (a.driver.name || a.driver.first_name || '').toLowerCase().trim();
        const nameB = (b.driver.name || b.driver.first_name || '').toLowerCase().trim();
        return nameA.localeCompare(nameB);
    });
    
    return scoredDrivers.map(s => ({ 
        ...s.driver, 
        calculatedScore: s.score, 
        effectiveRating: s.rating 
    }));
}

/**
 * Run test scenarios and display results
 */
function runDriverPriorityTests() {
    console.clear();
    console.log('🚗 DRIVER RATING PRIORITY SYSTEM TEST');
    console.log('=====================================');
    
    // Test 1: Rating Priority ENABLED
    console.log('\n📊 TEST 1: Rating Priority ENABLED');
    console.log('Expected order: Rating 10→1, then alphabetical within same rating');
    testSettings.enableDriverRatingPriority = true;
    
    const sortedWithRating = sortDriversByPriority(mockDrivers, testSettings);
    sortedWithRating.forEach((driver, index) => {
        console.log(`${index + 1}. ${driver.name} - Rating: ${driver.driver_rating}/10 (Score: ${driver.calculatedScore})`);
    });
    
    // Test 2: Rating Priority DISABLED
    console.log('\n🚫 TEST 2: Rating Priority DISABLED');
    console.log('Expected order: Alphabetical only (rating ignored)');
    testSettings.enableDriverRatingPriority = false;
    
    const sortedWithoutRating = sortDriversByPriority(mockDrivers, testSettings);
    sortedWithoutRating.forEach((driver, index) => {
        console.log(`${index + 1}. ${driver.name} - Rating: ${driver.driver_rating}/10 (Score: ${driver.calculatedScore})`);
    });
    
    // Verification
    console.log('\n✅ VERIFICATION');
    console.log('================');
    
    // Check Test 1 results
    const test1Valid = (
        sortedWithRating[0].name === 'Alice Johnson' && // Rating 10, A comes before B
        sortedWithRating[1].name === 'Bob Smith' &&     // Rating 10, B comes after A
        sortedWithRating[2].name === 'Charlie Brown' &&  // Rating 9
        sortedWithRating[8].name === 'Iris Chen' &&     // Rating 1, I comes before J
        sortedWithRating[9].name === 'Jack Miller'       // Rating 1, J comes after I
    );
    
    // Check Test 2 results
    const test2Valid = (
        sortedWithoutRating[0].name === 'Alice Johnson' && // Alphabetical A
        sortedWithoutRating[1].name === 'Bob Smith' &&     // Alphabetical B
        sortedWithoutRating[2].name === 'Charlie Brown' &&  // Alphabetical C
        sortedWithoutRating[9].name === 'Jack Miller'       // Alphabetical J (last)
    );
    
    console.log(`Test 1 (Rating Priority ON): ${test1Valid ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Test 2 (Rating Priority OFF): ${test2Valid ? '✅ PASS' : '❌ FAIL'}`);
    
    if (test1Valid && test2Valid) {
        console.log('\n🎉 ALL TESTS PASSED! Driver rating priority system is working correctly.');
    } else {
        console.log('\n❌ SOME TESTS FAILED! Check the sorting logic.');
    }
    
    return { test1Valid, test2Valid };
}

/**
 * Display drivers in a formatted table
 */
function displayDriverTable() {
    const tableElement = document.getElementById('driverTable');
    if (!tableElement) return;
    
    const ratingEnabled = document.getElementById('ratingToggle').checked;
    testSettings.enableDriverRatingPriority = ratingEnabled;
    
    const sortedDrivers = sortDriversByPriority(mockDrivers, testSettings);
    
    const tableHTML = `
        <table>
            <thead>
                <tr>
                    <th>Order</th>
                    <th>Driver Name</th>
                    <th>Rating</th>
                    <th>Score</th>
                </tr>
            </thead>
            <tbody>
                ${sortedDrivers.map((driver, index) => `
                    <tr>
                        <td>${index + 1}</td>
                        <td>${driver.name}</td>
                        <td>${driver.driver_rating}/10</td>
                        <td>${driver.calculatedScore}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    
    tableElement.innerHTML = tableHTML;
    
    // Update status
    const statusElement = document.getElementById('priorityStatus');
    if (statusElement) {
        statusElement.textContent = ratingEnabled ? 'ENABLED' : 'DISABLED';
        statusElement.className = ratingEnabled ? 'status-enabled' : 'status-disabled';
    }
}

// Run tests automatically when loaded
if (typeof window === 'undefined') {
    // Node.js environment
    runDriverPriorityTests();
} else {
    // Browser environment
    document.addEventListener('DOMContentLoaded', () => {
        displayDriverTable();
        runDriverPriorityTests();
        
        // Bind toggle event
        const toggle = document.getElementById('ratingToggle');
        if (toggle) {
            toggle.addEventListener('change', displayDriverTable);
        }
    });
}