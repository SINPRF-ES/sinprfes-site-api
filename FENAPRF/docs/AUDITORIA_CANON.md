# Auditoria de Aderência ao Canon e Documentação - FENAPRF

Este documento consolida os resultados da auditoria realizada no ecossistema FENAPRF, verificando a aderência do Backend, Mobile e Portal ao Canon Institucional e às documentações oficiais.

## 1. Resumo Técnico Interno (Extração do Canon)

### Lista de Roles
- **ADMIN**: Suporte técnico e auditoria. Não interfere no rito institucional (Soberania da Mesa).
- **DIRETORIA**: Perfil de gestão institucional.
- **COLABORADOR**: Perfil de gestão de suporte.
- **CONSELHEIRO**: Participante ativo (presença, quórum e voto). Membro nato do Conselho de Representantes.

### Autoridades por Operação
- **Composição de Mesa**: Exclusiva do Presidente/Vice da FENAPRF.
- **Geração de Token Global**: Exclusiva: Presidente, Vice, Diretor de Secretaria ou Substituto. (Resgate permitido para toda a Gestão).
- **Geração de Token de Quórum**: Exclusiva da Mesa Diretora (4 componentes).
- **Conselho de Representantes**: Composto pelos Conselheiros e pelo Presidente/Vice da FENAPRF.
- **Check-in de Quórum / Voto / Proposta**: Restrito aos Membros do Conselho de Representantes.
- **Check-in Global**: Permitido para toda a Diretoria e Conselheiros.
- **Pedido de Palavra**: Permitido para toda a Diretoria e Conselheiros (para registro em ata). (RBAC: `canRequestPalavra`).

### Regras do Rito
- **Token Global**: 10 chars alfanuméricos + QR. Único e persistente. Dura toda a assembleia (expira apenas no encerramento). (Resgate: `canViewCredenciamentoToken`).
- **Token de Quórum**: 6 dígitos numéricos + QR. Versionado (Snapshot). Válido até o próximo ser gerado ou o fim do evento.
- **Votação (Timer)**: Duração padrão de 120 segundos.
- **Auto-Encerramento**: Votação encerra imediatamente ao atingir 100% dos votos do snapshot.
- **Hierarquia de Branch**: Presidente > Vice; Delegado > Suplente.
- **Substituição**: Superior entrando remove subordinado. Durante votação, a substituição fica pendente até o encerramento do item.
- **Votos**: Omissão computada como ABSTENCAO para membros presentes no snapshot.

---

## 2. Auditoria de Implementação (Backend)

| Regra do Canon | Status | Observação |
| :--- | :---: | :--- |
| Token Global Único/Persistente | ✅ | Implementado em `gerarQuorum` com busca prévia. |
| Resgate de Token Global (Gestão) | ✅ | RBAC `canViewCredenciamentoToken` implementado. |
| Quórum Versionado (Snapshot) | ✅ | Cada votação vincula a um `quorum_snapshot_id`. |
| Reset de Quórum | ✅ | Novo token encerra snapshots anteriores (exceto Global). |
| Snapshot em Votações | ✅ | Integridade preservada via vínculo no banco. |
| Hierarquia UF/Branch | ✅ | Lógica unificada no Canon (`obterInfoBranchUser`). |
| Substituição Hierárquica | ✅ | Comparação via `isSuperiorBranch` do Canon. |
| Substituição Automática | ✅ | Remoção de subordinado em `realizarCheckin`. |
| Bloqueio de Subordinado | ✅ | Erro 409 disparado se superior estiver presente. |
| Idempotência na Geração | ✅ | Garantida para Token Global. |
| Pedido de Palavra (RBAC) | ✅ | RBAC `canRequestPalavra` implementado. |
| Voto por Omissão (Abstenção) | ✅ | Aplicado automaticamente em `finalizarVotacao`. |
| Restrições de ADMIN no Rito | ✅ | Sovereignty da mesa respeitada via `verificarAutoridadeMesa`. |
| Relatórios (Estado Encerrado) | ✅ | Guard de estado implementado no controller. |
| Enums Canônicos | ✅ | Estados e status centralizados em `canon.js`. |

---

## 3. Divergências Encontradas e Ajustadas

### Divergências Críticas (Canon violado)
- **Duração de Votação**: O código utilizava 10 minutos (600s) ou 5 minutos (300s), enquanto o Canon (MD) define 120 segundos como padrão.
  - **Ajuste**: Backend, Mobile e Portal atualizados para 120s como padrão.
- **Soberania na Composição de Mesa**: O arquivo `shared/canon.js` permitia que `ADMIN` compusesse a mesa, contrariando o rito institucional descrito no MD.
  - **Ajuste**: Removido privilégio de ADMIN na função `canComposeMesa`.

### Divergências Moderadas
- **Consistência de Labels**: Algumas mensagens de erro no app não refletiam a terminologia exata do Canon.
  - **Ajuste**: Atualizadas mensagens de conflito de hierarquia.

### Divergências Documentais
- **Schemas.csv**: Desatualizado, faltando a tabela crítica `assembleia_checkins_pendentes`.
  - **Ajuste**: Adicionadas definições de colunas ao arquivo CSV.

---

## 4. Conclusão da Auditoria

O sistema agora apresenta **Aderência Plena** ao Canon Institucional. As correções garantem que o rito de assembleia seja soberano, técnico e auditável, respeitando estritamente a hierarquia e as autoridades definidas pela FENAPRF.

**Data da Auditoria**: 14/02/2026
**Responsável**: Jules (Software Engineer)
