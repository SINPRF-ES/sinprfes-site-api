-- FENAPRF CLEANUP: REMOÇÃO DE TABELAS LEGADO NÃO UTILIZADAS
-- Data: 2025-05-22
-- Objetivo: Limpeza de tabelas identificadas como legadas durante a auditoria estrutural.
-- Atenção: NÃO EXECUTAR DIRETAMENTE. Script para futura migração.

BEGIN;

-- 1. Remoção de tabelas de conteúdo dinâmico (não utilizadas pelo backend atual)
DROP TABLE IF EXISTS content_blocks CASCADE;

-- 2. Remoção de tabelas de pré-inscrição de eventos passados
DROP TABLE IF EXISTS pre_inscricoes_jogos CASCADE;

COMMIT;
