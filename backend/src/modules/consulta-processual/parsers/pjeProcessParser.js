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
  const withoutDate = cleanText(String(text || '').replace(DATE_TIME_RE, '').replace(/^[()\-–—\s]+/, '').replace(/[()]+$/, ''));
  const cutByMarkers = withoutDate.split(/\s+(?:Documentos?|Pagin[aá]ç[aã]o|JavaScript|Assinado\s+digitalmente|Ver\s+todos|Dados\s+do\s+processo)\b/i)[0];
  return cleanText(cutByMarkers);
}

function normalizeProcessClass(value) {
  const normalized = cleanText(value);
  if (!normalized) return null;
  const withoutTrailingCode = normalized.replace(/\s*\(\d{4,}\)\s*$/, '');
  return cleanText(withoutTrailingCode.replace(/\s+[A-Za-z][A-Za-z0-9]{2,15}$/, '')) || normalized;
}

function createPjeParser(source, sourceLabel) {
  return (rows = [], onDiscard = null) => {
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

        const rawMovementText = row.rawLastMovementText || row.listLastMovementText || '';

        const movementAtIso =
          parseBrazilDateToIso(rawMovementText) ||
          parseBrazilDateToIso(row.lastMovementAt) ||
          parseBrazilDateToIso(row.listLastMovementAt);

        let lastMovement = cleanText(row.lastMovement);
        if (!lastMovement || lastMovement === 'null') {
          lastMovement = parseMovementDescription(rawMovementText);
        }

        return normalizeItem({
          source,
          sourceLabel,
          processNumber,
          processClass: normalizeProcessClass(row.processClass),
          processTitle: cleanText(row.processTitle) || null,
          subject: cleanText(row.subject) || null,
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
  };
}



function parseTrf1RowsFromHtml(html, baseUrl = 'https://pje1g-consultapublica.trf1.jus.br') {
  const trMatches = String(html || '').match(/<tr[\s\S]*?<\/tr>/gi) || [];
  const rows = trMatches.map((tr) => {
    const cleanHtml = String(tr).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const title = (tr.match(/<a[^>]*>([\s\S]*?)<\/a>/i) || [])[1]?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || null;
    const href = (tr.match(/<a[^>]*href=["']([^"']+)["']/i) || [])[1] || null;
    const processClass = (cleanHtml.match(/Classe:\s*([^]+?)\s+(?:CumSen|Partes:|Última movimentação:)/i) || [])[1]?.trim() || (cleanHtml.match(/Classe:\s*([^]+?)\s+Partes:/i) || [])[1]?.trim() || null;
    const listLastMovementText = (cleanHtml.match(/Última movimentação:\s*([^]+)$/i) || [])[1]?.trim() || null;
    return {
      processTitle: title,
      processClass,
      listLastMovementText,
      rawLastMovementText: listLastMovementText ? listLastMovementText.replace(/^(.*)\((\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})\)$/, '$2 - $1').trim() : null,
      detailsUrl: href ? new URL(href, baseUrl).href : null,
      rawText: cleanHtml,
    };
  });
  return createPjeParser('trf1', 'TRF1')(rows);
}

module.exports = { createPjeParser, parseBrazilDateToIso, extractCnj, isValidProcessNumber, parseTrf1RowsFromHtml };
