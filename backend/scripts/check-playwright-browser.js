#!/usr/bin/env node

const {
  hasMissingSystemDeps,
  isBrowserMissingExecutableError,
} = require('../src/modules/consulta-processual/service/playwrightBrowserService');

async function main() {
  let chromium;

  try {
    ({ chromium } = require('playwright'));
  } catch (err) {
    if (err?.code === 'MODULE_NOT_FOUND') {
      console.log('PLAYWRIGHT_PACKAGE_MISSING');
      process.exit(1);
    }
    throw err;
  }

  console.log('PLAYWRIGHT_PACKAGE_OK');

  const executablePath = chromium.executablePath();
  if (!executablePath) {
    console.log('PLAYWRIGHT_BROWSER_MISSING');
    process.exit(2);
  }

  console.log('PLAYWRIGHT_BROWSER_PRESENT');
  console.log(`PLAYWRIGHT_EXECUTABLE_PATH=${executablePath}`);

  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      timeout: 30000,
    });

    console.log('PLAYWRIGHT_LAUNCH_OK');
  } catch (err) {
    const message = String(err?.message || 'Unknown Playwright launch error');

    if (isBrowserMissingExecutableError(message)) {
      console.log('PLAYWRIGHT_BROWSER_MISSING');
      console.log(message);
      process.exit(2);
    }

    if (hasMissingSystemDeps(message)) {
      console.log('PLAYWRIGHT_SYSTEM_DEPS_MISSING');
      console.log(message);
      process.exit(3);
    }

    console.log('PLAYWRIGHT_LAUNCH_FAILED');
    console.log(message);
    process.exit(4);
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

main().catch((err) => {
  console.log('PLAYWRIGHT_LAUNCH_FAILED');
  console.log(String(err?.message || err));
  process.exit(4);
});
