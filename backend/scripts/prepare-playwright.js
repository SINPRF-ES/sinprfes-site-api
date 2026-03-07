#!/usr/bin/env node

const { execSync } = require('child_process');

const shouldSkip = String(process.env.PLAYWRIGHT_INSTALL_CHROMIUM || 'true').toLowerCase();
if (!['1', 'true', 'yes', 'on'].includes(shouldSkip)) {
  console.log('Skipping Playwright browser installation (PLAYWRIGHT_INSTALL_CHROMIUM disabled).');
  process.exit(0);
}

const withDeps = String(process.env.PLAYWRIGHT_INSTALL_WITH_DEPS || 'true').toLowerCase();
const useWithDeps = ['1', 'true', 'yes', 'on'].includes(withDeps);
const installCmd = useWithDeps
  ? 'npx playwright install --with-deps chromium'
  : 'npx playwright install chromium';

try {
  execSync(installCmd, { stdio: 'inherit' });
  console.log(`Playwright Chromium installation completed (${useWithDeps ? 'with deps' : 'without deps'}).`);
} catch (err) {
  console.error('Playwright Chromium installation failed.');
  process.exit(err.status || 1);
}
