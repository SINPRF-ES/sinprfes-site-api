const pool = require('../config/db');

jest.mock('../config/db', () => ({
  query: jest.fn(),
}));

describe('repasse.service responsáveis search', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('listarResponsaveisComBusca sem termo ordena por nome com limite', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 1, nome: 'Ana' }] });
    const repasseService = require('./repasse.service');

    const rows = await repasseService.listarResponsaveisComBusca('');

    expect(rows).toEqual([{ id: 1, nome: 'Ana' }]);
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('ORDER BY nome ASC'));
    expect(pool.query.mock.calls[0][0]).toContain('LIMIT 50');
    expect(pool.query.mock.calls[0][0]).toContain('arquivado_em IS NULL');
  });

  test('listarResponsaveisComBusca com termo aplica filtro e ranking antes do limit', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 2, nome: 'Walcy' }] });
    const repasseService = require('./repasse.service');

    const rows = await repasseService.listarResponsaveisComBusca('walcy');

    expect(rows).toEqual([{ id: 2, nome: 'Walcy' }]);
    const [sql, params] = pool.query.mock.calls[0];
    expect(params).toEqual(['walcy']);
    expect(sql).toContain("unaccent(lower(nome)) LIKE '%' || unaccent(lower($1)) || '%'");
    expect(sql).toContain("unaccent(lower(nome)) LIKE unaccent(lower($1)) || '%'");
    expect(sql).toContain('LENGTH(unaccent(lower(nome))) ASC');
    expect(sql).toContain('LIMIT 50');
  });
});
