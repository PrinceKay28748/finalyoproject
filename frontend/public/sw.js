// Public service worker - handles offline mode and caching
// Registered in main.jsx

const CACHE_NAME = 'ug-routing-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
];

/**
 * Install event - cache essential assets
 */
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Caching essential assets');
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('[ServiceWorker] Failed to cache some assets:', err);
      });
    })
  );
  self.skipWaiting(); // Activate immediately
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[ServiceWorker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim(); // Take control immediately
});

/**
 * Fetch event - network first, fallback to cache
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // API calls - network first with cache fallback
  if (url.pathname.includes('/api/') || url.pathname.includes('overpass') || url.pathname.includes('nominatim')) {
    return event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful responses
          if (response.ok) {
            const cache = caches.open(CACHE_NAME).then((c) => {
              c.put(request, response.clone());
            });
          }
          return response;
        })
        .catch(() => {
          // Return cached response if network fails
          return caches.match(request).then((cached) => {
            if (cached) {
              console.log('[ServiceWorker] Serving from cache (offline):', url.pathname);
              return cached;
            }
            // Return offline page or error
            return new Response('Offline - please check your connection', {
              status: 503,
              statusText: 'Service Unavailable',
            });
          });
        })
    );
  }

  // Static assets - cache first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        return cached;
      }
      return fetch(request).catch(() => {
        console.warn('[ServiceWorker] Failed to fetch:', request.url);
        return new Response('Offline - resource not available', {
          status: 503,
          statusText: 'Service Unavailable',
        });
      });
    })
  );
});

/**
 * Message handler - for communication from app
 */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CACHE_GRAPH') {
    console.log('[ServiceWorker] Received graph cache request');
    // Graph is already cached via IndexedDB, nothing to do here
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME).then(() => {
      console.log('[ServiceWorker] Cache cleared');
    });
  }
});
