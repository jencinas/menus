const CACHE = "menus-v2";
const SHELL = ["/menus/", "/menus/index.html", "/menus/style.css", "/menus/data.js", "/menus/planner.js", "/menus/app.js", "/menus/manifest.json"];

self.addEventListener("install", e =>
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()))
);
self.addEventListener("activate", e =>
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()))
);
self.addEventListener("fetch", e =>
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request)))
);
