-- ============================================================================
-- FENAPRF MIGRATION V23: FIX ID TYPES AND COLUMN NAMES
-- Fixing errors reported in Render logs:
-- 1. column pi.user_id does not exist in pre_inscricoes_jogos
-- 2. invalid input syntax for type integer for UUID in multiple tables
-- ============================================================================

-- 1. Fix users table itself for reference columns
DO $$
BEGIN
    ALTER TABLE users ALTER COLUMN arquivado_por TYPE UUID USING arquivado_por::text::uuid;
EXCEPTION WHEN others THEN RAISE NOTICE 'Could not alter users.arquivado_por'; END $$;

DO $$
BEGIN
    ALTER TABLE users ALTER COLUMN desarquivado_por TYPE UUID USING desarquivado_por::text::uuid;
EXCEPTION WHEN others THEN RAISE NOTICE 'Could not alter users.desarquivado_por'; END $$;

-- 2. Fix push_tokens table
DO $$
BEGIN
    ALTER TABLE push_tokens ALTER COLUMN user_id TYPE UUID USING user_id::text::uuid;
EXCEPTION WHEN others THEN RAISE NOTICE 'Could not alter push_tokens.user_id'; END $$;

-- 3. Fix push_campaigns table
DO $$
BEGIN
    ALTER TABLE push_campaigns ALTER COLUMN created_by TYPE UUID USING created_by::text::uuid;
EXCEPTION WHEN others THEN RAISE NOTICE 'Could not alter push_campaigns.created_by'; END $$;

-- 4. Fix pre_inscricoes_jogos table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pre_inscricoes_jogos') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pre_inscricoes_jogos' AND column_name = 'user_id') THEN
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pre_inscricoes_jogos' AND column_name = 'id_user') THEN
                ALTER TABLE pre_inscricoes_jogos RENAME COLUMN id_user TO user_id;
            ELSE
                ALTER TABLE pre_inscricoes_jogos ADD COLUMN user_id UUID;
            END IF;
        END IF;
        ALTER TABLE pre_inscricoes_jogos ALTER COLUMN user_id TYPE UUID USING user_id::text::uuid;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pre_inscricoes_jogos_user_id_key') THEN
            ALTER TABLE pre_inscricoes_jogos ADD CONSTRAINT pre_inscricoes_jogos_user_id_key UNIQUE (user_id);
        END IF;
    END IF;
END $$;

-- 5. Fix content_blocks table
DO $$
BEGIN
    ALTER TABLE content_blocks ALTER COLUMN updated_by TYPE UUID USING updated_by::text::uuid;
EXCEPTION WHEN others THEN RAISE NOTICE 'Could not alter content_blocks.updated_by'; END $$;

-- 6. Fix Assembly system tables
DO $$
BEGIN
    ALTER TABLE assembleias ALTER COLUMN criado_por TYPE UUID USING criado_por::text::uuid;
EXCEPTION WHEN others THEN RAISE NOTICE 'Could not alter assembleias.criado_por'; END $$;

DO $$
BEGIN
    ALTER TABLE assembleia_checkins ALTER COLUMN user_id TYPE UUID USING user_id::text::uuid;
EXCEPTION WHEN others THEN RAISE NOTICE 'Could not alter assembleia_checkins.user_id'; END $$;

DO $$
BEGIN
    ALTER TABLE assembleia_mesa ALTER COLUMN user_id TYPE UUID USING user_id::text::uuid;
EXCEPTION WHEN others THEN RAISE NOTICE 'Could not alter assembleia_mesa.user_id'; END $$;

DO $$
BEGIN
    ALTER TABLE assembleia_votos ALTER COLUMN user_id TYPE UUID USING user_id::text::uuid;
EXCEPTION WHEN others THEN RAISE NOTICE 'Could not alter assembleia_votos.user_id'; END $$;

DO $$
BEGIN
    ALTER TABLE assembleia_pedidos_palavra ALTER COLUMN user_id TYPE UUID USING user_id::text::uuid;
EXCEPTION WHEN others THEN RAISE NOTICE 'Could not alter assembleia_pedidos_palavra.user_id'; END $$;

DO $$
BEGIN
    ALTER TABLE assembleia_propostas ALTER COLUMN autor_id TYPE UUID USING autor_id::text::uuid;
EXCEPTION WHEN others THEN RAISE NOTICE 'Could not alter assembleia_propostas.autor_id'; END $$;

DO $$
BEGIN
    ALTER TABLE assembleia_auditoria ALTER COLUMN user_id TYPE UUID USING user_id::text::uuid;
EXCEPTION WHEN others THEN RAISE NOTICE 'Could not alter assembleia_auditoria.user_id'; END $$;

-- 7. Sync table name used in push service
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inscricoes_jogos')
       AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pre_inscricoes_jogos') THEN
        ALTER TABLE inscricoes_jogos RENAME TO pre_inscricoes_jogos;
    END IF;
END $$;
