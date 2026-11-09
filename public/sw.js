// Service worker: makes the app installable and lets the shell open offline.
// Paths are relative to the worker's scope, which is the app's base path.
// Supabase requests are cross-origin and always go to the network.

const CACHE = 'monetki-v2';
// Shared content waiting for the app (src/lib/share.ts reads it); keep in sync.
const SHARE_CACHE = 'share-target';
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
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== SHARE_CACHE).map((k) => caches.delete(k))))
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

// Android "Share" to the installed app posts here (share_target in the
// manifest). The worker keeps what was shared and opens the app, which picks
// it up, also after signing in.
const receiveShare = async (request) => {
  const scope = self.registration.scope;
  try {
    const form = await request.formData();
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const base = new URL(`share-target/${id}/`, scope);
    const image = form.getAll('image').find((f) => f instanceof File && f.size > 0);
    const cache = await caches.open(SHARE_CACHE);
    if (image) {
      await cache.put(
        new URL('image', base),
        new Response(image, { headers: { 'content-type': image.type } }),
      );
    }
    const meta = {
      title: form.get('title') || '',
      text: form.get('text') || '',
      url: form.get('url') || '',
    };
    // Meta last: the app looks for it, so it never finds half a share.
    await cache.put(new URL('meta', base), new Response(JSON.stringify(meta)));
    return Response.redirect(new URL(`./?share=${id}`, scope).href, 303);
  } catch {
    return Response.redirect(new URL('./?share=failed', scope).href, 303);
  }
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (
    request.method === 'POST' &&
    url.origin === self.location.origin &&
    url.pathname.endsWith('/share-target')
  ) {
    event.respondWith(receiveShare(request));
    return;
  }
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
