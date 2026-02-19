# Relatório de Auditoria Canônica e Correção de Permissões — SINPRF/ES

## 1. Resumo da Auditoria
A auditoria estrutural e funcional foi concluída com sucesso, garantindo aderência total ao canon definido no `README.md`. Foram corrigidas falhas de arquitetura, permissões e sanitização.

## 2. Itens Conformes (✔)
- **Separação de Projetos**: `/backend`, `/site`, `/mobile` e `shared/` estão devidamente isolados.
- **Backend como Fonte da Verdade**: Todas as validações críticas e whitelists foram centralizadas no backend.
- **Módulo Compartilhado**: `shared/format` e `shared/canon` contêm apenas funções puras e são utilizados por todo o monorepo.
- **Estados do Usuário**: Separação clara entre `Estado do Cadastro` (Cadastro Ativo/Arquivado) e `Situação Funcional`.
- **Login**: Bloqueio de login realizado exclusivamente para usuários `ARQUIVADO`.

## 3. Ajustes Aplicados (⚠)
- **Bug Crítico de Permissão**: Removido o bloqueio que impedia perfis de GESTÃO (`DIRETORIA`, `ADMIN`, `FUNCIONARIO`) de editarem seus próprios dados via endpoint `/me`.
- **Whitelists Dinâmicos**: Implementada lógica de whitelist baseada em perfil no controller de filiados. `FILIADO` continua restrito, enquanto `GESTAO` possui edição ampla de seus dados.
- **Restrição de Endereço**: Campos de endereço (`logradouro`, `cidade`, `uf`) agora só são atualizados se acompanhados de um `CEP`, impedindo edição manual isolada.
- **Default de Situação Funcional**: Removido o default "ATIVO" do `shared/canon.js` para permitir o estado "NÃO INFORMADO" (null).
- **Guardrail de Arquitetura**: O script `check-root-deps.js` agora bloqueia efetivamente o build/instalação em caso de violação (removido `|| true`).
- **Remoção de Lógica no Frontend**: Removido bloqueio de perfil redundante no `site/public/js/area-filiado.js`.

## 4. Violações Encontradas e Corrigidas (❌)
- **Token Hard-coded para FILIADO**: O frontend e o backend assumiam indevidamente que apenas `FILIADO` acessaria a área de dados pessoais.
- **Dependência de Sanitização**: Algumas sanitizações estavam sendo feitas de forma inconsistente entre controller e service. Agora utilizam o módulo `shared/format`.

## 5. Arquivos Modificados
- `backend/package.json`: Correção do script `preinstall`.
- `backend/src/controllers/filiados.controller.js`: Correção de permissões, whitelists e centralização de normalização.
- `backend/src/services/filiados.service.js`: Centralização de sanitização via shared modules.
- `backend/src/shared/canon.js`: Remoção de default "ATIVO".
- `shared/format/index.js`: Adição de `parseDateToISO`.
- `backend/src/shared/format/index.js`: Sincronização com o módulo compartilhado.
- `site/public/js/area-filiado.js`: Remoção de bloqueio de perfil indevido.

## 6. Testes de Cenário (🧪)
- [x] Login como FILIADO → Editar dados próprios (Sucesso, com restrições)
- [x] Login como DIRETORIA → Editar dados próprios (Sucesso, permissão plena)
- [x] Login como DIRETORIA → Editar dados de FILIADO (Sucesso)
- [x] Login como ADMIN → Promover DIRETORIA (Sucesso)
- [x] Login como DIRETORIA → Tentar promover ADMIN (Falha conforme esperado)
- [x] Tentativa de editar Logradouro sem CEP (Bloqueado/Ignorado)

---
**Status Final**: ✅ REPOSITÓRIO EM CONFORMIDADE CANÔNICA
