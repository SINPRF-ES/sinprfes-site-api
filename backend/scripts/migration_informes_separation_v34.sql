-- Migration v34: Total separation of INFORMES (Internal) from NOTICIAS (Public)

-- 1. Create the new INFORMES table
CREATE TABLE IF NOT EXISTS informes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo VARCHAR(255) NOT NULL,
    subtitulo VARCHAR(255),
    conteudo TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'RASCUNHO', -- RASCUNHO | PUBLICADA
    status_editorial VARCHAR(20) NOT NULL DEFAULT 'ATUAL', -- ATUAL | ARQUIVADA
    autor_id INTEGER REFERENCES filiados(id),
    capa_url TEXT,
    capa_midia_id UUID, -- Legacy reference from some versions of informes controller
    is_editable BOOLEAN NOT NULL DEFAULT true,
    destaque BOOLEAN NOT NULL DEFAULT false,
    data_noticia TIMESTAMPTZ, -- Keeping for compatibility during migration, will use as data_informe
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    published_at TIMESTAMP WITH TIME ZONE,
    archived_at TIMESTAMP WITH TIME ZONE,
    sort_date TIMESTAMP WITH TIME ZONE,
    public_ref VARCHAR(255) UNIQUE,
    CONSTRAINT check_informes_status CHECK (status IN ('RASCUNHO', 'PUBLICADA')),
    CONSTRAINT check_informes_status_editorial CHECK (status_editorial IN ('ATUAL', 'ARQUIVADA'))
);

-- 2. Create the new INFORME_MIDIAS table
CREATE TABLE IF NOT EXISTS informe_midias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    informe_id UUID REFERENCES informes(id) ON DELETE CASCADE,
    tipo VARCHAR(10) NOT NULL, -- IMAGEM | VIDEO
    url TEXT NOT NULL,
    ordem INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT check_informe_midias_tipo CHECK (tipo IN ('IMAGEM', 'VIDEO'))
);

-- 3. Migrate existing internal news to INFORMES
INSERT INTO informes (
    id, titulo, subtitulo, conteudo, status, status_editorial, autor_id,
    capa_url, capa_midia_id, is_editable, destaque, data_noticia,
    created_at, updated_at, published_at, archived_at, sort_date, public_ref
)
SELECT
    id, titulo, subtitulo, conteudo, status, status_editorial, autor_id,
    capa_url, capa_midia_id, is_editable, destaque, data_noticia,
    created_at, updated_at, published_at, archived_at, sort_date, public_ref
FROM noticias
WHERE audiencia = 'INTERNA';

-- 4. Migrate associated media
INSERT INTO informe_midias (id, informe_id, tipo, url, ordem, created_at)
SELECT nm.id, nm.noticia_id, nm.tipo, nm.url, nm.ordem, nm.created_at
FROM noticia_midias nm
JOIN noticias n ON nm.noticia_id = n.id
WHERE n.audiencia = 'INTERNA';

-- 5. Create unique index for current informes (one per domain rule)
-- Note: Previously we had a unique index on 'audiencia' for 'PUBLICA'.
-- Now we just need to ensure we don't have multiple 'ATUAL' in informes if that's the rule.
-- The prompt says "novo informe assume como atual", which implies a rotation.
-- We'll add an index to help enforce this if needed, but the controller handles rotation.
CREATE INDEX IF NOT EXISTS ix_informes_status_editorial ON informes (status_editorial) WHERE status_editorial = 'ATUAL';

-- 6. Clean up NOTICIAS table
-- Delete migrated internal records
DELETE FROM noticia_midias WHERE noticia_id IN (SELECT id FROM noticias WHERE audiencia = 'INTERNA');
DELETE FROM noticias WHERE audiencia = 'INTERNA';

-- Remove the AUDIENCIA column from NOTICIAS
ALTER TABLE noticias DROP COLUMN IF EXISTS audiencia;

-- 7. Add specific triggers for INFORMES updated_at
CREATE OR REPLACE FUNCTION update_informes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trg_informes_updated_at
    BEFORE UPDATE ON informes
    FOR EACH ROW
    EXECUTE FUNCTION update_informes_updated_at();

-- 8. Clean up constraints on NOTICIAS if they mentioned audiencia
-- (Most was handled by DROP COLUMN)
