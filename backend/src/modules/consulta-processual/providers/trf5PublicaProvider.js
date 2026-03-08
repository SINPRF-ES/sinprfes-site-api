const fs = require('fs');
const path = require('path');
const PjeConsultaPublicaBaseProvider = require('./PjeConsultaPublicaBaseProvider');
const { getConsultaProcessualConfig } = require('../utils/consultaProcessualConfig');
const { launchBrowser } = require('../service/playwrightBrowserService');
const { normalizeItem } = require('../dto/consultaProcessualDto');
const log = require('../../../utils/log');

const CNJ_RE = /\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/g;

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

class Trf5PublicaProvider extends PjeConsultaPublicaBaseProvider {
  getId() { return 'trf5'; }
  getLabel() { return 'TRF5'; }
  isEnabled() { return getConsultaProcessualConfig().trf5Enabled; }
  getMaturityStatus() { return 'experimental'; }

  classifyError(err) {
    if (/dom|selector|diagnostic/i.test(String(err?.message || ''))) {
      return { code: 'DOM_MAPPING_REQUIRED', message: err.message, stage: 'dom_diagnostics_required' };
    }
    return super.classifyError(err);
  }

  getBaseUrl() {
    return 'https://portalbi.trf5.jus.br/portal-bi/painel.html?id=3002';
  }

