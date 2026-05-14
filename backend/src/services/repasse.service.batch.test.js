const repasseService = require('./repasse.service');
const pool = require('../config/db');

jest.mock('../config/db', () => ({
  query: jest.fn(),
}));

describe('repasse.service.getUltimosDadosParaRelatorioBatch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should return combined data for all lotations using batch queries', async () => {
    const lotations = ['SEDE', 'DEL 01 - Viana'];

    // Mock for getFiliadosAtivosCountsBatch
    pool.query.mockResolvedValueOnce({
      rows: [{
        'SEDE': 10,
        'DEL 01 - Viana': 5
      }]
    });

    // Mock for PRF totals (DISTINCT ON)
    pool.query.mockResolvedValueOnce({
      rows: [
        { lotacao_key: 'SEDE', year: 2026, month: 1, prf_total: 20 },
        { lotacao_key: 'DEL 01 - Viana', year: 2025, month: 12, prf_total: 10 }
      ]
    });

    const result = await repasseService.getUltimosDadosParaRelatorioBatch(lotations);

    expect(result).toHaveLength(2);

    expect(result[0]).toEqual({
      lotacao: 'SEDE',
      filiadosAtivos: 10,
      prfTotal: 20,
      percentual: 50,
      competencia: { year: 2026, month: 1 }
    });

    expect(result[1]).toEqual({
      lotacao: 'DEL 01 - Viana',
      filiadosAtivos: 5,
      prfTotal: 10,
      percentual: 50,
      competencia: { year: 2025, month: 12 }
    });

    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  test('should handle missing PRF data for some lotations', async () => {
    const lotations = ['SEDE', 'UNKNOWN'];

    pool.query.mockResolvedValueOnce({
      rows: [{ 'SEDE': 10, 'UNKNOWN': 0 }]
    });

    pool.query.mockResolvedValueOnce({
      rows: [{ lotacao_key: 'SEDE', year: 2026, month: 1, prf_total: 20 }]
    });

    const result = await repasseService.getUltimosDadosParaRelatorioBatch(lotations);

    expect(result[1].lotacao).toBe('UNKNOWN');
    expect(result[1].prfTotal).toBeNull();
    expect(result[1].percentual).toBeNull();
  });
});
