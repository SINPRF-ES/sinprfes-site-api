# Configuração do Playwright no Backend

Este documento descreve como o Playwright e o Chromium são configurados e instalados no serviço backend para garantir a funcionalidade da Consulta Processual em ambientes cloud (Railway).

## Fonte autoritativa de build

A partir desta configuração, o backend deve ser deployado via **Dockerfile dedicado em `/backend/Dockerfile`**.

- **Root Directory do serviço API no Railway:** `/backend`
- **Dockerfile:** `/backend/Dockerfile`
- **Package real do backend:** `/backend/package.json`
- **Start command real do backend:** `npm start` (equivalente a `node server.js`)

> Se o Root Directory ainda não estiver definido no Railway, configure para `/backend`.

## Estratégia determinística

Para evitar falhas por cache implícito e diferenças de ambiente:

1. O Dockerfile usa imagem Debian/Bookworm com Node 20.
2. Executa `npm ci` no diretório do backend.
3. Executa `npx playwright install --with-deps chromium` durante o build da imagem.
4. Mantém `PLAYWRIGHT_BROWSERS_PATH=/ms-playwright` para caminho fixo dos binários.

Com isso, o Chromium e as dependências Linux passam a fazer parte da imagem final do backend de forma determinística.

## Validação

### Local (Docker)

```bash
cd backend
docker build -t sinprfes-backend:playwright .
docker run --rm -e NODE_ENV=production sinprfes-backend:playwright npm run check:playwright
```

Saída esperada:

- `PLAYWRIGHT_PACKAGE_OK`
- `PLAYWRIGHT_BROWSER_PRESENT`
- `PLAYWRIGHT_LAUNCH_OK`

### Railway (pós-deploy)

1. Confirmar no serviço API: Root Directory = `/backend`.
2. Confirmar que o deploy detectou e usou `/backend/Dockerfile`.
3. No shell/runtime do serviço, executar:

```bash
npm run check:playwright
```

## Resolução de Problemas (Reason Codes)

O diagnóstico do browser service diferencia explicitamente:

- `PLAYWRIGHT_PACKAGE_MISSING`: pacote `playwright` não instalado.
- `PLAYWRIGHT_BROWSER_MISSING`: executável do Chromium ausente.
- `PLAYWRIGHT_SYSTEM_DEPS_MISSING`: bibliotecas Linux ausentes.
- `PLAYWRIGHT_LAUNCH_FAILED`: falha genérica de launch.
- `PLAYWRIGHT_LAUNCH_OK`: browser iniciado com sucesso.

Em modo debug (`CONSULTA_PROCESSUAL_DEBUG=true`), o serviço também registra o `executablePath` detectado.
