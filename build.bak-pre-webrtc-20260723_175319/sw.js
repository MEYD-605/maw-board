// Oracle Board service worker.
// v2 fix (2026-06-13): the v1 fetch handler could resolve event.respondWith()
// to `undefined` (network fetch failed AND request not in cache) which throws
// "Failed to convert value to 'Response'" and blanked the page. It also
// intercepted navigations + the manifest, so a single network blip killed the
// whole session view on mobile. v2 only ever intercepts hashed build assets and
// our static icons; navigations, the manifest, /api and websockets are left to
// the browser, so the SW can never break a page or session load again.

const CACHE_NAME = "oracle-board-v2";
const PRECACHE = ["/icon-192.png", "/icon-512.png", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Only handle immutable hashed build assets + our precached static icons.
  // Anything else (navigations, /s/<id>, manifest, /api, websockets) goes
  // straight to the network so the SW can never return a non-Response.
  const cacheable =
    url.pathname.startsWith("/_app/immutable/") || PRECACHE.includes(url.pathname);
  if (!cacheable) return;

  // Cache-first; on a cache miss fall through to the real network response
  // (which is always a valid Response, never undefined).
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        }),
    ),
  );
});
