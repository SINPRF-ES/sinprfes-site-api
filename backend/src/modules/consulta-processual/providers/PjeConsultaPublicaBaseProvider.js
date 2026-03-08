const fs = require('fs');
const path = require('path');
const ConsultaProcessualProvider = require('./ConsultaProcessualProvider');
const { getConsultaProcessualConfig } = require('../utils/consultaProcessualConfig');
const { createSourceResult } = require('../dto/consultaProcessualDto');
const { launchBrowser } = require('../service/playwrightBrowserService');
const { inspectResultsDom, cleanText } = require('./trf1DomInspector');
const log = require('../../../utils/log');

class PjeConsultaPublicaBaseProvider extends ConsultaProcessualProvider {
  getBaseUrl() {
    throw new Error('Provider must implement getBaseUrl()');
  }

  getSelectors() {
    return {
      documentRadio: 'input[name="tipoMascaraDocumento"]',
      documentInput: '#fPP\\:dpDec\\:documentoParte',
      searchButton: '#fPP\\:searchProcessos',
      resultsGridPanel: '#fPP\\:processosGridPanel',
      resultsGridPanelBody: '#fPP\\:processosGridPanel_body',
      processTable: '#fPP\\:processosTable',
    };
  }

  getParser() {
    throw new Error('Provider must implement getParser()');
  }

