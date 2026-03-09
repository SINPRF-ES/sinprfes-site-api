const ConsultaProcessualProvider = require('./ConsultaProcessualProvider');
const { createSourceResult } = require('../dto/consultaProcessualDto');
const { createPjeParser } = require('../parsers/pjeProcessParser');
const { getConsultaProcessualConfig } = require('../utils/consultaProcessualConfig');
const { launchBrowser } = require('../service/playwrightBrowserService');

class Trf1PublicaProvider extends ConsultaProcessualProvider {
  getId() { return 'trf1'; }
  getLabel() { return 'TRF1'; }
  isEnabled() { return getConsultaProcessualConfig().trf1Enabled; }

  async consultarPorDocumento({ document, requestId, userId, debug }) {
    const cfg = getConsultaProcessualConfig();
    const browserResult = await launchBrowser({ config: cfg });
    if (!browserResult.ok) {
      return createSourceResult({
        source: this.getId(), sourceLabel: this.getLabel(), status: 'skipped', items: [],
        error: { code: browserResult.reasonCode || 'PLAYWRIGHT_UNAVAILABLE', message: browserResult.reason || 'Playwright indisponível.' },
      });
    }

    const parseRows = createPjeParser('trf1', 'TRF1');
    const debugSummary = { submitSucceeded: false, declaredResultsCount: 0, normalizedItemsCount: 0, failureStage: null };
    let context; let page;
    try {
      context = await browserResult.browser.newContext();
      page = await context.newPage();
      await page.goto('https://pje1g-consultapublica.trf1.jus.br/consultapublica/ConsultaPublica/listView.seam', { waitUntil: 'domcontentloaded', timeout: cfg.initialLoadTimeoutMs });

      const cpfInput = page.locator('#fPP\\:dpDec\\:documentoParte');
      await cpfInput.fill(String(document || '').replace(/\D/g, ''));

      const beforeText = await page.locator('#fPP\\:processosGridPanel_body').innerText().catch(() => '');
      await page.locator('#fPP\\:searchProcessos').click();

      await page.waitForFunction(({ previousText }) => {
        const panel = document.getElementById('fPP:processosGridPanel_body') || document.getElementById('fPP:processosGridPanel');
        if (!panel) return false;
        const text = String(panel.innerText || '').replace(/\s+/g, ' ').trim();
        const hasResultCount = /\d+\s+resultados?\s+encontrados/i.test(text);
        const hasCnj = /\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/.test(text);
        const changed = text && text !== String(previousText || '').replace(/\s+/g, ' ').trim();
        return (hasResultCount && changed) || hasCnj;
      }, { previousText: beforeText }, { timeout: cfg.searchTimeoutMs });

      debugSummary.submitSucceeded = true;

      const extraction = await page.evaluate(() => {
        const clean = (v) => String(v || '').replace(/\s+/g, ' ').trim();
        const panel = document.getElementById('fPP:processosGridPanel_body') || document.getElementById('fPP:processosGridPanel');
        const panelText = clean(panel?.innerText || '');
        const countMatch = panelText.match(/(\d+)\s+resultados?\s+encontrados/i);
        const rows = Array.from(document.querySelectorAll('#fPP\\:processosTable tbody tr')).map((tr) => {
          const text = clean(tr.innerText);
          const detailLink = tr.querySelector('a[href]');
          const links = Array.from(tr.querySelectorAll('a[href]')).map((a) => a.textContent || '');
          const title = links.map(clean).find((t) => /\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/.test(t)) || text;
          const classe = clean((text.match(/Classe\s*:?\s*([^\n]+)/i) || [])[1]);
          const partes = clean((text.match(/Partes\s*:?\s*([^\n]+)/i) || [])[1]);
          const mov = clean((text.match(/Última\s+movimenta[cç][aã]o\s*:?\s*([^\n]+)/i) || [])[1]);
          return { processTitle: title, processClass: classe || null, parties: partes || null, listLastMovementText: mov || null, rawLastMovementText: mov || null, detailsUrl: detailLink ? new URL(detailLink.getAttribute('href'), window.location.origin).href : null, rawText: text };
        });
        return { rows, declaredResultsCount: Number(countMatch?.[1] || rows.length || 0) };
      });

      debugSummary.declaredResultsCount = extraction.declaredResultsCount;
      const items = parseRows(extraction.rows);
      debugSummary.normalizedItemsCount = items.length;

      return createSourceResult({ source: 'trf1', sourceLabel: 'TRF1', status: 'success', items, debugSummary, debugData: debug?.enabled ? { requestId, userId } : null });
    } catch (err) {
      debugSummary.failureStage = debugSummary.submitSucceeded ? 'parse' : 'submit_or_wait';
      return createSourceResult({ source: 'trf1', sourceLabel: 'TRF1', status: 'error', items: [], error: { code: 'TRF1_QUERY_FAILED', message: err.message }, debugSummary });
    } finally {
      if (page) await page.close().catch(() => {});
      if (context) await context.close().catch(() => {});
      await browserResult.browser.close().catch(() => {});
    }
  }
}

module.exports = Trf1PublicaProvider;
