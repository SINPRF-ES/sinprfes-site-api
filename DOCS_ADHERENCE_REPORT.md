# Relatório de Aderência da Documentação (Markdown)

Este relatório detalha a conformidade dos arquivos Markdown do repositório com a implementação atual do projeto e sugere as atualizações necessárias.

## 1. Categorização de Arquivos

### 1.1 Documentação Viva (Living Docs)
Arquivos que devem refletir o estado atual e as regras canônicas do sistema.
- `README.md`: Centralizador de regras e visão geral. (**Aderente**)
- `docs/architecture/PRODUCAO-2.0-CANON.md`: Definição de estado canônico. (**Parcialmente Aderente** - Requer mover CMS de Roadmap para Implementado)
- `docs/architecture/ME-DATA-EDITING-RULES.md`: Regras de edição de perfil. (**Parcialmente Aderente** - Falta detalhar requisito de CEP para endereço)
- `docs/ops/railway.md`: Guia de deploy. (**Parcialmente Aderente** - Requer menção ao `railpack-plan.json`)
- `docs/mobile/mobile-architecture.md`: Arquitetura do app mobile. (**Parcialmente Aderente** - Requer atualização sobre fluxo de updates)
- `docs/ops/RELATORIOS.md`: Detalhamento do módulo de relatórios. (**Aderente**)
- `docs/runbooks/ota-update.md`: Guia de atualização OTA. (**Aderente**)

### 1.2 Relatórios Históricos e Auditorias
Arquivos que registram marcos temporais ou tarefas concluídas.
- `docs/architecture/relatorio-permissoes-edicao.md`: Auditoria de permissões (Jan 2026). (**Concluído**)
- `docs/architecture/EVIDENCE_MAP.md`: Mapa de evidências de correções. (**Histórico**)
- `docs/ops/RELATORIO_FINAL_IMPLEMENTACAO.md`: Resumo de hardening v4.3. (**Histórico**)
- `AUDIT_REPORT.md`: Auditoria de dependências React. (**Histórico**)

### 1.3 Drafts e Outros
- `docs/ops/noticia-join-prf.md`: Rascunho de notícia.

## 2. Inconsistências Identificadas e Sugestões

### A. Módulo CMS (Notícias Internas)
- **Situação:** `PRODUCAO-2.0-CANON.md` lista o CMS no Roadmap.
- **Realidade:** O CMS está implementado, utilizando `data/content_blocks.json` e acessível via aba "Site (CMS)".
- **Sugestão:** Mover para a seção de funcionalidades implementadas.

### B. Edição de Endereço (Meus Dados)
- **Situação:** `ME-DATA-EDITING-RULES.md` lista os campos de endereço como permitidos para FILIADOS.
- **Realidade:** O backend exige que os campos `logradouro_bairro`, `cidade` e `uf` sejam enviados junto com o `cep` para serem processados (Fluxo `buscaCEP`).
- **Sugestão:** Adicionar esta nota técnica para evitar confusão em integrações futuras.

### C. Configuração Railway
- **Situação:** `railway.md` instrui configuração manual no painel e diz para não usar `railway.toml`.
- **Realidade:** O projeto agora utiliza `railpack-plan.json` na raiz para padronizar o build monorepo.
- **Sugestão:** Documentar o uso do `railpack-plan.json` e atualizar os comandos de build/start recomendados.

### D. Atualizações Mobile
- **Situação:** `mobile-architecture.md` menciona estratégia geral de updates.
- **Realidade:** O fluxo foi simplificado com a remoção do `OtaUpdateBanner` e centralização no `UpdateAutoChecker`.
- **Sugestão:** Refletir essa simplificação na arquitetura mobile.

## 3. Plano de Ação (Implementado neste PR)
1. Atualizar `PRODUCAO-2.0-CANON.md` (CMS status).
2. Atualizar `ME-DATA-EDITING-RULES.md` (Condicional de CEP).
3. Atualizar `railway.md` (`railpack-plan.json`).
4. Atualizar `mobile-architecture.md` (Update flow).
5. Marcar `relatorio-permissoes-edicao.md` como Concluído.
