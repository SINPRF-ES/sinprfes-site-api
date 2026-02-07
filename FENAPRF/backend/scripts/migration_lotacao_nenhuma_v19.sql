-- ============================================================================
-- SINPRF-ES MIGRATION V19: ADD 'NENHUMA' TO LOTACAO
-- Allows 'NENHUMA' as a valid lotation value.
-- ============================================================================

-- Update CHECK constraint for lotacao
ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_lotacao;
ALTER TABLE users ADD CONSTRAINT chk_users_lotacao
  CHECK (lotacao IN ('SEDE', 'DEL 01 - Viana', 'DEL 02 - Serra', 'DEL 03 - Guarapari', 'DEL 04 - Linhares', 'NENHUMA'));
