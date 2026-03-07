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
- `CONSULTA_PROCESSUAL_ENABLED` (default: `true`)
- `CONSULTA_PROCESSUAL_TRF1_ENABLED` (default: `true`)
- `CONSULTA_PROCESSUAL_TIMEOUT_MS` (default: `45000`)
- `CONSULTA_PROCESSUAL_INITIAL_LOAD_TIMEOUT_MS` (default: `30000`)
- `CONSULTA_PROCESSUAL_SEARCH_TIMEOUT_MS` (default: `15000`)
- `CONSULTA_PROCESSUAL_CACHE_TTL_MS` (default: `300000`)
- `CONSULTA_PROCESSUAL_MIN_INTERVAL_MS` (default: `3000`)
- `CONSULTA_PROCESSUAL_DEBUG` (default: `false`)
- `CONSULTA_PROCESSUAL_HEADLESS` (default: `true`)
- `CONSULTA_PROCESSUAL_DEBUG_SCREENSHOT` (default: `false`)

## Limitações conhecidas
- Atualmente integra apenas TRF1.
- Estrutura HTML da origem pode mudar e exigir ajustes de parser/selectors.
- Cache é local em memória (por processo Node), sem distribuição.

## Plano de expansão (fase futura)
Inclusão de novos tribunais sem alterar o contrato frontend:
- novo provider;
- novo parser;
- nova flag de habilitação.
