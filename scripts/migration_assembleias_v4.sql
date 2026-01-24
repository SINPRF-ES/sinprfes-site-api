-- scripts/migration_assembleias_v4.sql
-- Alinhamento do módulo de Assembleias com o CANON e requisitos v4

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$
BEGIN
    -- 1. Tabela assembleias
    -- Garantir colunas novas
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assembleias' AND column_name = 'pauta') THEN
        ALTER TABLE assembleias ADD COLUMN pauta TEXT;
    END IF;

    -- Se 'descricao' existe, podemos copiar para 'pauta' se pauta estiver vazia
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assembleias' AND column_name = 'descricao') THEN
        UPDATE assembleias SET pauta = descricao WHERE pauta IS NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assembleias' AND column_name = 'data_evento') THEN
        ALTER TABLE assembleias ADD COLUMN data_evento DATE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assembleias' AND column_name = 'hora_primeira_chamada') THEN
        ALTER TABLE assembleias ADD COLUMN hora_primeira_chamada TIME;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assembleias' AND column_name = 'hora_segunda_chamada') THEN
        ALTER TABLE assembleias ADD COLUMN hora_segunda_chamada TIME;
    END IF;

    -- Ajustar constraints de estado
    ALTER TABLE assembleias DROP CONSTRAINT IF EXISTS chk_estado;
    ALTER TABLE assembleias ADD CONSTRAINT chk_estado CHECK (estado IN ('CRIADA', 'ABERTA', 'EM_CURSO', 'ENCERRADA'));

    -- 2. Tabela assembleia_quoruns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assembleia_quoruns' AND column_name = 'gerado_por_user_id') THEN
        ALTER TABLE assembleia_quoruns ADD COLUMN gerado_por_user_id INTEGER REFERENCES filiados(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assembleia_quoruns' AND column_name = 'encerrado_em') THEN
        ALTER TABLE assembleia_quoruns ADD COLUMN encerrado_em TIMESTAMP;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assembleia_quoruns' AND column_name = 'tipo_chamada') THEN
        ALTER TABLE assembleia_quoruns ADD COLUMN tipo_chamada VARCHAR(20); -- PRIMEIRA, SEGUNDA, RECONTAGEM
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assembleia_quoruns' AND column_name = 'quorum_total_ativos') THEN
        ALTER TABLE assembleia_quoruns ADD COLUMN quorum_total_ativos INTEGER;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assembleia_quoruns' AND column_name = 'quorum_necessario') THEN
        ALTER TABLE assembleia_quoruns ADD COLUMN quorum_necessario INTEGER;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assembleia_quoruns' AND column_name = 'observacao') THEN
        ALTER TABLE assembleia_quoruns ADD COLUMN observacao TEXT;
    END IF;

    -- 3. Tabela assembleia_checkins
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assembleia_checkins' AND column_name = 'quorum_id') THEN
        ALTER TABLE assembleia_checkins RENAME COLUMN quorum_id TO assembleia_quorum_id;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assembleia_checkins' AND column_name = 'origem') THEN
        ALTER TABLE assembleia_checkins ADD COLUMN origem VARCHAR(20); -- TOKEN, AUTO_GERADOR, AUTO_PRESIDENTE
    END IF;

    -- 4. Tabela assembleia_mesa
    -- Vamos recriar para garantir a estrutura UNIQUE por assembleia
    DROP TABLE IF EXISTS assembleia_mesa;
    CREATE TABLE assembleia_mesa (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        assembleia_id UUID NOT NULL REFERENCES assembleias(id) ON DELETE CASCADE,
        presidente_user_id INTEGER REFERENCES filiados(id),
        secretario_user_id INTEGER REFERENCES filiados(id),
        definida_em TIMESTAMP DEFAULT NOW(),
        definida_por_user_id INTEGER REFERENCES filiados(id),
        UNIQUE(assembleia_id)
    );

    -- 5. Tabela assembleia_votacoes
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assembleia_votacoes' AND column_name = 'estado') THEN
        ALTER TABLE assembleia_votacoes RENAME COLUMN estado TO status;
    END IF;

    ALTER TABLE assembleia_votacoes DROP CONSTRAINT IF EXISTS chk_estado_vot;
    ALTER TABLE assembleia_votacoes ADD CONSTRAINT chk_status_vot CHECK (status IN ('ATIVA', 'ENCERRADA', 'AGUARDANDO', 'RETIRADA'));

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assembleia_votacoes' AND column_name = 'iniciada_por_user_id') THEN
        ALTER TABLE assembleia_votacoes ADD COLUMN iniciada_por_user_id INTEGER REFERENCES filiados(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assembleia_votacoes' AND column_name = 'duracao_segundos') THEN
        ALTER TABLE assembleia_votacoes ADD COLUMN duracao_segundos INTEGER;
    END IF;

    -- 6. Tabela assembleia_pedidos_palavra
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assembleia_pedidos_palavra' AND column_name = 'estado') THEN
        ALTER TABLE assembleia_pedidos_palavra RENAME COLUMN estado TO status;
    END IF;

    ALTER TABLE assembleia_pedidos_palavra DROP CONSTRAINT IF EXISTS chk_estado_palavra;
    ALTER TABLE assembleia_pedidos_palavra ADD CONSTRAINT chk_status_palavra CHECK (status IN ('PENDENTE', 'CONCEDIDO', 'CANCELADO', 'ENCERRADO', 'EM_FALA', 'CONCLUIDO'));

    -- 7. Tabela assembleia_propostas
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assembleia_propostas' AND column_name = 'estado') THEN
        ALTER TABLE assembleia_propostas RENAME COLUMN estado TO status;
    END IF;

    ALTER TABLE assembleia_propostas DROP CONSTRAINT IF EXISTS chk_estado_proposta;
    ALTER TABLE assembleia_propostas ADD CONSTRAINT chk_status_proposta CHECK (status IN ('ATIVA', 'RETIRADA', 'APROVADA', 'REJEITADA', 'PENDENTE', 'VOTADA'));

    -- 8. Tabela assembleia_votos (ajuste de FK se necessário, mas parece ok)
    -- O nome do campo é filiado_id, o que é consistente com o resto do sistema

    -- 9. Auditoria (Garantir campos)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assembleia_auditoria' AND column_name = 'user_id') THEN
        -- Se filiado_id existe, podemos renomear ou apenas adicionar user_id
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assembleia_auditoria' AND column_name = 'filiado_id') THEN
            ALTER TABLE assembleia_auditoria RENAME COLUMN filiado_id TO user_id;
        ELSE
            ALTER TABLE assembleia_auditoria ADD COLUMN user_id INTEGER REFERENCES filiados(id);
        END IF;
    END IF;

END $$;
