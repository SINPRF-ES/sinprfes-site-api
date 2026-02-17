# Generating and Distributing APKs - SINPRF-ES

This guide focuses on the specific process of generating APKs for manual distribution and managing the update manifest.

## When to Rebuild the APK
- Changes affecting native code (Java/Kotlin).
- New permissions or Expo config plugins.
- Expo SDK updates.
- Changes to `app.json` (icon, splash, app name).

## ABI Split
To minimize file size, the app is configured to generate separate APKs for different architectures (`arm64-v8a` and `armeabi-v7a`).

## Generation Process (Local Build)

1. **Increment Version**: Update `versionCode` and `versionName` in `app.json`.
2. **Run Local Build**:
   ```bash
   cd mobile
   eas build --platform android --profile preview --local
   ```
3. **Extract and Organize**:
   - Extract the generated `.tar.gz`.
   - Rename APKs following the convention: `sinprfes-app-vc[VERSION_CODE]-[ABI].apk`
   - Example: `sinprfes-app-vc54-arm64.apk`

## Distribution via Custom Update Manifest

The application uses a custom update system that reads an `update-manifest.json` from the backend/Google Drive.

### Manifest Structure (`update-manifest.json`)
```json
{
  "apk": {
    "enabled": true,
    "minSupportedVersionCode": 54,
    "notes": "Nova versão com melhorias de estabilidade.",
    "files": {
      "arm64-v8a": "sinprfes-app-vc54-arm64.apk",
      "armeabi-v7a": "sinprfes-app-vc54-v7a.apk"
    }
  }
}
```

### Steps to Release:
1. Upload the new APKs to the `Publicações/App` folder on Google Drive.
2. Update the `update-manifest.json` on the Drive/Backend.
3. Versions below `minSupportedVersionCode` will be forced to update.

## Debugging with ADB
```bash
# Manual install
adb install -r sinprfes-app-vc54-arm64.apk

# View logs
adb logcat *:S ReactNative:V ReactNativeJS:V
```
