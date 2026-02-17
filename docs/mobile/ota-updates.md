# OTA Updates (Over-the-Air) - SINPRF-ES

OTA updates allow you to update the application's JavaScript code and assets without requiring users to download a new APK, provided the `runtimeVersion` remains compatible.

## When to use OTA
- Bug fixes in JS/TS logic.
- UI adjustments (colors, fonts, layout).
- Content updates.
- New screens that do NOT require new native modules or permissions.

### Examples:
- Fixing a typo or a color.
- Correcting logic in a `useEffect` or `useQuery`.
- Adding a new feature that uses existing native components.

## Prerequisites
- EAS CLI installed and authenticated.
- Correct `runtimeVersion` in `app.json` (currently `54.0.1`).
- Consistent project state (run `pnpm install` in root and `mobile/` before).

## Publishing Workflow

1. **Verify Changes**: Ensure your changes do not require native modifications.
2. **Select Branch**: Choose the appropriate branch (`preview` or `production`).
3. **Execute Update**:
   ```bash
   cd mobile
   eas update --branch preview --platform android --message "Describe your changes"
   ```
4. **Validation**: Open the app and verify the update is detected and applied correctly.

## Decision Matrix

| Change | Update Type | Requires New APK? |
| :--- | :--- | :--- |
| Fix typo | OTA | No |
| Change button color | OTA | No |
| New form field | OTA | No |
| Add Native Module (e.g. Firebase) | APK | **Yes** |
| Change App Icon | APK | **Yes** |
| New Permission (e.g. GPS) | APK | **Yes** |
| Update Expo SDK | APK | **Yes** |

## Rollback Strategy
If an update causes issues, you can roll back to a previous version using the EAS CLI:
```bash
eas update:rollback --branch preview
```

## Monitoring and Logs
Check the logs in the app under `Menu -> Atualizações -> Ver Logs`.
Look for:
- `Update.Modal.Detected`
- `Update.Download.Success`
- `Update.Applied`
