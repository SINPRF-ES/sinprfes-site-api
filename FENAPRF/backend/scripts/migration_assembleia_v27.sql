-- Migration: Assembleia FENAPRF V3 (Enhanced States, Mesa and QR Global)
-- Date: 2026-02-12

-- 1. Update states and constraints
-- First, update existing data to match new states if possible
UPDATE assembleias SET estado = 'CRIADO' WHERE estado = 'CRIADA';
UPDATE assembleias SET estado = 'EM_CREDENCIAMENTO' WHERE estado = 'ABERTA';
UPDATE assembleias SET estado = 'INICIADO' WHERE estado = 'EM_CURSO';
UPDATE assembleias SET estado = 'ENCERRADO' WHERE estado = 'ENCERRADA';

-- Drop old constraint and add new one
ALTER TABLE assembleias DROP CONSTRAINT IF EXISTS chk_estado;
ALTER TABLE assembleias ADD CONSTRAINT chk_estado CHECK (estado IN ('CRIADO', 'EM_CREDENCIAMENTO', 'INICIADO', 'SUSPENSA', 'ENCERRADO'));

-- 2. Add suspension fields to assembleias
ALTER TABLE assembleias ADD COLUMN IF NOT EXISTS suspensao_motivo TEXT;
ALTER TABLE assembleias ADD COLUMN IF NOT EXISTS data_hora_retorno TIMESTAMP;

-- 3. Enhance assembleia_mesa
ALTER TABLE assembleia_mesa ADD COLUMN IF NOT EXISTS vice_presidente_user_id INTEGER REFERENCES users(id);
ALTER TABLE assembleia_mesa ADD COLUMN IF NOT EXISTS secretario_2_user_id INTEGER REFERENCES users(id);

-- 4. Create board rejection tracking table
CREATE TABLE IF NOT EXISTS assembleia_mesa_rejeicoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assembleia_id UUID REFERENCES assembleias(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    cargo VARCHAR(50) NOT NULL,
    criado_em TIMESTAMP DEFAULT NOW(),
    UNIQUE(assembleia_id, user_id, cargo)
);

-- 5. Add is_global to quorums
ALTER TABLE assembleia_quoruns ADD COLUMN IF NOT EXISTS is_global BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN assembleia_quoruns.is_global IS 'Indica se este é o QR Code Global do evento, válido até o encerramento';
