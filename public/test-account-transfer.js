// Manual test to create account draft and check transfer
// Run this in browser console on reservation form, then navigate to accounts

console.clear();
console.log('🧪 Manual Account Transfer Test');

// Simulate creating a draft as would happen from createAccountFromBilling
const testDraft = {
  first_name: 'John',
  last_name: 'Doe', 
  company_name: 'Test Company',
  phone: '555-1234',
  cell_phone: '555-1234',
  email: 'john@test.com',
  type: 'individual',
  status: 'active',
  types: {
    billing: true,
    passenger: false,
    booking: false
  },
  address: {
    address_type: 'billing',
    address_name: 'Billing',
    address_line1: '123 Test St',
    address_line2: 'Suite 100',
    city: 'Test City',
    state: 'CA',
    zip: '12345',
    country: 'US'
  }
};

// Store the draft
localStorage.setItem('relia_account_draft', JSON.stringify(testDraft));
console.log('✅ Test draft stored:', testDraft);

// Check if we can retrieve it
const stored = localStorage.getItem('relia_account_draft');
console.log('🔍 Retrieved from storage:', stored);

// Show instructions
console.log(`
🎯 Next steps:
1. Navigate to: http://localhost:3000/accounts.html?mode=new&from=reservation
2. Check if the form gets auto-filled with the test data
3. Run the debug script to see what happened
`);

// Store return URL for testing
localStorage.setItem('relia_return_to_reservation_url', window.location.href);

console.log('🚀 Test setup complete! Navigate to accounts.html now');