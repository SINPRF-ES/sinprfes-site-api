# Guia de Deploy no Railway - SINPRF-ES

Este documento descreve como configurar e implantar os dois serviços principais do monorepo no Railway: o **SITE** (Frontend + Proxy) e a **API** (Backend).

## 1. Canonização de Domínios e URLs

- **SITE_BASE_URL (Produção):** `https://sinprfes.org.br`
- **API_BASE_URL (Produção):** `https://api.sinprfes.org.br`

---

## 2. Serviço SITE (Frontend Web)

Este serviço serve os arquivos estáticos do site institucional e da área do filiado, além de atuar como proxy para a API para evitar problemas de CORS.

### Configuração no Railway:
- **Root Directory:** `/site`
- **Build Command:** `pnpm install && mkdir -p public/shared && cp -R ../shared/* public/shared/` (automático via `railway.toml`)
- **Start Command:** `node server.js` (automático via `railway.toml`)

### Variáveis de Ambiente Necessárias:
- `PORT`: `8080` (O Railway costuma injetar automaticamente)
- `API_BASE_URL`: `https://api.sinprfes.org.br`

---

## 3. Serviço API (Backend)

Este serviço provê a API REST em JSON para o site e para o aplicativo mobile.

### Configuração no Railway:
- **Root Directory:** `/` (raiz do monorepo)
- **Build Command:** `npm install -g pnpm@9.15.9 --force && PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 PLAYWRIGHT_INSTALL_WITH_DEPS=true pnpm install --frozen-lockfile && pnpm --filter @sinprfes/backend run build:railway`
- **Start Command:** `pnpm --filter @sinprfes/backend start`

### Variáveis de Ambiente Necessárias:
- `PORT`: `3000` (O Railway costuma injetar automaticamente)
- `DATABASE_URL`: (URL de conexão com o PostgreSQL)
- `JWT_SECRET`: (Segredo para tokens JWT)
- `CLOUDINARY_URL`: (Configuração do Cloudinary para imagens)
- *(E outras variáveis já configuradas no .env do backend)*

> Nota técnica (Consulta Processual/TRF1): o Railway instala dependências a partir da raiz (`/`) e o runtime da API executa o workspace `backend`; por isso o Playwright deve ficar em `backend/package.json` e o Chromium precisa ser preparado durante o build com dependências Linux (`playwright install --with-deps chromium`).

---

## 4. Checklist de Validação (via curl)

Após o deploy, execute os comandos abaixo para garantir que a separação está correta:

### Validação do SITE:
1. **Health Check:**
   `curl -i https://sinprfes.org.br/health`
   - Esperado: `200 OK` com JSON `{"status":"ok","service":"site"}`
2. **Root (HTML):**
   `curl -i https://sinprfes.org.br/`
   - Esperado: `200 OK` com conteúdo HTML (deve conter `<!DOCTYPE html>`)
3. **Proxy para API:**
   `curl -i https://sinprfes.org.br/api/health`
   - Esperado: `200 OK` com JSON `{"status":"ok","service":"api", ...}` (Vindo do backend via proxy)

### Validação da API:
1. **Health Check:**
   `curl -i https://api.sinprfes.org.br/health`
   - Esperado: `200 OK` com JSON `{"status":"ok","service":"api"}`
2. **Root (JSON, NÃO HTML):**
   `curl -i https://api.sinprfes.org.br/`
   - Esperado: `200 OK` com JSON `{"status":"ok","service":"api", ...}`
3. **Segurança (Login GET):**
   `curl -i https://api.sinprfes.org.br/api/auth/login`
   - Esperado: `404 Not Found` (ou `405 Method Not Allowed`), mas **NUNCA** o HTML do site.
4. **Teste de Body Parser (Login POST):**
   `curl -i -X POST https://api.sinprfes.org.br/api/auth/login -H "Content-Type: application/json" --data-raw '{"cpf":"00000000000","senha":"teste","deviceId":"diag"}'`
   - Esperado: Erro de credencial (JSON), confirmando que o body parser está funcionando e a rota existe.

---

## 5. Notas de Manutenção
- O monorepo utiliza **pnpm workspaces**. Não devem existir arquivos `package-lock.json` ou `pnpm-lock.yaml` dentro das subpastas `/site` ou `/backend`. O único lockfile deve estar na raiz do repositório.
- A pasta `backend/public` foi removida para garantir que a API nunca sirva arquivos estáticos do site acidentalmente.
- Os arquivos estáticos do SITE foram movidos para a subpasta `/site/public` por segurança, para evitar a exposição de arquivos do servidor (como `server.js`).
- Durante o build do SITE, os arquivos da pasta raiz `/shared` são copiados para `/site/public/shared` para garantir que o serviço seja auto-contido.
