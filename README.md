# SINPRF-ES - Site + API Base (Render)

Projeto base do site e API do SINPRF-ES, preparado para deploy na plataforma Render.

---

## 1. Estrutura do projeto

Arquivos principais:

- `index.js` — servidor Express (site + API básica)
- `package.json` — dependências e scripts (`start` e `dev`)
- `.env.example` — modelo de variáveis de ambiente
- `.gitignore` — arquivos que não vão para o Git
- `render.yaml` — configuração do serviço Web no Render
- `README.md` — este guia

---

## 2. Como usar localmente

1. Instale as dependências:

   ```bash
   npm install
   ```

2. Copie o arquivo `.env.example` para `.env` e ajuste os valores:

   ```bash
   cp .env.example .env
   ```

   - `PORT` — porta local (ex.: 3000)
   - `DATABASE_URL` — URL do PostgreSQL (se quiser testar `/db-test`)
   - `DB_SSL` — `true` se o provedor exigir SSL sem validar CA

3. Execute em modo desenvolvimento:

   ```bash
   npm run dev
   ```

4. Acesse no navegador:

   - `http://localhost:3000/`
   - `http://localhost:3000/health`
   - `http://localhost:3000/db-test` (se tiver `DATABASE_URL` configurada)

---

## 3. Scripts disponíveis

- `npm start` — executa `index.js` em modo "produção" (sem recarregar automaticamente)
- `npm run dev` — executa com `nodemon`, recarregando ao salvar arquivos

---

## 4. Variáveis de ambiente

- `PORT` — porta do servidor. No Render, é definida automaticamente.
- `DATABASE_URL` — string de conexão do PostgreSQL.
- `DB_SSL` — use `true` para serviços que exigem SSL sem validação de certificado.

Exemplo de `DATABASE_URL`:

```text
postgres://usuario:senha@host:5432/nome_do_banco
```

---

## 5. Rotas

- `GET /` — página inicial simples, apenas para confirmar que o servidor está rodando.
- `GET /health` — rota de healthcheck (usada pelo Render para verificar se o serviço está no ar).
- `GET /db-test` — testa conexão com o PostgreSQL (se `DATABASE_URL` estiver definida).

---

## 6. Deploy no Render (resumo)

1. Crie um repositório no GitHub e envie este projeto para lá.
2. No painel do Render:
   - Crie um novo **Web Service** a partir desse repositório.
   - Confirme:
     - `buildCommand = npm install`
     - `startCommand = npm start`
     - `healthCheckPath = /health`
3. Configure as variáveis de ambiente no Render (em **Environment**):
   - `NODE_ENV = production`
   - `DATABASE_URL` (quando o banco estiver pronto)
   - `DB_SSL = true` (se o banco exigir)
4. Após o deploy:
   - Acesse a URL gerada pelo Render.
   - Teste as rotas `/`, `/health` e `/db-test`.

---

## 7. Guia de recuperação rápida (caso a conversa com a IA se perca)

Se em algum momento você "perder" o histórico da conversa com a IA, basta informar que:

> "Já tenho um projeto chamado `sinprfes-site-api` com os arquivos: `index.js`, `package.json`, `.env.example`, `.gitignore`, `render.yaml` e `README.md`. O projeto foi preparado para deploy no Render, com rota `/health` e `/db-test`, e variáveis de ambiente `DATABASE_URL` e `DB_SSL`."

A partir disso, a IA pode continuar ajudando a:

- configurar o banco,
- montar as tabelas de filiados/usuários,
- criar rotas da área restrita,
- ajustar DNS no Cloudflare,
- e integrar com o domínio `sinprfes.org.br`.

---
