const fs = require('fs');
const path = require('path');
const ConsultaProcessualProvider = require('./ConsultaProcessualProvider');
const { getConsultaProcessualConfig } = require('../utils/consultaProcessualConfig');
const { parseTrf1Rows } = require('../parsers/trf1ProcessParser');
const { createSourceResult } = require('../dto/consultaProcessualDto');
const { launchBrowser } = require('../service/playwrightBrowserService');
const log = require('../../../utils/log');

const TRF1_URL = 'https://pje1g-consultapublica.trf1.jus.br/consultapublica/ConsultaPublica/listView.seam';

function saveDebugTextFile(filePath, content) {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, String(content || ''), 'utf8');
  } catch (err) {
    log.warn('ConsultaProcessualProviderDebugWriteFailed', {
      event: 'ConsultaProcessualProviderDebugWriteFailed',
      source: 'trf1',
      filePath,
      errorMessage: err.message,
    });
  }
}


function buildRawItemsFromExtraction(extraction = {}) {
  const rawById = Array.isArray(extraction.rawById) ? extraction.rawById : [];
  return rawById.map((entry = {}, index) => ({
    source: 'trf1',
    sourceLabel: 'TRF1',
    processNumber: `RAW:${entry.id || index}`,
    processClass: entry.tagName ? `RAW_${entry.tagName}` : 'RAW',
    subject: null,
    parties: null,
    lastMovement: entry.text || null,
    lastMovementAt: null,
    rawLastMovementText: entry.text || null,
    detailsUrl: null,
    providerMeta: {
      rawId: entry.id || null,
      rawTagName: entry.tagName || null,
      rawHtml: entry.html || null,
      rawText: entry.text || null,
      rawSource: 'trf1-dom',
      rawIndex: index,
    },
  }));
}

class Trf1PublicaProvider extends ConsultaProcessualProvider {
  getId() { return 'trf1'; }
  getLabel() { return 'TRF1'; }
  isEnabled() { return getConsultaProcessualConfig().trf1Enabled; }

