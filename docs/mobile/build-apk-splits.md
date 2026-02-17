# Building Android ABI Split APKs

To minimize download size and ensure compatibility across different Android devices, the SINPRF-ES mobile app is configured to generate separate APKs for different CPU architectures (ABI splits).

## Target Architectures
The build generates two specific APKs:
- **arm64-v8a**: For modern 64-bit Android devices (most common).
- **armeabi-v7a**: For older 32-bit Android devices.

## How to Build
The `preview` profile in EAS is configured to produce these split APKs.

Run the following command in the `mobile` directory:

```bash
cd mobile
eas build -p android --profile preview
```

## Retrieving the APKs
After the EAS build completes:
1. Download the build artifact (usually a `.tar.gz` file when multiple outputs exist).
2. Extract the file.
3. You will find two APK files, typically named:
   - `app-arm64-v8a-release.apk` (or similar)
   - `app-armeabi-v7a-release.apk` (or similar)

## Installation
- **Manual Install**: Use `adb install` or transfer the appropriate APK to the device.
- **Which one to use?**: Most modern phones use `arm64-v8a`. If you are unsure, try the `arm64-v8a` version first; if it fails to install with an "Incompatible Architecture" error, use `armeabi-v7a`.

## Configuration Details
- **Config Plugin**: `mobile/plugins/withAndroidSplit.js` injects the `splits` block into `android/app/build.gradle`.
- **EAS Profile**: The `preview` profile in `eas.json` uses `buildType: "apk"` and `applicationArchivePath: "android/app/build/outputs/apk/**/*.apk"` to ensure both APKs are collected and uploaded as artifacts.
