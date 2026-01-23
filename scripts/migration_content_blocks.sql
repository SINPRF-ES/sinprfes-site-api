-- scripts/migration_content_blocks.sql

CREATE TABLE IF NOT EXISTS content_blocks (
    id SERIAL PRIMARY KEY,
    page VARCHAR(50) NOT NULL, -- 'home', 'noticias'
    slot VARCHAR(50) NOT NULL, -- 'hero', 'bloco_1', 'bloco_2', etc.
    title VARCHAR(255),
    body TEXT,
    media_type VARCHAR(20) DEFAULT 'image', -- 'image', 'video'
    media_url TEXT,
    link_url TEXT,
    link_text VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    ordenacao INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by INTEGER REFERENCES filiados(id)
);

-- Dados iniciais de exemplo para a Home (Dev)
INSERT INTO content_blocks (page, slot, title, body, media_type, media_url, ordenacao)
VALUES
('home', 'hero', 'Bem-vindo ao Novo SINPRF-ES', 'Defendendo quem protege nossas rodovias com transparência e inovação.', 'image', '/img/hero_prf.jpg', 0),
('home', 'bloco_1', 'Assembleia Geral 2026', 'Participe das decisões que moldam o futuro da nossa categoria. Sua voz é nossa força.', 'image', '/img/noticia1.jpg', 1),
('home', 'bloco_2', 'Vídeo Institucional', 'Confira nossa atuação em destaque nas rodovias capixabas.', 'video', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 2);

-- Dados iniciais para Notícias
INSERT INTO content_blocks (page, slot, title, body, media_type, media_url, ordenacao)
VALUES
('noticias', 'hero', 'Central de Notícias', 'Fique por dentro de tudo o que acontece no sindicato e na PRF.', 'image', '/img/noticias_hero.jpg', 0);
