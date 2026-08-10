const CACHE = "menus-v3";
const SHELL = ["/menus/", "/menus/index.html", "/menus/style.css", "/menus/data.js", "/menus/planner.js", "/menus/app.js", "/menus/manifest.json"];

self.addEventListener("install", e =>
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()))
);
self.addEventListener("activate", e =>
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()))
);

// Network-first: always try network, fall back to cache only when offline
self.addEventListener("fetch", e =>
  e.respondWith(
    fetch(e.request).then(res => {
      const clone = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, clone));
      return res;
    }).catch(() => caches.match(e.request))
  )
);
