-- FENAPRF MIGRATION V1: INSTITUTIONAL RESET (MARCO ZERO)
-- Objective: Standardize all IDs and Foreign Keys to UUID.
-- Pattern: PKs use gen_random_uuid() fallback, but Backend generates UUIDv7.

-- 0. Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. DROP all existing domain tables
DROP TABLE IF EXISTS pre_inscricoes_jogos CASCADE;
DROP TABLE IF EXISTS content_blocks CASCADE;
DROP TABLE IF EXISTS report_jobs CASCADE;
DROP TABLE IF EXISTS assembleia_auditoria CASCADE;
DROP TABLE IF EXISTS assembleia_votos CASCADE;
DROP TABLE IF EXISTS assembleia_votacoes CASCADE;
DROP TABLE IF EXISTS assembleia_checkins CASCADE;
DROP TABLE IF EXISTS assembleia_quoruns CASCADE;
DROP TABLE IF EXISTS assembleia_mesa_rejeicoes CASCADE;
DROP TABLE IF EXISTS assembleia_mesa CASCADE;
DROP TABLE IF EXISTS assembleia_pedidos_palavra CASCADE;
DROP TABLE IF EXISTS assembleia_propostas CASCADE;
DROP TABLE IF EXISTS assembleias CASCADE;
DROP TABLE IF EXISTS logistica_auditoria CASCADE;
DROP TABLE IF EXISTS logistica_inscricoes CASCADE;
DROP TABLE IF EXISTS logistica_eventos CASCADE;
DROP TABLE IF EXISTS evento_votacao_votos CASCADE;
DROP TABLE IF EXISTS evento_votacao_elegiveis CASCADE;
DROP TABLE IF EXISTS evento_votacao_opcoes CASCADE;
DROP TABLE IF EXISTS evento_votacoes CASCADE;
DROP TABLE IF EXISTS evento_presencas CASCADE;
DROP TABLE IF EXISTS eventos CASCADE;
DROP TABLE IF EXISTS votacao_votos CASCADE;
DROP TABLE IF EXISTS votacao_opcoes CASCADE;
DROP TABLE IF EXISTS votacoes CASCADE;
DROP TABLE IF EXISTS push_campaigns CASCADE;
DROP TABLE IF EXISTS push_tokens CASCADE;
DROP TABLE IF EXISTS user_movimentacoes CASCADE;
DROP TABLE IF EXISTS user_vinculos CASCADE;
DROP TABLE IF EXISTS job_runs CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 2. RECREATE tables

-- USERS (Compatibility Version)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cpf VARCHAR(11) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    password_hash VARCHAR(255),
    perfil_acesso VARCHAR(20), -- ADMIN, DIRETORIA, COLABORADOR, CONSELHEIRO
    situacao VARCHAR(20) DEFAULT 'ATIVO',
    bloqueado BOOLEAN DEFAULT FALSE,
    telefone1 VARCHAR(20),
    telefone2 VARCHAR(20),

    -- Address (remains in users)
    cep VARCHAR(8),
    logradouro TEXT,
    numero VARCHAR(20),
    complemento TEXT,
    bairro VARCHAR(100),
    cidade VARCHAR(100),
    uf VARCHAR(2), -- UF of functional link
    uf_endereco VARCHAR(2),

    data_nascimento DATE,
    sexo CHAR(1) CHECK (sexo IN ('M', 'F')),
    cargo VARCHAR(100),

    avatar_url TEXT,
    avatar_public_id TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ultimo_acesso TIMESTAMP WITH TIME ZONE,

    -- Archiving
    arquivado_em TIMESTAMP WITH TIME ZONE,
    arquivado_motivo TEXT,
    arquivado_por UUID REFERENCES users(id) ON DELETE SET NULL,
    desarquivado_em TIMESTAMP WITH TIME ZONE,
    desarquivado_motivo TEXT,
    desarquivado_por UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Legacy fields for app compatibility ("Campos 2")
    perfil_acesso2 VARCHAR(20),
    cargo2 VARCHAR(100),
    uf2 VARCHAR(2),
    cargo_mandato_inicio DATE,
    cargo_mandato_fim DATE,

    token_acesso_temp TEXT,
    token_expiracao TIMESTAMP WITH TIME ZONE,

    CONSTRAINT chk_mandato_dates CHECK (cargo_mandato_fim >= cargo_mandato_inicio),
    CONSTRAINT chk_uf_endereco CHECK (uf_endereco ~ '^[A-Z]{2}$')
);

