# Plano Técnico: Assembleias e Votações

Este documento detalha o roteiro de implementação, focado na prioridade do App Mobile e na robustez do Backend.

## 1. Fase 1: Fundação e Schema (CONCLUÍDO)
- **Database:** Criação das tabelas de assembleias, quoruns, check-ins, votações, votos, propostas e auditoria (PostgreSQL).
- **Backend Service:** Implementação de `assembleias.service.js` para CRUD básico e gerenciamento de estado da sessão.
- **Auditoria:** Mecanismo de log imutável para todos os eventos de gestão e presença.

## 2. Fase 2: Real-time e Quórum (CONCLUÍDO)
- **Socket.IO:** Configuração do servidor WebSocket para broadcasts de estado e eventos nominais.
- **Check-in:** Lógica de geração de tokens de 6 dígitos e validação de presença por chamada de quórum.
- **Real-time Events:** Emissão de eventos para abertura/fechamento de sessão e chamadas de quórum.

## 3. Fase 3: UI Mobile - Presença e Gestão (PRÓXIMA FASE)
- **Lista de Assembleias:** Tela de listagem com status em tempo real.
- **Fluxo de Check-in:** Interface para inserção de token e confirmação de presença.
- **Painel de Gestão (Diretoria):** Controles mobile para abrir sessão e gerar tokens de quórum.
- **Mesa Diretora:** Seleção de componentes da mesa via App.

## 4. Fase 4: Votação e Snapshot (Backend + Mobile)
- **Snapshot Logic:** Implementação no backend da captura de elegibilidade no momento da abertura do item de pauta.
- **Painel de Votos:** Interface mobile para votação nominal (SIM/NÃO) com cronômetro.
- **Live Counting:** Atualização do gráfico/lista de votos em tempo real via socket.
- **Abstenção Automática:** Lógica de encerramento de votação e preenchimento de abstenções.

## 5. Fase 5: Interação (Palavra e Propostas)
- **Fila de Palavra:** UI para solicitação de fala e visualização de fila; controles de reordenação para diretoria.
- **Propostas:** Submissão de propostas e lógica de retirada automática por ausência de autor no snapshot.

## 6. Fase 6: Finalização e Site (Consulta)
- **Ata Automática:** Geração de PDF consolidado com todos os eventos e resultados.
- **Área do Filiado (Web):** Espelhamento das assembleias encerradas, consulta de histórico e download de atas.
- **Segurança:** Bloqueio de interações de escrita via interface web.

---
**Nota:** Nenhuma interface de usuário (UI) funcional foi implementada nas Fases 1 e 2. O estado atual é puramente de infraestrutura de backend e comunicação.
