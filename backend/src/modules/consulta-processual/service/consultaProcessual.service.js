const pool = require('../../../config/db');
const log = require('../../../utils/log');
const { buildConsultaProviders } = require('../providers');
const { getConsultaProcessualConfig } = require('../utils/consultaProcessualConfig');
const { resolveProviderDebugOptions } = require('../utils/providerDebugPolicy');
const { maskDocument, hashDocument } = require('../utils/consultaProcessualSecurity');
const { sanitizeAndValidateCpf } = require('../validators/cpfValidator');

const cache = new Map();
const inFlight = new Map();
const lastRunByUser = new Map();

// BASELINE ESTÁVEL (congelado): manter contrato do endpoint e semântica dos modos personal/institutional.
// Alterações no provider estável (TRF1) devem preservar retrocompatibilidade do payload canônico.
const SINDICATO_CNPJ = '39387378000125';

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
    const debugLevel = source?.providerMeta?.debugLevel || 'minimal';
    const includeDetailed = debugLevel === 'detailed' || source.status === 'error';
    const steps = source?.debugData?.steps || [];
    const warnings = source?.debugData?.warnings || [];
    const artifacts = source?.debugData?.artifacts || [];

    if (includeDetailed) {
      steps.forEach((step, index) => timeline.push({ type: 'step', source: source.source, index, ...step }));
      warnings.forEach((warning, index) => timeline.push({ type: 'warning', source: source.source, index, ...warning }));
    }

    const minimalMetrics = {
      pageLoaded: Boolean(source?.debugSummary?.pageLoaded),
      documentFieldFound: Boolean(source?.debugSummary?.documentFieldFound),
      searchTriggered: Boolean(source?.debugSummary?.searchTriggered),
      submitSucceeded: Boolean(source?.debugSummary?.submitSucceeded),
      declaredResultsCount: Number(source?.debugSummary?.declaredResultsCount || 0),
      normalizedItemsCount: Number(source?.debugSummary?.normalizedItemsCount || 0),
    };

    const baseReport = {
      source: source.source,
      status: source.status,
      maturity: source?.providerMeta?.maturity || null,
      count: source.count || 0,
      failureStage: source?.debugSummary?.failureStage || null,
      metrics: minimalMetrics,
      debugLevel,
    };

    if (!includeDetailed) return baseReport;

    return {
      ...baseReport,
      metrics: {
        ...minimalMetrics,
        waitConditionMatched: source?.debugSummary?.waitConditionMatched || null,
        realResultLoaded: Boolean(source?.debugSummary?.realResultLoaded),
        resultsContainerFound: Boolean(source?.debugSummary?.resultsContainerFound),
        resultsTextDetected: Boolean(source?.debugSummary?.resultsTextDetected),
        linksFound: Number(source?.debugSummary?.linksFound || 0),
        cnjMatchesFound: Number(source?.debugSummary?.cnjMatchesFound || 0),
        rawBlocksFound: Number(source?.debugSummary?.rawBlocksFound || 0),
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

function deduplicateItems(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (String(item?.source || '').toLowerCase() === 'trf5') return true;
    if (!item.processNumber) return true;
    if (seen.has(item.processNumber)) return false;
    seen.add(item.processNumber);
    return true;
  });
}

function getProviderFlagMeta(providerId) {
  const normalizedId = String(providerId || '').toLowerCase();
  const map = {
    trf1: 'CONSULTA_PROCESSUAL_TRF1_ENABLED',
    trf3: 'CONSULTA_PROCESSUAL_TRF3_ENABLED',
    trf5: 'CONSULTA_PROCESSUAL_TRF5_ENABLED',
    trf6: 'CONSULTA_PROCESSUAL_TRF6_ENABLED',
  };
  return map[normalizedId] || null;
}

function resolveProviderSkipReason({ provider, cfg }) {
  const providerId = provider?.getId?.();
  const maturity = provider?.getMaturityStatus?.() || 'disabled';
  const flagName = getProviderFlagMeta(providerId);
  const flagValue = flagName ? Boolean(cfg?.[`${providerId}Enabled`]) : null;

  if (flagName && flagValue === false) {
    if (maturity === 'experimental') {
      return { skipReason: 'experimental_provider_disabled_by_default', flagName };
    }
    return { skipReason: 'feature_flag_disabled', flagName };
  }

  return { skipReason: 'provider_not_selected', flagName };
}

function compactDebugSummary(debugSummary = {}) {
  return {
    pageLoaded: Boolean(debugSummary.pageLoaded),
    documentFieldFound: Boolean(debugSummary.documentFieldFound),
    searchTriggered: Boolean(debugSummary.searchTriggered),
    submitSucceeded: Boolean(debugSummary.submitSucceeded),
    waitConditionMatched: debugSummary.waitConditionMatched || null,
    declaredResultsCount: Number(debugSummary.declaredResultsCount || 0),
    normalizedItemsCount: Number(debugSummary.normalizedItemsCount || 0),
    failureStage: debugSummary.failureStage || null,
  };
}

