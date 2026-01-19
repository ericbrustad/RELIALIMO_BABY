#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

function loadServerEnv() {
  const p = path.join(process.cwd(), 'server', '.env');
  if (!fs.existsSync(p)) return {};
  const text = fs.readFileSync(p, 'utf8');
  const out = {};
  text.split(/\r?\n/).forEach(line => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return;
    const eq = t.indexOf('=');
    if (eq === -1) return;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq+1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1,-1);
    out[k] = v;
  });
  return out;
}

(async function main(){
  const env = loadServerEnv();
  const SUPABASE_URL = process.env.SUPABASE_URL || env.SUPABASE_URL || (process.env.SUPABASE_URL);
  const ANON = process.env.SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || (process.env.SUPABASE_ANON_KEY);
  if (!SUPABASE_URL || !ANON) {
    console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY. Please set in server/.env or env vars.');
    process.exit(2);
  }
  const base = SUPABASE_URL.replace(/\/*$/,'') + '/rest/v1';
  try {
    async function call(endpoint) {
      const url = `${base}/${endpoint}`;
      const r = await fetch(url + '?select=*&limit=50', { headers: { 'apikey': ANON, 'Authorization': `Bearer ${ANON}`, 'Accept':'application/json' } });
      const text = await r.text();
      let parsed;
      try { parsed = JSON.parse(text); } catch (_) { parsed = text; }
      return { status: r.status, body: parsed };
    }

    const v1 = await call('vehicle_types');
    const v2 = await call('vehicle_types_public');

    console.log('v1 /vehicle_types:', v1.status, Array.isArray(v1.body) ? `count ${v1.body.length}` : v1.body);
    if (Array.isArray(v1.body) && v1.body.length) console.log('v1 sample:', v1.body.slice(0,10));
    console.log('v2 /vehicle_types_public:', v2.status, Array.isArray(v2.body) ? `count ${v2.body.length}` : v2.body);
    if (Array.isArray(v2.body) && v2.body.length) console.log('v2 sample:', v2.body.slice(0,10));

    process.exit(0);
  } catch (err) {
    console.error('Error querying Supabase REST:', err);
    process.exit(3);
  }
})();