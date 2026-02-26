# Hard Maintenance Run - 2026-02-26

## 📝 Informações Gerais
- **Data/Hora:** 2026-02-26
- **Branch:** `fix/diagnostico-parity`
- **Escopo:** Melhoria de paridade no módulo de Diagnóstico (Site ↔ App).
- **Declaração de "Sem Surpresas":** Não serão alteradas áreas não relacionadas ao escopo definido.

## 📊 Baseline de Paridade (Resumo)
| Módulo | App (Mobile) | Site (Web) | Backend (API) | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Diagnóstico** | ✅ Completo | 🟡 Parcial | ✅ OK | 🟡 Parcial |

## 🎯 Escopo Detalhado
- **Módulos Tocados:** Diagnóstico.
- **Projetos Tocados:** `/site`, `/docs`.
- **Limites:**
    - ≤ 300 linhas por commit.
    - ≤ 5 commits.
    - Sem refactores cross-cutting.

## 🛡️ SENTINEL AUDIT
- **SENTINEL-A1: Auth & Permissions**
    - Endpoints tocados: `/api/push/diagnostics/me`, `/api/push/campaigns/send`.
    - Verificação: 🟢 `/api/push/diagnostics/me` exige `auth`. `/api/push/campaigns/send` exige `PUSH_GERENCIAR`. Ambos seguem o padrão `atorId` + `requestId`.
- **SENTINEL-A2: Validation & Normalization**
    - Verificação: 🟢 Backend suporta `targetValue: 'self'` para `targetType: 'FILIADO'`. Normalização centralizada em `pushCampaign.service.js`.
- **SENTINEL-A3: Railway Determinism**
    - Verificação: 🟢 Sem dependência de filesystem local para estado persistente.
- **SENTINEL-A4: Guardrail Integrity**
    - Verificação: 🟢 Backend livre de dependências de UI/Mobile.

## ⚡ BOLT AUDIT
- **BOLT-A1: API Efficiency**
    - Identificado: 🟢 Adição de `/api/push/diagnostics/me` no Site traz paridade técnica com o App sem custo excessivo de processamento.
- **BOLT-A2: DB/Query Hygiene**
    - Verificação: 🟢 Query de diagnósticos usa indexação por `user_id`.

## 🎨 PALETTE AUDIT
- **PALETTE-A1: State Completeness**
    - Implementação: 🟢 Adicionados skeleton/loading states para a seção de tokens e feedback visual (spinner) para o botão de teste.
- **PALETTE-A2: Visual Consistency**
    - Implementação: 🟢 Uso estrito de `.ui-card`, `.ui-button` e badges de status compatíveis com o restante da Área do Filiado.
- **PALETTE-A3: Formatting & Dates**
    - Implementação: 🟢 Uso de `toLocaleString('pt-BR')` para datas de "Visto em", mantendo consistência com o App.

## 🔄 PARITY ENFORCEMENT
- **Diferença Identificada:** 🟢 Paridade Restaurada. O App mostra "Meus Tokens" e permite "Testar Push". O Site agora implementa a mesma lógica via seção "Meus Dispositivos / Tokens" e botão "Testar Push (em mim)".
- **Ação:** Implementada seção "Meus Tokens" (via `/api/push/diagnostics/me`) e botão "Testar Push (em mim)" no módulo de Diagnóstico do Site.
- **Resultado:** Módulo de Diagnóstico movido de 🟡 Parcial para ✅ OK na Matriz de Paridade.

---
## 📋 Backlog (Fora deste Run)
- N/A
