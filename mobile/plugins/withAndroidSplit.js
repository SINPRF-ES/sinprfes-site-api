const { withAppBuildGradle } = require('@expo/config-plugins');

const withAndroidSplit = (config) => {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language === 'groovy') {
      config.modResults.contents = addSplitConfig(config.modResults.contents);
    }
    return config;
  });
};

function addSplitConfig(contents) {
  if (contents.includes('splits {')) {
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

  // Insert before the end of the android block
  return contents.replace(/android {/, 'android {' + splitBlock);
}

module.exports = withAndroidSplit;
