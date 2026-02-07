-- ============================================================================
-- FENAPRF MIGRATION V20: RELATÓRIOS AND NEW FIELDS
-- Adds support for the new Reports module and canonical fields.
-- ============================================================================

-- 1. Ensure canonical fields exist in users
ALTER TABLE users ADD COLUMN IF NOT EXISTS sexo VARCHAR(1);
ALTER TABLE users ADD COLUMN IF NOT EXISTS siape VARCHAR(10);

-- 2. Create report_jobs table for auditing and history
CREATE TABLE IF NOT EXISTS report_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_type VARCHAR(50) NOT NULL, -- 'INDIVIDUAL', 'LOTACAO', 'SITUACAO'
    params JSONB,
    requester_id INTEGER REFERENCES users(id),
    requester_name VARCHAR(255),
    status VARCHAR(20) DEFAULT 'COMPLETED',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Add index for performance on history lookups
CREATE INDEX IF NOT EXISTS idx_report_jobs_requester ON report_jobs(requester_id);
CREATE INDEX IF NOT EXISTS idx_report_jobs_created_at ON report_jobs(created_at DESC);
