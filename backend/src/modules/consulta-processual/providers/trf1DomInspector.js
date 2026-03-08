const CNJ_REGEX = /\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/g;
const DECLARED_RESULTS_REGEX = /(\d+)\s+resultados? encontrados/i;

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function summarizeText(value, max = 180) {
  const clean = cleanText(value);
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max)}...`;
}

function inspectResultsDom(payload = {}) {
  const panelText = cleanText(payload.panelText);
  const blocks = Array.isArray(payload.rawRows) ? payload.rawRows : [];
  const declaredResultsMatch = panelText.match(DECLARED_RESULTS_REGEX);
  const cnjMatches = panelText.match(CNJ_REGEX) || [];
  const linksFound = Array.isArray(payload.detectedLinks) ? new Set(payload.detectedLinks).size : Number(payload.linksFound || 0);

  return {
    hasGridPanel: Boolean(payload.hasGridPanel),
    hasGridPanelBody: Boolean(payload.hasGridPanelBody),
    hasProcessTable: Boolean(payload.hasProcessTable),
    zeroResultsDetected: /\b0\s+resultados? encontrados\b/i.test(panelText),
    declaredResultsTextDetected: Boolean(declaredResultsMatch),
    declaredResultsCount: Number(declaredResultsMatch?.[1] || 0),
    linksFound,
    cnjMatchesFound: cnjMatches.length,
    blocksFound: blocks.length,
    blockSummaries: blocks.map((row, index) => ({
      index,
      ignored: Boolean(row.ignored),
      reason: row.reason || null,
      hasCnj: Boolean(row.processNumber),
      hasHref: Boolean(row.detailsUrl),
      hasClass: Boolean(cleanText(row.processClass)),
      hasParties: Boolean(cleanText(row.parties)),
      snippet: summarizeText(row.rawText || row.text || ''),
    })),
    panelTextSummary: summarizeText(panelText, 500),
  };
}

module.exports = {
  inspectResultsDom,
  cleanText,
  summarizeText,
  CNJ_REGEX,
  DECLARED_RESULTS_REGEX,
};
