# Configuração do Playwright no Backend (Railway)

Este documento define o setup **canônico e definitivo** da API para Playwright/Chromium no Railway.

## Fonte autoritativa da API

Para o serviço da API, o build deve seguir exatamente:

- **Monorepo na raiz usa pnpm**.
- **Root Directory do serviço API no Railway:** `/backend`
- **Builder da API:** `Dockerfile`
- **Dockerfile autoritativo da API:** `/backend/Dockerfile`
- **Custom Start Command:** vazio
- **Custom Build Command:** vazio

> `nixpacks.toml` e `railpack-plan.json` na raiz podem existir para outros contextos, mas **não são fonte autoritativa para o serviço da API** quando o serviço está em `/backend` com builder Dockerfile.

## Dockerfile canônico da API

O `/backend/Dockerfile` foi padronizado para:

1. `FROM node:20-bookworm`
2. ativar Corepack e fixar `pnpm@9.15.9`
3. instalar dependências de produção com pnpm
4. instalar Chromium e dependências Linux com `pnpm exec playwright install --with-deps chromium`
5. expor porta `8080`
6. iniciar com `node server.js`

Variáveis relevantes no container:

- `NODE_ENV=production`
- `PORT=8080`
- `PLAYWRIGHT_BROWSERS_PATH=/ms-playwright`

Com isso, o Chromium é instalado durante o build e passa a existir de forma determinística na imagem final.

## Diagnóstico do browser service

O serviço diferencia explicitamente os cenários:

- `PLAYWRIGHT_PACKAGE_MISSING`: pacote `playwright` ausente.
- `PLAYWRIGHT_BROWSER_MISSING`: executável do Chromium ausente.
- `PLAYWRIGHT_SYSTEM_DEPS_MISSING`: bibliotecas Linux ausentes.
- `PLAYWRIGHT_LAUNCH_FAILED`: falha genérica de launch.

Em debug (`CONSULTA_PROCESSUAL_DEBUG=true`), o backend registra `executablePath` para facilitar triagem.

## Flags cloud-safe no launch

Mantidas como padrão para execução em nuvem:

- `headless=true` por padrão em produção
- `--no-sandbox`
- `--disable-setuid-sandbox`

## Checklist operacional (Railway UI)

1. `Root Directory = /backend`
2. `Builder = Dockerfile`
3. `Custom Start Command =` vazio
4. `Custom Build Command =` vazio
5. redeploy do serviço

## Validação rápida pós-deploy

No runtime do serviço da API:

```bash
npm run check:playwright
```

Saída esperada inclui:

- `PLAYWRIGHT_PACKAGE_OK`
- `PLAYWRIGHT_BROWSER_PRESENT`
- `PLAYWRIGHT_LAUNCH_OK`
