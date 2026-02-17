# EAS Build Configuration

EAS Build is used to generate the native application binaries (APK for Android, AAB for Play Store).

## Build Profiles
Profiles are defined in `mobile/eas.json`:
- **development**: For local development with Expo Go or Dev Client.
- **preview**: For testing with real APKs, includes the production API URL but uses the preview update channel.
- **production**: For final release, generates AAB for Play Store or production APK.

## Running a Build

### Local Build (Recommended for APKs)
Requires a local environment with Android Studio/SDK configured.
```bash
cd mobile
eas build --platform android --profile preview --local
```

### Cloud Build
Uses Expo's servers (requires subscription or free tier credits).
```bash
cd mobile
eas build --platform android --profile production
```

## Key Configurations
- **Runtime Version**: Defined in `app.json`. Must be updated when native dependencies change.
- **Version Code**: Must be incremented for every new APK/AAB release.
- **Plugins**: Custom plugins like `withAndroidSplit.js` are executed during the prebuild phase.

## Troubleshooting
- **Dependency Issues**: Run `npx expo doctor` to check for version mismatches.
- **Plugin Errors**: Expo SDK 54+ handles config plugins internally; do NOT install `@expo/config-plugins` as a direct dependency.
- **Metro Resolution**: Check `mobile/metro.config.js`. It should be kept simple using `getDefaultConfig(__dirname)`.
