# Configuração do Railway (Canon do Monorepo)

Para garantir o deploy correto dos serviços no Railway, siga as instruções abaixo para cada serviço. **Não utilize arquivos `railway.toml` no repositório**, pois a configuração deve ser feita diretamente no painel do Railway para respeitar os Root Directories do monorepo.

## 1. Serviço: API (Backend)

*   **Root Directory**: `/` (Raiz do Monorepo)
*   **Build Command**: `npm install -g pnpm@9.15.9 --force && pnpm install --frozen-lockfile`
*   **Start Command**: `pnpm run start:backend`
*   **Variáveis de Ambiente**:
    *   `PORT`: `8080` (ou conforme desejado)
    *   `NODE_ENV`: `production`
    *   `DATABASE_URL`: (URL do Postgres)
    *   `JWT_SECRET`: (Segredo para tokens)
    *   `GOOGLE_APPLICATION_CREDENTIALS_JSON`: (JSON das credenciais do Google Drive)
    *   `RESEND_API_KEY`: (Chave da API do Resend)

## 2. Serviço: SITE (Frontend + Proxy)

*   **Root Directory**: `/` (Raiz do Monorepo)
*   **Build Command**: `npm install -g pnpm@9.15.9 --force && pnpm install --frozen-lockfile && pnpm run build:site`
*   **Start Command**: `pnpm run start:site`
*   **Variáveis de Ambiente**:
    *   `PORT`: `8080`
    *   `API_BASE_URL`: `https://api.sinprfes.org.br` (URL do serviço de API acima)

## Observações Gerais

*   **Root Directory**: É mandatório configurar o **Root Directory** como `/` no painel do Railway para que o `pnpm-lock.yaml` na raiz seja detectado e utilizado corretamente pelo processo de build.
*   **Node.js**: O projeto está fixado na versão **20.x**. O Railway deve detectar isso automaticamente via `.nvmrc` na raiz ou `engines` no `package.json`. Caso precise forçar, use `NIXPACKS_NODE_VERSION=20`.
*   **Gerenciador de Pacotes**: Utilizar exclusivamente **pnpm**.
*   **Segurança**: Nunca inclua segredos em Dockerfiles ou no código. Utilize sempre as variáveis de ambiente do painel do Railway.
*   **Shared Code**: O build do SITE copia automaticamente a pasta `/shared` para `public/shared` para que os scripts do frontend possam acessá-la.
