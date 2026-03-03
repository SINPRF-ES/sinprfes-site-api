-- v27: soft delete auditável em repasse_eventos

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'repasse_eventos' AND column_name = 'deleted_at') THEN
        ALTER TABLE repasse_eventos ADD COLUMN deleted_at TIMESTAMP;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'repasse_eventos' AND column_name = 'deleted_by_user_id') THEN
        ALTER TABLE repasse_eventos ADD COLUMN deleted_by_user_id INT REFERENCES filiados(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'repasse_eventos' AND column_name = 'delete_reason') THEN
        ALTER TABLE repasse_eventos ADD COLUMN delete_reason TEXT;
    END IF;
END $$;
