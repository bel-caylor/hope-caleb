const CACHE_NAME = "hope-caleb-dashboard-v6";
const APP_SHELL = [
  "/dashboard.html",
  "/Dashboard.html",
  "/manifest.webmanifest",
  "/favicon.svg",
  "/images/hero-monogram.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key.startsWith("hope-caleb-dashboard-") && key !== CACHE_NAME)
        .map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          cacheResponse(event, event.request, response);
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(event.request) || await caches.match("/dashboard.html");
          return cached || new Response("The dashboard is temporarily unavailable. Please reconnect and refresh.", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" }
          });
        })
    );
    return;
  }

  // HTML must be network-first so a deploy is visible immediately. Assets can
  // use cache-first, but refresh themselves in the background when online.
  if (requestUrl.pathname.endsWith(".html")) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          cacheResponse(event, event.request, response);
          return response;
        })
        .catch(async () => (await caches.match(event.request)) || new Response("This page is temporarily unavailable.", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" }
        }))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        event.waitUntil(
          fetch(event.request)
            .then((response) => cacheResponse(event, event.request, response))
            .catch(() => undefined)
        );
        return cached;
      }
      return fetch(event.request).then((response) => {
        cacheResponse(event, event.request, response);
        return response;
      });
    })
  );
});

function cacheResponse(event, request, response) {
  if (!response || !response.ok) return;
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.put(request, response.clone()))
      .catch(() => undefined)
  );
}
