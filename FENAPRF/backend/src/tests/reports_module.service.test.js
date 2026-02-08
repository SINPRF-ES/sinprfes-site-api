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

  test('buscarDadosAgregados should return counts for all active users', async () => {
    pool.query.mockResolvedValue({ rows: [{ total: 10 }] });

    const res = await reportsService.buscarDadosAgregados('GLOBAL', null);

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE arquivado_em IS NULL"),
      expect.any(Array)
    );
    expect(res.total).toBe(10);
  });
});
