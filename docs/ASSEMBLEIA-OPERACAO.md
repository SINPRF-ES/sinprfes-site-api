# Assembleia e Votação - Guia de Operação (Playbook)

Este documento descreve os procedimentos de observabilidade, métricas e solução de problemas para o módulo de Assembleias.

## 1. Observabilidade

### Logs Estruturados
Todos os logs seguem o formato JSON e incluem:
- `level`: INFO, ERROR, WARN.
- `timestamp`: ISO8601.
- `requestId`: ID único da requisição (propagado via middleware).
- `assembleiaId`: Contexto da assembleia.
- `userId`: Usuário que realizou a ação.
- `elapsedMs`: Tempo de execução.

**Exemplo de consulta no log:**
`message: "AssembleiaVotarSucesso"` -> Para monitorar volume de votos.

### Socket.IO
Eventos são emitidos para a sala `assembleia_{id}`.
Principais eventos para monitoramento:
- `assembleia:status_changed`: Transições de fase.
- `votacao:iniciada` / `votacao:encerrada`: Ciclo de vida dos itens.

## 2. Métricas Sugeridas

Monitorar via agregação de logs:
- **Taxa de Sucesso de Check-in:** `AssembleiaCheckinSucesso` vs `AssembleiaCheckinErro`.
- **Latência Crítica:** Monitorar `elapsedMs` em `AssembleiaEstadoCompletoSucesso` (endpoint mais pesado).
- **Abstenções:** Monitorar payload de `ABSTENCAO_AUTOMATICA_APLICADA` na auditoria.

## 3. Segurança e Antiabuso

### Rate Limits
Aplicados via middleware `src/middlewares/assembleiaRateLimit.js`:
- **Comandos (Voto, Iniciar, Abrir):** 10 req/min por IP.
- **Check-in:** 5 req/min por IP (prevenção de brute force de token).
- **Estado:** 20 req/10s (reidratação frequente permitida mas controlada).

### Auditoria Imutável
A tabela `assembleia_auditoria` deve ser tratada como SSoT para fins jurídicos.
**Regra:** Proibido DELETE/UPDATE.

## 4. Solução de Problemas (Troubleshooting)

### "Referência não definida ao iniciar o servidor"
- Verifique `module.exports` no `assembleias.controller.js`.
- Garanta que as funções não foram renomeadas sem atualizar o export.

### "Usuário não consegue votar"
- Verifique se ele fez check-in *antes* da votação iniciar (snapshot de elegibilidade).
- Verifique se o perfil não é ADMIN ou COMUNICADOR.

### "Socket não recebe atualizações"
- Verifique se o cliente emitiu `join_assembleia` com o ID correto.
- Verifique se o middleware de auth do socket (se existir) está bloqueando.
