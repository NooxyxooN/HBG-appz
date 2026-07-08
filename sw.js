// Minimal service worker: only caches the static app shell (this file itself never touches
// Firestore data), so the app opens instantly and qualifies as an installable PWA on Android.
// Everything else — Firestore reads/writes, Google Fonts, CDN scripts (Chart.js, html2canvas,
// qrcodejs), share-sheet uploads — is left alone and always goes straight to the network, so
// live data always stays live and nothing gets accidentally frozen in a stale cache.
const CACHE_NAME = 'hbg-shell-v1';
const SHELL_FILES = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL_FILES))
      .catch(()=>{ /* offline first install or a file missing — not fatal, just skip caching it */ })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if(req.method !== 'GET') return; // never cache writes
  const url = new URL(req.url);
  if(url.origin !== self.location.origin) return; // let Firestore/CDN/fonts pass through untouched

  event.respondWith(
    caches.match(req).then(cached => {
      const networkFetch = fetch(req).then(res => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, resClone));
        return res;
      }).catch(() => cached); // offline fallback to whatever was last cached
      return cached || networkFetch;
    })
  );
});

// tapping a "new งานส่ง" notification focuses the app if it's already open in a tab, or opens a
// fresh one otherwise — either way it lands on the app itself
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for(const client of clientList){
        if('focus' in client) return client.focus();
      }
      if(self.clients.openWindow) return self.clients.openWindow('./');
    })
  );
});
