// Test Driver Portal Registration Flow
// Run with: node test-driver-creation.js

const SUPABASE_URL = 'https://siumiadylwcrkaqsfwkj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpdW1pYWR5bHdjcmthcXNmd2tqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2NjMzMTMsImV4cCI6MjA4MTIzOTMxM30.sSZBsXyOOmIp2eve_SpiUGeIwx3BMoxvY4c7bvE2kKw';

async function testDriverCreation() {
  const randomNum = Math.floor(Math.random() * 10000);
  const email = `testdriver${randomNum}@example.com`;
  
  console.log('=== Testing Driver Portal Registration ===\n');
  
  // Step 1: Create Affiliate
  console.log('1. Creating new affiliate...');
  // Must use main org ID - FK constraint requires existing organization
  const mainOrgId = '54eb6ce7-ba97-4198-8566-6ac075828160';
  const affiliateData = {
    company_name: `Test Limo Co ${randomNum}`,
    organization_id: mainOrgId,
    status: 'ACTIVE',
    is_active: true,
    primary_address: '123 Test St',
    city: 'Minneapolis',
    state: 'MN',
    zip: '55401',
    phone: '+16125551234'
  };
  
  try {
    const affResponse = await fetch(`${SUPABASE_URL}/rest/v1/affiliates`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(affiliateData)
    });
    
    const affResult = await affResponse.json();
    
    if (!affResponse.ok) {
      console.log('❌ Affiliate creation failed:', affResult);
      return;
    }
    
    const affiliate = Array.isArray(affResult) ? affResult[0] : affResult;
    console.log('✅ Affiliate created:', affiliate.id, affiliate.company_name);
    console.log('   organization_id:', affiliate.organization_id);
    
    // Step 2: Create Driver
    console.log('\n2. Creating driver with affiliate org_id...');
    const driverData = {
      first_name: 'Test',
      last_name: `Driver${randomNum}`,
      email: email,
      cell_phone: '+15551234567',
      status: 'ACTIVE',
      driver_status: 'available',
      type: 'FULL TIME',
      organization_id: affiliate.organization_id,
      affiliate_id: affiliate.id,
      affiliate_name: affiliate.company_name,
      password_hash: Buffer.from(`testpass123_salt_${Date.now()}`).toString('base64')
    };
    
    const driverResponse = await fetch(`${SUPABASE_URL}/rest/v1/drivers`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(driverData)
    });
    
    const driverResult = await driverResponse.json();
    
    if (!driverResponse.ok) {
      console.log('❌ Driver creation failed:', driverResult);
      return;
    }
    
    const driver = Array.isArray(driverResult) ? driverResult[0] : driverResult;
    console.log('✅ Driver created:', driver.id, driver.first_name, driver.last_name);
    console.log('   email:', driver.email);
    console.log('   affiliate:', driver.affiliate_name);
    
    // Step 3: Create Vehicle
    console.log('\n3. Creating vehicle...');
    const vehicleData = {
      id: crypto.randomUUID(),
      organization_id: affiliate.organization_id,
      veh_disp_name: `TEST${randomNum}`,
      make: 'Toyota',
      model: 'Camry',
      year: 2024,
      color: 'Black',
      license_plate: `TEST${randomNum}`,
      status: 'AVAILABLE',
      is_active: true
    };
    
    const vehicleResponse = await fetch(`${SUPABASE_URL}/rest/v1/vehicles`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(vehicleData)
    });
    
    const vehicleResult = await vehicleResponse.json();
    
    if (!vehicleResponse.ok) {
      console.log('❌ Vehicle creation failed:', vehicleResult);
      return;
    }
    
    const vehicle = Array.isArray(vehicleResult) ? vehicleResult[0] : vehicleResult;
    console.log('✅ Vehicle created:', vehicle.id);
    console.log('   unit_number:', vehicle.unit_number);
    console.log('   license_plate:', vehicle.license_plate);
    
    // Step 4: Update driver with vehicle
    console.log('\n4. Linking vehicle to driver...');
    const updateResponse = await fetch(`${SUPABASE_URL}/rest/v1/drivers?id=eq.${driver.id}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({ assigned_vehicle_id: vehicle.id })
    });
    
    if (updateResponse.ok) {
      console.log('✅ Driver updated with vehicle assignment');
    } else {
      const updateErr = await updateResponse.json();
      console.log('⚠️ Driver update failed:', updateErr);
    }
    
    console.log('\n=== SUCCESS! Registration flow complete ===');
    console.log('Driver email:', email);
    console.log('Affiliate:', affiliate.company_name);
    console.log('Vehicle:', `${vehicle.year} ${vehicle.make} ${vehicle.model}`);
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

testDriverCreation();
