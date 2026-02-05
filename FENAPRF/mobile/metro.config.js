const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

// Monorepo: permite resolver e observar dependências via file:../backend/shared/format
config.watchFolders = [
  path.resolve(projectRoot, "../backend/shared/format"),
];

// Garante resolução consistente do node_modules do mobile
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
];

module.exports = config;
