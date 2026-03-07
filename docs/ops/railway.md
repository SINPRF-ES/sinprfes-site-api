# Configuração do Railway (Canon do Monorepo)

O projeto utiliza o arquivo `nixpacks.toml` na raiz para definir o plano de build e deploy de forma automatizada pelo Railway (Nixpacks). O `nixpacks.toml` centraliza a instalação do `pnpm`, as dependências nativas do sistema (Linux) e define as etapas de build/start para cada serviço através de filtros.

**Não utilize arquivos `railway.toml` no repositório**, pois as configurações específicas de serviço (como Root Directory e variáveis) devem ser feitas diretamente no painel do Railway.

## 1. Serviço: API (Backend)

*   **Root Directory**: `/` (Raiz do Monorepo)
*   **Build Command**: (Deixar em branco ou usar o padrão detectado pelo `nixpacks.toml`)
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
*   **Playwright (Consulta Processual/TRF1)**: o pacote npm está em `backend/package.json` (workspace `@sinprfes/backend`) e **não** em `site`/`mobile`. O Railway deve buildar com Root Directory `/` para ler `nixpacks.toml` da raiz; nesse fluxo a fase `[phases.build]` executa `pnpm --filter @sinprfes/backend run build:railway`, que roda `backend/scripts/prepare-playwright.js` no diretório `backend` e instala o Chromium (`npx playwright install chromium`) no artefato final do backend.
*   **Node.js**: O projeto está fixado na versão **20.x**. O Railway deve detectar isso automaticamente via `.nvmrc` na raiz ou `engines` no `package.json`. Caso precise forçar, use `NIXPACKS_NODE_VERSION=20`.
*   **Gerenciador de Pacotes**: Utilizar exclusivamente **pnpm**.
*   **Segurança**: Nunca inclua segredos em Dockerfiles ou no código. Utilize sempre as variáveis de ambiente do painel do Railway.
*   **Shared Code**: O build do SITE copia automaticamente a pasta `/shared` para `public/shared` para que os scripts do frontend possam acessá-la.


## 3. Diagnóstico operacional do Playwright (Backend)

No serviço de API, execute no shell do container/runtime:

- `pnpm --filter @sinprfes/backend run check:playwright`

Saídas esperadas:

- `PLAYWRIGHT_PACKAGE_OK`
- `PLAYWRIGHT_BROWSER_PRESENT`
- `PLAYWRIGHT_LAUNCH_OK`

Falhas classificadas:

- `PLAYWRIGHT_PACKAGE_MISSING`: pacote npm ausente em `backend`.
- `PLAYWRIGHT_BROWSER_MISSING`: executável Chromium não foi instalado no runtime.
- `PLAYWRIGHT_SYSTEM_DEPS_MISSING`: libs Linux ausentes no host.
- `PLAYWRIGHT_LAUNCH_FAILED`: falha real de launch não relacionada a pacote/browser/deps.

## 4. Variáveis de ambiente (Playwright)

Nenhuma variável de ambiente existente corrige ausência do executável Chromium por si só.
A ausência do binário é resolvida no build (instalação via `playwright install chromium`), não por `env`.

Variáveis já suportadas e opcionais para comportamento:

- `PLAYWRIGHT_ENABLED`
- `PLAYWRIGHT_BROWSER`
- `PLAYWRIGHT_LAUNCH_TIMEOUT_MS`
- `PLAYWRIGHT_EXTRA_ARGS`
- `CONSULTA_PROCESSUAL_HEADLESS`

