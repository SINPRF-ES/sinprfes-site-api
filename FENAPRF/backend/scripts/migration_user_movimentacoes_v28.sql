-- ============================================================================
-- FENAPRF MIGRATION V28: USER MOVIMENTACOES (HISTORICO ARQUIVAMENTO)
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_movimentacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    acao VARCHAR(20) NOT NULL, -- 'ARQUIVADO', 'DESARQUIVADO'
    por_id UUID NOT NULL REFERENCES users(id),
    motivo TEXT,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_movimentacoes_user ON user_movimentacoes(user_id);
