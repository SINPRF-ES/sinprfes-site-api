-- Migration: Fix missing columns in assembleias table (Postgres 42703)
-- Date: 2026-02-14

DO $$
BEGIN
    -- 1. Rename descricao to pauta if descricao exists and pauta doesn't (SINPRF -> FENAPRF alignment)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assembleias' AND column_name = 'descricao')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assembleias' AND column_name = 'pauta') THEN
        ALTER TABLE assembleias RENAME COLUMN descricao TO pauta;
    END IF;

    -- 2. Ensure data_evento exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assembleias' AND column_name = 'data_evento') THEN
        ALTER TABLE assembleias ADD COLUMN data_evento DATE;
    END IF;

    -- 3. Ensure horários de chamada existem
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assembleias' AND column_name = 'hora_primeira_chamada') THEN
        ALTER TABLE assembleias ADD COLUMN hora_primeira_chamada TIME;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assembleias' AND column_name = 'hora_segunda_chamada') THEN
        ALTER TABLE assembleias ADD COLUMN hora_segunda_chamada TIME;
    END IF;

    -- 4. Ensure edital metadata columns exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assembleias' AND column_name = 'edital_public_id') THEN
        ALTER TABLE assembleias ADD COLUMN edital_public_id TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assembleias' AND column_name = 'edital_resource_type') THEN
        ALTER TABLE assembleias ADD COLUMN edital_resource_type TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assembleias' AND column_name = 'edital_type') THEN
        ALTER TABLE assembleias ADD COLUMN edital_type TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assembleias' AND column_name = 'edital_format') THEN
        ALTER TABLE assembleias ADD COLUMN edital_format TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assembleias' AND column_name = 'edital_drive_file_id') THEN
        ALTER TABLE assembleias ADD COLUMN edital_drive_file_id TEXT;
    END IF;

    -- 5. Ensure suspension fields exist (redundant with V27 but safe)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assembleias' AND column_name = 'suspensao_motivo') THEN
        ALTER TABLE assembleias ADD COLUMN suspensao_motivo TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assembleias' AND column_name = 'data_hora_retorno') THEN
        ALTER TABLE assembleias ADD COLUMN data_hora_retorno TIMESTAMP;
    END IF;

    -- 6. Update type constraint for new assembly types
    ALTER TABLE assembleias DROP CONSTRAINT IF EXISTS chk_tipo;
    ALTER TABLE assembleias ADD CONSTRAINT chk_tipo CHECK (tipo IN ('AGE', 'AGO', 'REUNIAO_DELIBERATIVA', 'REUNIAO_INFORMATIVA', 'REUNIAO_TEMATICA'));

END $$;
