// Learn more https://docs.expo.dev/guides/monorepos
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
// We define workspaceRoot only for watchFolders, not for direct node_modules resolution
// to comply with the "NOT depend on root node_modules" architectural rule.
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// 1. Watch all files within the monorepo (required for local workspace packages)
config.watchFolders = [workspaceRoot];

// 2. Let Metro know where to resolve packages and in what order
// We ONLY look in the local node_modules to ensure total dependency isolation.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
];

// 3. Force Metro to resolve (sub)dependencies from the node_modules folder above
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
