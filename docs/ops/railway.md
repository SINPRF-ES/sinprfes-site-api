# Configuração do Railway (Canon do Monorepo)

O projeto utiliza o arquivo `railpack-plan.json` na raiz para definir o plano de build e deploy de forma automatizada pelo Railway (Nixpacks). O `railpack-plan.json` centraliza a instalação do `pnpm` e define as etapas de build/start para cada serviço através de filtros.

**Não utilize arquivos `railway.toml` no repositório**, pois as configurações específicas de serviço (como Root Directory e variáveis) devem ser feitas diretamente no painel do Railway.

## 1. Serviço: API (Backend)

*   **Root Directory**: `/` (Raiz do Monorepo)
*   **Build Command**: `npm install -g pnpm@9.15.9 --force && PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 PLAYWRIGHT_INSTALL_WITH_DEPS=true pnpm install --frozen-lockfile && pnpm --filter @sinprfes/backend run build:railway`
*   **Start Command**: `pnpm --filter @sinprfes/backend start`
*   **Variáveis de Ambiente**:
    *   `PORT`: `8080` (ou conforme desejado)
    *   `NODE_ENV`: `production`
    *   `DATABASE_URL`: (URL do Postgres)
    *   `JWT_SECRET`: (Segredo para tokens)
    *   `GOOGLE_APPLICATION_CREDENTIALS_JSON`: (JSON das credenciais do Google Drive)
    *   `RESEND_API_KEY`: (Chave da API do Resend)

## 2. Serviço: SITE (Frontend + Proxy)

*   **Root Directory**: `/` (Raiz do Monorepo)
*   **Build Command**: `npm install -g pnpm@9.15.9 --force && pnpm install --frozen-lockfile && pnpm --filter site build`
*   **Start Command**: `pnpm --filter site start`
*   **Variáveis de Ambiente**:
    *   `PORT`: `8080`
    *   `API_BASE_URL`: `https://api.sinprfes.org.br` (URL do serviço de API acima)

## Observações Gerais

*   **Root Directory**: É mandatório configurar o **Root Directory** como `/` no painel do Railway para que o `pnpm-lock.yaml` na raiz seja detectado e utilizado corretamente pelo processo de build.
*   **Playwright (Consulta Processual/TRF1)**: o pacote npm está em `backend/package.json` e o Chromium é preparado explicitamente no build via `build:railway` com `playwright install --with-deps chromium` para evitar falha de libs Linux ausentes (`libglib-2.0.so.0`, etc.).
*   **Node.js**: O projeto está fixado na versão **20.x**. O Railway deve detectar isso automaticamente via `.nvmrc` na raiz ou `engines` no `package.json`. Caso precise forçar, use `NIXPACKS_NODE_VERSION=20`.
*   **Gerenciador de Pacotes**: Utilizar exclusivamente **pnpm**.
*   **Segurança**: Nunca inclua segredos em Dockerfiles ou no código. Utilize sempre as variáveis de ambiente do painel do Railway.
*   **Shared Code**: O build do SITE copia automaticamente a pasta `/shared` para `public/shared` para que os scripts do frontend possam acessá-la.
