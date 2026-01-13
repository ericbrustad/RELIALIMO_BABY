import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const apiServiceUrl = pathToFileURL(path.join(root, 'api-service.js')).href;

global.window = { ENV: { FORCE_DATABASE_ON_LOCALHOST: true, SUPABASE_URL: 'https://siumiadylwcrkaqsfwkj.supabase.co', SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpdW1pYWR5bHdjcmthcXNmd2tqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2NjMzMTMsImV4cCI6MjA4MTIzOTMxM30.sSZBsXyOOmIp2eve_SpiUGeIwx3BMoxvY4c7bvE2kKw' }, location: { hostname: 'localhost', protocol: 'http:' } };
global.localStorage = { _d: {}, getItem(k){ return this._d[k] || null }, setItem(k,v){ this._d[k]=String(v) }, removeItem(k){ delete this._d[k] } };

(async function() {
  try {
    const api = await import(apiServiceUrl);
    const types = await api.fetchVehicleTypes();
    console.log('fetchVehicleTypes result:', Array.isArray(types) ? `count ${types.length}` : types);
    if (Array.isArray(types) && types.length) console.log(types.slice(0,5));
    process.exit(0);
  } catch (err) {
    console.error('fetchVehicleTypes error:', err);
    process.exit(2);
  }
})();
