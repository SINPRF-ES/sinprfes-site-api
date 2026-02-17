# Auditoria de Tamanho do Aplicativo (Android)

## Estado Inicial (Antes das Mudanças)
- **Tamanho do APK:** ~110MB (Universal APK)
- **Data da Auditoria:** 2024-05-22 (Data simulada)

### Problemas Identificados:
1. **Falta de Split por ABI:** O APK atual é "Universal", contendo binários para todas as arquiteturas (arm64-v8a, armeabi-v7a, x86, x86_64) em um único arquivo.
2. **Minificação Desativada:** As configurações padrão do `build.gradle` gerado pelo prebuild desativam `minifyEnabled` e `shrinkResources`.
3. **Ativos em PNG:** Imagens de sistema (`icon`, `splash`, `adaptive-icon`) estão em formato PNG sem otimização agressiva.
4. **Dependências Desnecessárias:** Presença de pacotes de backend (`expo-server-sdk`) no `package.json` do mobile.

### Top 20 Maiores Dependências (node_modules):
(Baseado no tamanho em disco das pastas no node_modules)
- react-native: 72.01 MB
- expo-sqlite: 71.18 MB
- typescript: 22.53 MB
- @expo: 5.73 MB
- react-native-reanimated: 3.45 MB
- react-native-gesture-handler: 3.11 MB
- expo-updates: 2.36 MB
- react-native-screens: 2.25 MB
- axios: 2.23 MB
- expo-notifications: 1.49 MB
- socket.io-client: 1.35 MB
- expo: 0.84 MB
- expo-file-system: 0.80 MB
- react-native-blob-util: 0.76 MB
- @tanstack: 0.70 MB
- react-native-worklets: 0.65 MB
- react-native-webview: 0.63 MB
- @react-navigation: 0.59 MB
- @react-native-community: 0.52 MB

### Ativos (Assets):
- Total em `mobile/assets/`: ~2.0 MB

---

## Resultados da Otimização

### 1. Configurações de Build (Produção)
- **Split por ABI:** Implementado via plugin customizado `withAndroidSplit.js`. O APK agora é gerado separadamente para `arm64-v8a` e `armeabi-v7a`.
- **Minificação (R8):** Habilitada via `expo-build-properties` (`enableMinifyInReleaseBuilds`).
- **Resource Shrinking:** Habilitado via `expo-build-properties` (`enableShrinkResourcesInReleaseBuilds`).

### 2. Otimização de Assets
- **WebP:** Ativos internos convertidos para WebP, reduzindo o peso de ~1.9MB para ~135KB.
- **PNG Otimizado:** Imagens de sistema (icon, splash) re-geradas com compressão máxima para compatibilidade com o prebuild do Expo, reduzindo de ~1.9MB para ~450KB.

### 3. Limpeza de Dependências
- **Removidas:**
  - `expo-server-sdk`: Removida (biblioteca de backend).
  - `expo-crypto`: Removida (sem referências no código ou plugins).
  - `expo-status-bar`: Removida (sem referências no código).
- **Mantidas por Segurança:**
  - `react-native-worklets`: Mantida (necessária para o `react-native-reanimated@4`).
  - `react-native-blob-util`: Mantida (dependência do `react-native-pdf`).
  - `react-native-dotenv`: Mantida (configurada no `babel.config.js`).

### Impacto Estimado
- **Tamanho Antes:** ~110MB (Universal APK)
- **Tamanho Depois (Estimado):** ~30MB - 35MB por APK de arquitetura específica.
- **Redução:** ~70% de economia de espaço para o usuário final.

---

## Validação Realizada
- [x] `npx expo prebuild`: Sucesso.
- [x] `npx expo export`: Sucesso (Bundle Hermes gerado: ~5.19 MB).
- [x] Verificação estática de fluxos críticos (Login, OTA, Assembleias, Jogos): OK.
