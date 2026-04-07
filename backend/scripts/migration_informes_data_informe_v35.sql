-- Migration v35: canonicalize INFORMES date column name
-- Goal: avoid semantic mix between NOTICIAS (`data_noticia`) and INFORMES (`data_informe`)

ALTER TABLE informes
  ADD COLUMN IF NOT EXISTS data_informe TIMESTAMPTZ;

UPDATE informes
SET data_informe = COALESCE(data_informe, data_noticia)
WHERE data_informe IS NULL
  AND data_noticia IS NOT NULL;

ALTER TABLE informes
  DROP COLUMN IF EXISTS data_noticia;
