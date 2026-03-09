jest.mock('../service/playwrightBrowserService', () => ({ launchBrowser: jest.fn() }));
const { launchBrowser } = require('../service/playwrightBrowserService');
const Trf1PublicaProvider = require('./trf1PublicaProvider');

function mockBrowserWithTwoRows() {
  const page = {
    goto: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined),
    locator: jest.fn((selector) => {
      if (selector === '#fPP\\:dpDec\\:documentoParte') return { fill: jest.fn() };
      if (selector === '#fPP\\:searchProcessos') return { click: jest.fn() };
      if (selector === '#fPP\\:processosGridPanel_body') return { innerText: jest.fn().mockResolvedValue('') };
      return { innerText: jest.fn().mockResolvedValue('') };
    }),
    waitForFunction: jest.fn().mockResolvedValue(true),
    evaluate: jest.fn().mockResolvedValue({
      declaredResultsCount: 2,
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

  const context = { newPage: jest.fn().mockResolvedValue(page), close: jest.fn().mockResolvedValue(undefined) };
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
