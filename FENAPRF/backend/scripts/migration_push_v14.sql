-- Migration v14: Push Enhancements
-- 1. Add permission_status to push_tokens
-- 2. Register PUSH_CLEANUP job

ALTER TABLE push_tokens ADD COLUMN IF NOT EXISTS permission_status VARCHAR(20);

-- Register cleanup job if it doesn't exist
INSERT INTO job_runs (job_name, last_run_date, updated_at)
SELECT 'PUSH_CLEANUP', '01/01/1970', NOW()
WHERE NOT EXISTS (SELECT 1 FROM job_runs WHERE job_name = 'PUSH_CLEANUP');
