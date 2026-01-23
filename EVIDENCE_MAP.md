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
