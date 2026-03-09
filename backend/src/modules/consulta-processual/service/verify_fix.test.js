const pool = require('../../../config/db');
const { buildConsultaProviders } = require('../providers');
const service = require('./consultaProcessual.service');
const log = require('../../../utils/log');

jest.mock('../../../config/db', () => ({
  query: jest.fn(),
}));

jest.mock('../providers', () => ({
  buildConsultaProviders: jest.fn(),
}));

// Mock log to avoid polluting test output
jest.mock('../../../utils/log', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

describe('verify_fix.js - Hotfix Verification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    service.__testables.cache.clear();
    service.__testables.inFlight.clear();
    service.__testables.lastRunByUser.clear();
  });

  test('TRF1 returns 2 processes even if TRF5 fails', async () => {
    // 1. Setup mocks
    pool.query.mockResolvedValue({
      rows: [{ id: 1, cpf: '03241063437', nome: 'Alessandro Araujo de Mello', perfil_acesso: 'ADMIN' }]
    });

    const mockTrf1 = {
      getId: () => 'trf1',
      getLabel: () => 'TRF1',
      getMaturityStatus: () => 'stable',
      isEnabled: () => true,
      consultarPorDocumento: jest.fn().mockResolvedValue({
        source: 'trf1',
        sourceLabel: 'TRF1',
        status: 'success',
        count: 2,
        items: [
          { source: 'trf1', processNumber: '1061304-94.2023.4.01.3400' },
          { source: 'trf1', processNumber: '1055982-59.2024.4.01.3400' },
        ],
        debugSummary: {
          submitSucceeded: true,
          waitConditionMatched: 'declared_results_positive',
          normalizedItemsCount: 2,
        },
      }),
    };

    const mockTrf5 = {
      getId: () => 'trf5',
      getLabel: () => 'TRF5',
      getMaturityStatus: () => 'experimental',
      isEnabled: () => true,
      consultarPorDocumento: jest.fn().mockRejectedValue(new Error('FRAME_INPUT_NOT_FOUND_AFTER_LOAD')),
    };

    buildConsultaProviders.mockReturnValue([mockTrf1, mockTrf5]);

    // 2. Execute
    const result = await service.consultarPorUsuarioLogado({
        userId: 1,
        requestId: 'verify-fix-' + Date.now(),
        debug: true
    });

    // 3. Verify
    expect(result.ok).toBe(true);
    expect(result.totalItems).toBe(2);
    expect(result.items).toHaveLength(2);

    const trf1Source = result.sources.find(s => s.source === 'trf1');
    const trf5Source = result.sources.find(s => s.source === 'trf5');

    expect(trf1Source.status).toBe('success');
    expect(trf1Source.count).toBe(2);

    expect(trf5Source.status).toBe('error');
    expect(trf5Source.error.code).toBe('PROVIDER_FATAL_ERROR');
    expect(trf5Source.error.message).toBe('FRAME_INPUT_NOT_FOUND_AFTER_LOAD');

    expect(result.errors).toContainEqual(expect.objectContaining({
      source: 'trf5',
      code: 'PROVIDER_FATAL_ERROR'
    }));
  });
});
