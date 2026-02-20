-- Migration: Add depX_parentesco_outro columns to filiados table
-- Description: Implement support for custom kinship text when parentesco is 'OUTRO'

ALTER TABLE filiados
  ADD COLUMN IF NOT EXISTS dep1_parentesco_outro TEXT,
  ADD COLUMN IF NOT EXISTS dep2_parentesco_outro TEXT,
  ADD COLUMN IF NOT EXISTS dep3_parentesco_outro TEXT,
  ADD COLUMN IF NOT EXISTS dep4_parentesco_outro TEXT,
  ADD COLUMN IF NOT EXISTS dep5_parentesco_outro TEXT;

-- Optional: Add comments to columns for documentation
COMMENT ON COLUMN filiados.dep1_parentesco_outro IS 'Texto descritivo do parentesco para o dependente 1 quando o campo dep1_parentesco for OUTRO';
COMMENT ON COLUMN filiados.dep2_parentesco_outro IS 'Texto descritivo do parentesco para o dependente 2 quando o campo dep2_parentesco for OUTRO';
COMMENT ON COLUMN filiados.dep3_parentesco_outro IS 'Texto descritivo do parentesco para o dependente 3 quando o campo dep3_parentesco for OUTRO';
COMMENT ON COLUMN filiados.dep4_parentesco_outro IS 'Texto descritivo do parentesco para o dependente 4 quando o campo dep4_parentesco for OUTRO';
COMMENT ON COLUMN filiados.dep5_parentesco_outro IS 'Texto descritivo do parentesco para o dependente 5 quando o campo dep5_parentesco for OUTRO';
