// Debug script to test account information transfer
// Run this in browser console to check if draft is being stored properly

console.clear();
console.log('🐛 Debug: Account Transfer Issue');

function checkAccountTransfer() {
  // Check if draft exists in localStorage
  const draft = localStorage.getItem('relia_account_draft');
  console.log('1️⃣ Account draft in localStorage:', draft);
  
  if (draft) {
    try {
      const parsed = JSON.parse(draft);
      console.log('2️⃣ Parsed draft:', parsed);
      console.log('3️⃣ Draft has required fields:', {
        first_name: parsed.first_name || 'MISSING',
        last_name: parsed.last_name || 'MISSING', 
        email: parsed.email || 'MISSING',
        types: parsed.types || 'MISSING'
      });
    } catch (e) {
      console.error('❌ Failed to parse draft:', e);
    }
  } else {
    console.log('❌ No account draft found in localStorage');
  }
  
  // Check if we're on accounts.html
  const isAccountsPage = window.location.pathname.includes('accounts.html');
  console.log('4️⃣ On accounts page:', isAccountsPage);
  
  if (isAccountsPage) {
    // Check if fields are populated
    const fields = {
      firstName: document.getElementById('acctFirstName'),
      lastName: document.getElementById('acctLastName'), 
      company: document.getElementById('acctCompany'),
      email: document.getElementById('acctEmail2'),
      cellPhone: document.getElementById('acctCellPhone1'),
      billingType: document.getElementById('acctTypeBilling'),
      passengerType: document.getElementById('acctTypePassenger'),
      bookingType: document.getElementById('acctTypeBooking')
    };
    
    console.log('5️⃣ Account form field values:', Object.fromEntries(
      Object.entries(fields).map(([key, el]) => [
        key, 
        el ? (el.type === 'checkbox' ? el.checked : el.value) : 'ELEMENT_NOT_FOUND'
      ])
    ));
  }
  
  // Show URL parameters
  const params = new URLSearchParams(window.location.search);
  console.log('6️⃣ URL parameters:', Object.fromEntries(params));
  
  return {
    hasDraft: !!draft,
    isAccountsPage,
    urlParams: Object.fromEntries(params)
  };
}

// Run the check
const result = checkAccountTransfer();
console.log('🔍 Debug result:', result);

// If we're testing from reservation form, also check current billing form values
if (window.location.pathname.includes('reservation-form.html')) {
  console.log('📝 Current billing form values:');
  const billingFields = {
    firstName: document.getElementById('billingFirstName'),
    lastName: document.getElementById('billingLastName'),
    company: document.getElementById('billingCompany'),
    phone: document.getElementById('billingPhone'),
    email: document.getElementById('billingEmail')
  };
  
  console.log('📊 Billing values:', Object.fromEntries(
    Object.entries(billingFields).map(([key, el]) => [
      key, el ? el.value : 'ELEMENT_NOT_FOUND'
    ])
  ));
}