-- USER VINCULOS (New normalization table)
CREATE TABLE user_vinculos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scope VARCHAR(20) NOT NULL, -- FENAPRF, UF, NACIONAL
    uf VARCHAR(2),
    branch VARCHAR(20), -- DIRETORIA, DELEGACAO
    role VARCHAR(50) NOT NULL,
    mandato_inicio DATE,
    mandato_fim DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'ATIVO',
    is_substitute BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT chk_vinculo_mandato CHECK (mandato_fim >= mandato_inicio)
);

-- USER MOVIMENTACOES
CREATE TABLE user_movimentacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    acao VARCHAR(50) NOT NULL,
    por_id UUID REFERENCES users(id) ON DELETE SET NULL,
    motivo TEXT,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- PUSH TOKENS
CREATE TABLE push_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expo_push_token TEXT UNIQUE NOT NULL,
    device_id TEXT,
    platform VARCHAR(20),
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    revoked_at TIMESTAMP WITH TIME ZONE,
    permission_status VARCHAR(20) DEFAULT 'granted'
);

-- PUSH CAMPAIGNS
CREATE TABLE push_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT,
    body TEXT NOT NULL,
    target_type VARCHAR(50) NOT NULL,
    target_value JSONB,
    data JSONB,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'PENDING',
    sent_at TIMESTAMP WITH TIME ZONE,
    result JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- VOTACOES (General)
CREATE TABLE votacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo VARCHAR(255) NOT NULL,
    descricao TEXT,
    status VARCHAR(20) DEFAULT 'AGENDADA',
    abre_em TIMESTAMP WITH TIME ZONE,
    encerra_em TIMESTAMP WITH TIME ZONE,
    criado_por UUID REFERENCES users(id) ON DELETE SET NULL,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE votacao_opcoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    votacao_id UUID NOT NULL REFERENCES votacoes(id) ON DELETE CASCADE,
    texto TEXT NOT NULL,
    ordem INTEGER DEFAULT 0
);

CREATE TABLE votacao_votos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    votacao_id UUID NOT NULL REFERENCES votacoes(id) ON DELETE CASCADE,
    opcao_id UUID NOT NULL REFERENCES votacao_opcoes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recibo UUID DEFAULT gen_random_uuid(),
    device_id TEXT,
    biometria_confirmada BOOLEAN DEFAULT FALSE,
    ip TEXT,
    user_agent TEXT,
    registrado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(votacao_id, user_id)
);

-- EVENTOS (General)
CREATE TABLE eventos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo VARCHAR(50) NOT NULL,
    titulo VARCHAR(255) NOT NULL,
    pauta_resumida TEXT,
    data_hora_inicio_prevista TIMESTAMP WITH TIME ZONE,
    duracao_prevista_min INTEGER,
    edital_pdf_url TEXT,
    status VARCHAR(20) DEFAULT 'RASCUNHO',
    quorum_versao_atual INTEGER DEFAULT 1,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    abre_em TIMESTAMP WITH TIME ZONE,
    encerra_em TIMESTAMP WITH TIME ZONE,
    quorum_epoch UUID DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- EVENTO PRESENCAS
CREATE TABLE evento_presencas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evento_id UUID NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    entrou_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    saiu_em TIMESTAMP WITH TIME ZONE,
    ativa BOOLEAN DEFAULT TRUE,
    quorum_versao INTEGER DEFAULT 1,
    quorum_epoch UUID,
    device_id TEXT,
    UNIQUE(evento_id, user_id, ativa)
);

-- EVENTO VOTACOES
CREATE TABLE evento_votacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evento_id UUID NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
    titulo VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'AGENDADA',
    abre_em TIMESTAMP WITH TIME ZONE,
    encerra_em TIMESTAMP WITH TIME ZONE,
    duracao_min INTEGER DEFAULT 2,
    criado_por UUID REFERENCES users(id) ON DELETE SET NULL,
    quorum_epoch_travado UUID,
    presenca_minima_em TIMESTAMP WITH TIME ZONE,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE evento_votacao_opcoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    votacao_id UUID NOT NULL REFERENCES evento_votacoes(id) ON DELETE CASCADE,
    texto TEXT NOT NULL,
    ordem INTEGER DEFAULT 0
);

CREATE TABLE evento_votacao_elegiveis (
    votacao_id UUID NOT NULL REFERENCES evento_votacoes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    entrou_em TIMESTAMP WITH TIME ZONE,
    PRIMARY KEY (votacao_id, user_id)
);

CREATE TABLE evento_votacao_votos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    votacao_id UUID NOT NULL REFERENCES evento_votacoes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    opcao_id UUID NOT NULL REFERENCES evento_votacao_opcoes(id) ON DELETE CASCADE,
    recibo UUID DEFAULT gen_random_uuid(),
    votou_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(votacao_id, user_id)
);

