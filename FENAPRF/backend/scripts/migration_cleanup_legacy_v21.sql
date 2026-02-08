-- FENAPRF/backend/scripts/migration_cleanup_legacy_v21.sql

-- Objetivo: Remover completamente conceitos herdados do sindicato que não se aplicam à FENAPRF.

-- 1. Remover colunas desnecessárias da tabela users
ALTER TABLE users DROP COLUMN IF EXISTS lotacao;
ALTER TABLE users DROP COLUMN IF EXISTS siape;

-- 2. Remover a constraint de check de lotacao se existir
ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_lotacao;

-- 3. Remover tabelas relacionadas ao repasse por lotação (exclusivo sindicato)
DROP TABLE IF EXISTS repasse_lotacao;
DROP TABLE IF EXISTS repasse_mes;
