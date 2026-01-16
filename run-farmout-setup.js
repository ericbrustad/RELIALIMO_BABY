// Run farmout setup SQL via Supabase
const https = require('https');

const SUPABASE_URL = 'siumiadylwcrkaqsfwkj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpdW1pYWR5bHdjcmthcXNmd2tqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTY2MzMxMywiZXhwIjoyMDgxMjM5MzEzfQ.AwUvDEQNb_U04OveQ6Ia9wFgoIatwV6wigdwSQnsOP4';

async function runSQL(sql) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({ query: sql });
        
        const options = {
            hostname: SUPABASE_URL,
            port: 443,
            path: '/rest/v1/rpc/exec_sql',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Length': data.length
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(body);
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${body}`));
                }
            });
        });

        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

async function insertViaRest(table, data) {
    return new Promise((resolve, reject) => {
        const jsonData = JSON.stringify(data);
        
        const options = {
            hostname: SUPABASE_URL,
            port: 443,
            path: `/rest/v1/${table}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Prefer': 'return=representation',
                'Content-Length': Buffer.byteLength(jsonData)
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                console.log(`  Status: ${res.statusCode}`);
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(JSON.parse(body || '[]'));
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${body}`));
                }
            });
        });

        req.on('error', reject);
        req.write(jsonData);
        req.end();
    });
}

async function queryRest(table, select = '*') {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: SUPABASE_URL,
            port: 443,
            path: `/rest/v1/${table}?select=${encodeURIComponent(select)}`,
            method: 'GET',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(JSON.parse(body || '[]'));
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${body}`));
                }
            });
        });

        req.on('error', reject);
        req.end();
    });
}

async function main() {
    console.log('🔧 Setting up Farmout Automation...\n');

    // Step 1: Create organization
    console.log('1. Creating organization...');
    try {
        const org = await insertViaRest('organizations', {
            id: 'a0000000-0000-0000-0000-000000000001',
            name: 'RELIA LIMO',
            email: 'info@relialimo.com',
            phone: '+17632838336',  // Production phone number
            timezone: 'America/Chicago'
        });
        console.log('   ✅ Organization created:', org[0]?.name || 'RELIA LIMO');
    } catch (err) {
        if (err.message.includes('duplicate') || err.message.includes('23505')) {
            console.log('   ⏭️ Organization already exists');
        } else {
            console.log('   ⚠️', err.message);
        }
    }

    // Step 2: Check existing reservations
    console.log('\n2. Checking existing reservations...');
    try {
        const reservations = await queryRest('reservations', 'id,confirmation_number,status,farmout_status');
        console.log(`   Found ${reservations.length} reservations`);
        if (reservations.length > 0) {
            console.log('   Existing:', reservations.map(r => r.confirmation_number).join(', '));
        }
    } catch (err) {
        console.log('   ⚠️', err.message);
    }

    // Step 3: Create test reservation (without foreign key constraint issues)
    console.log('\n3. Creating test reservation...');
    try {
        const testRes = await insertViaRest('reservations', {
            organization_id: 'a0000000-0000-0000-0000-000000000001',
            confirmation_number: 'FARM-' + Math.floor(Math.random() * 100000),
            booked_by_user_id: '00000000-0000-0000-0000-000000000000',
            status: 'pending',
            trip_type: 'one_way',
            pickup_address: '123 Main St',
            pickup_city: 'Seattle',
            pickup_state: 'WA',
            pickup_datetime: new Date(Date.now() + 86400000).toISOString(), // tomorrow
            dropoff_address: 'SEA Airport',
            dropoff_city: 'SeaTac',
            dropoff_state: 'WA',
            passenger_count: 1,
            farmout_status: 'searching'
        });
        console.log('   ✅ Test reservation created:', testRes[0]?.confirmation_number);
    } catch (err) {
        console.log('   ❌ Error:', err.message);
        
        // If foreign key error, we need to work around it
        if (err.message.includes('violates foreign key') || err.message.includes('23503')) {
            console.log('\n   💡 Foreign key constraint issue - will need to run SQL directly in dashboard');
        }
    }

    // Step 4: Verify farmout columns exist
    console.log('\n4. Verifying farmout columns...');
    try {
        const res = await queryRest('reservations', 'farmout_status,assigned_driver_id,farmout_attempts');
        console.log('   ✅ Farmout columns exist!');
    } catch (err) {
        console.log('   ❌ Farmout columns missing:', err.message);
    }

    // Step 5: Check drivers available for farmout
    console.log('\n5. Checking available drivers...');
    try {
        const drivers = await queryRest('drivers', 'id,first_name,last_name,email,status');
        console.log(`   Found ${drivers.length} drivers:`);
        drivers.forEach(d => console.log(`   - ${d.first_name} ${d.last_name} (${d.email})`));
    } catch (err) {
        console.log('   ⚠️', err.message);
    }

    console.log('\n✅ Setup complete!');
}

main().catch(console.error);
