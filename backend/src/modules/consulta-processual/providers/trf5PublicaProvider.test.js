jest.mock('../service/playwrightBrowserService', () => ({
  launchBrowser: jest.fn(),
}));

const Trf5PublicaProvider = require('./trf5PublicaProvider');
const { launchBrowser } = require('../service/playwrightBrowserService');

describe('Trf5PublicaProvider heuristics', () => {
  let provider;

  beforeEach(() => {
    process.env.CONSULTA_PROCESSUAL_TRF5_ENABLED = 'true';
    provider = new Trf5PublicaProvider();
  });

  test('retorna error com debug quando browser não inicia (não deve ficar skipped)', async () => {
    launchBrowser.mockResolvedValue({
      ok: false,
      code: 'PLAYWRIGHT_BROWSER_MISSING',
      message: 'Chromium is not installed',
    });

    const result = await provider.consultarPorDocumento({
      document: '03241063437',
      documentMasked: '032.410.634-37',
      requestId: 'req-trf5-browser',
      userId: 7,
      debug: true,
    });

    expect(result.status).toBe('error');
    expect(result.error).toEqual(expect.objectContaining({
      code: 'PLAYWRIGHT_BROWSER_MISSING',
      stage: 'browser_launch',
    }));
    expect(result.debugSummary).toEqual(expect.objectContaining({
      failureStage: 'browser_launch',
      maskedInputAccepted: false,
      searchTriggered: false,
    }));
  });

  test('rankDocumentFieldCandidates prioriza campo com CPF/CNPJ', () => {
    const elements = [
      { tag: 'input', type: 'text', id: 'foo', className: '', visible: true, contextText: 'Nome', bbox: { y: 100 } },
      { tag: 'input', type: 'text', id: 'doc', className: 'lui-input', visible: true, contextText: 'CPF da parte', bbox: { y: 150 } },
    ];
    const { documentFieldChosen } = provider.rankDocumentFieldCandidates(elements);

    expect(documentFieldChosen).toBeTruthy();
    expect(documentFieldChosen.id).toBe('doc');
    expect(documentFieldChosen.score).toBeGreaterThan(150);
  });

  test('rankSearchCandidates prioriza ação de buscar/pesquisar', () => {
    const elements = [
      { tag: 'button', text: 'Limpar', className: '', visible: true, contextText: '', bbox: { y: 200 } },
      { tag: 'button', text: 'Buscar', className: 'lui-button', visible: true, contextText: '', bbox: { y: 200 } },
    ];
    const { searchActionChosen } = provider.rankSearchCandidates(elements, { bbox: { y: 150 } });

    expect(searchActionChosen).toBeTruthy();
    expect(searchActionChosen.text).toBe('Buscar');
    expect(searchActionChosen.score).toBeGreaterThan(150);
  });
});
