function parseBool(v, d = false) {
  if (v === undefined || v === null || v === '') return d;
  return ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());
}

function parseIntSafe(v, d) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : d;
}

function parseDebugLevel(v, d = 'minimal') {
  const lvl = String(v || d).toLowerCase();
  return ['minimal', 'detailed'].includes(lvl) ? lvl : d;
}

function getConsultaProcessualConfig() {
  const isProd = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
  return {
    enabled: parseBool(process.env.CONSULTA_PROCESSUAL_ENABLED, true),
    trf1Enabled: parseBool(process.env.CONSULTA_PROCESSUAL_TRF1_ENABLED, true),
    timeoutMs: parseIntSafe(process.env.CONSULTA_PROCESSUAL_TIMEOUT_MS, 45000),
    initialLoadTimeoutMs: parseIntSafe(process.env.CONSULTA_PROCESSUAL_INITIAL_LOAD_TIMEOUT_MS, 30000),
    searchTimeoutMs: parseIntSafe(process.env.CONSULTA_PROCESSUAL_SEARCH_TIMEOUT_MS, 20000),
    debug: parseBool(process.env.CONSULTA_PROCESSUAL_DEBUG, false),
    debugTrf1: parseBool(process.env.CONSULTA_PROCESSUAL_DEBUG_TRF1, false),
    trf1DebugLevel: parseDebugLevel(process.env.CONSULTA_PROCESSUAL_TRF1_DEBUG_LEVEL, 'minimal'),
    headless: parseBool(process.env.CONSULTA_PROCESSUAL_HEADLESS, isProd),
    playwrightEnabled: parseBool(process.env.PLAYWRIGHT_ENABLED, true),
    playwrightBrowser: String(process.env.PLAYWRIGHT_BROWSER || 'chromium').toLowerCase(),
    playwrightLaunchTimeoutMs: parseIntSafe(process.env.PLAYWRIGHT_LAUNCH_TIMEOUT_MS, 30000),
    playwrightExtraArgs: String(process.env.PLAYWRIGHT_EXTRA_ARGS || '--no-sandbox,--disable-setuid-sandbox').split(',').map((it) => it.trim()).filter(Boolean),
    cacheTtlMs: parseIntSafe(process.env.CONSULTA_PROCESSUAL_CACHE_TTL_MS, 5 * 60 * 1000),
    minIntervalMs: parseIntSafe(process.env.CONSULTA_PROCESSUAL_MIN_INTERVAL_MS, 3000),
    institutionalPublicVisible: parseBool(process.env.CONSULTA_PROCESSUAL_INSTITUTIONAL_PUBLIC_VISIBLE, false),
  };
}

module.exports = { getConsultaProcessualConfig };
