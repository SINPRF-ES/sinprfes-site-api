-- scripts/migration_fix_assembleias_v5.sql
-- Correção de robustez para o módulo de Assembleias
-- 1. Garante que colunas de data/hora/edital existem
-- 2. Garante que colunas da v4 (pauta, data_evento, chamadas) existem
-- 3. Aumenta tamanho do campo 'tipo' e relaxa constraint para suportar nomes extensos

DO $$
BEGIN
    -- 1. Tabela assembleias: Colunas básicas de v2/v3
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assembleias' AND column_name = 'data_hora_inicio') THEN
        ALTER TABLE assembleias ADD COLUMN data_hora_inicio TIMESTAMP;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assembleias' AND column_name = 'edital_url') THEN
        ALTER TABLE assembleias ADD COLUMN edital_url TEXT;
    END IF;

    -- 2. Tabela assembleias: Colunas de v4
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assembleias' AND column_name = 'pauta') THEN
        ALTER TABLE assembleias ADD COLUMN pauta TEXT;
    END IF;

    -- Backfill pauta de descricao se necessario
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assembleias' AND column_name = 'descricao') THEN
        UPDATE assembleias SET pauta = descricao WHERE pauta IS NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assembleias' AND column_name = 'data_evento') THEN
        ALTER TABLE assembleias ADD COLUMN data_evento DATE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assembleias' AND column_name = 'hora_primeira_chamada') THEN
        ALTER TABLE assembleias ADD COLUMN hora_primeira_chamada TIME;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assembleias' AND column_name = 'hora_segunda_chamada') THEN
        ALTER TABLE assembleias ADD COLUMN hora_segunda_chamada TIME;
    END IF;

    -- 3. Ajuste de Tipo e Constraint
    -- Aumentar VARCHAR(10) para VARCHAR(50) para suportar nomes por extenso
    ALTER TABLE assembleias ALTER COLUMN tipo TYPE VARCHAR(50);

    -- Relaxar chk_tipo
    ALTER TABLE assembleias DROP CONSTRAINT IF EXISTS chk_tipo;
    ALTER TABLE assembleias ADD CONSTRAINT chk_tipo CHECK (tipo IN ('AGE', 'AGO', 'Assembleia Geral Ordinária', 'Assembleia Geral Extraordinária'));

    -- 4. Garantir assembleia_mesa com colunas corretas (v4)
    -- Se a tabela estiver no formato antigo (v2), vamos renomear para segurança antes de recriar
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assembleia_mesa' AND column_name = 'cargo') THEN
        ALTER TABLE assembleia_mesa RENAME TO assembleia_mesa_legacy;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'assembleia_mesa') THEN
        CREATE TABLE assembleia_mesa (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            assembleia_id UUID NOT NULL REFERENCES assembleias(id) ON DELETE CASCADE,
            presidente_user_id INTEGER REFERENCES filiados(id),
            secretario_user_id INTEGER REFERENCES filiados(id),
            definida_em TIMESTAMP DEFAULT NOW(),
            definida_por_user_id INTEGER REFERENCES filiados(id),
            UNIQUE(assembleia_id)
        );
    END IF;

    -- 5. Garantir auditoria com user_id (v4)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assembleia_auditoria' AND column_name = 'filiado_id')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assembleia_auditoria' AND column_name = 'user_id') THEN
        ALTER TABLE assembleia_auditoria RENAME COLUMN filiado_id TO user_id;
    END IF;

END $$;
