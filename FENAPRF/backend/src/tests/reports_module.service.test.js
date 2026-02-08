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

  test('buscarDadosAgregados UF should use exact match', async () => {
    pool.query.mockResolvedValue({ rows: [{ total: 5 }] });

    const res = await reportsService.buscarDadosAgregados('UF', 'ES');

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("uf = $1"),
      expect.arrayContaining(["ES"])
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
