// Re-export all from parent supabase-db.js
// This allows shared/ files to import from './supabase-db.js' while using the main implementation
export * from '../supabase-db.js';
import supabaseDb from '../supabase-db.js';
export default supabaseDb;
