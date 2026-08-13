/* Personalbee service worker — single-file build */
var CACHE = 'personalbee-site-v2';
var SHELL = ['./', './index.html', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(SHELL.map(function (u) {
      return c.add(u).catch(function () { /* one bad url must not fail the install */ });
    }));
  }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.map(function (k) {
      if (k !== CACHE && k.indexOf('personalbee-') === 0) return caches.delete(k);
    }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // never touch anything off-origin

  // Network first, cache only as the fallback.
  //
  // Cache-first was wrong here: it served the previous build on every launch and only
  // refreshed for the launch after, so a phone on the home screen stayed a version
  // behind and bugs looked unfixed. Offline still works — the cache answers whenever
  // the network doesn't.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put('./index.html', copy); }).catch(function () {});
        }
        return res;
      }).catch(function () {
        return caches.match('./index.html', { ignoreSearch: true }).then(function (hit) {
          return hit || new Response('', { status: 504, statusText: 'Offline' });
        });
      })
    );
    return;
  }

  e.respondWith(
    fetch(req).then(function (res) {
      if (res && res.ok && res.type === 'basic') {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); }).catch(function () {});
      }
      return res;
    }).catch(function () {
      return caches.match(req, { ignoreSearch: true }).then(function (hit) {
        return hit || new Response('', { status: 504, statusText: 'Offline' });
      });
    })
  );
});
