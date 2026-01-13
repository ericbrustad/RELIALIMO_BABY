#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_PATH = path.join(ROOT, 'env.js');

function parseDotenv(text) {
  const lines = text.split(/\r?\n/);
  const out = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function readDotenv() {
  try {
    const p = path.join(ROOT, '.env');
    if (fs.existsSync(p)) {
      const text = fs.readFileSync(p, 'utf8');
      return parseDotenv(text);
    }
  } catch (e) {
    // ignore
  }
  return {};
}

// If env.js already exists, noop
if (fs.existsSync(OUT_PATH)) {
  console.log('env.js already exists; skipping generation.');
  process.exit(0);
}

const dotenv = readDotenv();
const supabaseKey = process.env.SUPABASE_ANON_KEY ?? dotenv.SUPABASE_ANON_KEY;
const inCI = (process.env.CI === 'true' || process.env.CI === '1' || Boolean(process.env.GITHUB_ACTIONS));
const inProd = process.env.NODE_ENV === 'production';

// In CI or production, require SUPABASE_ANON_KEY to be present; otherwise fail the start so deploys are safe.
if ((inCI || inProd) && !supabaseKey) {
  console.error('❌ SUPABASE_ANON_KEY is missing in CI/production. Aborting start. Provide SUPABASE_ANON_KEY via environment, .env (in CI), or include env.js in the deployed artifact.');
  process.exit(2);
}

// Try to generate env.js. In CI/production, treat failures as fatal; in local dev, continue on failure.
console.log('env.js not found - attempting to run generate-env');
try {
  const cp = await import('child_process');
  const execSync = cp.execSync;
  execSync('node scripts/generate-env.mjs', { cwd: ROOT, stdio: 'inherit' });
  console.log('generate-env completed.');
} catch (err) {
  const msg = err && err.message ? err.message : String(err);
  if (inCI || inProd) {
    console.error('generate-env failed in CI/production - aborting start. Error:', msg);
    process.exit(3);
  }
  console.warn('generate-env failed but start will continue (dev). Error:', msg);
}

process.exit(0);
