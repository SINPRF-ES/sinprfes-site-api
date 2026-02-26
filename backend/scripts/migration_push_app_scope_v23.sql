-- Migration v23: Push Token Isolation (app_scope)
-- Adds app_scope and expo_project_id to push_tokens for multi-app support

ALTER TABLE push_tokens ADD COLUMN IF NOT EXISTS app_scope TEXT NOT NULL DEFAULT 'SINDICATO';
ALTER TABLE push_tokens ADD COLUMN IF NOT EXISTS expo_project_id TEXT;
ALTER TABLE push_tokens ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT now();

-- Ensure columns from v22 exist (safety)
ALTER TABLE push_tokens ADD COLUMN IF NOT EXISTS project_id TEXT;
ALTER TABLE push_tokens ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMP;
ALTER TABLE push_tokens ADD COLUMN IF NOT EXISTS disabled_reason TEXT;

-- Indices for filtering
CREATE INDEX IF NOT EXISTS idx_push_tokens_app_scope ON push_tokens(app_scope);
CREATE INDEX IF NOT EXISTS idx_push_tokens_expo_project_id ON push_tokens(expo_project_id);
