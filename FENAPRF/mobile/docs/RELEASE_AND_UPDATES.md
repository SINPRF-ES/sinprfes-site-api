# Release & Update Policy - FENAPRF Mobile

Este documento consolida a estratégia de versionamento, política de `runtimeVersion` e o fluxo operacional de publicações (OTA e APK).

## 1. Política de runtimeVersion e Base Nativa

A `runtimeVersion` identifica a compatibilidade entre o código nativo (APK) e as atualizações JavaScript (OTA).

- **Regra de Ouro**: O OTA só é baixado e aplicado se a `runtimeVersion` do app instalado for **exatamente igual** à `runtimeVersion` definida no update.
- **Quando dar bump na `runtimeVersion`?**
  - Adição ou remoção de bibliotecas nativas (que exigem `pnpm exec expo prebuild`).
  - Alterações em `app.json` que afetam o build nativo (plugins, split ABI, R8/shrinkResources, assets de splash/ícone).
  - Atualização do Expo SDK.
- **Versão Atual da Base Otimizada**:
  - `versionCode`: 3 (ou superior)
  - `runtimeVersion`: `54.0.1`

## 2. OTA vs APK: Como decidir?

### 🚀 Quando usar OTA (EAS Update)
**Ideal para:** Ajustes rápidos de interface, correção de bugs em lógica JS/TS, textos, estilos e novas telas que não dependem de novos módulos nativos.
- **Vantagem**: Disponibilização imediata sem que o usuário precise baixar um novo arquivo.

### 📦 Quando Rebuildar o APK (Novo Build)
**Obrigatório para:** Mudanças que afetam o código nativo (Java/Kotlin/Objective-C), alteração de permissões, novos plugins ou mudança de versão do Expo SDK.
- **Processo**: Requer gerar um novo binário, subir para o Google Drive e informar ao usuário que uma nova base é necessária.

### ⚖️ Checklist de Decisão

| Alteração | Tipo de Update | Requer novo APK? |
| :--- | :--- | :--- |
| Corrigir erro de digitação | OTA | Não |
| Alterar cor de botão | OTA | Não |
| Novo campo no formulário | OTA | Não |
| Adicionar Firebase/Push | APK | **Sim** |
| Mudar ícone do app | APK | **Sim** |
| Nova permissão (GPS) | APK | **Sim** |
| Atualizar Expo SDK | APK | **Sim** |

## 3. Regras de Versionamento

- **`version` (app.json)**: Versão de "marketing" (ex: `1.0.0`). Meramente informativa para o usuário final.
- **`versionCode` (Android)**: Inteiro incremental obrigatório para o Android. Deve ser aumentado a cada novo APK gerado.
- **`runtimeVersion`**: Controla a compatibilidade do OTA. Deve permanecer o mesmo enquanto a base nativa for compatível.

## 4. Fluxo Operacional de Publicação

### A) Passo a Passo para OTA:
1. **Desenvolvimento**: Realize as alterações no código.
2. **Publicação**: Execute `pnpm exec eas update --branch production --message "Descrição da mudança"`.
3. **Versão**: Mantenha o `versionCode` e `runtimeVersion` inalterados.
4. **Manifesto**: Atualize o bloco `ota` no `update-manifest.json` no Google Drive.

### B) Passo a Passo para Novo APK (Base):
1. **Configuração**: Incremente o `versionCode` no `app.json`.
2. **Runtime**: Se houver mudança nativa, atualize a `runtimeVersion`.
3. **Saúde**: Execute `pnpm exec expo-doctor` e `pnpm run verify:android-split`.
4. **Build**: Execute `pnpm exec eas build --platform android --profile production --local`.
5. **Distribuição**: Renomeie e suba os APKs para a pasta `Publicações/App` no Drive.
6. **Manifesto**: Atualize `versionCode`, `versionName`, `runtimeVersion` e `apk.files`.

## 5. APK Split por ABI e Otimização de Tamanho

O app utiliza ABI Split para reduzir o tamanho do download, gerando múltiplos APKs específicos por arquitetura.

### Arquiteturas Suportadas:
- **arm64-v8a**: Dispositivos modernos de 64 bits.
- **armeabi-v7a**: Dispositivos legados de 32 bits.

### Como preencher o manifesto para ABI Split:
No `update-manifest.json`, use o campo `files` dentro de `apk`:
```json
"apk": {
  "enabled": true,
  "minSupportedVersionCode": 7,
  "files": {
    "arm64-v8a": "fenaprf-app-vc7-arm64.apk",
    "armeabi-v7a": "fenaprf-app-vc7-v7a.apk"
  }
}
```

## 6. Observabilidade e Logs

O sistema de atualização utiliza tags específicas para facilitar o diagnóstico via `diagnosticoService.ts`:
- `APK_REQUIRED`: Usuário precisa baixar novo APK.
- `OTA_AVAILABLE`: Atualização JS compatível disponível.
- `NO_UPDATE`: App já está na versão mais recente.

## 7. Notas de Integração WebView
- O WebView utiliza `?embed=1` ou `app=1` para ocultar o header/footer do portal, garantindo navegação nativa.

## 8. Histórico de Mudanças Críticas (API/Backend)
- **Janeiro 2026**: Validação estrita de Push (FCM V1). Filtros de público e retenção de 60 dias para campanhas.
- **Janeiro 2026**: UF visível para todos os perfis no diretório.
