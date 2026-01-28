# Roteiro de Publicação e Teste de Updates (OTA/APK)

Este guia prático detalha o fluxo para o mantenedor do app SINPRF-ES.

## 🛠️ Cenário de Teste: Publicando uma OTA

Para validar o fluxo OTA sem gerar um novo APK:

### 1. Preparação no Código
- Realize a mudança desejada (ex: remover um texto de teste).
- **NÃO** altere `versionCode` ou `runtimeVersion` no `app.json`.

### 2. Publicação via EAS
No terminal, na pasta `mobile/`:
```bash
eas update --branch production --message "Removendo texto de teste da Home"
```
*Certifique-se de estar logado no EAS (`eas login`).*

### 3. Atualização do Manifesto (Drive)
No Google Drive, abra o arquivo `update-manifest.json` e atualize:
```json
"ota": {
  "enabled": true,
  "channel": "production",
  "notes": "Correções na tela inicial e melhorias de estabilidade."
}
```
*O `versionCode` no manifesto deve ser IGUAL ao build atual no celular (ex: 2).*

### 4. Teste no Celular
1. Abra o app.
2. Vá no menu Lateral (Drawer) -> **Atualizações**.
3. Toque em **Verificar Atualizações**.
4. O app deve detectar a atualização OTA.
5. Toque em **Baixar e Aplicar (Reiniciar)**.
6. Após o reinício, valide se a mudança (ex: remoção do texto) foi aplicada.

---

## 🏗️ Cenário de Teste: Publicando Novo APK

Para mudanças nativas:

### 1. Incrementar Versões (`app.json`)
```json
"version": "1.0.1",
"android": {
  "versionCode": 3
}
```

### 2. Gerar o Binário
```bash
eas build --platform android --profile production --local
```

### 3. Subir para o Drive
1. Salve o APK como `sinprfes-app-vc3-1.0.1.apk` (histórico).
2. Substitua o `sinprfes-app-latest.apk` pelo novo arquivo.

### 4. Atualizar Manifesto
```json
{
  "versionCode": 3,
  "versionName": "1.0.1",
  "runtimeVersion": "54.0.0",
  "apk": {
    "enabled": true,
    "fileName": "sinprfes-app-latest.apk",
    "minSupportedVersionCode": 3,
    "notes": "Atualização obrigatória por mudanças nativas de segurança."
  }
}
```
*Ao definir `minSupportedVersionCode` como 3, o app antigo (vc2) será bloqueado.*

---

## 📌 Convenções de Versionamento

- **versionCode**: Inteiro incremental (1, 2, 3...). Sincronizado com o build nativo.
- **versionName**: String amigável (1.0.0, 1.0.1...).
- **runtimeVersion**: Identifica a compatibilidade nativa. Geralmente fixo na versão major do Expo (ex: 54.0.0). Só mude se adicionar plugins nativos que quebrem o código JS antigo.
- **minSupportedVersionCode**: A versão mínima que o app permite rodar sem forçar o download do APK.
