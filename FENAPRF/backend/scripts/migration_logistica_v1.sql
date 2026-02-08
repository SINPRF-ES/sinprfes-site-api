-- FENAPRF/backend/scripts/migration_logistica_v1.sql

-- Tabela de Eventos Logísticos
CREATE TABLE IF NOT EXISTS logistica_eventos (
    id SERIAL PRIMARY KEY,
    titulo VARCHAR(255) NOT NULL,
    descricao TEXT,
    data_inicio TIMESTAMP WITH TIME ZONE NOT NULL,
    data_fim TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(50) DEFAULT 'ativo', -- 'ativo', 'encerrado'
    documento_link TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Inscrições em Eventos Logísticos
CREATE TABLE IF NOT EXISTS logistica_inscricoes (
    id SERIAL PRIMARY KEY,
    evento_id INTEGER REFERENCES logistica_eventos(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    data_chegada TIMESTAMP WITH TIME ZONE NOT NULL,
    data_saida TIMESTAMP WITH TIME ZONE NOT NULL,
    observacoes TEXT,
    justificativa TEXT, -- Armazena a última justificativa de alteração pela gestão
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(evento_id, user_id)
);

-- Tabela de Auditoria para Inscrições Logísticas
CREATE TABLE IF NOT EXISTS logistica_inscricoes_auditoria (
    id SERIAL PRIMARY KEY,
    inscricao_id INTEGER,
    evento_id INTEGER,
    user_id INTEGER,
    acao VARCHAR(50) NOT NULL, -- 'CRIAR', 'ALTERAR', 'CANCELAR'
    realizado_por INTEGER REFERENCES users(id),
    justificativa TEXT,
    dados_anteriores JSONB,
    dados_novos JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index para performance
CREATE INDEX IF NOT EXISTS idx_logistica_inscricoes_evento ON logistica_inscricoes(evento_id);
CREATE INDEX IF NOT EXISTS idx_logistica_inscricoes_user ON logistica_inscricoes(user_id);
CREATE INDEX IF NOT EXISTS idx_logistica_auditoria_inscricao ON logistica_inscricoes_auditoria(inscricao_id);
