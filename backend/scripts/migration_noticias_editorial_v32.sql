-- Migration v32: Canonical cover media for Informes/Notícias

ALTER TABLE noticias
  ADD COLUMN IF NOT EXISTS capa_midia_id UUID REFERENCES noticia_midias(id) ON DELETE SET NULL;

-- Backfill cover media relation when capa_url already points to an attached image
UPDATE noticias n
SET capa_midia_id = nm.id
FROM noticia_midias nm
WHERE n.capa_midia_id IS NULL
  AND n.capa_url IS NOT NULL
  AND nm.noticia_id = n.id
  AND nm.url = n.capa_url
  AND nm.tipo = 'IMAGEM';
