-- scripts/migration_proposta_withdrawal_v11.sql
-- Adição de timestamp de retirada para propostas e garantia de campos de criação

DO $$
BEGIN
    -- 1. Garantir que 'retirada_em' e 'motivo_retirada' existem na tabela assembleia_propostas
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assembleia_propostas' AND column_name = 'retirada_em') THEN
        ALTER TABLE assembleia_propostas ADD COLUMN retirada_em TIMESTAMP;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assembleia_propostas' AND column_name = 'motivo_retirada') THEN
        ALTER TABLE assembleia_propostas ADD COLUMN motivo_retirada TEXT;
    END IF;

    -- 2. Garantir que 'criado_em' existe e tem default em assembleia_propostas
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assembleia_propostas' AND column_name = 'criado_em') THEN
        ALTER TABLE assembleia_propostas ADD COLUMN criado_em TIMESTAMP DEFAULT NOW();
    END IF;

    UPDATE assembleia_propostas SET criado_em = NOW() WHERE criado_em IS NULL;
    ALTER TABLE assembleia_propostas ALTER COLUMN criado_em SET DEFAULT NOW();
    ALTER TABLE assembleia_propostas ALTER COLUMN criado_em SET NOT NULL;

    -- 3. Garantir que 'criado_em' existe e tem default em assembleia_pedidos_palavra
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assembleia_pedidos_palavra' AND column_name = 'criado_em') THEN
        ALTER TABLE assembleia_pedidos_palavra ADD COLUMN criado_em TIMESTAMP DEFAULT NOW();
    END IF;

    UPDATE assembleia_pedidos_palavra SET criado_em = NOW() WHERE criado_em IS NULL;
    ALTER TABLE assembleia_pedidos_palavra ALTER COLUMN criado_em SET DEFAULT NOW();
    ALTER TABLE assembleia_pedidos_palavra ALTER COLUMN criado_em SET NOT NULL;

    -- 4. Garantir constraint de status correta
    ALTER TABLE assembleia_propostas DROP CONSTRAINT IF EXISTS chk_status_proposta;
    ALTER TABLE assembleia_propostas ADD CONSTRAINT chk_status_proposta
        CHECK (status IN ('ATIVA', 'RETIRADA', 'APROVADA', 'REJEITADA', 'PENDENTE', 'VOTADA', 'EM_VOTACAO'));

END $$;
