const pool = require('../../../config/db');
const log = require('../../../utils/log');
const { buildConsultaProviders } = require('../providers');
const { getConsultaProcessualConfig } = require('../utils/consultaProcessualConfig');
const { maskCpf, hashCpf } = require('../utils/consultaProcessualSecurity');
const { sanitizeAndValidateCpf } = require('../validators/cpfValidator');

const cache = new Map();
const inFlight = new Map();
const lastRunByUser = new Map();

function getCacheEntry(key) {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    cache.delete(key);
    return null;
  }
  return item;
}

function setCacheEntry(key, value, ttlMs) {
  cache.set(key, { value, createdAt: Date.now(), expiresAt: Date.now() + ttlMs });
}

function buildDebugReport({ sources = [], requestId, queriedAt }) {
  const timeline = [];
  const sourceReports = (sources || []).map((source) => {
    const steps = source?.debugData?.steps || [];
    const warnings = source?.debugData?.warnings || [];
    const artifacts = source?.debugData?.artifacts || [];

    steps.forEach((step, index) => timeline.push({ type: 'step', source: source.source, index, ...step }));
    warnings.forEach((warning, index) => timeline.push({ type: 'warning', source: source.source, index, ...warning }));

    return {
      source: source.source,
      status: source.status,
      count: source.count || 0,
      failureStage: source?.debugSummary?.failureStage || null,
      metrics: {
        pageLoaded: Boolean(source?.debugSummary?.pageLoaded),
        cpfFieldFound: Boolean(source?.debugSummary?.cpfFieldFound),
        inputDigitsCount: Number(source?.debugSummary?.inputDigitsCount || 0),
        inputValueMasked: source?.debugSummary?.inputValueMasked || null,
        searchTriggered: Boolean(source?.debugSummary?.searchTriggered),
        submitSucceeded: Boolean(source?.debugSummary?.submitSucceeded),
        waitConditionMatched: source?.debugSummary?.waitConditionMatched || null,
        realResultLoaded: Boolean(source?.debugSummary?.realResultLoaded),
        resultsContainerFound: Boolean(source?.debugSummary?.resultsContainerFound),
        resultsTextDetected: Boolean(source?.debugSummary?.resultsTextDetected),
        declaredResultsCount: Number(source?.debugSummary?.declaredResultsCount || 0),
        linksFound: Number(source?.debugSummary?.linksFound || 0),
        cnjMatchesFound: Number(source?.debugSummary?.cnjMatchesFound || 0),
        rawBlocksFound: Number(source?.debugSummary?.rawBlocksFound || 0),
        normalizedItemsCount: Number(source?.debugSummary?.normalizedItemsCount || 0),
        detailPagesOpened: Number(source?.debugSummary?.detailPagesOpened || 0),
      },
      domInspection: source?.debugData?.domInspection || null,
      discardReasons: source?.debugData?.discardReasons || {},
      warningsCount: warnings.length,
      artifactsCount: artifacts.length,
      artifacts,
    };
  });

  timeline.sort((a, b) => String(a.timestamp || '').localeCompare(String(b.timestamp || '')));

  const firstFailure = sourceReports.find((s) => s.failureStage)?.failureStage || null;
  const likelyFailureStage =
    firstFailure
    || (sourceReports.some((s) => s.metrics.searchTriggered && !s.metrics.resultsContainerFound) ? 'results_dom' : null)
    || (sourceReports.some((s) => s.metrics.rawBlocksFound > 0 && s.metrics.normalizedItemsCount === 0) ? 'normalization' : null)
    || null;

  return {
    requestId,
    queriedAt,
    timeline,
    sourceReports,
    likelyFailureStage,
    export: {
      jsonFileName: `consulta-processual-debug-${requestId || Date.now()}.json`,
    },
  };
}

async function obterUsuarioPorId(id) {
  const { rows } = await pool.query(
    'SELECT id, nome, cpf, perfil_acesso FROM filiados WHERE id = $1 LIMIT 1',
    [id]
  );
  return rows[0] || null;
}

