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
        consultarPorCpf: jest.fn().mockResolvedValue({
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
    expect(result.totalItems).toBe(1);
    expect(result.cpfMasked).toContain('***');
  });
});
