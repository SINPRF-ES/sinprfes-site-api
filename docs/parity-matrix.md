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
| **CMS** | ❌ Ausente | ✅ `sec-cms` | `/api/content-blocks`| `EDIT_CONTENT` | 🎨 Front-only |
| **Diagnóstico** | ✅ `LogsScreen.tsx` | ❌ Ausente | `/api/diagnostico` | `ADMIN`, `DIRETORIA` | ⚠️ Divergente |

---

## 🔍 Detalhamento por Módulo

### 1. Filiados (Gestão)
- **Endpoints:** `GET /api/filiados`, `POST /api/filiados`, `PUT /api/filiados/:id`, `POST /api/filiados/:id/arquivar`
- **Permissões:** `LIST_FILIADOS`, `CREATE_FILIADO`, `EDIT_FILIADO`
- **Divergências:** No Site, o botão "Novo Filiado" é um item de menu que abre uma aba específica, no App é uma tela separada. Funcionalidade preservada.

### 2. Notificações
- **Endpoints:** `POST /api/push/campaigns`, `GET /api/push/history/me`
- **Permissões:** `PUSH_GERENCIAR` (para envio), todos (para histórico)
- **Divergências:** O App recebe Push nativo; o Site apenas exibe o histórico de mensagens enviadas.

### 3. CMS (Conteúdo do Site)
- **Endpoints:** `GET/POST /api/content-blocks`
- **Permissões:** `EDIT_CONTENT`
- **Drift:** Módulo exclusivo do Site. Não há necessidade de edição de blocos do site via App no momento.

### 4. Diagnóstico (Logs)
- **Endpoints:** `/api/diagnostico`
- **Permissões:** `DIRETORIA`
- **Drift:** O App possui uma tela de "Logs" para depuração em tempo real por diretores. O Site não possui interface equivalente para visualizar logs do backend ou do frontend.

---

## 🚨 Drift Analysis

### Severidade 🔴 Crítica
*Nenhuma divergência crítica de segurança detectada no scan inicial.*

### Severidade 🟠 Alta
*Nenhuma divergência de alta severidade detectada.*

### Severidade 🟡 Média
- **Visualização de Logs:** Disponível apenas no App. Justificativa: os logs exibidos são locais do dispositivo (App), úteis para suporte proativo de falhas nativas. No Site, logs de console estão disponíveis via DevTools do navegador.

### Severidade 🟢 Baixa
- **UX de Novo Filiado:** Fluxos ligeiramente diferentes entre App e Site (Tela vs Aba), mas com paridade de campos.

---

## 🛑 Relatório de Exposição Técnica
*Nenhuma exposição técnica crítica pendente.*
