# ASSEMBLEIA - DIA DO EVENTO (Checklist)

Este documento descreve as etapas críticas para o sucesso operacional da assembleia no dia do evento.

## Checklist T-30min (Preparação Técnica)

- [ ] Verificar se o backend está online e respondendo ao endpoint de `/health`.
- [ ] Validar a saúde do banco de dados (sem travamentos ou latência alta).
- [ ] Confirmar que o serviço de WebSocket (Socket.IO) está aceitando conexões.
- [ ] Verificar se as variáveis de ambiente de Piloto (`ASSEMBLEIA_PILOTO_ATIVO`) estão configuradas se necessário.

## Checklist T-0 (Abertura)

- [ ] **Assembleia Criada:** Confirmar que a assembleia do dia está com status `CRIADA`.
- [ ] **Acesso da Diretoria:** Garantir que o Presidente e o Secretário estão logados no App.
- [ ] **Ação "Abrir":** O Diretor deve acionar "Abrir Assembleia" para iniciar o credenciamento (Phase 2).
- [ ] **Geração de Token:** Gerar o token de quórum (1ª Chamada) e divulgar aos presentes.

## Checklist Durante a Execução (Phase 3)

- [ ] **Monitoramento de Check-ins:** Acompanhar o quórum pelo Painel de Diagnóstico (`/api/assembleias/:id/diagnostico`).
- [ ] **Definição da Mesa:** Garantir que Presidente e Secretário realizaram check-in ANTES de compor a mesa.
- [ ] **Iniciar Execução:** Acionar "Iniciar Execução" somente após quórum atingido ou 2ª chamada.
- [ ] **Votações:** Monitorar se os votos estão sendo computados e se o cronômetro está visível para todos.

## Checklist Pós-Encerramento (Phase 4)

- [ ] **Ação "Encerrar":** O Presidente deve encerrar a assembleia, garantindo que não há votações pendentes.
- [ ] **Auditoria:** Verificar se todos os eventos foram registrados na tabela `assembleia_auditoria`.
- [ ] **Relatório:** Solicitar a geração do relatório institucional (Stub) e anotar o `request_id` para rastreabilidade.
