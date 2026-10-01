// Lemel's Family Cookbook — offline app shell cache
var CACHE_NAME = 'cookbook-shell-v1';
var SHELL_FILES = ['./', './index.html'];

self.addEventListener('install', function (event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(SHELL_FILES).catch(function () { /* ignore individual failures */ });
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(
        names.filter(function (n) { return n !== CACHE_NAME; }).map(function (n) { return caches.delete(n); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

// Network-first for the page itself (so updates show up promptly when online),
// falling back to the cached shell when there's no connection.
self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;

  // Never cache/interfere with Supabase API calls — those must always hit the network live.
  if (req.url.indexOf('supabase.co') !== -1) return;

  if (req.mode === 'navigate' || (req.url.indexOf(self.registration.scope) === 0 && req.url.endsWith('.html'))) {
    event.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE_NAME).then(function (cache) { cache.put(req, copy); });
        return res;
      }).catch(function () {
        return caches.match(req).then(function (cached) { return cached || caches.match('./index.html'); });
      })
    );
    return;
  }

  // Fonts/assets: cache-first for speed and offline use.
  event.respondWith(
    caches.match(req).then(function (cached) {
      return cached || fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE_NAME).then(function (cache) { cache.put(req, copy); });
        return res;
      }).catch(function () { return cached; });
    })
  );
});
