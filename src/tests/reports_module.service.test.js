const pool = require('../config/db');
const reportsService = require('../services/reports.service');

// Mock pool
jest.mock('../config/db', () => ({
  query: jest.fn(),
}));

describe('Reports Service', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test('buscarDadosAgregados LOTACAO should use keyword search', async () => {
    pool.query.mockResolvedValue({ rows: [{ total: 5 }] });

    const res = await reportsService.buscarDadosAgregados('LOTACAO', 'DEL 01 - Viana');

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("UPPER(lotacao) LIKE $1"),
      expect.arrayContaining(["%VIANA%"])
    );
    expect(res.total).toBe(5);
  });

  test('buscarDadosAgregados SITUACAO should use exact match', async () => {
    pool.query.mockResolvedValue({ rows: [{ total: 10 }] });

    const res = await reportsService.buscarDadosAgregados('SITUACAO', 'VETERANO');

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("situacao = $1"),
      expect.arrayContaining(["VETERANO"])
    );
    expect(res.total).toBe(10);
  });
});
