-- ============================================================================
-- SINPRF-ES MIGRATION V21: REMOVE DEFAULT 'SEDE' FROM LOTACAO
-- Removes the default value for the lotacao column to enforce mandatory selection.
-- ============================================================================

ALTER TABLE filiados ALTER COLUMN lotacao DROP DEFAULT;
