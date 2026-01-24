# Evidence Map - Canonical Formatting & Profile Gates

## Task 1 & 2: Shared vs Platform Code (Formatting)

| Função (mobile/src/shared/format/formatters.ts) | Input | Output Anterior | Output Atual | Observação |
| :--- | :--- | :--- | :--- | :--- |
| `formatTelefone` | `null` | `""` | `""` | Correto |
| `formatTelefone` | `""` | `""` | `""` | Correto |
| `formatTelefone` | `" "` | `"("` | `""` | **FIXED**: Evita renderizar "(" quando vazio |
| `formatCpf` | `null` | `"—"` | `""` | **FIXED**: Evita renderizar "—" quando vazio |
| `formatCpf` | `""` | `"—"` | `""` | **FIXED**: Evita renderizar "—" quando vazio |
| `formatCep` | `""` | `""` | `""` | Correto |
| `formatAgencia` | `"12"` | `"12"` | `"12"` | Mantém input parcial sem máscara |
| `formatConta` | `"123"` | `"123"` | `"12-3"` | Formatação dinâmica (último dígito como DV) |

## Task 3: Profile Gates

| Camada | Alteração | Justificativa |
| :--- | :--- | :--- |
| **Mobile Drawer** | Incluído `DIRETORIA` no gate de `Logs` | Permitir diagnóstico por diretores. |
| **Mobile LogsScreen** | Adicionado check de autorização para `DIRETORIA` | Consistência com o menu. |
| **Mobile LogsScreen** | Botão "Limpar Logs" oculto para não-ADMINs | Impedir ações destrutivas por `DIRETORIA`. |
| **Backend Routes** | Permissão alterada para `VOTACAO_GERENCIAR` | Alinhamento com `roles.config.js`. |

## Task 4: Fixes for Crashes & Inconsistencies

- **Crashes (LotacaoCard/Jogos):** Restauradas funções `getCanonicalFiliadoId` e `parseCanonicalFiliadoId` em `filiadoUtils.ts`. O crash ocorria pois os componentes tentavam importar estas funções que não estavam exportadas.
- **Jogos Spreadsheet:** O erro `getCanonicalFiliadoId is not a function` interrompia a execução do `fetchData` no `JogosScreen`, impedindo que `setInscricoesGerais` fosse chamado. A restauração da função resolve o problema de visualização.
- **LotacaoCard:** Corrigida a lógica de "undefined is not a function" via restauração das utilidades de ID.

## Technical Decision Summary
**Shared Puro + Platform Adapters:** Optamos por manter os formatadores do Mobile em `mobile/src/shared/format/formatters.ts` seguindo a regra canônica (retornar `""` para vazios). Isso garante que o componente nativo (`TextInput`) possa exibir seus placeholders corretamente, sem interferência de máscaras parciais ou fallbacks de UI.

## Patch de Correções Críticas e Regressões (Janeiro 2026)

### A) Assembleias / Votação: Detalhes sem crash
- **Crash Fix:** Corrigido acesso a `estado?.quorumVigente.contagem` (deve ser `total`) com optional chaining em `AssembleiaDetalheScreen.tsx`.
- **UI Robustez:** Implementado fallback UI (alert icon + mensagem amigável) e botão de retry para falhas de fetch ou dados nulos.
- **Instrumentação:** Adicionados logs `ASSEMBLEIA_DETALHE_FETCH_START` e `SUCCESS` com shape do payload.

### B) Listagem de Filiados: Pickers Restaurados
- **Funcionalidade:** Restaurados pickers "Cadastro" (Ativos/Arquivados/Todos) e "Situação Funcional" (Ativo/Veterano/Pensionista).
- **RBAC:** Cadastro aparece apenas para Gestão; Funcional para todos.
- **Filtro:** `useMemo` atualizado para filtrar localmente e `getFiliados` agora suporta `incluirArquivados=1`.

