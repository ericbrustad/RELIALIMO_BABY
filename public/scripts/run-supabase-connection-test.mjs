import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const supabaseClientUrl = pathToFileURL(path.join(root, 'supabase-client.js')).href;
const supabaseConfigUrl = pathToFileURL(path.join(root, 'supabase-config.js')).href;

// Setup a dev-like global window with FORCE_DATABASE_ON_LOCALHOST so imports fall back
global.window = { ENV: { FORCE_DATABASE_ON_LOCALHOST: true }, location: { hostname: 'localhost', protocol: 'http:' }, localStorage: new Map() };
// Polyfill basic localStorage since supabase-client uses localStorage
global.localStorage = {
  _d: {},
  getItem(k) { return this._d[k] || null; },
  setItem(k, v) { this._d[k] = String(v); },
  removeItem(k) { delete this._d[k]; }
};

(async function() {
  try {
    const sb = await import(supabaseClientUrl);
    const ok = await sb.testSupabaseConnection();
    console.log('testSupabaseConnection result:', ok);
    process.exit(ok ? 0 : 2);
  } catch (err) {
    console.error('Error running testSupabaseConnection:', err);
    process.exit(1);
  }
})();