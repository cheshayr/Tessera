// Tessera service worker — makes the app installable and fully usable offline.
// Bump VERSION whenever you publish changes so installed copies update.
const VERSION = 'tessera-v23';
const RUNTIME = VERSION + '-rt';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './cloud.js', './cloud-config.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== RUNTIME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // App files: always ask the network first (so updates show up right away), fall back to the cache when offline.
  if (url.origin === location.origin) {
    e.respondWith(
      fetch(req, { cache: 'no-cache' }).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
        return res;
      }).catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || caches.match('./index.html')))
    );
    return;
  }

  // Fonts, favicons, PDF engine and video thumbnails: cache on first use so they work offline later.
  if (/(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(url.hostname) || ['www.google.com', 'cdnjs.cloudflare.com', 'cdn.jsdelivr.net', 'i.ytimg.com'].includes(url.hostname)) {
    e.respondWith(
      caches.open(RUNTIME).then(async c => {
        const hit = await c.match(req);
        if (hit) return hit;
        try {
          const res = await fetch(req);
          if (res.ok || res.type === 'opaque') c.put(req, res.clone());
          return res;
        } catch { return hit || Response.error(); }
      })
    );
  }
});
