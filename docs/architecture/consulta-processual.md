# Consulta Processual — Baseline oficial (TRF1-only)

## Estado atual do módulo

Após hotfix de reset arquitetural, o módulo opera **exclusivamente** com a fonte **TRF1**.

- Provider ativo: `trf1`.
- Fluxo interno: single-source (sem agregador multi-provider).
- Contrato de item preservado para compatibilidade, com `source = "trf1"` e `sourceLabel = "TRF1"`.

## Escopo removido

Foram removidos do código ativo:

- providers TRF3, TRF5 e TRF6;
- registries e flags para múltiplos TRFs;
- lógica de skip/skipped de fontes adicionais;
- heurísticas e diagnóstico multi-tribunal.

## Pipeline TRF1

1. Abre `listView.seam` do TRF1.
2. Localiza campo de documento.
3. Preenche CPF numérico.
4. Dispara pesquisa.
5. Aguarda atualização real do DOM do painel de resultados.
6. Extrai blocos do grid.
7. Normaliza campos do payload.

## Campos mínimos por item

- `source`
- `sourceLabel`
- `processNumber`
- `processClass`
- `processTitle`
- `parties`
- `lastMovement`
- `lastMovementAt`
- `rawLastMovementText`
- `listLastMovementText`
- `listLastMovementAt`
- `detailsUrl`

## Diretriz de evolução

Qualquer expansão para outros tribunais deve ocorrer em branch separada, sem alterar o baseline TRF1-only em produção.

## Nota de segurança (Mai/2026)

Os endpoints de consulta processual (`/api/consulta-processual/me` e `/api/consulta-processual/debug/me`) estão sob hardening com `resourceIntensiveLimiter` (`5 req/15 min`), aplicado antecipadamente para mitigar abuso de scraping e custo excessivo de infraestrutura. A política consolidada (incluindo `trust proxy` e diretriz para novas rotas pesadas) está no `README.md`, seção **"Hardening de endpoints pesados — Mai/2026"**.
