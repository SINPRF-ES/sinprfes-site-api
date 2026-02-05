-- ============================================================================
-- SINPRF-ES MIGRATION V17: SANITIZATION AND CHECK CONSTRAINTS
-- Reinforces canonical domain concepts in the database.
-- ============================================================================

-- 1. Normalize existing data to UPPERCASE and canonical values
UPDATE filiados
SET
  situacao = CASE
    WHEN UPPER(situacao) IN ('ATIVO', 'ATIVOS') THEN 'ATIVO'
    WHEN UPPER(situacao) IN ('VETERANO', 'VETERANOS', 'APOSENTADO', 'APOSENTADOS') THEN 'VETERANO'
    WHEN UPPER(situacao) IN ('PENSIONISTA', 'PENSIONISTAS') THEN 'PENSIONISTA'
    ELSE 'ATIVO' -- Default safe value
  END,
  perfil_acesso = CASE
    WHEN UPPER(perfil_acesso) = 'ADMIN' THEN 'ADMIN'
    WHEN UPPER(perfil_acesso) = 'DIRETORIA' THEN 'DIRETORIA'
    WHEN UPPER(perfil_acesso) = 'FUNCIONARIO' THEN 'FUNCIONARIO'
    WHEN UPPER(perfil_acesso) = 'ORGANIZADOR' THEN 'ORGANIZADOR'
    WHEN UPPER(perfil_acesso) = 'COMUNICADOR' THEN 'COMUNICADOR'
    ELSE 'FILIADO'
  END,
  lotacao = CASE
    WHEN UPPER(lotacao) LIKE '%VIANA%' THEN 'DEL 01 - Viana'
    WHEN UPPER(lotacao) LIKE '%SERRA%' THEN 'DEL 02 - Serra'
    WHEN UPPER(lotacao) LIKE '%GUARAPARI%' THEN 'DEL 03 - Guarapari'
    WHEN UPPER(lotacao) LIKE '%LINHARES%' THEN 'DEL 04 - Linhares'
    WHEN UPPER(lotacao) LIKE '%SEDE%' THEN 'SEDE'
    ELSE 'SEDE' -- Fallback absoluto para garantir que o CHECK CONSTRAINT abaixo não falhe
  END;

-- 2. Add CHECK constraints to prevent future divergences
ALTER TABLE filiados DROP CONSTRAINT IF EXISTS chk_filiados_situacao;
ALTER TABLE filiados ADD CONSTRAINT chk_filiados_situacao
  CHECK (situacao IN ('ATIVO', 'VETERANO', 'PENSIONISTA'));

ALTER TABLE filiados DROP CONSTRAINT IF EXISTS chk_filiados_perfil;
ALTER TABLE filiados ADD CONSTRAINT chk_filiados_perfil
  CHECK (perfil_acesso IN ('ADMIN', 'DIRETORIA', 'FUNCIONARIO', 'FILIADO', 'ORGANIZADOR', 'COMUNICADOR'));

ALTER TABLE filiados DROP CONSTRAINT IF EXISTS chk_filiados_lotacao;
ALTER TABLE filiados ADD CONSTRAINT chk_filiados_lotacao
  CHECK (lotacao IN ('SEDE', 'DEL 01 - Viana', 'DEL 02 - Serra', 'DEL 03 - Guarapari', 'DEL 04 - Linhares'));

-- 3. Ensure CPF is numeric-only
UPDATE filiados SET cpf = regexp_replace(cpf, '\D', '', 'g') WHERE cpf ~ '\D';
