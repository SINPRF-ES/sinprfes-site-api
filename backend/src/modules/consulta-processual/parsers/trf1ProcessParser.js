const { normalizeItem } = require('../dto/consultaProcessualDto');

const CNJ_RE = /\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/;
const DATE_TIME_RE = /(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2}:\d{2})/;
const INVALID_PROCESS_NUMBER_RE = /^(resultados? encontrados|processo|última movimentação|data\/hora|classe|partes)$/i;

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function extractCnj(value) {
  const m = cleanText(value).match(CNJ_RE);
  return m ? m[0] : null;
}

function isValidProcessNumber(value) {
  const normalized = cleanText(value);
  if (!normalized) return false;
  if (INVALID_PROCESS_NUMBER_RE.test(normalized.toLowerCase())) return false;
  return Boolean(extractCnj(normalized));
}

function parseBrazilDateToIso(text) {
  const m = String(text || '').match(DATE_TIME_RE);
  if (!m) return null;
  const [_, date, time] = m;
  const [dd, mm, yyyy] = date.split('/').map(Number);
  const [hh, min, ss] = time.split(':').map(Number);
  const dt = new Date(Date.UTC(yyyy, mm - 1, dd, hh, min, ss));
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
}

function parseMovementDescription(text) {
  return cleanText(String(text || '').replace(DATE_TIME_RE, '').replace(/^[()\-–—\s]+/, '').replace(/[()]+$/, ''));
}

function parseTrf1Rows(rows = []) {
  if (!Array.isArray(rows)) return [];

  return rows.map((row = {}) => {
    const processNumber = extractCnj(row.processNumber || row.processTitle || row.rawText || '');
    const movementText = row.rawLastMovementText || row.listLastMovementText || row.lastMovementText || '';
    const movementAtRaw = row.lastMovementAt || row.listLastMovementAt || movementText;
    const movementAtIso = parseBrazilDateToIso(movementAtRaw);

    return normalizeItem({
      source: 'trf1',
      sourceLabel: 'TRF1',
      processNumber,
      processClass: cleanText(row.processClass) || null,
      processTitle: cleanText(row.processTitle) || null,
      subject: cleanText(row.subject) || null,
      parties: cleanText(row.parties) || null,
      lastMovement: cleanText(row.lastMovement) || parseMovementDescription(movementText) || null,
      lastMovementAt: movementAtIso || cleanText(row.lastMovementAt) || null,
      rawLastMovementText: cleanText(movementText) || null,
      listLastMovementText: cleanText(row.listLastMovementText) || null,
      listLastMovementAt: parseBrazilDateToIso(row.listLastMovementAt || row.listLastMovementText || '') || cleanText(row.listLastMovementAt) || null,
      detailsUrl: row.detailsUrl || null,
      providerMeta: row.providerMeta || {},
    });
  }).filter((item) => isValidProcessNumber(item.processNumber));
}

module.exports = { parseTrf1Rows, parseBrazilDateToIso, extractCnj, isValidProcessNumber };
