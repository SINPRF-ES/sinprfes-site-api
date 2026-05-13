const repasseService = require('./repasse.service');
const pool = require('../config/db');

jest.mock('../config/db', () => ({
  query: jest.fn(),
}));

describe('repasse.service optimizations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getRepasseAno', () => {
    test('should fetch all counts in a single batch query', async () => {
      // Mock for repasse_mes
      pool.query.mockResolvedValueOnce({ rows: [] });
      // Mock for repasse_lotacao
      pool.query.mockResolvedValueOnce({ rows: [] });
      // Mock for getFiliadosAtivosCountsBatch
      pool.query.mockResolvedValueOnce({ rows: [{
        "SEDE": 10,
        "DEL 01 - Viana": 5,
        "DEL 02 - Serra": 8,
        "DEL 03 - Guarapari": 3,
        "DEL 04 - Linhares": 4
      }] });

      const result = await repasseService.getRepasseAno(2026);

      expect(pool.query).toHaveBeenCalledTimes(3);

      const batchQueryCall = pool.query.mock.calls[2];
      expect(batchQueryCall[0]).toContain('COUNT(*) FILTER');
      expect(batchQueryCall[0]).toContain('as "SEDE"');
      expect(batchQueryCall[1]).toHaveLength(5); // 5 lotacoes
    });
  });

  describe('getRepasseResumo', () => {
    test('should use SQL aggregation for counts', async () => {
      // Mock for repasse_config
      pool.query.mockResolvedValueOnce({ rows: [{ per_capita_global_anual: 1000, per_capita_apoio_operacional_anual: 100 }] });
      // Mock for stats (GROUP BY)
      pool.query.mockResolvedValueOnce({ rows: [
        { situacao_norm: 'ATIVO', lotacao: 'SEDE', count: 10 },
        { situacao_norm: 'ATIVO', lotacao: 'DEL 01 - Viana', count: 5 },
        { situacao_norm: 'VETERANO', lotacao: 'SEDE', count: 20 }
      ] });
      // Mock for repasse_movimentos
      pool.query.mockResolvedValueOnce({ rows: [] });
      // Mock for repasse_eventos
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await repasseService.getRepasseResumo(2026);

      expect(pool.query).toHaveBeenCalledTimes(4);

      const statsQueryCall = pool.query.mock.calls[1];
      expect(statsQueryCall[0]).toContain('GROUP BY UPPER(situacao), lotacao');

      // Verify calculations
      const sedeResumo = result.apoioPorLotacao.find(l => l.lotacao === 'SEDE');
      expect(sedeResumo.qtdAtivos).toBe(10);
      expect(sedeResumo.creditoApoioOperacional).toBe(1000); // 10 * 100

      const vianaResumo = result.apoioPorLotacao.find(l => l.lotacao === 'DEL 01 - Viana');
      expect(vianaResumo.qtdAtivos).toBe(5);
    });
  });
});
