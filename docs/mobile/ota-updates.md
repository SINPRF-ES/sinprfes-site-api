# OTA Updates (Over-the-Air)

OTA updates allow you to update the application's JavaScript code and assets without requiring users to download a new APK, provided the `runtimeVersion` remains compatible.

## When to use OTA
- Bug fixes in JS/TS logic.
- UI adjustments (colors, fonts, layout).
- Content updates.
- New screens that do NOT require new native modules or permissions.

## Prerequisites
- EAS CLI installed and authenticated.
- Correct `runtimeVersion` in `app.json` (currently `54.0.1`).
- Compatible `eas.json` configuration.

## Publishing Workflow

1. **Verify Changes**: Ensure your changes do not require native modifications.
2. **Select Branch**: Choose the appropriate branch (`preview` or `production`).
3. **Execute Update**:
   ```bash
   cd mobile
   eas update --branch preview --platform android --message "Describe your changes"
   ```
4. **Validation**: Open the app and verify the update is detected and applied correctly.

## Rollback Strategy
If an update causes issues, you can roll back to a previous version using the EAS dashboard or CLI:
```bash
eas update:rollback --branch preview
```

## Monitoring
Check the logs in the app under `Menu -> Atualizações -> Ver Logs` to ensure the update process is succeeding.
Look for:
- `Update.Modal.Detected`
- `Update.Download.Success`
- `Update.Applied`