  async consultarPorDocumento({ document, documentMasked, requestId, userId, debug: debugOverride }) {
    const cfg = getConsultaProcessualConfig();
    const isDebug = Boolean(debugOverride || cfg.debug);
    if (!this.isEnabled()) {
      return { source: this.getId(), sourceLabel: this.getLabel(), status: 'skipped', items: [], providerMeta: { maturity: this.getMaturityStatus() } };
    }

    const debugSummary = {
      pageLoaded: false,
      documentFieldFound: false,
      searchTriggered: false,
      resultsContainerFound: false,
      domInventoryGenerated: false,
      cpfFieldCandidatesCount: 0,
      cpfFieldAutoDetected: false,
      cpfMaskRequired: true,
      maskedInputAccepted: false,
      searchActionCandidatesCount: 0,
      searchActionAutoDetected: false,
      resultsContainerCandidatesCount: 0,
      resultsContainerAutoDetected: false,
      autoDetectionConfidence: 0,
      submitSucceeded: false,
      waitConditionMatched: null,
      realResultLoaded: false,
      declaredResultsCount: 0,
      cnjMatchesFound: 0,
      rawBlocksFound: 0,
      normalizedItemsCount: 0,
      failureStage: null,
    };

    const debugBaseDir = path.resolve(process.cwd(), `backend/tmp/consulta-processual/${this.getId()}`, requestId || 'no-request');
    const debugData = isDebug ? { steps: [], warnings: [], artifacts: [], domDiagnostics: null } : null;

    const saveArtifact = async (name, content, type = 'text') => {
      if (!isDebug) return;
      try {
        if (!fs.existsSync(debugBaseDir)) fs.mkdirSync(debugBaseDir, { recursive: true });
        const filePath = path.join(debugBaseDir, name);
        if (type === 'screenshot' && content?.screenshot) await content.screenshot({ path: filePath, fullPage: true });
        else fs.writeFileSync(filePath, String(content || ''), 'utf8');
        if (debugData) debugData.artifacts.push({ name, path: filePath });
      } catch (err) {
        log.warn('ConsultaProcessualDebugArtifactFailed', { source: this.getId(), artifact: name, error: err.message, requestId, userId });
      }
    };

    const logStep = (step, extra = {}) => {
      if (!debugData) return;
      debugData.steps.push({ step, source: this.getId(), requestId, userId, documentMasked, ...extra, timestamp: new Date().toISOString() });
    };

    const warn = (step, extra = {}) => {
      if (!debugData) return;
      debugData.warnings.push({ step, source: this.getId(), requestId, userId, ...extra, timestamp: new Date().toISOString() });
    };

    let browser;
    try {
      const browserResult = await launchBrowser({ config: cfg });
      if (!browserResult.ok) {
        debugSummary.failureStage = 'browser_launch';
        return {
          source: this.getId(),
          sourceLabel: this.getLabel(),
          status: 'error',
          items: [],
          providerMeta: { maturity: this.getMaturityStatus() },
          debugSummary,
          debugData,
          error: {
            code: browserResult.code || 'BROWSER_UNAVAILABLE',
            message: browserResult.message || 'Não foi possível iniciar o navegador para o provider TRF5.',
            stage: 'browser_launch',
          },
        };
      }
      browser = browserResult.browser;
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.setViewportSize({ width: 1280, height: 1024 });

      await page.goto(this.getBaseUrl(), { waitUntil: 'domcontentloaded', timeout: cfg.initialLoadTimeoutMs });

      // Qlik Sense is heavy. Wait for the loading indicator to disappear.
      logStep('TRF5_waiting_for_hydration');

      // Wait for preloaders to hide
      await Promise.all([
        page.waitForSelector('.qv-preload-icons', { state: 'hidden', timeout: 45000 }),
        page.waitForSelector('.qv-loading-mask', { state: 'hidden', timeout: 45000 }),
      ]).catch(() => {
        warn('TRF5_preload_wait_timeout', { message: 'Qlik preload/loading mask did not disappear' });
      });

      // Strategy: for TRF5 BI, we must FORCE a very long wait in sandbox to ensure heavy dashboards hydrate
      // BI dashboards often take 45-60s to be fully interactive in restricted environments.
      await page.waitForTimeout(45000);

      // Wait for actual Qlik objects to start appearing in ANY frame
      logStep('TRF5_waiting_for_qlik_objects');
      let qlikFound = false;
      for (let i = 0; i < 30; i++) {
        const frames = page.frames();
        for (const frame of frames) {
          if (frame.isDetached()) continue;
          const hasQlik = await frame.evaluate(() =>
            !!document.querySelector('.qv-object, .qv-input, .qv-button, .qui-input, .lui-input, .qv-object-content, [contenteditable="true"]')
          ).catch(() => false);

          if (hasQlik) {
            const isReady = await frame.evaluate(() => {
                const el = document.querySelector('.qv-object, .qv-input, .qui-input, .lui-input, .qv-object-content');
                if (!el) return false;
                const rect = el.getBoundingClientRect();
                // A valid object should have some dimensions
                return rect.width > 20 && rect.height > 10;
            }).catch(() => false);

            if (isReady) {
                qlikFound = true;
                break;
            }
          }
        }
        if (qlikFound) break;
        await page.waitForTimeout(4000);
      }

      if (!qlikFound) warn('TRF5_qlik_objects_not_detected');

      // Additional grace period for extension rendering
      await page.waitForTimeout(10000);
      logStep('TRF5_hydration_wait_completed');

      debugSummary.pageLoaded = true;
      await saveArtifact('01-home.png', page, 'screenshot');
      await saveArtifact('01-home.html', await page.content());

      logStep('TRF5_dom_diagnostics_start');
      const diagnostics = await this.collectDomDiagnostics(page);
      if (debugData) debugData.domDiagnostics = diagnostics;
      debugSummary.domInventoryGenerated = true;
      debugSummary.cpfFieldCandidatesCount = diagnostics.documentFieldCandidates.length;
      debugSummary.searchActionCandidatesCount = diagnostics.searchActionCandidates.length;
      debugSummary.resultsContainerCandidatesCount = diagnostics.resultsContainerCandidates.length;
      debugSummary.cpfFieldAutoDetected = Boolean(diagnostics.documentFieldChosen?.selector);
      debugSummary.searchActionAutoDetected = Boolean(diagnostics.searchActionChosen?.selector);
      debugSummary.resultsContainerAutoDetected = Boolean(diagnostics.resultsContainerChosen?.selector);
      debugSummary.documentFieldFound = debugSummary.cpfFieldAutoDetected;
      debugSummary.resultsContainerFound = debugSummary.resultsContainerAutoDetected;
      debugSummary.autoDetectionConfidence = diagnostics.autoDetectionConfidence;

      await saveArtifact('02-dom-inventory.json', JSON.stringify(diagnostics.domInventory, null, 2));
      await saveArtifact('03-cpf-candidates.json', JSON.stringify({ candidates: diagnostics.documentFieldCandidates, chosen: diagnostics.documentFieldChosen }, null, 2));
      await saveArtifact('04-search-candidates.json', JSON.stringify({ candidates: diagnostics.searchActionCandidates, chosen: diagnostics.searchActionChosen }, null, 2));
      await saveArtifact('05-results-candidates.json', JSON.stringify({ candidates: diagnostics.resultsContainerCandidates, chosen: diagnostics.resultsContainerChosen }, null, 2));

      if (!diagnostics.documentFieldChosen?.selector || !diagnostics.searchActionChosen?.selector) {
        debugSummary.failureStage = 'dom_diagnostics';
        throw new Error('TRF5 DOM diagnostics could not confidently identify document field and search action');
      }

      const documentToSearch = documentMasked || '032.410.634-37';
      logStep('TRF5_fill_document', { documentToSearch, frameIndex: diagnostics.documentFieldChosen.frameIndex });

      const frame = diagnostics.documentFieldChosen.frameIndex !== null
        ? page.frames()[diagnostics.documentFieldChosen.frameIndex]
        : page;

      // Use a more resilient locator: if the chosen selector has an ID, use it. Otherwise try to find it again by role/class in that frame.
      const chosen = diagnostics.documentFieldChosen;
      let field;
      if (chosen.id) {
          const escapedId = chosen.id.replace(/(:|\.|\[|\]|,|=|@)/g, '\\$1');
          field = frame.locator(`#${escapedId}`).first();
      } else if (chosen.tag === 'input') {
          field = frame.locator('input.lui-input, input.qv-input, input[type="text"]').first();
      } else {
          field = frame.locator(chosen.selector).first();
      }

      await field.scrollIntoViewIfNeeded().catch(() => {});

      // Multi-stage input for Qlik
      logStep('TRF5_interacting_with_field', { selector: chosen.selector });
      await field.click({ force: true, timeout: 10000 }).catch((e) => {
          warn('TRF5_field_click_failed', { error: e.message });
      });
      await page.waitForTimeout(1000);

      // Some Qlik fields are divs that become inputs on click. Re-check frame.
      const fieldAfterClick = frame.locator('input.lui-input, input.qv-input, [contenteditable="true"], input').first();

      await fieldAfterClick.fill('').catch(() => {});
      await page.keyboard.press('Control+a').catch(() => {});
      await page.keyboard.press('Backspace').catch(() => {});

      logStep('TRF5_typing_document', { documentToSearch });
      await fieldAfterClick.type(documentToSearch, { delay: 120 });
      await page.waitForTimeout(1000);

      // Strategy: for Qlik, sometimes we need to blur or press Enter to commit the variable
      await fieldAfterClick.dispatchEvent('change').catch(() => {});
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
      await page.keyboard.press('Tab');
      await page.waitForTimeout(2000);

      const valAfter = await fieldAfterClick.inputValue().catch(() => '') || '';
      debugSummary.maskedInputAccepted = valAfter.includes(documentToSearch.replace(/\D/g, '')) || valAfter === documentToSearch;
      await saveArtifact('06-filled-cpf.png', page, 'screenshot');

      // Capture baseline before search
      const baselineSignals = await this.waitForTrf5Signals(page, { timeoutMs: 1000 });
      const baselineCnjCount = baselineSignals?.snapshot?.cnjMatches || 0;
      logStep('TRF5_search_trigger_start', { baselineCnjCount });

      // Attempt to trigger search using multiple strategies
      const triggerStrategies = [];

      // Strategy 1: Enter on the field
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);
      triggerStrategies.push('enter_key');

      // Strategy 2: Click the detected search action
      const searchFrame = diagnostics.searchActionChosen.frameIndex !== null
        ? page.frames()[diagnostics.searchActionChosen.frameIndex]
        : page;

      const clickTarget = searchFrame.locator(diagnostics.searchActionChosen.selector).first();
      const clickVisible = await clickTarget.isVisible().catch(() => false);
      if (clickVisible) {
        await clickTarget.scrollIntoViewIfNeeded().catch(() => {});
        await clickTarget.click({ timeout: 5000 }).catch(() => {});
        triggerStrategies.push('click_chosen_action');
      }

      // Strategy 3: Qlik Sense often has a "tick" or "confirm" button after typing in a search box
      const confirmButton = searchFrame.locator('.lui-icon--tick, .qv-confirm-button, [title="Confirm selection"]').first();
      if (await confirmButton.isVisible().catch(() => false)) {
        await confirmButton.click({ timeout: 3000 }).catch(() => {});
        triggerStrategies.push('qlik_confirm_tick');
      }

      debugSummary.submitSucceeded = triggerStrategies.length > 0;
      debugSummary.searchTriggered = triggerStrategies.length > 0;
      logStep('TRF5_search_trigger_end', { triggerStrategies });
      await saveArtifact('07-post-trigger.png', page, 'screenshot');

      const resultFrame = diagnostics.resultsContainerChosen?.frameIndex !== null
        ? page.frames()[diagnostics.resultsContainerChosen.frameIndex]
        : page;

      const waitInfo = await this.waitForTrf5Signals(resultFrame || page, {
        timeoutMs: 45000, // BI queries are very slow
        resultsContainerSelector: diagnostics.resultsContainerChosen?.selector || 'body',
        baselineCnjCount,
      });
      debugSummary.waitConditionMatched = waitInfo?.waitConditionMatched || 'unknown';

      const postSubmitHtml = await page.content();
      await saveArtifact('08-post-submit.html', postSubmitHtml);
      await saveArtifact('08-post-submit.png', page, 'screenshot');

      const extraction = await (resultFrame || page).evaluate(() => {
        const cnjRegex = /\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/g;
        const clean = (v) => String(v || '').replace(/\s+/g, ' ').trim();
        const toAbs = (href) => {
          if (!href) return null;
          try { return new URL(href, window.location.origin).href; } catch (_e) { return null; }
        };

        const rowNodes = Array.from(document.querySelectorAll('table tr, .rich-table-row, .rf-dt-r, .datagrid-row, .ui-datatable tr, .v-grid-row, .v-table-row, .portal-bi-row, .search-result-item, .qv-st-data-grid-container tr, .qv-object-table tr, [role="row"]'));
        let parsedRows = rowNodes
          .map((row, index) => {
            const text = clean(row.textContent || '');
            const processNumber = text.match(cnjRegex)?.[0] || null;
            if (!processNumber) return null;
            const link = row.querySelector('a[href], a[onclick], [role="link"]');
            const href = link?.getAttribute('href') || null;
            return {
              index,
              processNumber,
              processTitle: processNumber,
              parties: text,
              listLastMovementText: text,
              detailsUrl: href && !href.startsWith('javascript:') ? toAbs(href) : null,
              rawText: text,
            };
          })
          .filter(Boolean);

        const bodyText = clean(document.body?.innerText || '');

        // Fallback for Qlik BI: if no rows detected but CNJs exist in body, create pseudo-rows
        if (parsedRows.length === 0) {
            const allCnjs = bodyText.match(cnjRegex) || [];
            const uniqueCnjs = Array.from(new Set(allCnjs));
            parsedRows = uniqueCnjs.map((cnj, index) => ({
                index,
                processNumber: cnj,
                processTitle: cnj,
                parties: 'Identificado via busca textual (BI)',
                listLastMovementText: bodyText.slice(0, 500),
                detailsUrl: null,
                rawText: bodyText.slice(0, 1000)
            }));
        }

        const resultsMatch = bodyText.match(/(\d+)\s+(processos?|resultados?|itens?)/i);
        return {
          bodyTextSample: bodyText.slice(0, 1200),
          cnjMatchesFound: (bodyText.match(cnjRegex) || []).length,
          declaredResultsCount: resultsMatch ? parseInt(resultsMatch[1], 10) : 0,
          rows: parsedRows,
        };
      });

      debugSummary.realResultLoaded = extraction.cnjMatchesFound > 0 || (extraction.rows && extraction.rows.length > 0);
      debugSummary.declaredResultsCount = extraction.declaredResultsCount || 0;
      debugSummary.cnjMatchesFound = extraction.cnjMatchesFound || 0;
      debugSummary.rawBlocksFound = extraction.rows?.length || 0;

      const items = (extraction.rows || []).map((row) => normalizeItem({
        source: this.getId(),
        sourceLabel: this.getLabel(),
        processNumber: row.processNumber,
        processTitle: row.processTitle,
        parties: row.parties,
        listLastMovementText: row.listLastMovementText,
        detailsUrl: row.detailsUrl,
        providerMeta: { maturity: this.getMaturityStatus(), diagnostics: true },
      }));

      debugSummary.normalizedItemsCount = items.length;

      if (!debugSummary.realResultLoaded) warn('post_submit_no_result_signal', { reason: 'no_cnj_or_rows' });

      return {
        source: this.getId(),
        sourceLabel: this.getLabel(),
        status: 'success',
        items,
        providerMeta: { maturity: this.getMaturityStatus() },
        debugSummary,
        debugData,
      };
    } catch (err) {
      if (!debugSummary.failureStage) debugSummary.failureStage = 'exception';
      return {
        source: this.getId(),
        sourceLabel: this.getLabel(),
        status: 'error',
        items: [],
        providerMeta: { maturity: this.getMaturityStatus() },
        debugSummary,
        debugData,
        error: this.classifyError(err),
      };
    } finally {
      if (browser) await browser.close().catch(() => {});
    }
  }

  async waitForTrf5Signals(page, { timeoutMs, resultsContainerSelector = 'body', baselineCnjCount = 0 }) {
    const startedAt = Date.now();
    const initial = await page.locator(resultsContainerSelector).first().innerText().catch(() => '');
    let lastSnapshot = null;

    while (Date.now() - startedAt < timeoutMs) {
      const snapshot = await page.evaluate(({ selector, previousText }) => {
        const cnjRegex = /\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/g;
        const clean = (v) => String(v || '').replace(/\s+/g, ' ').trim();
        const root = document.querySelector(selector) || document.body;
        const text = clean(root?.innerText || '');

        // Look for loading states
        const hasLoadingIndicator = !!document.querySelector('.qv-loader, .loading, .busy, [aria-busy="true"], .qv-loading-mask, .single-load-indicator');

        return {
          changed: text !== clean(previousText || ''),
          hasResultsText: /(resultados? encontrados|processo|última movimentação|partes|movimentaç)/i.test(text),
          cnjMatches: (text.match(cnjRegex) || []).length || 0,
          hasLoadingIndicator,
          hasTableRows: !!root.querySelector('tr, .v-grid-row, .qv-object-table, .qv-st-data-grid-container'),
        };
      }, { selector: resultsContainerSelector, previousText: initial });

      const waitConditionMatched =
        (snapshot.cnjMatches > baselineCnjCount && 'cnj_increased')
        || (snapshot.cnjMatches > 0 && baselineCnjCount === 0 && 'cnj_detected')
        || (snapshot.hasTableRows && 'table_rows_detected')
        || (snapshot.hasResultsText && snapshot.changed && 'results_text_changed')
        || null;

      lastSnapshot = snapshot;
      if (waitConditionMatched && !snapshot.hasLoadingIndicator) {
        return { waitConditionMatched, elapsedMs: Date.now() - startedAt, snapshot };
      }

      await page.waitForTimeout(1000);
    }
    return { waitConditionMatched: 'timeout_without_clear_results', elapsedMs: Date.now() - startedAt, snapshot: lastSnapshot };
  }

  async collectDomDiagnostics(page) {
    // page.frames() returns all frames including nested ones
    const frames = Array.from(page.frames() || []);
    const allElements = [];

    for (let i = 0; i < frames.length; i += 1) {
      const frame = frames[i];
      try {
        // Ensure frame is still attached and accessible
        if (frame.isDetached()) continue;
        const url = frame.url();
        const name = frame.name();

        const frameElements = await frame.evaluate(({ index, url, name }) => {
          const TAGS = ['input', 'button', 'select', 'textarea', 'form', 'a', 'div', 'span'];
          const clean = (v) => String(v || '').replace(/\s+/g, ' ').trim();
          const toAbs = (href) => {
              if (!href) return null;
              try { return new URL(href, window.location.origin).href; } catch (_e) { return null; }
          };
          const cssPath = (el) => {
            if (!el || el.nodeType !== 1) return null;
            if (el.id) {
                const escaped = el.id.replace(/(:|\.|\[|\]|,|=|@)/g, '\\$1');
                return `#${escaped}`;
            }
            const parts = [];
            let node = el;
            while (node && node.nodeType === 1 && parts.length < 5) {
              let part = node.tagName.toLowerCase();
              const clsAttr = el.getAttribute('class') || '';
              if (clsAttr) {
                const cls = clsAttr.split(/\s+/).filter(Boolean).slice(0, 2).join('.');
                if (cls) part += `.${cls}`;
              }
              const siblings = node.parentElement ? Array.from(node.parentElement.children).filter((c) => c.tagName === node.tagName) : [];
              if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(node) + 1})`;
              parts.unshift(part);
              node = node.parentElement;
            }
            return parts.join(' > ');
          };
          const isVisible = (el) => {
            const style = window.getComputedStyle(el);
            const rect = el.getBoundingClientRect();
            return style.display !== 'none' && style.visibility !== 'hidden';
          };
          const maskValue = (value) => {
            const digits = String(value || '').replace(/\D/g, '');
            if (!digits) return null;
            if (digits.length <= 4) return `***${digits.slice(-2)}`;
            return `***${digits.slice(-4, -2)}***`;
          };

          // Simple recursive shadow DOM walker
          const getAllElements = (root, tags) => {
            let found = [];
            tags.forEach(tag => {
              found.push(...Array.from(root.querySelectorAll(tag)));
            });
            // Also grab elements with suggestive roles or classes directly
            found.push(...Array.from(root.querySelectorAll('[role="textbox"], [role="button"], [role="link"], [contenteditable="true"], .qv-input, .qv-button, .qv-object-filterpane, .lui-input, .lui-button')));

            // Walk standard DOM but exclude script/style
            const allInRoot = Array.from(root.querySelectorAll('*')).filter(el => !['SCRIPT', 'STYLE'].includes(el.tagName));

            allInRoot.forEach(el => {
              if (el.shadowRoot) {
                found.push(...getAllElements(el.shadowRoot, tags));
              }
            });
            return found;
          };

          const tagsToCollect = TAGS;
          const allElementsRaw = getAllElements(document, tagsToCollect);

          if (allElementsRaw.length === 0) {
              return [{
                  tag: 'diagnostic',
                  text: `Frame ${index} empty: ${url} (${name})`,
                  visible: false,
                  frameIndex: index,
                  url
              }];
          }

          const all = allElementsRaw.map((el) => {
            const tag = String(el.tagName || '').toLowerCase();
            const cls = String(el.getAttribute('class') || '');
            const txt = clean(el.textContent || '');
            const aria = String(el.getAttribute('aria-label') || '');

            // In experimental phase, collect almost everything but filter out clearly empty noise
            if ((tag === 'div' || tag === 'span' || tag === 'a') && txt.length === 0 && aria.length === 0 && !cls.includes('qv-') && !cls.includes('lui-')) {
              return null;
            }

            const label = el.id ? document.querySelector(`label[for="${el.id.replace(/(:|\.|\[|\]|,|=|@)/g, '\\$1')}"]`) : null;

            // For Qlik, the context text is often many levels up. Walk up to 7 levels.
            let contextText = '';
            let current = el.parentElement;
            for (let j = 0; j < 7 && current; j++) {
                const t = clean(current.innerText || '');
                if (t.length > contextText.length) contextText = t;
                current = current.parentElement;
            }

            const parentText = clean(el.parentElement?.innerText || '').slice(0, 180);
            const gpText = clean(el.parentElement?.parentElement?.innerText || '').slice(0, 220);
            const bb = el.getBoundingClientRect();

            // Experimental: deep scan for frames/shadows in standard collection
            let innerFrameUrl = null;
            if (tag === 'iframe' || tag === 'frame') innerFrameUrl = el.getAttribute('src');

            return {
              tag,
              type: (el.getAttribute('type') || '').toLowerCase(),
              id: el.id || null,
              name: el.getAttribute('name') || null,
              placeholder: el.getAttribute('placeholder') || null,
              title: el.getAttribute('title') || null,
              ariaLabel: aria || null,
              role: el.getAttribute('role') || null,
              className: cls,
              text: txt,
              valueMasked: maskValue(el.value || el.getAttribute('value') || ''),
              labelText: clean(label?.textContent || ''),
              parentText,
              grandParentText: gpText,
              contextText: contextText.slice(0, 500),
              visible: isVisible(el),
              formId: el.form?.id || null,
              selector: cssPath(el),
              bbox: { x: Math.round(bb.x), y: Math.round(bb.y), width: Math.round(bb.width), height: Math.round(bb.height) },
              frameIndex: index,
              innerFrameUrl: innerFrameUrl ? toAbs(innerFrameUrl) : null,
              hasShadowRoot: !!el.shadowRoot
            };
          });
          return all.filter(Boolean);
        }, { index: i === 0 ? null : i, url, name });
        if (Array.isArray(frameElements)) {
            allElements.push(...frameElements);
        }
      } catch (err) {
        log.warn('Trf5DiagnosticsFrameError', { frameIndex: i, error: err.message });
      }
    }

    const { documentFieldCandidates, documentFieldChosen } = this.rankDocumentFieldCandidates(allElements);
    const { searchActionCandidates, searchActionChosen } = this.rankSearchCandidates(allElements, documentFieldChosen);
    const results = await this.detectResultsContainers(page);

    const autoDetectionConfidence = Math.max(0, Math.min(100,
      Math.round(((documentFieldChosen?.score || 0) + (searchActionChosen?.score || 0) + (results.resultsContainerChosen?.score || 0)) / 3),
    ));

    return {
      domInventory: { elements: allElements },
      documentFieldCandidates,
      documentFieldChosen,
      searchActionCandidates,
      searchActionChosen,
      resultsContainerCandidates: results.resultsContainerCandidates || [],
      resultsContainerChosen: results.resultsContainerChosen || null,
      documentTypeSelector: this.findDocumentTypeSelector(allElements),
      autoDetectionConfidence,
    };
  }

  findDocumentTypeSelector(elements = []) {
    const radio = elements.find((el) => el.tag === 'input' && el.type === 'radio' && /(cpf|cnpj|documento|tipo)/i.test(`${el.labelText} ${el.name} ${el.id}`));
    return radio?.name ? `input[name="${radio.name}"]` : null;
  }

  rankDocumentFieldCandidates(elements = []) {
    const candidates = (elements || [])
      .filter((el) => {
        if (!el) return false;
        const tag = String(el.tag || '').toLowerCase();
        const type = String(el.type || '').toLowerCase();
        const role = String(el.role || '').toLowerCase();
        const cls = String(el.className || '').toLowerCase();
        const isInputLike = (tag === 'input' && ['text', 'search', 'tel', ''].includes(type)) || role === 'textbox' || cls.includes('qv-input') || cls.includes('lui-input');
        const isSuggestiveDiv = (tag === 'div' || tag === 'span') && (cls.includes('search') || cls.includes('input') || cls.includes('qv-') || cls.includes('lui-')) && !cls.includes('loader') && !cls.includes('preload');
        const isPreloadNoise = (cls.includes('preload') || cls.includes('loader')) && (cls.includes('icon') || cls.includes('font') || tag === 'div');
        const isContainerNoise = (tag === 'div' || tag === 'span') && (cls.includes('wrapper') || cls.includes('inner') || cls.includes('content') || cls.includes('container') || cls.includes('blocker') || cls.includes('object') || cls.includes('article'));
        return (isInputLike || isSuggestiveDiv) && !isPreloadNoise && !isContainerNoise;
      })
      .map((el) => {
        const reason = [];
        let score = 0;
        const cls = String(el.className || '');
        const tag = String(el.tag || '').toLowerCase();
        const hay = `${el.id} ${el.name} ${el.placeholder} ${el.title} ${el.ariaLabel} ${el.labelText} ${el.parentText} ${el.grandParentText} ${el.contextText} ${cls}`.toLowerCase();
        if (el.visible) { score += 25; reason.push('visible_input'); }
        if (tag === 'input' || el.role === 'textbox') { score += 120; reason.push('semantic_input'); }
        if (cls.includes('lui-input') || cls.includes('qv-input') || cls.includes('qui-input')) { score += 80; reason.push('qlik_input_class'); }
        if (/cpf\/?cnpj|cpf|cnpj/.test(hay)) { score += 60; reason.push('contains_cpf_cnpj_keywords'); }
        if (/documento|parte|contribuinte/.test(hay)) { score += 25; reason.push('document_context'); }
        if (/documento|cpf|cnpj|num/.test((el.name || '').toLowerCase()) || /documento|cpf|cnpj|num/.test((el.id || '').toLowerCase())) {
          score += 15; reason.push('id_name_suggestive');
        }
        if (el.bbox?.y < 700) { score += 5; reason.push('top_form_position'); }
        return { ...el, score, reason };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);
    return { documentFieldCandidates: candidates, documentFieldChosen: candidates[0] || null };
  }

  rankSearchCandidates(elements = [], documentFieldChosen = null) {
    const docY = documentFieldChosen?.bbox?.y || 0;
    const candidates = (elements || [])
      .filter((el) => el && ['button', 'a', 'input', 'div', 'span'].includes(String(el.tag || '').toLowerCase()))
      .map((el) => {
        const reason = [];
        let score = 0;
        const cls = String(el.className || '');
        const tag = String(el.tag || '').toLowerCase();
        const text = `${el.text} ${el.valueMasked} ${el.labelText} ${el.name} ${el.id} ${el.parentText} ${el.ariaLabel} ${el.title} ${el.contextText} ${cls}`.toLowerCase();
        if (el.visible) { score += 20; reason.push('visible'); }
        if (/(pesquisar|consultar|buscar|visualizar|filtrar|aplicar|confirmar|confirm)/i.test(text)) { score += 60; reason.push('search_text'); }
        if (el.tag === 'input' && ['submit', 'button'].includes(el.type)) { score += 15; reason.push('submit_type'); }
        if (tag === 'button' || el.role === 'button' || cls.includes('button') || cls.includes('lui-button')) { score += 120; reason.push('button_like'); }
        if (cls.includes('qv-') || cls.includes('lui-')) { score += 20; reason.push('qlik_ui_classes'); }
        if (docY && Math.abs((el.bbox?.y || 0) - docY) < 260) { score += 10; reason.push('near_document_field'); }
        return { ...el, score, reason };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);
    return { searchActionCandidates: candidates, searchActionChosen: candidates[0] || null };
  }

  async detectResultsContainers(page) {
    const frames = Array.from(page.frames() || []);
    const allCandidates = [];

    for (let i = 0; i < frames.length; i += 1) {
      const frame = frames[i];
      try {
        if (frame.isDetached()) continue;
        const frameUrl = frame.url();
        const frameCandidates = await frame.evaluate(({ index, url }) => {
      const clean = (v) => String(v || '').replace(/\s+/g, ' ').trim();
      const cnjRegex = /\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/g;
      const cssPath = (el) => {
        if (el.id) return `#${el.id.replace(/(:|\.|\[|\]|,|=|@)/g, '\\$1')}`;
        let node = el;
        const parts = [];
        while (node && node.nodeType === 1 && parts.length < 4) {
          let part = node.tagName.toLowerCase();
          const same = node.parentElement ? Array.from(node.parentElement.children).filter((c) => c.tagName === node.tagName) : [];
          if (same.length > 1) part += `:nth-of-type(${same.indexOf(node) + 1})`;
          parts.unshift(part);
          node = node.parentElement;
        }
        return parts.join(' > ');
      };
          const nodes = Array.from(document.querySelectorAll('table,div,section,article')).slice(0, 500);
          return nodes.map((el) => {
            const text = clean(el.innerText || '');
            const cnjMatchesFound = (text.match(cnjRegex) || []).length;
            return {
              tag: el.tagName.toLowerCase(),
              id: el.id || null,
              className: clean(el.className || ''),
              selector: cssPath(el),
              textSample: text.slice(0, 240),
              cnjMatchesFound,
              hasTableRows: el.querySelectorAll('tr').length,
              frameIndex: index,
            };
          });
        }, { index: i === 0 ? null : i, url: frameUrl });
        if (Array.isArray(frameCandidates)) {
            allCandidates.push(...frameCandidates);
        }
      } catch (err) {
        log.warn('Trf5DetectResultsContainersFrameError', { frameIndex: i, error: err.message });
      }
    }

    const ranked = (allCandidates || [])
      .map((el) => {
        let score = 0;
        const reason = [];
        const cls = String(el.className || '');
        const hay = `${el.id} ${cls} ${el.textSample}`.toLowerCase();
        if (/(resultado|processo|movimentaç|parte|grid|table|corpo-tabela)/.test(hay)) { score += 30; reason.push('results_keyword'); }
        if (el.hasTableRows > 1) { score += 20; reason.push('table_like'); }
        if (el.cnjMatchesFound > 0) { score += 60; reason.push('cnj_match'); }
        if (cls.includes('qv-object-table') || cls.includes('v-grid') || cls.includes('data-grid')) { score += 40; reason.push('qlik_grid_class'); }
        if (el.id && /(grid|result|process|table)/.test(el.id.toLowerCase())) { score += 10; reason.push('id_hint'); }
        return { ...el, score, reason };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);

    return { resultsContainerCandidates: ranked, resultsContainerChosen: ranked[0] || null };
  }
}

Trf5PublicaProvider.prototype.cleanText = cleanText;
Trf5PublicaProvider.prototype.CNJ_RE = CNJ_RE;

module.exports = Trf5PublicaProvider;
