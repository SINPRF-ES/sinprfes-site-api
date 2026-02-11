BEGIN;

-- 1. Renomeia 'uf' (residência atual) para 'uf_endereco'
ALTER TABLE users RENAME COLUMN uf TO uf_endereco;

-- 2. Renomeia 'uf2' (vínculo principal atual) para 'uf'
ALTER TABLE users RENAME COLUMN uf2 TO uf;

-- 3. Cria nova coluna 'uf2' para o segundo vínculo
ALTER TABLE users ADD COLUMN uf2 VARCHAR(2);

COMMIT;
