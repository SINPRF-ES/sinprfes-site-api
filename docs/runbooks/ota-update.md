# Runbook: Atualização Over-the-Air (OTA) — SINPRF/ES

Este é o runbook oficial e canônico para realizar atualizações Over-the-Air (OTA) no aplicativo mobile utilizando Expo e EAS.

## Pré-requisitos

1.  Acesso ao repositório `sinprfes-site-api`.
2.  `pnpm` instalado globalmente.
3.  EAS CLI instalado (`npm install -g eas-cli`).
4.  Login realizado no EAS (`eas login`).

## Fluxo de Atualização (Passo-a-passo)

```bash
# 0) Entrar no repo
cd ~/work/sinprfes/sinprfes-site-api/

# 1) Sincronizar com main (ambiente limpo)
git fetch origin
git reset --hard origin/main
git clean -fdx

# 2) Instalar dependências do monorepo (lockfile único na raiz)
pnpm install

# 3) Validar saúde do mobile (diagnóstico)
cd mobile
npx expo-doctor

# 4) (Somente se necessário) instalar dependências do Expo corretamente
# OBS: preferir "npx expo install" para dependências nativas compatíveis com o SDK.
# Exemplos (usar conforme necessidade real do PR):
# pnpm add expo-router
# pnpm add react-native-screens react-native-safe-area-context
# npx expo install expo-system-ui
# npx expo install expo-asset
# npx expo install --check
# npx expo-doctor

# 5) Publicar OTA (preview)
eas update --branch preview --platform android --message " | atualização feita HH:MM:SS horas do dia DD/MM/AAAA"
```

## Regras de Ouro

*   **Sempre** use `npx expo install` para bibliotecas que possuem código nativo (garante compatibilidade com o SDK do Expo).
*   Use `pnpm add` apenas para bibliotecas puramente JavaScript.
*   Mantenha o `metro.config.js` alinhado com `@expo/metro-config`; evite customizações desnecessárias.
*   Documente sempre a mensagem da atualização com data e hora para facilitar o rastreio no dashboard do EAS.

## Troubleshooting

### `expo-doctor` reportando avisos
Se o `npx expo-doctor` encontrar problemas de versão, tente rodar `npx expo install --check` para sincronizar as dependências com o SDK atual.

### Erro de Metro Config
Se houver erro no carregamento do bundle, verifique se o `metro.config.js` está exportando a configuração correta para monorepo.

### Canais e Branches
*   `preview`: Usado para testes internos e homologação.
*   `production`: Usado para a versão final que os filiados recebem.
