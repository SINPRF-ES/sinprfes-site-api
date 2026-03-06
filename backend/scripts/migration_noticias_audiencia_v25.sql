-- Migration v25: separação de notícias públicas e informes internos

ALTER TABLE noticias
  ADD COLUMN IF NOT EXISTS audiencia VARCHAR(20) NOT NULL DEFAULT 'INTERNA';

UPDATE noticias
SET audiencia = 'INTERNA'
WHERE audiencia IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'check_noticias_audiencia'
  ) THEN
    ALTER TABLE noticias
      ADD CONSTRAINT check_noticias_audiencia
      CHECK (audiencia IN ('INTERNA', 'PUBLICA'));
  END IF;
END
$$;
