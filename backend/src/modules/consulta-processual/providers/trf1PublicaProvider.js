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
      inputDigitsCount: 0,
      inputValueMasked: null,
      searchTriggered: false,
      submitSucceeded: false,
      waitConditionMatched: null,
      realResultLoaded: false,
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
        timestamp: new Date().toISOString(),
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
        timestamp: new Date().toISOString(),
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
      const cpfFieldSelector = '#fPP\\:dpDec\\:documentoParte';
      const selectedRadioSelector = 'input[name="tipoMascaraDocumento"]';
      logStep('C_fill_cpf_start', {
        cpfMaskedUsed: cpfMasked,
        selectedRadio: selectedRadioSelector,
      });

      const fillStrategyResult = await this.fillCpfWithFallback(page, {
        cpfDigits: String(cpf || '').replace(/\D/g, ''),
        cpfFieldSelector,
        selectedRadioSelector,
      });

      const finalInputState = await page.locator(cpfFieldSelector).evaluate((input) => {
        const value = String(input?.value || '');
        const digits = value.replace(/\D/g, '');
        return {
          value,
          onlyDigits: digits,
          digitsCount: digits.length,
          length: value.length,
        };
      });

      debugSummary.inputDigitsCount = finalInputState.digitsCount;
      debugSummary.inputValueMasked = this.maskFieldValue(finalInputState.value);

      logStep('C_fill_cpf_end', {
        selectedRadio: selectedRadioSelector,
        fillStrategyTried: fillStrategyResult.strategies,
        fillStrategyUsed: fillStrategyResult.usedStrategy,
        fieldValueMasked: this.maskFieldValue(finalInputState.value),
        inputDigitsCount: finalInputState.digitsCount,
        inputOnlyDigits: finalInputState.onlyDigits,
        inputValueLength: finalInputState.length,
        inputOnlyDigitsMasked: this.maskFieldValue(finalInputState.onlyDigits),
        eventsDispatched: ['check', 'focus', 'clear', 'type'],
        durationMs: Date.now() - stepCStartedAt,
      });
      await saveArtifact('02-filled.png', page, 'screenshot');

      if (finalInputState.digitsCount !== 11) {
        debugSummary.failureStage = 'input_validation';
        emitDebugWarning('C_fill_cpf_invalid_input', {
          reason: 'CPF input does not contain 11 digits before submit',
          inputDigitsCount: finalInputState.digitsCount,
          inputOnlyDigits: finalInputState.onlyDigits,
          inputValueLength: finalInputState.length,
          inputValueMasked: this.maskFieldValue(finalInputState.value),
          inputOnlyDigitsMasked: this.maskFieldValue(finalInputState.onlyDigits),
        });
        throw new Error(`CPF field invalid before submit: found ${finalInputState.digitsCount} digits`);
      }

      const stepDStartedAt = Date.now();
      const beforeSubmitUrl = page.url();
      const beforeSubmitDomLen = (await page.content()).length;
      const beforeSubmitInputValue = await page.locator(cpfFieldSelector).inputValue();
      const beforeSubmitPanelHtml = await page.locator('#fPP\\:processosGridPanel_body').evaluate((el) => el?.innerHTML || '').catch(() => '');
      const beforeSubmitSignals = await page.evaluate(() => {
        const CNJ_RE = /\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/g;
        const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
        const panelBody = document.getElementById('fPP:processosGridPanel_body');
        const panel = document.getElementById('fPP:processosGridPanel');
        const root = panelBody || panel || document;
        const panelText = clean((panelBody || panel || document.body)?.innerText || '');
        const linkSignatures = Array.from(root.querySelectorAll('a[href],a[onclick]'))
          .map((node) => {
            const href = (node.getAttribute('href') || '').trim();
            const onclick = (node.getAttribute('onclick') || '').trim();
            const text = clean(node.textContent || '');
            return `${href}|${onclick}|${text}`;
          })
          .filter(Boolean);
        return {
          panelText,
          linkSignatures,
          cnjMatchesFound: (panelText.match(CNJ_RE) || []).length,
        };
      });
      const networkEvents = [];

      const onResponse = async (response) => {
        try {
          const req = response.request();
          const url = response.url();
          const method = req.method();
          const resourceType = req.resourceType();
          const isRelevant = /consultapublica|processosGridPanel|searchProcessos|richfaces|seam/i.test(url);
          if (!isRelevant) return;
          networkEvents.push({
            url,
            method,
            resourceType,
            status: response.status(),
          });
        } catch (_err) {
          // ignore network diagnostics errors
        }
      };
      page.on('response', onResponse);

      logStep('D_submit_search_start', {
        beforeSubmitUrl,
        beforeSubmitDomLen,
        beforeSubmitInputMasked: this.maskFieldValue(beforeSubmitInputValue),
        beforeSubmitInputDigits: this.onlyDigits(beforeSubmitInputValue),
        waitStrategy: 'waitForRealResultsUpdate',
        beforeSubmitSignals: {
          baselineLinksFound: Array.isArray(beforeSubmitSignals.linkSignatures) ? beforeSubmitSignals.linkSignatures.length : 0,
          baselineCnjMatchesFound: beforeSubmitSignals.cnjMatchesFound,
          panelTextSummary: String(beforeSubmitSignals.panelText || '').slice(0, 220),
        },
      });

      const clickPromise = page.locator('#fPP\\:searchProcessos').click();
      let ajaxResponse = null;
      try {
        ajaxResponse = await page.waitForResponse((response) => {
          const req = response.request();
          return req.method() === 'POST'
            && /consultapublica|listView\.seam|searchProcessos/i.test(response.url());
        }, { timeout: Math.min(cfg.searchTimeoutMs, 8000) });
      } catch (_err) {
        emitDebugWarning('D_submit_search_ajax_not_detected', { reason: 'No matching ajax response captured' });
      }
      await clickPromise;
      debugSummary.searchTriggered = true;

      let waitInfo;
      try {
        waitInfo = await this.waitForRealResultsUpdate(page, {
          timeoutMs: cfg.searchTimeoutMs,
          previousPanelBodyHtml: beforeSubmitPanelHtml,
          previousPanelText: beforeSubmitSignals.panelText || '',
          previousLinkSignatures: Array.isArray(beforeSubmitSignals.linkSignatures) ? beforeSubmitSignals.linkSignatures : [],
          previousCnjMatchesFound: Number(beforeSubmitSignals.cnjMatchesFound || 0),
        });
        debugSummary.waitConditionMatched = waitInfo.waitConditionMatched;
      } catch (err) {
        debugSummary.failureStage = 'submit_or_wait';
        emitDebugWarning('D_submit_search_timeout', {
          timeoutMs: cfg.searchTimeoutMs,
          waitStrategy: 'waitForRealResultsUpdate',
          errorMessage: err.message,
        });
        await saveArtifact('03-submit-timeout.png', page, 'screenshot');
        page.off('response', onResponse);
        throw err;
      }

      const afterSubmitUrl = page.url();
      const afterSubmitDomLen = (await page.content()).length;
      const afterSubmitPanelHtml = await page.locator('#fPP\\:processosGridPanel_body').evaluate((el) => el?.innerHTML || '').catch(() => '');
      const panelDelta = Math.abs(afterSubmitPanelHtml.length - beforeSubmitPanelHtml.length);
      const panelChanged = beforeSubmitPanelHtml !== afterSubmitPanelHtml;
      debugSummary.submitSucceeded = true;

      const ajaxResponseInfo = ajaxResponse ? {
        url: ajaxResponse.url(),
        status: ajaxResponse.status(),
        method: ajaxResponse.request().method(),
      } : null;

      page.off('response', onResponse);

      logStep('D_submit_search_end', {
        clickExecuted: true,
        urlChanged: beforeSubmitUrl !== afterSubmitUrl,
        beforeSubmitUrl,
        afterSubmitUrl,
        domChanged: beforeSubmitDomLen !== afterSubmitDomLen,
        beforeSubmitDomLen,
        afterSubmitDomLen,
        panelChanged,
        panelDelta,
        waitConditionMatched: waitInfo.waitConditionMatched,
        waitSignals: waitInfo.signals,
        ajaxResponse: ajaxResponseInfo,
        relevantNetworkResponses: networkEvents,
        durationMs: Date.now() - stepDStartedAt,
      });
      await saveArtifact('03-results.png', page, 'screenshot');
      await saveArtifact('03-panel-before-submit.html', beforeSubmitPanelHtml);
      await saveArtifact('03-panel-after-submit.html', afterSubmitPanelHtml);
      await saveArtifact('03-panel-diff-summary.json', JSON.stringify({
        beforeLength: beforeSubmitPanelHtml.length,
        afterLength: afterSubmitPanelHtml.length,
        panelChanged,
        panelDelta,
        waitInfo,
        ajaxResponse: ajaxResponseInfo,
        relevantNetworkResponses: networkEvents,
      }, null, 2));

      const stepEStartedAt = Date.now();
      logStep('E_capture_results_start');
      const extraction = await page.evaluate(() => {
        const CNJ_RE = /\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/;
        const DATE_TIME_RE = /\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2}/;
        const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
        const normalizeProcessClass = (value) => {
          const normalized = clean(value);
          if (!normalized) return null;
          return clean(normalized.replace(/\s+[A-Za-z][A-Za-z0-9]{2,15}$/, '')) || normalized;
        };
        const toAbsoluteUrl = (href) => {
          if (!href) return null;
          try {
            return new URL(href, window.location.origin).href;
          } catch (_err) {
            return null;
          }
        };

        const gridPanel = document.getElementById('fPP:processosGridPanel');
        const gridPanelBody = document.getElementById('fPP:processosGridPanel_body');
        const processTable = document.getElementById('fPP:processosTable');
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
          const processClass = normalizeProcessClass(classCandidate || clean(td1Text.split(processNumber)[0] || ''));

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
      const realResultLoaded = this.isRealSearchResultLoaded(domInspection);
      debugSummary.realResultLoaded = realResultLoaded;

      logStep('E_capture_results_end', {
        hasGridPanel: domInspection.hasGridPanel,
        hasGridPanelBody: domInspection.hasGridPanelBody,
        hasProcessTable: domInspection.hasProcessTable,
        resultsTextDetected: domInspection.declaredResultsTextDetected,
        declaredResultsCount: domInspection.declaredResultsCount,
        linksFound: domInspection.linksFound,
        cnjMatches: domInspection.cnjMatchesFound,
        realResultLoaded,
        panelTextSummary: domInspection.panelTextSummary,
        durationMs: Date.now() - stepEStartedAt,
      });

      await saveArtifact('04-results-area.png', page, 'screenshot');
      await saveArtifact('results-page.html', extraction.html.page);
      await saveArtifact('results-grid.html', extraction.html.panel);
      await saveArtifact('results-grid-body.html', extraction.html.panelBody);
      await saveArtifact('results-table.html', extraction.html.table);
      await saveArtifact('results-text.txt', extraction.panelText);

      if (!realResultLoaded) {
        debugSummary.failureStage = 'submit_or_wait';
        emitDebugWarning('E_capture_results_not_real_loaded', {
          reason: 'DOM is still base state or without usable signals after submit',
          declaredResultsCount: domInspection.declaredResultsCount,
          linksFound: domInspection.linksFound,
          cnjMatchesFound: domInspection.cnjMatchesFound,
          panelTextSummary: domInspection.panelTextSummary,
        });

        return createSourceResult({
          source: this.getId(),
          sourceLabel: this.getLabel(),
          status: 'error',
          items: [],
          debugSummary,
          debugData,
          error: {
            code: 'SUBMIT_OR_WAIT_FAILED',
            message: 'Pesquisa não carregou resultado real antes do parse bruto.',
          },
        });
      }

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
    if (digits.length === 11) {
      return `***.***.${digits.slice(6, 9)}-${digits.slice(9)}`;
    }
    if (digits.length <= 4) return `***${digits.slice(-2)}`;
    return `***${digits.slice(-4, -2)}***`;
  }

  onlyDigits(value) {
    return String(value || '').replace(/\D/g, '');
  }

  async fillCpfWithFallback(page, { cpfDigits, cpfFieldSelector, selectedRadioSelector }) {
    const strategies = [cpfDigits, this.formatCpf(cpfDigits)];
    const field = page.locator(cpfFieldSelector);

    await page.locator(selectedRadioSelector).first().check();

    for (const strategyValue of strategies) {
      await field.click({ force: true });
      await field.fill('');
      await page.keyboard.press('Control+a').catch(() => {});
      await page.keyboard.press('Backspace').catch(() => {});
      await field.type(strategyValue, { delay: 30 });
      const onlyDigits = this.onlyDigits(await field.inputValue());
      if (onlyDigits.length === 11 && onlyDigits === cpfDigits) {
        return { usedStrategy: strategyValue, strategies };
      }
    }

    return { usedStrategy: null, strategies };
  }

  formatCpf(cpfDigits) {
    const digits = this.onlyDigits(cpfDigits);
    if (digits.length !== 11) return digits;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }

  async waitForRealResultsUpdate(page, {
    timeoutMs,
    previousPanelBodyHtml,
    previousPanelText = '',
    previousLinkSignatures = [],
    previousCnjMatchesFound = 0,
  }) {
    const startedAt = Date.now();
    const pollIntervalMs = 250;

    while (Date.now() - startedAt < timeoutMs) {
      const snapshot = await page.evaluate(({ prevHtml, prevPanelText, prevLinkSignatures, prevCnjMatchesFoundValue }) => {
        const CNJ_RE = /\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/g;
        const RESULT_RE = /(\d+)\s+resultados? encontrados/i;
        const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();

        const gridPanelBody = document.getElementById('fPP:processosGridPanel_body');
        const gridPanel = document.getElementById('fPP:processosGridPanel');
        const root = gridPanelBody || gridPanel || document;
        const panelText = clean((gridPanelBody || gridPanel || document.body)?.innerText || '');
        const panelHtml = gridPanelBody?.innerHTML || '';
        const declaredMatch = panelText.match(RESULT_RE);

        const links = Array.from(root.querySelectorAll('a[href],a[onclick]')).map((node) => {
          const href = (node.getAttribute('href') || '').trim();
          const onclick = (node.getAttribute('onclick') || '').trim();
          const text = clean(node.textContent || '');
          const isProcessLike =
            /openPopUp|processo|detalhe|downloadDocumento/i.test(onclick)
            || /processo|detalhe|listView\.seam/i.test(href)
            || /\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/.test(text);
          return {
            href,
            onclick,
            text,
            isProcessLike,
            signature: `${href}|${onclick}|${text}`,
          };
        });

        const processLikeLinks = links.filter((link) => link.isProcessLike);
        const previousSet = new Set(Array.isArray(prevLinkSignatures) ? prevLinkSignatures : []);
        const addedProcessLikeLinks = processLikeLinks.filter((link) => !previousSet.has(link.signature));
        const cnjMatches = panelText.match(CNJ_RE) || [];

        return {
          panelHtmlChanged: panelHtml !== String(prevHtml || ''),
          panelTextChanged: panelText !== String(prevPanelText || ''),
          declaredResultsCount: Number(declaredMatch?.[1] || 0),
          hasDeclaredResultsPositive: Number(declaredMatch?.[1] || 0) > 0,
          cnjMatchesFound: cnjMatches.length,
          cnjIncreased: cnjMatches.length > Number(prevCnjMatchesFoundValue || 0),
          processLikeLinksFound: processLikeLinks.length,
          addedProcessLikeLinksFound: addedProcessLikeLinks.length,
          panelTextSummary: panelText.slice(0, 300),
        };
      }, {
        prevHtml: previousPanelBodyHtml,
        prevPanelText: previousPanelText,
        prevLinkSignatures: previousLinkSignatures,
        prevCnjMatchesFoundValue: previousCnjMatchesFound,
      });

      const waitConditionMatched =
        (snapshot.hasDeclaredResultsPositive && 'declared_results_positive')
        || (snapshot.cnjMatchesFound > 0 && snapshot.cnjIncreased && 'cnj_match_increased')
        || (snapshot.addedProcessLikeLinksFound > 0 && 'new_process_links_found')
        || (snapshot.panelHtmlChanged && snapshot.panelTextChanged && 'panel_html_changed')
        || null;

      if (waitConditionMatched) {
        return {
          waitConditionMatched,
          elapsedMs: Date.now() - startedAt,
          signals: snapshot,
        };
      }

      await page.waitForTimeout(pollIntervalMs);
    }

    throw new Error(`Timeout waiting for real TRF1 results update (${timeoutMs}ms)`);
  }

  isRealSearchResultLoaded(domInspection = {}) {
    return (
      Number(domInspection.declaredResultsCount || 0) > 0
      || Number(domInspection.cnjMatchesFound || 0) > 0
      || Number(domInspection.linksFound || 0) > 0
    );
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
        const sanitizeMovement = (value) => {
          const cleaned = clean(value);
          if (!cleaned) return null;
          const cutByMarkers = cleaned.split(/\s+(?:Documentos?|Pagin[aá]ç[aã]o|JavaScript|Assinado\s+digitalmente|Ver\s+todos|Dados\s+do\s+processo)\b/i)[0];
          return clean(cutByMarkers);
        };
        const normalizeFromText = (text) => {
          const raw = String(text || '').replace(/\r/g, '');
          const firstLine = raw.split(/\n+/).map((line) => line.trim()).find(Boolean) || raw.trim();
          const lineMatch = firstLine.match(MOVEMENT_RE) || raw.match(MOVEMENT_RE);
          if (!lineMatch) return null;
          const movement = sanitizeMovement(lineMatch[2]);
          if (!movement) return null;
          return {
            raw: `${lineMatch[1]} - ${movement}`,
            at: lineMatch[1],
            movement,
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
