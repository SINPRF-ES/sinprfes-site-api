# Configuração do Playwright no Backend

Este documento descreve como o Playwright e o Chromium são configurados e instalados no serviço backend para garantir a funcionalidade da Consulta Processual em ambientes cloud (Railway).

## Estratégia de Instalação Local

Para evitar problemas com caches globais ou permissões em ambientes de CI/CD e Cloud, adotamos a instalação local dos binários do browser dentro da estrutura do projeto.

- **Variável de Ambiente:** `PLAYWRIGHT_BROWSERS_PATH=0`
- **Localização dos Binários:** `backend/node_modules/playwright-core/.local-browsers`

Ao definir `PLAYWRIGHT_BROWSERS_PATH=0`, o Playwright instala o Chromium dentro da pasta `node_modules` do projeto, garantindo que o executável seja incluído no build final do aplicativo e esteja acessível em runtime.

## Configuração no Railway (nixpacks.toml)

O arquivo `nixpacks.toml` na raiz do monorepo orquestra o build. O backend é buildado com a variável de ambiente necessária:

```toml
[phases.build]
dependsOn = ["install"]
cmds = [
  "pnpm --filter ${FILTER:-*} build",
  "if [ -z \"$FILTER\" ] || [ \"$FILTER\" = \"*\" ] || [ \"$FILTER\" = \"@sinprfes/backend\" ]; then PLAYWRIGHT_BROWSERS_PATH=0 pnpm --filter @sinprfes/backend run build:railway; fi"
]
```

O comando `build:railway` no `backend/package.json` executa o script `scripts/prepare-playwright.js`, que realiza a instalação.

## Scripts de Gerenciamento

Os seguintes scripts estão disponíveis no `backend/package.json`:

- `pnpm run playwright:install`: Instala o Chromium localmente.
- `pnpm run check:playwright`: Executa o diagnóstico completo do estado do Playwright e do browser.

## Validação

### Localmente
Para validar a instalação local na sua máquina:
1. Navegue até a pasta `backend/`.
2. Execute `PLAYWRIGHT_BROWSERS_PATH=0 npm run playwright:install`.
3. Verifique se a pasta `node_modules/playwright-core/.local-browsers` foi criada.
4. Execute `npm run check:playwright` e verifique se o output indica `PLAYWRIGHT_LAUNCH_OK`.

### No Railway
Após o deploy, você pode validar o estado através dos logs de build (procurando por "Installing Playwright Chromium (locally in node_modules)") ou executando o script de diagnóstico via console SSH/Railway Run:
```bash
PLAYWRIGHT_BROWSERS_PATH=0 node scripts/check-playwright-browser.js
```

## Resolução de Problemas (Reason Codes)

O sistema de diagnóstico utiliza os seguintes códigos para identificar falhas:
- `PLAYWRIGHT_PACKAGE_MISSING`: O pacote `playwright` não foi encontrado.
- `PLAYWRIGHT_BROWSER_MISSING`: O executável do Chromium não foi encontrado no caminho esperado.
- `PLAYWRIGHT_SYSTEM_DEPS_MISSING`: O browser foi encontrado, mas faltam bibliotecas de sistema (Linux) para executá-lo.
- `PLAYWRIGHT_LAUNCH_FAILED`: Erro genérico ao tentar iniciar o browser.
- `PLAYWRIGHT_LAUNCH_OK`: Tudo operando corretamente.
