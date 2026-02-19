# SINPRF-ES Institutional Site

## Configuration

The site service handles both the institutional frontend and the `/api` proxy.

### Cloudflare Cache Mitigation

To prevent Cloudflare from serving stale HTML fallback for critical JavaScript assets (like `config.js`), the following Cache Rules should be applied in the Cloudflare dashboard:

1. **Rule for config.js**:
   - Expression: `(http.request.uri.path contains "/config.js")`
   - Cache Eligibility: **Bypass cache**

2. **Rule for Service Worker and Manifest**:
   - Expression: `(http.request.uri.path in {"/service-worker.js" "/manifest.webmanifest"})`
   - Cache Eligibility: **Bypass cache**

### Environment Variables

- `API_BASE_URL`: The full URL of the backend API (e.g., `https://api.sinprfes.org.br`). The `/api` prefix is handled by the proxy.
- `PORT`: The port the server listens on (default: `8080`).

### Proxy /api

The Express server proxies all requests starting with `/api` to the `API_BASE_URL`.
Example: `GET https://sinprfes.org.br/api/health` -> `GET https://api.sinprfes.org.br/api/health`
