/*
 * Lumio service worker (chunk 2).
 * Strategy: cache-first for static assets under /_next/static and /mascot,
 * network-first for navigation with a cache fallback, so the app keeps working
 * offline after first load. Content packs are bundled, so the whole learning
 * loop (onboard, study, reader, quiz) is offline-capable once cached.
 * Update flow: the page detects a waiting worker and shows the
 * "New version available" prompt; SKIP_WAITING below swaps it in — never
 * mid-quiz from the SW side (the user taps the prompt).
 */
const CACHE = 'lumio-v2-5a'; // bumped with chunk 5A (accounts) — do not reuse
const CORE = ['/', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// update prompt handshake: the page posts SKIP_WAITING when the learner accepts
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Never cache anything under /api/ — auth, capabilities and AI routes must
  // always hit the network (fresh session state, honest availability).
  if (url.pathname.startsWith('/api/')) return;

  // cache-first for immutable build assets and art
  if (url.pathname.startsWith('/_next/static') || url.pathname.startsWith('/mascot')) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
            return res;
          })
      )
    );
    return;
  }

  // network-first for pages, falling back to cache offline
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match('/')))
    );
  }
});
