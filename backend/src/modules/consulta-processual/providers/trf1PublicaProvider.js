const fs = require('fs/promises');
const path = require('path');

const ConsultaProcessualProvider = require('./ConsultaProcessualProvider');
const { createSourceResult } = require('../dto/consultaProcessualDto');
const { createPjeParser } = require('../parsers/pjeProcessParser');
const { getConsultaProcessualConfig } = require('../utils/consultaProcessualConfig');
const { launchBrowser } = require('../service/playwrightBrowserService');

const TRF1_URL = 'https://pje1g-consultapublica.trf1.jus.br/consultapublica/ConsultaPublica/listView.seam';
const CNJ_REGEX = /\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/g;

function nowMs() { return Date.now(); }
function clean(v) { return String(v || '').replace(/\s+/g, ' ').trim(); }
function maskDocument(v) {
  const digits = String(v || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length <= 4) return '*'.repeat(digits.length);
  return `${'*'.repeat(Math.max(digits.length - 4, 0))}${digits.slice(-4)}`;
}

class Trf1PublicaProvider extends ConsultaProcessualProvider {
  getId() { return 'trf1'; }
  getLabel() { return 'TRF1'; }
  isEnabled() { return getConsultaProcessualConfig().trf1Enabled; }

  async consultarPorDocumento({ document, documentMasked, requestId, userId, debug }) {
    const cfg = getConsultaProcessualConfig();
    const debugLevel = debug?.enabled ? (debug?.level || 'detailed') : 'minimal';
    const detailed = debugLevel === 'detailed';
    const parseRows = createPjeParser('trf1', 'TRF1');
    const debugData = {
      requestId,
      source: this.getId(),
      debugLevel,
      steps: [],
      warnings: [],
      artifacts: [],
      domInspection: {},
      waitSignals: [],
      beforeSubmitSignals: null,
      afterSubmitSignals: null,
      failureStage: null,
    };
    const debugSummary = {
      pageLoaded: false,
      documentFieldFound: false,
      searchTriggered: false,
      submitSucceeded: false,
      waitConditionMatched: null,
      declaredResultsCount: 0,
      normalizedItemsCount: 0,
      failureStage: null,
    };

    const recordStep = (stage, data = {}) => debugData.steps.push({ stage, at: new Date().toISOString(), ...data });
    const addWarning = (code, message, meta = {}) => debugData.warnings.push({ code, message, ...meta });

    const artifactRoot = path.join(process.cwd(), 'tmp', 'consulta-processual', this.getId(), String(requestId || `req-${Date.now()}`));
    const saveArtifact = async (name, content, encoding = 'utf8') => {
      if (!detailed) return null;
      await fs.mkdir(artifactRoot, { recursive: true });
      const filePath = path.join(artifactRoot, name);
      await fs.writeFile(filePath, content, encoding);
      const artifact = { name, path: filePath };
      debugData.artifacts.push(artifact);
      return artifact;
    };
    const saveScreenshot = async (page, name) => {
      if (!detailed) return null;
      await fs.mkdir(artifactRoot, { recursive: true });
      const filePath = path.join(artifactRoot, name);
      await page.screenshot({ path: filePath, fullPage: true });
      const artifact = { name, path: filePath };
      debugData.artifacts.push(artifact);
      return artifact;
    };

    const browserResult = await launchBrowser({ config: cfg });
    if (!browserResult.ok) {
      return createSourceResult({
        source: this.getId(), sourceLabel: this.getLabel(), status: 'skipped', items: [],
        error: { code: browserResult.reasonCode || 'PLAYWRIGHT_UNAVAILABLE', message: browserResult.reason || 'Playwright indisponível.' },
      });
    }

    let context; let page;
    let domLengthBefore = 0;
    let beforeSubmitUrl = null;
    const inputDigits = String(document || '').replace(/\D/g, '');

    try {
      const bootStart = nowMs();
      recordStep('A_bootstrap_start', { requestId, source: this.getId(), documentMasked: documentMasked || maskDocument(document) });
      context = await browserResult.browser.newContext();
      page = await context.newPage();
      recordStep('A_bootstrap_end', { browserStarted: true, pageCreated: true, durationMs: nowMs() - bootStart });

      const bStart = nowMs();
      recordStep('B_load_screen_start', { url: TRF1_URL });
      await page.goto(TRF1_URL, { waitUntil: 'domcontentloaded', timeout: cfg.initialLoadTimeoutMs });
      const hasRadio = await page.locator('input[type="radio"]').count().then((n) => n > 0).catch(() => false);
      const hasDocField = await page.locator('#fPP\\:dpDec\\:documentoParte').count().then((n) => n > 0);
      const hasSearchButton = await page.locator('#fPP\\:searchProcessos').count().then((n) => n > 0);
      debugSummary.pageLoaded = true;
      debugSummary.documentFieldFound = hasDocField;
      await saveScreenshot(page, '01-home.png');
      await saveArtifact('01-home-post-load.html', await page.content());
      recordStep('B_load_screen_end', {
        finalUrl: page.url(),
        title: await page.title(),
        hasRadio,
        hasDocField,
        hasSearchButton,
        durationMs: nowMs() - bStart,
      });

      const cStart = nowMs();
      recordStep('C_fill_document_start', { documentMasked: documentMasked || maskDocument(document), strategy: 'fill_digits_input' });
      const cpfInput = page.locator('#fPP\\:dpDec\\:documentoParte');
      await cpfInput.fill(inputDigits);
      await cpfInput.dispatchEvent('input').catch(() => {});
      await cpfInput.dispatchEvent('change').catch(() => {});
      const valueAfterFill = await cpfInput.inputValue().catch(() => '');
      await saveScreenshot(page, '02-filled.png');
      recordStep('C_fill_document_end', {
        effectiveValueMasked: maskDocument(valueAfterFill),
        digitsCount: String(valueAfterFill || '').replace(/\D/g, '').length,
        observedMaskInDom: valueAfterFill,
        eventsDispatched: ['fill', 'input', 'change'],
        durationMs: nowMs() - cStart,
      });

      const beforePanelHtml = await page.locator('#fPP\\:processosGridPanel').innerHTML().catch(() => '');
      const beforePanelText = await page.locator('#fPP\\:processosGridPanel').innerText().then(clean).catch(() => '');
      const beforeBodyText = await page.locator('#fPP\\:processosGridPanel_body').innerText().then(clean).catch(() => '');
      beforeSubmitUrl = page.url();
      domLengthBefore = (await page.content()).length;
      await saveArtifact('03-panel-before-submit.html', beforePanelHtml);

      const dStart = nowMs();
      recordStep('D_submit_search_start', {
        beforeSubmitUrl,
        domLengthBefore,
        panelBeforeSubmitHtmlSummary: clean(beforePanelHtml).slice(0, 600),
        panelBeforeSubmitTextSummary: (beforeBodyText || beforePanelText).slice(0, 600),
        submitSelector: '#fPP\\:searchProcessos',
        waitStrategy: 'poll_panel_text_and_links',
      });

      const waitTimeline = [];
      const gatherSignals = async () => {
        const url = page.url();
        const title = await page.title().catch(() => '');
        const panelText = await page.locator('#fPP\\:processosGridPanel').innerText().then(clean).catch(() => '');
        const bodyText = await page.locator('#fPP\\:processosGridPanel_body').innerText().then(clean).catch(() => '');
        const text = bodyText || panelText;
        const linksFound = await page.locator('#fPP\\:processosTable a[href]').count().catch(() => 0);
        const cnjMatchesFound = (text.match(CNJ_REGEX) || []).length;
        const resultMatch = text.match(/(\d+)\s+resultados?\s+encontrados/i);
        const declaredResultsCount = Number(resultMatch?.[1] || 0);
        const documentValue = await page.locator('#fPP\\:dpDec\\:documentoParte').inputValue().catch(() => '');
        return {
          url,
          title,
          panelTextSummary: text.slice(0, 600),
          hasResultCountText: Boolean(resultMatch),
          declaredResultsCount,
          cnjMatchesFound,
          linksFound,
          inputPreservedAfterSubmit: String(documentValue || '').replace(/\D/g, '').endsWith(inputDigits.slice(-4)),
          inputValueMasked: maskDocument(documentValue),
        };
      };

      debugData.beforeSubmitSignals = await gatherSignals();
      await page.locator('#fPP\\:searchProcessos').click();
      debugSummary.searchTriggered = true;
      let waitConditionMatched = false;
      const waitStart = nowMs();
      while (nowMs() - waitStart < cfg.searchTimeoutMs) {
        const signals = await gatherSignals();
        waitTimeline.push(signals);
        if (signals.hasResultCountText || signals.cnjMatchesFound > 0 || signals.linksFound > 0) {
          waitConditionMatched = true;
          break;
        }
        await page.waitForTimeout(350);
      }
      debugData.waitSignals = waitTimeline;
      debugSummary.waitConditionMatched = waitConditionMatched;
      if (!waitConditionMatched) {
        throw new Error('TRF1_WAIT_CONDITION_TIMEOUT');
      }

      const afterSubmitUrl = page.url();
      const afterPanelHtml = await page.locator('#fPP\\:processosGridPanel').innerHTML().catch(() => '');
      const afterPanelText = await page.locator('#fPP\\:processosGridPanel').innerText().then(clean).catch(() => '');
      const domLengthAfter = (await page.content()).length;
      const panelChanged = clean(afterPanelText) !== clean(beforeBodyText || beforePanelText);
      const domChanged = domLengthAfter !== domLengthBefore;
      debugData.afterSubmitSignals = await gatherSignals();
      await saveScreenshot(page, '03-results.png');
      await saveArtifact('03-panel-after-submit.html', afterPanelHtml);
      await saveArtifact('03-panel-diff-summary.json', JSON.stringify({
        beforeUrl: beforeSubmitUrl,
        afterUrl: afterSubmitUrl,
        domLengthBefore,
        domLengthAfter,
        domChanged,
        panelChanged,
        panelDelta: clean(afterPanelText).slice(0, 400),
      }, null, 2));

      recordStep('D_submit_search_end', {
        clickExecuted: true,
        urlChanged: beforeSubmitUrl !== afterSubmitUrl,
        beforeSubmitUrl,
        afterSubmitUrl,
        domChanged,
        panelChanged,
        panelDelta: clean(afterPanelText).slice(0, 400),
        waitConditionMatched,
        durationMs: nowMs() - dStart,
        relevantNetworkResponses: [],
        ajaxResponse: null,
      });
      debugSummary.submitSucceeded = true;

      const eStart = nowMs();
      recordStep('E_capture_results_start', { note: 'capture grid and page structures' });
      const extraction = await page.evaluate(() => {
        const cleanInner = (v) => String(v || '').replace(/\s+/g, ' ').trim();
        const panel = document.getElementById('fPP:processosGridPanel');
        const panelBody = document.getElementById('fPP:processosGridPanel_body');
        const processTable = document.querySelector('#fPP\\:processosTable');
        const panelText = cleanInner(panelBody?.innerText || panel?.innerText || '');
        const countMatch = panelText.match(/(\d+)\s+resultados?\s+encontrados/i);
        const rows = Array.from(document.querySelectorAll('#fPP\\:processosTable tbody tr')).map((tr) => {
          const text = cleanInner(tr.innerText);
          const detailLink = tr.querySelector('a[href]');
          const links = Array.from(tr.querySelectorAll('a[href]')).map((a) => cleanInner(a.textContent));
          const title = links.find((t) => /\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/.test(t)) || text;
          const classe = cleanInner((text.match(/Classe\s*:?\s*([^\n]+)/i) || [])[1]);
          const partes = cleanInner((text.match(/Partes\s*:?\s*([^\n]+)/i) || [])[1]);
          const mov = cleanInner((text.match(/Última\s+movimenta[cç][aã]o\s*:?\s*([^\n]+)/i) || [])[1]);
          return {
            processTitle: title,
            processClass: classe || null,
            parties: partes || null,
            listLastMovementText: mov || null,
            rawLastMovementText: mov || null,
            detailsUrl: detailLink ? new URL(detailLink.getAttribute('href'), window.location.origin).href : null,
            rawText: text,
          };
        });
        return {
          rows,
          panelText,
          linksFound: document.querySelectorAll('#fPP\\:processosTable a[href]').length,
          hasGridPanel: Boolean(panel),
          hasGridPanelBody: Boolean(panelBody),
          hasProcessTable: Boolean(processTable),
          declaredResultsCount: Number(countMatch?.[1] || rows.length || 0),
          cnjMatchesFound: (panelText.match(/\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/g) || []).length,
        };
      });

      await saveScreenshot(page, '04-results-area.png');
      await saveArtifact('results-page.html', await page.content());
      await saveArtifact('results-grid.html', await page.locator('#fPP\\:processosGridPanel').innerHTML().catch(() => ''));
      await saveArtifact('results-grid-body.html', await page.locator('#fPP\\:processosGridPanel_body').innerHTML().catch(() => ''));
      await saveArtifact('results-table.html', await page.locator('#fPP\\:processosTable').innerHTML().catch(() => ''));
      await saveArtifact('results-text.txt', extraction.panelText || '');

      recordStep('E_capture_results_end', {
        hasGridPanel: extraction.hasGridPanel,
        hasGridPanelBody: extraction.hasGridPanelBody,
        hasProcessTable: extraction.hasProcessTable,
        resultsTextDetected: Boolean(extraction.panelText),
        declaredResultsCount: extraction.declaredResultsCount,
        linksFound: extraction.linksFound,
        cnjMatchesFound: extraction.cnjMatchesFound,
        panelTextSummary: (extraction.panelText || '').slice(0, 600),
        durationMs: nowMs() - eStart,
      });

      const fStart = nowMs();
      recordStep('F_parse_raw_start', { candidateBlocks: extraction.rows.length });
      extraction.rows.forEach((row, index) => {
        const hasCnj = CNJ_REGEX.test(String(row.processTitle || row.rawText || ''));
        CNJ_REGEX.lastIndex = 0;
        const hasHref = Boolean(row.detailsUrl);
        const hasParties = Boolean(row.parties);
        const ignored = !(hasCnj || hasHref || hasParties);
        recordStep('F_parse_raw_block', {
          index,
          ignored,
          reason: ignored ? 'missing_cnj_href_and_parties' : null,
          hasCnj,
          hasHref,
          hasClass: Boolean(row.processClass),
          hasParties,
          snippet: clean(row.rawText || row.processTitle).slice(0, 220),
        });
      });
      recordStep('F_parse_raw_end', { rawBlocksFound: extraction.rows.length, candidateRows: extraction.rows.length, durationMs: nowMs() - fStart });

      const gStart = nowMs();
      recordStep('G_normalization_start', { rawItemsCount: extraction.rows.length });
      const items = parseRows(extraction.rows);
      const discardedCount = Math.max(extraction.rows.length - items.length, 0);
      recordStep('G_normalization_end', {
        normalizedItemsCount: items.length,
        discardedCount,
        discardReasons: discardedCount ? ['parser_filters'] : [],
      });

      const validRows = items.filter((it) => it.detailsUrl).slice(0, 2);
      recordStep('H_open_detail_start', { validRows: validRows.length });
      for (let i = 0; i < validRows.length; i += 1) {
        const it = validRows[i];
        recordStep('H_open_detail_attempt', { index: i, processNumber: it.processNumber, detailsUrl: it.detailsUrl });
        try {
          const detailPage = await context.newPage();
          await detailPage.goto(it.detailsUrl, { waitUntil: 'domcontentloaded', timeout: cfg.initialLoadTimeoutMs });
          const movementText = await detailPage.locator('body').innerText().catch(() => '');
          const movementLines = String(movementText).split('\n').map((l) => clean(l)).filter(Boolean).slice(0, 60);
          const movementLine = movementLines.find((line) => /\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2}/.test(line)) || '';
          const movementAt = (movementLine.match(/(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})/) || [])[1] || null;
          const movementDescription = clean(movementLine.replace(/\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2}\s*-?\s*/, '')) || null;
          await saveScreenshot(detailPage, `process-${i + 1}-detail.png`);
          await saveArtifact(`process-${i + 1}-detail.html`, await detailPage.content());
          await saveArtifact(`process-${i + 1}-movements.txt`, movementLines.join('\n'));
          recordStep('H_open_detail_result', {
            finalUrl: detailPage.url(),
            hasMovementsBlock: movementLines.length > 0,
            movementsCount: movementLines.length,
          });
          recordStep('I_parse_latest_movement', {
            rawMovementText: movementLine || null,
            extractedMovementAt: movementAt,
            extractedMovementDescription: movementDescription,
            normalizedSuccess: Boolean(movementLine),
          });
          await detailPage.close().catch(() => {});
        } catch (detailErr) {
          addWarning('DETAIL_OPEN_FAILED', detailErr.message, { index: i, detailsUrl: it.detailsUrl });
        }
      }

      debugSummary.declaredResultsCount = extraction.declaredResultsCount;
      debugSummary.normalizedItemsCount = items.length;
      recordStep('J_consolidation_end', {
        totalItemsListed: extraction.rows.length,
        totalReturned: items.length,
        totalDurationMs: debugData.steps.length ? (nowMs() - new Date(debugData.steps[0].at).getTime()) : 0,
      });

      return createSourceResult({
        source: 'trf1',
        sourceLabel: 'TRF1',
        status: 'success',
        items,
        debugSummary,
        debugData: debug?.enabled ? debugData : null,
      });
    } catch (err) {
      const currentUrl = page ? page.url() : null;
      const currentTitle = page ? await page.title().catch(() => null) : null;
      const panelTextSummary = page ? await page.locator('#fPP\\:processosGridPanel').innerText().then((t) => clean(t).slice(0, 600)).catch(() => '') : '';
      const domLengthAfter = page ? await page.content().then((html) => html.length).catch(() => 0) : 0;
      const inputValue = page ? await page.locator('#fPP\\:dpDec\\:documentoParte').inputValue().catch(() => '') : '';
      const screenshot = page ? await saveScreenshot(page, 'error-state.png').catch(() => null) : null;
      const htmlArtifact = page ? await saveArtifact('error-state.html', await page.content().catch(() => '')).catch(() => null) : null;
      const timeoutEnriched = err.message.includes('TIMEOUT') || err.message.includes('Timeout');
      const failureStage = debugSummary.submitSucceeded ? 'parse_or_extract' : 'submit_or_wait';
      debugSummary.failureStage = failureStage;
      debugData.failureStage = failureStage;
      const lastObservedSignals = debugData.waitSignals.length ? debugData.waitSignals[debugData.waitSignals.length - 1] : null;
      const enrichedError = {
        code: 'TRF1_QUERY_FAILED',
        message: timeoutEnriched ? 'TRF1 timed out while waiting for observable submit signals.' : err.message,
        stage: failureStage,
        waitStrategy: 'poll_panel_text_and_links',
        timeoutMs: cfg.searchTimeoutMs,
        beforeSubmitSignals: debugData.beforeSubmitSignals,
        lastObservedSignals,
        currentUrl,
        currentTitle,
        documentValueMasked: maskDocument(inputValue),
        panelTextSummary,
        domLengthBefore,
        domLengthAfter,
        screenshotPath: screenshot?.path || null,
        htmlPath: htmlArtifact?.path || null,
      };
      recordStep('J_consolidation_end', { totalItemsListed: 0, totalReturned: 0, totalDurationMs: debugData.steps.length ? (nowMs() - new Date(debugData.steps[0].at).getTime()) : 0 });
      return createSourceResult({ source: 'trf1', sourceLabel: 'TRF1', status: 'error', items: [], error: enrichedError, debugSummary, debugData: debug?.enabled ? debugData : null });
    } finally {
      if (page) await page.close().catch(() => {});
      if (context) await context.close().catch(() => {});
      await browserResult.browser.close().catch(() => {});
    }
  }
}

module.exports = Trf1PublicaProvider;
