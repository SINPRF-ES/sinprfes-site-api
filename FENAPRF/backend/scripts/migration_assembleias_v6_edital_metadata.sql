-- scripts/migration_assembleias_v6_edital_metadata.sql
-- Adição de metadados do Cloudinary para editais de assembleia

DO $$
BEGIN
    -- 1. Tabela assembleias: Colunas de metadados do Cloudinary
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

END $$;
