const pool = require('../config/db');
const { criarAniversarioAutomatico } = require('./aniversariosAuto.service');

jest.mock('../config/db');
jest.mock('../utils/log', () => ({
  info: jest.fn(),
  error: jest.fn(),
}));

jest.mock('../templates/aniversarios/cardTemplate', () => ({
  buildBirthdayCard: jest.fn(() => ({
    titulo: '🎉 Aniversariantes do dia',
    subtitulo: 'Sub',
    conteudo: 'Conteúdo',
  })),
}));

describe('aniversariosAuto.service', () => {
  let client;

  beforeEach(() => {
    jest.clearAllMocks();
    client = {
      query: jest.fn(),
      release: jest.fn(),
    };
    pool.connect.mockResolvedValue(client);
  });

  it('cria item atual quando há aniversariantes e não existe atual no dia', async () => {
    client.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // current
      .mockResolvedValueOnce({ rows: [] }) // today current
      .mockResolvedValueOnce({ rows: [{ id: 'aniv-1' }] }) // insert
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const resultado = await criarAniversarioAutomatico({
      aniversariantes: [{ nome: 'Pessoa 1', tipo: 'FILIADO' }],
      referenceDateISO: '2026-04-11',
    });

    expect(resultado).toEqual({
      created: true,
      updated: false,
      id: 'aniv-1',
      birthdaysCount: 1,
    });
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO aniversarios'),
      expect.arrayContaining(['🎉 Aniversariantes do dia', 'Sub', 'Conteúdo', '2026-04-11T12:00:00.000Z'])
    );
  });

  it('mesmo dia: atualiza item atual sem duplicar', async () => {
    client.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 'aniv-1', data_informe: '2026-04-11T12:00:00.000Z' }] }) // current
      .mockResolvedValueOnce({ rows: [{ id: 'aniv-1' }] }) // today current
      .mockResolvedValueOnce({ rows: [] }) // update
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const resultado = await criarAniversarioAutomatico({
      aniversariantes: [{ nome: 'Pessoa 1', tipo: 'FILIADO' }],
      referenceDateISO: '2026-04-11',
    });

    expect(resultado).toEqual({
      created: false,
      updated: true,
      id: 'aniv-1',
      birthdaysCount: 1,
    });
    const sqlCalls = client.query.mock.calls.map(([sql]) => String(sql));
    expect(sqlCalls.some((sql) => sql.includes('INSERT INTO aniversarios'))).toBe(false);
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE aniversarios'),
      expect.arrayContaining([expect.anything(), expect.anything(), expect.anything(), expect.anything(), 'aniv-1'])
    );
    // Verificar se is_editable = true está no SQL do UPDATE
    const updateCall = client.query.mock.calls.find(([sql]) => String(sql).includes('UPDATE aniversarios') && String(sql).includes('is_editable = true'));
    expect(updateCall).toBeDefined();
  });

  it('novo dia com aniversariantes: arquiva atual antigo e cria novo atual', async () => {
    client.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 'aniv-old', data_informe: '2026-04-10T12:00:00.000Z' }] }) // current
      .mockResolvedValueOnce({ rowCount: 1 }) // archive old
      .mockResolvedValueOnce({ rows: [] }) // today current
      .mockResolvedValueOnce({ rows: [{ id: 'aniv-new' }] }) // insert
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const resultado = await criarAniversarioAutomatico({
      aniversariantes: [{ nome: 'Pessoa 1', tipo: 'FILIADO' }],
      referenceDateISO: '2026-04-11',
    });

    expect(resultado.id).toBe('aniv-new');
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining("SET status_editorial = 'ARQUIVADA'"),
      ['aniv-old']
    );
  });

  it('dia sem aniversariantes: arquiva atual existente e não cria novo', async () => {
    client.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 'aniv-old', data_informe: '2026-04-10T12:00:00.000Z' }] }) // current
      .mockResolvedValueOnce({ rowCount: 1 }) // archive old
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const resultado = await criarAniversarioAutomatico({
      aniversariantes: [],
      referenceDateISO: '2026-04-11',
    });

    expect(resultado).toEqual({
      created: false,
      updated: false,
      archivedPrevious: true,
      reason: 'no_birthdays_today',
    });
    const sqlCalls = client.query.mock.calls.map(([sql]) => String(sql));
    expect(sqlCalls.some((sql) => sql.includes('INSERT INTO aniversarios'))).toBe(false);
  });
});
