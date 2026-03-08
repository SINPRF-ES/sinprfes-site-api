jest.mock('../service/playwrightBrowserService', () => ({
  launchBrowser: jest.fn(),
}));

const Trf1PublicaProvider = require('./trf1PublicaProvider');
const { launchBrowser } = require('../service/playwrightBrowserService');

function buildPlaywrightOkMock({ extraction, detailsByUrl = {} }) {
  const searchPage = {
    goto: jest.fn().mockResolvedValue(undefined),
    locator: jest.fn((selector) => {
      if (selector === 'input[name="tipoMascaraDocumento"]') {
        return { first: () => ({ check: jest.fn().mockResolvedValue(undefined) }) };
      }
      if (selector === '#fPP\\:dpDec\\:documentoParte') {
        return { fill: jest.fn().mockResolvedValue(undefined) };
      }
      if (selector === '#fPP\\:searchProcessos') {
        return { click: jest.fn().mockResolvedValue(undefined) };
      }
      if (selector === '#fPP\\:processosGridPanel') {
        return { waitFor: jest.fn().mockResolvedValue(undefined) };
      }
      return { first: () => ({ check: jest.fn().mockResolvedValue(undefined) }) };
    }),
    evaluate: jest.fn().mockResolvedValue(extraction),
    screenshot: jest.fn().mockResolvedValue(undefined),
  };

  const context = {
    newPage: jest.fn()
      .mockResolvedValueOnce(searchPage)
      .mockImplementation(async () => ({
        goto: jest.fn().mockResolvedValue(undefined),
        evaluate: jest.fn().mockImplementation(() => {
          const currentUrl = context.__lastUrl;
          return detailsByUrl[currentUrl] || {
            lastMovement: null,
            lastMovementAt: null,
            rawLastMovementText: null,
            debug: { detailText: '', detailHtml: '' },
          };
        }),
        close: jest.fn().mockResolvedValue(undefined),
      })),
  };

  // capture url used by detail pages
  const originalImplementation = context.newPage;
  context.newPage = jest.fn().mockImplementation(async (...args) => {
    const page = await originalImplementation(...args);
    const originalGoto = page.goto;
    page.goto = jest.fn(async (url, opts) => {
      context.__lastUrl = url;
      return originalGoto(url, opts);
    });
    return page;
  });

  const browser = {
    newContext: jest.fn().mockResolvedValue(context),
    close: jest.fn().mockResolvedValue(undefined),
    contexts: jest.fn().mockReturnValue([]),
  };

  return { ok: true, browser };
}

describe('Trf1PublicaProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CONSULTA_PROCESSUAL_TRF1_ENABLED = 'true';
  });

  it('retorna skipped quando browser service reporta ausência do pacote', async () => {
    launchBrowser.mockResolvedValue({
      ok: false,
      reasonCode: 'PLAYWRIGHT_PACKAGE_MISSING',
      reason: 'Playwright package is not installed in backend runtime.',
    });

    const provider = new Trf1PublicaProvider();
    const result = await provider.consultarPorCpf({
      cpf: '12345678901',
      cpfMasked: '***6789**',
      requestId: 'req-1',
      userId: 1,
    });

    expect(result.status).toBe('skipped');
    expect(result.source).toBe('trf1');
    expect(result.items).toEqual([]);
  });

  it('extrai processos válidos e prioriza última movimentação vinda do detalhe', async () => {
    const detailsUrl1 = 'https://trf1.test/detalhe1';
    const detailsUrl2 = 'https://trf1.test/detalhe2';

    launchBrowser.mockResolvedValue(buildPlaywrightOkMock({
      extraction: {
        rows: [
          {
            processNumber: '0003990-96.2012.4.01.3400',
            processClass: 'CUMPRIMENTO DE SENTENÇA',
            processTitle: 'CumSen 0003990-96.2012.4.01.3400 - Índice de 28,86% Lei 8.622/1993 e 8.627/1993',
            parties: 'MARA REJANY DA SILVA TERTO NARCIZO e outros (50) X UNIÃO FEDERAL',
            detailsUrl: detailsUrl1,
            listLastMovementText: 'Conclusos para decisão (10/09/2025 14:27:38)',
            listLastMovementAt: '10/09/2025 14:27:38',
          },
          {
            processNumber: '1061274-59.2023.4.01.3400',
            processClass: 'CUMPRIMENTO DE SENTENÇA CONTRA A FAZENDA PÚBLICA',
            processTitle: 'CumSenFaz 1061274-59.2023.4.01.3400 - Abono Pecuniário (Art. 78 Lei 8.112/1990)',
            parties: 'ADIR SERGIO MARGON e outros (49) X UNIÃO FEDERAL',
            detailsUrl: detailsUrl2,
            listLastMovementText: 'Conclusos para decisão (03/09/2025 14:53:59)',
            listLastMovementAt: '03/09/2025 14:53:59',
          },
        ],
        debug: {
          html: { panel: '<div />', panelBody: '<div />', table: '<table />' },
          counts: { anchorsDetected: 2, processAnchorsDetected: 2, processRowsDetected: 2 },
          panelTextRaw: '2 resultados encontrados',
          countFromText: 2,
          detectedCnjs: ['0003990-96.2012.4.01.3400', '1061274-59.2023.4.01.3400'],
          detectedLinks: [detailsUrl1, detailsUrl2],
        },
      },
      detailsByUrl: {
        [detailsUrl1]: {
          lastMovement: 'Conclusos para decisão',
          lastMovementAt: '10/09/2025 14:27:38',
          rawLastMovementText: '10/09/2025 14:27:38 - Conclusos para decisão',
          debug: { detailText: '...', detailHtml: '<table />' },
        },
        [detailsUrl2]: {
          lastMovement: 'Conclusos para decisão',
          lastMovementAt: '03/09/2025 14:53:59',
          rawLastMovementText: '03/09/2025 14:53:59 - Conclusos para decisão',
          debug: { detailText: '...', detailHtml: '<table />' },
        },
      },
    }));

    const provider = new Trf1PublicaProvider();
    const result = await provider.consultarPorCpf({
      cpf: '06889315707',
      cpfMasked: '***8931***',
      requestId: 'req-2',
      userId: 1,
    });

    expect(result.status).toBe('success');
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      processNumber: '0003990-96.2012.4.01.3400',
      processClass: 'CUMPRIMENTO DE SENTENÇA',
      processTitle: 'CumSen 0003990-96.2012.4.01.3400 - Índice de 28,86% Lei 8.622/1993 e 8.627/1993',
      parties: 'MARA REJANY DA SILVA TERTO NARCIZO e outros (50) X UNIÃO FEDERAL',
      lastMovement: 'Conclusos para decisão',
      rawLastMovementText: '10/09/2025 14:27:38 - Conclusos para decisão',
      lastMovementAt: '2025-09-10T14:27:38.000Z',
    });
    expect(result.items[1]).toMatchObject({
      processNumber: '1061274-59.2023.4.01.3400',
      processClass: 'CUMPRIMENTO DE SENTENÇA CONTRA A FAZENDA PÚBLICA',
      processTitle: 'CumSenFaz 1061274-59.2023.4.01.3400 - Abono Pecuniário (Art. 78 Lei 8.112/1990)',
      parties: 'ADIR SERGIO MARGON e outros (49) X UNIÃO FEDERAL',
      lastMovement: 'Conclusos para decisão',
      rawLastMovementText: '03/09/2025 14:53:59 - Conclusos para decisão',
      lastMovementAt: '2025-09-03T14:53:59.000Z',
    });
  });
});
