-- ============================================================================
-- SINPRF-ES CANONICAL MIGRATION V2 (Consolidated)
-- This script contains all necessary schema updates for the 2.0 system.
-- It is designed to be idempotent (using IF NOT EXISTS).
-- ============================================================================

-- 1. Job Management (Idempotency control for jobs like birthday scan)
CREATE TABLE IF NOT EXISTS job_runs (
    job_name VARCHAR(50) PRIMARY KEY,
    last_run_date VARCHAR(10), -- Format: DD/MM/AAAA
    updated_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO job_runs (job_name, last_run_date)
VALUES ('BIRTHDAY_SCAN', '01/01/2000')
ON CONFLICT (job_name) DO NOTHING;

-- 2. CMS-Lite (Public site content blocks)
CREATE TABLE IF NOT EXISTS content_blocks (
    id SERIAL PRIMARY KEY,
    page VARCHAR(50) NOT NULL, -- 'home', 'noticias'
    slot VARCHAR(50) NOT NULL, -- 'hero', 'bloco_1', 'bloco_2', etc.
    title VARCHAR(255),
    body TEXT,
    media_type VARCHAR(20) DEFAULT 'image', -- 'image', 'video'
    media_url TEXT,
    link_url TEXT,
    link_text VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    ordenacao INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by INTEGER REFERENCES filiados(id)
);

-- 3. Assemblies & Voting System
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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
    data_hora_inicio TIMESTAMP,
    edital_url TEXT,
    CONSTRAINT chk_estado CHECK (estado IN ('CRIADA', 'ABERTA', 'ENCERRADA')),
    CONSTRAINT chk_tipo CHECK (tipo IN ('AGE', 'AGO'))
);

CREATE TABLE IF NOT EXISTS assembleia_quoruns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assembleia_id UUID REFERENCES assembleias(id) ON DELETE CASCADE,
    token VARCHAR(6) NOT NULL,
    valido_ate TIMESTAMP NOT NULL,
    criado_em TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS assembleia_checkins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quorum_id UUID REFERENCES assembleia_quoruns(id) ON DELETE CASCADE,
    filiado_id INTEGER REFERENCES filiados(id),
    registrado_em TIMESTAMP DEFAULT NOW(),
    UNIQUE(quorum_id, filiado_id)
);

CREATE TABLE IF NOT EXISTS assembleia_mesa (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assembleia_id UUID REFERENCES assembleias(id) ON DELETE CASCADE,
    filiado_id INTEGER REFERENCES filiados(id),
    cargo VARCHAR(20) NOT NULL, -- PRESIDENTE, SECRETARIO
    CONSTRAINT chk_cargo CHECK (cargo IN ('PRESIDENTE', 'SECRETARIO')),
    UNIQUE(assembleia_id, cargo)
);

CREATE TABLE IF NOT EXISTS assembleia_votacoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assembleia_id UUID REFERENCES assembleias(id) ON DELETE CASCADE,
    quorum_snapshot_id UUID REFERENCES assembleia_quoruns(id), -- Snapshot for eligibility
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

CREATE TABLE IF NOT EXISTS assembleia_votos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    votacao_id UUID REFERENCES assembleia_votacoes(id) ON DELETE CASCADE,
    filiado_id INTEGER REFERENCES filiados(id),
    voto VARCHAR(15) NOT NULL, -- SIM, NAO, ABSTENCAO
    registrado_em TIMESTAMP DEFAULT NOW(),
    CONSTRAINT chk_voto CHECK (voto IN ('SIM', 'NAO', 'ABSTENCAO')),
    UNIQUE(votacao_id, filiado_id)
);

CREATE TABLE IF NOT EXISTS assembleia_pedidos_palavra (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assembleia_id UUID REFERENCES assembleias(id) ON DELETE CASCADE,
    filiado_id INTEGER REFERENCES filiados(id),
    estado VARCHAR(20) DEFAULT 'PENDENTE', -- PENDENTE, EM_FALA, CONCLUIDO, CANCELADO
    ordem INTEGER,
    criado_em TIMESTAMP DEFAULT NOW(),
    CONSTRAINT chk_estado_palavra CHECK (estado IN ('PENDENTE', 'EM_FALA', 'CONCLUIDO', 'CANCELADO'))
);

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

CREATE TABLE IF NOT EXISTS assembleia_auditoria (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assembleia_id UUID REFERENCES assembleias(id) ON DELETE CASCADE,
    filiado_id INTEGER REFERENCES filiados(id),
    evento VARCHAR(50) NOT NULL,
    payload JSONB,
    criado_em TIMESTAMP DEFAULT NOW()
);

-- 4. Archive Management Standardization
-- Phase A: Backfill data from legacy columns to new standard ones
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'filiados' AND column_name = 'motivo_arquivamento') THEN
        UPDATE filiados SET arquivado_motivo = motivo_arquivamento WHERE arquivado_motivo IS NULL AND motivo_arquivamento IS NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'filiados' AND column_name = 'arquivado_pelo_id') THEN
        UPDATE filiados SET arquivado_por = arquivado_pelo_id WHERE arquivado_por IS NULL AND arquivado_pelo_id IS NOT NULL;
    END IF;
END $$;

-- Phase B: Drop duplicates
ALTER TABLE filiados DROP COLUMN IF EXISTS motivo_arquivamento;
ALTER TABLE filiados DROP COLUMN IF EXISTS arquivado_pelo_id;

-- 5. Alignment Fixes
DO $$
BEGIN
    -- Rename encerra_em to encerrada_em in assembleias if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assembleias' AND column_name = 'encerra_em') THEN
        ALTER TABLE assembleias RENAME COLUMN encerra_em TO encerrada_em;
    END IF;

    -- Add missing columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assembleias' AND column_name = 'data_hora_inicio') THEN
        ALTER TABLE assembleias ADD COLUMN data_hora_inicio TIMESTAMP;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assembleias' AND column_name = 'edital_url') THEN
        ALTER TABLE assembleias ADD COLUMN edital_url TEXT;
    END IF;
END $$;
