-- v26: soft delete auditável em repasse_movimentos

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'repasse_movimentos' AND column_name = 'deleted_at') THEN
        ALTER TABLE repasse_movimentos ADD COLUMN deleted_at TIMESTAMP;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'repasse_movimentos' AND column_name = 'deleted_by_user_id') THEN
        ALTER TABLE repasse_movimentos ADD COLUMN deleted_by_user_id INT REFERENCES filiados(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'repasse_movimentos' AND column_name = 'delete_reason') THEN
        ALTER TABLE repasse_movimentos ADD COLUMN delete_reason TEXT;
    END IF;
END $$;
