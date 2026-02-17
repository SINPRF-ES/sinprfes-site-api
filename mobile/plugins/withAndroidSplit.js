const { withAppBuildGradle, withAndroidManifest } = require('@expo/config-plugins');

/**
 * Adiciona configuração de Split APK por ABI e permissão de instalação.
 */
function withAndroidSplit(config) {
  // 1. Configuração de Split APK
  config = withAppBuildGradle(config, (config) => {
    if (config.modResults.language === 'groovy') {
      config.modResults.contents = addSplitConfig(config.modResults.contents);
    }
    return config;
  });

  // 2. Adição da permissão REQUEST_INSTALL_PACKAGES
  config = withAndroidManifest(config, (config) => {
    const mainManifest = config.modResults.manifest;
    if (!mainManifest['uses-permission']) {
      mainManifest['uses-permission'] = [];
    }
    const hasPermission = mainManifest['uses-permission'].some(
      (p) => p.$['android:name'] === 'android.permission.REQUEST_INSTALL_PACKAGES'
    );
    if (!hasPermission) {
      mainManifest['uses-permission'].push({
        $: { 'android:name': 'android.permission.REQUEST_INSTALL_PACKAGES' },
      });
    }
    return config;
  });

  return config;
}

function addSplitConfig(contents) {
  // Se já existir um bloco splits, não duplica
  if (contents.includes('splits {') || contents.includes('splits{')) {
    return contents;
  }

  const splitBlock = `
    splits {
        abi {
            enable true
            reset()
            include "armeabi-v7a", "arm64-v8a"
            universalApk false
        }
    }
`;

  // Inserção robusta logo após a abertura do bloco android
  return contents.replace(/android\s*{/, 'android {\n' + splitBlock);
}

module.exports = withAndroidSplit;
