const express = require('express');
const path = require('path');
const cors = require('cors');
require('dotenv').config(); // Load .env first
require('dotenv').config({ path: '.env.local', override: true }); // Then override with .env.local

const app = express();
const PORT = process.env.PORT || 3002; // Changed port to avoid conflicts

// Add basic error handling
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err.message);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

console.log('🔧 Starting server with Node.js version:', process.version);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Email API endpoint
app.post('/api/email-send', async (req, res) => {
  console.log('📧 Email API called');
  
  try {
    const { to, subject, html, text } = req.body || {};
    
    console.log('📧 Request data:', { to, subject, hasHtml: !!html, hasText: !!text });
    
    if (!to || !subject || (!html && !text)) {
      console.log('❌ Missing required fields');
      return res.status(400).json({ error: "Missing to/subject/html|text" });
    }

    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;

    console.log('🔑 Environment check:', { hasApiKey: !!apiKey, hasFrom: !!from });

    if (!apiKey || !from) {
      console.log('⚠️ Missing email credentials in .env');
      return res.status(500).json({ 
        error: "Missing RESEND_API_KEY or EMAIL_FROM in .env file",
        hint: "Edit .env file with your email provider credentials"
      });
    }

    console.log('📤 Sending real email via Resend API...');
    
    // Send real email via Resend API
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html, text }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('❌ Resend API error:', data);
      return res.status(response.status).json(data);
    }

    console.log('✅ Email sent successfully! ID:', data.id);
    return res.status(200).json({ ok: true, id: data.id });

  } catch (e) {
    console.error('❌ Email send error:', e);
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// SMS API endpoint (server-side Twilio proxy; avoids CORS + keeps secrets off the browser)
app.post('/api/sms-send', async (req, res) => {
  console.log('📱 SMS API called');
  try {
    const { to, body } = req.body || {};
    if (!to || !body) {
      return res.status(400).json({ error: "Missing to/body" });
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const apiKeySid = process.env.TWILIO_API_KEY_SID;
    const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;
    const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
    const fromNumber = process.env.TWILIO_FROM_NUMBER;

    const hasCreds = !!accountSid && (!!authToken || (!!apiKeySid && !!apiKeySecret));
    const hasFrom = !!messagingServiceSid || !!fromNumber;

    console.log('🔑 Twilio env check:', {
      hasAccountSid: !!accountSid,
      hasAuthToken: !!authToken,
      hasApiKey: !!apiKeySid && !!apiKeySecret,
      hasMessagingServiceSid: !!messagingServiceSid,
      hasFromNumber: !!fromNumber
    });

    if (!hasCreds || !hasFrom) {
      return res.status(500).json({
        error: "SMS API not configured",
        hint: "Set TWILIO_ACCOUNT_SID and (TWILIO_AUTH_TOKEN OR TWILIO_API_KEY_SID+TWILIO_API_KEY_SECRET) and (TWILIO_MESSAGING_SERVICE_SID OR TWILIO_FROM_NUMBER) in .env"
      });
    }

    const useApiKey = !!apiKeySid && !!apiKeySecret;
    const user = useApiKey ? apiKeySid : accountSid;
    const pass = useApiKey ? apiKeySecret : authToken;
    const basic = Buffer.from(`${user}:${pass}`).toString('base64');

    const params = new URLSearchParams();
    params.append('To', to);
    params.append('Body', body);
    if (messagingServiceSid) params.append('MessagingServiceSid', messagingServiceSid);
    else params.append('From', fromNumber);

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    });

    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    if (!response.ok) {
      console.error('❌ Twilio error:', data);
      return res.status(response.status).json(data);
    }

    console.log('✅ SMS sent successfully! SID:', data.sid);
    return res.status(200).json({ ok: true, sid: data.sid });
  } catch (e) {
    console.error('❌ SMS send error:', e);
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// --- Server-side vehicle_types write endpoints (proxy using service_role) ---

async function getUserFromToken(token) {
  if (!token) return null;
  const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { Authorization: `Bearer ${token}`, apikey: process.env.SUPABASE_ANON_KEY || '' } });
    if (!r.ok) return null;
    const data = await r.json();
    return data;
  } catch (e) {
    console.error('getUserFromToken error', e);
    return null;
  }
}

async function supabaseServiceRequest(path, method='GET', body=null, extraHeaders={}) {
  const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = `${SUPABASE_URL}/rest/v1${path.startsWith('/')?path:('/'+path)}`;
  const headers = {
    'Content-Type': 'application/json',
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    ...extraHeaders
  };
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(url, opts);
  const text = await r.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: r.status, body: data };
}

