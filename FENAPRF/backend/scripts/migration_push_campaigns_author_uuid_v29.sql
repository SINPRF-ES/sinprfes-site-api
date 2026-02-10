-- ============================================================================
-- FENAPRF MIGRATION V29: COMPREHENSIVE ID TYPE FIX (INTEGER TO UUID)
-- Migrating all user reference columns from INTEGER to UUID to support modern user IDs.
-- Covers: Push Campaigns, Report Jobs, Logistics, Events, and Assembly Mesa/Votations.
-- ============================================================================

DO $$
BEGIN
    -- 1. Push Campaigns
    ALTER TABLE push_campaigns ALTER COLUMN created_by TYPE UUID USING created_by::text::uuid;

    -- 2. Report Jobs
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'report_jobs') THEN
        ALTER TABLE report_jobs ALTER COLUMN requester_id TYPE UUID USING requester_id::text::uuid;
    END IF;

    -- 3. Logistics
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'logistica_eventos') THEN
        ALTER TABLE logistica_eventos ALTER COLUMN encerrado_por TYPE UUID USING encerrado_por::text::uuid;
        ALTER TABLE logistica_eventos ALTER COLUMN cancelado_por TYPE UUID USING cancelado_por::text::uuid;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'logistica_inscricoes') THEN
        ALTER TABLE logistica_inscricoes ALTER COLUMN user_id TYPE UUID USING user_id::text::uuid;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'logistica_auditoria') THEN
        ALTER TABLE logistica_auditoria ALTER COLUMN user_id TYPE UUID USING user_id::text::uuid;
        ALTER TABLE logistica_auditoria ALTER COLUMN gestor_id TYPE UUID USING gestor_id::text::uuid;
    END IF;

    -- 4. Events
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'eventos') THEN
        ALTER TABLE eventos ALTER COLUMN created_by TYPE UUID USING created_by::text::uuid;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'evento_presencas') THEN
        ALTER TABLE evento_presencas ALTER COLUMN user_id TYPE UUID USING user_id::text::uuid;
    END IF;

    -- 5. Assembly (Missing columns from V23)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'assembleia_mesa') THEN
        ALTER TABLE assembleia_mesa ALTER COLUMN presidente_user_id TYPE UUID USING presidente_user_id::text::uuid;
        ALTER TABLE assembleia_mesa ALTER COLUMN secretario_user_id TYPE UUID USING secretario_user_id::text::uuid;
        ALTER TABLE assembleia_mesa ALTER COLUMN definida_por_user_id TYPE UUID USING definida_por_user_id::text::uuid;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'assembleia_votacoes') THEN
        ALTER TABLE assembleia_votacoes ALTER COLUMN iniciada_por_user_id TYPE UUID USING iniciada_por_user_id::text::uuid;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'assembleia_quoruns') THEN
        ALTER TABLE assembleia_quoruns ALTER COLUMN gerado_por_user_id TYPE UUID USING gerado_por_user_id::text::uuid;
    END IF;

    RAISE NOTICE 'Comprehensive UUID migration successfully completed.';
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Migration encountered errors. Some columns might already be UUID or tables might be missing.';
END $$;

-- 6. Add Foreign Keys for consistency where possible
DO $$
BEGIN
    -- push_campaigns
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_push_campaigns_author') THEN
        ALTER TABLE push_campaigns ADD CONSTRAINT fk_push_campaigns_author FOREIGN KEY (created_by) REFERENCES users(id);
    END IF;

    -- report_jobs
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'report_jobs') AND
       NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_report_jobs_requester') THEN
        ALTER TABLE report_jobs ADD CONSTRAINT fk_report_jobs_requester FOREIGN KEY (requester_id) REFERENCES users(id);
    END IF;

    -- logistica_inscricoes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'logistica_inscricoes') AND
       NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_logistica_inscricoes_user') THEN
        ALTER TABLE logistica_inscricoes ADD CONSTRAINT fk_logistica_inscricoes_user FOREIGN KEY (user_id) REFERENCES users(id);
    END IF;

EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Could not add some foreign keys.';
END $$;
