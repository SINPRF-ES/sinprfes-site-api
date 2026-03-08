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
        return { source: this.getId(), sourceLabel: this.getLabel(), status: 'skipped', items: [], providerMeta: { maturity: this.getMaturityStatus() } };
      }
      browser = browserResult.browser;
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.setViewportSize({ width: 1280, height: 1024 });

      await page.goto(this.getBaseUrl(), { waitUntil: 'domcontentloaded', timeout: cfg.initialLoadTimeoutMs });

      // Qlik Sense is heavy. Use a very long fixed wait for the first live run in the sandbox
      await page.waitForTimeout(25000);
      logStep('TRF5_long_wait_completed');
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

      const field = frame.locator(diagnostics.documentFieldChosen.selector).first();
      await field.scrollIntoViewIfNeeded().catch(() => {});
      await field.click({ force: true });
      await field.fill('');
      await page.waitForTimeout(1000);

      // Try multiple ways to fill/trigger input events
      await field.type(documentToSearch, { delay: 150 });
      await field.dispatchEvent('change').catch(() => {});
      await field.dispatchEvent('blur').catch(() => {});

      const valAfter = await field.inputValue().catch(() => '') || '';
      debugSummary.maskedInputAccepted = valAfter.includes(documentToSearch.replace(/\D/g, '')) || valAfter === documentToSearch;

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
      logStep('TRF5_search_trigger_end', { triggerStrategies });

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
      await saveArtifact('06-post-submit.html', postSubmitHtml);

      const extraction = await (resultFrame || page).evaluate(() => {
        const cnjRegex = /\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/g;
        const clean = (v) => String(v || '').replace(/\s+/g, ' ').trim();
        const toAbs = (href) => {
          if (!href) return null;
          try { return new URL(href, window.location.origin).href; } catch (_e) { return null; }
        };

        const rows = Array.from(document.querySelectorAll('table tr, .rich-table-row, .rf-dt-r, .datagrid-row, .ui-datatable tr, .v-grid-row, .v-table-row, .portal-bi-row, .search-result-item'));
        const parsedRows = rows
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
        const resultsMatch = bodyText.match(/(\d+)\s+(processos?|resultados?|itens?)/i);
        return {
          bodyTextSample: bodyText.slice(0, 1200),
          cnjMatchesFound: (bodyText.match(cnjRegex) || []).length,
          declaredResultsCount: resultsMatch ? parseInt(resultsMatch[1], 10) : 0,
          rows: parsedRows,
        };
      });

      debugSummary.realResultLoaded = extraction.cnjMatchesFound > 0 || extraction.rows.length > 0;
      debugSummary.declaredResultsCount = extraction.declaredResultsCount;
      debugSummary.cnjMatchesFound = extraction.cnjMatchesFound;
      debugSummary.rawBlocksFound = extraction.rows.length;

      const items = extraction.rows.map((row) => normalizeItem({
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
        const hasLoadingIndicator = !!document.querySelector('.qv-loader, .loading, .busy, [aria-busy="true"]');

        return {
          changed: text !== clean(previousText || ''),
          hasResultsText: /(resultados? encontrados|processo|última movimentação|partes)/i.test(text),
          cnjMatches: (text.match(cnjRegex) || []).length || 0,
          hasLoadingIndicator,
          hasTableRows: !!root.querySelector('tr, .v-grid-row, .qv-object-table'),
        };
      }, { selector: resultsContainerSelector, previousText: initial });

      const waitConditionMatched =
        (snapshot.cnjMatches > baselineCnjCount && 'cnj_increased')
        || (snapshot.cnjMatches > 0 && baselineCnjCount === 0 && 'cnj_detected')
        || (snapshot.hasResultsText && snapshot.changed && 'results_text_changed')
        || (snapshot.hasTableRows && snapshot.changed && 'table_rows_detected')
        || null;

      lastSnapshot = snapshot;
      if (waitConditionMatched && !snapshot.hasLoadingIndicator) {
        return { waitConditionMatched, elapsedMs: Date.now() - startedAt, snapshot };
      }

      await page.waitForTimeout(500);
    }
    return { waitConditionMatched: 'timeout_without_clear_results', elapsedMs: Date.now() - startedAt, snapshot: lastSnapshot };
  }

  async collectDomDiagnostics(page) {
    const frames = page.frames();
    const allElements = [];

    for (let i = 0; i < frames.length; i += 1) {
      const frame = frames[i];
      try {
        const frameElements = await frame.evaluate((index) => {
          const TAGS = ['input', 'button', 'select', 'textarea', 'form', 'a', 'div', 'span'];
          const clean = (v) => String(v || '').replace(/\s+/g, ' ').trim();
          const cssPath = (el) => {
            if (!el || el.nodeType !== 1) return null;
            if (el.id) return `#${CSS.escape(el.id)}`;
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
            found.push(...Array.from(root.querySelectorAll('[role="textbox"], [role="button"], [role="link"], .qv-input, .qv-button, .qv-object-filterpane')));

            const allInRoot = Array.from(root.querySelectorAll('*'));
            allInRoot.forEach(el => {
              if (el.shadowRoot) {
                found.push(...getAllElements(el.shadowRoot, tags));
              }
            });
            return found;
          };

          const tagsToCollect = TAGS;
          const allElementsRaw = getAllElements(document, tagsToCollect);

          const all = allElementsRaw.map((el) => {
            const tag = String(el.tagName || '').toLowerCase();
            const cls = String(el.getAttribute('class') || '');
            const txt = clean(el.textContent || '');
            const aria = String(el.getAttribute('aria-label') || '');

            // In experimental phase, collect almost everything but filter out clearly empty noise
            if ((tag === 'div' || tag === 'span' || tag === 'a') && txt.length === 0 && aria.length === 0 && !cls.includes('qv-') && !cls.includes('lui-')) {
              return null;
            }

            const label = el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`) : null;
            const parentText = clean(el.parentElement?.innerText || '').slice(0, 180);
            const gpText = clean(el.parentElement?.parentElement?.innerText || '').slice(0, 220);
            const bb = el.getBoundingClientRect();
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
              visible: isVisible(el),
              formId: el.form?.id || null,
              selector: cssPath(el),
              bbox: { x: Math.round(bb.x), y: Math.round(bb.y), width: Math.round(bb.width), height: Math.round(bb.height) },
              frameIndex: index,
            };
          });
          return all.filter(Boolean);
        }, i === 0 ? null : i);
        allElements.push(...frameElements);
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
        return (tag === 'input' && ['text', 'search', 'tel', ''].includes(type)) || role === 'textbox' || cls.includes('qv-input') || cls.includes('lui-input');
      })
      .map((el) => {
        const reason = [];
        let score = 0;
        const cls = String(el.className || '');
        const hay = `${el.id} ${el.name} ${el.placeholder} ${el.title} ${el.ariaLabel} ${el.labelText} ${el.parentText} ${el.grandParentText} ${cls}`.toLowerCase();
        if (el.visible) { score += 25; reason.push('visible_input'); }
        if (/cpf\/?cnpj|cpf|cnpj/.test(hay)) { score += 45; reason.push('contains_cpf_cnpj_keywords'); }
        if (/documento|parte|contribuinte/.test(hay)) { score += 20; reason.push('document_context'); }
        if (cls.includes('qv-') || cls.includes('lui-')) { score += 15; reason.push('qlik_ui_classes'); }
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
        const text = `${el.text} ${el.valueMasked} ${el.labelText} ${el.name} ${el.id} ${el.parentText} ${el.ariaLabel} ${el.title} ${cls}`.toLowerCase();
        if (el.visible) { score += 20; reason.push('visible'); }
        if (/(pesquisar|consultar|buscar|visualizar|filtrar|aplicar)/i.test(text)) { score += 45; reason.push('search_text'); }
        if (el.tag === 'input' && ['submit', 'button'].includes(el.type)) { score += 15; reason.push('submit_type'); }
        if (el.tag === 'button' || el.role === 'button') { score += 15; reason.push('button_like'); }
        if (cls.includes('qv-') || cls.includes('lui-')) { score += 10; reason.push('qlik_ui_classes'); }
        if (docY && Math.abs((el.bbox?.y || 0) - docY) < 260) { score += 10; reason.push('near_document_field'); }
        return { ...el, score, reason };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);
    return { searchActionCandidates: candidates, searchActionChosen: candidates[0] || null };
  }

  async detectResultsContainers(page) {
    const frames = page.frames();
    const allCandidates = [];

    for (let i = 0; i < frames.length; i += 1) {
      const frame = frames[i];
      try {
        const frameCandidates = await frame.evaluate((index) => {
      const clean = (v) => String(v || '').replace(/\s+/g, ' ').trim();
      const cnjRegex = /\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/g;
      const cssPath = (el) => {
        if (el.id) return `#${CSS.escape(el.id)}`;
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
        }, i === 0 ? null : i);
        allCandidates.push(...frameCandidates);
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
        if (el.cnjMatchesFound > 0) { score += 45; reason.push('cnj_match'); }
        if (cls.includes('qv-object-table') || cls.includes('v-grid')) { score += 25; reason.push('qlik_grid_class'); }
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
