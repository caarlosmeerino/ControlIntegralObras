// Service worker: la app abre sin conexión y muestra los últimos datos vistos.
const VERSION = 'cio-v2';
const SHELL = ['/', '/manifest.webmanifest', '/icono.svg', '/tema.js'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  // Archivos binarios (fotos, informes) y exportaciones: siempre red
  if (url.pathname.startsWith('/api/archivos/') || url.pathname.startsWith('/api/informes/') && url.search.includes('formato=')) return;
  if (url.pathname.startsWith('/api/')) {
    // Red primero; si falla, la última respuesta guardada
    e.respondWith(fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION + '-api').then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.open(VERSION + '-api').then((c) => c.match(req)).then((r) => r || new Response(JSON.stringify({ error: 'Sin conexión y sin datos guardados para esta pantalla.' }), { status: 503, headers: { 'Content-Type': 'application/json' } }))));
    return;
  }
  if (url.pathname.startsWith('/assets/') || url.pathname === '/municipios.json') {
    e.respondWith(caches.match(req).then((r) => r || fetch(req).then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); return res; })));
    return;
  }
  // Navegación: red primero, si no, la app guardada
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put('/', copy)); return res; }).catch(() => caches.match('/')));
  }
});
