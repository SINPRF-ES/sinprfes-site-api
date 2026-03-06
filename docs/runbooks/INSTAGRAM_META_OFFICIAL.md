# Runbook — Instagram API Oficial (Meta)

## Decisão arquitetural

A integração de feed do Instagram é **exclusivamente oficial**.

Fluxo canônico:

`site -> /api/public/instagram-feed -> backend (@sinprfes/backend) -> Instagram API oficial`

### O que foi removido

- RSSHub, mirrors e failover de mirrors.
- scraping/login privado/cookie de Instagram.
- variáveis e lógica legado de RSS.

## Variáveis de ambiente

Configurar no backend (`@sinprfes/backend`):

- `INSTAGRAM_APP_ID`
- `INSTAGRAM_APP_SECRET`
- `INSTAGRAM_REDIRECT_URI`
- `INSTAGRAM_SCOPES` (sugestão: `user_profile,user_media`)
- `INSTAGRAM_API_BASE_URL` (sugestão: `https://graph.instagram.com`)
- `INSTAGRAM_GRAPH_VERSION` (opcional)
- `INSTAGRAM_ACCESS_TOKEN` (opcional para bootstrap manual)
- `INSTAGRAM_REFRESH_ENABLED` (`true`/`false`)
- `INSTAGRAM_ACCOUNT_ID` (opcional)

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
  - Diagnóstico da integração (sem expor token).
  - Requer autenticação e perfil de gestão.

### Público

- `GET /api/public/instagram-feed`
  - Payload estável para a home.
  - Limite de 5 posts.
  - Retorna fallback seguro quando integração não está configurada/ativa.

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
  "posts": []
}
```

## Logs principais

- `InstagramOfficialAuthStarted`
- `InstagramOfficialAuthCallbackReceived`
- `InstagramOfficialTokenExchangeFailed`
- `InstagramOfficialConfigured`
- `InstagramOfficialFeedFetchFailed`
- `InstagramOfficialFeedServed`

## Pendências para produção

1. Criar app no Meta Developers (Instagram API with Instagram Login).
2. Configurar `redirect_uri` autorizado exatamente igual ao backend.
3. Definir escopos aprovados no app.
4. Obter token oficial (OAuth) via rota administrativa.
5. Persistir token em storage seguro corporativo (atualmente o callback mantém token em memória da instância).
