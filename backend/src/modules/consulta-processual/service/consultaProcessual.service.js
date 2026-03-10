const pool = require('../../../config/db');
const log = require('../../../utils/log');
const { buildConsultaProviders } = require('../providers');
const { getConsultaProcessualConfig } = require('../utils/consultaProcessualConfig');
const { maskDocument, hashDocument } = require('../utils/consultaProcessualSecurity');
const { sanitizeAndValidateCpf } = require('../validators/cpfValidator');

const cache = new Map();
const inFlight = new Map();
const lastRunByUser = new Map();
const SINDICATO_CNPJ = '39387378000125';

function getCacheEntry(key) {
  const item = cache.get(key);
  if (!item || Date.now() > item.expiresAt) return null;
  return item;
}

function setCacheEntry(key, value, ttlMs) {
  cache.set(key, { value, createdAt: Date.now(), expiresAt: Date.now() + ttlMs });
}

async function obterUsuarioPorId(id) {
  const { rows } = await pool.query('SELECT id, nome, cpf, perfil_acesso FROM filiados WHERE id = $1 LIMIT 1', [id]);
  return rows[0] || null;
}

function compactDebugSummary(debugSummary = {}) {
  return {
    pageLoaded: Boolean(debugSummary.pageLoaded),
    documentFieldFound: Boolean(debugSummary.documentFieldFound),
    searchTriggered: Boolean(debugSummary.searchTriggered),
    submitSucceeded: Boolean(debugSummary.submitSucceeded),
    waitConditionMatched: debugSummary.waitConditionMatched === null || debugSummary.waitConditionMatched === undefined ? null : Boolean(debugSummary.waitConditionMatched),
    declaredResultsCount: Number(debugSummary.declaredResultsCount || 0),
    normalizedItemsCount: Number(debugSummary.normalizedItemsCount || 0),
    failureStage: debugSummary.failureStage || null,
  };
}

async function consultarPorUsuarioLogado({ userId, requestId, debug = false, mode = 'personal' }) {
  const cfg = getConsultaProcessualConfig();
  if (!cfg.enabled) return { ok: false, code: 'CONSULTA_PROCESSUAL_DISABLED', message: 'Módulo de consulta processual desabilitado.' };

  const user = await obterUsuarioPorId(userId);
  if (!user) return { ok: false, code: 'USER_NOT_FOUND', message: 'Usuário não encontrado.' };

  const isInstitutional = mode === 'institutional';
  let documentToUse = SINDICATO_CNPJ;
  if (!isInstitutional) {
    const cpfValidation = sanitizeAndValidateCpf(user.cpf);
    if (!cpfValidation.ok) return { ok: false, code: 'USER_CPF_NOT_AVAILABLE', message: 'Usuário logado não possui CPF válido cadastrado para consulta processual.' };
    documentToUse = cpfValidation.cpf;
  }

  const provider = buildConsultaProviders()[0];
  const isDebug = Boolean(debug || cfg.debug || cfg.debugTrf1);
  const trf1DebugLevel = isDebug ? ((debug === true || debug?.level === 'detailed') ? 'detailed' : cfg.trf1DebugLevel || 'minimal') : 'minimal';
  const now = Date.now();
  const lastRunKey = `${userId}:${mode}`;
  const shouldThrottle = !isDebug && Number.isFinite(lastRunByUser.get(lastRunKey)) && now - lastRunByUser.get(lastRunKey) < cfg.minIntervalMs;

  let source;
  if (!provider || !provider.isEnabled()) {
    source = { source: 'trf1', sourceLabel: 'TRF1', status: 'error', count: 0, items: [], error: { code: 'TRF1_DISABLED', message: 'Provider TRF1 desabilitado.' } };
  } else if (shouldThrottle) {
    source = { source: 'trf1', sourceLabel: 'TRF1', status: 'error', count: 0, items: [], error: { code: 'RATE_LIMITED', message: 'Aguarde alguns segundos para nova consulta.' } };
  } else {
    const providerKey = `consulta_processual:trf1:${hashDocument(documentToUse)}`;
    const cached = !isDebug && getCacheEntry(providerKey);
    if (cached) {
      source = { ...cached.value, cached: true, cacheAgeSeconds: Math.floor((Date.now() - cached.createdAt) / 1000) };
    } else {
      const runningKey = `${userId}:${mode}:trf1:${isDebug ? 'debug' : 'normal'}`;
      let promise = inFlight.get(runningKey);
      if (!promise) {
        promise = provider.consultarPorDocumento({ document: documentToUse, documentMasked: maskDocument(documentToUse), requestId, userId, debug: { enabled: isDebug, level: trf1DebugLevel } });
        inFlight.set(runningKey, promise);
      }
      try {
        source = await promise;
        if (source?.status === 'success') setCacheEntry(providerKey, source, cfg.cacheTtlMs);
      } finally {
        inFlight.delete(runningKey);
      }
    }
  }

  lastRunByUser.set(lastRunKey, Date.now());

  const items = (source?.items || []).map((it) => (isInstitutional ? { ...it, institutional: true } : it));
  const queriedAt = new Date().toISOString();
  const payload = {
    ok: true,
    queriedAt,
    documentMasked: maskDocument(documentToUse),
    mode,
    items,
    sources: [{ ...source, items: [] , debugSummary: compactDebugSummary(source?.debugSummary || {}) }],
    totalItems: items.length,
    errors: source?.error ? [{ source: 'trf1', ...source.error }] : [],
  };

  log.info('ConsultaProcessualFinish', { requestId, userId, mode, source: source?.status, count: items.length, failureStage: source?.debugSummary?.failureStage || null });
  return payload;
}

module.exports = { consultarPorUsuarioLogado, __testables: { getCacheEntry, setCacheEntry, cache, inFlight, lastRunByUser } };
