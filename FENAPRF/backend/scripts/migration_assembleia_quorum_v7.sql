-- scripts/migration_assembleia_quorum_v7.sql
-- Correção de robustez para geração de tokens e suporte a múltiplos snapshots (Atualizar Quórum)

DO $$
BEGIN
    -- 1. Tornar 'valido_ate' opcional (nullable) pois o sistema agora usa 'encerrado_em'
    -- Isso evita erro 500 no INSERT quando a coluna existe como NOT NULL do schema original (v2)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assembleia_quoruns' AND column_name = 'valido_ate') THEN
        ALTER TABLE assembleia_quoruns ALTER COLUMN valido_ate DROP NOT NULL;
    END IF;

    -- 2. Garantir que 'encerrado_em' existe (alinhamento com v4+)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assembleia_quoruns' AND column_name = 'encerrado_em') THEN
        ALTER TABLE assembleia_quoruns ADD COLUMN encerrado_em TIMESTAMP;
    END IF;

    -- 3. Índice para performance de busca de quórum ativo
    CREATE INDEX IF NOT EXISTS idx_assembleia_quorum_ativo_lookup ON assembleia_quoruns (assembleia_id) WHERE encerrado_em IS NULL;

    -- 4. Unicidade de Token Ativo por Assembleia + Chamada (Proteção contra corrida)
    -- Garante que só pode haver UM quórum aberto para cada tipo de chamada na mesma assembleia.
    -- Se tentar criar outro do mesmo tipo sem encerrar o anterior, o DB bloqueia.
    DROP INDEX IF EXISTS idx_assembleia_quorum_tipo_ativo;
    CREATE UNIQUE INDEX idx_assembleia_quorum_tipo_ativo ON assembleia_quoruns (assembleia_id, tipo_chamada) WHERE encerrado_em IS NULL;

END $$;
