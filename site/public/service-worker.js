/**
 * SINPRF-ES Service Worker
 * Versão injetada em runtime pelo servidor.
 */

const APP_VERSION = '__APP_VERSION__';
const SW_DEBUG = __SW_DEBUG__;
const STATIC_CACHE = `sinprfes-static-${APP_VERSION}`;
const RUNTIME_CACHE = `sinprfes-runtime-${APP_VERSION}`;
const SW_LOG_PREFIX = '[sinprfes-sw]';

const PRECACHE_URLS = [
  '/index.html',
  '/manifest.webmanifest',
  '/config.js',
  '/css/style.css',
  '/css/ui-canon.css',
  '/js/utils.js',
  '/js/main.js'
].map((url) => `${url}?v=${APP_VERSION}`);

function debugLog(message, ...args) {
  if (!SW_DEBUG && self.location.hostname !== 'localhost') return;
  console.info(`${SW_LOG_PREFIX} ${message}`, ...args);
}

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

function isVersionedRequest(requestUrl) {
  if (requestUrl.searchParams.get('v')) return true;
  return /\.[a-f0-9]{8,}\.(?:js|css|png|jpg|jpeg|svg|webp|woff2?)$/i.test(requestUrl.pathname);
}

self.addEventListener('install', (event) => {
  debugLog(`install version=${APP_VERSION}`);
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
          debugLog(`deleting old cache=${cacheName}`);
          return caches.delete(cacheName);
        })
    );

    await self.clients.claim();
    debugLog(`activate complete version=${APP_VERSION}`);
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const requestUrl = new URL(request.url);

  if (request.method !== 'GET') return;
  if (requestUrl.pathname.startsWith('/api/')) return;
  if (requestUrl.pathname === '/version.json') return;

  if (isHtmlNavigationRequest(request)) {
    event.respondWith((async () => {
      try {
        return await fetch(request, { cache: 'no-store' });
      } catch (error) {
        const cache = await caches.open(STATIC_CACHE);
        const fallback = await cache.match(`/index.html?v=${APP_VERSION}`);
        return fallback || Response.error();
      }
    })());
    return;
  }

  if (!isCacheableAssetRequest(requestUrl)) return;

  event.respondWith((async () => {
    const runtimeCache = await caches.open(RUNTIME_CACHE);

    if (isVersionedRequest(requestUrl)) {
      const cached = await caches.match(request);
      if (cached) return cached;

      const networkResponse = await fetch(request);
      runtimeCache.put(request, networkResponse.clone());
      return networkResponse;
    }

    try {
      const networkResponse = await fetch(request, { cache: 'no-store' });
      runtimeCache.put(request, networkResponse.clone());
      return networkResponse;
    } catch (error) {
      const cached = await runtimeCache.match(request);
      return cached || Response.error();
    }
  })());
});
