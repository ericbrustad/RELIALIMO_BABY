// Remove test reservations from localStorage
// Run this in browser console to clean up test data

console.clear();
console.log('🧹 Removing test reservations...');

function removeTestReservations() {
  try {
    // Get current reservations from localStorage
    const localReservations = JSON.parse(localStorage.getItem('local_reservations') || '[]');
    console.log('📊 Current reservations:', localReservations.length);
    
    if (localReservations.length === 0) {
      console.log('📭 No reservations found to remove');
      return;
    }
    
    // Show current test reservations
    const testReservations = localReservations.filter(r => 
      r.confirmation_number && r.confirmation_number.startsWith('TEST-')
    );
    console.log('🎯 Test reservations found:', testReservations.length);
    testReservations.forEach(r => {
      console.log('  - ' + r.confirmation_number);
    });
    
    // Filter out test reservations
    const cleanedReservations = localReservations.filter(r => 
      !r.confirmation_number || !r.confirmation_number.startsWith('TEST-')
    );
    
    // Update localStorage
    localStorage.setItem('local_reservations', JSON.stringify(cleanedReservations));
    
    console.log('✅ Cleanup complete!');
    console.log('📊 Reservations after cleanup:', cleanedReservations.length);
    console.log('🗑️ Removed reservations:', localReservations.length - cleanedReservations.length);
    
    if (cleanedReservations.length > 0) {
      console.log('📋 Remaining reservations:');
      cleanedReservations.forEach(r => {
        console.log('  - ' + (r.confirmation_number || r.id || 'Unknown'));
      });
    }
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  }
}

removeTestReservations();