-- Migration v22: Push Project ID and grouping support
-- Adds project_id to push_tokens and enriches push_campaigns results

ALTER TABLE push_tokens ADD COLUMN IF NOT EXISTS project_id TEXT;
ALTER TABLE push_tokens ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMP;
ALTER TABLE push_tokens ADD COLUMN IF NOT EXISTS disabled_reason TEXT;

-- Index to help grouping and lookups
CREATE INDEX IF NOT EXISTS idx_push_tokens_project_id ON push_tokens(project_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_project ON push_tokens(user_id, project_id);
