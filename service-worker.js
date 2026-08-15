// Liwa PWA service worker — app-shell caching only.
//
// Important: this must NEVER cache Firestore reads or anything that could
// go stale and contradict "unknown stays unknown." It only caches the
// static shell (HTML/CSS/JS/icons) so the site installs cleanly and opens
// fast/offline. Live venue data always goes straight to the network —
// firestore-data.js talks to firestore.googleapis.com directly and this
// worker never intercepts cross-origin requests.

const CACHE_NAME = "liwa-shell-v1";

const SHELL_ASSETS = [
  "/",
  "/index.html",
  "/live.html",
  "/css/style.css",
  "/css/live.css",
  "/js/main.js",
  "/js/live.js",
  "/js/data-utils.js",
  "/js/firestore-data.js",
  "/js/firebase-config.js",
  "/manifest.json",
  "/assets/favicon-32.png",
  "/assets/favicon-48.png",
  "/assets/favicon-180.png",
  "/assets/favicon-192.png",
  "/assets/favicon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle same-origin GET requests for the app shell. Everything
  // else (Firestore reads, gstatic module imports, external images) is
  // left completely alone and goes straight to the network as normal.
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) {
    return;
  }

  // Network-first for HTML so a returning visitor always gets the latest
  // page when online; falls back to the cached shell when offline.
  if (request.mode === "navigate" || request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match("/live.html")))
    );
    return;
  }

  // Cache-first for static shell assets (css/js/icons) — fast repeat loads,
  // with a network fallback that refreshes the cache for next time.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      });
    })
  );
});
