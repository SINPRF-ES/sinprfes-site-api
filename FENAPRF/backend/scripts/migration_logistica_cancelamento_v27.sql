-- ============================================================================
-- FENAPRF MIGRATION V27: LOGISTICA CANCELAMENTO E AUDITORIA
-- ============================================================================

-- 1. Add audit columns to logistica_eventos
ALTER TABLE logistica_eventos
ADD COLUMN IF NOT EXISTS encerrado_em TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS encerrado_por UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS encerrado_motivo TEXT,
ADD COLUMN IF NOT EXISTS cancelado_em TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS cancelado_por UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS cancelado_motivo TEXT;

-- 2. Update status constraint if it exists (assuming it's just a varchar for now)
-- The migration v25 used: status VARCHAR(20) DEFAULT 'ativo',
-- We'll just ensure it supports 'cancelado' as well.
