// Environment Configuration
window.ENV = {
  SUPABASE_URL: "https://siumiadylwcrkaqsfwkj.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpdW1pYWR5bHdjcmthcXNmd2tqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2NjMzMTMsImV4cCI6MjA4MTIzOTMxM30.sSZBsXyOOmIp2eve_SpiUGeIwx3BMoxvY4c7bvE2kKw",
  SUPABASE_UUID: "99d34cd5-a593-4362-9846-db7167276592",
  SUPABASE_SERVICE_ROLE_KEY: "sbp_6426f752f2c2c655bb9e4426b627830ed2b8910d",
  // Legacy alias for compatibility while migrating to SUPABASE_SERVICE_ROLE_KEY
  SUPABASE_PAT: "sbp_6426f752f2c2c655bb9e4426b627830ed2b8910d",
  PROJECT_REF: "siumiadylwcrkaqsfwkj",
  SUPABASE_PROXY_URL: "https://siumiadylwcrkaqsfwkj.supabase.co",
  GOOGLE_MAPS_API_KEY: "AIzaSyAZhGX8NWGZd4p9OADvlqOgM6eZDwhQQh8",

  // Forced vehicle context (ensures vehicle types/vehicles load under a specific org/user)
  FORCE_VEHICLE_ORG_ID: "54eb6ce7-ba97-4198-8566-6ac075828160",
  FORCE_VEHICLE_USER_ID: "99d34cd5-a593-4362-9846-db7167276592",
  
  // Force database operations even on localhost (set to true to always use Supabase)
  FORCE_DATABASE_ON_LOCALHOST: true
};

// When a page is embedded (inside index.html iframes), hide its own header to prevent double headers/flashing
(function hideHeaderWhenEmbedded() {
  if (window.self === window.top) return;

  const root = document.documentElement;
  const keepHeader = root.dataset.keepHeader === 'true';

  // Mark document as embedded immediately for downstream styling if needed
  root.classList.add('embedded');

  if (keepHeader) {
    return; // allow pages to opt out of header hiding when embedded
  }

  // Inject minimal CSS to hide local headers and remove reserved padding
  const style = document.createElement('style');
  style.id = 'embeddedHeaderHide';
  style.textContent = `
    html.embedded body { padding-top: 0 !important; }
    html.embedded .header, html.embedded header { display: none !important; }
  `;

  if (document.head) {
    document.head.appendChild(style);
  } else {
    document.addEventListener('DOMContentLoaded', () => document.head && document.head.appendChild(style));
  }
})();
