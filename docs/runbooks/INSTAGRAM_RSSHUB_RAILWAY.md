# Runbook — Instagram Feed via RSSHub (Railway)

Este runbook explica como operar o feed de Instagram quando há bloqueio anti-bot (`403/429`) nas fontes públicas.

## 1) Arquitetura recomendada

1. Rodar um serviço RSSHub próprio no Railway.
2. Configurar a API (`@sinprfes/backend`) para usar esse RSSHub como primeira origem.
3. Manter mirrors públicos apenas como fallback.

Fluxo:

`site -> /api/public/instagram-feed -> backend cache -> RSSHub próprio (prioritário)`

## 2) Variáveis no serviço BACKEND (Railway)

No serviço da API, configure:

- `INSTAGRAM_RSSHUB_BASE_URLS`
  - CSV de bases RSSHub, em ordem de prioridade.
  - Exemplo:
  - `https://rsshub.sinprfes.org.br,https://rsshub.app,https://rsshub.rssforever.com`

- `INSTAGRAM_RSSHUB_ROUTE_TEMPLATE`
  - Template da rota no RSSHub.
  - Padrão no código: `/instagram/user/:username`
  - Para forçar versão 2 do RSSHub:
  - `/instagram/2/user/:username`

- `INSTAGRAM_RATE_LIMIT_BACKOFF_MS`
  - Backoff aplicado quando houver `429` em alguma origem.
  - Padrão: `900000` (15 min).

## 3) Como preencher no Railway (Backend)

1. Abra o projeto no Railway.
2. Entre no serviço da API.
3. Vá em **Variables**.
4. Adicione/atualize:

```env
INSTAGRAM_RSSHUB_BASE_URLS=https://rsshub.sinprfes.org.br,https://rsshub.app,https://rsshub.rssforever.com
INSTAGRAM_RSSHUB_ROUTE_TEMPLATE=/instagram/user/:username
INSTAGRAM_RATE_LIMIT_BACKOFF_MS=900000
```

5. Salve e aguarde o redeploy automático.

## 4) DNS (se usar domínio próprio para RSSHub)

### No Railway (serviço RSSHub)

1. `Settings -> Domains -> Add Domain`.
2. Defina `rsshub.sinprfes.org.br`.
3. Copie o destino sugerido pelo Railway.

### No provedor DNS

- Criar `CNAME`:
  - Nome: `rsshub`
  - Valor: host fornecido pela Railway
  - TTL: automático/300s

Aguardar propagação e validar HTTPS ativo.

## 5) Verificações pós-deploy

- Endpoint da API:
  - `GET /api/public/instagram-feed`
  - Esperado: `200` com `{ ok, total, posts }`.

- Logs esperados:
  - `InstagramRssRecoveredWithFallback`: recuperou em outra origem.
  - `InstagramRssLikelyBotBlocked`: padrão forte de bloqueio (`403/429`).
  - `InstagramRssUnavailable`: indisponibilidade não classificada.

## 6) Estratégia para erro 429 persistente

Se o RSSHub próprio ainda retornar 429 do Instagram:

1. Aumentar `INSTAGRAM_RATE_LIMIT_BACKOFF_MS` (ex.: `1800000` = 30 min).
2. Reduzir volume de chamadas concorrentes no backend.
3. Testar `INSTAGRAM_RSSHUB_ROUTE_TEMPLATE=/instagram/user/:username` e `/instagram/2/user/:username`.
4. Manter fallback para mirrors públicos no final da lista.

## 7) Observações

- O backend já possui cache de 15 minutos.
- Em indisponibilidade total, o endpoint não quebra a home: retorna cache ou lista vazia.
