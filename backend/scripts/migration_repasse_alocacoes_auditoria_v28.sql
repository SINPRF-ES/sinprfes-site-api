-- v28: auditoria de cancelamento em repasse_evento_alocacoes
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'repasse_evento_alocacoes'
          AND column_name = 'revogado_motivo'
    ) THEN
        ALTER TABLE repasse_evento_alocacoes ADD COLUMN revogado_motivo TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'repasse_evento_alocacoes'
          AND column_name = 'revogado_por_user_id'
    ) THEN
        ALTER TABLE repasse_evento_alocacoes
            ADD COLUMN revogado_por_user_id INT REFERENCES filiados(id);
    END IF;
END $$;
