-- Phase A: Backfill
UPDATE filiados
SET arquivado_motivo = motivo_arquivamento
WHERE arquivado_motivo IS NULL AND motivo_arquivamento IS NOT NULL;

UPDATE filiados
SET arquivado_por = arquivado_pelo_id
WHERE arquivado_por IS NULL AND arquivado_pelo_id IS NOT NULL;

-- Phase B: Drop duplicates
ALTER TABLE filiados DROP COLUMN IF EXISTS motivo_arquivamento;
ALTER TABLE filiados DROP COLUMN IF EXISTS arquivado_pelo_id;
