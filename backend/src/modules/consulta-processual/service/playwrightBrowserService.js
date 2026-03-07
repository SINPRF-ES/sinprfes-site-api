const { getConsultaProcessualConfig } = require('../utils/consultaProcessualConfig');

const REASON_CODES = {
  PLAYWRIGHT_DISABLED: 'PLAYWRIGHT_DISABLED',
  PACKAGE_MISSING: 'PLAYWRIGHT_PACKAGE_MISSING',
  BROWSER_MISSING: 'PLAYWRIGHT_BROWSER_MISSING',
  LAUNCH_FAILED: 'PLAYWRIGHT_LAUNCH_FAILED',
};

function loadPlaywrightModule() {
  try {
    // eslint-disable-next-line global-require
    return require('playwright');
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') return null;
    throw err;
  }
}

async function launchBrowser(options = {}) {
  const cfg = options.config || getConsultaProcessualConfig();
  const loader = options.playwrightLoader || loadPlaywrightModule;

  if (!cfg.playwrightEnabled) {
    return {
      ok: false,
      reasonCode: REASON_CODES.PLAYWRIGHT_DISABLED,
      reason: 'Playwright integration disabled by environment configuration.',
    };
  }

  const playwright = loader();
  if (!playwright) {
    return {
      ok: false,
      reasonCode: REASON_CODES.PACKAGE_MISSING,
      reason: 'Playwright package is not installed in backend runtime.',
    };
  }

  const browserTypeName = cfg.playwrightBrowser || 'chromium';
  const browserType = playwright[browserTypeName];
  if (!browserType || typeof browserType.launch !== 'function') {
    return {
      ok: false,
      reasonCode: REASON_CODES.BROWSER_MISSING,
      reason: `Playwright browser type "${browserTypeName}" is unavailable in current runtime.`,
    };
  }

  try {
    const browser = await browserType.launch({
      headless: cfg.headless,
      timeout: cfg.playwrightLaunchTimeoutMs,
      args: cfg.playwrightExtraArgs,
    });

    return {
      ok: true,
      browser,
      browserTypeName,
      launchOptions: {
        headless: cfg.headless,
        timeout: cfg.playwrightLaunchTimeoutMs,
        args: cfg.playwrightExtraArgs,
      },
    };
  } catch (err) {
    return {
      ok: false,
      reasonCode: REASON_CODES.LAUNCH_FAILED,
      reason: `Failed to launch Playwright ${browserTypeName}.`,
      errorMessage: err.message,
    };
  }
}

module.exports = {
  REASON_CODES,
  loadPlaywrightModule,
  launchBrowser,
};
