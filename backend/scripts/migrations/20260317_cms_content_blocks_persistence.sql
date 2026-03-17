-- Canonical persistence for CMS blocks (home/convenios) in PostgreSQL.
-- Idempotent and non-destructive.

CREATE TABLE IF NOT EXISTS content_blocks (
  id SERIAL PRIMARY KEY,
  page VARCHAR(50) NOT NULL,
  slot VARCHAR(100) NOT NULL,
  title VARCHAR(255),
  body TEXT,
  media_type VARCHAR(20) DEFAULT 'image',
  media_url TEXT,
  link_url TEXT,
  link_text VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE,
  ordenacao INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_by INTEGER REFERENCES filiados(id)
);

CREATE INDEX IF NOT EXISTS idx_content_blocks_page_ordenacao
  ON content_blocks (page, ordenacao, id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'content_blocks'
      AND constraint_name = 'chk_content_blocks_page'
  ) THEN
    ALTER TABLE content_blocks
      ADD CONSTRAINT chk_content_blocks_page
      CHECK (page IN ('home', 'convenios'));
  END IF;
END $$;
