-- FENAPRF MIGRATION V33: ASSEMBLEIA CHECKINS PENDENTES
-- Objetivo: Suporte a substituição hierárquica (lock durante votação).

CREATE TABLE IF NOT EXISTS assembleia_checkins_pendentes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assembleia_id UUID NOT NULL REFERENCES assembleias(id) ON DELETE CASCADE,
    quorum_id UUID NOT NULL REFERENCES assembleia_quoruns(id) ON DELETE CASCADE,
    user_id_superior UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_id_subordinado UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    branch VARCHAR(20) NOT NULL,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ass_pendentes_ass ON assembleia_checkins_pendentes(assembleia_id);
