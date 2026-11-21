const CACHE_NAME = "mvn-player-v1";
const scopePath = new URL(self.registration.scope).pathname;
const base = scopePath.endsWith("/") ? scopePath : `${scopePath}/`;
const SHELL_FILES = [base, `${base}index.html`];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.includes("/api/") || url.pathname.includes("/player/v1/")) {
    return;
  }
  const h = url.hostname;
  if (
    h === "www.youtube.com" ||
    h === "youtube.com" ||
    h === "www.youtube-nocookie.com" ||
    h === "youtube-nocookie.com" ||
    h === "img.youtube.com" ||
    h === "i.ytimg.com" ||
    h.endsWith(".googlevideo.com") ||
    h.endsWith(".ytimg.com")
  ) {
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
