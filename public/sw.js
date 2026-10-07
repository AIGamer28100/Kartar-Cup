/* Minimal app-shell service worker. Caches ONLY same-origin static assets and the HTML shell.
 * Never touches cross-origin requests (Firestore, Firebase Auth, Google sign-in, F1 APIs), non-GET
 * requests, or Firebase's reserved /__/ paths (auth handler), so auth and data can never be served stale. */
const VERSION = 'v1';
const SHELL_CACHE = `kc-shell-${VERSION}`;
const ASSET_CACHE = `kc-assets-${VERSION}`;
const KEEP = [SHELL_CACHE, ASSET_CACHE];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((c) => c.add('/index.html'))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !KEEP.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/__/') || url.pathname === '/sw.js') return;

  if (req.mode === 'navigate') {
    // Network-first HTML; fall back to the cached shell only when offline.
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(SHELL_CACHE).then((c) => c.put('/index.html', copy));
          }
          return res;
        })
        .catch(() => caches.match('/index.html').then((r) => r || Response.error())),
    );
    return;
  }

  if (url.pathname.startsWith('/assets/')) {
    // Hashed, immutable build output: cache-first.
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(ASSET_CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
  }
  // Everything else (icons, manifest, robots...) goes straight to the network.
});
