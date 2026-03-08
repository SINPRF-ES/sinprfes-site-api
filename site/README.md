# SINPRF-ES Institutional Site

## Configuration

The site service handles both the institutional frontend and the `/api` proxy.

## Canonical cache/versioning policy (external site + PWA)

### 1) Single source of truth for asset version

- `APP_VERSION` is read by `site/server.js` (environment variable).
- If not provided, fallback is `2026.03.08-01`.
- The server injects this version into all HTML responses for local CSS/JS/manifest/config URLs (`?v=APP_VERSION`).

> Deploy rule: every release that changes layout/CSS/JS/PWA **must bump `APP_VERSION`**.

### 2) Cache headers

- **HTML (all public pages):** `Cache-Control: no-cache, no-store, must-revalidate`
- **Versioned CSS/JS:** `Cache-Control: public, max-age=31536000, immutable`
- **Service Worker (`/service-worker.js`):** `Cache-Control: no-cache, no-store, must-revalidate`
- **Manifest (`/manifest.webmanifest`):** `Cache-Control: no-cache, must-revalidate`
- **Config (`/config.js`):** `Cache-Control: no-store, no-cache, must-revalidate`

### 3) Service Worker strategy

- Cache names are versioned by `APP_VERSION`.
- `activate` deletes incompatible old caches (`sinprfes-*`).
- HTML/navigation requests are **network-first** (no cache-first for documents).
- Static assets (CSS/JS/images/icons/manifest/config) are cached safely with versioned URLs.
- `skipWaiting()` + `clients.claim()` are enabled for predictable upgrades.

### 4) Cloudflare

The application is now self-consistent without manual cache purge as routine operation.

Optional hardening (still recommended):

1. `/config.js` => bypass cache
2. `/service-worker.js` and `/manifest.webmanifest` => bypass cache

## Environment Variables

- `API_BASE_URL`: The full URL of the backend API (e.g., `https://api.sinprfes.org.br`). The `/api` prefix is handled by the proxy.
- `APP_VERSION`: Release/version identifier used to version frontend assets and SW caches.
- `PORT`: The port the server listens on (default: `8080`).

## Proxy /api

The Express server proxies all requests starting with `/api` to the `API_BASE_URL`.
Example: `GET https://sinprfes.org.br/api/health` -> `GET https://api.sinprfes.org.br/api/health`
