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
    expect(result.items).toEqual([{ source: 'trf1', sourceLabel: 'TRF1', processNumber: '1' }]);
    expect(result.sources[0].items).toEqual([]);
    expect(result.totalItems).toBe(1);
    expect(result.documentMasked).toContain('***');
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
          providerMeta: { debugLevel: 'detailed' },
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
    expect(result.debugReport.sourceReports[0].metrics).toEqual(expect.objectContaining({
      pageLoaded: false,
      documentFieldFound: false,
      searchTriggered: true,
      submitSucceeded: false,
      declaredResultsCount: 0,
      normalizedItemsCount: 0,
    }));
  });

  test('suporta modo institucional com CNPJ fixo', async () => {
    pool.query.mockResolvedValue({ rows: [{ id: 10, nome: 'Diretor', perfil_acesso: 'DIRETORIA' }] });
    const mockConsultar = jest.fn().mockResolvedValue({
      source: 'trf1',
      sourceLabel: 'TRF1',
      status: 'success',
      count: 1,
      items: [{ source: 'trf1', processNumber: '123' }],
    });

    buildConsultaProviders.mockReturnValue([
      {
        getId: () => 'trf1',
        getLabel: () => 'TRF1',
        isEnabled: () => true,
        consultarPorDocumento: mockConsultar,
      },
    ]);

    const result = await service.consultarPorUsuarioLogado({ userId: 10, requestId: 'r3', mode: 'institutional' });

    expect(result.ok).toBe(true);
    expect(result.mode).toBe('institutional');
    expect(mockConsultar).toHaveBeenCalledWith(expect.objectContaining({
      document: '39387378000125',
    }));
    expect(result.items[0].institutional).toBe(true);
  });

});


test('inclui providers desabilitados como skipped sem contaminar retorno consolidado', async () => {
  service.__testables.cache.clear();
  service.__testables.inFlight.clear();
  service.__testables.lastRunByUser.clear();
  pool.query.mockResolvedValue({ rows: [{ id: 10, cpf: '12345678901', nome: 'Teste', perfil_acesso: 'DIRETORIA' }] });

  buildConsultaProviders.mockReturnValue([
    {
      getId: () => 'trf1',
      getLabel: () => 'TRF1',
      getMaturityStatus: () => 'stable',
      isEnabled: () => true,
      consultarPorDocumento: jest.fn().mockResolvedValue({
        source: 'trf1',
        sourceLabel: 'TRF1',
        status: 'success',
        count: 1,
        items: [{ source: 'trf1', processNumber: 'proc-1' }],
      }),
    },
    {
      getId: () => 'trf6',
      getLabel: () => 'TRF6',
      getMaturityStatus: () => 'disabled',
      isEnabled: () => false,
    },
  ]);

  const result = await service.consultarPorUsuarioLogado({ userId: 10, requestId: 'r4' });

  expect(result.ok).toBe(true);
  expect(result.items).toHaveLength(1);
  expect(result.sources).toEqual(expect.arrayContaining([
    expect.objectContaining({
      source: 'trf1',
      status: 'success',
      providerMeta: expect.objectContaining({ maturity: 'stable', enabled: true }),
    }),
    expect.objectContaining({
      source: 'trf6',
      status: 'skipped',
      providerMeta: expect.objectContaining({
        maturity: 'disabled',
        enabled: false,
        skipReason: 'feature_flag_disabled',
        flagName: 'CONSULTA_PROCESSUAL_TRF6_ENABLED',
      }),
    }),
  ]));
});

test('preserva múltiplas linhas do TRF5 com mesmo CNJ quando contexto difere', async () => {
  service.__testables.cache.clear();
  service.__testables.inFlight.clear();
  service.__testables.lastRunByUser.clear();
  pool.query.mockResolvedValue({ rows: [{ id: 10, cpf: '12345678901', nome: 'Teste', perfil_acesso: 'DIRETORIA' }] });

  buildConsultaProviders.mockReturnValue([
    {
      getId: () => 'trf5',
      getLabel: () => 'TRF5',
      getMaturityStatus: () => 'stable',
      isEnabled: () => true,
      consultarPorDocumento: jest.fn().mockResolvedValue({
        source: 'trf5',
        sourceLabel: 'TRF5',
        status: 'success',
        count: 2,
        items: [
          { source: 'trf5', processNumber: '0512976-13.2006.4.05.8013', providerMeta: { gradeLevel: '1º Grau' } },
          { source: 'trf5', processNumber: '0512976-13.2006.4.05.8013', providerMeta: { gradeLevel: '2º Grau' } },
        ],
      }),
    },
  ]);

  const result = await service.consultarPorUsuarioLogado({ userId: 10, requestId: 'r5' });

  expect(result.ok).toBe(true);
  expect(result.items).toHaveLength(2);
});

test('aplica debug seletivo: TRF1 mínimo e TRF5 detalhado', async () => {
  service.__testables.cache.clear();
  service.__testables.inFlight.clear();
  service.__testables.lastRunByUser.clear();
  pool.query.mockResolvedValue({ rows: [{ id: 10, cpf: '12345678901', nome: 'Teste', perfil_acesso: 'DIRETORIA' }] });

  const trf1Consultar = jest.fn().mockResolvedValue({
    source: 'trf1',
    sourceLabel: 'TRF1',
    status: 'success',
    count: 1,
    items: [{ source: 'trf1', processNumber: 'proc-1' }],
  });
  const trf5Consultar = jest.fn().mockResolvedValue({
    source: 'trf5',
    sourceLabel: 'TRF5',
    status: 'error',
    count: 0,
    items: [],
    providerMeta: { debugLevel: 'detailed' },
    debugSummary: { failureStage: 'document_field' },
    error: { code: 'DOM_MAPPING_REQUIRED', message: 'Campo CPF não identificado no TRF5' },
  });

  buildConsultaProviders.mockReturnValue([
    { getId: () => 'trf1', getLabel: () => 'TRF1', getMaturityStatus: () => 'stable', isEnabled: () => true, consultarPorDocumento: trf1Consultar },
    { getId: () => 'trf5', getLabel: () => 'TRF5', getMaturityStatus: () => 'experimental', isEnabled: () => true, consultarPorDocumento: trf5Consultar },
  ]);

  const result = await service.consultarPorUsuarioLogado({ userId: 10, requestId: 'r6', debug: true });

  expect(trf1Consultar).toHaveBeenCalledWith(expect.objectContaining({
    debug: expect.objectContaining({ level: 'minimal', includeArtifacts: false }),
  }));
  expect(trf5Consultar).toHaveBeenCalledWith(expect.objectContaining({
    debug: expect.objectContaining({ level: 'detailed', includeArtifacts: true }),
  }));
  const trf1Source = result.sources.find((s) => s.source === 'trf1');
  expect(trf1Source.debugData).toBeNull();
  expect(trf1Source.items).toEqual([]);
  const trf1Report = result.debugReport.sourceReports.find((s) => s.source === 'trf1');
  expect(Object.keys(trf1Report.metrics).sort()).toEqual([
    'declaredResultsCount',
    'documentFieldFound',
    'normalizedItemsCount',
    'pageLoaded',
    'searchTriggered',
    'submitSucceeded',
  ]);
});
