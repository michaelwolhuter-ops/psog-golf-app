// Minimal service worker — exists so iOS/Android recognise this as an
// installable PWA. This app is an admin tool where data changes constantly
// (see next.config.js and middleware.js for the lengths already gone to,
// to stop stale reads) so this deliberately does NOT cache pages or API
// responses. It only caches the static shell icons, which never change at
// runtime, and otherwise gets out of the way and lets every request go
// straight to the network.
const CACHE_NAME = "posg-tour-shell-v1";
const SHELL_ASSETS = [
  "/manifest.json",
  "/logo.png",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only ever serve shell assets from cache. Everything else (pages, API
  // routes, data) always goes to the network so the app never shows stale
  // data — this app has been bitten by caching bugs before.
  const url = new URL(request.url);
  if (request.method === "GET" && SHELL_ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request))
    );
  }
});
