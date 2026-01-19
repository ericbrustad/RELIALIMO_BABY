/**
 * Migration Script: Copy localStorage reservations to Supabase
 * Run this with: node migrate-local-reservations.js
 * 
 * BEFORE RUNNING: Export localStorage data by running this in browser console:
 * copy(JSON.stringify({
 *   dev: JSON.parse(localStorage.getItem('dev_reservations') || '[]'),
 *   local: JSON.parse(localStorage.getItem('local_reservations') || '[]'),
 *   relia: JSON.parse(localStorage.getItem('relia_reservations') || '[]'),
 *   reliaDev: JSON.parse(localStorage.getItem('relia_dev_reservations') || '[]')
 * }))
 * 
 * Then paste into local-reservations-export.json file
 */

const fs = require('fs');

// Configuration
const SUPABASE_URL = 'https://siumiadylwcrkaqsfwkj.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpdW1pYWR5bHdjcmthcXNmd2tqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTY2MzMxMywiZXhwIjoyMDgxMjM5MzEzfQ.AwUvDEQNb_U04OveQ6Ia9wFgoIatwV6wigdwSQnsOP4';

// Required fields for the reservations table
const ORGANIZATION_ID = 'a0000000-0000-0000-0000-000000000001'; // RELIA LIMO
const BOOKED_BY_USER_ID = '99d34cd5-a593-4362-9846-db7167276592'; // admin user

// Field mapping from localStorage format to Supabase schema
function mapReservationToSupabase(localRes) {
  // Generate a proper UUID if the ID is not valid
  const needsNewId = !localRes.id || 
    localRes.id.startsWith('dev-') || 
    localRes.id.startsWith('local-') ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(localRes.id);

  return {
    // Only include id if it's a valid UUID
    ...(needsNewId ? {} : { id: localRes.id }),
    
    // Required fields
    organization_id: ORGANIZATION_ID,
    booked_by_user_id: BOOKED_BY_USER_ID,
    confirmation_number: localRes.confirmation_number || localRes.confirmationNumber,
    
    // Status
    status: localRes.status || 'pending',
    
    // Trip info
    trip_type: localRes.trip_type || localRes.tripType,
    
    // Pickup info - map various field names
    pickup_address: localRes.pickup_address || localRes.pickupAddress || localRes.pickup_location || localRes.pickupLocation,
    pickup_city: localRes.pickup_city,
    pickup_state: localRes.pickup_state,
    pickup_datetime: formatDateTime(localRes.pickup_datetime || localRes.pickupDatetime || localRes.pickup_date, localRes.pickup_time),
    
    // Dropoff info
    dropoff_address: localRes.dropoff_address || localRes.dropoffAddress || localRes.dropoff_location || localRes.dropoffLocation,
    dropoff_city: localRes.dropoff_city,
    dropoff_state: localRes.dropoff_state,
    dropoff_datetime: formatDateTime(localRes.dropoff_datetime, localRes.dropoff_time),
    
    // Passenger info - note: schema uses special_instructions, not passenger_name directly
    passenger_count: localRes.passenger_count || localRes.passengerCount || localRes.passengers || 1,
    special_instructions: buildSpecialInstructions(localRes),
    
    // Rate info
    rate_type: localRes.rate_type,
    rate_amount: localRes.rate_amount || localRes.rate || localRes.price,
    
    // Notes
    notes: localRes.notes || localRes.internal_notes,
    
    // Timestamps
    created_at: localRes.created_at || localRes.createdAt || new Date().toISOString(),
    updated_at: localRes.updated_at || localRes.updatedAt || new Date().toISOString()
  };
}

function formatDateTime(date, time) {
  if (!date) return null;
  
  // If already a full datetime string
  if (date.includes('T') || date.includes(' ')) {
    return date;
  }
  
  // Combine date and time
  if (time) {
    return `${date}T${time}:00`;
  }
  
  return `${date}T00:00:00`;
}

