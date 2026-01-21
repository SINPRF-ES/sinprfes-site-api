# Plano Técnico: Assembleias e Votações

Este documento detalha a estrutura de arquivos, serviços e responsabilidades para a implementação do sistema de Assembleias.

## 1. Backend (src/)

### 1.1. Rotas (`src/routes/assembleias.routes.js`)
Endpoints protegidos por perfil (`ADMIN`, `DIRETORIA`, `FILIADO`):
- `GET /api/assembleias`: Lista assembleias (Filiado vê ABERTAS/ENCERRADAS, Diretoria vê todas).
- `GET /api/assembleias/:id`: Detalhes da sessão.
- `POST /api/assembleias`: (Diretoria) Criar nova sessão.
- `PATCH /api/assembleias/:id/abrir`: (Diretoria) Mudar estado para ABERTA.
- `POST /api/assembleias/:id/quorum`: (Diretoria) Gerar novo token de quórum.
- `POST /api/assembleias/:id/checkin`: (Todos) Realizar check-in com token.
- `POST /api/assembleias/:id/votacao`: (Diretoria) Iniciar novo item de votação.
- `POST /api/assembleias/:id/votacao/:vid/votar`: (Filiado) Registrar voto.
- `GET /api/assembleias/:id/ata`: Gerar PDF da ata (backend-side).

### 1.2. Controller (`src/controllers/assembleias.controller.js`)
- Orquestração das chamadas.
- Acionamento dos broadcasts de Socket.IO após persistência.

### 1.3. Service (`src/services/assembleias.service.js`)
- **Lógica de Snapshot:** Ao abrir votação, seleciona IDs da tabela `assembleia_checkins` filtrando pelo `quorum_id` mais recente daquela assembleia.
- **Lógica de Abstenção:** No fechamento da votação, identifica quem estava no snapshot mas não votou, inserindo registros como `ABSTENCAO`.
- **Lógica de Propostas:** Verificação de presença do autor antes de permitir abertura de votação da proposta.

### 1.4. WebSocket (`src/websocket/assembleia.socket.js`)
- Gerenciamento de salas por `assembleia_id`.
- Handlers para `join_assembleia` e emissão de eventos de tempo real.

---

## 2. Mobile (mobile/src/)

### 2.1. Telas (Screens)
- `Assembleias/ListaAssembleiasScreen.tsx`: Listagem simples com status.
- `Assembleias/SessaoScreen.tsx`:
    - Componente de Check-in (Token).
    - Componente de Votação Ativa (Timer + Botões SIM/NAO).
    - Componente de Resultado Parcial (Lista de nomes e votos).
    - Fila de Palavra e Lista de Propostas.
- `Assembleias/GestaoSessaoScreen.tsx`: (Apenas Diretoria) Botões de controle de fluxo, geração de tokens, abertura de pauta.

### 2.2. Services & Hooks
- `services/assembleiaService.ts`: Chamadas Axios para a API.
- `hooks/useAssembleiaSocket.ts`: Hook customizado para encapsular a lógica de escuta de eventos e atualização de estado local do app.

---

## 3. Site (public/)

### 3.1. Frontend
- `area-filiado/assembleias.html`: Layout espelhado (Production 2.0 style) focado em consulta.
- `js/area-filiado/assembleias.js`:
    - Consumo da API via `window.Api.apiFetch`.
    - Exibição de histórico de votações e atas.
    - **Regra:** Não permite envio de comandos de gestão ou votos (redireciona para o App Mobile se o usuário tentar interagir).

---

## 4. Ordem de Implementação Sugerida

1.  **Fase 1 (Fundação):** Migrations do Banco de Dados e Cadastro de Assembleia.
2.  **Fase 2 (Presença):** Lógica de Tokens de Quórum e Check-in no App.
3.  **Fase 3 (Votação):** Backend de Snapshot e registro de votos via Socket.IO.
4.  **Fase 4 (Interação):** Fila de palavra e Propostas.
5.  **Fase 5 (Encerramento):** Geração automática de Ata e Logs de Auditoria.
6.  **Fase 6 (Consulta):** Visualização histórica no Site.
