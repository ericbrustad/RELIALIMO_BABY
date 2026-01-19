#!/usr/bin/env node
/*
  generate-env.mjs
  - Reads configuration from process.env and .env (if present)
  - Writes a browser-friendly env.js that sets window.ENV
  - Intended to be run during deploy (CI) or locally before starting the app

  Usage:
    node scripts/generate-env.mjs
    (or set env vars in CI and run the script)
*/
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DOTENV_PATH = path.join(ROOT, '.env');
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
    const result = {};

    // Primary .env at repo root - attempt to parse and merge
    if (fs.existsSync(DOTENV_PATH)) {
      const text = fs.readFileSync(DOTENV_PATH, 'utf8');
      Object.assign(result, parseDotenv(text));
    }

    // Fallback: merge in server/.env if any keys are missing
    const serverDotenv = path.join(ROOT, 'server', '.env');
    if (fs.existsSync(serverDotenv)) {
      const text = fs.readFileSync(serverDotenv, 'utf8');
      const parsedServer = parseDotenv(text);
      // Only add keys that are missing in root .env
      for (const k of Object.keys(parsedServer)) {
        if (result[k] === undefined) result[k] = parsedServer[k];
      }
    }

    return result;
  } catch (e) {
    // ignore
  }
  return {};
}

function getValue(key, dotenv) {
  // process.env takes precedence
  if (process.env[key] !== undefined) return process.env[key];
  if (dotenv[key] !== undefined) return dotenv[key];
  return undefined;
}

function buildWindowEnv(obj) {
  // Only include known keys to avoid leaking secrets unintentionally
  const keys = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'GOOGLE_MAPS_API_KEY',
    'FORCE_DATABASE_ON_LOCALHOST',
    'NODE_ENV',
    'PROJECT_REF'
  ];
  const out = {};
  for (const k of keys) {
    if (obj[k] !== undefined) {
      // coerce booleans
      if (obj[k] === 'true' || obj[k] === 'false') out[k] = obj[k] === 'true';
      else out[k] = obj[k];
    }
  }
  return out;
}

function writeEnvJs(windowEnv) {
  const content = `// GENERATED FILE - DO NOT COMMIT\n// This file is generated at deploy time from environment variables\nwindow.ENV = window.ENV || {};
` + Object.entries(windowEnv).map(([k,v]) => `window.ENV.${k} = ${JSON.stringify(v)};`).join('\n') + '\n';
  fs.writeFileSync(OUT_PATH, content, { encoding: 'utf8', mode: 0o600 });
  console.log('✅ env.js written to', OUT_PATH);
}



(async function main() {
  const dotenv = readDotenv();
  const envObj = {
    SUPABASE_URL: getValue('SUPABASE_URL', dotenv),
    SUPABASE_ANON_KEY: getValue('SUPABASE_ANON_KEY', dotenv),
    GOOGLE_MAPS_API_KEY: getValue('GOOGLE_MAPS_API_KEY', dotenv),
    FORCE_DATABASE_ON_LOCALHOST: getValue('FORCE_DATABASE_ON_LOCALHOST', dotenv) || 'false',
    NODE_ENV: getValue('NODE_ENV', dotenv) || 'development',
    PROJECT_REF: getValue('PROJECT_REF', dotenv)
  };

  const windowEnv = buildWindowEnv(envObj);

  // Basic warning if nothing would be written
  if (Object.keys(windowEnv).length === 0) {
    console.warn('⚠️ No environment keys found for env.js generation. Provide variables via .env or process.env');
  }

  // Explicit warnings for commonly-missed public keys
  if (!windowEnv.SUPABASE_ANON_KEY) {
    console.warn('⚠️ SUPABASE_ANON_KEY is missing. Without it, browser requests to Supabase will fail with "No API key found in request". Add SUPABASE_ANON_KEY to .env or the environment before generating env.js');
  }
  if (!windowEnv.GOOGLE_MAPS_API_KEY) {
    console.warn('⚠️ GOOGLE_MAPS_API_KEY is missing. Google Places/autocomplete will not work without it.');
  }

  writeEnvJs(windowEnv);

  // Safety: ensure not tracked (if git available)
  try {
    const cp = await import('child_process');
    const execSync = cp.execSync;
    try {
      execSync('git ls-files --error-unmatch env.js', { cwd: ROOT, stdio: 'pipe' });
      console.error('❌ env.js is tracked in git (unsafe). Please remove it from the repo (git rm --cached env.js) and add to .gitignore');
      process.exit(2);
    } catch (_) {
      // not tracked - good
    }
  } catch (_e) {
    // git not available - skip check
  }
})();
