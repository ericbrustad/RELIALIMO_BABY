// Simple test reservation save functionality
// Run this in browser console to debug the save flow

console.clear(); // Clear console for cleaner output
console.log('🧪 Starting reservation save test...');

async function testReservationSave() {
  try {
    console.log('1️⃣ Testing basic localStorage fallback...');
    
    // Test localStorage directly first
    const testData = {
      id: `local-test-${Date.now()}`,
      confirmation_number: `TEST-${Date.now()}`,
      status: 'pending',
      pickup_address: 'Test Address',
      created_at: new Date().toISOString()
    };
    
    const existing = JSON.parse(localStorage.getItem('local_reservations') || '[]');
    existing.push(testData);
    localStorage.setItem('local_reservations', JSON.stringify(existing));
    
    console.log('✅ Direct localStorage test successful');
    console.log('💾 Local reservations:', existing.length);
    
    console.log('2️⃣ Testing module import...');
    
    // Test if we can import the modules at all
    let db;
    try {
      db = await import('./supabase-db.js');
      console.log('✅ supabase-db.js imported:', !!db.default);
      console.log('📋 Available methods:', Object.keys(db.default || {}));
    } catch (importError) {
      console.error('❌ Import failed:', importError);
      console.log('🔍 Import error details:', importError.message);
      console.log('🔍 Import error stack:', importError.stack);
      return;
    }

    console.log('3️⃣ Testing saveReservation method...');
    
    const testReservation = {
      confirmationNumber: `TEST-${Date.now()}`,
      status: 'pending',
      pickup_location: 'Test Pickup',
      passenger_count: 1
    };

    if (db.default && db.default.saveReservation) {
      console.log('📤 Calling saveReservation...');
      const result = await db.default.saveReservation(testReservation);
      console.log('📤 saveReservation returned:', result);
      console.log('📊 Result type:', typeof result);
      console.log('📋 Result details:', JSON.stringify(result, null, 2));
      
      if (result && result.success === false) {
        console.error('🚫 Save operation failed:', result.error);
      } else if (result) {
        console.log('✅ Save operation appears successful!');
      } else {
        console.error('❌ Save returned null/undefined - this is the issue!');
      }
    } else {
      console.error('❌ saveReservation method not found in db.default');
      console.log('🔍 db.default contents:', db.default);
    }

    console.log('4️⃣ Test complete!');

  } catch (error) {
    console.error('❌ Test failed with error:', error);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
  }
}

// Run with explicit promise handling
console.log('🚀 Starting test...');
testReservationSave().then(() => {
  console.log('🏁 Test completed successfully');
}).catch(error => {
  console.error('💥 Test failed:', error);
});