# Checklist de Testes (Smoke Test): Módulo de Assembleias

Este checklist deve ser seguido para validar o fluxo completo de uma assembleia nas 4 fases.

---

## Fase 1: Criação do Evento
- [ ] Criar evento com perfil de Gestão.
- [ ] Validar se os tipos aparecem por extenso (Assembleia Geral Ordinária / Extraordinária).
- [ ] Validar obrigatoriedade de todos os campos (Título, Pauta, Data, 1ª/2ª Chamadas, Anexo).
- [ ] Verificar se a data/hora de criação é registrada nos metadados.
- [ ] Consultar o evento criado com um perfil de Filiado (deve estar visível).
- [ ] Tentar cancelar o evento (validar obrigatoriedade de justificativa).

---

## Fase 2: Abertura e Credenciamento
- [ ] Iniciar assembleia como Diretor (Estado deve mudar para `ABERTA`).
- [ ] Gerar token de check-in (validar formato de 6 dígitos).
- [ ] Verificar check-in automático do Diretor que gerou o token.
- [ ] Validar check-in de Filiado com token correto.
- [ ] Validar rejeição de check-in com token inválido.
- [ ] Verificar contagem de quórum:
    - [ ] Somar apenas filiados ATIVOS.
    - [ ] Excluir perfis ADMIN e COMUNICADOR da contagem.
- [ ] Validar exibição em tempo real do status do quórum (Atingido / Não Atingido).
- [ ] Validar aplicação automática da regra de 2ª chamada após o horário previsto.
- [ ] Definir Mesa: selecionar Presidente e Secretário entre os presentes.
- [ ] Tentar avançar para Fase 3 sem definir a Mesa (deve ser bloqueado).

---

## Fase 3: Execução (Debates e Votações)
- [ ] **Interação:**
    - [ ] Pedir palavra como filiado (verificar se entra na fila).
    - [ ] Propor encaminhamento (verificar se fica visível para todos).
- [ ] **Votação:**
    - [ ] Iniciar votação como Presidente da Mesa (definir tempo 1-5 min).
    - [ ] Validar snapshot: filiado que faz check-in APÓS o início não deve ver botões de voto.
    - [ ] Registrar votos SIM/NÃO e verificar atualização nominal em tempo real.
    - [ ] Alterar voto durante o cronômetro (validar se o total atualiza corretamente).
    - [ ] Validar abstenção automática para quem não votou após o fim do tempo.
- [ ] **Recontagem (Atualizar Quórum):**
    - [ ] Acionar recontagem como Presidente.
    - [ ] Verificar se todos os check-ins anteriores foram invalidados.
    - [ ] Verificar geração de novo token.
    - [ ] Validar novo check-in geral (Presidente automático).

---

## Fase 4: Encerramento e Relatório
- [ ] Encerrar assembleia (Estado deve mudar para `ENCERRADA`).
- [ ] Validar bloqueio de qualquer interação (voto, palavra, proposta).
- [ ] **Relatório:**
    - [ ] Gerar relatório como Gestor.
    - [ ] Verificar se o PDF é enviado por e-mail.
    - [ ] Validar conteúdo do PDF:
        - [ ] Horários de início e fim.
        - [ ] Lista nominal de presentes.
        - [ ] Itens votados e resultados detalhados.
        - [ ] Watermark e QR Code de segurança.
        - [ ] Identificação do gerador do relatório.

---

## Testes de Robustez
- [ ] Fechar e abrir o app durante uma votação (deve restaurar estado e cronômetro).
- [ ] Tentar votar após o encerramento da assembleia via API direta (deve ser bloqueado).
- [ ] Simular troca de rede (Wi-Fi/4G) e verificar reconexão do WebSocket.