-- LOGISTICA EVENTOS
CREATE TABLE logistica_eventos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo TEXT NOT NULL,
    descricao TEXT,
    data_inicio TIMESTAMP WITH TIME ZONE NOT NULL,
    data_fim TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) DEFAULT 'ativo',
    documento_url TEXT,
    documento_id TEXT,
    assembleia_id UUID,
    cancelado_por UUID REFERENCES users(id) ON DELETE SET NULL,
    encerrado_por UUID REFERENCES users(id) ON DELETE SET NULL,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- LOGISTICA INSCRICOES
CREATE TABLE logistica_inscricoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evento_id UUID NOT NULL REFERENCES logistica_eventos(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    data_chegada TIMESTAMP WITH TIME ZONE NOT NULL,
    data_saida TIMESTAMP WITH TIME ZONE NOT NULL,
    observacoes TEXT,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(evento_id, user_id)
);

-- LOGISTICA AUDITORIA
CREATE TABLE logistica_auditoria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recurso_tipo VARCHAR(20) NOT NULL,
    recurso_id UUID NOT NULL,
    evento_id UUID REFERENCES logistica_eventos(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    gestor_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    acao VARCHAR(20) NOT NULL,
    justificativa TEXT NOT NULL,
    dados_anteriores JSONB,
    dados_novos JSONB,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ASSEMBLEIAS
CREATE TABLE assembleias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo VARCHAR(10) NOT NULL,
    titulo VARCHAR(255) NOT NULL,
    pauta TEXT,
    estado VARCHAR(20) DEFAULT 'CRIADO',
    criado_por UUID REFERENCES users(id) ON DELETE SET NULL,
    aberta_em TIMESTAMP WITH TIME ZONE,
    encerrada_em TIMESTAMP WITH TIME ZONE,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    data_hora_inicio TIMESTAMP WITH TIME ZONE,
    data_evento DATE,
    hora_primeira_chamada TIME,
    hora_segunda_chamada TIME,
    edital_url TEXT,
    edital_public_id TEXT,
    edital_resource_type TEXT,
    edital_type TEXT,
    edital_format TEXT,
    edital_drive_file_id TEXT,
    suspensao_motivo TEXT,
    data_hora_retorno TIMESTAMP WITH TIME ZONE,
    CONSTRAINT chk_estado CHECK (estado IN ('CRIADO', 'EM_CREDENCIAMENTO', 'INICIADO', 'SUSPENSA', 'ENCERRADO')),
    CONSTRAINT chk_tipo CHECK (tipo IN ('AGE', 'AGO', 'REUNIAO_DELIBERATIVA', 'REUNIAO_INFORMATIVA', 'REUNIAO_TEMATICA'))
);

-- Link logistica_eventos to assembleias
ALTER TABLE logistica_eventos ADD CONSTRAINT fk_logistica_assembleia FOREIGN KEY (assembleia_id) REFERENCES assembleias(id) ON DELETE SET NULL;

-- ASSEMBLEIA QUORUNS
CREATE TABLE assembleia_quoruns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assembleia_id UUID NOT NULL REFERENCES assembleias(id) ON DELETE CASCADE,
    token CHAR(10) NOT NULL UNIQUE,
    gerado_por_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    tipo_chamada VARCHAR(20) NOT NULL,
    quorum_total_ativos INTEGER DEFAULT 0,
    quorum_necessario INTEGER DEFAULT 0,
    is_global BOOLEAN DEFAULT FALSE,
    observacao TEXT,
    valido_ate TIMESTAMP WITH TIME ZONE,
    encerrado_em TIMESTAMP WITH TIME ZONE,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT chk_quorum_validity CHECK (
      (is_global = TRUE  AND valido_ate IS NULL)
      OR
      (is_global = FALSE AND valido_ate IS NOT NULL)
    )
);

-- Partial Indexes for Quorum Control
CREATE UNIQUE INDEX uq_quorum_global_ativo_por_assembleia
ON assembleia_quoruns (assembleia_id)
WHERE is_global = TRUE AND encerrado_em IS NULL;

CREATE UNIQUE INDEX uq_quorum_votacao_ativo_por_assembleia
ON assembleia_quoruns (assembleia_id)
WHERE is_global = FALSE AND encerrado_em IS NULL;

-- ASSEMBLEIA CHECKINS
CREATE TABLE assembleia_checkins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assembleia_quorum_id UUID NOT NULL REFERENCES assembleia_quoruns(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    origem VARCHAR(50),
    registrado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(assembleia_quorum_id, user_id)
);

-- ASSEMBLEIA MESA
CREATE TABLE assembleia_mesa (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assembleia_id UUID NOT NULL REFERENCES assembleias(id) ON DELETE CASCADE,
    presidente_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    vice_presidente_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    secretario_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    secretario_2_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    definida_por_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    definida_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    estabelecida_em TIMESTAMP WITH TIME ZONE,
    UNIQUE(assembleia_id)
);

