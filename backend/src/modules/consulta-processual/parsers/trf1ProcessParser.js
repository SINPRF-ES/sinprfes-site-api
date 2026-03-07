const { normalizeItem } = require('../dto/consultaProcessualDto');

const DATE_TIME_RE = /(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2}:\d{2})/;

function parseBrazilDateToIso(text) {
  const m = String(text || '').match(DATE_TIME_RE);
  if (!m) return null;
  const [_, date, time] = m;
  const [dd, mm, yyyy] = date.split('/').map(Number);
  const [hh, min, ss] = time.split(':').map(Number);
  const dt = new Date(Date.UTC(yyyy, mm - 1, dd, hh, min, ss));
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
}

function parseTrf1Rows(rows = []) {
  if (!Array.isArray(rows)) return [];

  return rows.map((row = {}) => {
    const movimentoTexto = row.lastMovementText || row.rawLastMovementText || '';
    const movimentoData = row.lastMovementAt || parseBrazilDateToIso(movimentoTexto);

    return normalizeItem({
      source: 'trf1',
      sourceLabel: 'TRF1',
      processNumber: row.processNumber || null,
      processClass: row.processClass || null,
      subject: row.subject || null,
      parties: row.parties || null,
      lastMovement: row.lastMovement || movimentoTexto || null,
      lastMovementAt: movimentoData,
      rawLastMovementText: movimentoTexto || null,
      detailsUrl: row.detailsUrl || null,
      providerMeta: row.providerMeta || {},
    });
  });
}

module.exports = { parseTrf1Rows, parseBrazilDateToIso };