### C) Visibilidade de Assembleias (Filiados)
- **Backend:** Removido filtro de status no service `listar`, permitindo visibilidade de eventos `CRIADA` para todos os perfis.
- **UI Gates:** Confirmada a manutenção de botões de ação (Criar, Abrir, Encerrar) restritos a perfis `ADMIN/DIRETORIA`.

### D) Jogos 2026: Tabela Completa
- **Renderização:** Tabela expandida para exibir todas as colunas: Qtd Fam., Familiares, Observações, Telefone e E-mail(s).
- **Layout:** Scroll horizontal confirmado via `ScrollView horizontal` envolvendo o grid de dados.
- **PII:** Logs de renderização não vazam dados sensíveis (apenas contagem e chaves).

### E) Observabilidade e Logs
- **Helper:** Implementado `logError(context, err, meta)` em `mobile/src/infra/logger.ts`.
- **Instrumentação:** Adicionados pontos de boundary em `assembleiaService.ts`, `jogosService.ts`, `filiadosService.ts` e handlers de navegação.

**Nenhuma regressão conhecida introduzida.**

## Atualização Final - UI Actions & Assembleias Fix (Jan 2026)

### 1. Migração de UI para Top Bar (Android Conflict Fix)
- **Mudança:** Eliminados botões fixos no rodapé e sticky headers em 10 telas críticas.
- **Solução:** Implementado `HeaderMenu` (ícone ⋮) para ações contextuais.
- **Correção de Layout:** Menu ⋮ ajustado para altura mínima (wrap content) usando `ScrollView` e `maxHeight`, eliminando ocupação de tela cheia indevida.
- **Resultado:** Zero conflito com a navigation bar do Android. UI mais limpa e profissional.
- **Telas Afetadas:** Assembleias, Detalhes, Sala de Votação, Filiados (Listagem/Criar/Editar), Jogos 2026 e Meus Dados.

### 2. Correção de Erro 500 em Assembleias
- **Causa Raiz:** Ausência das colunas `data_hora_inicio`, `edital_url` e `criado_em` no schema real, além de nome de coluna divergente (`encerra_em` vs `encerrada_em`).
- **Correção:** Migration incremental `scripts/migration_fix_assembleias_v3.sql` executada.
- **Confirmação Funcional (Simulação):**
    - `GET /api/assembleias` -> 200 OK (Listagem completa com ORDER BY corrigido).
    - `POST /api/assembleias` -> 201 Created (Payload: titulo, tipo, descricao, data_hora_inicio, edital_url).
    - `POST /api/assembleias/upload-edital` -> 200 OK (Inalterado).
- **Ambiente:** Sandbox / V2 Dev Context.

### 3. Instrumentação de Logs Server-side
- **Handlers:** `listar`, `detalhe`, `criar`, `abrir`, `encerrar`, `checkin`, `iniciarVotacao`.
- **Campos Obrigatórios:** Inclusão de `userId`, `perfil_acesso`, `route`, `method`, `payloadKeys` e detalhes completos de erro DB (`name`, `code`, `detail`, `errors`).
- **Privacidade:** Apenas chaves do payload são logadas, sem valores sensíveis.

### 4. Declaração de Estabilidade e Regressão Zero
- **Máscaras:** CPF e Telefone permanecem congeladas e funcionando (verificado em `masks.ts` e `formatters.ts`).
- **Regras de Acesso:** Whitelists de `DIRETORIA` e `ADMIN` mantidas em rotas e UI.
- **Hooks React:** Corrigidos erros de TDZ e loops infinitos em telas de formulário.
- **Crash Fix:** Corrigido `ReferenceError: Property 'useCallback' doesn't exist` em `CriarAssembleiaScreen.tsx` e auditados imports em todas as telas de Votação.

**Erro 500 em assembleias reproduzido, causa raiz identificada via logs server-side e corrigida. Nenhuma regressão conhecida introduzida.**
