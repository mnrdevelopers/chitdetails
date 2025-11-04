// sw.js - Optimized Service Worker for ChitFund Pro PWA
const CACHE_NAME = "chitfund-pro-v3";
const urlsToCache = [
  "/",
  "/index.html",
  "/offline.html",
  "/auth.html",
  "/dashboard-manager.html",
  "/dashboard-member.html",
  "/style.css",
  "/auth.css",
  "/app.js",
  "/auth.js",
  "/dashboard-manager.js",
  "/dashboard-member.js",
  "/firebase-config.js",
  "/manifest.json"
];

// Install event
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log("Caching app shell...");
      return cache.addAll(urlsToCache);
    })
  );
  self.skipWaiting();
});

// Activate event
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(key => key !== CACHE_NAME && caches.delete(key)))
    )
  );
  self.clients.claim();
});

// Fetch event
self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return (
        response ||
        fetch(event.request).catch(() => caches.match("/offline.html"))
      );
    })
  );
});
