-- v25: Adiciona observação e campos de auditoria em repasse_movimentos

DO $$
BEGIN
    -- Renomear descricao para observacao se existir
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'repasse_movimentos' AND column_name = 'descricao') THEN
        ALTER TABLE repasse_movimentos RENAME COLUMN descricao TO observacao;
    END IF;

    -- Adicionar colunas se não existirem
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'repasse_movimentos' AND column_name = 'observacao') THEN
        ALTER TABLE repasse_movimentos ADD COLUMN observacao TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'repasse_movimentos' AND column_name = 'updated_at') THEN
        ALTER TABLE repasse_movimentos ADD COLUMN updated_at TIMESTAMP;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'repasse_movimentos' AND column_name = 'updated_by_user_id') THEN
        ALTER TABLE repasse_movimentos ADD COLUMN updated_by_user_id INT REFERENCES filiados(id);
    END IF;
END $$;
