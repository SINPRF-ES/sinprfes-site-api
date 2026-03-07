# Runbook — Instagram API Oficial (Meta)

## Status canônico

A integração de feed do Instagram está **operacional em produção** e a estratégia canônica é:

`site -> /api/public/instagram-feed -> backend (@sinprfes/backend) -> Instagram API oficial`

Não há suporte funcional para:

- RSSHub, mirrors e failover de mirrors.
- scraping/login privado/cookie de Instagram.
- parser RSS, IG_COOKIE, IG_USERNAME, IG_PASSWORD.

---

## Arquitetura atual consolidada

- O **backend é a única fonte de dados** do feed para o frontend.
- A home consome **exclusivamente** `GET /api/public/instagram-feed`.
- A rota pública retorna payload normalizado, com fallback seguro.
- A regra oficial é: **máximo de 5 posts** por resposta.

### Cache e fallback

- Há cache em memória no backend por 15 minutos para estabilidade/latência.
- Em falha temporária da API da Meta:
  - usa cache anterior quando disponível (`source: meta_official_cache`),
  - senão retorna fallback institucional (`source: fallback`, `posts: []`).

---

## Rotas da integração

### Administração

- `GET /api/admin/integrations/instagram/auth-url`
  - Gera URL oficial de autorização OAuth.
  - Requer autenticação e perfil de gestão.

- `GET /api/admin/integrations/instagram/callback`
  - Recebe `code` e `state` do OAuth.
  - Troca token curto por longa duração.
  - Requer autenticação e perfil de gestão.

- `GET /api/admin/integrations/instagram/status`
  - Diagnóstico da integração (sem expor token completo).
  - Requer autenticação e perfil de gestão.

### Público

- `GET /api/public/instagram-feed`
  - Payload estável para a home.
  - Limite canônico de 5 posts.
  - Nunca depende de filtro/slice apenas no frontend.

---

## Auditoria de env vars do Instagram (Railway)

Escopo auditado (definidas em produção):

- `INSTAGRAM_APP_ID`
- `INSTAGRAM_APP_SECRET`
- `INSTAGRAM_REDIRECT_URI`
- `INSTAGRAM_SCOPES`
- `INSTAGRAM_API_BASE_URL`
- `INSTAGRAM_GRAPH_VERSION`
- `INSTAGRAM_REFRESH_ENABLED`
- `INSTAGRAM_ACCESS_TOKEN`
- `INSTAGRAM_ACCOUNT_ID`

> Observação: outras envs globais do serviço (DB, auth, mail, storage etc.) são de outros módulos e **não devem ser removidas** por não pertencerem ao Instagram.

### Classificação no estado atual

#### Obrigatórias no funcionamento atual do feed oficial

- `INSTAGRAM_APP_ID`
- `INSTAGRAM_APP_SECRET`
- `INSTAGRAM_REDIRECT_URI`
- `INSTAGRAM_ACCESS_TOKEN` **ou** token em memória obtido por callback OAuth

Sem as três primeiras, a integração não é considerada configurada (`configured: false`).

#### Opcionais, porém úteis

- `INSTAGRAM_SCOPES` (default interno: `user_profile,user_media`)
- `INSTAGRAM_API_BASE_URL` (default interno: `https://graph.instagram.com`)
- `INSTAGRAM_GRAPH_VERSION` (sem valor = endpoint sem versão explícita)
- `INSTAGRAM_REFRESH_ENABLED` (feature flag do refresh automático)
- `INSTAGRAM_ACCOUNT_ID` (diagnóstico/status)

#### Preparadas para fluxo de evolução

- `INSTAGRAM_ACCOUNT_ID`: hoje não é necessária para buscar feed via `/me/media`; permanece útil para observabilidade e futura evolução.

#### Definidas no Railway e lidas, mas sem impacto crítico direto no feed em runtime

- `INSTAGRAM_REFRESH_ENABLED`: só impacta a rotina agendada de renovação, não a leitura imediata do feed.

#### Definidas no Railway mas não utilizadas pelo código atual da integração

- **Nenhuma** das envs Instagram listadas acima está totalmente sem leitura.

---

## Bootstrap de token e persistência

### Estado atual

- O token pode entrar por `INSTAGRAM_ACCESS_TOKEN` (bootstrap manual/env).
- Após callback OAuth administrativo, o backend guarda token em memória da instância (`runtimeAuth`).

### Refresh automático implementado

- Scheduler no backend com `node-cron`.
- Execução diária (`0 6 * * *`, `America/Sao_Paulo`) e tentativa no boot.
- Só roda quando:
  - integração configurada,
  - há token ativo,
  - `INSTAGRAM_REFRESH_ENABLED=true`.

### Limitação estrutural atual

- O token renovado fica em memória (`runtimeAuth`) e **não é persistido automaticamente em storage corporativo definitivo**.
- Em reboot/redeploy, o sistema volta ao token de `INSTAGRAM_ACCESS_TOKEN` (se definido).
- Portanto, a persistência canônica definitiva ainda depende de camada de storage segura.

---

## Logs principais

- `InstagramOfficialAuthStarted`
- `InstagramOfficialAuthCallbackReceived`
- `InstagramOfficialTokenExchangeFailed`
- `InstagramOfficialConfigured`
- `InstagramOfficialFeedFetchFailed`
- `InstagramOfficialFeedServed`
- `InstagramOfficialTokenRefreshStarted`
- `InstagramOfficialTokenRefreshSucceeded`
- `InstagramOfficialTokenRefreshFailed`

---

## Respostas esperadas

### Fallback institucional

```json
{
  "ok": true,
  "configured": false,
  "source": "fallback",
  "posts": [],
  "profileUrl": "https://instagram.com/sinprfes"
}
```

### Feed oficial ativo

```json
{
  "ok": true,
  "configured": true,
  "source": "meta_official",
  "posts": [
    {
      "id": "...",
      "title": "...",
      "link": "...",
      "image": "...",
      "date": "..."
    }
  ],
  "profileUrl": "https://instagram.com/sinprfes"
}
```

---

## Home (frontend)

- Renderiza blocos com imagem e legenda (com truncamento visual).
- Trata ausência de legenda com texto padrão.
- Mantém fallback visual sem quebrar layout.
- Botão principal continua apontando para `https://instagram.com/sinprfes`.

