jest.mock('../service/playwrightBrowserService', () => ({
  launchBrowser: jest.fn(),
}));

const Trf5PublicaProvider = require('./trf5PublicaProvider');
const { launchBrowser } = require('../service/playwrightBrowserService');

function buildPlaywrightOkMock({ extraction, diagnostics }) {
  const mockFrame = {
    content: jest.fn().mockResolvedValue('CPF Processo'),
    evaluate: jest.fn()
      .mockResolvedValueOnce(diagnostics.domInventory.elements) // collectDomDiagnostics
      .mockResolvedValueOnce(diagnostics.resultsContainerCandidates) // detectResultsContainers
      .mockResolvedValueOnce({ cnjMatches: 3, changed: true, hasResultsText: true, hasTableRows: true, hasLoadingIndicator: false }) // waitForTrf5Signals (real)
      .mockResolvedValueOnce(extraction), // extraction
    innerText: jest.fn().mockResolvedValue('initial'),
    locator: jest.fn((sel) => ({
      first: () => ({
        isVisible: jest.fn().mockResolvedValue(true),
        click: jest.fn().mockResolvedValue(undefined),
        fill: jest.fn().mockResolvedValue(undefined),
        type: jest.fn().mockResolvedValue(undefined),
        dispatchEvent: jest.fn().mockResolvedValue(undefined),
        inputValue: jest.fn().mockResolvedValue('032.410.634-37'),
        scrollIntoViewIfNeeded: () => ({ catch: () => {} }),
        innerText: jest.fn().mockResolvedValue('initial'),
        page: () => searchPage,
      }),
    })),
    page: () => searchPage,
  };

  const searchPage = {
    goto: jest.fn().mockResolvedValue(undefined),
    content: jest.fn().mockResolvedValue('<html>BI Portal</html>'),
    waitForTimeout: jest.fn().mockResolvedValue(undefined),
    setViewportSize: jest.fn().mockResolvedValue(undefined),
    frames: jest.fn().mockReturnValue([mockFrame]),
    keyboard: {
      press: jest.fn().mockResolvedValue(undefined),
    },
    locator: jest.fn(() => ({
      first: () => ({
        isVisible: jest.fn().mockResolvedValue(true),
        click: jest.fn().mockResolvedValue(undefined),
        fill: jest.fn().mockResolvedValue(undefined),
        type: jest.fn().mockResolvedValue(undefined),
        dispatchEvent: jest.fn().mockResolvedValue(undefined),
        inputValue: jest.fn().mockResolvedValue('032.410.634-37'),
        scrollIntoViewIfNeeded: () => ({ catch: () => {} }),
        innerText: jest.fn().mockResolvedValue('initial'),
      }),
    })),
    evaluate: jest.fn()
      .mockResolvedValue({ cnjMatches: 0, changed: false, hasResultsText: false, hasTableRows: false, hasLoadingIndicator: false }), // baselineSignals (default)
    close: jest.fn().mockResolvedValue(undefined),
  };

  const context = {
    newPage: jest.fn().mockResolvedValue(searchPage),
    close: jest.fn().mockResolvedValue(undefined),
  };

  const browser = {
    newContext: jest.fn().mockResolvedValue(context),
    close: jest.fn().mockResolvedValue(undefined),
  };

  return { ok: true, browser };
}

