# Matriz de Paridade Real — Guardian Soft

Este documento apresenta o estado atual de paridade entre as plataformas App (Mobile) e Site (Área do Filiado).

## 📊 Matriz Global

| Módulo | App (Mobile) | Site (Web) | Backend (API) | Permissões | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Início (Home)** | ✅ `HomeScreen.tsx` | ✅ `sec-home` | `/api/auth/me` | Todos | ✅ OK |
| **Notícias** | ✅ `NoticiasScreen.tsx` | ✅ `sec-noticias` | `/api/noticias` | `NOTICIAS_GERENCIAR` | ✅ OK |
| **Meus Dados** | ✅ `MeusDadosScreen.tsx` | ✅ `sec-meus-dados` | `/api/filiados/me` | `VIEW_SELF`, `EDIT_SELF` | ✅ OK |
| **Filiados (Lista)** | ✅ `FiliadosScreen.tsx` | ✅ `sec-filiados` | `/api/filiados` | `LIST_FILIADOS` | ✅ OK |
| **Filiados (Gestão)** | ✅ `CriarFiliadoScreen.tsx` | ✅ `tab-novo-filiado` | `/api/filiados` | `CREATE_FILIADO`, `EDIT_FILIADO` | ✅ OK |
| **Publicações** | ✅ `PublicacoesScreen.tsx` | ✅ `sec-publicacoes` | `/api/publicacoes` | Todos (Leitura) | ✅ OK |
| **Ressarcimento** | ✅ `RessarcimentoScreen.tsx`| ✅ `sec-ressarcimento`| `/api/ressarcimento` | Todos (Criação) | ✅ OK |
| **Jogos 2026** | ✅ `JogosScreen.tsx` | ✅ `sec-jogos` | `/api/jogos` | `JOGOS_GERENCIAR` | ✅ OK |
| **Assembleias** | ✅ `AssembleiaStack` | ✅ `sec-assembleias` | `/api/assembleias` | `VOTACAO_VOTAR` | ✅ OK |
| **Estatuto** | ✅ `EstatutoScreen.tsx` | ✅ `sec-estatuto` | N/A (Static/S3) | Todos | ✅ OK |
| **Segurança** | ✅ `SegurancaScreen.tsx` | ✅ `sec-seguranca` | `/api/auth/2fa` | Todos | ✅ OK |
| **Repasse** | ✅ `RepasseScreen.tsx` | ✅ `sec-repasse` | `/api/repasse` | `REPASSE_GERENCIAR` | ✅ OK |
| **Relatórios** | ✅ `RelatoriosScreen.tsx` | ✅ `sec-relatorios` | `/api/reports` | `RELATORIOS_VER` | ✅ OK |
| **Notificações** | ✅ `NotificacoesPushScreen`| ✅ `sec-notificacoes` | `/api/push` | `PUSH_GERENCIAR` | ✅ OK |
| **CMS** | ❌ Ausente | ✅ `sec-cms` | `/api/content-blocks`| `EDIT_CONTENT` | ✅ OK (Site) |
| **Diagnóstico** | ✅ `LogsScreen.tsx` | ✅ `sec-diagnostico` | `/api/diagnostico`, `/api/push/health`, `/api/push/diagnostics/me` | `PUSH_GERENCIAR` | ✅ OK |

---

## 🔍 Detalhamento por Módulo

### 1. Filiados (Gestão)
- **Endpoints:** `GET /api/filiados`, `POST /api/filiados`, `PUT /api/filiados/:id`, `POST /api/filiados/:id/arquivar`
- **Permissões:** `LIST_FILIADOS`, `CREATE_FILIADO`, `EDIT_FILIADO`
- **Divergências:** No Site, o botão "Novo Filiado" é um item de menu que abre uma aba específica, no App é uma tela separada. Funcionalidade preservada.

### 2. Notificações
- **Endpoints:** `POST /api/push/campaigns/send`, `GET /api/push/campaigns` (Gestão), `GET /api/push/history/me` (Membro)
- **Permissões:** `PUSH_GERENCIAR` (para envio e gestão de campanhas), `VIEW_SELF` (para histórico pessoal)
- **Divergências:** O App recebe Push nativo; o Site exibe o histórico de mensagens.
- **Site Implementation:**
  - **Fluxos Separados:** Separação lógica entre "Minhas Notificações" (Histórico do Filiado) e "Painel de Gestão" (Campanhas), garantindo que filiados comuns nunca chamem endpoints administrativos.
  - **Permissions-First:** A determinação do perfil de gestão no Site prioriza o array de `permissions` retornado pelo bootstrap (`/api/auth/me` ou `/api/filiados/me`), evitando dependência de strings de perfil. **Enforced:** A visibilidade das abas administrativas agora é baseada estritamente no array de permissões.
  - **Tratamento de Erros:** Implementado tratamento explícito para 401 (Sessão Expirada) e 403 (Sem Permissão), com mensagens amigáveis na UI e exibição de `requestId` para suporte.
- **Estabilidade:**
  - Corrigido loop de autenticação 401 em `/api/push/campaigns` com implementação de logout unificado e limpeza total de tokens no `localStorage`.
  - Adicionados estados de "Carregando..." para evitar telas estáticas durante o fetch de dados.

### 3. CMS (Conteúdo do Site)
- **Endpoints:** `GET/PUT /api/content-blocks`
- **Permissões:** `EDIT_CONTENT`
- **Drift:** Módulo exclusivo do Site. Não há necessidade de edição de blocos do site via App no momento. Implementada resiliência contra dados corrompidos e erros de JSON no frontend.

### 4. Diagnóstico (Logs)
- **Endpoints:** `/api/diagnostico`, `/api/push/health`, `/api/push/diagnostics/me`, `/api/push/campaigns/send` (target: self)
- **Permissões:** `PUSH_GERENCIAR`, `ADMIN`, `DIRETORIA`
- **Paridade Alcançada:** O Site agora possui paridade funcional com o App no módulo de Diagnóstico. Ambos permitem visualizar a saúde global do sistema (Push), listar os tokens registrados para o usuário atual (com masking de segurança) e realizar disparos de teste direcionados ao próprio dispositivo ("Testar Push em mim").
- **Drift residual:** O App possui uma visualização de logs locais em tempo real (úteis para depuração de hardware/nativo), enquanto no Site o desenvolvedor utiliza o console do navegador.

---

## 🚨 Drift Analysis

### Severidade 🔴 Crítica
*Nenhuma divergência crítica de segurança detectada.*

### Severidade 🟠 Alta
*Nenhuma divergência de alta severidade detectada.*

### Severidade 🟡 Média
*Nenhuma divergência de média severidade detectada.*

### Severidade 🟢 Baixa
- **UX de Novo Filiado:** Fluxos ligeiramente diferentes entre App e Site (Tela vs Aba), mas com paridade de campos.

---

## 🛑 Relatório de Exposição Técnica
*Nenhuma exposição técnica crítica pendente.*
