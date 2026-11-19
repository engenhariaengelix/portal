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

// Avisos (Firebase Cloud Messaging): mostra a notificação quando chega um aviso, mesmo com o app fechado.
self.addEventListener('push', function (e) {
  var p = {};
  try { p = e.data ? e.data.json() : {}; } catch (x) {}
  var d = p.data || {}, n = p.notification || {};
  var titulo = d.titulo || n.title || 'ENGELIX';
  var corpo = d.texto || n.body || '';
  e.waitUntil(self.registration.showNotification(titulo, {
    body: corpo, icon: 'icon-192.png', badge: 'icon-192.png', data: { link: d.link || './' }
  }));
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var alvo = (e.notification.data && e.notification.data.link) || './';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (lista) {
    for (var i = 0; i < lista.length; i++) { if ('focus' in lista[i]) return lista[i].focus(); }
    return self.clients.openWindow(alvo);
  }));
});
