jest.mock('../service/playwrightBrowserService', () => ({ launchBrowser: jest.fn() }));
const { launchBrowser } = require('../service/playwrightBrowserService');
const Trf1PublicaProvider = require('./trf1PublicaProvider');

function mockBrowserWithTwoRows() {
  let currentUrl = 'https://pje1g-consultapublica.trf1.jus.br/consultapublica/ConsultaPublica/listView.seam';
  const mockLocator = (selector) => {
    const normalized = String(selector || '').replace(/\\/g, '');
    if (normalized === '#fPP:dpDec:documentoParte') {
      return {
        fill: jest.fn().mockResolvedValue(undefined),
        dispatchEvent: jest.fn().mockResolvedValue(undefined),
        inputValue: jest.fn().mockResolvedValue('032.410.634-37'),
        count: jest.fn().mockResolvedValue(1),
        click: jest.fn().mockResolvedValue(undefined),
        focus: jest.fn().mockResolvedValue(undefined),
      };
    }
    if (normalized === '#fPP:searchProcessos') return { click: jest.fn().mockResolvedValue(undefined), count: jest.fn().mockResolvedValue(1), scrollIntoViewIfNeeded: jest.fn().mockResolvedValue(undefined), boundingBox: jest.fn().mockResolvedValue({ x: 10, y: 10, width: 100, height: 30 }) };
    if (normalized === '#fPP:processosGridPanel' || normalized === '#fPP:processosGridPanel_body') {
      return {
        innerText: jest.fn().mockResolvedValue('2 resultados encontrados 1061304-94.2023.4.01.3400 1055982-59.2024.4.01.3400'),
        innerHTML: jest.fn().mockResolvedValue('<div>2 resultados encontrados</div>'),
        count: jest.fn().mockResolvedValue(1),
      };
    }
    if (normalized === '#fPP:processosTable a[href]') return { count: jest.fn().mockResolvedValue(2) };
    if (normalized === '#fPP:processosTable') return { innerHTML: jest.fn().mockResolvedValue('<table><tbody><tr></tr></tbody></table>') };
    if (selector === 'input[type="radio"]') return { count: jest.fn().mockResolvedValue(1) };
    if (String(selector).includes('input[type="radio"]')) return { first: jest.fn().mockReturnValue({ check: jest.fn().mockResolvedValue(undefined) }) };
    if (selector === 'body') return { innerText: jest.fn().mockResolvedValue('20/10/2025 20:12:22 - Juntada de petição intercorrente') };
    return { innerText: jest.fn().mockResolvedValue(''), innerHTML: jest.fn().mockResolvedValue(''), count: jest.fn().mockResolvedValue(0) };
  };

  const page = {
    on: jest.fn(),
    goto: jest.fn().mockImplementation(async (u) => { currentUrl = u; }),
    url: jest.fn(() => currentUrl),
    title: jest.fn().mockResolvedValue('Consulta Pública Processual'),
    content: jest.fn().mockResolvedValue('<html><body>2 resultados encontrados</body></html>'),
    screenshot: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    waitForTimeout: jest.fn().mockResolvedValue(undefined),
    locator: jest.fn(mockLocator),
    keyboard: { press: jest.fn().mockResolvedValue(undefined), type: jest.fn().mockResolvedValue(undefined) },
    mouse: { move: jest.fn().mockResolvedValue(undefined), down: jest.fn().mockResolvedValue(undefined), up: jest.fn().mockResolvedValue(undefined) },
    evaluate: jest.fn().mockResolvedValue({
      declaredResultsCount: 2,
      panelText: '2 resultados encontrados',
      linksFound: 2,
      hasGridPanel: true,
      hasGridPanelBody: true,
      hasProcessTable: true,
      cnjMatchesFound: 2,
      rows: [
        {
          processTitle: 'CumSenFaz 1061304-94.2023.4.01.3400 - Abono Pecuniário (Art. 78 Lei 8.112/1990)',
          processClass: 'CUMPRIMENTO DE SENTENÇA CONTRA A FAZENDA PÚBLICA',
          parties: 'ALESSANDRO ARAUJO DE MELLO e outros (45) X UNIÃO FEDERAL',
          listLastMovementText: 'Juntada de petição intercorrente (20/10/2025 20:12:22)',
          rawLastMovementText: '20/10/2025 20:12:22 - Juntada de petição intercorrente',
          detailsUrl: 'https://trf1.test/1',
        },
        {
          processTitle: 'CumSenFaz 1055982-59.2024.4.01.3400 - Índice de 28,86% Lei 8.622/1993 e 8.627/1993',
          processClass: 'CUMPRIMENTO DE SENTENÇA CONTRA A FAZENDA PÚBLICA',
          parties: 'ALEXANDRE LEITE LOUCAO e outros (19) X UNIÃO FEDERAL',
          listLastMovementText: 'Juntada de manifestação (27/02/2025 15:37:20)',
          rawLastMovementText: '27/02/2025 15:37:20 - Juntada de manifestação',
          detailsUrl: 'https://trf1.test/2',
        },
      ],
    }),
  };

  const detailPage = {
    goto: jest.fn().mockResolvedValue(undefined),
    url: jest.fn().mockReturnValue('https://trf1.test/detail'),
    locator: jest.fn(mockLocator),
    keyboard: { press: jest.fn().mockResolvedValue(undefined), type: jest.fn().mockResolvedValue(undefined) },
    mouse: { move: jest.fn().mockResolvedValue(undefined), down: jest.fn().mockResolvedValue(undefined), up: jest.fn().mockResolvedValue(undefined) },
    screenshot: jest.fn().mockResolvedValue(undefined),
    content: jest.fn().mockResolvedValue('<html>detail</html>'),
    close: jest.fn().mockResolvedValue(undefined),
  };

  const context = {
    newPage: jest.fn().mockResolvedValueOnce(page).mockResolvedValue(detailPage),
    close: jest.fn().mockResolvedValue(undefined),
  };
  return { ok: true, browser: { newContext: jest.fn().mockResolvedValue(context), close: jest.fn().mockResolvedValue(undefined) } };
}

test('TRF1 provider retorna os 2 processos oficiais', async () => {
  launchBrowser.mockResolvedValue(mockBrowserWithTwoRows());
  const provider = new Trf1PublicaProvider();
  const result = await provider.consultarPorDocumento({ document: '03241063437', requestId: 'x', userId: 1, debug: { enabled: false } });
  expect(result.status).toBe('success');
  expect(result.count).toBe(2);
  expect(result.items[0].processNumber).toBe('1061304-94.2023.4.01.3400');
  expect(result.items[1].processNumber).toBe('1055982-59.2024.4.01.3400');
});
