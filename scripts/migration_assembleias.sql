-- Migration: Assembleias e Votações
-- Data: 2026-01-20

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Assembleias
CREATE TABLE IF NOT EXISTS assembleias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tipo VARCHAR(10) NOT NULL, -- AGE, AGO
    titulo VARCHAR(255) NOT NULL,
    descricao TEXT,
    estado VARCHAR(20) DEFAULT 'CRIADA', -- CRIADA, ABERTA, ENCERRADA
    criado_por INTEGER REFERENCES filiados(id),
    aberta_em TIMESTAMP,
    encerrada_em TIMESTAMP,
    criado_em TIMESTAMP DEFAULT NOW(),
    CONSTRAINT chk_estado CHECK (estado IN ('CRIADA', 'ABERTA', 'ENCERRADA')),
    CONSTRAINT chk_tipo CHECK (tipo IN ('AGE', 'AGO'))
);

-- 2. Quóruns (Chamadas)
CREATE TABLE IF NOT EXISTS assembleia_quoruns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assembleia_id UUID REFERENCES assembleias(id) ON DELETE CASCADE,
    token VARCHAR(6) NOT NULL,
    valido_ate TIMESTAMP NOT NULL,
    criado_em TIMESTAMP DEFAULT NOW()
);

-- 3. Check-ins
CREATE TABLE IF NOT EXISTS assembleia_checkins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quorum_id UUID REFERENCES assembleia_quoruns(id) ON DELETE CASCADE,
    filiado_id INTEGER REFERENCES filiados(id),
    registrado_em TIMESTAMP DEFAULT NOW(),
    UNIQUE(quorum_id, filiado_id)
);

-- 4. Mesa Diretora
CREATE TABLE IF NOT EXISTS assembleia_mesa (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assembleia_id UUID REFERENCES assembleias(id) ON DELETE CASCADE,
    filiado_id INTEGER REFERENCES filiados(id),
    cargo VARCHAR(20) NOT NULL, -- PRESIDENTE, SECRETARIO
    CONSTRAINT chk_cargo CHECK (cargo IN ('PRESIDENTE', 'SECRETARIO')),
    UNIQUE(assembleia_id, cargo)
);

-- 5. Votações (Itens de Pauta)
CREATE TABLE IF NOT EXISTS assembleia_votacoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assembleia_id UUID REFERENCES assembleias(id) ON DELETE CASCADE,
    quorum_snapshot_id UUID REFERENCES assembleia_quoruns(id), -- Snapshot de elegibilidade
    titulo VARCHAR(255) NOT NULL,
    descricao TEXT,
    estado VARCHAR(20) DEFAULT 'AGUARDANDO', -- AGUARDANDO, EM_CURSO, CONCLUIDA, RETIRADA
    duracao_minutos INTEGER DEFAULT 1,
    justificativa_retirada TEXT,
    aberta_em TIMESTAMP,
    finalizada_em TIMESTAMP,
    criado_em TIMESTAMP DEFAULT NOW(),
    CONSTRAINT chk_estado_vot CHECK (estado IN ('AGUARDANDO', 'EM_CURSO', 'CONCLUIDA', 'RETIRADA'))
);

-- 6. Votos
CREATE TABLE IF NOT EXISTS assembleia_votos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    votacao_id UUID REFERENCES assembleia_votacoes(id) ON DELETE CASCADE,
    filiado_id INTEGER REFERENCES filiados(id),
    voto VARCHAR(15) NOT NULL, -- SIM, NAO, ABSTENCAO
    registrado_em TIMESTAMP DEFAULT NOW(),
    CONSTRAINT chk_voto CHECK (voto IN ('SIM', 'NAO', 'ABSTENCAO')),
    UNIQUE(votacao_id, filiado_id)
);

-- 7. Pedidos de Palavra
CREATE TABLE IF NOT EXISTS assembleia_pedidos_palavra (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assembleia_id UUID REFERENCES assembleias(id) ON DELETE CASCADE,
    filiado_id INTEGER REFERENCES filiados(id),
    estado VARCHAR(20) DEFAULT 'PENDENTE', -- PENDENTE, EM_FALA, CONCLUIDO, CANCELADO
    ordem INTEGER,
    criado_em TIMESTAMP DEFAULT NOW(),
    CONSTRAINT chk_estado_palavra CHECK (estado IN ('PENDENTE', 'EM_FALA', 'CONCLUIDO', 'CANCELADO'))
);

-- 8. Propostas
CREATE TABLE IF NOT EXISTS assembleia_propostas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assembleia_id UUID REFERENCES assembleias(id) ON DELETE CASCADE,
    autor_id INTEGER REFERENCES filiados(id),
    titulo VARCHAR(255) NOT NULL,
    descricao TEXT,
    estado VARCHAR(20) DEFAULT 'PENDENTE', -- PENDENTE, VOTADA, RETIRADA
    motivo_retirada TEXT,
    criado_em TIMESTAMP DEFAULT NOW(),
    CONSTRAINT chk_estado_proposta CHECK (estado IN ('PENDENTE', 'VOTADA', 'RETIRADA'))
);

-- 9. Auditoria
CREATE TABLE IF NOT EXISTS assembleia_auditoria (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assembleia_id UUID REFERENCES assembleias(id) ON DELETE CASCADE,
    filiado_id INTEGER REFERENCES filiados(id),
    evento VARCHAR(50) NOT NULL,
    payload JSONB,
    criado_em TIMESTAMP DEFAULT NOW()
);
