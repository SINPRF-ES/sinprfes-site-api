-- v24: Fix project-id handling for SINDICATO push tokens

-- 1) Backfill seguro para escopo SINDICATO com projectId fixo conhecido
UPDATE push_tokens
SET
  expo_project_id = 'c589a042-895e-497e-a61f-a76216580a35',
  project_id = 'c589a042-895e-497e-a61f-a76216580a35',
  updated_at = NOW()
WHERE app_scope = 'SINDICATO'
  AND revoked_at IS NULL
  AND (expo_project_id IS NULL OR expo_project_id = '')
  AND (project_id IS NULL OR project_id = '');

-- 2) Reabilita tokens desativados indevidamente por missing_project_id
UPDATE push_tokens
SET
  disabled_at = NULL,
  disabled_reason = NULL,
  updated_at = NOW()
WHERE disabled_reason = 'missing_project_id'
  AND COALESCE(NULLIF(expo_project_id, ''), NULLIF(project_id, '')) IS NOT NULL;