  async consultarPorDocumento({ document, documentMasked, requestId, userId, debug: debugOverride }) {
    const startedAt = Date.now();
    const cfg = getConsultaProcessualConfig();
    const isDebug = Boolean(debugOverride || cfg.debug);
    const selectors = this.getSelectors();
    const baseUrl = this.getBaseUrl();

    if (!this.isEnabled()) {
      return createSourceResult({ source: this.getId(), sourceLabel: this.getLabel(), status: 'skipped', items: [] });
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
    if (isDebug) debugSummary.artifactsBaseDir = debugBaseDir;

    const saveArtifact = async (name, content, type = 'text') => {
      if (!isDebug) return;
      try {
        if (!fs.existsSync(debugBaseDir)) fs.mkdirSync(debugBaseDir, { recursive: true });
        const filePath = path.join(debugBaseDir, name);
        if (type === 'screenshot' && content?.screenshot) {
          await content.screenshot({ path: filePath, fullPage: true });
        } else {
          fs.writeFileSync(filePath, String(content || ''), 'utf8');
        }
        if (debugData) debugData.artifacts.push({ name, path: filePath });
      } catch (err) {
        log.warn('ConsultaProcessualDebugArtifactFailed', {
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
        documentMasked,
        timestamp: new Date().toISOString(),
        ...extra,
      };
      if (debugData) debugData.warnings.push(payload);
      log.info('ConsultaProcessualDebugWarning', payload);
    };

    let browser;
    try {
      logStep('A_bootstrap_start');
      const browserResult = await launchBrowser({ config: cfg });
      if (!browserResult.ok) {
        debugSummary.failureStage = 'bootstrap';
        return createSourceResult({ source: this.getId(), sourceLabel: this.getLabel(), status: 'skipped', items: [] });
      }

      browser = browserResult.browser;
      const context = await browser.newContext();
      const page = await context.newPage();
      logStep('A_bootstrap_end', { browserStarted: true, pageCreated: true });

      logStep('B_load_screen_start', { url: baseUrl });
      await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: cfg.initialLoadTimeoutMs });

      const hasRadio = await page.locator(selectors.documentRadio).first().isVisible();
      const hasDocField = await page.locator(selectors.documentInput).isVisible();
      const hasSearchBtn = await page.locator(selectors.searchButton).isVisible();

      debugSummary.pageLoaded = true;
      debugSummary.documentFieldFound = hasDocField;

      logStep('B_load_screen_end', {
        finalUrl: page.url(),
        hasRadio,
        hasDocField,
        hasSearchBtn,
      });

      await saveArtifact('01-home.png', page, 'screenshot');

      if (!hasDocField || !hasSearchBtn) {
        debugSummary.failureStage = 'screen_load';
        throw new Error(`Required selectors not found on ${this.getId()} home page`);
      }

      const documentDigits = String(document || '').replace(/\D/g, '');
      const isCnpj = documentDigits.length === 14;

      logStep('C_fill_document_start', { documentMasked, isCnpj });

      const fillStrategyResult = await this.fillDocumentWithFallback(page, {
        documentDigits,
        isCnpj,
        documentInputSelector: selectors.documentInput,
        documentRadioSelector: selectors.documentRadio,
      });

      const finalInputState = await page.locator(selectors.documentInput).evaluate((input) => {
        const value = String(input?.value || '');
        const digits = value.replace(/\D/g, '');
        return { value, onlyDigits: digits, digitsCount: digits.length };
      });

      debugSummary.inputDigitsCount = finalInputState.digitsCount;
      debugSummary.inputValueMasked = this.maskFieldValue(finalInputState.value);

      logStep('C_fill_document_end', {
        fillStrategyUsed: fillStrategyResult.usedStrategy,
        digitsCount: finalInputState.digitsCount,
      });
      await saveArtifact('02-filled.png', page, 'screenshot');

      const expectedLength = isCnpj ? 14 : 11;
      if (finalInputState.digitsCount !== expectedLength) {
        debugSummary.failureStage = 'input_validation';
        throw new Error(`Document field invalid before submit: found ${finalInputState.digitsCount} digits, expected ${expectedLength}`);
      }

      const beforeSubmitSignals = await page.evaluate((sel) => {
        const CNJ_RE = /\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/g;
        const panelBody = document.querySelector(sel.resultsGridPanelBody);
        const panel = document.querySelector(sel.resultsGridPanel);
        const root = panelBody || panel || document;
        const panelText = (panelBody || panel || document.body)?.innerText || '';
        const links = Array.from(root.querySelectorAll('a[href],a[onclick]'))
          .map((node) => `${node.getAttribute('href')}|${node.getAttribute('onclick')}|${node.textContent}`);
        return {
          panelText,
          linkSignatures: links,
          cnjMatchesFound: (panelText.match(CNJ_RE) || []).length,
        };
      }, selectors);

      logStep('D_submit_search_start');
      await page.locator(selectors.searchButton).click();
      debugSummary.searchTriggered = true;

      let waitInfo;
      try {
        waitInfo = await this.waitForResultsUpdate(page, {
          selectors,
          timeoutMs: cfg.searchTimeoutMs,
          previousSignals: beforeSubmitSignals,
        });
        debugSummary.waitConditionMatched = waitInfo.waitConditionMatched;
      } catch (err) {
        debugSummary.failureStage = 'submit_or_wait';
        emitDebugWarning('D_submit_search_timeout', { errorMessage: err.message });
        await saveArtifact('03-submit-timeout.png', page, 'screenshot');
        throw err;
      }

      debugSummary.submitSucceeded = true;
      logStep('D_submit_search_end', { waitConditionMatched: waitInfo.waitConditionMatched });
      await saveArtifact('03-results.png', page, 'screenshot');

      logStep('E_capture_results_start');
      const extraction = await page.evaluate((sel) => {
        const CNJ_RE = /\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/;
        const DATE_TIME_RE = /\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2}/;
        const clean = (v) => String(v || '').replace(/\s+/g, ' ').trim();

        const gridPanel = document.querySelector(sel.resultsGridPanel);
        const gridPanelBody = document.querySelector(sel.resultsGridPanelBody);
        const processTable = document.querySelector(sel.processTable);
        const panelText = clean((gridPanelBody || gridPanel || document.body)?.innerText || '');

        const rows = processTable ? Array.from(processTable.querySelectorAll('tbody tr')) : [];
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
              if (match && match[2]) detailsUrl = new URL(match[2], window.location.origin).href;
            }
            if (!detailsUrl && href && !href.startsWith('javascript:')) {
              detailsUrl = new URL(href, window.location.origin).href;
            }
          }
          if (detailsUrl) detectedLinks.push(detailsUrl);

          const td1Text = clean(tds[1]?.textContent || '');
          const processNumberMatch = td1Text.match(CNJ_RE);
          if (!processNumberMatch) return { index, ignored: true, reason: 'no_cnj_in_td1' };

          const processNumber = processNumberMatch[0];
          const strongNodes = Array.from(tds[1].querySelectorAll('b, strong'));
          const classCandidate = strongNodes
            .map((node) => clean(node.textContent))
            .find((text) => text && !CNJ_RE.test(text));

          const processTitle = clean(td1Anchor?.textContent || tds[1].querySelector('a')?.textContent || '');
          const processClass = classCandidate || clean(td1Text.split(processNumber)[0] || '');

          const nodeTokens = Array.from(tds[1].childNodes)
            .map((node) => clean(node.textContent))
            .filter(Boolean);

          const partiesCandidate = nodeTokens.find((token) => token.includes(' X ')) || nodeTokens[nodeTokens.length - 1] || '';
          const parties = clean(partiesCandidate.replace(processTitle, '').trim());

          const listLastMovementText = clean(tds[2]?.textContent || '');
          const listMovementDateMatch = listLastMovementText.match(DATE_TIME_RE);
          const listMovementDate = listMovementDateMatch ? listMovementDateMatch[0] : null;

          return {
            index,
            processNumber,
            processClass,
            processTitle: processTitle || `${processClass} ${processNumber}`,
            parties,
            detailsUrl,
            listLastMovementText,
            listLastMovementAt: listMovementDate,
            lastMovement: clean(listLastMovementText.replace(DATE_TIME_RE, '').replace(/[()]/g, ' ')) || null,
            lastMovementAt: listMovementDate,
            rawLastMovementText: listLastMovementText || null,
            providerMeta: { rowIndex: index },
          };
        });

