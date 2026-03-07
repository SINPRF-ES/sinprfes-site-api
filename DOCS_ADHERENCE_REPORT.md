# Relatório de Aderência de Package Manager e Documentação

Data da varredura: 2026-03-07

## 1) Package manager canônico do monorepo

O monorepo está **padronizado em pnpm** na raiz:

- `packageManager: pnpm@9.15.9` no `package.json` raiz.
- `pnpm-workspace.yaml` define workspaces (`backend`, `mobile`, `site`, `assembleia-app`, `shared/**`).
- O script de preinstall (`scripts/check-lockfiles.js`) bloqueia `package-lock.json` em qualquer subpasta e também bloqueia `pnpm-lock.yaml` fora da raiz.
- Existe somente um lockfile rastreado no git: `pnpm-lock.yaml` na raiz.

## 2) Onde ainda aparece `npm` (e por quê)

Apesar do padrão geral ser `pnpm`, há uso **intencional de npm** no contexto de runtime/deploy do backend:

- `backend/Dockerfile` usa `npm install --package-lock-only`, `npm ci --omit=dev` e `CMD ["npm", "start"]` para imagem isolada de produção.
- `README.md` e `docs/ops/railway.md` refletem esse start de runtime com `npm start` para o serviço da API em produção.
- `backend/docs/playwright-setup.md` também referencia fluxo Docker com `npm ci` / `npm run check:playwright`.

Conclusão: **não há evidência de migração de volta para npm no monorepo**; o que existe é um **uso híbrido documentado**: pnpm para workspace/monorepo e npm no container do backend.

## 3) Aderência da documentação (.md) entre si

### 3.1 Compatibilidade geral

- Os documentos estão **majoritariamente compatíveis** com o estado técnico atual (pnpm no monorepo + npm no Docker do backend).

### 3.2 Pontos de atenção

- Há mistura de instruções `pnpm` e `npm` em arquivos Markdown sem sempre explicitar contexto (desenvolvimento monorepo vs runtime Docker), o que pode confundir novos contribuidores.
- `docs/architecture/consulta-processual.md` explicita corretamente o uso de `pnpm` no workspace e também a instalação de `pnpm` em ambiente de build remoto.

### 3.3 Veredito de aderência

- **Aderência técnica:** boa.
- **Aderência de clareza documental:** parcial (recomendado padronizar uma seção fixa “Quando usar pnpm vs npm” nos docs principais).

## 4) Recomendações objetivas

1. No `README.md`, adicionar um bloco curto:
   - "Monorepo/dev: use pnpm"
   - "Container backend/prod: npm dentro do Dockerfile"
2. Em `docs/ops/railway.md`, manter a regra atual e reforçar em uma nota de destaque a diferença entre build do monorepo e runtime da imagem.
3. Em `backend/docs/playwright-setup.md`, incluir uma linha de contexto: "neste documento os comandos npm são executados dentro do contexto do backend/container".

