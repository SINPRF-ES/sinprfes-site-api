-- scripts/migration_assembleia_robustness_v9.sql
-- Ajuste de constraints para estados de propostas e pedidos de palavra

DO $$
BEGIN
    -- 1. Tabela assembleia_propostas: Incluir EM_VOTACAO
    ALTER TABLE assembleia_propostas DROP CONSTRAINT IF EXISTS chk_status_proposta;
    ALTER TABLE assembleia_propostas ADD CONSTRAINT chk_status_proposta
        CHECK (status IN ('ATIVA', 'RETIRADA', 'APROVADA', 'REJEITADA', 'PENDENTE', 'VOTADA', 'EM_VOTACAO'));

    -- 2. Tabela assembleia_pedidos_palavra: Garantir consistência
    -- O constraint atual já tem 'CONCEDIDO', mas vamos garantir que 'EM_FALA' e 'ENCERRADO' também façam sentido se usados.
    ALTER TABLE assembleia_pedidos_palavra DROP CONSTRAINT IF EXISTS chk_status_palavra;
    ALTER TABLE assembleia_pedidos_palavra ADD CONSTRAINT chk_status_palavra
        CHECK (status IN ('PENDENTE', 'CONCEDIDO', 'CANCELADO', 'ENCERRADO', 'EM_FALA', 'CONCLUIDO'));

END $$;
