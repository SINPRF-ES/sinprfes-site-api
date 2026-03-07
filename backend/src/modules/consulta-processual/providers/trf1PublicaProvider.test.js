jest.mock('../service/playwrightBrowserService', () => ({
  launchBrowser: jest.fn(),
}));

const Trf1PublicaProvider = require('./trf1PublicaProvider');
const { launchBrowser } = require('../service/playwrightBrowserService');

function buildPlaywrightOkMock(extraction) {
  const page = {
    goto: jest.fn().mockResolvedValue(undefined),
    locator: jest.fn((selector) => {
      if (selector === 'input[name="tipoMascaraDocumento"]') {
        return {
          first: () => ({ check: jest.fn().mockResolvedValue(undefined) }),
        };
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

      return {
        first: () => ({ check: jest.fn().mockResolvedValue(undefined) }),
      };
    }),
    evaluate: jest.fn().mockResolvedValue(extraction),
    screenshot: jest.fn().mockResolvedValue(undefined),
  };

  const context = {
    newPage: jest.fn().mockResolvedValue(page),
  };

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

  it('prioriza processos parseados e não retorna nós brutos quando há CNJ válido', async () => {
    launchBrowser.mockResolvedValue(buildPlaywrightOkMock({
      rows: [
        {
          processNumber: 'CumSen 0003990-96.2012.4.01.3400',
          processClass: 'CUMPRIMENTO DE SENTENÇA',
          subject: 'Índice de 28,86%',
          parties: 'Pessoa A X União',
          lastMovement: 'Conclusos para decisão',
          lastMovementAt: '10/09/2025 14:27:38',
          rawLastMovementText: 'Conclusos para decisão (10/09/2025 14:27:38)',
        },
      ],
      rawById: [
        { id: 'fPP:processosGridPanel', tagName: 'div', text: '2 resultados encontrados', html: '' },
      ],
      debug: { html: {}, counts: {}, panelTextRaw: '2 resultados encontrados', panelCnjs: [] },
    }));

    const provider = new Trf1PublicaProvider();
    const result = await provider.consultarPorCpf({
      cpf: '12345678901',
      cpfMasked: '***6789**',
      requestId: 'req-2',
      userId: 1,
    });

    expect(result.status).toBe('success');
    expect(result.items).toHaveLength(1);
    expect(result.items[0].processNumber).toBe('0003990-96.2012.4.01.3400');
    expect(result.items[0].processClass).toBe('CUMPRIMENTO DE SENTENÇA');
  });

  it('usa fallback bruto apenas quando parser não encontra processos válidos', async () => {
    launchBrowser.mockResolvedValue(buildPlaywrightOkMock({
      rows: [],
      rawById: [
        { id: 'fPP:processosGridPanel', tagName: 'div', text: 'Processo Última movimentação', html: '<div />' },
      ],
      debug: { html: {}, counts: {}, panelTextRaw: '0 resultados encontrados', panelCnjs: [] },
    }));

    const provider = new Trf1PublicaProvider();
    const result = await provider.consultarPorCpf({
      cpf: '12345678901',
      cpfMasked: '***6789**',
      requestId: 'req-3',
      userId: 1,
    });

    expect(result.status).toBe('success');
    expect(result.items).toHaveLength(1);
    expect(result.items[0].processNumber).toBe('RAW:fPP:processosGridPanel');
  });
});
