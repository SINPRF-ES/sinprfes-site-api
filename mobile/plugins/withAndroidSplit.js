const { withAppBuildGradle } = require("expo/config-plugins");

/**
 * Expo Config Plugin to enable ABI splits for Android builds.
 * This ensures the output contains separate APKs for arm64-v8a and armeabi-v7a.
 */
module.exports = function withAndroidSplit(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language === "groovy" || config.modResults.language === "gradle") {
      config.modResults.contents = addAndroidSplit(config.modResults.contents);
    }
    return config;
  });
};

function addAndroidSplit(buildGradle) {
  const splitBlock = `splits {
        abi {
            enable true
            reset()
            include "armeabi-v7a", "arm64-v8a"
            universalApk false
        }
    }`;

  // Check if splits { abi { ... } } already exists
  const abiSplitPattern = /splits\s*\{\s*abi\s*\{[\s\S]*?\}\s*\}/;

  if (abiSplitPattern.test(buildGradle)) {
    // Update existing block
    return buildGradle.replace(abiSplitPattern, splitBlock);
  }

  // Insert after android {
  return buildGradle.replace(/android\s*\{/, `android {\n    ${splitBlock}`);
}