async function consultarPorUsuarioLogado({ userId, requestId, debug = false, mode = 'personal' }) {
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

  let documentToUse;
  const isInstitutional = mode === 'institutional';

  if (isInstitutional) {
    documentToUse = SINDICATO_CNPJ;
  } else {
    const cpfValidation = sanitizeAndValidateCpf(user.cpf);
    if (!cpfValidation.ok) {
      return {
        ok: false,
        code: 'USER_CPF_NOT_AVAILABLE',
        message: 'Usuário logado não possui CPF válido cadastrado para consulta processual.',
      };
    }
    documentToUse = cpfValidation.cpf;
  }

  const documentMasked = maskDocument(documentToUse);
  const allProviders = buildConsultaProviders();
  const providers = allProviders.filter((p) => p.isEnabled());
  const disabledProviders = allProviders.filter((p) => !p.isEnabled());

  log.info('ConsultaProcessualStart', {
    requestId,
    userId,
    documentMasked,
    mode,
    providers: allProviders.map((p) => ({ id: p.getId(), enabled: p.isEnabled(), maturity: p.getMaturityStatus?.() || 'experimental' })),
    debug: isDebug,
  });

  const now = Date.now();
  const lastRunKey = `${userId}:${mode}`;
  const lastRun = lastRunByUser.get(lastRunKey);
  const shouldThrottle = !isDebug && Number.isFinite(lastRun) && now - lastRun < cfg.minIntervalMs;

  const sources = [];
  const errors = [];

  disabledProviders.forEach((provider) => {
    const { skipReason, flagName } = resolveProviderSkipReason({ provider, cfg });
    sources.push({
      source: provider.getId(),
      sourceLabel: provider.getLabel(),
      status: 'skipped',
      count: 0,
      items: [],
      providerMeta: {
        maturity: provider.getMaturityStatus?.() || 'disabled',
        enabled: false,
        skipReason,
        flagName,
        debugLevel: 'minimal',
      },
    });
  });

  const providerPromises = providers.map(async (provider) => {
    const providerKey = `consulta_processual:${provider.getId()}:${hashDocument(documentToUse)}`;
    if (!isDebug) {
      const cached = getCacheEntry(providerKey);
      if (cached) {
        const ageSeconds = Math.floor((Date.now() - cached.createdAt) / 1000);
        return { ...cached.value, cached: true, cacheAgeSeconds: ageSeconds };
      }
    }

    if (shouldThrottle) {
      return {
        source: provider.getId(),
        sourceLabel: provider.getLabel(),
        status: 'error',
        count: 0,
        items: [],
        error: { code: 'RATE_LIMITED', message: 'Aguarde alguns segundos para nova consulta.' },
      };
    }

    const runningKey = `${userId}:${mode}:${provider.getId()}${isDebug ? ':debug' : ''}`;
    let runPromise = inFlight.get(runningKey);
    if (!runPromise) {
      const debugOptions = resolveProviderDebugOptions({ provider, cfg, isDebugRequested: isDebug });
      runPromise = provider.consultarPorDocumento({
        document: documentToUse,
        documentMasked,
        requestId,
        userId,
        debug: debugOptions,
      });
      inFlight.set(runningKey, runPromise);
    }

    let sourceResult;
    try {
      sourceResult = await runPromise;
    } finally {
      inFlight.delete(runningKey);
    }

    if (sourceResult?.status === 'success') {
      if (isInstitutional) {
        sourceResult.items = (sourceResult.items || []).map((it) => ({ ...it, institutional: true }));
      }
      setCacheEntry(providerKey, sourceResult, cfg.cacheTtlMs);
    }
    return sourceResult;
  });

  const providerResults = await Promise.all(providerPromises);
  const allItems = providerResults.flatMap((source) => (Array.isArray(source?.items) ? source.items : []));

  lastRunByUser.set(lastRunKey, Date.now());

  providerResults.forEach((sourceResult, index) => {
    const provider = providers[index];
    const maturity = provider?.getMaturityStatus?.() || sourceResult?.providerMeta?.maturity || 'experimental';
    const debugLevel = sourceResult?.providerMeta?.debugLevel || 'minimal';
    const includeDetailedDebug = debugLevel === 'detailed' || sourceResult?.status === 'error';
    const shouldExposeSourceItems = includeDetailedDebug && (maturity !== 'stable' || sourceResult?.status !== 'success');
    const normalizedSource = {
      ...sourceResult,
      items: shouldExposeSourceItems ? (sourceResult?.items || []) : [],
      debugSummary: includeDetailedDebug
        ? sourceResult?.debugSummary
        : compactDebugSummary(sourceResult?.debugSummary),
      debugData: includeDetailedDebug
        ? sourceResult?.debugData
        : null,
      providerMeta: {
        ...(sourceResult?.providerMeta || {}),
        maturity,
        enabled: true,
        debugLevel,
      },
    };
    if (normalizedSource?.error) errors.push({ source: normalizedSource.source, ...normalizedSource.error });
    sources.push(normalizedSource);
  });

  const items = deduplicateItems(allItems);
  const totalItems = items.length;
  const queriedAt = new Date().toISOString();

  log.info('ConsultaProcessualFinish', {
    requestId,
    userId,
    documentMasked,
    mode,
    sources: sources.map((s) => ({ source: s.source, status: s.status, count: s.count || 0, maturity: s?.providerMeta?.maturity || null })),
    totalItems,
  });

  const payload = {
    ok: true,
    queriedAt,
    documentMasked,
    mode,
    items,
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
