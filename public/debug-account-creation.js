// Debug script for account creation from reservation
// Run this in browser console on the reservation form page

console.clear();
console.log('🐛 Debug: Account Creation from Reservation');

function debugAccountCreation() {
  // 1. Check if the button exists
  const createBtn = document.getElementById('createAccountBtn');
  console.log('1️⃣ Create Account button found:', !!createBtn);
  if (createBtn) {
    console.log('   - Button text:', createBtn.textContent);
    console.log('   - Button visible:', createBtn.offsetParent !== null);
    console.log('   - Button disabled:', createBtn.disabled);
  }
  
  // 2. Check if the billing fields have data
  const billingFields = {
    firstName: document.getElementById('billingFirstName'),
    lastName: document.getElementById('billingLastName'),
    company: document.getElementById('billingCompany'),
    phone: document.getElementById('billingPhone'),
    email: document.getElementById('billingEmail')
  };
  
  console.log('2️⃣ Billing form fields:');
  Object.entries(billingFields).forEach(([name, element]) => {
    if (element) {
      console.log(`   - ${name}:`, element.value || '(empty)');
    } else {
      console.log(`   - ${name}: ELEMENT NOT FOUND`);
    }
  });
  
  // 3. Check if ReservationForm instance exists
  console.log('3️⃣ ReservationForm instance:', typeof window.reservationForm);
  if (window.reservationForm) {
    console.log('   - Has createAccountFromBilling method:', typeof window.reservationForm.createAccountFromBilling === 'function');
  }
  
  // 4. Test the method directly if it exists
  if (window.reservationForm && typeof window.reservationForm.createAccountFromBilling === 'function') {
    console.log('4️⃣ Testing createAccountFromBilling method...');
    try {
      window.reservationForm.createAccountFromBilling();
      console.log('   ✅ Method called successfully');
    } catch (error) {
      console.error('   ❌ Method failed:', error);
    }
  }
  
  // 5. Check localStorage for any existing drafts
  const existingDraft = localStorage.getItem('relia_account_draft');
  console.log('5️⃣ Existing account draft:', existingDraft ? 'EXISTS' : 'NOT FOUND');
  if (existingDraft) {
    try {
      const parsed = JSON.parse(existingDraft);
      console.log('   - Draft contents:', parsed);
    } catch (e) {
      console.log('   - Draft parsing error:', e.message);
    }
  }
  
  // 6. Simulate button click
  if (createBtn && window.reservationForm) {
    console.log('6️⃣ Simulating button click...');
    createBtn.click();
  }
}

// Fill some test data first
function fillTestData() {
  console.log('📝 Filling test billing data...');
  const fields = {
    billingFirstName: 'John',
    billingLastName: 'Doe', 
    billingEmail: 'john@test.com',
    billingPhone: '555-1234',
    billingCompany: 'Test Company'
  };
  
  Object.entries(fields).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) {
      element.value = value;
      console.log(`✅ Set ${id} to "${value}"`);
    } else {
      console.log(`❌ Element ${id} not found`);
    }
  });
}

// Run the debug
console.log('🧪 Running account creation debug...');
fillTestData();
setTimeout(() => {
  debugAccountCreation();
}, 500);