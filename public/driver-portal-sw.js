/**
 * RELIALIMO Driver Portal - Service Worker
 * Enables offline functionality and caching
 */

const CACHE_NAME = 'driver-portal-v5';
const OFFLINE_URL = '/driver-portal-offline.html';

const PRECACHE_ASSETS = [
  '/driver-portal.html',
  '/driver-portal.css',
  '/driver-portal.js',
  '/env.js',
  '/api-service.js',
  '/global.css'
];

// Install event - precache assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Precaching assets');
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests - let browser handle normally
  if (event.request.method !== 'GET') {
    return;
  }
  
  // Skip API calls - let browser handle normally (no respondWith)
  if (event.request.url.includes('supabase.co')) {
    return;
  }
  
  // Skip chrome-extension and other non-http(s) URLs
  if (!event.request.url.startsWith('http://') && !event.request.url.startsWith('https://')) {
    return;
  }
  
  // Helper to check if response can be cached
  function canCache(response) {
    if (!response || !response.ok) return false;
    // Responses with Vary: * cannot be cached
    const vary = response.headers.get('Vary');
    if (vary && vary === '*') return false;
    return true;
  }
  
  // Helper to create offline response
  function createOfflineResponse() {
    return new Response(
      '<!DOCTYPE html><html><head><title>Offline</title></head><body><h1>You are offline</h1><p>Please check your connection and try again.</p></body></html>',
      { status: 503, headers: { 'Content-Type': 'text/html' } }
    );
  }
  
  event.respondWith(
    (async () => {
      try {
        // Try cache first
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
          // Return cached version and update in background
          event.waitUntil(updateCache(event.request));
          return cachedResponse;
        }
        
        // Not in cache, fetch from network
        const response = await fetch(event.request);
        
        // Cache successful responses that can be cached
        if (canCache(response)) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME)
            .then((cache) => cache.put(event.request, responseClone))
            .catch(() => {}); // Ignore cache errors
        }
        
        return response;
      } catch (err) {
        // Network failed
        if (event.request.mode === 'navigate') {
          // Try offline page first, then create one
          const offlinePage = await caches.match(OFFLINE_URL);
          if (offlinePage) {
            return offlinePage;
          }
          return createOfflineResponse();
        }
        // Return simple offline response for non-navigation requests
        return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
      }
    })()
  );
});

// Update cache in background
async function updateCache(request) {
  try {
    const response = await fetch(request);
    // Only cache if response is ok and doesn't have Vary: *
    const vary = response.headers.get('Vary');
    if (response.ok && (!vary || vary !== '*')) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response);
    }
  } catch (err) {
    // Network error, ignore
  }
}

// Push notification handler
self.addEventListener('push', (event) => {
  console.log('[SW] Push received');
  
  let data = { title: 'RELIALIMO', body: 'New notification' };
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }
  
  const options = {
    body: data.body,
    icon: '/icons/driver-portal-192.png',
    badge: '/icons/driver-portal-badge.png',
    vibrate: [200, 100, 200],
    tag: data.tag || 'default',
    data: data.data || {},
    actions: data.actions || []
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.notification.tag);
  
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || '/driver-portal.html';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Focus existing window if open
        for (const client of windowClients) {
          if (client.url.includes('driver-portal') && 'focus' in client) {
            return client.focus();
          }
        }
        // Open new window
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('[SW] Sync event:', event.tag);
  
  if (event.tag === 'sync-trip-status') {
    event.waitUntil(syncTripStatus());
  }
});

async function syncTripStatus() {
  // Get pending status updates from IndexedDB
  // and send them to the server
  console.log('[SW] Syncing pending trip status updates...');
}
