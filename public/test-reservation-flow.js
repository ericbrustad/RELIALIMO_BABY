// Test the full reservation save flow
// Run with: node test-reservation-flow.js

const testPayload = {
  confirmationNumber: 'TEST-8001',
  confirmation_number: 'TEST-8001',
  status: 'pending',
  passenger: { firstName: 'Test', lastName: 'User' },
  passenger_name: 'Test User',
  vehicle_type: 'Black Sedan',
  pickupDateTime: '2026-01-20T10:30',
  routing: {
    stops: [
      { stopType: 'pickup', address1: '123 Main St', city: 'Minneapolis', state: 'MN', zipCode: '55401' },
      { stopType: 'dropoff', address1: '456 Oak Ave', city: 'St Paul', state: 'MN', zipCode: '55102' }
    ],
    tripNotes: 'Test notes'
  },
  details: { status: 'pending', puDate: '2026-01-20', puTime: '10:30', farmOption: 'in-house' },
  grand_total: 75.00,
  payment_type: 'credit_card',
  farmOption: 'in-house',
  formSnapshot: { invalid: 'data' },
  billingAccount: { company: 'Test Corp' }
};

const VALID_COLS = new Set(['id','organization_id','confirmation_number','status','account_id','passenger_name','passenger_count','vehicle_type','trip_type','pickup_datetime','pickup_address','pickup_city','pickup_state','pickup_zip','pickup_lat','pickup_lon','dropoff_datetime','dropoff_address','dropoff_city','dropoff_state','dropoff_zip','dropoff_lat','dropoff_lon','pu_address','do_address','assigned_driver_id','assigned_driver_name','driver_status','grand_total','rate_type','rate_amount','payment_type','currency','farmout_status','farmout_mode','farmout_notes','farmout_attempts','farmout_declined_drivers','current_offer_driver_id','current_offer_sent_at','current_offer_expires_at','notes','special_instructions','timezone','created_at','updated_at','created_by','updated_by','booked_by_user_id']);

function transform(p) {
  const r = {};
  for (const [k,v] of Object.entries(p)) { if (VALID_COLS.has(k) && v !== undefined && v !== null && v !== '') r[k] = v; }
  if (p.confirmationNumber) r.confirmation_number = p.confirmationNumber;
  if (p.pickupDateTime) r.pickup_datetime = p.pickupDateTime;
  if (p.grandTotal) r.grand_total = p.grandTotal;
  if (p.farmOption) r.farmout_mode = p.farmOption === 'in-house' ? 'in_house' : p.farmOption;
  if (p.passenger) { const name = `${p.passenger.firstName||''} ${p.passenger.lastName||''}`.trim(); if (name) r.passenger_name = name; }
  if (p.routing?.stops?.length > 0) {
    const pu = p.routing.stops[0];
    if (pu) { r.pickup_address = pu.address1; r.pickup_city = pu.city; r.pickup_state = pu.state; r.pickup_zip = pu.zipCode; r.pu_address = [pu.address1,pu.city,pu.state,pu.zipCode].filter(Boolean).join(', '); }
    if (p.routing.stops.length > 1) { const dr = p.routing.stops[p.routing.stops.length-1]; r.dropoff_address = dr.address1; r.dropoff_city = dr.city; r.dropoff_state = dr.state; r.dropoff_zip = dr.zipCode; r.do_address = [dr.address1,dr.city,dr.state,dr.zipCode].filter(Boolean).join(', '); }
  }
  if (p.routing?.tripNotes) r.notes = p.routing.tripNotes;
  if (p.details) { if (p.details.puDate && p.details.puTime) r.pickup_datetime = `${p.details.puDate}T${p.details.puTime}`; if (p.details.farmOption) r.farmout_mode = p.details.farmOption === 'in-house' ? 'in_house' : p.details.farmOption; }
  r.organization_id = '54eb6ce7-ba97-4198-8566-6ac075828160';
  if (r.account_id === '') delete r.account_id;
  return r;
}

const result = transform(testPayload);
console.log('=== TRANSFORMED ===');
console.log(JSON.stringify(result, null, 2));

const invalid = Object.keys(result).filter(k => !VALID_COLS.has(k));
console.log(invalid.length ? '❌ Invalid: ' + invalid.join(', ') : '✅ All columns valid');

const expected = ['confirmation_number','passenger_name','vehicle_type','pickup_datetime','pickup_address','dropoff_address','grand_total','organization_id'];
const missing = expected.filter(f => !result[f]);
console.log(missing.length ? '⚠️ Missing: ' + missing.join(', ') : '✅ All expected fields present');
