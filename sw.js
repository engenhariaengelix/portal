// ENGELIX - service worker (etapa 1)
// Guarda os arquivos do app no celular. Com internet, sempre busca a versao nova;
// sem internet, abre a ultima versao guardada.
var CACHE = 'engelix-v1';
var ARQUIVOS = [
  './',
  './index.html',
  './manifest.json',
  './logo-branco.png',
  './folha-branca.png',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return Promise.all(ARQUIVOS.map(function (a) {
        return c.add(a).catch(function () {});
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (nomes) {
      return Promise.all(nomes.filter(function (n) { return n !== CACHE; })
        .map(function (n) { return caches.delete(n); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req).then(function (resp) {
      var copia = resp.clone();
      caches.open(CACHE).then(function (c) { c.put(req, copia); });
      return resp;
    }).catch(function () {
      return caches.match(req).then(function (r) { return r || caches.match('./index.html'); });
    })
  );
});
