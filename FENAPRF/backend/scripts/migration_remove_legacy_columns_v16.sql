-- Migration Remove Legacy Columns V16
-- Objetivo: Remover as colunas delegacia e posto da tabela users, mantendo apenas lotacao.

BEGIN;

-- 1) Auditoria rápida (opcional): checar se ainda existe dado preenchido em colunas legadas
-- SELECT COUNT(*) FROM users WHERE delegacia IS NOT NULL OR posto IS NOT NULL;

-- 2) Drop das colunas legadas (idempotente)
ALTER TABLE users
  DROP COLUMN IF EXISTS delegacia,
  DROP COLUMN IF EXISTS posto;

COMMIT;
