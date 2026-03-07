# Configuração do Railway (Canon do Monorepo)

Este documento consolida a configuração operacional do Railway para evitar divergência entre serviços.

## 1. Serviço: API (Backend)

A API deve usar build determinístico via Dockerfile do próprio backend.

- **Root Directory:** `/backend`
- **Dockerfile:** `Dockerfile` (resolvido como `/backend/Dockerfile`)
- **Build Command:** deixar em branco (Railway usa o Dockerfile)
- **Start Command:** deixar em branco quando usar `CMD` do Dockerfile, ou `npm start` se o painel exigir explícito
- **Package real do backend:** `/backend/package.json`
- **Start command real do backend:** `npm start` (`node server.js`)

### Playwright (Consulta Processual/TRF1)

O Dockerfile do backend instala de forma determinística:

1. dependências npm (`npm ci`);
2. Chromium + dependências Linux (`npx playwright install --with-deps chromium`);
3. caminho fixo de browsers via `PLAYWRIGHT_BROWSERS_PATH=/ms-playwright`.

Isso evita depender de instalação implícita em cache global (`/root/.cache/ms-playwright`) como premissa do deploy.

## 2. Serviço: SITE

- **Root Directory:** `/`
- **Build Command:** conforme fluxo do frontend/site
- **Start Command:** conforme fluxo do frontend/site

> O ajuste para API via Dockerfile em `/backend` não deve alterar o deploy de `site`/`mobile`.

## 3. Diagnóstico operacional do Playwright (Backend)

No runtime do serviço API, execute:

```bash
npm run check:playwright
```

Saídas esperadas:

- `PLAYWRIGHT_PACKAGE_OK`
- `PLAYWRIGHT_BROWSER_PRESENT`
- `PLAYWRIGHT_LAUNCH_OK`

Falhas classificadas:

- `PLAYWRIGHT_PACKAGE_MISSING`
- `PLAYWRIGHT_BROWSER_MISSING`
- `PLAYWRIGHT_SYSTEM_DEPS_MISSING`
- `PLAYWRIGHT_LAUNCH_FAILED`

## 4. Variáveis de ambiente relevantes

- `PLAYWRIGHT_ENABLED`
- `PLAYWRIGHT_BROWSER`
- `PLAYWRIGHT_LAUNCH_TIMEOUT_MS`
- `PLAYWRIGHT_EXTRA_ARGS`
- `CONSULTA_PROCESSUAL_HEADLESS`
- `CONSULTA_PROCESSUAL_DEBUG`

Com `CONSULTA_PROCESSUAL_DEBUG=true`, o backend loga também o `executablePath` do Chromium para diagnóstico.