-- ASSEMBLEIA MESA REJEICOES
CREATE TABLE assembleia_mesa_rejeicoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assembleia_id UUID NOT NULL REFERENCES assembleias(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    cargo VARCHAR(50) NOT NULL,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(assembleia_id, user_id, cargo)
);

-- ASSEMBLEIA VOTACOES
CREATE TABLE assembleia_votacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assembleia_id UUID NOT NULL REFERENCES assembleias(id) ON DELETE CASCADE,
    quorum_snapshot_id UUID REFERENCES assembleia_quoruns(id) ON DELETE SET NULL,
    titulo VARCHAR(255) NOT NULL,
    descricao TEXT,
    status VARCHAR(20) DEFAULT 'ATIVA',
    duracao_segundos INTEGER DEFAULT 60,
    iniciada_por_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    aberta_em TIMESTAMP WITH TIME ZONE,
    finalizada_em TIMESTAMP WITH TIME ZONE,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ASSEMBLEIA VOTOS
CREATE TABLE assembleia_votos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    votacao_id UUID NOT NULL REFERENCES assembleia_votacoes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    voto VARCHAR(15) NOT NULL,
    registrado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT chk_voto CHECK (voto IN ('SIM', 'NAO', 'ABSTENCAO')),
    UNIQUE(votacao_id, user_id)
);

-- ASSEMBLEIA PEDIDOS PALAVRA
CREATE TABLE assembleia_pedidos_palavra (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assembleia_id UUID NOT NULL REFERENCES assembleias(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'PENDENTE',
    ordem INTEGER,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ASSEMBLEIA PROPOSTAS
CREATE TABLE assembleia_propostas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assembleia_id UUID NOT NULL REFERENCES assembleias(id) ON DELETE CASCADE,
    autor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    titulo VARCHAR(255) NOT NULL,
    descricao TEXT,
    status VARCHAR(20) DEFAULT 'ATIVA',
    motivo_retirada TEXT,
    retirada_em TIMESTAMP WITH TIME ZONE,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ASSEMBLEIA AUDITORIA
CREATE TABLE assembleia_auditoria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assembleia_id UUID NOT NULL REFERENCES assembleias(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    evento VARCHAR(50) NOT NULL,
    payload JSONB,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- REPORT JOBS
CREATE TABLE report_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_type VARCHAR(50) NOT NULL,
    params JSONB,
    requester_id UUID REFERENCES users(id) ON DELETE SET NULL,
    requester_name VARCHAR(255),
    status VARCHAR(20) DEFAULT 'COMPLETED',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- CONTENT BLOCKS
CREATE TABLE content_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    page VARCHAR(50) NOT NULL,
    slot VARCHAR(50) NOT NULL,
    title VARCHAR(255),
    body TEXT,
    media_type VARCHAR(20) DEFAULT 'image',
    media_url TEXT,
    link_url TEXT,
    link_text VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    ordenacao INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- JOB RUNS
CREATE TABLE job_runs (
    job_name VARCHAR(50) PRIMARY KEY,
    last_run_date VARCHAR(10),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- PRE INSCRICOES JOGOS
CREATE TABLE pre_inscricoes_jogos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nome_user TEXT,
    modalidades JSONB,
    observacoes TEXT,
    familiares TEXT,
    qtd_familiares INTEGER DEFAULT 0,
    sexo TEXT,
    data_inscricao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    confirmado BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Initial Seeds
INSERT INTO job_runs (job_name, last_run_date) VALUES ('BIRTHDAY_SCAN', '01/01/2000') ON CONFLICT DO NOTHING;
INSERT INTO job_runs (job_name, last_run_date) VALUES ('PUSH_CLEANUP', '01/01/2000') ON CONFLICT DO NOTHING;
INSERT INTO job_runs (job_name, last_run_date) VALUES ('REPORT_CLEANUP', '01/01/2000') ON CONFLICT DO NOTHING;

-- 4. Indexes
CREATE INDEX idx_users_cpf ON users(cpf);
CREATE INDEX idx_users_name ON users(name);
CREATE INDEX idx_push_tokens_user ON push_tokens(user_id);
CREATE INDEX idx_logistica_inscricoes_user ON logistica_inscricoes(user_id);
CREATE INDEX idx_logistica_inscricoes_evento ON logistica_inscricoes(evento_id);
CREATE INDEX idx_assembleia_checkins_quorum ON assembleia_checkins(assembleia_quorum_id);
CREATE INDEX idx_assembleia_votos_votacao ON assembleia_votos(votacao_id);
CREATE INDEX idx_user_vinculos_user ON user_vinculos(user_id);
