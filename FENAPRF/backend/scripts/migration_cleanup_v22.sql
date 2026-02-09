-- ============================================================================
-- FENAPRF MIGRATION V22: FINAL CONCEPTUAL CLEANUP
-- This migration ensures that all union-exclusive concepts are removed.
-- ============================================================================

-- 1. Ensure lotacao and siape are removed from users (Double-check)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='lotacao') THEN
        ALTER TABLE users DROP COLUMN lotacao;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='siape') THEN
        ALTER TABLE users DROP COLUMN siape;
    END IF;
END $$;

-- 2. Drop any remaining constraints related to lotacao
ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_lotacao;

-- 3. Ensure repasse module is fully migrated to UF
-- (Was already renamed in v21, but we ensure the columns are clean)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='repasse_lotacao') THEN
        ALTER TABLE repasse_lotacao RENAME TO repasse_unidades;
    END IF;
END $$;

-- 4. Clean up role constraints to strictly allow only FENAPRF roles
-- Roles: ADMIN, DIRETORIA, COLABORADOR, CONSELHEIRO
UPDATE users SET perfil_acesso = 'COLABORADOR' WHERE perfil_acesso NOT IN ('ADMIN', 'DIRETORIA', 'COLABORADOR', 'CONSELHEIRO');

ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_perfil;
ALTER TABLE users ADD CONSTRAINT chk_users_perfil
  CHECK (perfil_acesso IN ('ADMIN', 'DIRETORIA', 'COLABORADOR', 'CONSELHEIRO'));

-- 5. Remove any other possible residues (e.g. from push notifications or reports if they use these columns)
-- (Assuming they were handled in code or other migrations)
