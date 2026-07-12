'use strict';
/* Service worker de FutMon World: precachea la app para jugar sin conexión.
   IMPORTANTE: al cambiar cualquier fichero del juego, sube la versión de CACHE
   para que los jugadores reciban la actualización. */
const CACHE = 'futmon-world-v4';
const CORE = [
  './', './index.html', './app.js', './styles.css', './manifest.webmanifest',
  './assets/icons/icon-192.png', './assets/icons/icon-512.png', './assets/icons/icon-maskable-512.png',
  './assets/portraits/lamine.webp', './assets/portraits/mbappe.webp', './assets/portraits/aitana.webp',
  './assets/portraits/haaland.webp', './assets/portraits/bellingham.webp', './assets/portraits/alexia.webp',
  './assets/portraits/rodri.webp', './assets/portraits/vinicius.webp', './assets/portraits/cubarsi.webp',
  './assets/portraits/courtois.webp', './assets/portraits/pedri.webp', './assets/portraits/salma.webp',
  './assets/portraits/musiala.webp', './assets/portraits/saliba.webp',
];

// Precaché tolerante: un fichero que falle no debe impedir instalar la app;
// lo que falte se cachea después en el manejador de fetch.
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(CORE.map(u => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Caché primero, red como respaldo. Las navegaciones (abrir la app desde el
// icono) nunca deben quedarse en blanco: si todo falla, se sirve el index cacheado.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      }
      return res;
    })).catch(() => (e.request.mode === 'navigate' ? caches.match('./index.html') : undefined))
  );
});
