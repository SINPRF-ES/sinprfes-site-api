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

function parseTrf1Rows(rows = [], onDiscard = null) {
  if (!Array.isArray(rows)) return [];

  return rows
    .map((row = {}) => {
      const processNumber = extractCnj(row.processNumber || row.processTitle || row.rawText || '');
      const rawSnippet = cleanText(row.rawText || row.text || '').substring(0, 160);

      const rowDetailsUrl = cleanText(row.detailsUrl);
      if (!rawSnippet && !processNumber && !rowDetailsUrl) {
        if (typeof onDiscard === 'function') {
          onDiscard({ reason: 'empty_block', rawSnippet, index: row.index });
        }
        return null;
      }

      if (/\bresultados? encontrados\b/i.test(rawSnippet) && !processNumber) {
        if (typeof onDiscard === 'function') {
          onDiscard({ reason: 'structural_text_misidentified_as_item', rawSnippet, index: row.index });
        }
        return null;
      }

      if (!processNumber) {
        if (typeof onDiscard === 'function') {
          onDiscard({
            reason: 'missing_process_number',
            rawSnippet,
            index: row.index,
          });
        }
        return null;
      }

      if (!isValidProcessNumber(processNumber)) {
        if (typeof onDiscard === 'function') {
          onDiscard({
            reason: 'invalid_process_number',
            processNumber,
            rawSnippet,
            index: row.index,
          });
        }
        return null;
      }

      const detailsUrl = rowDetailsUrl;
      if (!detailsUrl) {
        if (typeof onDiscard === 'function') {
          onDiscard({ reason: 'missing_href', processNumber, rawSnippet, index: row.index });
        }
        return null;
      }

      // O provider agora já traz o rawLastMovementText preferencialmente do detalhe
      const rawMovementText = row.rawLastMovementText || row.listLastMovementText || '';

      // A data/hora ISO deve vir da string de movimentação (detalhe ou lista)
      const movementAtIso =
        parseBrazilDateToIso(rawMovementText) ||
        parseBrazilDateToIso(row.lastMovementAt) ||
        parseBrazilDateToIso(row.listLastMovementAt);

      // A descrição da movimentação (lastMovement)
      // Se o provider já limpou (lastMovement), usamos ele, senão tentamos limpar do raw
      let lastMovement = cleanText(row.lastMovement);
      if (!lastMovement || lastMovement === 'null') {
        lastMovement = parseMovementDescription(rawMovementText);
      }

      return normalizeItem({
        source: 'trf1',
        sourceLabel: 'TRF1',
        processNumber,
        processClass: cleanText(row.processClass) || null,
        processTitle: cleanText(row.processTitle) || null,
        subject: cleanText(row.subject) || null,
        parties: cleanText(row.parties) || null,
        lastMovement: lastMovement || null,
        lastMovementAt: movementAtIso || null,
        rawLastMovementText: cleanText(rawMovementText) || null,
        listLastMovementText: cleanText(row.listLastMovementText) || null,
        listLastMovementAt:
          parseBrazilDateToIso(row.listLastMovementAt || row.listLastMovementText || '') || null,
        detailsUrl: detailsUrl || null,
        providerMeta: row.providerMeta || {},
      });
    })
    .filter(Boolean);
}

module.exports = { parseTrf1Rows, parseBrazilDateToIso, extractCnj, isValidProcessNumber };
