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

  test('mode federation usa CNPJ primário e fallback por nome quando CNPJ retorna vazio', async () => {
    pool.query.mockResolvedValue({ rows: [{ id: 10, cpf: '03241063437', nome: 'Teste', perfil_acesso: 'DIRETORIA' }] });
    const consultarPorDocumento = jest.fn()
      .mockResolvedValueOnce({ source: 'trf1', sourceLabel: 'TRF1', status: 'success', count: 0, items: [] })
      .mockResolvedValueOnce({ source: 'trf1', sourceLabel: 'TRF1', status: 'success', count: 1, items: [{ source: 'trf1', processNumber: '1061304-94.2023.4.01.3400' }] });
    buildConsultaProviders.mockReturnValue([{ isEnabled: () => true, consultarPorDocumento }]);

    const result = await service.consultarPorUsuarioLogado({ userId: 10, requestId: 'r3', mode: 'federation' });

    expect(consultarPorDocumento).toHaveBeenNthCalledWith(1, expect.objectContaining({
      searchKind: 'document',
      document: '03658044000100',
    }));
    expect(consultarPorDocumento).toHaveBeenNthCalledWith(2, expect.objectContaining({
      searchKind: 'name',
      partyName: 'FEDERACAO NACIONAL DOS POLICIAIS RODOVIARIOS FEDERAIS',
      extraPartyNames: [],
    }));
    expect(result.document).toBe('03.658.044/0001-00');
    expect(result.totalItems).toBe(1);
  });


  test('mode institutional faz fallback por nome do sindicato quando CNPJ retorna vazio', async () => {
    pool.query.mockResolvedValue({ rows: [{ id: 10, cpf: '03241063437', nome: 'Teste', perfil_acesso: 'DIRETORIA' }] });
    const consultarPorDocumento = jest.fn()
      .mockResolvedValueOnce({ source: 'trf1', sourceLabel: 'TRF1', status: 'success', count: 0, items: [] })
      .mockResolvedValueOnce({ source: 'trf1', sourceLabel: 'TRF1', status: 'success', count: 2, items: [{ source: 'trf1', processNumber: '1000000-00.2024.4.01.3400' }, { source: 'trf1', processNumber: '1000001-00.2024.4.01.3400' }] });
    buildConsultaProviders.mockReturnValue([{ isEnabled: () => true, consultarPorDocumento }]);

    const result = await service.consultarPorUsuarioLogado({ userId: 10, requestId: 'r4', mode: 'institutional' });

    expect(consultarPorDocumento).toHaveBeenNthCalledWith(1, expect.objectContaining({
      searchKind: 'document',
      document: '39387378000125',
    }));
    expect(consultarPorDocumento).toHaveBeenNthCalledWith(2, expect.objectContaining({
      searchKind: 'name',
      partyName: 'SIND.DOS POL.ROD.FEDERAIS NO EST.DO ESP.SANTO',
      extraPartyNames: [],
    }));
    expect(result.totalItems).toBe(2);
    expect(result.document).toBe('39.387.378/0001-25');
  });
});
