// Cambia v1 a v2 si modificas los archivos de la aplicación.
const APP_CACHE = 'pwa-lab-archivos-v1';
// Las notas se guardan aparte para conservarlas al actualizar la app.
const DATA_CACHE = 'pwa-lab-notas-v1';
const NOTES_URL = '/datos/notas.json';
const FILES = [
  '/', '/index.html', '/styles.css', '/app.js', '/register-sw.js',
  '/manifest.webmanifest', '/service-worker.js', '/icon.svg',
  '/icon-192.png', '/icon-512.png',
];

// 1. INSTALL: descarga los archivos necesarios para abrir la página offline.
self.addEventListener('install', (event) => {
  console.log('[SW] install: guardando archivos en caché');
  event.waitUntil((async () => {
    const cache = await caches.open(APP_CACHE);
    await cache.addAll(FILES);
    // En esta demo, la nueva versión no espera a cerrar las pestañas.
    await self.skipWaiting();
  })());
});

// 2. ACTIVATE: elimina versiones anteriores de los archivos, sin borrar notas.
self.addEventListener('activate', (event) => {
  console.log('[SW] activate: listo para controlar la página');
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter((name) => name.startsWith('pwa-lab-archivos-') && name !== APP_CACHE)
      .map((name) => caches.delete(name)));
    // Controla también la pestaña que ya estaba abierta.
    await self.clients.claim();
  })());
});

// 3. FETCH: actúa como intermediario entre la página, la caché y la red.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Esta ruta es local: el service worker responde sin necesitar un servidor.
  if (url.pathname === NOTES_URL) {
    event.respondWith(handleNotes(event.request));
    return;
  }
  if (event.request.method !== 'GET') return;

  // Cache first: busca primero en caché; si no existe, intenta usar la red.
  event.respondWith((async () => {
    const cache = await caches.open(APP_CACHE);
    const saved = await cache.match(event.request);
    if (saved) {
      console.log('[SW] fetch: desde caché →', url.pathname);
      return saved;
    }
    try {
      return await fetch(event.request);
    } catch {
      return new Response('Recurso no disponible sin conexión.', { status: 503 });
    }
  })());
});

// Guarda y lee una lista de notas como una respuesta JSON en Cache Storage.
async function handleNotes(request) {
  const cache = await caches.open(DATA_CACHE);
  if (request.method === 'POST') {
    try {
      const notes = await request.json();
      if (!Array.isArray(notes) || notes.some((note) =>
        typeof note.text !== 'string' || note.text.length > 500 ||
        typeof note.id !== 'string' || typeof note.date !== 'string' ||
        typeof note.offline !== 'boolean')) {
        return Response.json({ error: 'Notas inválidas' }, { status: 400 });
      }
      // Cache.put necesita una clave GET; guardamos el JSON bajo esta URL.
      await cache.put(NOTES_URL, Response.json(notes));
      console.log('[SW] fetch: notas guardadas en caché');
      return Response.json({ saved: true });
    } catch {
      return Response.json({ error: 'No se pudieron guardar las notas' }, { status: 500 });
    }
  }
  if (request.method === 'GET') {
    return (await cache.match(NOTES_URL)) || Response.json([]);
  }
  return new Response('Método no permitido', { status: 405 });
}
