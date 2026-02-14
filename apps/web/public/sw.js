/**
 * Blueth City — Minimal Service Worker
 *
 * Caches static assets (JS, CSS, images, fonts) for faster repeat loads.
 * API and auth requests are never cached — always hit the network.
 * No offline gameplay is promised; this is a cache-accelerator only.
 */

const CACHE_NAME = 'blueth-v1';
const PRECACHE = ['/manifest.json', '/icons/icon-192.svg', '/icons/icon-512.svg'];

// Install: precache a few small assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

// Activate: evict old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch: cache-first for static assets, passthrough for everything else
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never cache API calls, auth endpoints, or non-GET requests
  if (event.request.method !== 'GET') return;
  if (url.pathname.startsWith('/api')) return;
  if (url.pathname.startsWith('/auth')) return;

  // Cache-first for known static asset types
  const dest = event.request.destination;
  if (dest === 'style' || dest === 'script' || dest === 'image' || dest === 'font') {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
  }
});
