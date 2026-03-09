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

  getBaseUrl() {
    return 'https://portalbi.trf5.jus.br/portal-bi/painel.html?id=3002';
  }

  async consultarPorDocumento({ documentMasked, requestId, userId, debug: debugOverride }) {
    const cfg = getConsultaProcessualConfig();
    const debugOptions = typeof debugOverride === 'object' && debugOverride !== null
      ? debugOverride
      : { enabled: Boolean(debugOverride || cfg.debug), level: 'detailed' };
    const isDebug = Boolean(debugOptions.enabled);
    if (!this.isEnabled()) {
      return {
        source: this.getId(),
        sourceLabel: this.getLabel(),
        status: 'skipped',
        items: [],
        providerMeta: { maturity: this.getMaturityStatus(), enabled: false, skipReason: 'feature_flag_disabled', debugLevel: debugOptions.level || 'minimal' },
      };
    }

    const debugSummary = {
      pageLoaded: false,
      iframeDetected: false,
      iframeSrcMatched: null,
      frameUrlFinal: null,
      frameReady: false,
      documentFieldFound: false,
      maskedInputAccepted: false,
      firstDegreeChecked: false,
      secondDegreeChecked: false,
      searchTriggered: false,
      submitSucceeded: false,
      resultsContainerFound: false,
      gridRowsDetected: 0,
      cnjMatchesFound: 0,
      normalizedItemsCount: 0,
      waitConditionMatched: null,
      failureStage: null,
    };

    const debugBaseDir = path.resolve(process.cwd(), `backend/tmp/consulta-processual/${this.getId()}`, requestId || 'no-request');
    const debugData = isDebug ? { steps: [], warnings: [], artifacts: [] } : null;

    const saveArtifact = async (name, content, type = 'text') => {
      if (!isDebug) return;
      if (!fs.existsSync(debugBaseDir)) fs.mkdirSync(debugBaseDir, { recursive: true });
      const filePath = path.join(debugBaseDir, name);
      if (type === 'screenshot') {
        await content.screenshot({ path: filePath, fullPage: true });
      } else {
        fs.writeFileSync(filePath, String(content || ''), 'utf8');
      }
      debugData.artifacts.push({ name, path: filePath });
    };

    const logStep = (step, extra = {}) => {
      if (!debugData) return;
      debugData.steps.push({ step, source: this.getId(), requestId, userId, ...extra, timestamp: new Date().toISOString() });
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
          providerMeta: { maturity: this.getMaturityStatus(), debugLevel: debugOptions.level || 'minimal' },
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
      await page.setViewportSize({ width: 1440, height: 1200 });
      await page.goto(this.getBaseUrl(), { waitUntil: 'domcontentloaded', timeout: cfg.initialLoadTimeoutMs });
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(1500);

      debugSummary.pageLoaded = true;
      await saveArtifact('01-home.png', page, 'screenshot');
      await saveArtifact('01-home.html', await page.content());

      const frameSelection = await this.selectTargetFrame(page);
      debugSummary.iframeDetected = frameSelection.iframeDetected;
      debugSummary.iframeSrcMatched = frameSelection.iframeSrcMatched;
      debugSummary.frameUrlFinal = frameSelection.frameUrlFinal;
      debugSummary.frameReady = frameSelection.frameReady;
      await saveArtifact('07-frame-selected.json', JSON.stringify({
        iframeDetected: frameSelection.iframeDetected,
        iframeSrcMatched: frameSelection.iframeSrcMatched,
        frameUrlFinal: frameSelection.frameUrlFinal,
        frameReady: frameSelection.frameReady,
      }, null, 2));

      if (!frameSelection.iframeDetected) {
        debugSummary.failureStage = 'frame';
        throw new Error('IFRAME_NOT_FOUND');
      }
      if (!frameSelection.frame || !frameSelection.frameReady) {
        debugSummary.failureStage = 'frame';
        throw new Error('IFRAME_FOUND_BUT_FRAME_READY_FALSE');
      }

      const frame = frameSelection.frame;
      await saveArtifact('08-frame-post-load.png', page, 'screenshot');

      const docField = await this.locateDocumentFieldInFrame(frame);
      if (!docField) {
        debugSummary.failureStage = 'document_field';
        throw new Error('FRAME_INPUT_NOT_FOUND_AFTER_LOAD');
      }
      debugSummary.documentFieldFound = true;

      const field = docField;
      const cpfMasked = documentMasked || '032.410.634-37';
      await field.click({ force: true });
      await field.fill('');
      await field.type(cpfMasked, { delay: 80 });
      await page.waitForTimeout(800);
      const value = await field.inputValue().catch(() => '');
      debugSummary.maskedInputAccepted = cleanText(value) === cpfMasked;
      await saveArtifact('09-frame-post-fill.png', page, 'screenshot');
      if (!debugSummary.maskedInputAccepted) {
        debugSummary.failureStage = 'document_field';
        throw new Error('FRAME_INTERACTION_FAILED');
      }

      const checkboxResult = await this.ensureDegreeCheckboxesInFrame(frame);
      debugSummary.firstDegreeChecked = checkboxResult.firstDegreeChecked;
      debugSummary.secondDegreeChecked = checkboxResult.secondDegreeChecked;
      logStep('checkbox_state', checkboxResult);

      const searchTrigger = await this.triggerSearchInFrame(frame);
      debugSummary.searchTriggered = searchTrigger.searchTriggered;
      debugSummary.submitSucceeded = searchTrigger.submitSucceeded;
      logStep('search_trigger', searchTrigger);
      await saveArtifact('10-frame-post-search.png', page, 'screenshot');
      if (!searchTrigger.searchTriggered) {
        debugSummary.failureStage = 'search';
        throw new Error('FRAME_SEARCH_BUTTON_NOT_FOUND');
      }

      const waitInfo = await this.waitForTrf5Signals(frame, { timeoutMs: 60000, baselineCnjCount: 0 });
      debugSummary.waitConditionMatched = waitInfo.waitConditionMatched;
      debugSummary.resultsContainerFound = waitInfo.snapshot.hasTableRows || waitInfo.snapshot.cnjMatches > 0;
      if (!debugSummary.resultsContainerFound) {
        debugSummary.failureStage = 'results';
        throw new Error('FRAME_RESULTS_NOT_RENDERED_AFTER_SUBMIT');
      }

      await saveArtifact('11-trf5-grid.html', await frame.content());
      const frameInnerText = await frame.locator('body').innerText().catch(() => '');
      await saveArtifact('12-trf5-grid-text.txt', frameInnerText);

      const extraction = await this.extractGridRows(frame);
      await saveArtifact('13-trf5-rows.json', JSON.stringify(extraction.rows, null, 2));

      debugSummary.gridRowsDetected = extraction.rows.length;
      debugSummary.cnjMatchesFound = extraction.cnjMatchesFound;

      const items = extraction.rows.map((row) => normalizeItem({
        source: this.getId(),
        sourceLabel: this.getLabel(),
        processNumber: row.processNumber,
        processClass: row.processClass,
        processTitle: `${row.processNumber || 'sem-numero'} — ${row.processClass || '-'}`,
        parties: [row.nome, row.sujeitoProcessual].filter(Boolean).join(' — '),
        detailsUrl: row.consultaUrl,
        institutional: false,
        providerMeta: {
          maturity: this.getMaturityStatus(),
          system: row.system,
          judicialSection: row.judicialSection,
          gradeLevel: row.gradeLevel,
          instance: row.instance,
          sujeitoProcessual: row.sujeitoProcessual,
          domStrategy: extraction.strategy,
          rowIndex: row.rowIndex,
        },
      }));

      debugSummary.normalizedItemsCount = items.length;

      return {
        source: this.getId(),
        sourceLabel: this.getLabel(),
        status: 'success',
        items,
        providerMeta: { maturity: this.getMaturityStatus(), enabled: true, debugLevel: debugOptions.level || 'minimal' },
        debugSummary,
        debugData,
      };
    } catch (err) {
      log.warn('Trf5PublicaProviderError', { error: err.message, requestId, userId });
      if (!debugSummary.failureStage) debugSummary.failureStage = 'exception';
      return {
        source: this.getId(),
        sourceLabel: this.getLabel(),
        status: 'error',
        items: [],
        providerMeta: { maturity: this.getMaturityStatus(), enabled: true, debugLevel: debugOptions.level || 'minimal' },
        debugSummary,
        debugData,
        error: this.classifyError(err),
      };
    } finally {
      if (browser) await browser.close().catch(() => {});
    }
  }

  classifyError(err) {
    if (/^IFRAME_|^FRAME_/.test(String(err?.message || ''))) {
      return { code: err.message, message: err.message, stage: 'frame_interaction' };
    }
    if (/dom|selector|cpf|checkbox/i.test(String(err?.message || ''))) {
      return { code: 'DOM_MAPPING_REQUIRED', message: err.message, stage: 'dom_diagnostics_required' };
    }
    return super.classifyError(err);
  }

  async selectTargetFrame(page) {
    const iframeHandle = await page.locator('iframe[src*="Busca_Processual_Unificada.html"]').first().elementHandle().catch(() => null);
    const iframeSrcMatched = await iframeHandle?.getAttribute('src').catch(() => null) || null;
    const frame = await iframeHandle?.contentFrame().catch(() => null);
    const frameUrlFinal = frame?.url?.() || null;
    const frameReady = Boolean(frame && await frame.locator('body').count().catch(() => 0));
    return {
      iframeDetected: Boolean(iframeHandle),
      iframeSrcMatched,
      frameUrlFinal,
      frameReady,
      frame,
    };
  }

  async locateDocumentFieldInFrame(frame) {
    const selectors = [
      'input',
      'textarea',
      '[role="textbox"]',
      '[role="searchbox"]',
      '[contenteditable="true"]',
    ];

    for (const selector of selectors) {
      const count = await frame.locator(selector).count().catch(() => 0);
      for (let i = 0; i < count; i += 1) {
        const candidate = frame.locator(selector).nth(i);
        const visible = await candidate.isVisible().catch(() => false);
        const editable = await candidate.isEditable().catch(() => false);
        if (!visible || !editable) continue;
        const context = await candidate.evaluate((el) => String(el.closest('div,section,form')?.innerText || '').toLowerCase()).catch(() => '');
        if (context.includes('buscar por nome, processo, cpf ou cnpj')) return candidate;
      }
    }
    return null;
  }

  async ensureDegreeCheckboxesInFrame(frame) {
    return frame.evaluate(() => {
      const clean = (v) => String(v || '').replace(/\s+/g, ' ').trim().toLowerCase();
      const findByLabel = (matcher) => {
        const labels = Array.from(document.querySelectorAll('label, span, div')).filter((el) => matcher(clean(el.textContent)));
        for (const label of labels) {
          const forId = label.getAttribute('for');
          if (forId) {
            const input = document.getElementById(forId);
            if (input?.type === 'checkbox') return input;
          }
          const parentInput = label.closest('label')?.querySelector('input[type="checkbox"]');
          if (parentInput) return parentInput;
          const siblingInput = label.parentElement?.querySelector('input[type="checkbox"]');
          if (siblingInput) return siblingInput;
        }
        return null;
      };

      const first = findByLabel((t) => t.includes('1º grau') || t.includes('1° grau') || t.includes('1o grau'));
      const second = findByLabel((t) => t.includes('2º grau') || t.includes('2° grau') || t.includes('2o grau'));

      if (first && !first.checked) first.click();
      if (second && !second.checked) second.click();

      return {
        firstDegreeChecked: Boolean(first?.checked),
        secondDegreeChecked: Boolean(second?.checked),
      };
    }).catch(() => ({ firstDegreeChecked: false, secondDegreeChecked: false }));
  }

  async triggerSearchInFrame(frame) {
    const result = { trigger: 'none', searchTriggered: false, submitSucceeded: false, domChanged: false };
    const before = cleanText(await frame.locator('body').innerText().catch(() => ''));
    const searchButton = frame.getByRole('button', { name: /^buscar$/i }).first();

    if (await searchButton.isVisible().catch(() => false)) {
      await searchButton.click({ timeout: 5000 });
      result.trigger = 'button_click';
      result.searchTriggered = true;
    }

    await frame.page().waitForTimeout(1200);
    const after = cleanText(await frame.locator('body').innerText().catch(() => ''));
    result.domChanged = before !== after;
    result.submitSucceeded = result.searchTriggered;
    return result;
  }

  async extractGridRows(frame) {
    const extraction = await frame.evaluate(() => {
        const clean = (v) => String(v || '').replace(/\s+/g, ' ').trim();
        const cnjRegex = /\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/g;
        const tables = Array.from(document.querySelectorAll('table'));

        const normalizeHeader = (text) => clean(text).toLowerCase();
        for (const table of tables) {
          const headerCells = Array.from(table.querySelectorAll('thead th, tr th')).map((th) => normalizeHeader(th.textContent));
          const hasProcessColumn = headerCells.some((h) => h.includes('número do processo') || h.includes('processo'));
          if (!hasProcessColumn) continue;

          const rows = Array.from(table.querySelectorAll('tbody tr')).map((tr, index) => {
            const cells = Array.from(tr.querySelectorAll('td'));
            const getByHeader = (matcher) => {
              const idx = headerCells.findIndex((h) => matcher(h));
              return idx >= 0 ? clean(cells[idx]?.textContent) : null;
            };
            const a = tr.querySelector('a[href]');
            return {
              rowIndex: index,
              nome: getByHeader((h) => h.includes('nome')),
              sujeitoProcessual: getByHeader((h) => h.includes('sujeito')),
              documentMasked: getByHeader((h) => h.includes('cpf/cnpj') || h.includes('cpf')),
              processNumber: getByHeader((h) => h.includes('número do processo') || h.includes('processo')),
              consultaUrl: a?.href || null,
              processClass: getByHeader((h) => h.includes('classe judicial') || h.includes('classe')),
              system: getByHeader((h) => h.includes('sistema')),
              judicialSection: getByHeader((h) => h.includes('seção judiciária') || h.includes('seção')),
              gradeLevel: getByHeader((h) => h === 'grau' || h.includes('grau')),
              instance: getByHeader((h) => h.includes('instância') || h.includes('instancia')),
            };
          }).filter((row) => row.processNumber && cnjRegex.test(row.processNumber));

          if (rows.length) {
            return { strategy: 'header-mapped-table', rows, cnjMatchesFound: rows.length };
          }
        }

        const bodyText = clean(document.body?.innerText || '');
        const cnjMatches = bodyText.match(cnjRegex) || [];
        return { strategy: 'text-fallback', rows: [], cnjMatchesFound: cnjMatches.length };
      }).catch(() => null);

    if (extraction && (extraction.rows.length > 0 || extraction.cnjMatchesFound > 0)) {
      return extraction;
    }

    return { strategy: 'none', rows: [], cnjMatchesFound: 0 };
  }

  async waitForTrf5Signals(frame, { timeoutMs, baselineCnjCount = 0 }) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const snapshot = await frame.evaluate(() => {
        const cnjRegex = /\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/g;
        const text = document.body?.innerText || '';
        return {
          hasTableRows: document.querySelectorAll('table tbody tr').length > 0,
          cnjMatches: (text.match(cnjRegex) || []).length,
          hasLoadingIndicator: Boolean(document.querySelector('.qv-loading-mask, .qv-loader, [aria-busy="true"]')),
        };
      });

      const waitConditionMatched = snapshot.hasTableRows
        ? 'table_rows_detected'
        : snapshot.cnjMatches > baselineCnjCount
          ? 'cnj_detected'
          : null;

      if (waitConditionMatched && !snapshot.hasLoadingIndicator) {
        return { waitConditionMatched, snapshot };
      }
      await frame.page().waitForTimeout(1000);
    }

    return { waitConditionMatched: 'timeout_without_clear_results', snapshot: { hasTableRows: false, cnjMatches: 0 } };
  }

  async collectDomDiagnostics(page, options = {}) {
    const { skipInteractions = false } = options;
    const frames = Array.from(page.frames() || []);
    const allElements = [];
    const inputCandidates = [];
    const clickableFilterCandidates = [];
    const frameTree = [];

    const collectFromFrames = async () => {
      allElements.length = 0;
      inputCandidates.length = 0;
      clickableFilterCandidates.length = 0;
      frameTree.length = 0;

      for (let i = 0; i < frames.length; i += 1) {
        const frame = frames[i];
        if (frame.isDetached()) continue;

        const frameMeta = {
          frameIndex: i === 0 ? null : i,
          url: frame.url(),
          name: frame.name() || null,
          parentFrameIndex: frame.parentFrame() ? frames.indexOf(frame.parentFrame()) : null,
        };
        frameTree.push(frameMeta);

        const frameElements = await frame.evaluate(({ index }) => {
          const clean = (v) => String(v || '').replace(/\s+/g, ' ').trim();
          const cssPath = (el) => {
            if (el.id) return `#${el.id.replace(/(:|\.|\[|\]|,|=|@)/g, '\\\\$1')}`;
            const classes = String(el.className || '').split(/\s+/).filter(Boolean).slice(0, 2);
            if (classes.length) return `${el.tagName.toLowerCase()}.${classes.join('.')}`;
            let node = el;
            const parts = [];
            while (node && node.nodeType === 1 && parts.length < 6) {
              const nth = node.parentElement ? Array.from(node.parentElement.children).indexOf(node) + 1 : 1;
              parts.unshift(`${node.tagName.toLowerCase()}:nth-child(${nth})`);
              node = node.parentElement;
            }
            return parts.join(' > ');
          };

          const nearestLabelText = (el) => {
            const ariaLabelledBy = el.getAttribute('aria-labelledby');
            if (ariaLabelledBy) {
              const text = ariaLabelledBy
                .split(/\s+/)
                .map((id) => document.getElementById(id)?.textContent || '')
                .join(' ');
              if (clean(text)) return clean(text);
            }
            const label = el.closest('label') || (el.id ? document.querySelector(`label[for="${el.id}"]`) : null);
            if (label) return clean(label.textContent || '');
            return '';
          };

          const nodes = Array.from(document.querySelectorAll('*')).slice(0, 4000);
          return nodes
            .filter((el) => {
              const tag = el.tagName.toLowerCase();
              if (['input', 'textarea', 'button', 'a'].includes(tag)) return true;
              if (el.getAttribute('role') === 'button' || el.getAttribute('role') === 'textbox') return true;
              if (el.getAttribute('contenteditable') === 'true') return true;
              const cls = String(el.className || '').toLowerCase();
              return /lui-input|qv-input|filter|qlik/.test(cls);
            })
            .map((el) => {
              const rect = el.getBoundingClientRect();
              const style = window.getComputedStyle(el);
              const parentText = clean(el.parentElement?.innerText || '').slice(0, 300);
              const prevText = clean(el.previousElementSibling?.textContent || '').slice(0, 120);
              const nextText = clean(el.nextElementSibling?.textContent || '').slice(0, 120);
              return {
                tag: el.tagName.toLowerCase(),
                type: (el.getAttribute('type') || '').toLowerCase(),
                id: el.id || null,
                name: el.getAttribute('name') || null,
                className: el.getAttribute('class') || '',
                placeholder: el.getAttribute('placeholder') || null,
                title: el.getAttribute('title') || null,
                ariaLabel: el.getAttribute('aria-label') || null,
                ariaLabelledBy: el.getAttribute('aria-labelledby') || null,
                role: el.getAttribute('role') || null,
                dataAttrs: Object.fromEntries(Array.from(el.attributes).filter((a) => a.name.startsWith('data-')).map((a) => [a.name, a.value]).slice(0, 15)),
                readonly: el.hasAttribute('readonly'),
                disabled: el.hasAttribute('disabled'),
                visible: style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0,
                editable: !el.hasAttribute('readonly') && !el.hasAttribute('disabled'),
                frameIndex: index,
                shadowRootDepth: 0,
                selector: cssPath(el),
                text: clean(el.textContent || '').slice(0, 250),
                parentText,
                nearbySiblingText: clean(`${prevText} ${nextText}`),
                nearestLabelText: nearestLabelText(el),
                bbox: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) },
              };
            });
        }, { index: i === 0 ? null : i }).catch(() => []);

        allElements.push(...frameElements);
        inputCandidates.push(...frameElements.filter((el) => ['input', 'textarea'].includes(el.tag) || el.role === 'textbox' || el.tag === 'div' && /input|textbox/i.test(el.className)));
        clickableFilterCandidates.push(...frameElements.filter((el) => ['button', 'a', 'div', 'span'].includes(el.tag) && /filter|filtro|qlik|lui|search|consulta|aplicar|buscar/i.test(`${el.className} ${el.text} ${el.parentText}`)));
      }
    };

    await collectFromFrames();

    if (!skipInteractions) {
      const topClickable = clickableFilterCandidates.slice(0, 3);

      for (const candidate of topClickable) {
        if (!candidate.selector) continue;
        const frame = candidate.frameIndex !== null ? frames[candidate.frameIndex] : page;
        await frame.locator(candidate.selector).first().click({ timeout: 1500 }).catch(() => {});
        await page.waitForTimeout(400);
      }

      await collectFromFrames();
    }

    const rankedClickableFilterCandidates = clickableFilterCandidates
      .map((el) => {
        const hay = `${el.className} ${el.text} ${el.parentText} ${el.nearestLabelText}`.toLowerCase();
        const score = (/filter|filtro|painel/.test(hay) ? 80 : 0) + (/cpf|documento|consulta/.test(hay) ? 90 : 0) + (el.visible ? 15 : 0);
        return { ...el, score };
      })
      .sort((a, b) => b.score - a.score);
    const { documentFieldCandidates, documentFieldChosen } = this.rankDocumentFieldCandidates(allElements);
    const { searchActionCandidates, searchActionChosen } = this.rankSearchCandidates(allElements, documentFieldChosen);
    return {
      frameTree,
      shadowRootsScanned: 0,
      domInventory: { elements: allElements },
      inputCandidates,
      clickableFilterCandidates: rankedClickableFilterCandidates,
      documentFieldCandidates,
      documentFieldChosen,
      searchActionCandidates,
      searchActionChosen,
    };
  }

  isCpfCandidateUsable(candidate) {
    if (!candidate?.selector) return false;
    if (!candidate.visible) return false;
    if (!candidate.editable) return false;
    return Number(candidate.score || 0) >= 120;
  }

  resolveDocumentFieldFailureReason(candidate, diagnostics = {}) {
    if (!candidate) return 'no_candidate_scored_above_threshold';
    if (candidate.frameIndex === -1) return 'field_inside_unresolved_iframe';
    if (!candidate.visible) return 'candidate_found_but_hidden';
    if (!candidate.editable || candidate.readonly || candidate.disabled) return 'candidate_found_but_not_editable';
    if (Number(candidate.score || 0) < 120) return 'no_candidate_scored_above_threshold';
    if (Number(diagnostics.clickableFilterCandidates?.length || 0) > 0) return 'candidate_found_only_after_click_not_attempted';
    return 'no_candidate_scored_above_threshold';
  }

  buildDocumentFieldErrorMessage(reason, passes = 1) {
    return `Campo CPF não identificado no TRF5 após ${passes} passes de varredura; motivo: ${reason}`;
  }

  summarizeCandidate(candidate) {
    if (!candidate) return null;
    return {
      selector: candidate.selector,
      frameIndex: candidate.frameIndex,
      score: Number(candidate.score || 0),
      attributes: {
        tag: candidate.tag,
        type: candidate.type,
        id: candidate.id || null,
        name: candidate.name || null,
        className: candidate.className || null,
        placeholder: candidate.placeholder || null,
        ariaLabel: candidate.ariaLabel || null,
        visible: Boolean(candidate.visible),
        editable: Boolean(candidate.editable),
        readonly: Boolean(candidate.readonly),
        disabled: Boolean(candidate.disabled),
      },
      reason: candidate.scoreReasoning || null,
      text: candidate.text || candidate.nearestLabelText || null,
    };
  }

  buildDomInspectionSummary(diagnostics = {}) {
    const topCpfCandidates = (diagnostics.documentFieldCandidates || []).slice(0, 3).map((c) => this.summarizeCandidate(c));
    const topClickableCandidates = (diagnostics.clickableFilterCandidates || []).slice(0, 3).map((c) => ({
      selector: c.selector,
      frameIndex: c.frameIndex,
      score: Number(c.score || 0),
      label: c.nearestLabelText || c.text || c.parentText || null,
    }));
    const best = topCpfCandidates[0] || null;
    const bestRaw = (diagnostics.documentFieldCandidates || [])[0] || null;
    return {
      framesScanned: Number(diagnostics.frameTree?.length || 0),
      shadowRootsScanned: Number(diagnostics.shadowRootsScanned || 0),
      inputCandidatesCount: Number(diagnostics.inputCandidates?.length || 0),
      cpfCandidatesCount: Number(diagnostics.documentFieldCandidates?.length || 0),
      bestCpfCandidate: best,
      bestCpfCandidateScore: Number(best?.score || 0),
      bestCpfCandidateReasoning: best?.reason || null,
      clickableFilterCandidatesCount: Number(diagnostics.clickableFilterCandidates?.length || 0),
      topCpfCandidates,
      topClickableCandidates,
      documentFieldFailureReason: this.resolveDocumentFieldFailureReason(bestRaw, diagnostics),
    };
  }

  async tryPostInteractionRescan(page, diagnostics) {
    const clickable = (diagnostics.clickableFilterCandidates || []).slice(0, 3);
    if (!clickable.length) return { performed: false, diagnostics };
    for (const candidate of clickable) {
      if (!candidate.selector) continue;
      const frame = candidate.frameIndex !== null ? page.frames()[candidate.frameIndex] : page;
      await frame.locator(candidate.selector).first().click({ timeout: 1500 }).catch(() => {});
      await page.waitForTimeout(450);
    }
    const rescanned = await this.collectDomDiagnostics(page, { skipInteractions: true });
    return { performed: true, diagnostics: rescanned };
  }

  rankDocumentFieldCandidates(elements = []) {
    const candidates = (elements || [])
      .filter((el) => {
        const tag = String(el.tag || '').toLowerCase();
        const type = String(el.type || '').toLowerCase();
        return (tag === 'input' && ['text', 'search', 'tel', ''].includes(type)) || (el.className || '').includes('input');
      })
      .map((el) => {
        let score = 0;
        const reasons = [];
        const hay = `${el.id} ${el.name} ${el.placeholder} ${el.title} ${el.ariaLabel} ${el.nearestLabelText} ${el.parentText} ${el.nearbySiblingText} ${el.className}`.toLowerCase();
        if (el.visible) { score += 25; reasons.push('visible:+25'); }
        if (el.editable) { score += 20; reasons.push('editable:+20'); }
        if (/cpf\/?cnpj|cpf|cnpj/.test(hay)) { score += 160; reasons.push('cpf_hint:+160'); }
        if (/documento|consulta|filtro|parte|nome/.test(hay)) { score += 40; reasons.push('context_hint:+40'); }
        if (/qlik|qv-|lui-/.test(hay)) { score += 20; reasons.push('qlik_hint:+20'); }
        if (el.readonly || el.disabled) { score -= 80; reasons.push('readonly_or_disabled:-80'); }
        if ((el.className || '').includes('lui-input')) { score += 40; reasons.push('lui_input:+40'); }
        if (el.bbox?.y < 900) { score += 5; reasons.push('viewport:+5'); }
        return { ...el, score, scoreReasoning: reasons.join(', ') };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);
    return { documentFieldCandidates: candidates, documentFieldChosen: candidates[0] || null };
  }

  rankSearchCandidates(elements = [], documentFieldChosen = null) {
    const docY = documentFieldChosen?.bbox?.y || 0;
    const candidates = (elements || [])
      .filter((el) => ['button', 'a', 'div', 'span', 'input'].includes(String(el.tag || '').toLowerCase()))
      .map((el) => {
        let score = 0;
        const text = `${el.text} ${el.title} ${el.ariaLabel} ${el.contextText}`.toLowerCase();
        if (/buscar|consultar|pesquisar|filtrar|aplicar/.test(text)) score += 180;
        if ((el.className || '').toLowerCase().includes('button')) score += 30;
        if (docY && Math.abs((el.bbox?.y || 0) - docY) < 260) score += 10;
        return { ...el, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);
    return { searchActionCandidates: candidates, searchActionChosen: candidates[0] || null };
  }
}

Trf5PublicaProvider.prototype.cleanText = cleanText;
Trf5PublicaProvider.prototype.CNJ_RE = CNJ_RE;

module.exports = Trf5PublicaProvider;
