// Direct Supabase API test
const https = require('https');

const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpdW1pYWR5bHdjcmthcXNmd2tqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTY2MzMxMywiZXhwIjoyMDgxMjM5MzEzfQ.AwUvDEQNb_U04OveQ6Ia9wFgoIatwV6wigdwSQnsOP4';

const payload = {
  confirmation_number: 'TEST-' + Math.floor(Math.random() * 10000),
  status: 'pending',
  passenger_name: 'Test User',
  vehicle_type: 'Black Sedan',
  pickup_datetime: '2026-01-20T10:30',
  pickup_address: '123 Main St',
  pickup_city: 'Minneapolis',
  pickup_state: 'MN',
  pickup_zip: '55401',
  organization_id: '54eb6ce7-ba97-4198-8566-6ac075828160',
  booked_by_user_id: '99d34cd5-a593-4362-9846-db7167276592',
  grand_total: 75.00
};

console.log('Sending payload:', JSON.stringify(payload, null, 2));

const data = JSON.stringify(payload);

const options = {
  hostname: 'siumiadylwcrkaqsfwkj.supabase.co',
  port: 443,
  path: '/rest/v1/reservations',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': serviceKey,
    'Authorization': 'Bearer ' + serviceKey,
    'Prefer': 'return=representation',
    'Content-Length': data.length
  }
};

const req = https.request(options, (res) => {
  console.log('Status:', res.statusCode);
  
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('Response:', body);
    if (res.statusCode >= 200 && res.statusCode < 300) {
      console.log('✅ SUCCESS');
    } else {
      console.log('❌ FAILED');
    }
  });
});

req.on('error', (e) => {
  console.error('Request error:', e.message);
});

req.write(data);
req.end();
