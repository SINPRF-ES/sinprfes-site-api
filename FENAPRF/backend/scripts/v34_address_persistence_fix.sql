-- FENAPRF MIGRATION V34: ADDRESS PERSISTENCE AND UF REORGANIZATION
-- Objective: Ensure columns for address fields exist and follow the new UF canon.

BEGIN;

-- 1. UF Reorganization (Task C.1 & C.2)
-- uf_endereco: UF residencial (BuscaCEP)
-- uf: UF cargo principal
-- uf2: UF cargo secundário

DO $$
BEGIN
    -- Rename 'uf' to 'uf_endereco' if 'uf_endereco' does not exist yet.
    -- (Assumes 'uf' was previously used for residence or as a general field)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='uf')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='uf_endereco') THEN
        ALTER TABLE users RENAME COLUMN uf TO uf_endereco;
    END IF;

    -- Rename 'uf2' to 'uf' if 'uf2' exists and we just renamed 'uf' to 'uf_endereco' (or 'uf' is free)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='uf2')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='uf_endereco')
       AND (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='users' AND column_name='uf') = 0 THEN
        ALTER TABLE users RENAME COLUMN uf2 TO uf;
    END IF;

    -- Add 'uf2' if it does not exist (Task C.2)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='uf2') THEN
        ALTER TABLE users ADD COLUMN uf2 VARCHAR(2);
    END IF;

    -- 2. Ensure Address Fields Exist (Task C.3)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='logradouro') THEN
        ALTER TABLE users ADD COLUMN logradouro TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='bairro') THEN
        ALTER TABLE users ADD COLUMN bairro VARCHAR(100);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='numero') THEN
        ALTER TABLE users ADD COLUMN numero VARCHAR(20);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='complemento') THEN
        ALTER TABLE users ADD COLUMN complemento TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='cidade') THEN
        ALTER TABLE users ADD COLUMN cidade VARCHAR(100);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='cep') THEN
        ALTER TABLE users ADD COLUMN cep VARCHAR(8);
    END IF;

END $$;

COMMIT;
