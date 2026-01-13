#!/usr/bin/env node
// scripts/run-write-vehicle-types.mjs
// Attempts to POST, PATCH and DELETE a sample vehicle_type using the anon key.
// Usage: node scripts/run-write-vehicle-types.mjs

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
// Use native global `fetch` available in Node 18+. No external fetch dependency required.

// Load server/.env if present, then fallback to process.env
const envPath = path.resolve(process.cwd(), 'server', '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.SUPABASE_ANON_URL || process.env.SUPABASE_REST_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY in environment. Check server/.env or .env.local.');
  process.exit(2);
}

const API_BASE = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1`;
const headers = {
  'Content-Type': 'application/json',
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`
};

async function run() {
  console.log('Using API_BASE:', API_BASE);

  // 1) Create
  const sample = { name: `TEST TYPE ${Date.now()}`, code: `TEST-${Math.floor(Math.random()*9999)}`, status: 'ACTIVE' };
  console.log('Attempting to INSERT sample vehicle_type:', sample);
  let created;
  try {
    const res = await fetch(`${API_BASE}/vehicle_types`, { method: 'POST', headers, body: JSON.stringify(sample) });
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}: ${text}`);
    created = JSON.parse(text)[0];
    console.log('Insert succeeded:', created);
  } catch (err) {
    console.error('Insert FAILED:', err.message || String(err));
  }

  if (!created || !created.id) {
    console.log('Skipping PATCH/DELETE since insert failed. Check RLS policies and that the anon key/session has write permissions.');
    return;
  }

  // 2) Patch
  try {
    const patch = { name: `${created.name} (patched)` };
    const res = await fetch(`${API_BASE}/vehicle_types?id=eq.${encodeURIComponent(created.id)}`, { method: 'PATCH', headers: { ...headers, Prefer: 'return=representation' }, body: JSON.stringify(patch) });
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}: ${text}`);
    const patched = JSON.parse(text)[0];
    console.log('PATCH succeeded:', patched);
  } catch (err) {
    console.error('PATCH FAILED:', err.message || String(err));
  }

  // 3) Delete (cleanup)
  try {
    const res = await fetch(`${API_BASE}/vehicle_types?id=eq.${encodeURIComponent(created.id)}`, { method: 'DELETE', headers });
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}: ${text}`);
    console.log('DELETE succeeded, cleanup done.');
  } catch (err) {
    console.error('DELETE FAILED:', err.message || String(err));
  }
}

run().catch(e => { console.error('Script failed:', e); process.exit(1); });
