# Checklist de Go-Live - Módulo de Assembleias

Instruções para a equipe técnica e diretoria antes da primeira assembleia real em produção.

## 1. Infraestrutura (PROD)
- [ ] Deploy realizado com sucesso no ambiente de nuvem.
- [ ] Variável `ASSEMBLEIA_ENV=prod` configurada.
- [ ] `JWT_SECRET` e `RESEND_API_KEY` validadas.
- [ ] Banco de dados com migrações atualizadas (v4).

## 2. Segurança e Controle
- [ ] Rate limit ativo (10 req/min para comandos).
- [ ] Bloqueio de check-in para perfis ADMIN e COMUNICADOR verificado.
- [ ] Auditoria append-only funcional e registrando eventos.

## 3. Experiência do Usuário (Mobile)
- [ ] App Mobile apontando para o endpoint de produção.
- [ ] Socket.IO conectando e recebendo eventos de status.
- [ ] Reidratação de estado funcionando após reinício do app.

## 4. Governança e Homologação
- [ ] Roteiro de Homologação assinado e arquivado.
- [ ] Comitê de crise/suporte técnico definido para o horário do evento.
- [ ] Piloto Controlado finalizado (se houver).

## 5. Autorização Final
O sistema está apto para uso oficial?
( ) Sim
( ) Não

Responsável Técnico: _____________________
Responsável Institucional: _________________
Data: ____/____/2026
