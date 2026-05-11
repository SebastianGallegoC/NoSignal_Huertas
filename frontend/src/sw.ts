/// <reference lib="webworker" />

import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

declare let self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
clientsClaim();

// Captura errores no manejados en el Service Worker.
// Los logs son silent en offline para evitar saturar la consola.
self.addEventListener('error', () => {
  // Log silencioso - solo en debug.
});

self.addEventListener('unhandledrejection', (ev: PromiseRejectionEvent) => {
  // Evita messages "Uncaught (in promise)" cuando Workbox falla.
  try {
    ev.preventDefault?.();
  } catch {}
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  }
});

// App shell offline: permite abrir rutas del SPA sin red.
const navigationHandler = createHandlerBoundToURL('/index.html');
registerRoute(new NavigationRoute(navigationHandler));

/** Bump al cambiar contrato de respuestas cacheadas (evita JSON viejo tras deploy). */
const apiCacheName = 'nosignal-api-v2';

registerRoute(
  ({ url, request }) => url.pathname.startsWith('/api/v1/forms') && request.method === 'GET',
  async ({ request }) => {
    try {
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(apiCacheName);
        await cache.put(request, response.clone());
      }
      return response;
    } catch {
      const cache = await caches.open(apiCacheName);
      const cached = await cache.match(request);
      if (cached) {
        return cached;
      }

      return new Response(JSON.stringify({ detail: 'offline' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
    }
  },
);

registerRoute(
  ({ url, request }) => url.pathname.startsWith('/api/v1/forms') && request.method === 'POST',
  async ({ request }) => {
    try {
      return await fetch(request);
    } catch {
      return new Response(JSON.stringify({ detail: 'offline' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
    }
  },
  'POST',
);

// Recursos estáticos de mismo origen: NetworkFirst con timeout agresivo.
// Esto reduce timeouts innecesarios en modo offline.
registerRoute(
  ({ request, url }) =>
    url.origin === self.location.origin &&
    ['style', 'script', 'worker'].includes(request.destination),
  new NetworkFirst({
    /** Bump en releases con riesgo de mezcla JS/HTML (fuerza red o nueva entrada de caché). */
    cacheName: 'nosignal-static-v4',
    networkTimeoutSeconds: 2, // Reduced from 4 to 2 seconds for faster offline fallback
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
);

// Imágenes/fonts: cache-first para mejor experiencia offline.
registerRoute(
  ({ request, url }) =>
    url.origin === self.location.origin &&
    ['image', 'font'].includes(request.destination),
  new CacheFirst({
    cacheName: 'nosignal-media-v1',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
);

// Tile server caching (OpenStreetMap): cache-first with expiration.
// Esto permite que tiles visitados previamente estén disponibles offline.
registerRoute(
  ({ url }) => url.hostname.endsWith('tile.openstreetmap.org'),
  new CacheFirst({
    cacheName: 'osm-tiles-v1',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 500,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 días
        purgeOnQuotaError: true,
      }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
);
