# Fluxo Operacional de Atualizações (SINPRF-ES)

Este documento descreve os critérios para decidir entre uma atualização via OTA (Over-the-Air) ou um novo Build de APK.

## 🚀 1. Quando usar OTA (EAS Update)

**Ideal para:** Ajustes rápidos de interface, correção de bugs em lógica JS/TS, textos, estilos e novas telas que não dependem de novos módulos nativos.

### Cenários de Exemplo:
- Mudança de cores, fontes ou espaçamentos.
- Correção de um erro em um `useEffect` ou `useQuery`.
- Alteração em um texto de ajuda ou label de botão.
- Adição de uma nova funcionalidade que utiliza apenas componentes já existentes no APK.

### Passo a Passo:
1. **Desenvolvimento**: Realize as alterações no código.
2. **Publicação**: Execute `eas update --branch production --message "Descrição da mudança"`.
3. **Versão**: Mantenha o `versionCode` e `runtimeVersion` inalterados no `app.json`.
4. **Manifesto**: Atualize apenas o bloco `ota` no `update-manifest.json` no Google Drive (notas e habilitar flag).
5. **Aplicação**: O usuário verá o modal no app e aplicará a mudança sem precisar baixar um novo arquivo.

---

## 📦 2. Quando Rebuildar o APK (Novo Build)

**Obrigatório para:** Mudanças que afetam o código nativo (Java/Kotlin/Objective-C), alteração de permissões, novos plugins ou mudança de versão do Expo SDK.

### Cenários de Exemplo:
- Atualização do Expo SDK (ex: v54 para v55).
- Adição de uma nova biblioteca que requer `npx expo prebuild` (ex: nova permissão de Câmera ou Bluetooth).
- Alteração no `app.json` que afete o binário (ícone, splash screen, nome do app).
- Quando decidimos quebrar compatibilidade com versões antigas.

### Passo a Passo:
1. **Configuração**: Incremente o `versionCode` (ex: de 2 para 3) no `app.json`.
2. **Runtime**: Se houver mudança nativa, o `runtimeVersion` deve ser atualizado.
3. **Build**: Execute `eas build --platform android --profile production --local` (ou via nuvem).
4. **Distribuição**:
   - Renomeie o APK gerado para o padrão histórico (ex: `sinprfes-app-vc3-1.0.1.apk`).
   - Sobrescreva o `sinprfes-app-latest.apk` na pasta `Publicações/App` do Drive.
5. **Manifesto**:
   - Atualize `versionCode`, `versionName` e `runtimeVersion` no `update-manifest.json`.
   - Defina `minSupportedVersionCode` se a atualização for obrigatória.
6. **Bloqueio**: Versões antigas abaixo do `minSupportedVersionCode` serão bloqueadas e forçadas a baixar o novo APK.

---

## ⚖️ Checklist de Decisão

| Alteração | Tipo de Update | Requer novo APK? |
| :--- | :--- | :--- |
| Corrigir erro de digitação | OTA | Não |
| Alterar cor de botão | OTA | Não |
| Novo campo no formulário | OTA | Não |
| Adicionar Firebase/Push | APK | **Sim** |
| Mudar ícone do app | APK | **Sim** |
| Nova permissão (GPS) | APK | **Sim** |
| Atualizar Expo SDK | APK | **Sim** |

---

## 🛠️ Notas de Integração WebView

- **Estatuto no app**: O WebView utiliza o modo embed (`?embed=1`) para evitar a renderização do header/nav azul do portal, garantindo que o usuário utilize apenas a navegação nativa do app (Sumário).
- **Parâmetros Suportados**: `embed=1` ou `app=1` ocultam `#site-header` e `#site-footer`.

**Nota**: Em caso de dúvida, opte pelo Build de APK para garantir que todos os usuários recebam as mudanças nativas necessárias.
