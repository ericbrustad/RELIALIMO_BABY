import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const configUrl = pathToFileURL(path.join(root, 'config.js')).href;
const supabaseConfigUrl = pathToFileURL(path.join(root, 'supabase-config.js')).href;

async function run() {
  console.log('Test 1: window.ENV present -> should return values from env');
  global.window = { ENV: { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'anon-123' }, location: { hostname: 'localhost', protocol: 'http:' } };
  const cfgModule = await import(configUrl + `?t=${Date.now()}`);
  console.log('getSupabaseConfig:', cfgModule.getSupabaseConfig());

  console.log('\nTest 2: window.ENV missing but FORCE_DATABASE_ON_LOCALHOST true -> fallback');
  global.window = { ENV: { FORCE_DATABASE_ON_LOCALHOST: true }, location: { hostname: '', protocol: 'file:' } };
  const cfgModule2 = await import(configUrl + `?t=${Date.now()}`);
  console.log('getSupabaseConfig:', cfgModule2.getSupabaseConfig());

  console.log('\nTest 3: supabase-config getSupabaseCredentials with FORCE -> fallback');
  global.window = { ENV: { FORCE_DATABASE_ON_LOCALHOST: true }, location: { hostname: 'localhost', protocol: 'http:' } };
  const sb = await import(supabaseConfigUrl + `?t=${Date.now()}`);
  console.log('getSupabaseCredentials:', sb.getSupabaseCredentials());

  console.log('\nTest 4: No env and not local -> should throw');
  global.window = { location: { hostname: 'prod.example.com', protocol: 'https:' } };
  try {
    const cfgModule3 = await import(configUrl + `?t=${Date.now()}`);
    console.log('getSupabaseConfig:', cfgModule3.getSupabaseConfig());
  } catch (err) {
    console.log('Expected throw:', err.message);
  }
}

run().catch(err => { console.error('Test script error:', err); process.exit(1); });