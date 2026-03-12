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
const FENAPRF_CNPJ = '03658044000100';
const FENAPRF_NOME = 'FEDERACAO NACIONAL DOS POLICIAIS RODOVIARIOS FEDERAIS';
const SINDICATO_NOME = 'SIND.DOS POL.ROD.FEDERAIS NO EST.DO ESP.SANTO';

function onlyDigits(v) {
  return String(v || '').replace(/\D/g, '');
}

function formatDocument(v) {
  const d = onlyDigits(v);
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return String(v || '');
}

function buildSearchTargets({ userCpf, mode }) {
  if (mode === 'institutional') {
    return [{ kind: 'document', value: SINDICATO_CNPJ }];
  }

  if (mode === 'federation') {
    return [
      { kind: 'document', value: FENAPRF_CNPJ },
      {
        kind: 'name',
        value: FENAPRF_NOME,
        relatedNames: [SINDICATO_NOME],
      },
    ];
  }

  return [{ kind: 'document', value: userCpf }];
}

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

function buildDebugReport(source = {}) {
  const debugData = source?.debugData || {};
  const steps = Array.isArray(debugData.steps) ? debugData.steps : [];
  const warnings = Array.isArray(debugData.warnings) ? debugData.warnings : [];
  const timeline = [
    ...steps.map((step) => ({
      type: 'step',
      source: source.source || 'trf1',
      step: step.stage || null,
      reason: step.reason || null,
    })),
    ...warnings.map((warning) => ({
      type: 'warning',
      source: source.source || 'trf1',
      step: warning.code || null,
      reason: warning.message || null,
    })),
  ].slice(0, 220);

  const metrics = {
    declaredResultsCount: Number(source?.debugSummary?.declaredResultsCount || 0),
    normalizedItemsCount: Number(source?.debugSummary?.normalizedItemsCount || 0),
    linksFound: Number(debugData?.afterSubmitSignals?.linksFound || 0),
    cnjMatchesFound: Number(debugData?.afterSubmitSignals?.cnjMatchesFound || 0),
    rawBlocksFound: Number(steps.find((s) => s.stage === 'F_parse_raw_end')?.rawBlocksFound || 0),
    detailPagesOpened: Number(steps.filter((s) => s.stage === 'H_open_detail_result').length || 0),
  };

  return {
    likelyFailureStage: source?.debugSummary?.failureStage || null,
    sourceReports: [{
      source: source.source || 'trf1',
      status: source.status || 'unknown',
      failureStage: source?.debugSummary?.failureStage || null,
      metrics,
      discardReasons: {},
      artifactsCount: Array.isArray(debugData.artifacts) ? debugData.artifacts.length : 0,
    }],
    timeline,
    export: {
      jsonFileName: `consulta-processual-debug-${Date.now()}.json`,
    },
  };
}

async function consultarPorUsuarioLogado({ userId, requestId, debug = false, mode = 'personal' }) {
  const cfg = getConsultaProcessualConfig();
  if (!cfg.enabled) return { ok: false, code: 'CONSULTA_PROCESSUAL_DISABLED', message: 'Módulo de consulta processual desabilitado.' };

  const user = await obterUsuarioPorId(userId);
  if (!user) return { ok: false, code: 'USER_NOT_FOUND', message: 'Usuário não encontrado.' };

  const isInstitutional = mode === 'institutional';
  const isFederation = mode === 'federation';
  const cpfValidation = sanitizeAndValidateCpf(user.cpf);
  if (!cpfValidation.ok && mode === 'personal') {
    return { ok: false, code: 'USER_CPF_NOT_AVAILABLE', message: 'Usuário logado não possui CPF válido cadastrado para consulta processual.' };
  }

  const searchTargets = buildSearchTargets({ userCpf: cpfValidation.cpf, mode });
  const primaryTarget = searchTargets[0];

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
    const cacheKeyPart = primaryTarget.kind === 'document'
      ? hashDocument(primaryTarget.value)
      : `name:${String(primaryTarget.value || '').toUpperCase()}`;
    const providerKey = `consulta_processual:trf1:${mode}:${cacheKeyPart}`;
    const cached = !isDebug && getCacheEntry(providerKey);
    if (cached) {
      source = { ...cached.value, cached: true, cacheAgeSeconds: Math.floor((Date.now() - cached.createdAt) / 1000) };
    } else {
      const runningKey = `${userId}:${mode}:trf1:${isDebug ? 'debug' : 'normal'}`;
      let promise = inFlight.get(runningKey);
      if (!promise) {
        promise = provider.consultarPorDocumento({
          document: primaryTarget.kind === 'document' ? primaryTarget.value : null,
          partyName: primaryTarget.kind === 'name' ? primaryTarget.value : null,
          extraPartyNames: primaryTarget.relatedNames || [],
          searchKind: primaryTarget.kind,
          documentMasked: primaryTarget.kind === 'document' ? maskDocument(primaryTarget.value) : null,
          requestId,
          userId,
          debug: { enabled: isDebug, level: trf1DebugLevel },
        });
        inFlight.set(runningKey, promise);
      }
      try {
        source = await promise;
        if (isFederation && primaryTarget.kind === 'document' && Number(source?.count || 0) === 0) {
          const fallbackTarget = searchTargets.find((target) => target.kind === 'name');
          if (fallbackTarget) {
            source = await provider.consultarPorDocumento({
              document: null,
              partyName: fallbackTarget.value,
              extraPartyNames: fallbackTarget.relatedNames || [],
              searchKind: fallbackTarget.kind,
              documentMasked: null,
              requestId,
              userId,
              debug: { enabled: isDebug, level: trf1DebugLevel },
            });
          }
        }
        if (source?.status === 'success') setCacheEntry(providerKey, source, cfg.cacheTtlMs);
      } finally {
        inFlight.delete(runningKey);
      }
    }
  }

  lastRunByUser.set(lastRunKey, Date.now());

  const items = (source?.items || []).map((it) => (isInstitutional ? { ...it, institutional: true } : it));
  const queriedAt = new Date().toISOString();
  const visibleDocument = primaryTarget.kind === 'document' ? formatDocument(primaryTarget.value) : primaryTarget.value;
  const payload = {
    ok: true,
    queriedAt,
    documentMasked: visibleDocument,
    document: visibleDocument,
    mode,
    items,
    sources: [{
      source: source?.source || 'trf1',
      sourceLabel: source?.sourceLabel || 'TRF1',
      status: source?.status || 'error',
      count: Number(source?.count || 0),
      cached: Boolean(source?.cached),
      cacheAgeSeconds: Number.isFinite(source?.cacheAgeSeconds) ? source.cacheAgeSeconds : null,
      error: source?.error || null,
      debugSummary: compactDebugSummary(source?.debugSummary || {}),
      items: [],
    }],
    totalItems: items.length,
    errors: source?.error ? [{ source: 'trf1', ...source.error }] : [],
    ...(isDebug ? { debugReport: buildDebugReport(source) } : {}),
  };

  log.info('ConsultaProcessualFinish', { requestId, userId, mode, source: source?.status, count: items.length, failureStage: source?.debugSummary?.failureStage || null });
  return payload;
}

module.exports = { consultarPorUsuarioLogado, __testables: { getCacheEntry, setCacheEntry, cache, inFlight, lastRunByUser } };
