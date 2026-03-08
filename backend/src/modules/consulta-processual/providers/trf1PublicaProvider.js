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

async function extractDetailMovement(context, detailsUrl, timeoutMs) {
  if (!detailsUrl) {
    return {
      lastMovement: null,
      lastMovementAt: null,
      rawLastMovementText: null,
      debug: { detailText: '', detailHtml: '' },
    };
  }

  const page = await context.newPage();

  try {
    await page.goto(detailsUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });

    return await page.evaluate(() => {
      const DATE_TIME_RE = /(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})/;
      const MOVEMENT_RE = /(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})\s*-\s*(.+)$/;
      const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();

      const allText = clean(document.body?.innerText || '');
      const heading = Array.from(document.querySelectorAll('h1,h2,h3,h4,legend,label,td,th,span,div')).find((el) =>
        /Movimentaç[õo]es\s+do\s+Processo/i.test(clean(el.textContent || '')),
      );

      const getCandidates = (root) => {
        if (!root) return [];
        const nodes = [
          ...Array.from(root.querySelectorAll('tr')),
          ...Array.from(root.querySelectorAll('li')),
          ...Array.from(root.querySelectorAll('div')),
          ...Array.from(root.querySelectorAll('td')),
        ];

        return nodes
          .map((node) => clean(node.textContent || ''))
          .filter(Boolean)
          .map((text) => {
            const lineMatch = text.match(MOVEMENT_RE);
            if (lineMatch) {
              return {
                raw: `${lineMatch[1]} - ${clean(lineMatch[2])}`,
                at: lineMatch[1],
                movement: clean(lineMatch[2]),
              };
            }

            const dateMatch = text.match(DATE_TIME_RE);
            if (!dateMatch) return null;

            const afterDate = clean(text.replace(dateMatch[1], '').replace(/^[\-–—:\s]+/, ''));
            if (!afterDate) return null;

            return {
              raw: `${dateMatch[1]} - ${afterDate}`,
              at: dateMatch[1],
              movement: afterDate,
            };
          })
          .filter(Boolean);
      };

      const movementContainer = heading?.closest('fieldset,section,table,div,td') || document.body;
      let candidates = getCandidates(movementContainer);

      if (!candidates.length && heading?.parentElement) {
        candidates = getCandidates(heading.parentElement);
      }

      if (!candidates.length) {
        const fallback = allText
          .split(/\s{2,}|\n+/)
          .map((line) => clean(line))
          .filter(Boolean)
          .map((line) => {
            const m = line.match(MOVEMENT_RE) || line.match(DATE_TIME_RE);
            if (!m) return null;
            if (line.match(MOVEMENT_RE)) {
              const [_, at, movement] = line.match(MOVEMENT_RE);
              return { raw: `${at} - ${clean(movement)}`, at, movement: clean(movement) };
            }
            const at = m[1];
            const movement = clean(line.replace(at, '').replace(/^[\-–—:\s]+/, ''));
            return movement ? { raw: `${at} - ${movement}`, at, movement } : null;
          })
          .filter(Boolean);
        candidates = fallback;
      }

      const latest = candidates[0] || null;

      return {
        lastMovement: latest?.movement || null,
        lastMovementAt: latest?.at || null,
        rawLastMovementText: latest?.raw || null,
        debug: {
          detailText: allText,
          detailHtml: movementContainer?.innerHTML || '',
        },
      };
    });
  } finally {
    await page.close().catch(() => {});
  }
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
        const CNJ_RE = /\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/;
        const DATE_TIME_RE = /\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2}/;
        const RESULTS_RE = /(\d+)\s+resultados? encontrados/i;

        const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
        const toAbsoluteUrl = (href) => {
          if (!href) return null;
          try {
            return new URL(href, window.location.origin).href;
          } catch (_err) {
            return null;
          }
        };

        const panel = document.querySelector('#fPP\\:processosGridPanel');
        const panelBody = document.querySelector('#fPP\\:processosGridPanel_body');
        const table = document.querySelector('#fPP\\:processosTable');
        const panelText = clean(panel?.innerText || panelBody?.innerText || table?.innerText || '');

        const anchors = Array.from((table || panel || document).querySelectorAll('a[href]'));
        const processAnchors = anchors.filter((anchor) => CNJ_RE.test(clean(anchor.textContent || '')))
          .map((anchor) => ({ anchor, title: clean(anchor.textContent || '') }))
          .filter((entry) => entry.title);

        const rawRows = processAnchors.map(({ anchor, title }, index) => {
          const row = anchor.closest('tr') || anchor.closest('li') || anchor.closest('div') || anchor.parentElement;
          const rowText = clean(row?.innerText || '');
          const tds = row ? Array.from(row.querySelectorAll('td')) : [];
          const processNumber = (title.match(CNJ_RE) || rowText.match(CNJ_RE) || [null])[0];

          const classCell = clean(tds[1]?.innerText || '');
          const partiesCell = clean(tds[3]?.innerText || '');
          const movementCell = clean(tds[4]?.innerText || '');

          const classLabelMatch = rowText.match(/Classe\s*:?\s*(.+?)(?:\s{2,}|Partes\s*:|Última\s+movimentaç[ãa]o\s*:|$)/i);
          const partiesLabelMatch = rowText.match(/Partes\s*:?\s*(.+?)(?:\s{2,}|Última\s+movimentaç[ãa]o\s*:|$)/i);
          const movementLabelMatch = rowText.match(/Última\s+movimentaç[ãa]o\s*:?\s*(.+?)$/i);

          const listLastMovementText = movementCell || clean(movementLabelMatch?.[1] || '');
          const listMovementDate = (listLastMovementText.match(DATE_TIME_RE) || rowText.match(DATE_TIME_RE) || [null])[0];
          const listMovement = clean(listLastMovementText.replace(DATE_TIME_RE, '').replace(/[()]/g, ' '));

          return {
            index,
            processNumber,
            processClass: classCell || clean(classLabelMatch?.[1] || ''),
            processTitle: title,
            parties: partiesCell || clean(partiesLabelMatch?.[1] || ''),
            detailsUrl: toAbsoluteUrl(anchor.getAttribute('href')),
            listLastMovementText: listLastMovementText || null,
            listLastMovementAt: listMovementDate,
            lastMovement: listMovement || null,
            lastMovementAt: listMovementDate,
            rawLastMovementText: listLastMovementText || null,
            rawHtml: row?.innerHTML || '',
            rawText: rowText,
            providerMeta: {
              rowIndex: index,
              domStrategy: row?.tagName ? row.tagName.toLowerCase() : 'unknown',
            },
          };
        });

        const uniqueRows = Array.from(
          new Map(
            rawRows
              .filter((item) => item.processNumber && item.processTitle)
              .map((item) => [item.processNumber, item]),
          ).values(),
        );

        const countedFromText = Number((panelText.match(RESULTS_RE) || [])[1] || NaN);

        return {
          rows: uniqueRows,
          debug: {
            html: {
              panel: panel?.innerHTML || '',
              panelBody: panelBody?.innerHTML || '',
              table: table?.innerHTML || '',
            },
            counts: {
              anchorsDetected: anchors.length,
              processAnchorsDetected: processAnchors.length,
              processRowsDetected: uniqueRows.length,
            },
            panelTextRaw: panelText,
            countFromText: Number.isFinite(countedFromText) ? countedFromText : null,
            detectedCnjs: uniqueRows.map((row) => row.processNumber).filter(Boolean),
            detectedLinks: uniqueRows.map((row) => row.detailsUrl).filter(Boolean),
          },
        };
      });

      const rowsWithDetails = [];
      const detailsDebug = [];
      for (const row of extraction.rows) {
        const detail = await extractDetailMovement(context, row.detailsUrl, cfg.searchTimeoutMs);
        rowsWithDetails.push({
          ...row,
          lastMovement: detail.lastMovement || row.lastMovement,
          lastMovementAt: detail.lastMovementAt || row.lastMovementAt,
          rawLastMovementText: detail.rawLastMovementText || row.rawLastMovementText,
          providerMeta: {
            ...(row.providerMeta || {}),
            listLastMovementText: row.listLastMovementText || null,
            listLastMovementAt: row.listLastMovementAt || null,
            detailsExtracted: Boolean(detail.rawLastMovementText),
          },
        });

        detailsDebug.push({
          processNumber: row.processNumber,
          detailsUrl: row.detailsUrl,
          rawLastMovementText: detail.rawLastMovementText,
          detailText: detail.debug?.detailText || '',
          detailHtml: detail.debug?.detailHtml || '',
        });
      }

      const items = parseTrf1Rows(rowsWithDetails);
      const parsedCnjs = items.map((it) => it.processNumber).filter(Boolean);

      if (cfg.debug) {
        const debugBaseDir = path.resolve(process.cwd(), 'backend/tmp/consulta-processual-debug');
        const stamp = `${Date.now()}-${requestId || 'no-request'}`;
        const prefix = path.join(debugBaseDir, `trf1-${stamp}`);

        await page.screenshot({ path: `${prefix}.png`, fullPage: true });
        saveDebugTextFile(`${prefix}-panel.html`, extraction.debug.html.panel);
        saveDebugTextFile(`${prefix}-panel-body.html`, extraction.debug.html.panelBody);
        saveDebugTextFile(`${prefix}-table.html`, extraction.debug.html.table);
        saveDebugTextFile(`${prefix}-panel-text.txt`, extraction.debug.panelTextRaw);
        saveDebugTextFile(`${prefix}-detected-links.json`, JSON.stringify(extraction.debug.detectedLinks, null, 2));
        saveDebugTextFile(`${prefix}-detected-cnjs.json`, JSON.stringify(extraction.debug.detectedCnjs, null, 2));
        saveDebugTextFile(`${prefix}-raw-rows.json`, JSON.stringify(extraction.rows, null, 2));
        saveDebugTextFile(`${prefix}-rows-with-details.json`, JSON.stringify(rowsWithDetails, null, 2));

        detailsDebug.forEach((entry, index) => {
          saveDebugTextFile(`${prefix}-detail-${index + 1}.txt`, entry.detailText);
          saveDebugTextFile(`${prefix}-detail-${index + 1}.html`, entry.detailHtml);
        });

        log.info('ConsultaProcessualProviderDebug', {
          event: 'ConsultaProcessualProviderDebug',
          requestId,
          userId,
          source: this.getId(),
          cpfMasked,
          debugArtifactsPrefix: prefix,
          ...extraction.debug.counts,
          parsedItems: items.length,
          parsedCnjs,
          countFromText: extraction.debug.countFromText,
        });
      }

      if (Number.isFinite(extraction.debug.countFromText) && extraction.debug.countFromText !== items.length) {
        log.warn('ConsultaProcessualProviderCountMismatch', {
          event: 'ConsultaProcessualProviderCountMismatch',
          requestId,
          userId,
          source: this.getId(),
          cpfMasked,
          expectedCount: extraction.debug.countFromText,
          parsedCount: items.length,
          parsedCnjs,
        });
      }

      log.info('ConsultaProcessualProviderResult', {
        requestId,
        userId,
        source: this.getId(),
        cpfMasked,
        blocksDetected: extraction.rows.length,
        validItems: items.length,
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
