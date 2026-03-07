#!/usr/bin/env node

const { execSync } = require('child_process');

const shouldSkip = String(process.env.PLAYWRIGHT_INSTALL_CHROMIUM || 'true').toLowerCase();
if (!['1', 'true', 'yes', 'on'].includes(shouldSkip)) {
  console.log('Skipping Playwright browser installation (PLAYWRIGHT_INSTALL_CHROMIUM disabled).');
  process.exit(0);
}

try {
  execSync('npx playwright install chromium', { stdio: 'inherit' });
  console.log('Playwright Chromium installation completed.');
} catch (err) {
  console.error('Playwright Chromium installation failed.');
  process.exit(err.status || 1);
}
