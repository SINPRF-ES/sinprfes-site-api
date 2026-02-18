# Assembleia WebApp - CANON

Este documento define o papel do WebApp de Assembleia como interface primária para usuários de iOS e complementa o `ASSEMBLEIA-VOTACAO-CANON.md`.

## 1. Escopo e Propósito

O WebApp de Assembleia (`/assembleia-app/`) é um Single Page Application (SPA) construído com Vite + React, focado em fornecer uma experiência de alta fidelidade para votação e participação em tempo real, especialmente otimizado para iOS (Safari) e capaz de funcionar como PWA.

## 2. Decisão Arquitetural (ADR)

**Status:** Aprovado
**Contexto:** Usuários de iOS necessitam de uma experiência de participação em assembleias que seja fluida, suporte reconexão automática e se comporte como um aplicativo nativo sem a necessidade de distribuição via App Store para este sub-módulo específico.
**Decisão:** O WebApp de Assembleia é tratado como o cliente primário no iOS, mantendo o Backend como a única fonte de verdade (SSoT). O site institucional permanece estático para preservar performance e simplicidade.
**Consequências:**
- O fluxo de votação no iOS deve ser realizado via WebApp.
- O Backend deve garantir que o estado seja consistente entre diferentes clientes (Android Nativo e WebApp iOS).

## 3. Máquina de Estados do Cliente

O WebApp deve refletir fielmente o estado do Backend:
- **Hidratação Inicial:** Realizada via `GET /api/assembleias/:id/estado` ao entrar na sala.
- **Sincronização em Tempo Real:** Via Socket.IO (sala `assembleia_{id}`).
- **Reidratação:** Obrigatória ao reconectar ou ao retornar do background (evento `visibilitychange`).

## 4. Regras de Participação (SSoT)

- **Elegibilidade:** Definida pelo snapshot de check-in no momento do início da votação.
- **Abstenção Automática:** Filiados elegíveis que não votarem são registrados como ABSTENÇÃO pelo backend.
- **Voto Nominal:** Todos os votos são abertos e exibidos no painel em tempo real.
- **Mesa Diretora:** Somente usuários autorizados (Diretoria/Presidente) podem iniciar votações e gerar tokens de quórum.

## 5. Política de Cache e PWA

- **HTML/JS:** `no-cache` para garantir que o cliente sempre utilize a versão mais recente da lógica de votação.
- **Socket.IO:** Deve possuir lógica de buffer e reconexão agressiva.
- **Offline:** O WebApp deve exibir uma tela de erro clara caso a conexão seja perdida durante uma votação, orientando a reconexão.

## 6. Checklist de Testes iOS

- [ ] Visualização correta no Safari Mobile.
- [ ] Funcionamento após "Adicionar à Tela de Início".
- [ ] Suporte a Safe Areas (Notch e Home Indicator).
- [ ] Persistência de sessão após suspensão do app.
- [ ] Recebimento de eventos via Socket.IO em rede 4G/5G.
