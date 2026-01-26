-- scripts/migration_mesa_governance_v8.sql
-- Governança da Mesa e Propostas

DO $$
BEGIN
    -- 1. Tabela assembleia_mesa: Adicionar estabelecida_em
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assembleia_mesa' AND column_name = 'estabelecida_em') THEN
        ALTER TABLE assembleia_mesa ADD COLUMN estabelecida_em TIMESTAMP;
    END IF;

    -- 2. Tabela assembleia_propostas: Garantir colunas corretas
    -- Já sabemos que v2 usa 'descricao' e 'estado' (v4 renomeou estado para status)
    -- Vamos garantir que 'descricao' existe e 'status' existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assembleia_propostas' AND column_name = 'descricao') THEN
        ALTER TABLE assembleia_propostas ADD COLUMN descricao TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assembleia_propostas' AND column_name = 'status') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assembleia_propostas' AND column_name = 'estado') THEN
            ALTER TABLE assembleia_propostas RENAME COLUMN estado TO status;
        ELSE
            ALTER TABLE assembleia_propostas ADD COLUMN status VARCHAR(20) DEFAULT 'PENDENTE';
        END IF;
    END IF;

    -- Atualizar constraints de status da proposta para incluir 'ATIVA' se não estiver lá
    ALTER TABLE assembleia_propostas DROP CONSTRAINT IF EXISTS chk_status_proposta;
    ALTER TABLE assembleia_propostas ADD CONSTRAINT chk_status_proposta CHECK (status IN ('ATIVA', 'RETIRADA', 'APROVADA', 'REJEITADA', 'PENDENTE', 'VOTADA'));

END $$;
