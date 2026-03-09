jest.mock('../../../config/db', () => ({ query: jest.fn() }));
jest.mock('../providers', () => ({ buildConsultaProviders: jest.fn() }));

const pool = require('../../../config/db');
const { buildConsultaProviders } = require('../providers');
const service = require('./consultaProcessual.service');

describe('consultaProcessual.service TRF1-only', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    service.__testables.cache.clear();
    service.__testables.inFlight.clear();
    service.__testables.lastRunByUser.clear();
  });

  test('retorna payload consolidado single-source TRF1', async () => {
    pool.query.mockResolvedValue({ rows: [{ id: 10, cpf: '03241063437', nome: 'Teste', perfil_acesso: 'DIRETORIA' }] });
    buildConsultaProviders.mockReturnValue([{ isEnabled: () => true, consultarPorDocumento: jest.fn().mockResolvedValue({ source: 'trf1', sourceLabel: 'TRF1', status: 'success', items: [{ source: 'trf1', processNumber: '1061304-94.2023.4.01.3400' }], debugSummary: { submitSucceeded: true, declaredResultsCount: 1, normalizedItemsCount: 1 } }) }]);

    const result = await service.consultarPorUsuarioLogado({ userId: 10, requestId: 'r1' });
    expect(result.ok).toBe(true);
    expect(result.totalItems).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].source).toBe('trf1');
  });

  test('fluxo oficial: quando grid declara 2 e há 2 blocos, retorna totalItems=2', async () => {
    pool.query.mockResolvedValue({ rows: [{ id: 10, cpf: '03241063437', nome: 'Teste', perfil_acesso: 'DIRETORIA' }] });
    buildConsultaProviders.mockReturnValue([{ isEnabled: () => true, consultarPorDocumento: jest.fn().mockResolvedValue({
      source: 'trf1', sourceLabel: 'TRF1', status: 'success',
      items: [
        { source: 'trf1', sourceLabel: 'TRF1', processNumber: '1061304-94.2023.4.01.3400' },
        { source: 'trf1', sourceLabel: 'TRF1', processNumber: '1055982-59.2024.4.01.3400' },
      ],
      debugSummary: { submitSucceeded: true, declaredResultsCount: 2, normalizedItemsCount: 2 },
    }) }]);

    const result = await service.consultarPorUsuarioLogado({ userId: 10, requestId: 'r2' });
    expect(result.ok).toBe(true);
    expect(result.totalItems).toBe(2);
    expect(result.sources[0].debugSummary.declaredResultsCount).toBe(2);
  });
});