  async consultarPorCpf({ cpf, cpfMasked, requestId, userId }) {
    const startedAt = Date.now();
    const cfg = getConsultaProcessualConfig();

    if (!this.isEnabled()) {
      return createSourceResult({ source: this.getId(), sourceLabel: this.getLabel(), status: 'skipped', items: [] });
    }

    let browser;
    try {
      const browserResult = await launchBrowser({ config: cfg });
      if (!browserResult.ok) {
        log.info('ConsultaProcessualProviderSkipped', {
          event: 'ConsultaProcessualProviderSkipped',
          requestId,
          userId,
          source: this.getId(),
          cpfMasked,
          reasonCode: browserResult.reasonCode,
          reason: browserResult.reason,
          ...(browserResult.errorMessage ? { errorMessage: browserResult.errorMessage } : {}),
          ...(browserResult.missingLibrary ? { missingLibrary: browserResult.missingLibrary } : {}),
          durationMs: Date.now() - startedAt,
        });

        return createSourceResult({ source: this.getId(), sourceLabel: this.getLabel(), status: 'skipped', items: [] });
      }

      browser = browserResult.browser;
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto(TRF1_URL, { waitUntil: 'domcontentloaded', timeout: cfg.initialLoadTimeoutMs });
      await page.locator('input[name="tipoMascaraDocumento"]').first().check();
      await page.locator('#fPP\\:dpDec\\:documentoParte').fill(cpf);
      await page.locator('#fPP\\:searchProcessos').click();

      const grid = page.locator('#fPP\\:processosGridPanel');
      await grid.waitFor({ state: 'visible', timeout: cfg.searchTimeoutMs });

      const extraction = await page.evaluate(() => {
        const CNJ_RE = /\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/g;
        const DATE_TIME_RE = /\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2}/;

        const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
        const byId = (id) => document.querySelector(id);

        const panel = byId('#fPP\\:processosGridPanel');
        const panelBody = byId('#fPP\\:processosGridPanel_body');
        const table = byId('#fPP\\:processosTable');

        const primaryRows = table
          ? Array.from(table.querySelectorAll('tr')).filter((tr) => tr.querySelectorAll('td').length > 0)
          : [];

        const fallbackRows = panel
          ? Array.from(panel.querySelectorAll('tr')).filter((tr) => tr.querySelectorAll('td').length > 0)
          : [];

        const processRows = (primaryRows.length ? primaryRows : fallbackRows)
          .filter((tr) => !tr.querySelector('th'));

        const blocks = processRows.map((tr, index) => {
          const tds = Array.from(tr.querySelectorAll('td'));
          const detailsAnchor = tr.querySelector('a[href],button,[role="button"]');
          const rowText = clean(tr.textContent || '');
          const cnj = rowText.match(CNJ_RE)?.[0] || null;

          const movementRawByCell = clean(tds[4]?.textContent || '');
          const movementRawByLabel = clean((rowText.match(/(?:última\s+movimentaç[aã]o\s*:?\s*)(.*)/i)?.[1] || ''));
          const movementRaw = movementRawByCell || movementRawByLabel;
          const movementDate = movementRaw.match(DATE_TIME_RE)?.[0] || rowText.match(DATE_TIME_RE)?.[0] || null;

          return {
            index,
            processNumber: cnj,
            processClass: clean(tds[1]?.textContent || ''),
            subject: clean(tds[2]?.textContent || ''),
            parties: clean(tds[3]?.textContent || ''),
            lastMovement: clean(movementRaw.replace(DATE_TIME_RE, '').replace(/[()]/g, ' ')),
            lastMovementAt: movementDate,
            rawLastMovementText: movementRaw || null,
            detailsUrl: detailsAnchor?.href || null,
            rawText: rowText,
            providerMeta: {
              rowIndex: index,
              domStrategy: primaryRows.length ? 'table-row' : 'panel-row-fallback',
            },
          };
        });

        const panelText = clean(panel?.textContent || panelBody?.textContent || table?.textContent || '');
        const panelCnjs = Array.from(new Set(panelText.match(CNJ_RE) || []));
        const detailsButtons = Array.from(document.querySelectorAll('a,button')).filter((el) =>
          /VER DETALHES DO PROCESSO/i.test(clean(el.textContent || '')),
        );

        const rawNodes = [];
        const pushRawNode = (el, fallbackId) => {
          if (!el) return;
          const id = clean(el.id || fallbackId || '');
          if (!id) return;
          rawNodes.push({
            id,
            tagName: (el.tagName || '').toLowerCase(),
            text: clean(el.textContent || ''),
            html: el.innerHTML || '',
          });
        };

        pushRawNode(panel, 'fPP:processosGridPanel');
        pushRawNode(panelBody, 'fPP:processosGridPanel_body');
        pushRawNode(table, 'fPP:processosTable');

        if (panel) {
          Array.from(panel.querySelectorAll('[id]')).forEach((el) => pushRawNode(el));
        }
        if (table) {
          Array.from(table.querySelectorAll('[id]')).forEach((el) => pushRawNode(el));
        }

        const rawById = Array.from(new Map(rawNodes.map((node) => [node.id, node])).values());

        return {
          rows: blocks,
          rawById,
          debug: {
            html: {
              panel: panel?.innerHTML || '',
              panelBody: panelBody?.innerHTML || '',
              table: table?.innerHTML || '',
            },
            counts: {
              detailsControls: detailsButtons.length,
              tr: panel ? panel.querySelectorAll('tr').length : 0,
              td: panel ? panel.querySelectorAll('td').length : 0,
              cnjBlocks: panelCnjs.length,
              processRows: processRows.length,
            },
            panelTextRaw: panelText,
            panelCnjs,
          },
        };
      });

      const parsedItems = parseTrf1Rows(extraction.rows);
      const rawItems = buildRawItemsFromExtraction(extraction);
      const items = parsedItems.length ? parsedItems : rawItems;
      const parsedCnjs = parsedItems.map((it) => it.processNumber).filter(Boolean);

      if (cfg.debug) {
        const debugBaseDir = path.resolve(process.cwd(), 'backend/tmp/consulta-processual-debug');
        const stamp = `${Date.now()}-${requestId || 'no-request'}`;
        const prefix = path.join(debugBaseDir, `trf1-${stamp}`);

        await page.screenshot({ path: `${prefix}.png`, fullPage: true });
        saveDebugTextFile(`${prefix}-panel.html`, extraction.debug.html.panel);
        saveDebugTextFile(`${prefix}-panel-body.html`, extraction.debug.html.panelBody);
        saveDebugTextFile(`${prefix}-table.html`, extraction.debug.html.table);
        saveDebugTextFile(`${prefix}-panel-text.txt`, extraction.debug.panelTextRaw);

        log.info('ConsultaProcessualProviderDebug', {
          event: 'ConsultaProcessualProviderDebug',
          requestId,
          userId,
          source: this.getId(),
          cpfMasked,
          debugArtifactsPrefix: prefix,
          ...extraction.debug.counts,
          parsedItems: parsedItems.length,
          rawItems: rawItems.length,
          returnedItems: items.length,
          parsedCnjs,
          panelCnjs: extraction.debug.panelCnjs,
        });
      }

      const countedFromText = extraction.debug.panelTextRaw.match(/(\d+)\s+resultados? encontrados/i);
      if (countedFromText) {
        const expectedCount = Number(countedFromText[1]);
        if (Number.isFinite(expectedCount) && expectedCount !== items.length) {
          log.warn('ConsultaProcessualProviderCountMismatch', {
            event: 'ConsultaProcessualProviderCountMismatch',
            requestId,
            userId,
            source: this.getId(),
            cpfMasked,
            expectedCount,
            parsedCount: parsedItems.length,
            returnedCount: items.length,
            parsedCnjs,
          });
        }
      }

      log.info('ConsultaProcessualProviderResult', {
        requestId,
        userId,
        source: this.getId(),
        cpfMasked,
        blocksDetected: extraction.rows.length,
        validItems: parsedItems.length,
        returnedItems: items.length,
        cnjs: parsedCnjs,
        durationMs: Date.now() - startedAt,
      });

      return createSourceResult({ source: this.getId(), sourceLabel: this.getLabel(), status: 'success', items });
    } catch (err) {
      const timeoutError = err?.name === 'TimeoutError' || /timeout/i.test(String(err?.message || ''));
      log.warn('ConsultaProcessualProviderError', {
        event: 'ConsultaProcessualProviderError',
        requestId,
        userId,
        source: this.getId(),
        cpfMasked,
        reasonCode: timeoutError ? 'TRF1_PORTAL_TIMEOUT' : 'TRF1_PORTAL_UNAVAILABLE',
        errorMessage: err.message,
        durationMs: Date.now() - startedAt,
      });

      if (cfg.debugScreenshot && browser) {
        try {
          const p = path.resolve(process.cwd(), `backend/tmp/consulta-processual-${Date.now()}-${this.getId()}.png`);
          const pages = (await browser.contexts()[0]?.pages()) || [];
          if (pages[0]) await pages[0].screenshot({ path: p, fullPage: true });
        } catch (_) {}
      }

      return createSourceResult({
        source: this.getId(),
        sourceLabel: this.getLabel(),
        status: 'error',
        items: [],
        error: {
          code: 'PROVIDER_TEMPORARILY_UNAVAILABLE',
          message: 'TRF1 indisponível no momento',
        },
      });
    } finally {
      if (browser) await browser.close().catch(() => {});
    }
  }
}

module.exports = Trf1PublicaProvider;
