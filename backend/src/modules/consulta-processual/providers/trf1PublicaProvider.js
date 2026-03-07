const path = require('path');
const ConsultaProcessualProvider = require('./ConsultaProcessualProvider');
const { getConsultaProcessualConfig } = require('../utils/consultaProcessualConfig');
const { parseTrf1Rows } = require('../parsers/trf1ProcessParser');
const { createSourceResult } = require('../dto/consultaProcessualDto');
const log = require('../../../utils/log');

const TRF1_URL = 'https://pje1g-consultapublica.trf1.jus.br/consultapublica/ConsultaPublica/listView.seam';

class Trf1PublicaProvider extends ConsultaProcessualProvider {
  getId() { return 'trf1'; }
  getLabel() { return 'TRF1'; }
  isEnabled() { return getConsultaProcessualConfig().trf1Enabled; }

  async consultarPorCpf({ cpf, cpfMasked, requestId, userId }) {
    const startedAt = Date.now();
    const cfg = getConsultaProcessualConfig();

    if (!this.isEnabled()) {
      return createSourceResult({ source: this.getId(), sourceLabel: this.getLabel(), status: 'skipped', items: [] });
    }

    let browser;
    try {
      const playwright = await import('playwright');
      browser = await playwright.chromium.launch({ headless: cfg.headless });
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto(TRF1_URL, { waitUntil: 'domcontentloaded', timeout: cfg.initialLoadTimeoutMs });
      await page.locator('input[name="tipoMascaraDocumento"]').first().check();
      await page.locator('#fPP\\:dpDec\\:documentoParte').fill(cpf);
      await page.locator('#fPP\\:searchProcessos').click();

      const grid = page.locator('#fPP\\:processosGridPanel');
      await grid.waitFor({ state: 'visible', timeout: cfg.searchTimeoutMs });

      const rows = await page.evaluate(() => {
        const table = document.querySelector('#fPP\\:processosTable');
        if (!table) return [];
        const trs = Array.from(table.querySelectorAll('tr')).slice(1);

        return trs.map((tr) => {
          const tds = Array.from(tr.querySelectorAll('td'));
          const cellText = (idx) => (tds[idx]?.textContent || '').replace(/\s+/g, ' ').trim();
          const link = tr.querySelector('a[href]');
          const movementRaw = cellText(4);
          const movementParts = movementRaw.split('(');
          return {
            processNumber: cellText(0) || null,
            processClass: cellText(1) || null,
            subject: cellText(2) || null,
            parties: cellText(3) || null,
            lastMovement: (movementParts[0] || '').trim() || null,
            lastMovementText: movementRaw || null,
            detailsUrl: link ? link.href : null,
            providerMeta: {},
          };
        }).filter((it) => it.processNumber);
      });

      const items = parseTrf1Rows(rows);
      log.info('ConsultaProcessualProviderResult', {
        requestId,
        userId,
        source: this.getId(),
        cpfMasked,
        count: items.length,
        durationMs: Date.now() - startedAt,
      });

      return createSourceResult({ source: this.getId(), sourceLabel: this.getLabel(), status: 'success', items });
    } catch (err) {
      log.warn('ConsultaProcessualProviderError', {
        requestId,
        userId,
        source: this.getId(),
        cpfMasked,
        errorMessage: err.message,
        durationMs: Date.now() - startedAt,
      });

      if (cfg.debugScreenshot && browser) {
        try {
          const p = path.resolve(process.cwd(), `backend/tmp/consulta-processual-${Date.now()}-${this.getId()}.png`);
          const pages = (await browser.contexts()[0]?.pages()) || [];
          if (pages[0]) await pages[0].screenshot({ path: p, fullPage: true });
        } catch (_) {}
      }

      return createSourceResult({
        source: this.getId(),
        sourceLabel: this.getLabel(),
        status: 'error',
        items: [],
        error: {
          code: 'PROVIDER_TEMPORARILY_UNAVAILABLE',
          message: 'TRF1 indisponível no momento',
        },
      });
    } finally {
      if (browser) await browser.close().catch(() => {});
    }
  }
}

module.exports = Trf1PublicaProvider;
