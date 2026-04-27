# Migrations SQL — organização e uso

Este diretório concentra as migrations SQL com padrão de data (`YYYYMMDD_*`) e deve ser a referência principal para novas alterações estruturais no banco.

## Estrutura atual

- `backend/scripts/migrations/` → migrations cronológicas e idempotentes (padrão atual).
- `backend/scripts/migration_*.sql` → migrations legadas versionadas por sufixo (`v*`), mantidas por compatibilidade operacional.

## Convenção para novas migrations

1. Criar arquivo em `backend/scripts/migrations/` com nome:
   - `YYYYMMDD_<contexto>.sql`
2. Sempre usar `IF NOT EXISTS` / `DROP ... IF EXISTS` quando aplicável.
3. Incluir saneamento de dados antes de constraints em mudanças de coluna.
4. Documentar impacto operacional em `docs/ops/RELATORIOS.md` (quando afetar relatórios/estatísticas) ou runbook específico.

## Ordem recomendada de execução

1. Executar primeiro as migrations legadas necessárias ao ambiente (quando o banco ainda não as possui).
2. Em seguida aplicar migrations com padrão de data em ordem lexicográfica.
3. Validar constraints e índices criados com query de conferência no `information_schema`.

## Migrations cadastrais sindicais (abril/2026)

As mudanças de classificação sindical para relatórios e estatísticas estão em:

- `20260424_filiados_situacao_sindical.sql`
- `20260424_filiados_uf_sindicato_externo.sql`

Essas migrations viabilizam o cadastro e análise de:
- `NAO_FILIADO`
- `FILIADO_OUTRO_SINDICATO` com `uf_sindicato_externo`

sem misturar essa dimensão com a `situacao` funcional (ATIVO/VETERANO/PENSIONISTA).
