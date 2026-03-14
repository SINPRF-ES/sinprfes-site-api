-- Migration v33: Public external indexing for CMS Notícias (PUBLICA)

ALTER TABLE noticias
  ADD COLUMN IF NOT EXISTS slug VARCHAR(180),
  ADD COLUMN IF NOT EXISTS public_ref VARCHAR(255);

-- Normalize potential legacy values (no-op when columns are empty/new)
UPDATE noticias
SET slug = NULL
WHERE slug IS NOT NULL AND btrim(slug) = '';

UPDATE noticias
SET public_ref = NULL
WHERE public_ref IS NOT NULL AND btrim(public_ref) = '';

-- Guarantee slug uniqueness only inside PUBLICA audience when present.
CREATE UNIQUE INDEX IF NOT EXISTS ux_noticias_publica_slug
  ON noticias (slug)
  WHERE audiencia = 'PUBLICA' AND slug IS NOT NULL;

-- Main canonical external ref for published CMS Notícias.
CREATE UNIQUE INDEX IF NOT EXISTS ux_noticias_public_ref
  ON noticias (public_ref)
  WHERE public_ref IS NOT NULL;

-- Fast lookup for public detail route.
CREATE INDEX IF NOT EXISTS ix_noticias_public_lookup
  ON noticias (audiencia, status, public_ref, published_at DESC);

-- Best-effort deterministic backfill for already published PUBLICA news.
WITH base AS (
  SELECT
    n.id,
    LOWER(REGEXP_REPLACE(translate(COALESCE(NULLIF(n.slug, ''), n.titulo, 'noticia'),'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ','AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'), '[^a-zA-Z0-9]+', '-', 'g')) AS slug_base,
    TO_CHAR(COALESCE(n.published_at, n.data_noticia, n.created_at), 'YYYYMMDD-HH24MISS') AS ts_part
  FROM noticias n
  WHERE n.audiencia = 'PUBLICA'
    AND n.status = 'PUBLICADA'
), normalized AS (
  SELECT
    id,
    COALESCE(NULLIF(REGEXP_REPLACE(slug_base, '(^-+)|(-+$)', '', 'g'), ''), 'noticia') AS slug_clean,
    ts_part
  FROM base
), ranked AS (
  SELECT
    id,
    slug_clean,
    ts_part,
    ROW_NUMBER() OVER (PARTITION BY slug_clean ORDER BY id) AS slug_rank,
    ROW_NUMBER() OVER (PARTITION BY ts_part, slug_clean ORDER BY id) AS ref_rank
  FROM normalized
), backfill AS (
  SELECT
    id,
    CASE WHEN slug_rank = 1 THEN slug_clean ELSE slug_clean || '-' || slug_rank::text END AS slug_final,
    ts_part,
    ref_rank
  FROM ranked
)
UPDATE noticias n
SET slug = CASE
      WHEN n.slug IS NULL THEN b.slug_final
      ELSE n.slug
    END,
    public_ref = CASE
      WHEN n.public_ref IS NULL THEN
        CASE WHEN b.ref_rank = 1 THEN b.ts_part || '-' || b.slug_final ELSE b.ts_part || '-' || b.slug_final || '-' || b.ref_rank::text END
      ELSE n.public_ref
    END
FROM backfill b
WHERE n.id = b.id;
