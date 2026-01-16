// scripts/check-root-deps.js
const fs = require('fs');
const path = require('path');

const rootPackageJsonPath = path.resolve(__dirname, '..', 'package.json');
const rootPackageJson = JSON.parse(fs.readFileSync(rootPackageJsonPath, 'utf8'));

const forbiddenDeps = [
  'react',
  'react-dom',
  'react-native',
  'expo',
  '@react-navigation/native',
  '@react-navigation/drawer',
  '@react-native-picker/picker',
  'react-query',
  '@tanstack/react-query',
  'react-native-reanimated',
  'react-native-gesture-handler',
  'expo-secure-store',
];

const dependencies = rootPackageJson.dependencies || {};
const devDependencies = rootPackageJson.devDependencies || {};
const allDeps = { ...dependencies, ...devDependencies };

const foundForbiddenDeps = forbiddenDeps.filter(dep => allDeps[dep]);

if (foundForbiddenDeps.length > 0) {
  console.error(
    '\x1b[31m%s\x1b[0m', // Red color
    'ERRO: Dependências de UI/mobile encontradas no package.json da raiz (backend):'
  );
  foundForbiddenDeps.forEach(dep => {
    console.error(`  - ${dep}`);
  });
  console.error(
    '\x1b[33m%s\x1b[0m', // Yellow color
    'Por favor, mova essas dependências para o package.json de mobile/.'
  );
  process.exit(1);
}

console.log(
  '\x1b[32m%s\x1b[0m', // Green color
  'Verificação de dependências da raiz concluída com sucesso. Nenhuma dependência de UI/mobile encontrada.'
);
process.exit(0);
