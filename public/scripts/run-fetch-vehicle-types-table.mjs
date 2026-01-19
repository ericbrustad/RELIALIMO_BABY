import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const apiServiceUrl = pathToFileURL(path.join(root, 'api-service.js')).href;

global.window = { ENV: { FORCE_DATABASE_ON_LOCALHOST: true, SUPABASE_URL: process.env.SUPABASE_URL || '', SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '' }, location: { hostname: 'localhost', protocol: 'http:' } };
global.localStorage = { _d: {}, getItem(k){ return this._d[k] || null }, setItem(k,v){ this._d[k]=String(v) }, removeItem(k){ delete this._d[k] } };

(async function() {
  try {
    const api = await import(apiServiceUrl);
    console.log('Testing fetchVehicleTypesTable() (table read)');
    const types = await api.fetchVehicleTypesTable();
    console.log('fetchVehicleTypesTable result:', Array.isArray(types) ? `count ${types.length}` : types);
    if (Array.isArray(types) && types.length) console.log(types.slice(0,10));

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(2);
  }
})();
