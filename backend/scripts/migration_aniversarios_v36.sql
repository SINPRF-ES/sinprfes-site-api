-- Migration v36: módulo ANIVERSARIOS (paralelo ao módulo INFORMES)
-- Objetivo: manter fluxo editorial independente para cards de aniversariantes.

CREATE TABLE IF NOT EXISTS aniversarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo TEXT NOT NULL,
    subtitulo TEXT,
    conteudo TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'RASCUNHO',
    autor_id UUID REFERENCES filiados(id),
    capa_url TEXT,
    capa_midia_id UUID,
    destaque BOOLEAN DEFAULT FALSE,
    data_informe TIMESTAMPTZ,
    public_ref VARCHAR(80),
    sort_date TIMESTAMPTZ,
    status_editorial VARCHAR(20) NOT NULL DEFAULT 'ATUAL',
    is_editable BOOLEAN NOT NULL DEFAULT TRUE,
    archived_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT check_aniversarios_status CHECK (status IN ('RASCUNHO', 'PUBLICADA')),
    CONSTRAINT check_aniversarios_status_editorial CHECK (status_editorial IN ('ATUAL', 'ARQUIVADA'))
);

CREATE TABLE IF NOT EXISTS aniversario_midias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aniversario_id UUID REFERENCES aniversarios(id) ON DELETE CASCADE,
    tipo VARCHAR(20) NOT NULL,
    url TEXT NOT NULL,
    ordem INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT check_aniversario_midias_tipo CHECK (tipo IN ('IMAGEM', 'VIDEO'))
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_aniversarios_single_atual
ON aniversarios ((1))
WHERE status_editorial = 'ATUAL';

CREATE UNIQUE INDEX IF NOT EXISTS ux_aniversarios_public_ref
ON aniversarios(public_ref)
WHERE public_ref IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_aniversarios_sort_date
ON aniversarios (COALESCE(sort_date, published_at, created_at) DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_aniversario_midias_aniversario_id
ON aniversario_midias (aniversario_id, ordem ASC);

CREATE OR REPLACE FUNCTION update_aniversarios_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_aniversarios_updated_at ON aniversarios;
CREATE TRIGGER trg_aniversarios_updated_at
    BEFORE UPDATE ON aniversarios
    FOR EACH ROW
    EXECUTE FUNCTION update_aniversarios_updated_at();
