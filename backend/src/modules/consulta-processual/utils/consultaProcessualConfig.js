function parseBool(v, d = false) {
  if (v === undefined || v === null || v === '') return d;
  return ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());
}

function parseIntSafe(v, d) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : d;
}

function getConsultaProcessualConfig() {
  const isProd = String(process.env.NODE_ENV || '').toLowerCase() === 'production';

  return {
    enabled: parseBool(process.env.CONSULTA_PROCESSUAL_ENABLED, true),
    trf1Enabled: parseBool(process.env.CONSULTA_PROCESSUAL_TRF1_ENABLED, true),
    trf3Enabled: parseBool(process.env.CONSULTA_PROCESSUAL_TRF3_ENABLED, false),
    trf5Enabled: parseBool(process.env.CONSULTA_PROCESSUAL_TRF5_ENABLED, false),
    trf6Enabled: parseBool(process.env.CONSULTA_PROCESSUAL_TRF6_ENABLED, false),
    timeoutMs: parseIntSafe(process.env.CONSULTA_PROCESSUAL_TIMEOUT_MS, 45000),
    initialLoadTimeoutMs: parseIntSafe(process.env.CONSULTA_PROCESSUAL_INITIAL_LOAD_TIMEOUT_MS, 30000),
    searchTimeoutMs: parseIntSafe(process.env.CONSULTA_PROCESSUAL_SEARCH_TIMEOUT_MS, 15000),
    debug: parseBool(process.env.CONSULTA_PROCESSUAL_DEBUG, false),
    headless: parseBool(process.env.CONSULTA_PROCESSUAL_HEADLESS, isProd),
    debugScreenshot: parseBool(process.env.CONSULTA_PROCESSUAL_DEBUG_SCREENSHOT, false),
    playwrightEnabled: parseBool(process.env.PLAYWRIGHT_ENABLED, true),
    playwrightBrowser: String(process.env.PLAYWRIGHT_BROWSER || 'chromium').toLowerCase(),
    playwrightLaunchTimeoutMs: parseIntSafe(process.env.PLAYWRIGHT_LAUNCH_TIMEOUT_MS, 30000),
    playwrightExtraArgs: String(process.env.PLAYWRIGHT_EXTRA_ARGS || '--no-sandbox,--disable-setuid-sandbox')
      .split(',')
      .map((it) => it.trim())
      .filter(Boolean),
    cacheTtlMs: parseIntSafe(process.env.CONSULTA_PROCESSUAL_CACHE_TTL_MS, 5 * 60 * 1000),
    minIntervalMs: parseIntSafe(process.env.CONSULTA_PROCESSUAL_MIN_INTERVAL_MS, 3000),
  };
}

module.exports = { getConsultaProcessualConfig };
