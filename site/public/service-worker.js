/**
 * SINPRF-ES Service Worker
 * Versão injetada em runtime pelo servidor.
 */

const APP_VERSION = '__APP_VERSION__';
const STATIC_CACHE = `sinprfes-static-${APP_VERSION}`;
const RUNTIME_CACHE = `sinprfes-runtime-${APP_VERSION}`;
const SW_LOG_PREFIX = '[sinprfes-sw]';

const PRECACHE_URLS = [
  '/manifest.webmanifest',
  '/config.js',
  '/css/style.css',
  '/css/ui-canon.css',
  '/js/utils.js',
  '/js/main.js'
].map((url) => `${url}?v=${APP_VERSION}`);

self.addEventListener('install', (event) => {
  console.info(`${SW_LOG_PREFIX} install version=${APP_VERSION}`);
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    const allowedCaches = new Set([STATIC_CACHE, RUNTIME_CACHE]);

    await Promise.all(
      cacheNames
        .filter((cacheName) => cacheName.startsWith('sinprfes-') && !allowedCaches.has(cacheName))
        .map((cacheName) => {
          console.info(`${SW_LOG_PREFIX} deleting old cache=${cacheName}`);
          return caches.delete(cacheName);
        })
    );

    await self.clients.claim();
    console.info(`${SW_LOG_PREFIX} activate complete version=${APP_VERSION}`);
  })());
});

function isHtmlNavigationRequest(request) {
  return request.mode === 'navigate' ||
    (request.headers.get('accept') || '').includes('text/html');
}

function isCacheableAssetRequest(requestUrl) {
  return requestUrl.origin === self.location.origin &&
    (requestUrl.pathname.startsWith('/css/') ||
      requestUrl.pathname.startsWith('/js/') ||
      requestUrl.pathname === '/config.js' ||
      requestUrl.pathname === '/manifest.webmanifest' ||
      requestUrl.pathname.startsWith('/img/') ||
      requestUrl.pathname.startsWith('/icons/'));
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const requestUrl = new URL(request.url);

  if (request.method !== 'GET') return;

  if (requestUrl.pathname.startsWith('/api/')) return;

  // HTML sempre network-first para evitar documento defasado.
  if (isHtmlNavigationRequest(request)) {
    event.respondWith((async () => {
      try {
        const networkResponse = await fetch(request);
        return networkResponse;
      } catch (error) {
        return Response.error();
      }
    })());
    return;
  }

  if (!isCacheableAssetRequest(requestUrl)) return;

  // Assets versionados: cache-first.
  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;

    const networkResponse = await fetch(request);
    const runtimeCache = await caches.open(RUNTIME_CACHE);
    runtimeCache.put(request, networkResponse.clone());
    return networkResponse;
  })());
});
