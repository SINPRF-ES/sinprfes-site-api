const fs = require('fs/promises');
const path = require('path');

const ConsultaProcessualProvider = require('./ConsultaProcessualProvider');
const { createSourceResult } = require('../dto/consultaProcessualDto');
const { createPjeParser } = require('../parsers/pjeProcessParser');
const { getConsultaProcessualConfig } = require('../utils/consultaProcessualConfig');
const { launchBrowser } = require('../service/playwrightBrowserService');

const TRF1_URL = 'https://pje1g-consultapublica.trf1.jus.br/consultapublica/ConsultaPublica/listView.seam';
const CNJ_REGEX = /\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/g;
const MAX_DEBUG_EVENTS = 60;
const MAX_DEBUG_ATTEMPT_REQUESTS = 10;

function nowMs() { return Date.now(); }
function clean(v) { return String(v || '').replace(/\s+/g, ' ').trim(); }
function maskDocument(v) {
  const digits = String(v || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length <= 4) return '*'.repeat(digits.length);
  return `${'*'.repeat(Math.max(digits.length - 4, 0))}${digits.slice(-4)}`;
}

function compactArray(items, limit = MAX_DEBUG_EVENTS) {
  if (!Array.isArray(items)) return [];
  if (items.length <= limit) return items;
  return [
    ...items.slice(0, limit),
    {
      truncated: true,
      omitted: items.length - limit,
      reason: 'DEBUG_EVENT_LIMIT_REACHED',
    },
  ];
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
      browserConsole: [],
      pageErrors: [],
      requestFailures: [],
      networkRequests: [],
      submitAttempts: [],
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
    const inputMasked = String(documentMasked || document || '');

    try {
      const bootStart = nowMs();
      recordStep('A_bootstrap_start', { requestId, source: this.getId(), documentMasked: documentMasked || maskDocument(document) });
      context = await browserResult.browser.newContext();
      page = await context.newPage();
      page.on('console', (msg) => {
        if (!detailed) return;
        debugData.browserConsole.push({ type: msg.type(), text: msg.text(), location: msg.location?.() || null, at: new Date().toISOString() });
      });
      page.on('pageerror', (err) => {
        if (!detailed) return;
        debugData.pageErrors.push({ message: err?.message || String(err), stack: err?.stack || null, at: new Date().toISOString() });
      });
      const requestIndex = new Map();
      const networkRequests = [];
      page.on('request', (request) => {
        const resType = request.resourceType();
        if (['image', 'stylesheet', 'font', 'media'].includes(resType)) return;
        const event = {
          method: request.method(),
          url: request.url(),
          resourceType: resType,
          at: nowMs(),
        };
        networkRequests.push(event);
        requestIndex.set(request, event);
      });
      page.on('requestfinished', async (request) => {
        const event = requestIndex.get(request);
        if (!event) return;
        const response = await request.response().catch(() => null);
        event.status = response?.status?.() || null;
        event.responseHeaders = response ? {
          'content-type': response.headers()['content-type'] || null,
          'set-cookie': response.headers()['set-cookie'] || null,
          location: response.headers().location || null,
        } : null;
      });
      page.on('requestfailed', (request) => {
        const failure = {
          method: request.method(),
          url: request.url(),
          errorText: request.failure()?.errorText || 'unknown',
          at: new Date().toISOString(),
        };
        debugData.requestFailures.push(failure);
      });
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
      recordStep('C_fill_document_start', { documentMasked: documentMasked || maskDocument(document), strategy: 'multi_strategy_fill' });
      const cpfInput = page.locator('#fPP\\:dpDec\\:documentoParte');
      const cpfRadio = page.locator('input[type="radio"][value*="CPF"], input[type="radio"][id*="cpf" i], input[type="radio"][name*="tipo" i]');
      const triggerPostFillEvents = async () => {
        await cpfInput.dispatchEvent('input').catch(() => {});
        await cpfInput.dispatchEvent('change').catch(() => {});
        await cpfInput.dispatchEvent('blur').catch(() => {});
      };
      const humanType = async (value) => {
        await cpfInput.click({ timeout: 5000 });
        await page.keyboard.press('Control+A').catch(() => {});
        await page.keyboard.press('Meta+A').catch(() => {});
        await page.keyboard.press('Backspace').catch(() => {});
        await cpfInput.fill('').catch(() => {});
        for (const ch of String(value || '')) {
          await page.keyboard.type(ch, { delay: 35 });
        }
      };
      await humanType(inputDigits);
      await triggerPostFillEvents();
      let valueAfterFill = await cpfInput.inputValue().catch(() => '');
      const fillAttempts = [{ strategy: 'A_human_typing_digits', domValue: valueAfterFill }];
      await cpfRadio.first().check({ force: true }).catch(() => {});
      await cpfRadio.first().check({ force: true }).catch(() => {});
      await humanType(inputDigits);
      await triggerPostFillEvents();
      valueAfterFill = await cpfInput.inputValue().catch(() => '');
      fillAttempts.push({ strategy: 'B_radio_recheck_then_fill_digits', domValue: valueAfterFill });
      await humanType(inputMasked);
      await triggerPostFillEvents();
      valueAfterFill = await cpfInput.inputValue().catch(() => '');
      fillAttempts.push({ strategy: 'C_user_masked_value', domValue: valueAfterFill });
      await humanType(inputDigits);
      await triggerPostFillEvents();
      valueAfterFill = await cpfInput.inputValue().catch(() => '');
      fillAttempts.push({ strategy: 'D_digits_and_mask_validation', domValue: valueAfterFill, maskDetected: /\d{3}\.\d{3}\.\d{3}-\d{2}/.test(valueAfterFill) });
      await saveScreenshot(page, '02-filled.png');
      recordStep('C_fill_document_end', {
        effectiveValueMasked: maskDocument(valueAfterFill),
        digitsCount: String(valueAfterFill || '').replace(/\D/g, '').length,
        observedMaskInDom: valueAfterFill,
        eventsDispatched: ['input', 'change', 'blur'],
        attempts: fillAttempts,
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
      const beforeSubmitNetworkCount = networkRequests.length;
      const readJsessionId = (value) => {
        const match = String(value || '').match(/jsessionid=([^;]+)/i) || String(value || '').match(/;jsessionid=([^?&#/]+)/i);
        return match?.[1] || null;
      };
      const gatherSignals = async () => {
        const url = page.url();
        const title = await page.title().catch(() => '');
        const panelHtml = await page.locator('#fPP\\:processosGridPanel').innerHTML().catch(() => '');
        const panelText = await page.locator('#fPP\\:processosGridPanel').innerText().then(clean).catch(() => '');
        const bodyText = await page.locator('#fPP\\:processosGridPanel_body').innerText().then(clean).catch(() => '');
        const text = bodyText || panelText;
        const linksFound = await page.locator('#fPP\\:processosTable a[href]').count().catch(() => 0);
        const cnjMatchesFound = (text.match(CNJ_REGEX) || []).length;
        const resultMatch = text.match(/(\d+)\s+resultados?\s+encontrados/i);
        const declaredResultsCount = Number(resultMatch?.[1] || 0);
        const documentValue = await page.locator('#fPP\\:dpDec\\:documentoParte').inputValue().catch(() => '');
        const pageHtml = await page.content().catch(() => '');
        const requestSlice = networkRequests.slice(beforeSubmitNetworkCount);
        const compatiblePostRequest = requestSlice.find((req) => req.method === 'POST' && /listView\.seam/.test(req.url) && typeof req.status === 'number');
        const xhrOrFetch = requestSlice.filter((req) => ['xhr', 'fetch'].includes(req.resourceType));
        const jsessionFromNetwork = requestSlice.map((req) => readJsessionId(req.url)).find(Boolean) || null;
        return {
          url,
          title,
          panelTextSummary: text.slice(0, 600),
          hasResultCountText: Boolean(resultMatch),
          declaredResultsCount,
          cnjMatchesFound,
          linksFound,
          panelHtmlLength: panelHtml.length,
          domLength: pageHtml.length,
          jsessionId: readJsessionId(url) || jsessionFromNetwork,
          inputPreservedAfterSubmit: String(documentValue || '').replace(/\D/g, '').endsWith(inputDigits.slice(-4)),
          inputValueMasked: maskDocument(documentValue),
          hasCompatiblePost: Boolean(compatiblePostRequest),
          xhrOrFetchCount: xhrOrFetch.length,
        };
      };

      const getSubmitButtonMetadata = async () => page.evaluate(() => {
        const button = document.querySelector('#fPP\\:searchProcessos');
        if (!button) return { found: false };
        const rect = button.getBoundingClientRect();
        const centerX = rect.left + (rect.width / 2);
        const centerY = rect.top + (rect.height / 2);
        const topEl = document.elementFromPoint(centerX, centerY);
        return {
          found: true,
          selector: '#fPP\\:searchProcessos',
          outerHTMLSummary: String(button.outerHTML || '').replace(/\s+/g, ' ').trim().slice(0, 600),
          textContent: String(button.textContent || '').trim(),
          value: button.value || null,
          disabled: Boolean(button.disabled),
          ariaDisabled: button.getAttribute('aria-disabled'),
          className: button.className || null,
          onclick: button.getAttribute('onclick') || null,
          boundingBox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
          visible: !!(rect.width && rect.height),
          coveredBy: topEl && topEl !== button ? (topEl.id || topEl.className || topEl.tagName) : null,
          elementFromPoint: topEl ? { tag: topEl.tagName, id: topEl.id || null, className: topEl.className || null } : null,
          hasJsfAjaxHint: /A4J|RichFaces|jsf|ajax/i.test(`${button.getAttribute('onclick') || ''} ${button.className || ''}`),
          formId: button.form?.id || null,
        };
      }).catch(() => ({ found: false }));

      const waitForObservableSignals = async (strategyName, baseline) => {
        const startedAt = nowMs();
        while (nowMs() - startedAt < cfg.searchTimeoutMs) {
          const signals = await gatherSignals();
          waitTimeline.push({ strategyName, ...signals });
          const reasons = [];
          if (signals.panelHtmlLength !== baseline.panelHtmlLength) reasons.push('panel_html_changed');
          if (signals.hasResultCountText && (signals.declaredResultsCount > baseline.declaredResultsCount || !baseline.hasResultCountText)) reasons.push('result_count_text');
          if (signals.cnjMatchesFound > baseline.cnjMatchesFound) reasons.push('cnj_matches_incremented');
          if (signals.linksFound > baseline.linksFound) reasons.push('process_links_found');
          if (signals.domLength !== baseline.domLength) reasons.push('container_dom_changed');
          if (signals.hasCompatiblePost) reasons.push('compatible_post_completed');
          if (signals.jsessionId && baseline.jsessionId && signals.jsessionId !== baseline.jsessionId) reasons.push('jsessionid_changed');
          if (reasons.length) return { matched: true, reasons, signals };
          await page.waitForTimeout(350);
        }
        return { matched: false, reasons: [], signals: await gatherSignals() };
      };

      const submitStrategies = [
        {
          name: 'submit_1_human_mouse_click',
          run: async () => {
            const button = page.locator('#fPP\\:searchProcessos');
            await button.scrollIntoViewIfNeeded().catch(() => {});
            const box = await button.boundingBox();
            if (box) {
              await page.mouse.move(box.x + (box.width / 2), box.y + (box.height / 2));
              await page.mouse.down();
              await page.mouse.up();
            }
            await button.click({ timeout: 5000 });
          },
        },
        { name: 'submit_2_force_click', run: async () => page.locator('#fPP\\:searchProcessos').click({ force: true, timeout: 5000 }) },
        {
          name: 'submit_3_press_enter_in_field',
          run: async () => {
            await cpfInput.focus();
            await cpfInput.dispatchEvent('blur').catch(() => {});
            await cpfInput.focus();
            await page.keyboard.press('Enter');
          },
        },
        {
          name: 'submit_4_form_submit',
          run: async () => {
            const didSubmit = await page.evaluate(() => {
              const button = document.querySelector('#fPP\\:searchProcessos');
              const form = button?.form || document.querySelector('form[id^="fPP"]');
              if (!form) return false;
              if (typeof form.submit !== 'function') return false;
              form.submit();
              return true;
            });
            if (!didSubmit) throw new Error('FORM_NOT_SUBMITTABLE');
          },
        },
        {
          name: 'submit_5_jsf_richfaces_handler',
          run: async () => {
            const didRun = await page.evaluate(() => {
              const button = document.querySelector('#fPP\\:searchProcessos');
              if (!button) return false;
              const onclick = button.getAttribute('onclick') || '';
              const hasJsfHint = /A4J|RichFaces|jsf|ajax/i.test(onclick) || typeof window.A4J !== 'undefined' || typeof window.RichFaces !== 'undefined';
              if (!hasJsfHint) return false;
              if (onclick && typeof button.onclick === 'function') {
                button.onclick(new MouseEvent('click', { bubbles: true, cancelable: true }));
                return true;
              }
              button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
              return true;
            });
            if (!didRun) throw new Error('NO_JSF_HANDLER_EVIDENCE');
          },
        },
      ];

      debugData.beforeSubmitSignals = await gatherSignals();
      let waitConditionMatched = false;
      for (const strategy of submitStrategies) {
        const strategyStart = nowMs();
        const baselineSignals = await gatherSignals();
        const buttonMetadata = await getSubmitButtonMetadata();
        const networkBefore = networkRequests.length;
        try {
          await strategy.run();
          debugSummary.searchTriggered = true;
          await saveScreenshot(page, '03-submit-clicked.png');
          await saveArtifact('03-submit-clicked.html', await page.content());
          await saveScreenshot(page, `03-submit-clicked-${strategy.name}.png`);
          await saveArtifact(`03-submit-clicked-${strategy.name}.html`, await page.content());
          const waited = await waitForObservableSignals(strategy.name, baselineSignals);
          const networkAfter = networkRequests.slice(networkBefore);
          const xhrOrFetchAfter = networkAfter.filter((req) => ['xhr', 'fetch'].includes(req.resourceType));
          const attempt = {
            strategy: strategy.name,
            result: waited.matched ? 'success' : 'failed',
            durationMs: nowMs() - strategyStart,
            signalsObserved: waited.reasons,
            lastSignals: waited.signals,
            requestsDispatchedCount: networkAfter.length,
            xhrOrFetchCount: xhrOrFetchAfter.length,
            requestSample: networkAfter.slice(0, MAX_DEBUG_ATTEMPT_REQUESTS),
            postToListViewDetected: networkAfter.some((req) => req.method === 'POST' && /listView\.seam/.test(req.url)),
            buttonMetadata,
            failureReason: waited.matched ? null : 'no_observable_submit_signal',
          };
          debugData.submitAttempts.push(attempt);
          if (waited.matched) {
            waitConditionMatched = true;
            break;
          }
        } catch (strategyErr) {
          debugData.submitAttempts.push({
            strategy: strategy.name,
            result: 'failed',
            durationMs: nowMs() - strategyStart,
            signalsObserved: [],
            requestsDispatchedCount: networkRequests.length - networkBefore,
            requestSample: networkRequests.slice(networkBefore, networkBefore + MAX_DEBUG_ATTEMPT_REQUESTS),
            buttonMetadata,
            failureReason: strategyErr.message,
          });
        }
      }
      debugData.waitSignals = compactArray(waitTimeline);
      debugData.networkRequests = compactArray(networkRequests);
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
          const cells = Array.from(tr.querySelectorAll('td')).map((td) => cleanInner(td.innerText));
          const detailLink = tr.querySelector('a[href]');
          const links = Array.from(tr.querySelectorAll('a[href]')).map((a) => cleanInner(a.textContent));
          const title = links.find((t) => /\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/.test(t)) || text;

          let classe = cells.find((c) => c.startsWith('Classe:')) || '';
          classe = cleanInner(classe.replace(/^Classe:\s*/i, ''));

          let partes = cells.find((c) => c.startsWith('Partes:')) || '';
          partes = cleanInner(partes.replace(/^Partes:\s*/i, ''));

          let mov = cells.find((c) => c.startsWith('Última movimentação:')) || '';
          mov = cleanInner(mov.replace(/^Última movimentação:\s*/i, ''));

          if (!classe) classe = cleanInner((text.match(/Classe\s*:?\s*([^\n]+)/i) || [])[1]);
          if (!partes) partes = cleanInner((text.match(/Partes\s*:?\s*([^\n]+)/i) || [])[1]);
          if (!mov) mov = cleanInner((text.match(/Última\s+movimenta[cç][aã]o\s*:?\s*([^\n]+)/i) || [])[1]);

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
        if (index >= 10) return;
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
          const finalUrl = detailPage.url();
          it.detailsUrl = finalUrl;
          recordStep('H_open_detail_result', {
            finalUrl,
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
