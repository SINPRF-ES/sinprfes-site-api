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
    const txClient = {
      query: jest.fn(),
      release: jest.fn(),
    };
    pool.connect.mockResolvedValue(txClient);

    txClient.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // SELECT FOR UPDATE (atuais)
      .mockResolvedValueOnce({ rows: [{ id: VALID_UUID, titulo: 'TEST_N1', status_editorial: 'ATUAL', is_editable: true, audiencia: 'PUBLICA' }] }) // Insert
      .mockResolvedValueOnce({ rows: [] }) // check slug uniqueness
      .mockResolvedValueOnce({ rows: [] }) // check public_ref uniqueness
      .mockResolvedValueOnce({ rows: [{ id: VALID_UUID, titulo: 'TEST_N1', status_editorial: 'ATUAL', is_editable: true, audiencia: 'PUBLICA', slug: 'test-n1', public_ref: '20260314-145900-test-n1' }] }) // index update
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const res = await request(app)
      .post('/api/noticias')
      .send({ titulo: 'TEST_N1', conteudo: 'C', audiencia: 'PUBLICA' });

    expect(res.status).toBe(201);
    expect(res.body.status_editorial).toBe('ATUAL');
  });

  test('Caso 7: Publicar nova notícia arquiva a atual automaticamente', async () => {
    const txClient = {
      query: jest.fn(),
      release: jest.fn(),
    };
    pool.connect.mockResolvedValue(txClient);

    txClient.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 'OLD_ID' }] }) // SELECT FOR UPDATE (atuais)
      .mockResolvedValueOnce({ rows: [] }) // archive previous current
      .mockResolvedValueOnce({ rows: [{ id: VALID_UUID, titulo: 'TEST_N2', status_editorial: 'ATUAL', is_editable: true, audiencia: 'PUBLICA' }] }) // Insert new current
      .mockResolvedValueOnce({ rows: [] }) // check slug uniqueness
      .mockResolvedValueOnce({ rows: [] }) // check public_ref uniqueness
      .mockResolvedValueOnce({ rows: [{ id: VALID_UUID, titulo: 'TEST_N2', status_editorial: 'ATUAL', is_editable: true, audiencia: 'PUBLICA', slug: 'test-n2', public_ref: '20260314-150000-test-n2' }] }) // index update
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const res = await request(app)
      .post('/api/noticias')
      .send({ titulo: 'TEST_N2', conteudo: 'C', audiencia: 'PUBLICA' });

    expect(res.status).toBe(201);
    expect(res.body.status_editorial).toBe('ATUAL');
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

  test('Detalhe público por public_ref retorna notícia publicada', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: VALID_UUID, public_ref: '20260312-143000-teste-noticia', audiencia: 'PUBLICA', status: 'PUBLICADA' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'm1', noticia_id: VALID_UUID, tipo: 'IMAGEM', url: 'https://cdn/image.jpg' }] });

    const res = await request(app).get('/api/noticias/public/20260312-143000-teste-noticia');

    expect(res.status).toBe(200);
    expect(res.body.public_ref).toBe('20260312-143000-teste-noticia');
    expect(Array.isArray(res.body.midias)).toBe(true);
  });

  test('Detalhe público por public_ref retorna 404 quando não existe/publicada', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/noticias/public/20260312-143000-inexistente');

    expect(res.status).toBe(404);
  });
});
