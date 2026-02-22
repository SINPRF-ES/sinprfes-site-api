/**
 * SINPRF-ES Service Worker
 * Versão: 1.0.3
 */

const CACHE_NAME = 'sinprfes-cache-v1.0.3';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/main.js',
  '/config.js',
  '/manifest.webmanifest'
];

// Instalação: Cacheia arquivos iniciais
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Ativação: Limpa caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter((cacheName) => {
          return cacheName.startsWith('sinprfes-cache-') && cacheName !== CACHE_NAME;
        }).map((cacheName) => {
          return caches.delete(cacheName);
        })
      );
    })
  );
  self.clients.claim();
});

// Interceptação de requests
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Estratégia Network-First para arquivos críticos e sem hash
  // Incluímos .js para evitar que o cache-first entregue versões antigas de lógica
  const isCritical = [
    '/config.js',
    '/manifest.webmanifest',
    '/service-worker.js',
    '/index.html'
  ].includes(url.pathname) || url.pathname === '/' || url.pathname.endsWith('.js');

  if (isCritical) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Se recebermos um HTML no lugar de JS/JSON (erro de fallback), não cachear
          const contentType = response.headers.get('content-type');
          if (url.pathname.endsWith('.js') && contentType && contentType.includes('text/html')) {
            return response;
          }
          if (url.pathname.endsWith('.webmanifest') && contentType && contentType.includes('text/html')) {
            return response;
          }

          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // 2. Bypass para API
  if (url.pathname.startsWith('/api')) {
    return;
  }

  // 3. Cache-First para demais assets (imagens, css, etc)
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request).then((fetchRes) => {
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, fetchRes.clone());
          return fetchRes;
        });
      });
    })
  );
});