async function consultarPorUsuarioLogado({ userId, requestId, debug = false }) {
  const cfg = getConsultaProcessualConfig();
  const isDebug = debug || cfg.debug;

  if (!cfg.enabled) {
    return {
      ok: false,
      code: 'CONSULTA_PROCESSUAL_DISABLED',
      message: 'Módulo de consulta processual desabilitado.',
    };
  }

  const user = await obterUsuarioPorId(userId);
  if (!user) {
    return { ok: false, code: 'USER_NOT_FOUND', message: 'Usuário não encontrado.' };
  }

  const cpfValidation = sanitizeAndValidateCpf(user.cpf);
  if (!cpfValidation.ok) {
    return {
      ok: false,
      code: 'USER_CPF_NOT_AVAILABLE',
      message: 'Usuário logado não possui CPF válido cadastrado para consulta processual.',
    };
  }

  const cpf = cpfValidation.cpf;
  const cpfMasked = maskCpf(cpf);
  const providers = buildConsultaProviders().filter((p) => p.isEnabled());

  log.info('ConsultaProcessualStart', {
    requestId,
    userId,
    cpfMasked,
    providers: providers.map((p) => p.getId()),
    debug: isDebug,
  });

  const now = Date.now();
  const lastRun = lastRunByUser.get(userId);
  const shouldThrottle = !isDebug && Number.isFinite(lastRun) && now - lastRun < cfg.minIntervalMs;

  const sources = [];
  const errors = [];

  for (const provider of providers) {
    const providerKey = `consulta_processual:${provider.getId()}:${hashCpf(cpf)}`;
    if (!isDebug) {
      const cached = getCacheEntry(providerKey);
      if (cached) {
        const ageSeconds = Math.floor((Date.now() - cached.createdAt) / 1000);
        sources.push({ ...cached.value, cached: true, cacheAgeSeconds: ageSeconds });
        continue;
      }
    }

    if (shouldThrottle) {
      sources.push({
        source: provider.getId(),
        sourceLabel: provider.getLabel(),
        status: 'error',
        count: 0,
        items: [],
        error: { code: 'RATE_LIMITED', message: 'Aguarde alguns segundos para nova consulta.' },
      });
      continue;
    }

    const runningKey = `${userId}:${provider.getId()}${isDebug ? ':debug' : ''}`;
    let runPromise = inFlight.get(runningKey);
    if (!runPromise) {
      runPromise = provider.consultarPorCpf({ cpf, cpfMasked, requestId, userId, debug: isDebug });
      inFlight.set(runningKey, runPromise);
    }

    let sourceResult;
    try {
      sourceResult = await runPromise;
    } finally {
      inFlight.delete(runningKey);
    }

    if (sourceResult?.status === 'success') {
      setCacheEntry(providerKey, sourceResult, cfg.cacheTtlMs);
    }
    if (sourceResult?.error) errors.push({ source: provider.getId(), ...sourceResult.error });

    sources.push(sourceResult);
  }

  lastRunByUser.set(userId, Date.now());

  const totalItems = sources.reduce((sum, s) => sum + (Array.isArray(s.items) ? s.items.length : 0), 0);
  const queriedAt = new Date().toISOString();

  log.info('ConsultaProcessualFinish', {
    requestId,
    userId,
    cpfMasked,
    sources: sources.map((s) => ({ source: s.source, status: s.status, count: s.count || 0 })),
    totalItems,
  });

  const payload = {
    ok: true,
    queriedAt,
    cpfMasked,
    sources,
    totalItems,
    errors,
  };

  if (isDebug) {
    payload.debugReport = buildDebugReport({ sources, requestId, queriedAt });
  }

  return payload;
}

module.exports = {
  consultarPorUsuarioLogado,
  __testables: { getCacheEntry, setCacheEntry, cache, inFlight, lastRunByUser, buildDebugReport },
};
