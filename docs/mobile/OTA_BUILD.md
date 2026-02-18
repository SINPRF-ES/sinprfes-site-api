# Fluxo de Build Local e OTA (Mobile)

Este documento descreve o procedimento canônico para gerar builds locais do aplicativo SINPRF/ES e como as variáveis de ambiente são tratadas, especialmente em builds com a flag `--local`.

## Build Local do APK

Para gerar um APK localmente (sem depender do dashboard do EAS para segredos/env):

1. **Acesse a pasta mobile:**
   ```bash
   cd mobile
   ```

2. **Instale as dependências (se necessário):**
   ```bash
   pnpm install
   ```

3. **Verifique a saúde do projeto:**
   ```bash
   npx expo-doctor
   ```

4. **Execute o comando de build:**
   ```bash
   npx eas build -p android --profile preview --local
   ```

## Variáveis de Ambiente e API URL

Em builds locais (`--local`), o EAS **NÃO** aplica as variáveis de ambiente configuradas no dashboard web. Por esse motivo, o aplicativo utiliza uma estratégia de resolução em cascata para garantir que a URL da API nunca fique vazia.

### Ordem de Prioridade (Resolução em `mobile/src/config/env.ts`):

1. **`app.json` (extra.API_BASE_URL)**: Fonte primária e canônica para builds de produção/staging.
2. **`.env` (via @env)**: Variáveis definidas em arquivos `.env` locais.
3. **`process.env.EXPO_PUBLIC_API_URL`**: Variáveis passadas via CLI ou ambiente.
4. **Fallback Hardcoded**: `https://api.sinprfes.org.br` (garante que o app sempre tenha uma URL válida).

### Regras de Produção (!__DEV__):
- **HTTPS Obrigatório**: Qualquer URL `http://` será normalizada para `https://`.
- **Proibição de Localhost**: Se o app detectar `localhost`, `127.0.0.1` ou `10.0.2.2` em ambiente de produção, ele ignorará o valor e usará o fallback canônico (`https://api.sinprfes.org.br`).

## Troubleshooting (Network Error)

Se o aplicativo apresentar "Network Error" no login:
1. Verifique o rodapé de debug na tela de login para confirmar a `URL Efetiva` e a `Config`.
2. Se a URL estiver incorreta ou vazia (o que não deve ocorrer com o novo fluxo de fallback), verifique o valor de `API_BASE_URL` no arquivo `mobile/app.json`.
3. Certifique-se de que o certificado SSL do backend está válido, pois o app força HTTPS em builds que não são de desenvolvimento.
