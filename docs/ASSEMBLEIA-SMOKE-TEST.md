# Checklist de Testes Manuais (Smoke Test) - Assembleias v1

Este checklist deve ser executado para validar a integridade do sistema após a Fase 4.

## 1. Gestão e Ciclo de Vida
- [ ] Criar uma nova assembleia (AGE/AGO).
- [ ] Abrir a assembleia (Estado: ABERTA).
- [ ] Gerar token de quórum (6 dígitos).
- [ ] Definir Presidente e Secretário da Mesa.
- [ ] Encerrar assembleia e verificar estado final.

## 2. Presença e Quórum
- [ ] Realizar check-in com token válido.
- [ ] Tentar check-in com token expirado ou inválido (deve falhar).
- [ ] Iniciar recontagem (novo quórum) e verificar se o contador de presentes reseta/atualiza.
- [ ] Validar que apenas o quórum vigente é exibido na sala.

## 3. Votação (Itens de Pauta)
- [ ] Iniciar votação de um item (Diretoria).
- [ ] Votar SIM/NÃO (Filiado elegível).
- [ ] Verificar broadcast nominal (nome do votante aparece na lista em tempo real).
- [ ] Verificar totalizadores (parciais) em tempo real.
- [ ] Validar regra de abstenção: deixar o tempo acabar sem votar e conferir se o registro virou ABSTENCAO no banco/estado final.

## 4. Elegibilidade e Snapshot
- [ ] Usuário que não fez check-in no quórum vigente tenta votar (deve ver mensagem de inelegibilidade).
- [ ] Usuário entra na assembleia APÓS o início de uma votação (deve ver que não é elegível para este item, mas elegível para o próximo).

## 5. Propostas e Encaminhamentos
- [ ] Criar novo encaminhamento via app.
- [ ] Retirar proposta automaticamente:
    1. Autor cria proposta.
    2. Nova chamada de quórum é feita.
    3. Autor NÃO faz check-in.
    4. Diretoria tenta iniciar votação daquela proposta.
    5. Sistema deve bloquear e marcar proposta como RETIRADA por ausência.

## 6. Robustez e Reentrada
- [ ] Fechar e abrir o app durante uma votação ativa. O estado deve ser restaurado integralmente (cronômetro, elegibilidade, votos já feitos).
- [ ] Simular queda de internet e retorno. O Socket.IO deve reconectar e o app deve re-hidratar o estado via API (verificar logs `[Assembleia.hydrate.start]`).
- [ ] Verificar se ao reentrar, o motivo de inelegibilidade (se houver) é exibido corretamente.

## 7. Auditoria e Logs (Verificação Técnica)
- [ ] Consultar tabela `assembleia_auditoria` e validar os eventos:
    - `ENTRADA_SESSAO` (Mobile login/entry)
    - `CHECKIN_ASSEMBLEIA`
    - `INICIO_VOTACAO`
    - `VOTO_REGISTRADO` (ou via auditoria genérica de votos)
    - `LAZY_CLOSE_VOTACAO`
    - `PROPOSTA_RETIRADA_AUSENCIA_AUTOR`
