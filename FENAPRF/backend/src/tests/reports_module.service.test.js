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
