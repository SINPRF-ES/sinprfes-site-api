# Resumo da Implementação - Correção de Loop 401 e Auth Gate

## Problema
O app apresentava uma regressão onde chamadas a rotas protegidas (como `/api/publicacoes`) eram disparadas antes da inicialização completa da sessão (bootstrap), resultando em erros 401 ("Token de acesso não informado"). O interceptor de resposta tratava qualquer 401 limpando a sessão, o que gerava um loop infinito de solicitações de biometria/login.

## Soluções Implementadas

### 1. AuthGate (Bootstrap Control)
- Criado o serviço `AuthStore` (`mobile/src/services/authStore.ts`) para gerenciar o estado de prontidão (`isReady`) da autenticação.
- O `AuthProvider` agora chama `AuthStore.init()` no início do carregamento e `AuthStore.setReady()` assim que a sessão inicial é restaurada do storage.

### 2. Interceptor de Requisição (Gatekeeper)
- O interceptor do Axios em `apiService.ts` agora identifica rotas protegidas através da função `isProtectedRoute`.
- Para rotas protegidas, o interceptor executa `await AuthStore.waitReady()`, garantindo que a chamada só prossiga após o token ter sido restaurado do storage.

### 3. Tratamento Robusto de 401 (Prevenção de Loop)
- O interceptor de resposta foi atualizado para distinguir entre diferentes causas de 401:
    - **Bootstrap em andamento ou Token Ausente:** Se `authReady` for falso ou a mensagem for "Token de acesso não informado", o app aguarda o gate e tenta a requisição mais uma vez (retry 1x) em vez de limpar a sessão.
    - **Token Expirado (Normal):** Se o bootstrap já terminou, tenta o fluxo de Refresh Token com trava de concorrência (`isRefreshing`).
    - **Falha Crítica de Refresh:** A sessão só é limpa (`limparSessao()`) se o refresh token existir mas falhar na renovação, ou se não houver refresh token após o bootstrap.

### 4. Observabilidade
Adicionados logs detalhados para rastrear o fluxo de decisão:
- `AUTH_BOOTSTRAP_START` / `AUTH_BOOTSTRAP_DONE`
- `API_REQ_AUTH_HEADER_SET: true/false`
- `API_401_BOOTSTRAP`
- `API_401_MISSING_TOKEN`
- `API_401_REFRESH_START` / `SUCCESS` / `FAIL`
- `SESSION_CLEARED_REASON: refresh_failed`

## Arquivos Alterados
- `mobile/src/services/authStore.ts` (Novo)
- `mobile/src/hooks/useAuth.tsx`
- `mobile/src/services/apiService.ts`
- `mobile/src/services/driveService.ts`
- `mobile/src/services/deviceService.ts`

## Checklist de Testes (Manual)
- [ ] Abrir app após atualização: deve carregar Publicações sem pedir biometria repetidamente.
- [ ] Verificar logs: confirmar que as chamadas aguardam `AUTH_BOOTSTRAP_DONE`.
- [ ] Logout/Login: garantir que o fluxo de autenticação continua funcional.
- [ ] Expiração de token: forçar um token expirado e validar se o refresh funciona sem deslogar o usuário.
