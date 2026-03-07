#!/usr/bin/env node

const { launchBrowser } = require('../src/modules/consulta-processual/service/playwrightBrowserService');
const { getConsultaProcessualConfig } = require('../src/modules/consulta-processual/utils/consultaProcessualConfig');

async function main() {
  const cfg = getConsultaProcessualConfig();
  const result = await launchBrowser({ config: cfg });

  if (!result.ok) {
    if (result.reasonCode === 'PLAYWRIGHT_PACKAGE_MISSING') {
      console.log('PLAYWRIGHT_PACKAGE_MISSING');
      process.exit(1);
    }

    if (result.reasonCode === 'PLAYWRIGHT_BROWSER_MISSING') {
      console.log('PLAYWRIGHT_PACKAGE_OK');
      console.log('PLAYWRIGHT_BROWSER_MISSING');
      process.exit(2);
    }

    if (result.reasonCode === 'PLAYWRIGHT_LAUNCH_FAILED') {
      console.log('PLAYWRIGHT_PACKAGE_OK');
      console.log('PLAYWRIGHT_BROWSER_OK');
      console.log('PLAYWRIGHT_LAUNCH_FAILED');
      if (result.errorMessage) console.log(result.errorMessage);
      process.exit(3);
    }

    if (result.reasonCode === 'PLAYWRIGHT_SYSTEM_DEPS_MISSING') {
      console.log('PLAYWRIGHT_PACKAGE_OK');
      console.log('PLAYWRIGHT_BROWSER_OK');
      console.log('PLAYWRIGHT_SYSTEM_DEPS_MISSING');
      if (result.errorMessage) console.log(result.errorMessage);
      process.exit(6);
    }

    console.log(result.reasonCode || 'PLAYWRIGHT_CHECK_FAILED');
    process.exit(4);
  }

  console.log('PLAYWRIGHT_PACKAGE_OK');
  console.log('PLAYWRIGHT_BROWSER_OK');
  console.log('PLAYWRIGHT_LAUNCH_OK');
  await result.browser.close();
}

main().catch((err) => {
  console.log('PLAYWRIGHT_LAUNCH_FAILED');
  console.log(err.message);
  process.exit(5);
});
