# Módulo Consulta Processual (Baseline Canônico Congelado)

## Objetivo
Este documento canoniza e congela o baseline estável atual do módulo **Consulta Processual**.
A referência oficial deve ser preservada para evitar regressões em Site, App e Backend.

## Baseline funcional oficial

### Modos canônicos do módulo
- `personal`
  - Usa o documento do usuário autenticado (CPF válido cadastrado).
  - Retorna processos do próprio usuário.
- `institutional`
  - Usa o CNPJ fixo do sindicato.
  - Documento institucional canônico: `39387378000125`.
  - Representa a consulta de **Processos do sindicato**.

### Regra de visibilidade consolidada
- **Baseline atual (congelado):** manter proteções de acesso já implementadas para consulta institucional.
- **Regra-alvo oficial de produção:** a consulta institucional por CNPJ do sindicato ficará visível para todos quando entrar em produção.
- A mudança de visibilidade deve ser centralizada e configurável (sem condicionais espalhadas).

### Providers no baseline
- Provider estável oficial: **TRF1**.
- Fora do baseline estável:
  - `TRF3`: experimental.
  - `TRF5`: experimental.
  - `TRF6`: disabled.

Regras:
- Evoluções futuras não podem alterar a semântica do TRF1 estável.
- Providers não estáveis não podem influenciar a UX principal do baseline.

## Contrato canônico da API
Endpoint: `GET /api/consulta-processual/me`.
Parâmetro: `mode` (opcional, default `personal`).

Payload oficial:

```json
{
  "ok": true,
  "queriedAt": "2026-03-08T00:00:00.000Z",
  "documentMasked": "***.123.***-45",
  "mode": "personal",
  "items": [],
  "sources": [],
  "totalItems": 0,
  "errors": []
}
```

Campos canônicos do payload:
- `ok`
- `queriedAt`
- `documentMasked`
- `mode`
- `items`
- `sources`
- `totalItems`
- `errors`

## Estrutura canônica de cada item (`items[]`)
- `source`
- `sourceLabel`
- `processNumber`
- `processClass`
- `processTitle`
- `subject`
- `parties`
- `lastMovement`
- `lastMovementAt`
- `rawLastMovementText`
- `listLastMovementText`
- `listLastMovementAt`
- `detailsUrl`
- `providerMeta`
- `institutional`

## Regras canônicas de exibição (Site/App)
Colunas/áreas oficiais:
- Origem
- Número do processo
- Classe
- Partes
- Última movimentação
- Ações

Regra oficial de UX:
- A coluna **Data/Hora** foi removida do baseline canônico.
- Motivo: a coluna **Última movimentação** já contém data e hora no texto exibido.
- Portanto, a coluna exclusiva de data/hora é redundante e não faz parte do baseline.

## Regra de backend (fonte única da verdade)
- Backend é a fonte única da verdade.
- Scraping, parsing e normalização residem no backend.
- Site e App apenas renderizam os dados recebidos.
- Frontends não devem reinterpretar lógica de provider.

## Congelamento técnico (retrocompatibilidade)
Este baseline congelado protege explicitamente:
- contrato do endpoint;
- campos do item;
- ordem e semântica dos modos (`personal` e `institutional`);
- comportamento do provider estável (`TRF1`).

Qualquer evolução futura deve preservar retrocompatibilidade.
