# Release Process - SINPRF/ES Mobile

Este documento descreve oficialmente a estratégia de versionamento e publicação do aplicativo SINPRF/ES.

## 1. Congelamento da Base v3

A partir da versão v3, a base nativa (APK) é considerada **congelada**.

- **versionCode**: 3
- **versionName**: 1.0.0
- **runtimeVersion**: 54.0.0

Qualquer alteração que envolva apenas código JavaScript ou ativos de UI deve ser distribuída via **OTA (Over-The-Air)**, mantendo a compatibilidade com esta base nativa.
Mudanças que exijam novas bibliotecas nativas, permissões ou atualizações de SDK exigirão a geração de um novo APK (v4+) e alteração do `runtimeVersion`.

## 2. OTA vs APK

### OTA (Over-The-Air)
- **Quando usar**: Correções de bugs, pequenas melhorias de UI, mudanças em regras de negócio no frontend.
- **Vantagem**: Atualização silenciosa e imediata para todos os usuários sem necessidade de download manual de APK.
- **Requisito**: `versionCode` e `runtimeVersion` devem ser idênticos aos da base instalada.

### APK
- **Quando usar**: Mudanças estruturais, novas dependências nativas, atualização do Expo SDK.
- **Processo**: Exige rebuild nativo e download/instalação manual pelo usuário via módulo de Publicações.

## 3. Estrutura de Versionamento

- **versionCode**: Inteiro incremental que identifica a build nativa.
- **runtimeVersion**: String que vincula a build nativa às atualizações OTA compatíveis.
- **Canal (Channel)**:
  - `preview`: Para testes internos e homologação.
  - `production`: Versão final para todos os usuários.

## 4. Estrutura no Google Drive (Publicações/App)

O aplicativo consome informações de atualização a partir da pasta `App` no módulo de Publicações do Google Drive.

- `update-manifest.json`: Arquivo mestre que define a versão atual, notas de lançamento e se a atualização é obrigatória.
- `sinprfes-app-latest.apk`: Link simbólico (ou cópia) do APK mais recente.
- `sinprfes-app-vcX-Y.apk`: Histórico de APKs (ex: vc3-1.0.0.apk).

### Formato do `update-manifest.json`
```json
{
  "versionCode": 3,
  "versionName": "1.0.0",
  "runtimeVersion": "54.0.0",
  "ota": {
    "enabled": true,
    "channel": "preview",
    "notes": "Notas da atualização OTA"
  },
  "apk": {
    "enabled": true,
    "fileName": "sinprfes-app-latest.apk",
    "minSupportedVersionCode": 3,
    "notes": "Notas da atualização do APK"
  }
}
```

## 5. Fluxo de Publicação

### Publicação OTA
1. Certifique-se de estar no branch correto.
2. Execute `eas update --branch [preview|production]`.
3. Atualize o `update-manifest.json` no Google Drive se houver novas notas ou mudança de status.

### Publicação APK
1. Incremente o `versionCode` no `app.json`.
2. Execute `eas build --platform android --profile [preview|production]`.
3. Faça upload do APK gerado para a pasta `App` no Google Drive.
4. Atualize o `update-manifest.json` com o novo `versionCode` e nome do arquivo.

## 6. Checklist de Publicação
- [ ] Verificou se as mudanças exigem dependências nativas? (Se sim, use APK)
- [ ] Testou a mudança localmente?
- [ ] O `runtimeVersion` no `app.json` está correto?
- [ ] O `update-manifest.json` reflete as mudanças e o nível de criticidade (obrigatório)?
