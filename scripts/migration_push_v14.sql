-- Migration v14: Push Enhancements
-- 1. Add permission_status to push_tokens
-- 2. Register PUSH_CLEANUP job

ALTER TABLE push_tokens ADD COLUMN IF NOT EXISTS permission_status VARCHAR(20);

-- Register cleanup job if it doesn't exist (to track last run)
INSERT INTO job_runs (job_name, last_run)
SELECT 'PUSH_CLEANUP', NOW() - INTERVAL '1 day'
WHERE NOT EXISTS (SELECT 1 FROM job_runs WHERE job_name = 'PUSH_CLEANUP');
