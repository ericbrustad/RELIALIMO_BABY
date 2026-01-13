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
    const orgRes = await fetch(`${base}/organizations?select=id,name&limit=10`, { headers: { 'apikey': ANON, 'Authorization': `Bearer ${ANON}`, 'Accept':'application/json' } });
    const orgJson = await orgRes.text();
    console.log('organizations HTTP', orgRes.status);
    try { console.log('organizations:', JSON.parse(orgJson)); } catch { console.log('organizations raw:', orgJson); }

    const vtRes = await fetch(`${base}/vehicle_types?select=id,name,status,hide_from_online,organization_id&order=name.asc&limit=50`, { headers: { 'apikey': ANON, 'Authorization': `Bearer ${ANON}`, 'Accept':'application/json' } });
    const vtJson = await vtRes.text();
    console.log('vehicle_types HTTP', vtRes.status);
    try { console.log('vehicle_types:', JSON.parse(vtJson)); } catch { console.log('vehicle_types raw:', vtJson); }

    process.exit(0);
  } catch (err) {
    console.error('Error querying Supabase REST:', err);
    process.exit(3);
  }
})();