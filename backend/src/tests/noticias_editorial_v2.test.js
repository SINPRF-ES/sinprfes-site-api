const request = require('supertest');
const pool = require('../config/db');

// Mock pool.query
jest.mock('../config/db', () => ({
  query: jest.fn(),
  connect: jest.fn(),
}));

// Mock auth middleware
jest.mock('../middlewares/auth', () => (req, res, next) => {
  req.user = { id: 1, perfil_acesso: 'ADMIN' };
  next();
});

// Mock requirePermission
jest.mock('../middlewares/requirePermission', () => (perm) => (req, res, next) => next());

const app = require('../app');

const VALID_UUID = 'bf923c6a-4959-4674-9844-0c201630983d';

describe('Notícias Editorial Functional Tests (Mocked)', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    pool.connect.mockResolvedValue({
      query: jest.fn().mockResolvedValue({ rows: [] }),
      release: jest.fn(),
    });
    pool.query.mockResolvedValue({ rows: [] });
  });

  test('Caso 1: Criar notícia atual', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] }) // Check existing current news
      .mockResolvedValueOnce({ rows: [{ id: VALID_UUID, titulo: 'TEST_N1', status_editorial: 'ATUAL', is_editable: true }] }); // Insert news

    const res = await request(app)
      .post('/api/noticias')
      .send({ titulo: 'TEST_N1', conteudo: 'C', audiencia: 'PUBLICA' });

    expect(res.status).toBe(201);
    expect(res.body.status_editorial).toBe('ATUAL');
  });

  test('Caso 7: Bloquear segunda notícia atual para a mesma audiência', async () => {
    pool.query.mockResolvedValue({ rows: [{ id: VALID_UUID }] }); // Found existing current news

    const res = await request(app)
      .post('/api/noticias')
      .send({ titulo: 'TEST_N2', conteudo: 'C', audiencia: 'PUBLICA' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CURRENT_NEWS_ALREADY_EXISTS');
  });

  test('Caso 8: Arquivar notícia', async () => {
    const mClient = {
      query: jest.fn(),
      release: jest.fn(),
    };
    pool.connect.mockResolvedValue(mClient);

    mClient.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: VALID_UUID, status_editorial: 'ATUAL' }] }) // SELECT FOR UPDATE
      .mockResolvedValueOnce({ rows: [] }) // UPDATE
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const res = await request(app).post(`/api/noticias/${VALID_UUID}/arquivar`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('Caso 6: Bloquear edição de notícia arquivada', async () => {
    pool.query.mockResolvedValue({ rows: [{ id: VALID_UUID, status_editorial: 'ARQUIVADA', is_editable: false, audiencia: 'PUBLICA' }] });

    const res = await request(app)
      .put(`/api/noticias/${VALID_UUID}`)
      .send({ titulo: 'Attempt' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ARCHIVED_NEWS_IMMUTABLE');
  });

  test('Bloquear mídias em notícia arquivada', async () => {
    pool.query.mockResolvedValue({ rows: [{ id: VALID_UUID, status_editorial: 'ARQUIVADA', is_editable: false }] });

    const res = await request(app)
      .post(`/api/noticias/${VALID_UUID}/midias_external`)
      .send({ tipo: 'IMAGEM', url: 'http://fake.url' });

    expect(res.status).toBe(409);
  });

  test('Paginação na listagem (Management requested pagination)', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ total: 10 }] }) // Count
      .mockResolvedValueOnce({ rows: [{ id: VALID_UUID }, { id: VALID_UUID }, { id: VALID_UUID }] }) // Items
      .mockResolvedValueOnce({ rows: [] }); // Midias

    const res = await request(app).get('/api/noticias?pagina=1&status_editorial=ARQUIVADA');

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(3);
    expect(res.body.pagination).toBeDefined();
    expect(res.body.pagination.totalPages).toBe(4); // ceil(10/3)
  });
});
