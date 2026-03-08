const fs = require('fs');
const path = require('path');
const ConsultaProcessualProvider = require('./ConsultaProcessualProvider');
const { getConsultaProcessualConfig } = require('../utils/consultaProcessualConfig');
const { parseTrf1Rows } = require('../parsers/trf1ProcessParser');
const { createSourceResult } = require('../dto/consultaProcessualDto');
const { launchBrowser } = require('../service/playwrightBrowserService');
const log = require('../../../utils/log');

const TRF1_URL = 'https://pje1g-consultapublica.trf1.jus.br/consultapublica/ConsultaPublica/listView.seam';

class Trf1PublicaProvider extends ConsultaProcessualProvider {
  getId() { return 'trf1'; }
  getLabel() { return 'TRF1'; }
  isEnabled() { return getConsultaProcessualConfig().trf1Enabled; }

  async consultarPorCpf({ cpf, cpfMasked, requestId, userId, debug: debugOverride }) {
    const startedAt = Date.now();
    const cfg = getConsultaProcessualConfig();
    const isDebug = debugOverride || cfg.debug;

    if (!this.isEnabled()) {
      return createSourceResult({ source: this.getId(), sourceLabel: this.getLabel(), status: 'skipped', items: [] });
    }

    const debugSummary = {
      pageLoaded: false,
      cpfFieldFound: false,
      searchTriggered: false,
      resultsContainerFound: false,
      resultsTextDetected: false,
      declaredResultsCount: 0,
      linksFound: 0,
      cnjMatchesFound: 0,
      rawBlocksFound: 0,
      normalizedItemsCount: 0,
      detailPagesOpened: 0,
      failureStage: null,
    };

    const debugBaseDir = path.resolve(process.cwd(), 'backend/tmp/consulta-processual/trf1', requestId || 'no-request');

    const saveArtifact = async (name, content, type = 'text') => {
      if (!isDebug) return;
      try {
        fs.mkdirSync(debugBaseDir, { recursive: true });
        const filePath = path.join(debugBaseDir, name);
        if (type === 'screenshot' && content.screenshot) {
          await content.screenshot({ path: filePath, fullPage: true });
        } else {
          fs.writeFileSync(filePath, String(content || ''), 'utf8');
        }
        log.info('ConsultaProcessualDebugArtifact', { requestId, userId, source: this.getId(), artifact: name, path: filePath });
      } catch (err) {
        log.warn('ConsultaProcessualDebugArtifactFailed', { requestId, userId, source: this.getId(), artifact: name, error: err.message });
      }
    };

    const logStep = (step, extra = {}) => {
      log.info('ConsultaProcessualDebugStep', {
        event: 'ConsultaProcessualDebugStep',
        step,
        requestId,
        userId,
        source: this.getId(),
        cpfMasked,
        ...extra,
      });
    };

    let browser;
    try {
      // ETAPA A: Bootstrap
      logStep('bootstrap_started');
      const browserResult = await launchBrowser({ config: cfg });
      if (!browserResult.ok) {
        debugSummary.failureStage = 'bootstrap';
        log.info('ConsultaProcessualProviderSkipped', {
          event: 'ConsultaProcessualProviderSkipped',
          requestId,
          userId,
          source: this.getId(),
          cpfMasked,
          reasonCode: browserResult.reasonCode,
          reason: browserResult.reason,
          durationMs: Date.now() - startedAt,
        });
        return createSourceResult({ source: this.getId(), sourceLabel: this.getLabel(), status: 'skipped', items: [] });
      }
      browser = browserResult.browser;
      const context = await browser.newContext();
      const page = await context.newPage();
      logStep('bootstrap_finished', { browser: 'ok', page: 'ok' });

      // ETAPA B: Carregamento da tela
      logStep('loading_page', { url: TRF1_URL });
      await page.goto(TRF1_URL, { waitUntil: 'domcontentloaded', timeout: cfg.initialLoadTimeoutMs });
      debugSummary.pageLoaded = true;

      const title = await page.title();
      const hasRadio = await page.locator('input[name="tipoMascaraDocumento"]').first().isVisible();
      const hasCpfField = await page.locator('#fPP\\:dpDec\\:documentoParte').isVisible();
      const hasSearchBtn = await page.locator('#fPP\\:searchProcessos').isVisible();

      logStep('page_loaded', { url: page.url(), title, hasRadio, hasCpfField, hasSearchBtn });
      await saveArtifact('01-home.png', page, 'screenshot');
      await saveArtifact('01-home.html', await page.content());

      if (!hasRadio || !hasCpfField || !hasSearchBtn) {
        debugSummary.failureStage = 'loading_page';
        throw new Error('Required selectors not found on home page');
      }
      debugSummary.cpfFieldFound = true;

      // ETAPA C: Preenchimento do CPF
      logStep('filling_cpf');
      await page.locator('input[name="tipoMascaraDocumento"]').first().check();
      await page.locator('#fPP\\:dpDec\\:documentoParte').fill(cpf);
      logStep('cpf_filled');
      await saveArtifact('02-filled.png', page, 'screenshot');

      // ETAPA D: Submit
      logStep('submitting_search');
      await page.locator('#fPP\\:searchProcessos').click();
      debugSummary.searchTriggered = true;

      const grid = page.locator('#fPP\\:processosGridPanel');
      try {
        await grid.waitFor({ state: 'visible', timeout: cfg.searchTimeoutMs });
        logStep('search_results_visible');
      } catch (e) {
        debugSummary.failureStage = 'search_timeout';
        logStep('search_timeout', { timeoutMs: cfg.searchTimeoutMs });
        await saveArtifact('03-timeout.png', page, 'screenshot');
        throw e;
      }
      await saveArtifact('03-results.png', page, 'screenshot');

      // ETAPA E & F: Captura e Parse Bruto
      logStep('extraction_started');
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
        const table = document.querySelector('#fPP\\:processosTable');
        const panelText = clean(panel?.innerText || '');

        const rows = table ? Array.from(table.querySelectorAll('tbody tr')) : [];
        const detectedLinks = [];

        const rawRows = rows.map((row, index) => {
          const tds = Array.from(row.querySelectorAll('td'));
          if (tds.length < 3) return { index, ignored: true, reason: 'less_than_3_tds' };

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
          if (detailsUrl) detectedLinks.push(detailsUrl);

          const td1Text = clean(tds[1]?.textContent || '');
          const processNumberMatch = td1Text.match(CNJ_RE);
          if (!processNumberMatch) return { index, ignored: true, reason: 'no_cnj_in_td1', text: td1Text };

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
            providerMeta: { rowIndex: index, domStrategy: 'table-row-v2' },
          };
        });

        const countedFromText = Number((panelText.match(RESULTS_RE) || [])[1] || NaN);
        const cnjMatches = (panelText.match(new RegExp(CNJ_RE, 'g')) || []);

        return {
          rawRows,
          panelText,
          resultsTextDetected: RESULTS_RE.test(panelText),
          countFromText: Number.isFinite(countedFromText) ? countedFromText : null,
          cnjMatchesFound: cnjMatches.length,
          linksFound: Array.from(new Set(detectedLinks)).length,
          html: {
            panel: panel?.innerHTML || '',
            table: table?.innerHTML || '',
          }
        };
      });

      debugSummary.resultsContainerFound = true;
      debugSummary.resultsTextDetected = extraction.resultsTextDetected;
      debugSummary.declaredResultsCount = extraction.countFromText || 0;
      debugSummary.linksFound = extraction.linksFound;
      debugSummary.cnjMatchesFound = extraction.cnjMatchesFound;
      debugSummary.rawBlocksFound = extraction.rawRows.filter(r => !r.ignored).length;

      logStep('extraction_finished', {
        resultsTextDetected: extraction.resultsTextDetected,
        countFromText: extraction.countFromText,
        cnjMatchesFound: extraction.cnjMatchesFound,
        linksFound: extraction.linksFound,
        rawBlocksFound: debugSummary.rawBlocksFound,
      });

      await saveArtifact('results-panel.html', extraction.html.panel);
      await saveArtifact('results-table.html', extraction.html.table);
      await saveArtifact('results-text.txt', extraction.panelText);

      // ETAPA H & I: Detalhes e Movimentações
      logStep('details_extraction_started', { count: debugSummary.rawBlocksFound });
      const rawRowsWithDetails = [];
      const validRawRows = extraction.rawRows.filter(r => !r.ignored);

      for (let i = 0; i < validRawRows.length; i++) {
        const row = validRawRows[i];
        logStep('opening_detail', { index: i, processNumber: row.processNumber, url: row.detailsUrl });

        const detail = await this.extractDetailMovement(context, row.detailsUrl, cfg.searchTimeoutMs, isDebug);
        debugSummary.detailPagesOpened++;

        const rowWithDetail = {
          ...row,
          lastMovement: detail.lastMovement || row.lastMovement,
          lastMovementAt: detail.lastMovementAt || row.lastMovementAt,
          rawLastMovementText: detail.rawLastMovementText || row.rawLastMovementText,
          providerMeta: {
            ...(row.providerMeta || {}),
            detailsExtracted: Boolean(detail.rawLastMovementText),
          },
        };
        rawRowsWithDetails.push(rowWithDetail);

        logStep('detail_extracted', {
          index: i,
          processNumber: row.processNumber,
          success: Boolean(detail.rawLastMovementText),
          movementAt: rowWithDetail.lastMovementAt
        });

        if (isDebug) {
          await saveArtifact(`process-${i + 1}-detail.html`, detail.debug?.detailHtml);
          await saveArtifact(`process-${i + 1}-text.txt`, detail.debug?.detailText);
        }
      }

      // ETAPA G: Normalização
      logStep('normalization_started');
      const items = parseTrf1Rows(rawRowsWithDetails, (warning) => {
        log.info('ConsultaProcessualDebugWarning', {
          event: 'ConsultaProcessualDebugWarning',
          step: 'normalize_item_rejected',
          requestId,
          userId,
          source: this.getId(),
          ...warning
        });
      });
      debugSummary.normalizedItemsCount = items.length;
      logStep('normalization_finished', { itemsCount: items.length });

      // ETAPA J: Consolidação
      logStep('consolidation_finished', {
        totalItems: items.length,
        itemsWithDetail: items.filter(it => it.providerMeta.detailsExtracted).length
      });

      return createSourceResult({
        source: this.getId(),
        sourceLabel: this.getLabel(),
        status: 'success',
        items: items,
        debugSummary
      });

    } catch (err) {
      log.error('ConsultaProcessualProviderError', {
        event: 'ConsultaProcessualProviderError',
        requestId,
        userId,
        source: this.getId(),
        cpfMasked,
        errorMessage: err.message,
        stack: err.stack,
      });
      if (!debugSummary.failureStage) debugSummary.failureStage = 'exception';

      return createSourceResult({
        source: this.getId(),
        sourceLabel: this.getLabel(),
        status: 'error',
        items: [],
        debugSummary,
        error: { code: 'PROVIDER_ERROR', message: err.message },
      });
    } finally {
      if (browser) await browser.close().catch(() => {});
    }
  }

  async extractDetailMovement(context, detailsUrl, timeoutMs, _isDebug) {
    if (!detailsUrl) return { lastMovement: null, lastMovementAt: null, rawLastMovementText: null, debug: {} };
    const page = await context.newPage();
    try {
      await page.goto(detailsUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
      return await page.evaluate(() => {
        const MOVEMENT_RE = /(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})\s*-\s*(.+)$/;
        const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
        const normalizeFromText = (text) => {
          const lineMatch = clean(text).match(MOVEMENT_RE);
          if (!lineMatch) return null;
          return { raw: `${lineMatch[1]} - ${clean(lineMatch[2])}`, at: lineMatch[1], movement: clean(lineMatch[2]) };
        };

        const heading = Array.from(document.querySelectorAll('h1,h2,h3,h4,legend,label,td,th,span,div')).find((el) =>
          /Movimentaç[õo]es\s+do\s+Processo/i.test(clean(el.textContent || '')),
        );

        const movementContainer = heading?.closest('fieldset,section,table,div,td') || document.body;
        const movementRows = Array.from(movementContainer.querySelectorAll('tr, li, div.row, div.movimentacao'));

        let candidates = movementRows.map((node) => normalizeFromText(node.textContent || '')).filter(Boolean);
        if (!candidates.length) {
          candidates = Array.from(document.querySelectorAll('tr, li, div.row, div.movimentacao'))
            .map((node) => normalizeFromText(node.textContent || ''))
            .filter(Boolean);
        }
        if (!candidates.length) {
          candidates = clean(document.body?.innerText || '').split(/\n+/).map(normalizeFromText).filter(Boolean);
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
}

module.exports = Trf1PublicaProvider;
