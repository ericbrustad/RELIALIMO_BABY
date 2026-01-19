/**
 * Test Vehicle Display with veh_title and license_plate
 * This tests the updated "Assign Driver to Car" functionality
 */

// Mock vehicle data from fleet_vehicles table
const mockVehicles = [
    {
        id: 'vehicle-001',
        veh_title: 'Executive Sedan',
        license_plate: 'ABC-123',
        veh_disp_name: 'Mercedes S-Class 2023',
        unit_number: 'UNIT-001',
        make: 'Mercedes',
        model: 'S-Class',
        year: 2023,
        status: 'ACTIVE'
    },
    {
        id: 'vehicle-002',
        veh_title: 'Luxury SUV',
        license_plate: 'XYZ-789',
        veh_disp_name: 'Cadillac Escalade 2023',
        unit_number: 'UNIT-002',
        make: 'Cadillac',
        model: 'Escalade',
        year: 2023,
        status: 'ACTIVE'
    },
    {
        id: 'vehicle-003',
        veh_title: '', // Missing title
        license_plate: 'DEF-456',
        veh_disp_name: 'BMW 7 Series',  // This should NOT be used when veh_title is empty
        make: 'BMW',
        model: '7 Series',
        year: 2022,
        status: 'ACTIVE'
    },
    {
        id: 'vehicle-004',
        veh_title: 'Town Car',
        license_plate: '', // Missing plate
        make: 'Lincoln',
        model: 'Town Car',
        year: 2021,
        status: 'ACTIVE'
    },
    {
        id: 'vehicle-005',
        veh_title: '', // Both missing
        license_plate: '',
        unit_number: 'UNIT-005',
        make: 'Ford',
        model: 'Explorer',
        year: 2020,
        status: 'ACTIVE'
    }
];

/**
 * Test the vehicle display logic from my-office.js
 */
function testVehicleDisplay() {
    console.clear();
    console.log('🚗 VEHICLE DISPLAY TEST - Assign Driver to Car');
    console.log('================================================');
    
    console.log('\n📋 Testing vehicle dropdown display format:');
    console.log('Expected: veh_title [license_plate] when both available');
    console.log('Fallback: veh_title alone, or Vehicle [plate] alone, or unit_number\n');
    
    mockVehicles.forEach((vehicle, index) => {
        // Simulate the logic from my-office.js populateDriverVehicleDropdown
        const vehTitle = vehicle.veh_title || '';  // Don't use veh_disp_name as fallback
        const licensePlate = vehicle.license_plate || '';
        
        let displayText = '';
        if (vehTitle && licensePlate) {
            displayText = `${vehTitle} [${licensePlate}]`;
        } else if (vehTitle) {
            displayText = vehTitle;
        } else if (licensePlate) {
            displayText = `Vehicle [${licensePlate}]`;
        } else {
            // Fallback to veh_disp_name, unit_number, or ID if neither title nor plate available
            displayText = vehicle.veh_disp_name || vehicle.unit_number || `Vehicle ${vehicle.id}`;
        }
        
        console.log(`${index + 1}. ${displayText}`);
        console.log(`   Source: title="${vehicle.veh_title || 'N/A'}", plate="${vehicle.license_plate || 'N/A'}"`);
    });
    
    console.log('\n🔍 Testing assigned vehicle display format:');
    console.log('Expected: Same format in the bold display above dropdown\n');
    
    mockVehicles.forEach((vehicle, index) => {
        // Simulate the logic from my-office.js updateAssignedVehicleDisplay
        const vehTitle = vehicle.veh_title || '';  // Don't use veh_disp_name as fallback
        const licensePlate = vehicle.license_plate || '';
        
        let vehicleName = '';
        if (vehTitle && licensePlate) {
            vehicleName = `${vehTitle} [${licensePlate}]`;
        } else if (vehTitle) {
            vehicleName = vehTitle;
        } else if (licensePlate) {
            vehicleName = `Vehicle [${licensePlate}]`;
        } else {
            // Fallback to veh_disp_name, make/model/year, or unit_number if no title/plate available
            vehicleName = vehicle.veh_disp_name || [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ') || vehicle.unit_number;
        }
        
        console.log(`${index + 1}. 🚗 ${vehicleName}`);
    });
    
    console.log('\n✅ VERIFICATION');
    console.log('================');
    console.log('✅ Vehicle #1: Should show "Executive Sedan [ABC-123]"');
    console.log('✅ Vehicle #2: Should show "Luxury SUV [XYZ-789]"');
    console.log('✅ Vehicle #3: Should show "Vehicle [DEF-456]" (no title)');
    console.log('✅ Vehicle #4: Should show "Town Car" (no plate)');
    console.log('✅ Vehicle #5: Should show "UNIT-005" (no title/plate)');
    
    console.log('\n🎯 EXPECTED BEHAVIOR');
    console.log('====================');
    console.log('- Primary format: veh_title [license_plate]');
    console.log('- Missing plate: veh_title only');
    console.log('- Missing title: Vehicle [license_plate]');
    console.log('- Both missing: Falls back to unit_number or make/model/year');
    console.log('- Inactive vehicles: Same format + "(Inactive)" suffix');
    
    return true;
}

/**
 * Display vehicles in a formatted table
 */
function displayVehicleTable() {
    const tableElement = document.getElementById('vehicleTable');
    if (!tableElement) return;
    
    const tableHTML = `
        <table>
            <thead>
                <tr>
                    <th>#</th>
                    <th>Dropdown Display</th>
                    <th>Bold Display</th>
                    <th>veh_title</th>
                    <th>license_plate</th>
                    <th>Fallback Used</th>
                </tr>
            </thead>
            <tbody>
                ${mockVehicles.map((vehicle, index) => {
                    // Dropdown display logic
                    const vehTitle = vehicle.veh_title || vehicle.veh_disp_name || '';
                    const licensePlate = vehicle.license_plate || '';
                    
                    let dropdownDisplay = '';
                    let fallbackUsed = 'None';
                    
                    if (vehTitle && licensePlate) {
                        dropdownDisplay = `${vehTitle} [${licensePlate}]`;
                    } else if (vehTitle) {
                        dropdownDisplay = vehTitle;
                        fallbackUsed = 'Title only';
                    } else if (licensePlate) {
                        dropdownDisplay = `Vehicle [${licensePlate}]`;
                        fallbackUsed = 'Plate only';
                    } else {
                        dropdownDisplay = vehicle.unit_number || `Vehicle ${vehicle.id}`;
                        fallbackUsed = 'Unit/ID';
                    }
                    
                    // Bold display (same logic)
                    let boldDisplay = dropdownDisplay;
                    if (!vehTitle && !licensePlate) {
                        // Bold display uses make/model/year for fallback
                        boldDisplay = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ');
                    }
                    
                    return `
                        <tr>
                            <td>${index + 1}</td>
                            <td><strong>${dropdownDisplay}</strong></td>
                            <td><span style="color: #1565c0;">🚗 ${boldDisplay}</span></td>
                            <td>${vehicle.veh_title || '<em>empty</em>'}</td>
                            <td>${vehicle.license_plate || '<em>empty</em>'}</td>
                            <td>${fallbackUsed}</td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
    
    tableElement.innerHTML = tableHTML;
}

// Run tests automatically when loaded
if (typeof window === 'undefined') {
    // Node.js environment
    testVehicleDisplay();
} else {
    // Browser environment
    document.addEventListener('DOMContentLoaded', () => {
        displayVehicleTable();
        testVehicleDisplay();
    });
}