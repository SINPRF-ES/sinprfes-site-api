# Mobile Architecture - SINPRF-ES

## Overview
The SINPRF-ES mobile application is built using **Expo SDK 54**. It follows a monorepo structure where shared logic is kept in the root `/shared` directory.

## Canonical Rules (Non-Negotiable)
1. **Independence**: The `/mobile` directory is a self-contained Expo project. It MUST NOT depend on root `node_modules` or `backend/node_modules`.
2. **Dependency Isolation**: No UI or mobile-specific dependencies (react, react-native, expo, etc.) are allowed in the `/backend` or root `package.json`.
3. **Single Source of Truth**: The backend is the single source of truth for data. Mobile acts strictly as a client.
4. **Resolution**: Metro is configured using the default Expo config (`getDefaultConfig(__dirname)`), ensuring it resolves dependencies within the mobile project context first.
5. **Stability**: All important derived permission booleans and flags must be declared at the top of component logic to prevent `ReferenceError` crashes.

## Project Structure
- `mobile/App.tsx`: Main entry point.
- `mobile/index.ts`: Expo entry point.
- `mobile/src/`: Application source code.
- `mobile/plugins/`: Custom Expo config plugins (e.g., `withAndroidSplit.js`).
- `mobile/assets/`: Static assets (images, fonts).
- `mobile/metro.config.js`: Simplified Metro bundler configuration.

## Build and Update Strategy
- **OTA Updates**: Handled via EAS Update for JS/Asset changes. See [ota-updates.md](./ota-updates.md).
- **Native Builds**: Handled via EAS Build for changes requiring native code modification or SDK updates. See [apk-build.md](./apk-build.md).
- **Distribution**: APKs are distributed via a custom update mechanism integrated with Google Drive and the backend.

## Parity with Site
The mobile app aims for functional and visual parity with the institutional site.
- **RBAC**: Shared permissions model (ADMIN, DIRETORIA, FUNCIONARIO, FILIADO).
- **Data Normalization**: Shared formatters for CPF, Phones, and CEP.
- **Visual Cues**: Consistent use of status colors and icons.
