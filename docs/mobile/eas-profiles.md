# EAS Build Profiles

The SINPRF-ES mobile project defines several EAS Build profiles in `mobile/eas.json` to handle different environments and distribution methods.

## Profile: development
- **Purpose**: Local development and testing with a development client.
- **Distribution**: Internal.
- **Channel**: `development`.
- **Behavior**: Generates a development build that can be used to load the app from a local Metro bundler.

## Profile: preview
- **Purpose**: Internal distribution of production-like builds for testing.
- **Distribution**: Internal.
- **Channel**: `preview`.
- **Android Configuration**:
  - `buildType`: `apk` (Generates APK files instead of AAB).
  - `applicationArchivePath`: `android/app/build/outputs/apk/**/*.apk`.
- **Key Feature**: Configured for **ABI Splits**. This profile produces separate APKs for `arm64-v8a` and `armeabi-v7a`. The `applicationArchivePath` ensures that all generated APKs are collected into the final build artifact (usually delivered as a `.tar.gz`).

## Profile: production
- **Purpose**: Official releases for the Play Store and App Store.
- **Channel**: `production`.
- **Android Configuration**: Default (Generates a single AAB for Play Store).

## Usage
To build with a specific profile, use the `--profile` flag:

```bash
cd mobile
eas build -p android --profile <profile_name>
```

For more details on ABI splits, see [docs/mobile/build-apk-splits.md](./build-apk-splits.md).
