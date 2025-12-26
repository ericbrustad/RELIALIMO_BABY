// Delete specific reservations by ID
// Run this in browser console to remove the listed reservations

console.clear();
console.log('🗑️ Deleting specific reservations...');

// List of reservation IDs to delete
const reservationIdsToDelete = [
  22398, 22395, 22363, 22307, 22322, 22383, 22342, 22367, 
  22433, 22435, 22412, 22366, 22415, 22448, 22333
];

async function deleteSpecificReservations() {
  try {
    console.log('🎯 Target reservation IDs:', reservationIdsToDelete);
    
    // Try to delete from Supabase first (if available)
    if (window.apiService && window.apiService.deleteReservation) {
      console.log('💾 Attempting to delete from Supabase...');
      for (const id of reservationIdsToDelete) {
        try {
          const result = await window.apiService.deleteReservation(id);
          console.log(`✅ Deleted reservation ${id} from Supabase:`, result);
        } catch (error) {
          console.warn(`⚠️ Failed to delete reservation ${id} from Supabase:`, error.message);
        }
      }
    } else {
      console.log('⚠️ Supabase API not available, proceeding with localStorage only');
    }
    
    // Clean up from localStorage
    console.log('🧹 Cleaning from localStorage...');
    const localReservations = JSON.parse(localStorage.getItem('local_reservations') || '[]');
    console.log('📊 Current local reservations:', localReservations.length);
    
    if (localReservations.length === 0) {
      console.log('📭 No local reservations found');
      return;
    }
    
    // Show reservations to be deleted
    const toDelete = localReservations.filter(r => 
      reservationIdsToDelete.includes(parseInt(r.id)) || 
      reservationIdsToDelete.includes(parseInt(r.confirmation_number))
    );
    console.log('🎯 Local reservations to delete:', toDelete.length);
    toDelete.forEach(r => {
      console.log(`  - ID: ${r.id}, Conf: ${r.confirmation_number}, Name: ${r.passenger_first_name} ${r.passenger_last_name}`);
    });
    
    // Filter out the reservations to delete
    const cleanedReservations = localReservations.filter(r => 
      !reservationIdsToDelete.includes(parseInt(r.id)) && 
      !reservationIdsToDelete.includes(parseInt(r.confirmation_number))
    );
    
    // Update localStorage
    localStorage.setItem('local_reservations', JSON.stringify(cleanedReservations));
    
    console.log('✅ Deletion complete!');
    console.log('📊 Reservations before cleanup:', localReservations.length);
    console.log('📊 Reservations after cleanup:', cleanedReservations.length);
    console.log('🗑️ Deleted reservations:', localReservations.length - cleanedReservations.length);
    
    if (cleanedReservations.length > 0) {
      console.log('📋 Remaining reservations:');
      cleanedReservations.forEach(r => {
        console.log(`  - ID: ${r.id}, Conf: ${r.confirmation_number || 'N/A'}, Name: ${r.passenger_first_name} ${r.passenger_last_name}`);
      });
    } else {
      console.log('📭 No reservations remaining');
    }
    
    // Refresh the page if we're on reservations list
    if (window.location.pathname.includes('index') || window.location.pathname.includes('reservations')) {
      console.log('🔄 Refreshing page to update display...');
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
    
  } catch (error) {
    console.error('❌ Error during deletion:', error);
  }
}

// Also create a Supabase deletion function if API is available
async function deleteFromSupabaseDirectly() {
  console.log('🌐 Attempting direct Supabase deletion...');
  
  const supabaseUrl = 'https://siumiadylwcrkaqsfwkj.supabase.co';
  const apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpdW1pYWR5bHdjcmthcXNmd2tqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2NjMzMTMsImV4cCI6MjA4MTIzOTMxM30.sSZBsXyOOmIp2eve_SpiUGeIwx3BMoxvY4c7bvE2kKw';
  
  for (const id of reservationIdsToDelete) {
    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/reservations?id=eq.${id}`, {
        method: 'DELETE',
        headers: {
          'apikey': apiKey,
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log(`✅ Deleted reservation ${id} from Supabase directly:`, result);
      } else {
        console.warn(`⚠️ Failed to delete reservation ${id}: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.warn(`❌ Error deleting reservation ${id}:`, error.message);
    }
  }
}

// Run the deletion
console.log('🚀 Starting reservation deletion process...');
deleteSpecificReservations();

// Also try direct Supabase deletion
setTimeout(() => {
  deleteFromSupabaseDirectly();
}, 2000);