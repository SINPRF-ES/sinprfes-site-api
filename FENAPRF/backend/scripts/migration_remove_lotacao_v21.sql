-- ============================================================================
-- FENAPRF MIGRATION V21: REMOVE LOTACAO CONCEPT
-- Lotação is a union-exclusive concept and does not exist in FENAPRF.
-- This migration removes the 'lotacao' column from users and renames/cleans up
-- the repasse module to use UF as the primary key.
-- ============================================================================

-- 1. Remove lotacao from users
-- 1. Remove lotacao and siape from users
ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_lotacao;
ALTER TABLE users DROP COLUMN IF EXISTS lotacao;
ALTER TABLE users DROP COLUMN IF EXISTS siape;

-- 2. Rename repasse_lotacao to repasse_unidades and its key column
-- We use UF as the key now.
ALTER TABLE repasse_lotacao RENAME TO repasse_unidades;
ALTER TABLE repasse_unidades RENAME COLUMN lotacao_key TO uf_key;

-- 3. Update primary key and foreign keys if necessary (already consistent if renamed)
-- The primary key of repasse_unidades (formerly repasse_lotacao) was (year, month, lotacao_key).
-- After rename it is (year, month, uf_key).

-- 4. Ensure chk_users_perfil is updated to correct roles (ADMIN, DIRETORIA, COLABORADOR, CONSELHEIRO)
-- This matches requirement 3.
ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_perfil;
ALTER TABLE users ADD CONSTRAINT chk_users_perfil
  CHECK (perfil_acesso IN ('ADMIN', 'DIRETORIA', 'COLABORADOR', 'CONSELHEIRO', 'FUNCIONARIO', 'USER', 'ORGANIZADOR', 'COMUNICADOR'));
-- Note: We keep the legacy ones for now to avoid breaking existing data if they haven't been migrated yet,
-- but we will update the service logic to prefer the new ones.
-- Actually, the prompt says "Perfis existentes: ADMIN, DIRETORIA, COLABORADOR, CONSELHEIRO".
-- I should probably migrate existing data too.

UPDATE users SET perfil_acesso = 'COLABORADOR' WHERE perfil_acesso = 'FUNCIONARIO';
UPDATE users SET perfil_acesso = 'CONSELHEIRO' WHERE perfil_acesso = 'USER';
-- ORGANIZADOR and COMUNICADOR are not mentioned in the new list, mapping them to COLABORADOR or CONSELHEIRO?
-- Requirement 3 only mentions the 4 roles.
UPDATE users SET perfil_acesso = 'COLABORADOR' WHERE perfil_acesso IN ('ORGANIZADOR', 'COMUNICADOR');

ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_perfil;
ALTER TABLE users ADD CONSTRAINT chk_users_perfil
  CHECK (perfil_acesso IN ('ADMIN', 'DIRETORIA', 'COLABORADOR', 'CONSELHEIRO'));
