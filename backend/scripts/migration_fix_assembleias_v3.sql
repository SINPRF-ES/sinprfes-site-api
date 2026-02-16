-- Scripts de correção incremental para o módulo de Assembleias
-- Garante a existência de colunas críticas para evitar erro 500 no GET/POST

DO $$
BEGIN
    -- 1. Garantir data_hora_inicio
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assembleias' AND column_name = 'data_hora_inicio') THEN
        ALTER TABLE assembleias ADD COLUMN data_hora_inicio TIMESTAMP;
    END IF;

    -- 2. Garantir edital_url
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assembleias' AND column_name = 'edital_url') THEN
        ALTER TABLE assembleias ADD COLUMN edital_url TEXT;
    END IF;

    -- 3. Garantir criado_por (se estiver faltando ou com nome antigo)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assembleias' AND column_name = 'criado_por') THEN
        ALTER TABLE assembleias ADD COLUMN criado_por INTEGER REFERENCES filiados(id);
    END IF;

    -- 4. Garantir criado_em (usado no ORDER BY do listar)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assembleias' AND column_name = 'criado_em') THEN
        ALTER TABLE assembleias ADD COLUMN criado_em TIMESTAMP DEFAULT NOW();
    END IF;

    -- 5. Normalizar encerrada_em (caso ainda esteja como encerra_em)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assembleias' AND column_name = 'encerra_em')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assembleias' AND column_name = 'encerrada_em') THEN
        ALTER TABLE assembleias RENAME COLUMN encerra_em TO encerrada_em;
    END IF;
END $$;
