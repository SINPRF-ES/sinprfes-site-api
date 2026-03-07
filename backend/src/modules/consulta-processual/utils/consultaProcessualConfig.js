function parseBool(v, d = false) {
  if (v === undefined || v === null || v === '') return d;
  return ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());
}

function parseIntSafe(v, d) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : d;
}

function getConsultaProcessualConfig() {
  return {
    enabled: parseBool(process.env.CONSULTA_PROCESSUAL_ENABLED, true),
    trf1Enabled: parseBool(process.env.CONSULTA_PROCESSUAL_TRF1_ENABLED, true),
    timeoutMs: parseIntSafe(process.env.CONSULTA_PROCESSUAL_TIMEOUT_MS, 45000),
    initialLoadTimeoutMs: parseIntSafe(process.env.CONSULTA_PROCESSUAL_INITIAL_LOAD_TIMEOUT_MS, 30000),
    searchTimeoutMs: parseIntSafe(process.env.CONSULTA_PROCESSUAL_SEARCH_TIMEOUT_MS, 15000),
    debug: parseBool(process.env.CONSULTA_PROCESSUAL_DEBUG, false),
    headless: parseBool(process.env.CONSULTA_PROCESSUAL_HEADLESS, true),
    debugScreenshot: parseBool(process.env.CONSULTA_PROCESSUAL_DEBUG_SCREENSHOT, false),
    cacheTtlMs: parseIntSafe(process.env.CONSULTA_PROCESSUAL_CACHE_TTL_MS, 5 * 60 * 1000),
    minIntervalMs: parseIntSafe(process.env.CONSULTA_PROCESSUAL_MIN_INTERVAL_MS, 3000),
  };
}

module.exports = { getConsultaProcessualConfig };
