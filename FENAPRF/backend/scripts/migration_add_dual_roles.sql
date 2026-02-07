-- Migration: Add dual role support and archiving tracking to FENAPRF users
-- Date: 2026-02-05

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS perfil_acesso2 VARCHAR(50),
ADD COLUMN IF NOT EXISTS cargo2 VARCHAR(100),
ADD COLUMN IF NOT EXISTS uf2 VARCHAR(2),
ADD COLUMN IF NOT EXISTS arquivado_em TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN public.users.perfil_acesso2 IS 'Segundo vínculo de perfil de acesso';
COMMENT ON COLUMN public.users.cargo2 IS 'Segundo vínculo de cargo';
COMMENT ON COLUMN public.users.uf2 IS 'Segundo vínculo de UF';
COMMENT ON COLUMN public.users.arquivado_em IS 'Data/hora de arquivamento do registro';
