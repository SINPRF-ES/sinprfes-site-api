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
      const MOVEMENT_RE = /(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})\s*-\s*(.+)$/;
      const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();

      const normalizeFromText = (text) => {
        const lineMatch = clean(text).match(MOVEMENT_RE);
        if (!lineMatch) return null;
        return {
          raw: `${lineMatch[1]} - ${clean(lineMatch[2])}`,
          at: lineMatch[1],
          movement: clean(lineMatch[2]),
        };
      };

      const heading = Array.from(document.querySelectorAll('h1,h2,h3,h4,legend,label,td,th,span,div')).find((el) =>
        /Movimentaç[õo]es\s+do\s+Processo/i.test(clean(el.textContent || '')),
      );

      const movementContainer = heading?.closest('fieldset,section,table,div,td') || document.body;
      const movementRows = Array.from(movementContainer.querySelectorAll('tr, li, div.row, div.movimentacao'));

      let candidates = movementRows
        .map((node) => normalizeFromText(node.textContent || ''))
        .filter(Boolean);

      if (!candidates.length) {
        const documentRows = Array.from(document.querySelectorAll('tr, li, div.row, div.movimentacao'));
        candidates = documentRows
          .map((node) => normalizeFromText(node.textContent || ''))
          .filter(Boolean);
      }

      if (!candidates.length) {
        candidates = clean(document.body?.innerText || '')
          .split(/\n+/)
          .map((line) => normalizeFromText(line))
          .filter(Boolean);
      }

      const latest = candidates[0] || null;
      return {
        lastMovement: latest?.movement || null,
        lastMovementAt: latest?.at || null,
        rawLastMovementText: latest?.raw || null,
        debug: {
          detailText: clean(document.body?.innerText || ''),
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
        const panelBody = panel?.querySelector('.rich-panel-body, .rf-p-b') || null;
        const table = document.querySelector('#fPP\\:processosTable');
        const panelText = clean(panel?.innerText || '');

        // Extração DOM-first focada na tabela de resultados
        const rows = table ? Array.from(table.querySelectorAll('tbody tr')) : [];
        const detailsLinksDetected = [];
        const rawRows = rows.map((row, index) => {
          const tds = Array.from(row.querySelectorAll('td'));
          // TRF1 structure:
          // td0: button with onclick openPopUp
          // td1: Class + Title + Parties
          // td2: Last Movement
          if (tds.length < 3) return null;

          // Tentamos pegar o link de detalhe do onclick do primeiro botão ou do link no td1
          const firstTdAnchor = tds[0].querySelector('a');
          const td1Anchor = tds[1].querySelector('a');
          const anchor = td1Anchor || firstTdAnchor;

          let detailsUrl = null;
          if (anchor) {
            const onclick = anchor.getAttribute('onclick');
            const href = anchor.getAttribute('href');
            if (onclick && onclick.includes('openPopUp')) {
                const match = onclick.match(/'([^']+)'\s*,\s*'([^']+)'/);
                if (match && match[2]) detailsUrl = toAbsoluteUrl(match[2]);
            }
            if (!detailsUrl && href && !href.startsWith('javascript:')) {
                detailsUrl = toAbsoluteUrl(href);
            }
          }
          if (detailsUrl) detailsLinksDetected.push(detailsUrl);

          const td1Text = clean(tds[1]?.textContent || '');
          const processNumberMatch = td1Text.match(CNJ_RE);
          if (!processNumberMatch) return null;

          const processNumber = processNumberMatch[0];

          const nodeText = (node) => clean(node?.textContent || '');
          const strongNodes = Array.from(tds[1].querySelectorAll('b, strong'));
          const classCandidate = strongNodes
            .map((node) => nodeText(node))
            .find((text) => text && !CNJ_RE.test(text));

          const processTitle = nodeText(td1Anchor || tds[1].querySelector('a'));
          const processClass = classCandidate || clean(td1Text.split(processNumber)[0] || '');

          const nodeTokens = Array.from(tds[1].childNodes)
            .map((node) => clean(node.textContent || ''))
            .filter(Boolean);

          const partiesCandidate = nodeTokens
            .find((token) => token.includes(' X ') && !token.includes(processNumber))
            || nodeTokens[nodeTokens.length - 1]
            || '';

          const parties = clean(partiesCandidate.replace(processTitle, '').trim());

          const listLastMovementText = clean(tds[2]?.textContent || '');
          const listMovementDateMatch = listLastMovementText.match(DATE_TIME_RE);
          const listMovementDate = listMovementDateMatch ? listMovementDateMatch[0] : null;
          const listMovement = clean(listLastMovementText.replace(DATE_TIME_RE, '').replace(/[()]/g, ' '));

          return {
            index,
            processNumber,
            processClass,
            processTitle: processTitle || `${processClass} ${processNumber}`,
            parties,
            detailsUrl,
            listLastMovementText,
            listLastMovementAt: listMovementDate,
            lastMovement: listMovement || null,
            lastMovementAt: listMovementDate,
            rawLastMovementText: listLastMovementText || null,
            rawHtml: row.innerHTML,
            rawText: clean(row.textContent || ''),
            providerMeta: {
              rowIndex: index,
              domStrategy: 'table-row-v2',
            },
          };
        }).filter(Boolean);

        // Fallback: se a tabela não for encontrada ou estiver vazia, tenta por anchors (comportamento legado melhorado)
        let finalRows = rawRows;
        if (finalRows.length === 0) {
          const anchors = Array.from((table || panel || document).querySelectorAll('a[href]'));
          const processAnchors = anchors.filter((anchor) => CNJ_RE.test(clean(anchor.textContent || '')));

          finalRows = processAnchors.map((anchor, index) => {
            const title = clean(anchor.textContent || '');
            const row = anchor.closest('tr') || anchor.closest('li') || anchor.closest('div') || anchor.parentElement;
            const rowText = clean(row?.innerText || '');
            const processNumber = (title.match(CNJ_RE) || [null])[0];

            if (!processNumber) return null;

            const movementLabelMatch = rowText.match(/Última\s+movimentaç[ãa]o\s*:?\s*(.+?)$/i);
            const listLastMovementText = clean(movementLabelMatch?.[1] || '');
            const listMovementDate = (listLastMovementText.match(DATE_TIME_RE) || [null])[0];

            return {
              index,
              processNumber,
              processClass: clean(rowText.match(/Classe\s*:?\s*(.+?)(?:\s{2,}|Partes|$)/i)?.[1] || ''),
              processTitle: title,
              parties: clean(rowText.match(/Partes\s*:?\s*(.+?)(?:\s{2,}|Última|$)/i)?.[1] || ''),
            detailsUrl: toAbsoluteUrl(anchor.getAttribute('href')),
              listLastMovementText,
              listLastMovementAt: listMovementDate,
              lastMovement: clean(listLastMovementText.replace(DATE_TIME_RE, '').replace(/[()]/g, ' ')),
              lastMovementAt: listMovementDate,
              rawLastMovementText: listLastMovementText,
              rawHtml: row?.innerHTML || '',
              rawText: rowText,
              providerMeta: { rowIndex: index, domStrategy: 'anchor-fallback' },
            };
          }).filter(Boolean);
        }

        finalRows.forEach((row) => {
          if (row?.detailsUrl) detailsLinksDetected.push(row.detailsUrl);
        });

        const uniqueRows = Array.from(
          new Map(finalRows.map((item) => [item.processNumber, item])).values(),
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
              tableRows: rows.length,
              processRowsDetected: uniqueRows.length,
            },
            panelTextRaw: panelText,
            countFromText: Number.isFinite(countedFromText) ? countedFromText : null,
            detectedCnjs: uniqueRows.map((row) => row.processNumber),
            detectedLinks: Array.from(new Set(detailsLinksDetected)),
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