function buildSpecialInstructions(res) {
  const parts = [];
  
  // Add passenger name if present
  if (res.passenger_name || res.passengerName) {
    parts.push(`Passenger: ${res.passenger_name || res.passengerName}`);
  }
  if (res.passenger_first_name || res.passenger_last_name) {
    const name = [res.passenger_first_name, res.passenger_last_name].filter(Boolean).join(' ');
    if (name) parts.push(`Passenger: ${name}`);
  }
  
  // Add phone if present
  if (res.passenger_phone || res.passengerPhone || res.phone) {
    parts.push(`Phone: ${res.passenger_phone || res.passengerPhone || res.phone}`);
  }
  
  // Add email if present
  if (res.passenger_email || res.email) {
    parts.push(`Email: ${res.passenger_email || res.email}`);
  }
  
  // Add existing special instructions
  if (res.special_instructions) {
    parts.push(res.special_instructions);
  }
  
  return parts.join('\n') || null;
}

async function insertReservation(reservation) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/reservations`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(reservation)
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }
  
  return response.json();
}

async function checkExistingReservation(confirmationNumber) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/reservations?confirmation_number=eq.${encodeURIComponent(confirmationNumber)}&select=id`,
    {
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
      }
    }
  );
  
  if (!response.ok) return false;
  
  const data = await response.json();
  return data.length > 0;
}

async function migrate() {
  console.log('🚀 Starting localStorage to Supabase migration...\n');
  
  // Check if export file exists
  const exportPath = './local-reservations-export.json';
  if (!fs.existsSync(exportPath)) {
    console.log('❌ Export file not found: local-reservations-export.json');
    console.log('\n📋 To create the export file, run this in your browser console:\n');
    console.log(`copy(JSON.stringify({
  dev: JSON.parse(localStorage.getItem('dev_reservations') || '[]'),
  local: JSON.parse(localStorage.getItem('local_reservations') || '[]'),
  relia: JSON.parse(localStorage.getItem('relia_reservations') || '[]'),
  reliaDev: JSON.parse(localStorage.getItem('relia_dev_reservations') || '[]')
}))`);
    console.log('\nThen paste into local-reservations-export.json and run this script again.');
    return;
  }
  
  // Read export file
  const exportData = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
  
  // Collect all reservations from different localStorage keys
  const allReservations = [
    ...(exportData.dev || []),
    ...(exportData.local || []),
    ...(exportData.relia || []),
    ...(exportData.reliaDev || [])
  ];
  
  // Deduplicate by confirmation_number
  const seen = new Set();
  const uniqueReservations = allReservations.filter(r => {
    const confNum = r.confirmation_number || r.confirmationNumber;
    if (!confNum || seen.has(confNum)) return false;
    seen.add(confNum);
    return true;
  });
  
  console.log(`📊 Found ${uniqueReservations.length} unique reservations to migrate\n`);
  
  let migrated = 0;
  let skipped = 0;
  let failed = 0;
  
  for (const localRes of uniqueReservations) {
    const confNum = localRes.confirmation_number || localRes.confirmationNumber;
    
    try {
      // Check if already exists
      const exists = await checkExistingReservation(confNum);
      if (exists) {
        console.log(`⏭️  Skipping ${confNum} - already exists in Supabase`);
        skipped++;
        continue;
      }
      
      // Map to Supabase schema
      const mappedRes = mapReservationToSupabase(localRes);
      
      // Insert
      const result = await insertReservation(mappedRes);
      console.log(`✅ Migrated ${confNum} → ${result[0]?.id || 'created'}`);
      migrated++;
      
    } catch (error) {
      console.error(`❌ Failed to migrate ${confNum}: ${error.message}`);
      failed++;
    }
  }
  
  console.log('\n📈 Migration Summary:');
  console.log(`   ✅ Migrated: ${migrated}`);
  console.log(`   ⏭️  Skipped:  ${skipped}`);
  console.log(`   ❌ Failed:   ${failed}`);
  console.log(`   📊 Total:    ${uniqueReservations.length}`);
}

migrate().catch(console.error);
