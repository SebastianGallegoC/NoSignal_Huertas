/// <reference lib="webworker" />

import { BackgroundSyncPlugin } from 'workbox-background-sync';
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkOnly, StaleWhileRevalidate } from 'workbox-strategies';

declare let self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

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

// Recursos estáticos de mismo origen: cache rápido y actualización en background.
registerRoute(
  ({ request, url }) =>
    url.origin === self.location.origin &&
    ['style', 'script', 'worker'].includes(request.destination),
  new StaleWhileRevalidate({
    // Bump tras cambios de chunks/rutas para no mezclar JS viejo con index nuevo.
    cacheName: 'nosignal-static-v2',
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
