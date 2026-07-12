'use strict';
/* Service worker de FutMon World.
   - Navegación (abrir la app): RED PRIMERO con respaldo en caché — el arranque
     desde el icono nunca depende de una caché rota.
   - Recursos estáticos: caché primero para que el juego vaya rápido y offline.
   IMPORTANTE: al cambiar cualquier fichero del juego, sube la versión de CACHE
   (y la etiqueta de versión del título en index.html). */
const CACHE = 'futmon-world-v6';
const CORE = [
  './', './index.html', './app.js', './styles.css', './manifest.webmanifest',
  './assets/icons/icon-192.png', './assets/icons/icon-512.png', './assets/icons/icon-maskable-512.png',
  './assets/portraits/lamine.webp', './assets/portraits/mbappe.webp', './assets/portraits/aitana.webp',
  './assets/portraits/haaland.webp', './assets/portraits/bellingham.webp', './assets/portraits/alexia.webp',
  './assets/portraits/rodri.webp', './assets/portraits/vinicius.webp', './assets/portraits/cubarsi.webp',
  './assets/portraits/courtois.webp', './assets/portraits/pedri.webp', './assets/portraits/salma.webp',
  './assets/portraits/musiala.webp', './assets/portraits/saliba.webp',
];

// Precaché tolerante: un fichero que falle no impide instalar la app.
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

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;

  // Navegaciones: red primero, caché como respaldo (nunca pantalla en blanco).
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put('./index.html', copy)).catch(() => {});
        }
        return res;
      }).catch(() =>
        caches.match('./index.html').then(hit => hit || caches.match('./'))
      )
    );
    return;
  }

  // Resto: caché primero, red como respaldo.
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      }
      return res;
    }))
  );
});
