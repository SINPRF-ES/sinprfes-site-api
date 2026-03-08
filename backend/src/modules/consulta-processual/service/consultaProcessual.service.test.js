jest.mock('../../../config/db', () => ({
  query: jest.fn(),
}));

jest.mock('../providers', () => ({
  buildConsultaProviders: jest.fn(),
}));

const pool = require('../../../config/db');
const { buildConsultaProviders } = require('../providers');
const service = require('./consultaProcessual.service');

describe('consultaProcessual.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    service.__testables.cache.clear();
    service.__testables.inFlight.clear();
    service.__testables.lastRunByUser.clear();
  });

  test('consolida retorno de provider com sucesso', async () => {
    pool.query.mockResolvedValue({ rows: [{ id: 10, cpf: '12345678901', nome: 'Teste', perfil_acesso: 'DIRETORIA' }] });
    buildConsultaProviders.mockReturnValue([
      {
        getId: () => 'trf1',
        getLabel: () => 'TRF1',
        isEnabled: () => true,
        consultarPorDocumento: jest.fn().mockResolvedValue({
          source: 'trf1',
          sourceLabel: 'TRF1',
          status: 'success',
          count: 1,
          items: [{ source: 'trf1', sourceLabel: 'TRF1', processNumber: '1' }],
        }),
      },
    ]);

    const result = await service.consultarPorUsuarioLogado({ userId: 10, requestId: 'r1' });

    expect(result.ok).toBe(true);
    expect(result.sources).toHaveLength(1);
    expect(result.items).toEqual([{ source: 'trf1', sourceLabel: 'TRF1', processNumber: '1', isSindicato: false }]);
    expect(result.totalItems).toBe(1);
    expect(result.cpfMasked).toContain('***');
  });

  test('inclui debugReport consolidado quando debug está ativo', async () => {
    pool.query.mockResolvedValue({ rows: [{ id: 10, cpf: '12345678901', nome: 'Teste', perfil_acesso: 'DIRETORIA' }] });
    buildConsultaProviders.mockReturnValue([
      {
        getId: () => 'trf1',
        getLabel: () => 'TRF1',
        isEnabled: () => true,
        consultarPorDocumento: jest.fn().mockResolvedValue({
          source: 'trf1',
          sourceLabel: 'TRF1',
          status: 'success',
          count: 0,
          items: [],
          debugSummary: {
            searchTriggered: true,
            resultsContainerFound: true,
            rawBlocksFound: 2,
            normalizedItemsCount: 0,
            failureStage: 'normalization',
          },
          debugData: {
            steps: [{ step: 'E_capture_results_end', timestamp: '2026-01-01T00:00:00.000Z' }],
            warnings: [{ step: 'normalize_item_rejected', reason: 'missing_href', timestamp: '2026-01-01T00:00:01.000Z' }],
            artifacts: [{ name: 'results-grid.html', path: '/tmp/x' }],
            discardReasons: { missing_href: 2 },
          },
        }),
      },
    ]);

    const result = await service.consultarPorUsuarioLogado({ userId: 10, requestId: 'r2', debug: true });

    expect(result.ok).toBe(true);
    expect(result.debugReport).toBeTruthy();
    expect(result.debugReport.likelyFailureStage).toBe('normalization');
    expect(result.debugReport.sourceReports[0].discardReasons).toEqual({ missing_href: 2 });
  });

});
