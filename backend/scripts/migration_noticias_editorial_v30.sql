-- Migration v30: modelo editorial de notícia atual + arquivadas imutáveis

ALTER TABLE noticias
  ADD COLUMN IF NOT EXISTS subtitulo VARCHAR(255),
  ADD COLUMN IF NOT EXISTS destaque BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS data_noticia TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status_editorial VARCHAR(20) NOT NULL DEFAULT 'ATUAL',
  ADD COLUMN IF NOT EXISTS is_editable BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sort_date TIMESTAMPTZ;

UPDATE noticias
SET status_editorial = CASE WHEN status_editorial IS NULL THEN 'ATUAL' ELSE status_editorial END,
    is_editable = CASE WHEN is_editable IS NULL THEN true ELSE is_editable END,
    sort_date = COALESCE(sort_date, published_at, created_at),
    data_noticia = COALESCE(data_noticia, published_at, created_at);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'check_noticias_status_editorial'
  ) THEN
    ALTER TABLE noticias
      ADD CONSTRAINT check_noticias_status_editorial
      CHECK (status_editorial IN ('ATUAL', 'ARQUIVADA'));
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_noticias_publica_atual
  ON noticias (audiencia)
  WHERE audiencia = 'PUBLICA' AND status_editorial = 'ATUAL';
