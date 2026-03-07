#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const backendRoot = path.resolve(__dirname, '..');
const packageJsonPath = path.join(backendRoot, 'package.json');

const installSystemDepsFlag = String(process.env.PLAYWRIGHT_INSTALL_SYSTEM_DEPS || 'true').toLowerCase();
const shouldInstallSystemDeps = ['1', 'true', 'yes', 'on'].includes(installSystemDepsFlag);

function hasCommand(command) {
  try {
    execSync(`command -v ${command}`, { stdio: 'ignore' });
    return true;
  } catch (_) {
    return false;
  }
}

function installLinuxSystemDeps() {
  if (!shouldInstallSystemDeps) {
    console.log('Skipping Playwright Linux system dependencies installation (PLAYWRIGHT_INSTALL_SYSTEM_DEPS disabled).');
    return;
  }

  if (process.platform !== 'linux') {
    console.log(`Skipping Playwright Linux system dependencies installation on ${process.platform}.`);
    return;
  }

  if (!hasCommand('apt-get')) {
    console.log('apt-get not found; skipping explicit Linux system dependencies installation.');
    return;
  }

  const packages = [
    'libasound2',
    'libatk-bridge2.0-0',
    'libatk1.0-0',
    'libatspi2.0-0',
    'libcairo2',
    'libdbus-1-3',
    'libdrm2',
    'libgbm1',
    'libglib2.0-0',
    'libgtk-3-0',
    'libnspr4',
    'libnss3',
    'libpango-1.0-0',
    'libx11-6',
    'libx11-xcb1',
    'libxcb1',
    'libxcomposite1',
    'libxdamage1',
    'libxext6',
    'libxfixes3',
    'libxkbcommon0',
    'libxrandr2',
    'ca-certificates',
    'fonts-liberation',
  ];

  const aptInstallCmd = [
    'apt-get update',
    `apt-get install -y --no-install-recommends ${packages.join(' ')}`,
    'rm -rf /var/lib/apt/lists/*',
  ].join(' && ');

  try {
    execSync(aptInstallCmd, { stdio: 'inherit' });
  } catch (err) {
    console.warn('Warning: Failed to install system dependencies via apt-get in prepare-playwright.js.');
    console.warn('This is expected in environments where system libs are already managed by nixpacks.toml.');
  }

  console.log('Playwright Linux system dependencies installation completed (apt-get).');
}

function ensureBackendContext() {
  if (!fs.existsSync(packageJsonPath)) {
    throw new Error(`backend/package.json was not found at ${packageJsonPath}`);
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  if (packageJson.name !== '@sinprfes/backend') {
    throw new Error(`Unexpected package.json in backend root: expected @sinprfes/backend, got ${packageJson.name || 'UNKNOWN'}`);
  }

  console.log(`PLAYWRIGHT_INSTALL_CONTEXT_OK cwd=${backendRoot}`);
}

const installChromiumFlag = String(process.env.PLAYWRIGHT_INSTALL_CHROMIUM || 'true').toLowerCase();
if (!['1', 'true', 'yes', 'on'].includes(installChromiumFlag)) {
  console.log('Skipping Playwright browser installation (PLAYWRIGHT_INSTALL_CHROMIUM disabled).');
  process.exit(0);
}

try {
  ensureBackendContext();
  installLinuxSystemDeps();

  execSync('npx playwright install chromium', {
    stdio: 'inherit',
    cwd: backendRoot,
    env: process.env,
  });

  console.log('Playwright Chromium installation completed (backend context).');
} catch (err) {
  console.error('Playwright Chromium installation failed.');
  process.exit(err.status || 1);
}
