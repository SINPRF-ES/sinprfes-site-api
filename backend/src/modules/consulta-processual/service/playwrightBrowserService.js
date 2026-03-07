const { getConsultaProcessualConfig } = require('../utils/consultaProcessualConfig');

const REASON_CODES = {
  PLAYWRIGHT_DISABLED: 'PLAYWRIGHT_DISABLED',
  PACKAGE_MISSING: 'PLAYWRIGHT_PACKAGE_MISSING',
  BROWSER_MISSING: 'PLAYWRIGHT_BROWSER_MISSING',
  SYSTEM_DEPS_MISSING: 'PLAYWRIGHT_SYSTEM_DEPS_MISSING',
  LAUNCH_FAILED: 'PLAYWRIGHT_LAUNCH_FAILED',
};

function isBrowserMissingExecutableError(errorMessage = '') {
  const msg = String(errorMessage || '').toLowerCase();
  return msg.includes("executable doesn't exist at")
    || msg.includes('failed to launch because executable doesn\'t exist')
    || msg.includes('browser was not found at the configured executablepath');
}

function hasMissingSystemDeps(errorMessage = '') {
  const msg = String(errorMessage || '').toLowerCase();
  return msg.includes('error while loading shared libraries')
    || msg.includes('cannot open shared object file')
    || msg.includes('libglib-2.0.so.0')
    || msg.includes('host system is missing dependencies');
}

function extractMissingLibrary(errorMessage = '') {
  const text = String(errorMessage || '');
  // Matches "loading shared libraries: <libname>: cannot open shared object file"
  const match = text.match(/loading shared libraries:\s*([^:\n\s]+):/i)
    || text.match(/shared object file:\s*([^\s]+)/i)
    || text.match(/\b(lib[\w.+-]+\.so(?:\.\d+)*)\b/i);
  return match?.[1] || null;
}

function compactErrorMessage(errorMessage = '', limit = 500) {
  const normalized = String(errorMessage || '')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const relevantLine = normalized.find((line) => /error while loading shared libraries|cannot open shared object file|host system is missing dependencies/i.test(line));
  const message = relevantLine || normalized[0] || 'Unknown Playwright launch error';
  return message.length > limit ? `${message.slice(0, limit)}…` : message;
}


function debugLog(cfg, message) {
  if (cfg?.debug) {
    console.log(`[PLAYWRIGHT_DEBUG] ${message}`);
  }
}

function buildFailureResult(cfg, payload) {
  const result = {
    ok: false,
    ...payload,
  };

  const executablePathInfo = result.executablePath || 'NOT_AVAILABLE';
  debugLog(cfg, `reasonCode=${result.reasonCode}; executablePath=${executablePathInfo}`);
  if (result.errorMessage) {
    debugLog(cfg, `errorMessage=${result.errorMessage}`);
  }

  return result;
}
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
    return buildFailureResult(cfg, {
      reasonCode: REASON_CODES.PLAYWRIGHT_DISABLED,
      reason: 'Playwright integration disabled by environment configuration.',
    });
  }

  const playwright = loader();
  if (!playwright) {
    return buildFailureResult(cfg, {
      reasonCode: REASON_CODES.PACKAGE_MISSING,
      reason: 'Playwright package is not installed in backend runtime.',
    });
  }

  const browserTypeName = cfg.playwrightBrowser || 'chromium';
  const browserType = playwright[browserTypeName];

  let executablePath = null;
  if (browserType && typeof browserType.executablePath === 'function') {
    try {
      executablePath = browserType.executablePath();
    } catch (e) {
      debugLog(cfg, `Could not get executablePath: ${e.message}`);
    }
  }

  debugLog(cfg, 'Starting launch sequence:');
  debugLog(cfg, `Browser Type: ${browserTypeName}`);
  debugLog(cfg, `PLAYWRIGHT_BROWSERS_PATH: ${process.env.PLAYWRIGHT_BROWSERS_PATH || 'not set'}`);
  debugLog(cfg, `Executable Path: ${executablePath || 'NOT_AVAILABLE'}`);

  if (!browserType || typeof browserType.launch !== 'function') {
    return buildFailureResult(cfg, {
      reasonCode: REASON_CODES.BROWSER_MISSING,
      reason: `Playwright browser type "${browserTypeName}" is unavailable in current runtime.`,
      ...(executablePath ? { executablePath } : {}),
    });
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
    const rawErrorMessage = String(err?.message || 'Unknown Playwright launch error');

    if (isBrowserMissingExecutableError(rawErrorMessage)) {
      return buildFailureResult(cfg, {
        reasonCode: REASON_CODES.BROWSER_MISSING,
        reason: 'Playwright package is present, but Chromium executable is missing from the system.',
        errorMessage: compactErrorMessage(rawErrorMessage),
        playwrightBrowsersPath: process.env.PLAYWRIGHT_BROWSERS_PATH || 'NOT_SET',
        ...(executablePath ? { executablePath } : {}),
      });
    }

    if (hasMissingSystemDeps(rawErrorMessage)) {
      const missingLibrary = extractMissingLibrary(rawErrorMessage);

      return buildFailureResult(cfg, {
        reasonCode: REASON_CODES.SYSTEM_DEPS_MISSING,
        reason: 'Playwright Chromium is installed, but required Linux system libraries are missing.',
        errorMessage: compactErrorMessage(rawErrorMessage),
        ...(missingLibrary ? { missingLibrary } : {}),
        ...(executablePath ? { executablePath } : {}),
      });
    }

    return buildFailureResult(cfg, {
      reasonCode: REASON_CODES.LAUNCH_FAILED,
      reason: `Failed to launch Playwright ${browserTypeName}.`,
      errorMessage: compactErrorMessage(rawErrorMessage),
      ...(executablePath ? { executablePath } : {}),
    });
  }
}

module.exports = {
  REASON_CODES,
  loadPlaywrightModule,
  launchBrowser,
  isBrowserMissingExecutableError,
  hasMissingSystemDeps,
  extractMissingLibrary,
  compactErrorMessage,
};
