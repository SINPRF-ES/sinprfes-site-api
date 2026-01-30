# Roteiro de Publicação e Teste de Updates (OTA/APK)

Este guia detalha o fluxo completo para o mantenedor do app SINPRF-ES, focado no canal **preview** e runtime **54.0.1**.

## A) Preparar repo limpo
Sempre comece com um estado limpo para evitar artefatos de builds anteriores.

```bash
git fetch origin
git reset --hard origin/main
git clean -fdx
```
*Nota: Não mantenha artefatos gerados (build .apk, .tar.gz, /release/) dentro do repo. Verifique o .gitignore.*

## B) Instalar dependências e checagens
Garanta que o ambiente está correto antes de buildar.

```bash
# Na raiz do monorepo
pnpm install

# Na pasta mobile/
cd mobile
npm install
npx expo install expo-system-ui
npx expo install --check
npx expo-doctor
```

## C) Build local (preview)
Gere os APKs localmente usando o perfil de preview.

```bash
npx eas build -p android --profile preview --local
```

## D) Publicar OTA (Android)
Envie atualizações de JS/UI sem necessidade de novo APK (desde que o runtimeVersion seja compatível).

```bash
eas update --branch preview --platform android --message "Sua mensagem aqui"
```

## E) Extrair e Organizar APKs por ABI
Após o build local, extraia os binários e organize-os.

```bash
# 1. Preparar pasta de saída
mkdir -p /tmp/sinprfes-build-out
# Localize o arquivo .tar.gz gerado pelo EAS e extraia-o
tar -xzvf build-*.tar.gz -C /tmp/sinprfes-build-out

# 2. Localizar pasta release
cd /tmp/sinprfes-build-out/release

# 3. Definir ferramenta AAPT (ajuste o path conforme seu Android SDK)
AAPT=$ANDROID_HOME/build-tools/34.0.0/aapt

# 4. Extrair metadados (versionCode/versionName)
$AAPT dump badging app-arm64-v8a-release.apk | grep versionCode
$AAPT dump badging app-armeabi-v7a-release.apk | grep versionCode

# 5. Renomear e organizar (Exemplo para VC 54)
VC=54
VN="1.1.0"
cp app-arm64-v8a-release.apk sinprfes-app-vc$VC-arm64.apk
cp app-armeabi-v7a-release.apk sinprfes-app-vc$VC-armeabi.apk

# 6. Criar cópias "latest" para o manifesto
cp sinprfes-app-vc$VC-arm64.apk sinprfes-app-latest-arm64.apk
cp sinprfes-app-vc$VC-armeabi.apk sinprfes-app-latest-armeabi.apk
```

## F) Checklist final (manual)
Antes de atualizar o `update-manifest.json` no Google Drive:

1. [ ] Confirmar `versionCode` idêntico nos dois APKs.
2. [ ] Confirmar `runtimeVersion: "54.0.1"` no `app.json`.
3. [ ] Confirmar que o canal EAS é `preview`.
4. [ ] Testar auto-check: ao logar, o modal deve aparecer se houver update.
5. [ ] Testar botão "Baixar agora" no modal: deve iniciar download e instalação.
6. [ ] Confirmar logs no `Atualizações` -> `Ver Logs`: procurar por `Update.Modal.CTA.Click` e `Update.Apk.Download.Success`.

## 🔍 Debug (Opcional)
Comandos úteis para depuração via ADB:

```bash
# Instalar manualmente via cabo/wifi
adb install -r sinprfes-app-vc54-arm64.apk

# Ver logs em tempo real filtrando pelo app
adb logcat *:S ReactNative:V ReactNativeJS:V

# Limpar cache do app
adb shell pm clear br.org.sinprfes.app
```
