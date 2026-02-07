-- Migration v18: Notícias module
-- 1. Create noticias table
-- 2. Create noticia_midias table

CREATE TABLE IF NOT EXISTS noticias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo VARCHAR(255) NOT NULL,
    conteudo TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'RASCUNHO', -- RASCUNHO | PUBLICADA
    autor_id INTEGER REFERENCES users(id),
    capa_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    published_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT check_status CHECK (status IN ('RASCUNHO', 'PUBLICADA'))
);

CREATE TABLE IF NOT EXISTS noticia_midias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    noticia_id UUID REFERENCES noticias(id) ON DELETE CASCADE,
    tipo VARCHAR(10) NOT NULL, -- IMAGEM | VIDEO
    url TEXT NOT NULL,
    ordem INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT check_tipo CHECK (tipo IN ('IMAGEM', 'VIDEO'))
);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_noticias_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trg_noticias_updated_at
    BEFORE UPDATE ON noticias
    FOR EACH ROW
    EXECUTE FUNCTION update_noticias_updated_at();
