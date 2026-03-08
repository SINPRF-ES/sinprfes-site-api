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
    return 'https://pje.trf5.jus.br/pje/ConsultaPublica/listView.seam';
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
      documentFieldCandidatesCount: 0,
      searchActionCandidatesCount: 0,
      resultsContainerCandidatesCount: 0,
      documentFieldAutoDetected: false,
      searchButtonAutoDetected: false,
      resultsContainerAutoDetected: false,
      autoDetectionConfidence: 0,
      submitSucceeded: false,
      waitConditionMatched: null,
      realResultLoaded: false,
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

      await page.goto(this.getBaseUrl(), { waitUntil: 'domcontentloaded', timeout: cfg.initialLoadTimeoutMs });
      await page.waitForTimeout(600);
      debugSummary.pageLoaded = true;
      await saveArtifact('01-home.png', page, 'screenshot');
      await saveArtifact('01-home.html', await page.content());

      logStep('TRF5_dom_diagnostics_start');
      const diagnostics = await this.collectDomDiagnostics(page);
      if (debugData) debugData.domDiagnostics = diagnostics;
      debugSummary.domInventoryGenerated = true;
      debugSummary.documentFieldCandidatesCount = diagnostics.documentFieldCandidates.length;
      debugSummary.searchActionCandidatesCount = diagnostics.searchActionCandidates.length;
      debugSummary.resultsContainerCandidatesCount = diagnostics.resultsContainerCandidates.length;
      debugSummary.documentFieldAutoDetected = Boolean(diagnostics.documentFieldChosen?.selector);
      debugSummary.searchButtonAutoDetected = Boolean(diagnostics.searchActionChosen?.selector);
      debugSummary.resultsContainerAutoDetected = Boolean(diagnostics.resultsContainerChosen?.selector);
      debugSummary.autoDetectionConfidence = diagnostics.autoDetectionConfidence;

      await saveArtifact('02-dom-inventory.json', JSON.stringify(diagnostics.domInventory, null, 2));
      await saveArtifact('03-document-candidates.json', JSON.stringify({ candidates: diagnostics.documentFieldCandidates, chosen: diagnostics.documentFieldChosen }, null, 2));
      await saveArtifact('04-search-candidates.json', JSON.stringify({ candidates: diagnostics.searchActionCandidates, chosen: diagnostics.searchActionChosen }, null, 2));
      await saveArtifact('05-results-candidates.json', JSON.stringify({ candidates: diagnostics.resultsContainerCandidates, chosen: diagnostics.resultsContainerChosen }, null, 2));

      if (!diagnostics.documentFieldChosen?.selector || !diagnostics.searchActionChosen?.selector) {
        debugSummary.failureStage = 'dom_diagnostics';
        throw new Error('TRF5 DOM diagnostics could not confidently identify document field and search action');
      }

      const documentToSearch = this.onlyDigits(document) || '06889315707';
      await this.fillDocumentWithFallback(page, {
        docDigits: documentToSearch,
        docFieldSelector: diagnostics.documentFieldChosen.selector,
        radioSelector: diagnostics.documentTypeSelector || diagnostics.documentFieldChosen.formRadioSelector || 'input[type="radio"]',
      }).catch((err) => {
        warn('fill_document_fallback_error', { error: err.message });
      });

      const clickTarget = page.locator(diagnostics.searchActionChosen.selector).first();
      await clickTarget.scrollIntoViewIfNeeded().catch(() => {});
      await clickTarget.click({ timeout: 5000 });
      debugSummary.submitSucceeded = true;

      const waitInfo = await this.waitForTrf5Signals(page, {
        timeoutMs: cfg.searchTimeoutMs,
        resultsContainerSelector: diagnostics.resultsContainerChosen?.selector || 'body',
      });
      debugSummary.waitConditionMatched = waitInfo.waitConditionMatched;

      const postSubmitHtml = await page.content();
      await saveArtifact('06-post-submit.html', postSubmitHtml);

      const extraction = await page.evaluate(() => {
        const cnjRegex = /\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/g;
        const clean = (v) => String(v || '').replace(/\s+/g, ' ').trim();
        const toAbs = (href) => {
          if (!href) return null;
          try { return new URL(href, window.location.origin).href; } catch (_e) { return null; }
        };

        const rows = Array.from(document.querySelectorAll('table tr, .rich-table-row, .rf-dt-r, .datagrid-row, .ui-datatable tr'));
        const parsedRows = rows
          .map((row, index) => {
            const text = clean(row.textContent || '');
            const processNumber = text.match(cnjRegex)?.[0] || null;
            if (!processNumber) return null;
            const link = row.querySelector('a[href], a[onclick]');
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
        return {
          bodyTextSample: bodyText.slice(0, 1200),
          cnjMatchesFound: (bodyText.match(cnjRegex) || []).length,
          rows: parsedRows,
        };
      });

      debugSummary.realResultLoaded = extraction.cnjMatchesFound > 0 || extraction.rows.length > 0;

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

  async waitForTrf5Signals(page, { timeoutMs, resultsContainerSelector }) {
    const startedAt = Date.now();
    const initial = await page.locator(resultsContainerSelector).first().innerText().catch(() => '');
    while (Date.now() - startedAt < timeoutMs) {
      const snapshot = await page.evaluate(({ selector, previousText }) => {
        const cnjRegex = /\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/g;
        const clean = (v) => String(v || '').replace(/\s+/g, ' ').trim();
        const root = document.querySelector(selector) || document.body;
        const text = clean(root?.innerText || '');
        return {
          changed: text !== clean(previousText || ''),
          hasResultsText: /(resultados? encontrados|processo|última movimentação)/i.test(text),
          cnjMatches: (text.match(cnjRegex) || []).length,
          hasProcessLinks: Array.from(root.querySelectorAll('a[href],a[onclick]')).some((a) => /processo|detalhe|listView\.seam|openPopUp/i.test((a.getAttribute('href') || '') + (a.getAttribute('onclick') || '') + (a.textContent || ''))),
        };
      }, { selector: resultsContainerSelector, previousText: initial });

      const waitConditionMatched =
        (snapshot.cnjMatches > 0 && 'cnj_detected')
        || (snapshot.hasProcessLinks && snapshot.changed && 'process_links_detected')
        || (snapshot.hasResultsText && snapshot.changed && 'results_text_changed')
        || null;
      if (waitConditionMatched) return { waitConditionMatched, elapsedMs: Date.now() - startedAt, snapshot };
      await page.waitForTimeout(250);
    }
    return { waitConditionMatched: 'timeout_without_clear_results', elapsedMs: Date.now() - startedAt };
  }

  async collectDomDiagnostics(page) {
    const domInventory = await page.evaluate(() => {
      const TAGS = ['input', 'button', 'select', 'textarea', 'form', 'a'];
      const clean = (v) => String(v || '').replace(/\s+/g, ' ').trim();
      const cssPath = (el) => {
        if (!el || el.nodeType !== 1) return null;
        if (el.id) return `#${CSS.escape(el.id)}`;
        const parts = [];
        let node = el;
        while (node && node.nodeType === 1 && parts.length < 5) {
          let part = node.tagName.toLowerCase();
          if (node.className && typeof node.className === 'string') {
            const cls = node.className.split(/\s+/).filter(Boolean).slice(0, 2).join('.');
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
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
      };
      const maskValue = (value) => {
        const digits = String(value || '').replace(/\D/g, '');
        if (!digits) return null;
        if (digits.length <= 4) return `***${digits.slice(-2)}`;
        return `***${digits.slice(-4, -2)}***`;
      };

      const all = TAGS.flatMap((tag) => Array.from(document.querySelectorAll(tag)).map((el) => {
        const label = el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`) : null;
        const parentText = clean(el.parentElement?.innerText || '').slice(0, 180);
        const gpText = clean(el.parentElement?.parentElement?.innerText || '').slice(0, 220);
        const bb = el.getBoundingClientRect();
        return {
          tag: el.tagName.toLowerCase(),
          type: (el.getAttribute('type') || '').toLowerCase(),
          id: el.id || null,
          name: el.getAttribute('name') || null,
          placeholder: el.getAttribute('placeholder') || null,
          text: clean(el.textContent || ''),
          valueMasked: maskValue(el.value || el.getAttribute('value') || ''),
          labelText: clean(label?.textContent || ''),
          parentText,
          grandParentText: gpText,
          visible: isVisible(el),
          formId: el.form?.id || null,
          selector: cssPath(el),
          bbox: { x: Math.round(bb.x), y: Math.round(bb.y), width: Math.round(bb.width), height: Math.round(bb.height) },
        };
      }));
      return { elements: all };
    });

    const { documentFieldCandidates, documentFieldChosen } = this.rankDocumentFieldCandidates(domInventory.elements);
    const { searchActionCandidates, searchActionChosen } = this.rankSearchCandidates(domInventory.elements, documentFieldChosen);
    const results = await this.detectResultsContainers(page);

    const autoDetectionConfidence = Math.max(0, Math.min(100,
      Math.round(((documentFieldChosen?.score || 0) + (searchActionChosen?.score || 0) + (results.resultsContainerChosen?.score || 0)) / 3),
    ));

    return {
      domInventory,
      documentFieldCandidates,
      documentFieldChosen,
      searchActionCandidates,
      searchActionChosen,
      resultsContainerCandidates: results.resultsContainerCandidates,
      resultsContainerChosen: results.resultsContainerChosen,
      documentTypeSelector: this.findDocumentTypeSelector(domInventory.elements),
      autoDetectionConfidence,
    };
  }

  findDocumentTypeSelector(elements = []) {
    const radio = elements.find((el) => el.tag === 'input' && el.type === 'radio' && /(cpf|cnpj|documento|tipo)/i.test(`${el.labelText} ${el.name} ${el.id}`));
    return radio?.name ? `input[name="${radio.name}"]` : null;
  }

  rankDocumentFieldCandidates(elements = []) {
    const candidates = elements
      .filter((el) => el.tag === 'input' && ['text', 'search', 'tel', ''].includes(el.type))
      .map((el) => {
        const reason = [];
        let score = 0;
        const hay = `${el.id} ${el.name} ${el.placeholder} ${el.labelText} ${el.parentText} ${el.grandParentText}`.toLowerCase();
        if (el.visible) { score += 25; reason.push('visible_text_input'); }
        if (/cpf\/?cnpj|cpf|cnpj/.test(hay)) { score += 40; reason.push('label_contains_cpf_cnpj'); }
        if (/documento|parte/.test(hay)) { score += 20; reason.push('document_context'); }
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
    const candidates = elements
      .filter((el) => ['button', 'a', 'input'].includes(el.tag))
      .map((el) => {
        const reason = [];
        let score = 0;
        const text = `${el.text} ${el.valueMasked} ${el.labelText} ${el.name} ${el.id} ${el.parentText}`.toLowerCase();
        if (el.visible) { score += 20; reason.push('visible'); }
        if (/(pesquisar|consultar|buscar)/i.test(text)) { score += 45; reason.push('search_text'); }
        if (el.tag === 'input' && ['submit', 'button'].includes(el.type)) { score += 15; reason.push('submit_type'); }
        if (el.tag === 'button') { score += 10; reason.push('button_tag'); }
        if (docY && Math.abs((el.bbox?.y || 0) - docY) < 260) { score += 10; reason.push('near_document_field'); }
        return { ...el, score, reason };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);
    return { searchActionCandidates: candidates, searchActionChosen: candidates[0] || null };
  }

  async detectResultsContainers(page) {
    const candidates = await page.evaluate(() => {
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
        };
      });
    });

    const ranked = candidates
      .map((el) => {
        let score = 0;
        const reason = [];
        const hay = `${el.id} ${el.className} ${el.textSample}`.toLowerCase();
        if (/(resultado|processo|movimentaç|parte|grid|table)/.test(hay)) { score += 30; reason.push('results_keyword'); }
        if (el.hasTableRows > 1) { score += 20; reason.push('table_like'); }
        if (el.cnjMatchesFound > 0) { score += 40; reason.push('cnj_match'); }
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
