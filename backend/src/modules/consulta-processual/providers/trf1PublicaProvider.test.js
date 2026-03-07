jest.mock('../service/playwrightBrowserService', () => ({
  launchBrowser: jest.fn(),
}));

const Trf1PublicaProvider = require('./trf1PublicaProvider');
const { launchBrowser } = require('../service/playwrightBrowserService');

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
});
