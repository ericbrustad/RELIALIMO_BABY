// Test accounts functionality
// Run this in browser console to check account status

console.clear();
console.log('🔍 Testing accounts functionality...');

async function testAccounts() {
  try {
    console.log('1️⃣ Checking local storage for accounts...');
    const localAccounts = localStorage.getItem('accounts') || localStorage.getItem('local_accounts');
    if (localAccounts) {
      const parsed = JSON.parse(localAccounts);
      console.log('💾 Local accounts found:', parsed.length);
      console.log('📋 First few accounts:', parsed.slice(0, 3));
    } else {
      console.log('📭 No local accounts found in localStorage');
    }

    console.log('2️⃣ Testing database module for accounts...');
    const db = await import('./supabase-db.js');
    
    if (db.default && db.default.getAllAccounts) {
      console.log('📤 Calling getAllAccounts...');
      const accounts = await db.default.getAllAccounts();
      console.log('📤 getAllAccounts returned:', accounts ? accounts.length : 'null', 'accounts');
      
      if (accounts && accounts.length > 0) {
        console.log('✅ Accounts found:', accounts.length);
        console.log('📋 Sample accounts:', accounts.slice(0, 3));
      } else {
        console.log('📭 No accounts returned from database');
      }
    } else {
      console.error('❌ getAllAccounts method not found');
    }

    console.log('3️⃣ Testing account creation...');
    const testAccount = {
      account_number: 'TEST-' + Date.now(),
      first_name: 'Test',
      last_name: 'User',
      company_name: 'Test Company',
      phone: '555-1234',
      email: 'test@example.com'
    };

    if (db.default && db.default.saveAccount) {
      console.log('💾 Attempting to save test account...');
      const saveResult = await db.default.saveAccount(testAccount);
      console.log('💾 Save result:', saveResult);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testAccounts();