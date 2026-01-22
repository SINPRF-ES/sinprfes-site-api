# Relatório Técnico de Auditoria e Mapeamento de Riscos

**Data:** 22/01/2026
**Status:** Diagnóstico concluído
**Versão:** 1.0

---

## 1. Sumário Executivo

O sistema SINPRF/ES encontra-se em um estado funcional estável (Produção 2.0), com o módulo de Assembleias recém-consolidado. Entretanto, a auditoria revelou divergências entre a documentação canônica e a implementação real, além de riscos de segurança no backend e processos de automação sem a robustez documentada.

**Grau de aderência à documentação:** Médio-Alto (80%)
**Riscos críticos identificados:** 2 (Autorebaixamento de Admin e Idempotência do Job de Aniversário)

---

## 2. Mapa de Documentação (.md)

### 2.1. Inventário e Status Atual

| Nome do Arquivo | Caminho | Finalidade | Status Estimado |
| :--- | :--- | :--- | :--- |
| `README.md` | `/` | Regras de arquitetura e RBAC | **CANÔNICO** |
| `PRODUCAO-2.0-CANON.md` | `/docs` | Estado da arte do sistema v2.0 | **CANÔNICO** |
| `JOBS.md` | `/docs` | Descrição de automações | **CANÔNICO / SUPORTE** |
| `ASSEMBLEIA-VOTACAO-CANON.md` | `/docs` | Regras do módulo de Assembleias | **CANÔNICO** |
| `ASSEMBLEIA-SMOKE-TEST.md` | `/docs` | Guia de testes manuais | **SUPORTE** |
| `ASSEMBLEIA-VOTACAO-TECHNICAL-PLAN.md` | `/docs` | Plano técnico de desenvolvimento | **HISTÓRICO** |
| `README.md` | `/mobile` | Instruções específicas do App | **SUPORTE** |
| `MOBILE_PARIDADE.md` | `/mobile` | Controle de paridade Web vs App | **SUPORTE** |

### 2.2. Proposta de Reorganização

1.  **Centralização:** Mover `mobile/MOBILE_PARIDADE.md` para `/docs` para manter toda a documentação de referência em um único local.
2.  **Arquivamento:** Renomear `docs/ASSEMBLEIA-VOTACAO-TECHNICAL-PLAN.md` para `docs/archive/TECHNICAL-PLAN-ASSEMBLEIA-V1.md`.
3.  **Unificação:** Integrar o conteúdo de `docs/JOBS.md` diretamente no `PRODUCAO-2.0-CANON.md` ou mantê-lo como apêndice em `/docs`.

---

## 3. Inconsistências Críticas e Riscos

| Item | Local | O que o CANON diz | O que o Código faz | Risco | Impacto |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Autorebaixamento de Admin** | `filiados.controller.js` | "O operador não pode alterar seu próprio perfil." | Backend permite que um ADMIN mude o próprio `perfil_acesso` via `atualizarFiliado`. | **Alto** | Um administrador pode se trancar fora do sistema acidentalmente. |
| **Idempotência do Job** | `birthdayCron.js` / `JOBS.md` | Deve usar tabela `job_runs` para lock de execução única diária. | O código não implementa o lock; o job roda em todo boot do servidor (`server.js`). | **Médio** | Envio duplicado de e-mails em caso de múltiplos restarts do servidor no mesmo dia. |
| **Módulos Legados** | `votacoes.controller.js` | Módulo de Assembleias é o padrão v1.0. | Módulos `votacoes` e `eventoVotacoes` coexistem com `assembleias`. | **Baixo** | Confusão na manutenção e redundância de rotas. |
| **Validação de Admin** | `filiados.controller.js` | Apenas ADMIN altera ADMIN. | Validação correta implementada, mas sem checagem de `isSelf` no servidor. | **Médio** | Fragilidade na regra de negócio de gestão. |

---

## 4. Auditoria de Pontos Sensíveis Recentes

### 4.1. Perfil COMUNICADOR
- **Status:** Implementado corretamente.
- **Aderência:** Total. O perfil possui apenas `VIEW_SELF` e `EDIT_SELF`. Está fora das whitelists de gestão (`perfilGestao`).
- **Observação:** O código utiliza `perfilGestao()` para blindar rotas administrativas, garantindo que o COMUNICADOR não acesse dados de terceiros.

### 4.2. Job Diário de Aniversariantes
- **Implementação:** `src/jobs/birthdayCron.js`.
- **Divergência:** A documentação em `docs/JOBS.md` descreve um mecanismo de lock via banco de dados (`job_runs`) que **não existe no código**.
- **Execução:** Atualmente disparado no boot em `server.js`. Em ambientes Render, onde restarts são comuns, isso gerará spam de e-mails.

### 4.3. Admin Rebaixar Outro Admin
- **Fluxo:** Backend valida que apenas ADMIN mexe em ADMIN.
- **Falha:** A UI (`filiados-admin.js`) bloqueia o usuário de editar a si mesmo (`isSelf`), mas o **Backend não possui essa trava**. Um acesso via API direta (Postman/Curl) permitiria o autorebaixamento.

### 4.4. Biometria no App
- **Fluxo:** Utiliza `expo-secure-store` para persistir o JWT.
- **Segurança:** Fallback para logout em caso de falha. Implementação segue o padrão de segurança para restauração de sessão.

### 4.5. Sistema de Votação (Assembleias)
- **Aderência:** O código em `assembleias.controller.js` e `assembleia.socket.js` segue rigorosamente o `ASSEMBLEIA-VOTACAO-CANON.md`.
- **Destaque:** Implementada corretamente a retirada automática de propostas por ausência do autor no quórum (P1).

---

## 5. Recomendações Priorizadas

### Prioridade 1: Correções Críticas (Segurança e Estabilidade)
1.  **Backend:** Adicionar trava em `filiados.controller.js` impedindo que o `req.user.id` altere seu próprio `perfil_acesso` na rota `atualizarFiliado`.
2.  **Backend/Jobs:** Implementar o mecanismo de lock `job_runs` em `birthdayCron.js` conforme documentado em `JOBS.md`.

### Prioridade 2: Correções Estruturais (Legado e Documentação)
1.  **Refatoração:** Avaliar a desativação das rotas `/api/votacoes` e `/api/eventos/:id/votacoes` (legadas) em favor do módulo `/api/assembleias`.
2.  **Documentação:** Executar a reorganização sugerida no item 2.2 deste relatório.

### Prioridade 3: Melhorias Desejáveis
1.  **Mobile:** Migrar o `PdfViewer` de WebView para uma solução 100% nativa (conforme roadmap em `PRODUCAO-2.0-CANON.md`).

---
**Relatório gerado por Jules (AI Software Engineer)**
*Nenhuma modificação de código foi realizada durante esta auditoria.*
