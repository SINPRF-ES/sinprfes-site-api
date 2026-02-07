# Release Process - FENAPRF Mobile

Este documento descreve oficialmente a estratégia de versionamento, política de `runtimeVersion` e o fluxo de publicação do aplicativo FENAPRF.

## 1. Política de runtimeVersion e Base Nativa

A `runtimeVersion` identifica a compatibilidade entre o código nativo (APK) e as atualizações JavaScript (OTA).

- **Regra de Ouro**: O OTA só é baixado e aplicado se a `runtimeVersion` do app instalado for **exatamente igual** à `runtimeVersion` definida no update.
- **Quando dar bump na `runtimeVersion`?**
  - Adição ou remoção de bibliotecas nativas (que exigem `npx expo prebuild`).
  - Alterações em `app.json` que afetam o build nativo (plugins, split ABI, R8/shrinkResources, assets de splash/ícone).
  - Atualização do Expo SDK.
- **Versão Atual da Base Otimizada**:
  - `versionCode`: 3 (ou superior)
  - `runtimeVersion`: `54.0.1`

## 2. OTA vs APK: Como decidir?

### OTA (Over-The-Air) - `eas update`
- **Use para**: Correções de bugs no JS/React Native, mudanças de estilo (CSS/Styles), novas telas que não usam libs nativas inéditas, ajustes em textos e lógica de negócio.
- **Vantagem**: Disponibilização imediata sem que o usuário precise baixar um novo arquivo.

### APK Base - `eas build`
- **Use para**: Mudanças que impactam o código nativo (mencionadas na seção 1).
- **Processo**: Requer gerar um novo binário, subir para o Google Drive e informar ao usuário que uma nova base é necessária.

## 3. Regras de Versionamento

- **`version` (app.json)**: Versão de "marketing" (ex: `1.0.0`). Meramente informativa para o usuário final.
- **`versionCode` (Android)**: Inteiro incremental obrigatório para o Android. Deve ser aumentado a cada novo APK gerado.
- **`runtimeVersion`**: Controla a compatibilidade do OTA. Deve permanecer o mesmo enquanto a base nativa for compatível.

## 4. Checklist: Antes de publicar uma nova Base (APK)

1. [ ] **Verificação de Saúde**: Execute `npx expo-doctor` e garanta que não há problemas de dependências.
2. [ ] **Bump de Versão**: Incremente o `versionCode` e, se houver mudanças nativas, a `runtimeVersion`.
3. [ ] **Build**: Gere o APK (ex: `eas build --platform android --profile preview`).
4. [ ] **Upload**: Suba o APK para a pasta `Publicações/App` no Google Drive.
5. [ ] **Manifesto**: Atualize o `update-manifest.json` no Drive com o novo `versionCode`, `runtimeVersion` e o nome do arquivo APK.
6. [ ] **OTA**: Não é necessário disparar `eas update` imediatamente para uma nova base (ela já nasce com o código JS embutido), mas updates futuros devem respeitar a nova `runtimeVersion`.

### Exemplo de `update-manifest.json` (Google Drive)
```json
{
  "versionCode": 3,
  "versionName": "1.0.0",
  "runtimeVersion": "54.0.1",
  "ota": {
    "enabled": true,
    "channel": "preview",
    "notes": "Notas da atualização JS"
  },
  "apk": {
    "enabled": true,
    "fileName": "fenaprf-app-vc3-1.0.0.apk",
    "minSupportedVersionCode": 3,
    "notes": "Nova base nativa obrigatória"
  }
}
```

## 5. Observabilidade e Logs Padronizados

O sistema de atualização utiliza tags específicas para facilitar o diagnóstico via `diagnosticoService.ts`.

### Tags de Decisão:
- `APK_REQUIRED`: Quando o app detecta que o usuário precisa baixar um novo APK (mudança de `runtimeVersion` ou `versionCode` antigo).
- `OTA_AVAILABLE`: Quando há uma atualização JS compatível disponível no canal.
- `NO_UPDATE`: Quando o app já está na versão mais recente.

### Campos Obrigatórios nos Logs:
Sempre logar o estado comparativo:
- `currentVersionCode` vs `manifest.versionCode`
- `currentRuntimeVersion` vs `manifest.runtimeVersion`
- `Updates.channel`

## 6. Fluxo de Verificação (Auto-check)

O app realiza uma verificação automática no momento do **Login** (primeiro acesso à sessão válida).
- O check ocorre em background.
- Se detectado update, exibe um modal (obrigatório/login) ou banner (opcional/background).
- **Nunca aplica sozinho**: O usuário deve sempre confirmar a aplicação da atualização ou o redirecionamento para o download do APK.

## 7. APK Split por ABI e Otimização de Tamanho

Para garantir que o aplicativo permaneça leve, utilizamos a técnica de **ABI Splitting**. Isso gera um APK específico para cada arquitetura de processador, em vez de um único APK universal gigante.

### Arquiteturas Suportadas:
- **arm64-v8a**: Dispositivos modernos de 64 bits.
- **armeabi-v7a**: Dispositivos legados de 32 bits.

### Otimizações Ativas:
- `minifyEnabled`: true (Remove código não utilizado)
- `shrinkResources`: true (Remove recursos não utilizados)

### Como gerar os APKs:
1. Execute o build local ou via EAS:
   ```bash
   # Exemplo via EAS
   eas build --platform android --profile production
   ```
2. O EAS costuma retornar um link para download de um artefato. Se o split estiver ativo, o artefato pode ser um `.tar.gz`.
3. Extraia o conteúdo e identifique os arquivos na pasta `release/`:
   - `app-arm64-v8a-release.apk`
   - `app-armeabi-v7a-release.apk`

### Convenção de Nomes:
Sempre renomear os arquivos antes de subir para o Drive para facilitar a identificação no `update-manifest.json`:
- `fenaprf-app-vcX-1.0.0-arm64.apk`
- `fenaprf-app-vcX-1.0.0-armeabi.apk`
*(Onde `vcX` é o `versionCode` atual)*

### Guardrail de Build:
Antes de qualquer release de base nativa, é **obrigatório** rodar o script de verificação:
```bash
npm run verify:android-split
```
Este script garante que as configurações de split e `universalApk false` permanecem no `build.gradle` após o prebuild.

## 8. Notas de Versão (API/Backend)

### Janeiro 2026
- **Push Notifications**: Adicionada validação estrita no backend para `title` e `body` (devem ser strings). Erros de payload agora retornam HTTP 400 em vez de 500. Instrumentação reforçada com `errorId` e logs detalhados para diagnóstico.
- **Diretório de Users**: O campo `lotacao` agora é retornado para o perfil `USER`, permitindo que todos os usuários visualizem a lotação dos colegas na listagem.
- **Push Notifications v2**: Adicionado suporte a filtros de público (ATIVOS, VETERANOS, LOTACAO, JOGOS, USER). Histórico agora exibe métricas de `noTokenOrDenied`. Implementada retenção automática de 60 dias para o histórico de campanhas.
