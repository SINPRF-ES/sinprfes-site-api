# Generating and Distributing APKs

This guide focuses on the specific process of generating APKs for manual distribution.

## ABI Split
To minimize file size, the app is configured to generate separate APKs for different architectures (`arm64-v8a` and `armeabi-v7a`).

## Generation Process

1. **Increment Version**: Update `versionCode` and `versionName` in `app.json`.
2. **Run Local Build**:
   ```bash
   cd mobile
   eas build --platform android --profile preview --local
   ```
3. **Extract APKs**: The build process will generate a `.tar.gz` (locally) or provide a link (cloud). Extract the APK files.
4. **Rename and Organize**:
   Follow the naming convention: `sinprfes-app-vc[VERSION_CODE]-[ABI].apk`
   Example: `sinprfes-app-vc54-arm64.apk`

## Distribution via Custom Update Manifest

The application uses a custom update system that reads an `update-manifest.json` from the backend/Google Drive.

### Manifest Structure
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
1. Upload the new APKs to the designated folder on Google Drive.
2. Update the `update-manifest.json` with the new version information and filenames.
3. The app will automatically detect the new version (if the current version is lower) and prompt the user to download.
