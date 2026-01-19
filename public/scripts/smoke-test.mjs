#!/usr/bin/env node
// scripts/smoke-test.mjs
// Smoke tests for: anon GET /vehicle_types, drivers list (if allowed), and Google Places Autocomplete
// Usage:
//   SUPABASE_URL="https://xyz.supabase.co" SUPABASE_ANON_KEY="ey..." GOOGLE_MAPS_API_KEY="AIza..." node scripts/smoke-test.mjs

import process from 'process';

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';
const TEST_QUERY = process.argv[2] || 'US Bank Stadium';

async function getFetch() {
  if (typeof globalThis.fetch !== 'undefined') return globalThis.fetch.bind(globalThis);
  try {
    const mod = await import('node-fetch');
    return mod.default;
  } catch (e) {
    throw new Error('No fetch available (Node <18) and node-fetch not installed. Please install node-fetch or use Node 18+.');
  }
}

function fail(msg) {
  console.error('❌', msg);
}
function pass(msg) {
  console.log('✅', msg);
}

async function testVehicleTypes(fetch) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    fail('SUPABASE_URL or SUPABASE_ANON_KEY not set; skipping vehicle_types test');
    return false;
  }

  const url = `${SUPABASE_URL}/rest/v1/vehicle_types?select=*&limit=5`;
  try {
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Accept: 'application/json'
      },
      method: 'GET'
    });

    if (!res.ok) {
      fail(`vehicle_types request failed: HTTP ${res.status} ${res.statusText}`);
      const txt = await res.text().catch(()=>null);
      if (txt) console.error(txt);
      return false;
    }

    const data = await res.json();
    pass(`vehicle_types: fetched ${Array.isArray(data)?data.length:typeof data} rows`);
    if (Array.isArray(data) && data.length) {
      console.log('  sample:', data.slice(0,3));
    }
    return true;
  } catch (e) {
    fail('vehicle_types request error: ' + e.message);
    return false;
  }
}

async function testDrivers(fetch) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    fail('SUPABASE_URL or SUPABASE_ANON_KEY not set; skipping drivers test');
    return null;
  }

  const url = `${SUPABASE_URL}/rest/v1/drivers?select=id,dispatch_display_name,first_name,last_name,status&limit=5`;
  try {
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Accept: 'application/json'
      },
      method: 'GET'
    });

    if (!res.ok) {
      console.warn(`drivers request returned ${res.status} ${res.statusText}. This may be expected if drivers are not publicly readable.`);
      const txt = await res.text().catch(()=>null);
      if (txt) console.warn('  response body:', txt);
      return false;
    }

    const data = await res.json();
    pass(`drivers: fetched ${Array.isArray(data)?data.length:typeof data} rows`);
    if (Array.isArray(data) && data.length) console.log('  sample:', data.slice(0,3));
    return true;
  } catch (e) {
    fail('drivers request error: ' + e.message);
    return false;
  }
}

async function testGoogleAutocomplete(fetch) {
  if (!GOOGLE_MAPS_API_KEY) {
    fail('GOOGLE_MAPS_API_KEY not set; skipping Google Places autocomplete test');
    return false;
  }

  const url = 'https://places.googleapis.com/v1/places:autocomplete';
  const body = {
    input: TEST_QUERY,
    sessionToken: `smoke_${Date.now()}`,
    languageCode: 'en'
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
        'X-Goog-FieldMask': 'suggestions.placePrediction.placeId,suggestions.placePrediction.text'
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const txt = await res.text().catch(()=>null);
      fail(`Google autocomplete failed: HTTP ${res.status} ${res.statusText} - ${txt || ''}`);
      return false;
    }

    const data = await res.json();
    const suggestions = Array.isArray(data?.suggestions) ? data.suggestions : [];
    if (suggestions.length) {
      pass(`Google autocomplete returned ${suggestions.length} suggestions for "${TEST_QUERY}"`);
      console.log('  sample:', suggestions.slice(0,3));
      return true;
    } else {
      fail(`Google autocomplete returned no suggestions for "${TEST_QUERY}"`);
      console.log('  raw response:', JSON.stringify(data, null, 2));
      return false;
    }
  } catch (e) {
    fail('Google autocomplete request error: ' + e.message);
    return false;
  }
}

(async () => {
  console.log('🧪 Running smoke tests...');
  const fetch = await getFetch();

  const vtOk = await testVehicleTypes(fetch);
  const drOk = await testDrivers(fetch);
  const googleOk = await testGoogleAutocomplete(fetch);

  const criticalOk = vtOk && googleOk;

  console.log('\nSummary:');
  console.log('  vehicle_types (anon read):', vtOk ? 'OK' : 'FAIL');
  console.log('  drivers (anon read):', drOk === true ? 'OK' : drOk === false ? 'DENIED/FAIL' : 'SKIPPED');
  console.log('  google autocomplete:', googleOk ? 'OK' : 'FAIL');

  if (!criticalOk) {
    console.error('❌ One or more critical tests failed. Fix the configuration and re-run.');
    process.exit(2);
  }

  console.log('✅ All critical smoke tests passed.');
  process.exit(0);
})();