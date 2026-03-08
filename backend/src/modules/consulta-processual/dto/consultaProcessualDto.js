function normalizeItem(input = {}) {
  return {
    source: input.source || null,
    sourceLabel: input.sourceLabel || null,
    processNumber: input.processNumber || null,
    processClass: input.processClass || null,
    processTitle: input.processTitle || null,
    subject: input.subject || null,
    parties: input.parties || null,
    lastMovement: input.lastMovement || null,
    lastMovementAt: input.lastMovementAt || null,
    rawLastMovementText: input.rawLastMovementText || null,
    listLastMovementText: input.listLastMovementText || null,
    listLastMovementAt: input.listLastMovementAt || null,
    detailsUrl: input.detailsUrl || null,
    providerMeta: input.providerMeta || {},
    institutional: Boolean(input.institutional),
  };
}

function createSourceResult({
  source,
  sourceLabel,
  status = 'success',
  items = [],
  error = null,
  cached = false,
  cacheAgeSeconds = null,
  debugSummary = null,
  debugData = null,
}) {
  const normalizedItems = Array.isArray(items) ? items.map(normalizeItem) : [];
  return {
    source,
    sourceLabel,
    status,
    count: normalizedItems.length,
    items: normalizedItems,
    ...(error ? { error } : {}),
    ...(cached ? { cached: true } : {}),
    ...(Number.isFinite(cacheAgeSeconds) ? { cacheAgeSeconds } : {}),
    ...(debugSummary ? { debugSummary } : {}),
    ...(debugData ? { debugData } : {}),
  };
}

module.exports = { normalizeItem, createSourceResult };
