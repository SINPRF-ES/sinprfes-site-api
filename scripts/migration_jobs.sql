CREATE TABLE IF NOT EXISTS job_runs (
    job_name VARCHAR(50) PRIMARY KEY,
    last_run_date VARCHAR(10), -- DD/MM/AAAA
    updated_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO job_runs (job_name, last_run_date)
VALUES ('BIRTHDAY_SCAN', '01/01/2000')
ON CONFLICT (job_name) DO NOTHING;
