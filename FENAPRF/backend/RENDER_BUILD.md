# Configuração de Deploy no Render (FENAPRF Backend)

Para garantir que o backend da FENAPRF funcione corretamente no Render, siga estas configurações:

## Configurações Principais (Settings)

* **Root Directory:** `FENAPRF/backend`
* **Runtime:** `Node`
* **Node Version:** `20.11.1` (definida no `.node-version`)
* **Build Command:** `npm ci && npm run verify:deps`
* **Start Command:** `node server.js`

## Por que usar `npm ci`?
O comando `npm ci` garante uma instalação limpa e determinística baseada estritamente no `package-lock.json`. Isso evita discrepâncias entre o ambiente de desenvolvimento e produção.

## Verificação de Dependências
O passo `npm run verify:deps` no build command garante que o pacote `resend` (e outros críticos) foi instalado corretamente antes de finalizar o build. Se falhar, o deploy é abortado, evitando "runtime errors" silenciosos.

## Variáveis de Ambiente (Environment Variables)

As seguintes variáveis são obrigatórias para o funcionamento do sistema de e-mail e outras integrações:

| Variável | Descrição |
| :--- | :--- |
| `RESEND_API_KEY` | Chave de API do Resend (re-send.com) |
| `MAIL_FROM` | E-mail remetente autorizado (ex: `contato@fenaprf.org.br`) |
| `NODE_ENV` | Deve ser `production` |
| `DATABASE_URL` | URL de conexão com o Postgres |
| `JWT_SECRET` | Segredo para tokens JWT |
| `CLOUDINARY_URL` | (Opcional) Para armazenamento de imagens/PDFs |

## Troubleshooting

### Erro "Cannot find package 'resend'"
1. Certifique-se de que `resend` está na seção `dependencies` (não `devDependencies`) do `package.json`.
2. Certifique-se de usar `Clear build cache & deploy` no Render para forçar uma instalação limpa.

### Logs de Erro Detalhados
O serviço de e-mail foi atualizado para logar `code`, `message` e `stack` em caso de falha na inicialização do Resend. Verifique os logs do Render para o prefixo `[EMAIL] Resend init failed detail:`.
