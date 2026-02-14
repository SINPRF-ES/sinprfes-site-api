# Auditoria de Aderência ao Canon e Documentação - FENAPRF

Este documento consolida os resultados da auditoria realizada no ecossistema FENAPRF, verificando a aderência do Backend, Mobile e Portal ao Canon Institucional e às documentações oficiais.

## 1. Resumo Técnico Interno (Extração do Canon)

### Lista de Roles
- **ADMIN**: Suporte técnico e auditoria. Não interfere no rito institucional (Soberania da Mesa).
- **DIRETORIA**: Perfil de gestão institucional.
- **COLABORADOR**: Perfil de gestão de suporte.
- **CONSELHEIRO**: Participante ativo (presença, quórum e voto).

### Autoridades por Operação
- **Composição de Mesa**: Exclusiva do Presidente/Vice da FENAPRF.
- **Geração de Token Global**: Presidente, Vice ou Diretor de Secretaria (Titular/Subst.).
- **Geração de Token de Quórum**: Restrita à Mesa Diretora definida.
- **Check-in/Voto**: Apenas Diretoria e Conselheiro. ADMIN e COLABORADOR não participam.

### Regras do Rito
- **Token Global**: 10 chars alfanuméricos, único e persistente por assembleia.
- **Token de Quórum**: 6 dígitos numéricos, versionado (Snapshot). Duração padrão: 120 segundos.
- **Hierarquia de Branch**: Presidente > Vice; Delegado > Suplente.
- **Substituição**: Superior entrando remove subordinado. Durante votação, a substituição fica pendente até o encerramento do item.
- **Votos**: Omissão computada como ABSTENCAO para membros presentes no snapshot.

---

## 2. Auditoria de Implementação (Backend)

| Regra do Canon | Status | Observação |
| :--- | :---: | :--- |
| Token Global Único/Persistente | ✅ | Implementado em `gerarQuorum` com busca prévia. |
| Quórum Versionado (Snapshot) | ✅ | Cada votação vincula a um `quorum_snapshot_id`. |
| Reset de Quórum | ✅ | Novo token encerra snapshots anteriores (exceto Global). |
| Snapshot em Votações | ✅ | Integridade preservada via vínculo no banco. |
| Hierarquia UF/Branch | ✅ | Lógica em `obterInfoBranchUser`. |
| Substituição Automática | ✅ | Remoção de subordinado em `realizarCheckin`. |
| Bloqueio de Subordinado | ✅ | Erro 409 disparado se superior estiver presente. |
| Idempotência na Geração | ✅ | Garantida para Token Global. |
| Voto por Omissão (Abstenção) | ✅ | Aplicado automaticamente em `finalizarVotacao`. |
| Restrições de ADMIN no Rito | ✅ | Sovereignty da mesa respeitada via `verificarAutoridadeMesa`. |
| Relatórios (Estado Encerrado) | ✅ | Guard de estado implementado no controller. |

---

## 3. Divergências Encontradas e Ajustadas

### Divergências Críticas (Canon violado)
- **Duração do Token de Quórum**: O código utilizava 10 minutos (600s) ou 5 minutos (300s), enquanto o Canon (MD) define 120 segundos como padrão.
  - **Ajuste**: Backend e Portal atualizados para 120s.
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
