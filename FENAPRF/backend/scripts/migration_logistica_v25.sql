-- ============================================================================
-- FENAPRF MIGRATION V25: LOGISTICA MODULE
-- ============================================================================

-- 1. Table for Logistics Events
CREATE TABLE IF NOT EXISTS logistica_eventos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo TEXT NOT NULL,
    descricao TEXT,
    data_inicio TIMESTAMP WITH TIME ZONE NOT NULL,
    data_fim TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) DEFAULT 'ativo', -- 'ativo', 'encerrado'
    documento_url TEXT,
    documento_id TEXT,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Table for Event Inscriptions
CREATE TABLE IF NOT EXISTS logistica_inscricoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evento_id UUID NOT NULL REFERENCES logistica_eventos(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    data_chegada TIMESTAMP WITH TIME ZONE NOT NULL,
    data_saida TIMESTAMP WITH TIME ZONE NOT NULL,
    observacoes TEXT,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(evento_id, user_id)
);

-- 3. Table for Logistics Audit/History
CREATE TABLE IF NOT EXISTS logistica_auditoria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recurso_tipo VARCHAR(20) NOT NULL, -- 'EVENTO', 'INSCRICAO'
    recurso_id UUID NOT NULL,
    evento_id UUID REFERENCES logistica_eventos(id) ON DELETE SET NULL,
    user_id UUID, -- Target user of the action (if inscription)
    gestor_id UUID NOT NULL REFERENCES users(id),
    acao VARCHAR(20) NOT NULL, -- 'CRIAR', 'ALTERAR', 'CANCELAR'
    justificativa TEXT NOT NULL,
    dados_anteriores JSONB,
    dados_novos JSONB,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_logistica_inscricoes_evento ON logistica_inscricoes(evento_id);
CREATE INDEX IF NOT EXISTS idx_logistica_auditoria_evento ON logistica_auditoria(evento_id);
