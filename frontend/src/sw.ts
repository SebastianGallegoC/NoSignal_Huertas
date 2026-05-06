/// <reference lib="webworker" />

import { BackgroundSyncPlugin } from 'workbox-background-sync';
import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, NetworkOnly } from 'workbox-strategies';

declare let self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
clientsClaim();

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  }
});

// App shell offline: permite abrir rutas del SPA sin red.
const navigationHandler = createHandlerBoundToURL('/index.html');
registerRoute(new NavigationRoute(navigationHandler));

const syncQueue = new BackgroundSyncPlugin('nosignal-queue', {
  maxRetentionTime: 3 * 24 * 60,
});

registerRoute(
  ({ url, request }) => url.pathname.startsWith('/api/v1/forms') && request.method === 'POST',
  new NetworkOnly({
    plugins: [syncQueue],
  }),
  'POST',
);

// Recursos estáticos de mismo origen: prioriza red para aplicar cambios en la primera recarga.
registerRoute(
  ({ request, url }) =>
    url.origin === self.location.origin &&
    ['style', 'script', 'worker'].includes(request.destination),
  new NetworkFirst({
    // Evita quedar con JS/CSS viejo tras pulsar "Actualizar ahora".
    cacheName: 'nosignal-static-v3',
    networkTimeoutSeconds: 4,
  }),
);

// Imágenes/fonts: cache-first para mejor experiencia offline.
registerRoute(
  ({ request, url }) =>
    url.origin === self.location.origin &&
    ['image', 'font'].includes(request.destination),
  new CacheFirst({
    cacheName: 'nosignal-media-v1',
  }),
);
