#!/usr/bin/env node

const { execSync } = require('child_process');

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
    'fonts-liberation'
  ];

  const aptInstallCmd = [
    'apt-get update',
    `apt-get install -y --no-install-recommends ${packages.join(' ')}`,
    'rm -rf /var/lib/apt/lists/*'
  ].join(' && ');

  execSync(aptInstallCmd, { stdio: 'inherit' });
  console.log('Playwright Linux system dependencies installation completed (apt-get).');
}

const shouldSkip = String(process.env.PLAYWRIGHT_INSTALL_CHROMIUM || 'true').toLowerCase();
if (!['1', 'true', 'yes', 'on'].includes(shouldSkip)) {
  console.log('Skipping Playwright browser installation (PLAYWRIGHT_INSTALL_CHROMIUM disabled).');
  process.exit(0);
}

const installCmd = 'npx playwright install chromium';

try {
  installLinuxSystemDeps();
  execSync(installCmd, { stdio: 'inherit' });
  console.log('Playwright Chromium installation completed.');
} catch (err) {
  console.error('Playwright Chromium installation failed.');
  process.exit(err.status || 1);
}
