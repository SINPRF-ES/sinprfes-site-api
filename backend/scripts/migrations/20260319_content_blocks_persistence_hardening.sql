-- Harden CMS block persistence for redeploy-safe behavior.
-- Ensures the PostgreSQL source of truth preserves activation state.

UPDATE content_blocks
SET is_active = TRUE
WHERE is_active IS NULL;

ALTER TABLE content_blocks
  ALTER COLUMN is_active SET DEFAULT TRUE;

ALTER TABLE content_blocks
  ALTER COLUMN is_active SET NOT NULL;

ALTER TABLE content_blocks
  ALTER COLUMN slot TYPE VARCHAR(100);

CREATE UNIQUE INDEX IF NOT EXISTS uq_content_blocks_page_slot
  ON content_blocks (page, slot);
