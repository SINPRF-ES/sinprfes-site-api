# Configuração do Railway (Canon do Monorepo)

Para garantir o deploy correto dos serviços no Railway, siga as instruções abaixo para cada serviço. **Não utilize arquivos `railway.toml` no repositório**, pois a configuração deve ser feita diretamente no painel do Railway para respeitar os Root Directories do monorepo.

## 1. Serviço: API (Backend)

*   **Root Directory**: `backend`
*   **Build Command**: `pnpm install --frozen-lockfile`
*   **Start Command**: `pnpm run start`
*   **Variáveis de Ambiente**:
    *   `PORT`: `8080` (ou conforme desejado)
    *   `NODE_ENV`: `production`
    *   `DATABASE_URL`: (URL do Postgres)
    *   `JWT_SECRET`: (Segredo para tokens)
    *   `GOOGLE_APPLICATION_CREDENTIALS_JSON`: (JSON das credenciais do Google Drive)
    *   `RESEND_API_KEY`: (Chave da API do Resend)

## 2. Serviço: SITE (Frontend + Proxy)

*   **Root Directory**: `site`
*   **Build Command**: `pnpm install --frozen-lockfile && pnpm run build`
*   **Start Command**: `pnpm run start`
*   **Variáveis de Ambiente**:
    *   `PORT`: `8080`
    *   `API_BASE_URL`: `https://api.sinprfes.org.br` (URL do serviço de API acima)

## Observações Gerais

*   **Node.js**: O projeto está fixado na versão **20.x**. O Railway deve detectar isso automaticamente via `.nvmrc` na raiz ou `engines` no `package.json`. Caso precise forçar, use `NIXPACKS_NODE_VERSION=20`.
*   **Gerenciador de Pacotes**: Utilizar exclusivamente **pnpm**.
*   **Segurança**: Nunca inclua segredos em Dockerfiles ou no código. Utilize sempre as variáveis de ambiente do painel do Railway.
*   **Shared Code**: O build do SITE copia automaticamente a pasta `/shared` para `public/shared` para que os scripts do frontend possam acessá-la.
