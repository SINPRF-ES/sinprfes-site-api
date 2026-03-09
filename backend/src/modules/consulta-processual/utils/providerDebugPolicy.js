const DEBUG_LEVELS = {
  MINIMAL: 'minimal',
  DETAILED: 'detailed',
};

function getDefaultDebugLevel(provider) {
  const providerId = String(provider?.getId?.() || '').toLowerCase();
  const maturity = String(provider?.getMaturityStatus?.() || '').toLowerCase();

  if (providerId === 'trf5') return DEBUG_LEVELS.DETAILED;
  if (maturity === 'stable' || maturity === 'disabled') return DEBUG_LEVELS.MINIMAL;
  return DEBUG_LEVELS.MINIMAL;
}

function getDebugOverrideForProvider(providerId, cfg) {
  const normalizedId = String(providerId || '').toLowerCase();
  const keyMap = {
    trf1: 'debugTrf1',
    trf3: 'debugTrf3',
    trf5: 'debugTrf5',
    trf6: 'debugTrf6',
  };
  const configKey = keyMap[normalizedId];
  if (!configKey) return null;
  const value = cfg?.[configKey];
  return typeof value === 'boolean' ? value : null;
}

function resolveProviderDebugOptions({ provider, cfg, isDebugRequested }) {
  const providerId = String(provider?.getId?.() || '').toLowerCase();
  const verbose = Boolean(cfg?.debugVerbose);
  const override = getDebugOverrideForProvider(providerId, cfg);

  if (verbose) {
    return {
      enabled: true,
      level: DEBUG_LEVELS.DETAILED,
      includeArtifacts: true,
      includeDomInspection: true,
      includeSteps: true,
      includeWarnings: true,
      forceByFlag: true,
      verbose: true,
    };
  }

  const defaultLevel = getDefaultDebugLevel(provider);
  const resolvedDetailed = override !== null ? override : defaultLevel === DEBUG_LEVELS.DETAILED;
  const enabled = Boolean(isDebugRequested) && (resolvedDetailed || defaultLevel === DEBUG_LEVELS.MINIMAL || override === false);

  return {
    enabled,
    level: resolvedDetailed ? DEBUG_LEVELS.DETAILED : DEBUG_LEVELS.MINIMAL,
    includeArtifacts: resolvedDetailed,
    includeDomInspection: resolvedDetailed,
    includeSteps: resolvedDetailed,
    includeWarnings: resolvedDetailed,
    forceByFlag: override !== null,
    verbose: false,
  };
}

module.exports = {
  DEBUG_LEVELS,
  resolveProviderDebugOptions,
};
