// Minimal app-shell service worker.
// Caches static assets on install; for navigation requests serves the cached
// shell when offline. NEVER caches /api/* (worker MCP) or any cross-origin
// request (Supabase REST, fonts, etc.) — those must always hit the network
// or stale data sneaks in (the dashboard once cached an empty rides list
// and the dashboard kept showing zero rides even after writes).
const CACHE = "limo-shell-v2";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

// Web Push: show a notification when one arrives.
self.addEventListener("push", (event) => {
  let payload = { title: "SDLuxury", body: "" };
  try {
    if (event.data) payload = event.data.json();
  } catch {
    if (event.data) payload = { title: "SDLuxury", body: event.data.text() };
  }
  const opts = {
    body: payload.body,
    icon: "./icon.svg",
    badge: "./icon.svg",
    tag: payload.tag,
    data: { url: payload.url || "/" },
    requireInteraction: false,
  };
  event.waitUntil(
    self.registration.showNotification(payload.title || "SDLuxury", opts),
  );
});

// Click → focus an existing tab (or open a new one) at payload.url.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((cs) => {
        for (const c of cs) {
          if ("focus" in c) {
            c.navigate(url);
            return c.focus();
          }
        }
        return self.clients.openWindow(url);
      }),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Cross-origin requests (Supabase, Google Fonts, anything not us) — let
  // the browser handle them directly. We have no business caching them.
  if (url.origin !== self.location.origin) return;

  // Never cache our own /api/* (MCP / worker endpoints).
  if (url.pathname.startsWith("/api/")) return;

  // Navigation: try network, fall back to cached shell.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match("./index.html")),
    );
    return;
  }

  // Other same-origin GETs (built JS/CSS/images): cache-first.
  if (req.method === "GET") {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
            return res;
          }),
      ),
    );
  }
});
