import express from 'express';
import dotenv from 'dotenv';

// Load server-only env (do NOT expose service key to the browser)
dotenv.config({ path: process.env.SERVER_ENV_PATH || '.server.env' });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PORT = process.env.PORT || 8787;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .server.env');
  process.exit(1);
}

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Simple CORS allow-all (adjust for production origins)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Proxy /rest/v1/* to Supabase PostgREST with service role key
app.use('/rest/v1', async (req, res) => {
  try {
    const targetUrl = `${SUPABASE_URL}${req.originalUrl}`;
    const headers = {
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Prefer': req.headers['prefer'] || 'return=representation'
    };

    // Preserve content-type if present
    if (req.headers['content-type']) {
      headers['Content-Type'] = req.headers['content-type'];
    }

    const init = {
      method: req.method,
      headers,
      redirect: 'follow'
    };

    if (!['GET', 'HEAD'].includes(req.method.toUpperCase())) {
      init.body = JSON.stringify(req.body);
    }

    const response = await fetch(targetUrl, init);
    const contentType = response.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');
    const payload = response.status === 204 ? null : (isJson ? await response.json() : await response.text());

    res.status(response.status);
    // forward select headers
    if (contentType) res.setHeader('Content-Type', contentType);
    res.send(payload);
  } catch (error) {
    console.error('❌ Proxy error:', error);
    res.status(500).json({ error: 'Proxy failed', details: error?.message || error?.toString() });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Supabase service proxy running on http://localhost:${PORT}`);
});
