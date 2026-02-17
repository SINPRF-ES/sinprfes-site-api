const { withAppBuildGradle } = require("expo/config-plugins");

module.exports = function withAndroidSplit(config) {
  return withAppBuildGradle(config, config => {
    return config;
  });
};
