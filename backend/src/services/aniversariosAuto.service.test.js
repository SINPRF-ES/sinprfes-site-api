const { criarAniversarioAutomatico } = require('./aniversariosAuto.service');

jest.mock('../utils/log', () => ({
  warn: jest.fn(),
}));

jest.mock('../templates/aniversarios/cardTemplate', () => ({
  buildBirthdayCard: jest.fn(() => ({
    titulo: '🎉 Aniversariantes do dia',
    subtitulo: 'Sub',
    conteudo: 'Conteúdo',
  })),
}));

describe('aniversariosAuto.service', () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      INTERNAL_API_TOKEN: 'token-interno',
      INTERNAL_API_BASE_URL: 'http://127.0.0.1:3000',
    };
    global.fetch = jest.fn();
  });

  afterAll(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  it('não cria aniversário quando já existe aniversário ATUAL para hoje', async () => {
    const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [{ data_informe: `${hoje}T12:00:00.000Z` }] }),
    });

    const resultado = await criarAniversarioAutomatico({
      aniversariantes: [{ nome: 'Pessoa 1', tipo: 'FILIADO' }],
    });

    expect(resultado).toEqual({ created: false, reason: 'already_exists_today' });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('cria e publica com data_informe canônica no timezone de São Paulo', async () => {
    const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'aniv-1' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

    const resultado = await criarAniversarioAutomatico({
      aniversariantes: [{ nome: 'Pessoa 1', tipo: 'FILIADO' }],
    });

    expect(resultado).toEqual({ created: true, published: true, id: 'aniv-1' });

    const payloadCriacao = JSON.parse(global.fetch.mock.calls[1][1].body);
    expect(payloadCriacao.data_informe).toBe(`${hoje}T12:00:00.000Z`);
    expect(global.fetch.mock.calls[2][0]).toContain('/api/aniversarios/aniv-1/publicar');
  });
});