describe('Trf5PublicaProvider diagnostics heuristics', () => {
  test('rankDocumentFieldCandidates prioriza campo com CPF/CNPJ', () => {
    const provider = new Trf5PublicaProvider();
    const { documentFieldChosen } = provider.rankDocumentFieldCandidates([
      { tag: 'input', type: 'text', id: 'foo', name: 'other', placeholder: null, title: null, ariaLabel: null, labelText: 'Nome', parentText: '', grandParentText: '', className: '', visible: true, bbox: { x: 10, y: 300, width: 100 } },
      { tag: 'input', type: 'text', id: 'doc', name: 'documentoParte', placeholder: 'CPF/CNPJ', title: null, ariaLabel: null, labelText: 'CPF/CNPJ da parte', parentText: '', grandParentText: '', className: '', visible: true, bbox: { x: 10, y: 220, width: 100 } },
    ]);

    expect(documentFieldChosen).toBeTruthy();
    expect(documentFieldChosen.id).toBe('doc');
    expect(documentFieldChosen.score).toBeGreaterThan(70);
  });

  test('rankSearchCandidates prioriza ação de pesquisar', () => {
    const provider = new Trf5PublicaProvider();
    const { searchActionChosen } = provider.rankSearchCandidates([
      { tag: 'button', type: '', text: 'Limpar', valueMasked: null, labelText: '', name: 'clear', id: 'clear', parentText: '', ariaLabel: null, title: null, className: '', visible: true, bbox: { x: 10, y: 300, width: 100 } },
      { tag: 'button', type: '', text: 'Pesquisar', valueMasked: null, labelText: '', name: 'search', id: 'search', parentText: '', ariaLabel: null, title: null, className: '', visible: true, bbox: { x: 10, y: 240, width: 100 } },
    ], { bbox: { y: 210 } });

    expect(searchActionChosen).toBeTruthy();
    expect(searchActionChosen.text).toContain('Pesquisar');
    expect(searchActionChosen.score).toBeGreaterThan(60);
  });

  test('fluxo de consulta TRF5 BI identifica 3 processos no mock', async () => {
    launchBrowser.mockResolvedValue(buildPlaywrightOkMock({
      diagnostics: {
        domInventory: { elements: [
          { tag: 'input', type: 'text', id: 'cpf', name: 'cpf', placeholder: null, title: null, ariaLabel: null, labelText: '', parentText: '', grandParentText: '', className: '', visible: true, bbox: { x: 10, y: 100, width: 100 }, selector: '#cpf', frameIndex: 0 },
          { tag: 'button', text: 'Pesquisar', valueMasked: null, labelText: '', name: 'btn', id: 'btn', parentText: '', ariaLabel: null, title: null, className: '', visible: true, bbox: { x: 10, y: 150, width: 100 }, selector: '#btn', frameIndex: 0 },
        ]},
        documentFieldCandidates: [{ selector: '#cpf', score: 100, frameIndex: 0 }],
        documentFieldChosen: { selector: '#cpf', score: 100, bbox: { y: 100 }, frameIndex: 0 },
        searchActionCandidates: [{ selector: '#btn', score: 100, frameIndex: 0 }],
        searchActionChosen: { selector: '#btn', score: 100, frameIndex: 0 },
        resultsContainerCandidates: [{ selector: '#results', score: 100, frameIndex: 0 }],
        resultsContainerChosen: { selector: '#results', score: 100, frameIndex: 0 },
        autoDetectionConfidence: 100
      },
      extraction: {
        cnjMatchesFound: 3,
        declaredResultsCount: 3,
        rows: [
          { processNumber: '0800001-01.2024.4.05.0000', parties: 'Parte A x Parte B' },
          { processNumber: '0800002-02.2024.4.05.0000', parties: 'Parte C x Parte D' },
          { processNumber: '0800003-03.2024.4.05.0000', parties: 'Parte E x Parte F' },
        ]
      }
    }));

    const provider = new Trf5PublicaProvider();
    provider.isEnabled = () => true;

    const result = await provider.consultarPorDocumento({
      document: '03241063437',
      documentMasked: '032.410.634-37',
      requestId: 'test-trf5',
      userId: 1,
      debug: true
    });

    if (result.status === 'error') {
      console.log('Test Error Result:', JSON.stringify(result.error, null, 2));
    }
    expect(result.status).toBe('success');
    expect(result.items).toHaveLength(3);
    expect(result.debugSummary.normalizedItemsCount).toBe(3);
    expect(result.debugSummary.maskedInputAccepted).toBe(true);
  });
});
