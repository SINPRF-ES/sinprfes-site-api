const pool = require('../config/db');

jest.mock('../config/db', () => ({
  query: jest.fn(),
}));

describe('repasse.service responsáveis search', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('listarResponsaveisComBusca sem termo ordena por nome', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 1, nome: 'Ana' }] });
    const repasseService = require('./repasse.service');

    const rows = await repasseService.listarResponsaveisComBusca('');

    expect(rows).toEqual([{ id: 1, nome: 'Ana' }]);
    expect(pool.query.mock.calls[0][0]).toContain('ORDER BY nome ASC');
    expect(pool.query.mock.calls[0][0]).not.toContain('LIMIT 50');
    expect(pool.query.mock.calls[0][0]).toContain('arquivado_em IS NULL');
  });

  test('listarResponsaveisComBusca com termo aplica filtro e ranking', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 2, nome: 'Walcy' }] });
    const repasseService = require('./repasse.service');

    const rows = await repasseService.listarResponsaveisComBusca('walcy');

    expect(rows).toEqual([{ id: 2, nome: 'Walcy' }]);
    const [sql, params] = pool.query.mock.calls[0];
    expect(params).toEqual(['walcy']);
    expect(sql).toContain("unaccent(lower(nome)) LIKE '%' || unaccent(lower($1)) || '%'");
    expect(sql).not.toContain("OR cpf LIKE $2");
    expect(sql).toContain("unaccent(lower(nome)) LIKE unaccent(lower($1)) || '%'");
    expect(sql).toContain('LENGTH(unaccent(lower(nome))) ASC');
    expect(sql).not.toContain('LIMIT 50');
  });

  test('listarResponsaveisComBusca com CPF apenas dígitos', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 3, nome: 'John', cpf: '12345678901' }] });
    const repasseService = require('./repasse.service');

    const rows = await repasseService.listarResponsaveisComBusca('123');

    expect(rows).toEqual([{ id: 3, nome: 'John', cpf: '12345678901' }]);
    const [sql, params] = pool.query.mock.calls[0];
    expect(params).toEqual(['123', '%123%']);
    expect(sql).toContain("OR cpf LIKE $2");
  });

  test('listarResponsaveisComBusca com termo misto', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 4, nome: 'Alice' }] });
    const repasseService = require('./repasse.service');

    const rows = await repasseService.listarResponsaveisComBusca('abc1');

    expect(rows).toEqual([{ id: 4, nome: 'Alice' }]);
    const [sql, params] = pool.query.mock.calls[0];
    expect(params).toEqual(['abc1', '%1%']);
    expect(sql).toContain("OR cpf LIKE $2");
  });
});
