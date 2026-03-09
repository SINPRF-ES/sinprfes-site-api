const fs = require('fs');
const path = require('path');
const ConsultaProcessualProvider = require('./ConsultaProcessualProvider');
const { getConsultaProcessualConfig } = require('../utils/consultaProcessualConfig');
const { launchBrowser } = require('../service/playwrightBrowserService');
const { inspectResultsDom, cleanText } = require('./trf1DomInspector');
const log = require('../../../utils/log');

class PjeConsultaPublicaBaseProvider extends ConsultaProcessualProvider {
  constructor() {
    super();
    if (this.constructor === PjeConsultaPublicaBaseProvider) {
      throw new Error('PjeConsultaPublicaBaseProvider is an abstract class and cannot be instantiated directly.');
    }
  }

  getBaseUrl() {
    throw new Error('Provider must implement getBaseUrl()');
  }

  getParser() {
    throw new Error('Provider must implement getParser()');
  }

  getMaturityStatus() {
    return 'experimental';
  }

  classifyError(err) {
    return { code: 'PROVIDER_ERROR', message: err.message };
  }

  // PJe standard selectors (mostly RichFaces based)
  getSelectors() {
    return {
      documentField: '#fPP\\:dpDec\\:documentoParte',
      searchButton: '#fPP\\:searchProcessos',
      gridPanel: 'fPP:processosGridPanel',
      gridPanelBody: 'fPP:processosGridPanel_body',
      processTable: 'fPP:processosTable',
      radioDocumento: 'input[name="tipoMascaraDocumento"]',
    };
  }