        return {
          hasGridPanel: Boolean(gridPanel),
          hasProcessTable: Boolean(processTable),
          panelText,
          detectedLinks,
          rawRows,
        };
      }, selectors);

      const domInspection = inspectResultsDom(extraction);
      if (debugData) debugData.domInspection = domInspection;
      debugSummary.resultsContainerFound = Boolean(domInspection.hasGridPanel || domInspection.hasProcessTable);
      debugSummary.resultsTextDetected = domInspection.declaredResultsTextDetected;
      debugSummary.declaredResultsCount = domInspection.declaredResultsCount;
      debugSummary.linksFound = domInspection.linksFound;
      debugSummary.cnjMatchesFound = domInspection.cnjMatchesFound;
      debugSummary.rawBlocksFound = extraction.rawRows.length;

      const realResultLoaded = this.isRealSearchResultLoaded(domInspection);
      debugSummary.realResultLoaded = realResultLoaded;

      logStep('E_capture_results_end', { realResultLoaded, count: extraction.rawRows.length });

      if (!realResultLoaded) {
        debugSummary.failureStage = 'submit_or_wait';
        return createSourceResult({
          source: this.getId(),
          sourceLabel: this.getLabel(),
          status: 'error',
          items: [],
          debugSummary,
          debugData,
          error: { code: 'SUBMIT_OR_WAIT_FAILED', message: 'Pesquisa não carregou resultado real.' },
        });
      }

      const validRawRows = extraction.rawRows.filter((row) => !row.ignored);
      const rawRowsWithDetails = [];

      for (let i = 0; i < validRawRows.length; i++) {
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
        });

        debugSummary.detailPagesOpened += detail.opened ? 1 : 0;
        rawRowsWithDetails.push({
          ...row,
          lastMovement: detail.lastMovement || row.lastMovement,
          lastMovementAt: detail.lastMovementAt || row.lastMovementAt,
          rawLastMovementText: detail.rawLastMovementText || row.rawLastMovementText,
          providerMeta: { ...row.providerMeta, detailsExtracted: Boolean(detail.rawLastMovementText) },
        });
      }

      const parser = this.getParser();
      const discardReasons = {};
      const items = parser(rawRowsWithDetails, (warning) => {
        discardReasons[warning.reason] = (discardReasons[warning.reason] || 0) + 1;
        emitDebugWarning('normalize_item_rejected', warning);
      });

      debugSummary.normalizedItemsCount = items.length;
      if (debugData) debugData.discardReasons = discardReasons;

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
      log.error('PjeProviderError', { source: this.getId(), documentMasked, error: err.message });
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

  async fillDocumentWithFallback(page, { documentDigits, isCnpj, documentInputSelector, documentRadioSelector }) {
    const strategies = [documentDigits];
    if (!isCnpj) {
      strategies.push(`${documentDigits.slice(0, 3)}.${documentDigits.slice(3, 6)}.${documentDigits.slice(6, 9)}-${documentDigits.slice(9)}`);
    } else {
      strategies.push(`${documentDigits.slice(0, 2)}.${documentDigits.slice(2, 5)}.${documentDigits.slice(5, 8)}/${documentDigits.slice(8, 12)}-${documentDigits.slice(12)}`);
    }

    const radios = page.locator(documentRadioSelector);
    if (await radios.first().isVisible()) {
      if (isCnpj && (await radios.count()) > 1) {
        await radios.nth(1).check();
      } else {
        await radios.first().check();
      }
    }

    const field = page.locator(documentInputSelector);
    for (const strategyValue of strategies) {
      await field.click({ force: true });
      await field.fill('');
      await field.type(strategyValue, { delay: 30 });
      const currentVal = await field.inputValue();
      if (currentVal.replace(/\D/g, '') === documentDigits) {
        return { usedStrategy: strategyValue };
      }
    }
    return { usedStrategy: null };
  }

  async waitForResultsUpdate(page, { selectors, timeoutMs, previousSignals }) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const snapshot = await page.evaluate((sel, prev) => {
        const CNJ_RE = /\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/g;
        const RESULT_RE = /(\d+)\s+resultados? encontrados/i;
        const panelBody = document.querySelector(sel.resultsGridPanelBody);
        const panel = document.querySelector(sel.resultsGridPanel);
        const root = panelBody || panel || document;
        const panelText = (panelBody || panel || document.body)?.innerText || '';
        const panelHtml = panelBody?.innerHTML || '';
        const declaredMatch = panelText.match(RESULT_RE);
        const cnjMatches = panelText.match(CNJ_RE) || [];
        const links = Array.from(root.querySelectorAll('a[href],a[onclick]')).length;

        return {
          panelHtmlChanged: panelHtml !== (prev.panelHtml || ''),
          cnjMatchesFound: cnjMatches.length,
          cnjIncreased: cnjMatches.length > (prev.cnjMatchesFound || 0),
          declaredResultsPositive: Number(declaredMatch?.[1] || 0) > 0,
          linksCount: links,
          linksIncreased: links > (prev.linkSignatures?.length || 0),
        };
      }, selectors, previousSignals);

      const matched = (snapshot.declaredResultsPositive && 'declared_results')
        || (snapshot.cnjIncreased && 'cnj_increased')
        || (snapshot.linksIncreased && 'links_increased')
        || (snapshot.panelHtmlChanged && 'html_changed')
        || null;

      if (matched) return { waitConditionMatched: matched, signals: snapshot };
      await page.waitForTimeout(250);
    }
    throw new Error('Timeout waiting for PJe results update');
  }

  isRealSearchResultLoaded(dom) {
    return dom.declaredResultsCount > 0 || dom.cnjMatchesFound > 0 || dom.linksFound > 0;
  }

  async extractDetailMovement({ context, detailsUrl, timeoutMs, artifactPrefix, saveArtifact, logStep }) {
    if (!detailsUrl) return { opened: false };
    const page = await context.newPage();
    try {
      await page.goto(detailsUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
      const detail = await page.evaluate(() => {
        const MOVEMENT_RE = /(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})\s*-\s*(.+)$/;
        const clean = (v) => String(v || '').replace(/\s+/g, ' ').trim();
        const text = document.body.innerText;
        const lines = text.split('\n').map(clean).filter(Boolean);
        const candidates = lines.map(l => {
          const m = l.match(MOVEMENT_RE);
          return m ? { at: m[1], msg: m[2], raw: l } : null;
        }).filter(Boolean);

        return {
          movementsCount: candidates.length,
          lastMovement: candidates[0]?.msg || null,
          lastMovementAt: candidates[0]?.at || null,
          rawLastMovementText: candidates[0]?.raw || null,
          html: document.documentElement.outerHTML,
        };
      });

      await saveArtifact(`${artifactPrefix}-detail.png`, page, 'screenshot');
      return { opened: true, ...detail };
    } catch (err) {
      return { opened: false, error: err.message };
    } finally {
      await page.close().catch(() => {});
    }
  }

  maskFieldValue(value) {
    const digits = String(value || '').replace(/\D/g, '');
    if (!digits) return null;
    if (digits.length === 11) return `***.***.${digits.slice(6, 9)}-${digits.slice(9)}`;
    if (digits.length === 14) return `***${digits.slice(8, 12)}-${digits.slice(12)}`;
    return '***';
  }
}

module.exports = PjeConsultaPublicaBaseProvider;
