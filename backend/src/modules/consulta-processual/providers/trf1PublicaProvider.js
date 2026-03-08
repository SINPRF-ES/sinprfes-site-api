const fs = require('fs');
const path = require('path');
const ConsultaProcessualProvider = require('./ConsultaProcessualProvider');
const { getConsultaProcessualConfig } = require('../utils/consultaProcessualConfig');
const { parseTrf1Rows } = require('../parsers/trf1ProcessParser');
const { createSourceResult } = require('../dto/consultaProcessualDto');
const { launchBrowser } = require('../service/playwrightBrowserService');
const { inspectResultsDom, cleanText } = require('./trf1DomInspector');
const log = require('../../../utils/log');

const TRF1_URL = 'https://pje1g-consultapublica.trf1.jus.br/consultapublica/ConsultaPublica/listView.seam';

class Trf1PublicaProvider extends ConsultaProcessualProvider {
  getId() { return 'trf1'; }
  getLabel() { return 'TRF1'; }
  isEnabled() { return getConsultaProcessualConfig().trf1Enabled; }

  async consultarPorCpf({ cpf, cpfMasked, requestId, userId, debug: debugOverride }) {
    const startedAt = Date.now();
    const cfg = getConsultaProcessualConfig();
    const isDebug = Boolean(debugOverride || cfg.debug);

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
    const debugData = isDebug ? {
      steps: [],
      warnings: [],
      artifacts: [],
      domInspection: null,
      discardReasons: {},
    } : null;
    if (isDebug) debugSummary.artifactsBaseDir = debugBaseDir;

    const saveArtifact = async (name, content, type = 'text') => {
      if (!isDebug) return;
      try {
        fs.mkdirSync(debugBaseDir, { recursive: true });
        const filePath = path.join(debugBaseDir, name);
        if (type === 'screenshot' && content?.screenshot) {
          await content.screenshot({ path: filePath, fullPage: true });
        } else {
          fs.writeFileSync(filePath, String(content || ''), 'utf8');
        }
        const artifactPayload = {
          event: 'ConsultaProcessualDebugArtifact',
          requestId,
          userId,
          source: this.getId(),
          artifact: name,
          path: filePath,
        };
        if (debugData) debugData.artifacts.push({ name, path: filePath });
        log.info('ConsultaProcessualDebugArtifact', artifactPayload);
      } catch (err) {
        log.warn('ConsultaProcessualDebugArtifactFailed', {
          event: 'ConsultaProcessualDebugArtifactFailed',
          requestId,
          userId,
          source: this.getId(),
          artifact: name,
          error: err.message,
        });
      }
    };

    const logStep = (step, extra = {}) => {
      const payload = {
        event: 'ConsultaProcessualDebugStep',
        step,
        requestId,
        userId,
        source: this.getId(),
        cpfMasked,
        ...extra,
      };
      if (debugData) debugData.steps.push(payload);
      log.info('ConsultaProcessualDebugStep', payload);
    };

    const emitDebugWarning = (step, extra = {}) => {
      const payload = {
        event: 'ConsultaProcessualDebugWarning',
        step,
        requestId,
        userId,
        source: this.getId(),
        cpfMasked,
        ...extra,
      };
      if (debugData) debugData.warnings.push(payload);
      log.info('ConsultaProcessualDebugWarning', payload);
    };

    let browser;
    try {
      const stepAStartedAt = Date.now();
      logStep('A_bootstrap_start');
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
      logStep('A_bootstrap_end', {
        browserStarted: true,
        pageCreated: true,
        durationMs: Date.now() - stepAStartedAt,
      });

      const stepBStartedAt = Date.now();
      logStep('B_load_screen_start', { url: TRF1_URL });
      await page.goto(TRF1_URL, { waitUntil: 'domcontentloaded', timeout: cfg.initialLoadTimeoutMs });
      const title = await page.title();
      const finalUrl = page.url();
      const hasRadio = await page.locator('input[name="tipoMascaraDocumento"]').first().isVisible();
      const hasCpfField = await page.locator('#fPP\\:dpDec\\:documentoParte').isVisible();
      const hasSearchBtn = await page.locator('#fPP\\:searchProcessos').isVisible();
      const homeHtml = await page.content();

      debugSummary.pageLoaded = true;
      debugSummary.cpfFieldFound = hasCpfField;

      logStep('B_load_screen_end', {
        finalUrl,
        title,
        hasRadioCpf: hasRadio,
        hasCpfField,
        hasSearchButton: hasSearchBtn,
        durationMs: Date.now() - stepBStartedAt,
      });

      await saveArtifact('01-home.png', page, 'screenshot');
      await saveArtifact('01-home-post-load.html', homeHtml);

      if (!hasRadio || !hasCpfField || !hasSearchBtn) {
        debugSummary.failureStage = 'screen_load';
        throw new Error('Required selectors not found on home page');
      }

      const stepCStartedAt = Date.now();
      const selectedRadioSelector = 'input[name="tipoMascaraDocumento"]';
      logStep('C_fill_cpf_start', {
        cpfMaskedUsed: cpfMasked,
        selectedRadio: selectedRadioSelector,
      });
      await page.locator(selectedRadioSelector).first().check();
      await page.locator('#fPP\\:dpDec\\:documentoParte').fill(cpf);
      const maskedFieldValue = await page.locator('#fPP\\:dpDec\\:documentoParte').inputValue();
      logStep('C_fill_cpf_end', {
        selectedRadio: selectedRadioSelector,
        fieldValueMasked: this.maskFieldValue(maskedFieldValue),
        eventsDispatched: ['check', 'fill'],
        durationMs: Date.now() - stepCStartedAt,
      });
      await saveArtifact('02-filled.png', page, 'screenshot');

      const stepDStartedAt = Date.now();
      const beforeSubmitUrl = page.url();
      const beforeSubmitDomLen = (await page.content()).length;
      logStep('D_submit_search_start', {
        beforeSubmitUrl,
        beforeSubmitDomLen,
        waitStrategy: 'waitForSelector(#fPP\\:processosGridPanel)',
        timestamp: new Date().toISOString(),
      });

      await page.locator('#fPP\\:searchProcessos').click();
      debugSummary.searchTriggered = true;

      const grid = page.locator('#fPP\\:processosGridPanel');
      try {
        await grid.waitFor({ state: 'visible', timeout: cfg.searchTimeoutMs });
      } catch (err) {
        debugSummary.failureStage = 'submit_wait';
        emitDebugWarning('D_submit_search_timeout', {
          timeoutMs: cfg.searchTimeoutMs,
          waitStrategy: 'waitForSelector(#fPP\\:processosGridPanel)',
        });
        await saveArtifact('03-submit-timeout.png', page, 'screenshot');
        throw err;
      }

      const afterSubmitUrl = page.url();
      const afterSubmitDomLen = (await page.content()).length;
      logStep('D_submit_search_end', {
        clickExecuted: true,
        urlChanged: beforeSubmitUrl !== afterSubmitUrl,
        beforeSubmitUrl,
        afterSubmitUrl,
        domChanged: beforeSubmitDomLen !== afterSubmitDomLen,
        beforeSubmitDomLen,
        afterSubmitDomLen,
        durationMs: Date.now() - stepDStartedAt,
      });
      await saveArtifact('03-results.png', page, 'screenshot');

      const stepEStartedAt = Date.now();
      logStep('E_capture_results_start');
      const extraction = await page.evaluate(() => {
        const CNJ_RE = /\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/;
        const DATE_TIME_RE = /\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2}/;
        const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
        const toAbsoluteUrl = (href) => {
          if (!href) return null;
          try {
            return new URL(href, window.location.origin).href;
          } catch (_err) {
            return null;
          }
        };

        const gridPanel = document.querySelector('#fPP\\:processosGridPanel');
        const gridPanelBody = document.querySelector('#fPP\\:processosGridPanel_body');
        const processTable = document.querySelector('#fPP\\:processosTable');
        const panelText = clean((gridPanelBody || gridPanel || document.body)?.innerText || '');

        const rows = processTable ? Array.from(processTable.querySelectorAll('tbody tr')) : [];
        const detectedLinks = [];

        const rawRows = rows.map((row, index) => {
          const tds = Array.from(row.querySelectorAll('td'));
          if (tds.length < 3) return { index, ignored: true, reason: 'less_than_3_tds', rawText: clean(row.textContent || '') };

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
          if (!processNumberMatch) return { index, ignored: true, reason: 'no_cnj_in_td1', text: td1Text, rawText: clean(row.textContent || '') };

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

        return {
          hasGridPanel: Boolean(gridPanel),
          hasGridPanelBody: Boolean(gridPanelBody),
          hasProcessTable: Boolean(processTable),
          panelText,
          detectedLinks,
          linksFound: Array.from(new Set(detectedLinks)).length,
          rawRows,
          html: {
            page: document.documentElement?.outerHTML || '',
            panel: gridPanel?.innerHTML || '',
            panelBody: gridPanelBody?.innerHTML || '',
            table: processTable?.innerHTML || '',
          },
        };
      });

      const domInspection = inspectResultsDom(extraction);
      if (debugData) debugData.domInspection = domInspection;
      debugSummary.resultsContainerFound = Boolean(domInspection.hasGridPanel || domInspection.hasGridPanelBody || domInspection.hasProcessTable);
      debugSummary.resultsTextDetected = domInspection.declaredResultsTextDetected;
      debugSummary.declaredResultsCount = domInspection.declaredResultsCount;
      debugSummary.linksFound = domInspection.linksFound;
      debugSummary.cnjMatchesFound = domInspection.cnjMatchesFound;
      debugSummary.rawBlocksFound = extraction.rawRows.length;

      logStep('E_capture_results_end', {
        hasGridPanel: domInspection.hasGridPanel,
        hasGridPanelBody: domInspection.hasGridPanelBody,
        hasProcessTable: domInspection.hasProcessTable,
        resultsTextDetected: domInspection.declaredResultsTextDetected,
        declaredResultsCount: domInspection.declaredResultsCount,
        linksFound: domInspection.linksFound,
        cnjMatches: domInspection.cnjMatchesFound,
        panelTextSummary: domInspection.panelTextSummary,
        durationMs: Date.now() - stepEStartedAt,
      });

      await saveArtifact('04-results-area.png', page, 'screenshot');
      await saveArtifact('results-page.html', extraction.html.page);
      await saveArtifact('results-grid.html', extraction.html.panel);
      await saveArtifact('results-grid-body.html', extraction.html.panelBody);
      await saveArtifact('results-table.html', extraction.html.table);
      await saveArtifact('results-text.txt', extraction.panelText);

      const stepFStartedAt = Date.now();
      logStep('F_parse_raw_start', { candidateBlocks: extraction.rawRows.length });
      extraction.rawRows.forEach((row, index) => {
        logStep('F_parse_raw_block', {
          index,
          ignored: Boolean(row.ignored),
          reason: row.reason || null,
          hasCnj: Boolean(row.processNumber),
          hasHref: Boolean(row.detailsUrl),
          hasClass: Boolean(cleanText(row.processClass)),
          hasParties: Boolean(cleanText(row.parties)),
          snippet: cleanText(row.rawText || row.text || '').substring(0, 180),
        });
      });
      logStep('F_parse_raw_end', {
        rawBlocksFound: extraction.rawRows.length,
        candidateRows: extraction.rawRows.filter((row) => !row.ignored).length,
        durationMs: Date.now() - stepFStartedAt,
      });

      const validRawRows = extraction.rawRows.filter((row) => !row.ignored);
      const stepHStartedAt = Date.now();
      logStep('H_open_detail_start', { validRows: validRawRows.length });
      const rawRowsWithDetails = [];

      for (let i = 0; i < validRawRows.length; i += 1) {
        const row = validRawRows[i];
        logStep('H_open_detail_attempt', {
          index: i,
          processNumber: row.processNumber,
          detailsUrl: row.detailsUrl || null,
        });

        const detail = await this.extractDetailMovement({
          context,
          detailsUrl: row.detailsUrl,
          timeoutMs: cfg.searchTimeoutMs,
          isDebug,
          requestId,
          userId,
          cpfMasked,
          source: this.getId(),
          artifactPrefix: `process-${i + 1}`,
          saveArtifact,
          logStep,
          logWarning: emitDebugWarning,
        });

        debugSummary.detailPagesOpened += detail.opened ? 1 : 0;

        const rowWithDetail = {
          ...row,
          lastMovement: detail.lastMovement || row.lastMovement,
          lastMovementAt: detail.lastMovementAt || row.lastMovementAt,
          rawLastMovementText: detail.rawLastMovementText || row.rawLastMovementText,
          providerMeta: {
            ...(row.providerMeta || {}),
            detailsExtracted: Boolean(detail.rawLastMovementText),
            movementsCount: detail.movementsCount || 0,
            hasMovementsBlock: Boolean(detail.hasMovementsBlock),
            detailUrlFinal: detail.finalUrl || null,
          },
        };

        rawRowsWithDetails.push(rowWithDetail);

        logStep('I_parse_latest_movement', {
          index: i,
          processNumber: row.processNumber,
          rawMovementText: cleanText(detail.rawFirstMovement || '').substring(0, 180),
          extractedMovementAt: detail.lastMovementAt || null,
          extractedMovementDescription: cleanText(detail.lastMovement || '').substring(0, 140),
          normalizedSuccess: Boolean(detail.rawLastMovementText),
          movementsCount: detail.movementsCount || 0,
          hasMovementsBlock: Boolean(detail.hasMovementsBlock),
        });
      }
      logStep('H_open_detail_end', {
        detailPagesOpened: debugSummary.detailPagesOpened,
        durationMs: Date.now() - stepHStartedAt,
      });

      const stepGStartedAt = Date.now();
      logStep('G_normalization_start', { rawItemsCount: rawRowsWithDetails.length });
      const discardReasons = {};
      const items = parseTrf1Rows(rawRowsWithDetails, (warning) => {
        discardReasons[warning.reason] = (discardReasons[warning.reason] || 0) + 1;
        emitDebugWarning('normalize_item_rejected', warning);
      });
      debugSummary.normalizedItemsCount = items.length;
      if (debugData) debugData.discardReasons = discardReasons;
      logStep('G_normalization_end', {
        rawItemsCount: rawRowsWithDetails.length,
        normalizedItemsCount: items.length,
        discardedCount: rawRowsWithDetails.length - items.length,
        discardReasons,
        durationMs: Date.now() - stepGStartedAt,
      });

      logStep('J_consolidation_end', {
        totalItemsListed: extraction.rawRows.length,
        validItemsBeforeNormalize: rawRowsWithDetails.length,
        itemsWithDetailExtracted: items.filter((it) => it.providerMeta.detailsExtracted).length,
        totalReturned: items.length,
        totalDurationMs: Date.now() - startedAt,
      });

      if (!debugSummary.failureStage && items.length === 0) {
        if (!debugSummary.searchTriggered) debugSummary.failureStage = 'submit';
        else if (!debugSummary.resultsContainerFound) debugSummary.failureStage = 'results_dom';
        else if (!debugSummary.rawBlocksFound) debugSummary.failureStage = 'raw_parse';
        else if (!debugSummary.normalizedItemsCount) debugSummary.failureStage = 'normalization';
      }

      return createSourceResult({
        source: this.getId(),
        sourceLabel: this.getLabel(),
        status: 'success',
        items,
        debugSummary,
        debugData,
      });
    } catch (err) {
      if (!debugSummary.failureStage) debugSummary.failureStage = 'exception';
      log.error('ConsultaProcessualProviderError', {
        event: 'ConsultaProcessualProviderError',
        requestId,
        userId,
        source: this.getId(),
        cpfMasked,
        errorMessage: err.message,
        stack: err.stack,
      });

      return createSourceResult({
        source: this.getId(),
        sourceLabel: this.getLabel(),
        status: 'error',
        items: [],
        debugSummary,
        debugData,
        error: { code: 'PROVIDER_ERROR', message: err.message },
      });
    } finally {
      if (browser) await browser.close().catch(() => {});
    }
  }

  maskFieldValue(value) {
    const digits = String(value || '').replace(/\D/g, '');
    if (!digits) return null;
    if (digits.length <= 4) return `***${digits.slice(-2)}`;
    return `***${digits.slice(-4, -2)}***`;
  }

  async extractDetailMovement({
    context,
    detailsUrl,
    timeoutMs,
    artifactPrefix,
    saveArtifact,
    logStep,
    logWarning: emitDebugWarning,
  }) {
    if (!detailsUrl) {
      emitDebugWarning('H_open_detail_missing_url', { reason: 'missing_href' });
      return {
        opened: false,
        finalUrl: null,
        hasMovementsBlock: false,
        movementsCount: 0,
        rawFirstMovement: null,
        rawLastMovementText: null,
        lastMovementAt: null,
        lastMovement: null,
      };
    }

    const page = await context.newPage();
    try {
      await page.goto(detailsUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
      const detailEval = await page.evaluate(() => {
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

        let candidates = movementRows.map((node) => normalizeFromText(node.textContent || '')).filter(Boolean);
        if (!candidates.length) {
          candidates = Array.from(document.querySelectorAll('tr, li, div.row, div.movimentacao'))
            .map((node) => normalizeFromText(node.textContent || ''))
            .filter(Boolean);
        }
        if (!candidates.length) {
          candidates = clean(document.body?.innerText || '').split(/\n+/).map(normalizeFromText).filter(Boolean);
        }

        return {
          finalUrl: window.location.href,
          hasMovementsBlock: Boolean(heading),
          movementsCount: candidates.length,
          rawFirstMovement: candidates[0]?.raw || null,
          lastMovement: candidates[0]?.movement || null,
          lastMovementAt: candidates[0]?.at || null,
          rawLastMovementText: candidates[0]?.raw || null,
          debug: {
            detailText: clean(document.body?.innerText || ''),
            movementText: clean(movementContainer?.innerText || ''),
            detailHtml: document.documentElement?.outerHTML || '',
          },
        };
      });

      await saveArtifact(`${artifactPrefix}-detail.png`, page, 'screenshot');
      await saveArtifact(`${artifactPrefix}-detail.html`, detailEval.debug?.detailHtml || '');
      await saveArtifact(`${artifactPrefix}-movements.txt`, detailEval.debug?.movementText || '');

      logStep('H_open_detail_result', {
        detailsUrl,
        finalUrl: detailEval.finalUrl,
        hasMovementsBlock: detailEval.hasMovementsBlock,
        movementsCount: detailEval.movementsCount,
      });

      return {
        opened: true,
        finalUrl: detailEval.finalUrl,
        hasMovementsBlock: detailEval.hasMovementsBlock,
        movementsCount: detailEval.movementsCount,
        rawFirstMovement: detailEval.rawFirstMovement,
        rawLastMovementText: detailEval.rawLastMovementText,
        lastMovementAt: detailEval.lastMovementAt,
        lastMovement: detailEval.lastMovement,
      };
    } finally {
      await page.close().catch(() => {});
    }
  }
}

module.exports = Trf1PublicaProvider;