  async consultarPorDocumento({ document, documentMasked, requestId, userId, debug: debugOverride }) {
    const startedAt = Date.now();
    const cfg = getConsultaProcessualConfig();
    const debugOptions = typeof debugOverride === 'object' && debugOverride !== null
      ? debugOverride
      : { enabled: Boolean(debugOverride || cfg.debug), includeArtifacts: Boolean(debugOverride || cfg.debug), includeDomInspection: Boolean(debugOverride || cfg.debug), includeSteps: Boolean(debugOverride || cfg.debug), includeWarnings: Boolean(debugOverride || cfg.debug), level: 'detailed' };
    const isDebug = Boolean(debugOptions.enabled);
    const includeArtifacts = Boolean(debugOptions.includeArtifacts);
    const includeDomInspection = Boolean(debugOptions.includeDomInspection);
    const includeSteps = Boolean(debugOptions.includeSteps);
    const includeWarnings = Boolean(debugOptions.includeWarnings);

    if (!this.isEnabled()) {
      return {
        source: this.getId(),
        sourceLabel: this.getLabel(),
        status: 'skipped',
        items: [],
        providerMeta: { maturity: this.getMaturityStatus(), debugLevel: debugOptions.level || 'minimal' },
      };
    }

    const debugSummary = {
      pageLoaded: false,
      documentFieldFound: false,
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

    const debugBaseDir = path.resolve(process.cwd(), `backend/tmp/consulta-processual/${this.getId()}`, requestId || 'no-request');
    const debugData = isDebug ? {
      steps: [],
      warnings: [],
      artifacts: [],
      domInspection: null,
      discardReasons: {},
    } : null;
    if (isDebug && includeArtifacts) debugSummary.artifactsBaseDir = debugBaseDir;

    const saveArtifact = async (name, content, type = 'text') => {
      if (!isDebug || !includeArtifacts) return;
      try {
        if (!fs.existsSync(debugBaseDir)) {
          fs.mkdirSync(debugBaseDir, { recursive: true });
        }
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
        documentMasked,
        timestamp: new Date().toISOString(),
        ...extra,
      };
      if (includeSteps && debugData) debugData.steps.push(payload);
      if (includeSteps) log.info('ConsultaProcessualDebugStep', payload);
    };

    const emitDebugWarning = (step, extra = {}) => {
      const payload = {
        event: 'ConsultaProcessualDebugWarning',
        step,
        requestId,
        userId,
        source: this.getId(),
        documentMasked,
        timestamp: new Date().toISOString(),
        ...extra,
      };
      if (includeWarnings && debugData) debugData.warnings.push(payload);
      if (includeWarnings) log.info('ConsultaProcessualDebugWarning', payload);
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
          documentMasked,
          reasonCode: browserResult.reasonCode,
          reason: browserResult.reason,
          durationMs: Date.now() - startedAt,
        });
        return {
        source: this.getId(),
        sourceLabel: this.getLabel(),
        status: 'skipped',
        items: [],
        providerMeta: { maturity: this.getMaturityStatus(), debugLevel: debugOptions.level || 'minimal' },
      };
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
      const TRF_URL = this.getBaseUrl();
      logStep('B_load_screen_start', { url: TRF_URL });
      await page.goto(TRF_URL, { waitUntil: 'domcontentloaded', timeout: cfg.initialLoadTimeoutMs });
      const title = await page.title();
      const finalUrl = page.url();
      const selectors = this.getSelectors();

      const hasRadio = await page.locator(selectors.radioDocumento).first().isVisible();
      const hasDocField = await page.locator(selectors.documentField).isVisible();
      const hasSearchBtn = await page.locator(selectors.searchButton).isVisible();
      const homeHtml = await page.content();

      debugSummary.pageLoaded = true;
      debugSummary.documentFieldFound = hasDocField;

      logStep('B_load_screen_end', {
        finalUrl,
        title,
        hasRadio,
        hasDocField,
        hasSearchButton: hasSearchBtn,
        durationMs: Date.now() - stepBStartedAt,
      });

      await saveArtifact('01-home.png', page, 'screenshot');
      await saveArtifact('01-home-post-load.html', homeHtml);

      if (!hasDocField || !hasSearchBtn) {
        debugSummary.failureStage = 'screen_load';
        throw new Error(`Required selectors not found on home page for ${this.getId()}`);
      }

      const stepCStartedAt = Date.now();
      logStep('C_fill_document_start', {
        documentMaskedUsed: documentMasked,
      });

      const docDigits = String(document || '').replace(/\D/g, '');
      const fillStrategyResult = await this.fillDocumentWithFallback(page, {
        docDigits,
        docFieldSelector: selectors.documentField,
        radioSelector: selectors.radioDocumento,
      });

      const finalInputState = await page.locator(selectors.documentField).evaluate((input) => {
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

      logStep('C_fill_document_end', {
        fillStrategyTried: fillStrategyResult.strategies,
        fillStrategyUsed: fillStrategyResult.usedStrategy,
        fieldValueMasked: this.maskFieldValue(finalInputState.value),
        inputDigitsCount: finalInputState.digitsCount,
        inputOnlyDigitsMasked: this.maskFieldValue(finalInputState.onlyDigits),
        durationMs: Date.now() - stepCStartedAt,
      });
      await saveArtifact('02-filled.png', page, 'screenshot');

      if (finalInputState.digitsCount !== 11 && finalInputState.digitsCount !== 14) {
        debugSummary.failureStage = 'input_validation';
        emitDebugWarning('C_fill_document_invalid_input', {
          reason: 'Document input does not contain 11 or 14 digits before submit',
          inputDigitsCount: finalInputState.digitsCount,
        });
        throw new Error(`Document field invalid before submit: found ${finalInputState.digitsCount} digits`);
      }

      const stepDStartedAt = Date.now();
      const gridPanelBodySelector = `#${String(selectors.gridPanelBody || '').replace(/:/g, '\\:')}`;
      const beforeSubmitPanelHtml = await page.locator(gridPanelBodySelector).evaluate((el) => el?.innerHTML || '').catch(() => '');
      const beforeSubmitSignals = await page.evaluate(({ gridPanelId, gridPanelBodyId }) => {
        const CNJ_RE = /\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/g;
        const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
        const panelBody = document.getElementById(gridPanelBodyId);
        const panel = document.getElementById(gridPanelId);
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
      }, { gridPanelId: selectors.gridPanel, gridPanelBodyId: selectors.gridPanelBody });

      logStep('D_submit_search_start', {
        waitStrategy: 'waitForRealResultsUpdate',
      });

      await page.locator(selectors.searchButton).click();
      debugSummary.searchTriggered = true;

      let waitInfo;
      try {
        waitInfo = await this.waitForRealResultsUpdate(page, {
          timeoutMs: cfg.searchTimeoutMs,
          previousPanelBodyHtml: beforeSubmitPanelHtml,
          previousPanelText: beforeSubmitSignals.panelText || '',
          previousLinkSignatures: Array.isArray(beforeSubmitSignals.linkSignatures) ? beforeSubmitSignals.linkSignatures : [],
          previousCnjMatchesFound: Number(beforeSubmitSignals.cnjMatchesFound || 0),
          selectors,
        });
        debugSummary.waitConditionMatched = waitInfo.waitConditionMatched;
      } catch (err) {
        debugSummary.failureStage = 'submit_or_wait';
        emitDebugWarning('D_submit_search_timeout', {
          timeoutMs: cfg.searchTimeoutMs,
          errorMessage: err.message,
        });
        await saveArtifact('03-submit-timeout.png', page, 'screenshot');
        throw err;
      }

      debugSummary.submitSucceeded = true;
      logStep('D_submit_search_end', {
        waitConditionMatched: waitInfo.waitConditionMatched,
        durationMs: Date.now() - stepDStartedAt,
      });
      await saveArtifact('03-results.png', page, 'screenshot');

      const stepEStartedAt = Date.now();
      logStep('E_capture_results_start');
      const extraction = await page.evaluate(({ gridPanelId, gridPanelBodyId, processTableId }) => {
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

        const gridPanel = document.getElementById(gridPanelId);
        const gridPanelBody = document.getElementById(gridPanelBodyId);
        const processTable = document.getElementById(processTableId);
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
      }, {
        gridPanelId: selectors.gridPanel,
        gridPanelBodyId: selectors.gridPanelBody,
        processTableId: selectors.processTable,
      });

      const domInspection = inspectResultsDom(extraction);
      if (debugData && includeDomInspection) debugData.domInspection = domInspection;
      debugSummary.resultsContainerFound = Boolean(domInspection.hasGridPanel || domInspection.hasGridPanelBody || domInspection.hasProcessTable);
      debugSummary.resultsTextDetected = domInspection.declaredResultsTextDetected;
      debugSummary.declaredResultsCount = domInspection.declaredResultsCount;
      debugSummary.linksFound = domInspection.linksFound;
      debugSummary.cnjMatchesFound = domInspection.cnjMatchesFound;
      debugSummary.rawBlocksFound = extraction.rawRows.length;
      const realResultLoaded = this.isRealSearchResultLoaded(domInspection);
      debugSummary.realResultLoaded = realResultLoaded;

      logStep('E_capture_results_end', {
        realResultLoaded,
        durationMs: Date.now() - stepEStartedAt,
      });

      await saveArtifact('results-page.html', extraction.html.page);

      if (!realResultLoaded) {
        return {
          source: this.getId(),
          sourceLabel: this.getLabel(),
          status: 'success',
          items: [],
          providerMeta: { maturity: this.getMaturityStatus(), debugLevel: debugOptions.level || 'minimal' },
          debugSummary,
          debugData,
        };
      }

      const validRawRows = extraction.rawRows.filter((row) => !row.ignored);
      const stepHStartedAt = Date.now();
      logStep('H_open_detail_start', { validRows: validRawRows.length });
      const rawRowsWithDetails = [];

      for (let i = 0; i < validRawRows.length; i += 1) {
        const row = validRawRows[i];
        const detail = await this.extractDetailMovement({
          context,
          detailsUrl: row.detailsUrl,
          timeoutMs: cfg.searchTimeoutMs,
          isDebug,
          requestId,
          userId,
          documentMasked,
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
            debugLevel: debugOptions.level || 'minimal',
          },
        };

        rawRowsWithDetails.push(rowWithDetail);
      }
      logStep('H_open_detail_end', { durationMs: Date.now() - stepHStartedAt });

      const stepGStartedAt = Date.now();
      const discardReasons = {};
      const parser = this.getParser();
      const items = parser(rawRowsWithDetails, (warning) => {
        discardReasons[warning.reason] = (discardReasons[warning.reason] || 0) + 1;
        emitDebugWarning('normalize_item_rejected', warning);
      });
      debugSummary.normalizedItemsCount = items.length;
      if (debugData && includeWarnings) debugData.discardReasons = discardReasons;

      return {
        source: this.getId(),
        sourceLabel: this.getLabel(),
        status: 'success',
        items,
        providerMeta: { maturity: this.getMaturityStatus(), debugLevel: debugOptions.level || 'minimal' },
        debugSummary,
        debugData,
      };
    } catch (err) {
      if (!debugSummary.failureStage) debugSummary.failureStage = 'exception';
      log.error('ConsultaProcessualProviderError', {
        source: this.getId(),
        errorMessage: err.message,
      });

      return {
        source: this.getId(),
        sourceLabel: this.getLabel(),
        status: 'error',
        items: [],
        providerMeta: { maturity: this.getMaturityStatus(), debugLevel: debugOptions.level || 'minimal' },
        debugSummary,
        debugData,
        error: this.classifyError(err),
      };
    } finally {
      if (browser) await browser.close().catch(() => {});
    }
  }

  // Simplified for base class, assuming CPF for now as per current logic, will generalize if needed
  async consultarPorCpf(ctx) {
    return this.consultarPorDocumento({
      document: ctx.cpf,
      documentMasked: ctx.cpfMasked,
      ...ctx
    });
  }

  maskFieldValue(value) {
    const digits = String(value || '').replace(/\D/g, '');
    if (!digits) return null;
    if (digits.length === 11) {
      return `***.***.${digits.slice(6, 9)}-${digits.slice(9)}`;
    }
    if (digits.length === 14) {
        return `***.***.${digits.slice(8, 12)}-${digits.slice(12)}`;
    }
    if (digits.length <= 4) return `***${digits.slice(-2)}`;
    return `***${digits.slice(-4, -2)}***`;
  }

  onlyDigits(value) {
    return String(value || '').replace(/\D/g, '');
  }

  async fillDocumentWithFallback(page, { docDigits, docFieldSelector, radioSelector }) {
    const strategies = [docDigits, this.formatDocument(docDigits)];
    const field = page.locator(docFieldSelector);

    // Try to select CNPJ if it's 14 digits
    if (docDigits.length === 14) {
        const cnpjRadio = page.locator(radioSelector).last();
        if (await cnpjRadio.isVisible()) {
            await cnpjRadio.check();
        }
    } else {
        await page.locator(radioSelector).first().check();
    }

    for (const strategyValue of strategies) {
      await field.click({ force: true });
      await field.fill('');
      await page.keyboard.press('Control+a').catch(() => {});
      await page.keyboard.press('Backspace').catch(() => {});
      await field.type(strategyValue, { delay: 30 });
      const onlyDigits = this.onlyDigits(await field.inputValue());
      if (onlyDigits.length === docDigits.length && onlyDigits === docDigits) {
        return { usedStrategy: strategyValue, strategies };
      }
    }

    return { usedStrategy: null, strategies };
  }

  formatDocument(digits) {
    if (digits.length === 11) {
        return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
    }
    if (digits.length === 14) {
        return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
    }
    return digits;
  }

  async waitForRealResultsUpdate(page, {
    timeoutMs,
    previousPanelBodyHtml,
    previousPanelText = '',
    previousLinkSignatures = [],
    previousCnjMatchesFound = 0,
    selectors,
  }) {
    const startedAt = Date.now();
    const pollIntervalMs = 250;

    while (Date.now() - startedAt < timeoutMs) {
      const snapshot = await page.evaluate(({ prevHtml, prevPanelText, prevLinkSignatures, prevCnjMatchesFoundValue, gridPanelId, gridPanelBodyId }) => {
        const CNJ_RE = /\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/g;
        const RESULT_RE = /(\d+)\s+resultados? encontrados/i;
        const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();

        const gridPanelBody = document.getElementById(gridPanelBodyId);
        const gridPanel = document.getElementById(gridPanelId);
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
        gridPanelId: selectors.gridPanel,
        gridPanelBodyId: selectors.gridPanelBody,
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

    throw new Error(`Timeout waiting for real PJe results update (${timeoutMs}ms)`);
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

module.exports = PjeConsultaPublicaBaseProvider;