// Helper: check org membership via organization_members table
async function checkOrgMembership(userId, orgId) {
  const res = await supabaseServiceRequest(`/organization_members?user_id=eq.${encodeURIComponent(userId)}&organization_id=eq.${encodeURIComponent(orgId)}`);
  if (res.status >= 200 && res.status < 300 && Array.isArray(res.body) && res.body.length > 0) return res.body[0];
  return null;
}

// Admin check: environment override or organization_members.role = 'admin'
function isAdminUser(userId) {
  const adminList = (process.env.ADMIN_USER_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (adminList.includes(userId)) return true;
  return false;
}

app.post('/api/vehicle-types', async (req, res) => {
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ error: 'Missing Authorization header' });

    const user = await getUserFromToken(token);
    if (!user || !user.id) return res.status(401).json({ error: 'Invalid user token' });

    const payload = req.body || {};
    let orgId = payload.organization_id;

    // If no org provided, attempt to infer single org membership
    if (!orgId) {
      const mems = await supabaseServiceRequest(`/organization_members?user_id=eq.${encodeURIComponent(user.id)}`);
      if (mems.status >= 200 && Array.isArray(mems.body) && mems.body.length === 1) {
        orgId = mems.body[0].organization_id;
      } else {
        return res.status(400).json({ error: 'organization_id required when user belongs to multiple organizations' });
      }
    }

    // Verify membership
    const member = await checkOrgMembership(user.id, orgId);
    if (!member) return res.status(403).json({ error: 'User is not a member of the specified organization' });

    // Create the record using service role
    const created = await supabaseServiceRequest('/vehicle_types', 'POST', payload);
    return res.status(created.status).json(created.body);
  } catch (e) {
    console.error('POST /api/vehicle-types error', e);
    return res.status(500).json({ error: e.message || String(e) });
  }
});

app.patch('/api/vehicle-types/:id', async (req, res) => {
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ error: 'Missing Authorization header' });

    const user = await getUserFromToken(token);
    if (!user || !user.id) return res.status(401).json({ error: 'Invalid user token' });

    const id = req.params.id;
    // Fetch existing record
    const existing = await supabaseServiceRequest(`/vehicle_types?id=eq.${encodeURIComponent(id)}&select=*`);
    if (existing.status !== 200 || !Array.isArray(existing.body) || existing.body.length === 0) {
      return res.status(404).json({ error: 'Vehicle type not found' });
    }
    const current = existing.body[0];

    // Check org membership or admin
    const orgId = current.organization_id;
    const member = await checkOrgMembership(user.id, orgId);
    if (!member && !isAdminUser(user.id)) return res.status(403).json({ error: 'Not authorized to modify this vehicle type' });

    // Perform update
    const updated = await supabaseServiceRequest(`/vehicle_types?id=eq.${encodeURIComponent(id)}`, 'PATCH', req.body, { Prefer: 'return=representation' });
    return res.status(updated.status).json(updated.body);
  } catch (e) {
    console.error('PATCH /api/vehicle-types/:id error', e);
    return res.status(500).json({ error: e.message || String(e) });
  }
});

app.delete('/api/vehicle-types/:id', async (req, res) => {
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ error: 'Missing Authorization header' });

    const user = await getUserFromToken(token);
    if (!user || !user.id) return res.status(401).json({ error: 'Invalid user token' });

    if (!isAdminUser(user.id)) return res.status(403).json({ error: 'Only administrators can delete vehicle types' });

    const id = req.params.id;
    const deleted = await supabaseServiceRequest(`/vehicle_types?id=eq.${encodeURIComponent(id)}`, 'DELETE');
    return res.status(deleted.status).json(deleted.body);
  } catch (e) {
    console.error('DELETE /api/vehicle-types/:id error', e);
    return res.status(500).json({ error: e.message || String(e) });
  }
});

// Serve static files

// Serve static files

// Driver portal - serve driver-portal.html for any /drivers/:slug route
app.get('/drivers/:slug', (req, res) => {
  console.log(`🚗 Driver portal request for slug: ${req.params.slug}`);
  res.sendFile(path.join(__dirname, 'drivers', 'driver-portal.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 ReliaLimo server running on http://localhost:${PORT}`);
  console.log(`📧 Email API available at http://localhost:${PORT}/api/email-send`);
  console.log(`💡 Make sure to create a .env file with RESEND_API_KEY and EMAIL_FROM`);
  console.log(`🔧 Node.js version: ${process.version}`);
}).on('error', (err) => {
  console.error('❌ Server failed to start:', err.message);
  if (err.code === 'EADDRINUSE') {
    console.log(`💡 Port ${PORT} is busy. Try a different port or stop existing server.`);
  }
});