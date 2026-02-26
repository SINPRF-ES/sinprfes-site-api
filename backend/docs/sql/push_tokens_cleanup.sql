-- SINPRF-ES: Push Tokens Cleanup
-- Objetivo: Desativar tokens que podem causar ChunkErro (sem Project ID ou scope divergente)

-- 1. Desativar tokens ativos sem expo_project_id E sem project_id
-- Esses tokens causam mistura no envio do Expo SDK
UPDATE push_tokens
SET
    disabled_at = NOW(),
    disabled_reason = 'missing_project_id',
    updated_at = NOW()
WHERE
    disabled_at IS NULL
    AND revoked_at IS NULL
    AND (expo_project_id IS NULL OR expo_project_id = '')
    AND (project_id IS NULL OR project_id = '');

-- 2. Desativar tokens de scopes divergentes (Hard Safety)
-- Garante que este backend só lide com tokens do seu próprio escopo
UPDATE push_tokens
SET
    disabled_at = NOW(),
    disabled_reason = 'scope_mismatch',
    updated_at = NOW()
WHERE
    disabled_at IS NULL
    AND revoked_at IS NULL
    AND app_scope <> 'SINDICATO'; -- Ajustar para 'FENAPRF' se este for o repo Fenaprf

-- 3. Consulta de Verificação
SELECT
    app_scope,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE disabled_at IS NULL) as ativos,
    COUNT(*) FILTER (WHERE disabled_at IS NOT NULL) as desativados
FROM push_tokens
GROUP BY app_scope;
