# Módulo Consulta Processual

## Objetivo
Permitir que usuários de **DIRETORIA** consultem processos públicos vinculados ao CPF cadastrado no perfil autenticado, sem digitação manual de CPF no frontend.

## Fluxo funcional
1. Usuário autenticado abre a aba **Consulta Processual** na Área do Filiado.
2. Frontend chama `GET /api/consulta-processual/me`.
3. Backend valida autenticação + permissão `CONSULTA_PROCESSUAL_CONSULTAR`.
4. Backend recupera o CPF do usuário logado no banco (`filiados`).
5. Service orquestrador executa providers habilitados (inicialmente TRF1).
6. Retorno é normalizado em payload multi-source.

## Arquitetura por providers
Estrutura backend:

- `backend/src/modules/consulta-processual/controller`
- `backend/src/modules/consulta-processual/service`
- `backend/src/modules/consulta-processual/providers`
- `backend/src/modules/consulta-processual/parsers`
- `backend/src/modules/consulta-processual/dto`
- `backend/src/modules/consulta-processual/validators`
- `backend/src/modules/consulta-processual/utils`

### Contrato de provider
Todos os providers implementam:
- `getId()`
- `getLabel()`
- `isEnabled()`
- `consultarPorCpf({ cpf, cpfMasked, requestId, userId })`

## Provider inicial: TRF1
- URL: `https://pje1g-consultapublica.trf1.jus.br/consultapublica/ConsultaPublica/listView.seam`
- Estratégia: automação navegador (Playwright) no backend.
- Parsing separado em `parsers/trf1ProcessParser.js`.

## Segurança e privacidade
- CPF usado apenas do usuário autenticado.
- CPF sanitizado para dígitos e validado (11 dígitos).
- CPF mascarado em logs e payload (`cpfMasked`).
- Cache e chave com hash de CPF (sem CPF puro).

## Endpoint
- `GET /api/consulta-processual/me`
- Proteções: `auth` + `requirePermission('CONSULTA_PROCESSUAL_CONSULTAR')`

## Cache e contenção de abuso
- Cache em memória por provider + hash(CPF), TTL padrão 5 min.
- Bloqueio de consultas sequenciais em intervalo curto por usuário (`CONSULTA_PROCESSUAL_MIN_INTERVAL_MS`).
- Reuso de execução concorrente por `userId + provider`.

## Variáveis de ambiente
### Flags do módulo
- `CONSULTA_PROCESSUAL_ENABLED` (default: `true`)
- `CONSULTA_PROCESSUAL_TRF1_ENABLED` (default: `true`)
- `CONSULTA_PROCESSUAL_TIMEOUT_MS` (default: `45000`)
- `CONSULTA_PROCESSUAL_INITIAL_LOAD_TIMEOUT_MS` (default: `30000`)
- `CONSULTA_PROCESSUAL_SEARCH_TIMEOUT_MS` (default: `15000`)
- `CONSULTA_PROCESSUAL_CACHE_TTL_MS` (default: `300000`)
- `CONSULTA_PROCESSUAL_MIN_INTERVAL_MS` (default: `3000`)
- `CONSULTA_PROCESSUAL_DEBUG` (default: `false`)
- `CONSULTA_PROCESSUAL_HEADLESS` (default: `true` em `production`; `false` em `dev` quando não definido)
- `CONSULTA_PROCESSUAL_DEBUG_SCREENSHOT` (default: `false`)

### Flags de automação Playwright (novas)
- `PLAYWRIGHT_ENABLED` (default: `true`)
- `PLAYWRIGHT_BROWSER` (default: `chromium`)
- `PLAYWRIGHT_LAUNCH_TIMEOUT_MS` (default: `30000`)
- `PLAYWRIGHT_EXTRA_ARGS` (default: `--no-sandbox,--disable-setuid-sandbox`)
- `PLAYWRIGHT_INSTALL_CHROMIUM` (default: `true`, usada em build para preparar browser)
- `PLAYWRIGHT_INSTALL_WITH_DEPS` (default: `true`, instala dependências Linux do Chromium no build)

## Notas operacionais (Railway / monorepo)
- Serviço API no Railway roda com **Root Directory `/`** (raiz do monorepo).
- Dependências são instaladas via `pnpm install --frozen-lockfile` a partir da raiz e resolvidas por workspace.
- O backend roda do workspace `backend` via `pnpm --filter @sinprfes/backend start`.
- Por isso o Playwright deve estar em `backend/package.json` (runtime do backend), nunca em `site/`, `mobile/` ou apenas no root.

### Build/Start recomendados para API no Railway
- **Build Command**: `npm install -g pnpm@9.15.9 --force && PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 PLAYWRIGHT_INSTALL_WITH_DEPS=true pnpm install --frozen-lockfile && pnpm --filter @sinprfes/backend run build:railway`
- **Start Command**: `pnpm --filter @sinprfes/backend start`

### Diagnóstico Playwright
- Script: `pnpm --filter @sinprfes/backend run check:playwright`
- Saídas esperadas:
  - `PLAYWRIGHT_PACKAGE_OK`
  - `PLAYWRIGHT_BROWSER_OK`
  - `PLAYWRIGHT_LAUNCH_OK`
- Falhas tratadas:
  - `PLAYWRIGHT_PACKAGE_MISSING`
  - `PLAYWRIGHT_BROWSER_MISSING`
  - `PLAYWRIGHT_SYSTEM_DEPS_MISSING`
  - `PLAYWRIGHT_LAUNCH_FAILED`

## Conclusão sobre env vars existentes do projeto
As env vars globais já existentes no serviço (por exemplo: `APP_BASE_URL`, `DATABASE_URL`, `JWT_SECRET`, integrações Google/Cloudinary/Instagram/MinIO/Resend) **não resolvem instalação de Playwright**. O problema é de dependência + preparação de browser no build/runtime, não de segredo/credencial.

## Limitações conhecidas
- Atualmente integra apenas TRF1.
- Estrutura HTML da origem pode mudar e exigir ajustes de parser/selectors.
- Cache é local em memória (por processo Node), sem distribuição.

## Plano de expansão (fase futura)
Inclusão de novos tribunais sem alterar o contrato frontend:
- novo provider;
- novo parser;
- nova flag de habilitação.
