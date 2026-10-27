// Service worker: makes the app installable and lets the shell open offline.
// Paths are relative to the worker's scope, which is the app's base path.
// Supabase requests are cross-origin and always go to the network.

const CACHE = 'monetki-v2';
const EXTRA = ['icons/icon-192.png', 'icons/icon-512.png'];

// The page registers the worker after it has loaded, so the first visit's
// scripts and styles never pass through it. Precache the current shell and
// everything it references, so the app opens offline right after one visit.
const precacheShell = async () => {
  const cache = await caches.open(CACHE);
  const root = new URL('./', self.registration.scope);
  const response = await fetch(root, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`shell: ${response.status}`);
  const html = await response.clone().text();
  await cache.put(root, response);
  const assets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((m) => new URL(m[1], root))
    .filter((url) => url.origin === self.location.origin)
    .map((url) => url.href);
  const extra = EXTRA.map((path) => new URL(path, root).href);
  await cache.addAll([...new Set([...assets, ...extra])]);
};

self.addEventListener('install', (event) => {
  event.waitUntil(precacheShell());
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const putInCache = async (request, response) => {
  if (response.ok) {
    const cache = await caches.open(CACHE);
    await cache.put(request, response.clone());
  }
  return response;
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Pages: network first so a deploy is picked up right away; cached shell offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => putInCache(new URL('./', self.registration.scope), response))
        .catch(() => caches.match(new URL('./', self.registration.scope))),
    );
    return;
  }

  // Build output under static/ has content hashes in file names, so it never changes.
  if (url.pathname.includes('/static/')) {
    event.respondWith(
      caches.match(request).then((cached) => cached ?? fetch(request).then((r) => putInCache(request, r))),
    );
    return;
  }

  // Everything else (manifest, icons): serve from cache, refresh in the background.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request).then((r) => putInCache(request, r));
      return cached ?? network;
    }),
  );
});
