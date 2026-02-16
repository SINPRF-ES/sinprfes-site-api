-- scripts/migration_assembleia_drive_v10.sql
-- Adição de suporte a armazenamento no Google Drive para editais de assembleia

DO $$
BEGIN
    -- 1. Tabela assembleias: Coluna para referência do Drive
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assembleias' AND column_name = 'edital_drive_file_id') THEN
        ALTER TABLE assembleias ADD COLUMN edital_drive_file_id TEXT;
    END IF;

END $$;
