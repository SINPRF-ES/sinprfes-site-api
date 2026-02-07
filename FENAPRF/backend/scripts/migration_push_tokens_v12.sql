-- scripts/migration_push_tokens_v12.sql

-- Cria a tabela de push_tokens se não existir
CREATE TABLE IF NOT EXISTS push_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    expo_push_token TEXT UNIQUE NOT NULL,
    device_id TEXT,
    platform TEXT,
    last_seen TIMESTAMP DEFAULT NOW(),
    revoked_at TIMESTAMP
);

-- Índice para performance em buscas por usuário
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON push_tokens(user_id);

-- Índice para performance em buscas por token (já implícito pelo UNIQUE, mas reforçado)
CREATE INDEX IF NOT EXISTS idx_push_tokens_token ON push_tokens(expo_push_token);
