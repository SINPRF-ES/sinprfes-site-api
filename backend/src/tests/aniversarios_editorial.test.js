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

describe('Aniversarios Editorial Functional Tests (Mocked)', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    pool.connect.mockResolvedValue({
      query: jest.fn().mockResolvedValue({ rows: [] }),
      release: jest.fn(),
    });
    // Default mock for existence check
    pool.query.mockResolvedValue({ rows: [{ status_editorial: 'ATUAL', is_editable: true }] });
  });

  test('Caso 1: Criar aniversário atual', async () => {
    const txClient = {
      query: jest.fn(),
      release: jest.fn(),
    };
    pool.connect.mockResolvedValue(txClient);

    txClient.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // SELECT FOR UPDATE (atuais)
      .mockResolvedValueOnce({ rows: [{ id: VALID_UUID, titulo: 'TEST_A1', status_editorial: 'ATUAL', is_editable: true }] }) // Insert
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const res = await request(app)
      .post('/api/aniversarios')
      .send({ titulo: 'TEST_A1', conteudo: 'C' });

    expect(res.status).toBe(201);
    expect(res.body.status_editorial).toBe('ATUAL');
  });

  test('Caso 2: Publicar novo aniversário arquiva o atual automaticamente', async () => {
    const txClient = {
      query: jest.fn(),
      release: jest.fn(),
    };
    pool.connect.mockResolvedValue(txClient);

    txClient.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: VALID_UUID, status_editorial: 'RASCUNHO', is_editable: true }] }) // SELECT FOR UPDATE target
      .mockResolvedValueOnce({ rows: [] }) // UPDATE archive others
      .mockResolvedValueOnce({ rows: [{ public_ref: 'some-existing-ref' }] }) // SELECT public_ref for sequence (gerarPublicRefAniversario)
      .mockResolvedValueOnce({ rows: [{ id: VALID_UUID, titulo: 'TEST_A2', status_editorial: 'ATUAL', is_editable: true, public_ref: '20260314-aniversario-02' }] }) // UPDATE final
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const res = await request(app).post(`/api/aniversarios/${VALID_UUID}/publicar`);

    expect(res.status).toBe(200);
    expect(res.body.status_editorial).toBe('ATUAL');
    expect(res.body.public_ref).toBe('20260314-aniversario-02');
  });

  test('Caso 3: Arquivar aniversário', async () => {
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

    const res = await request(app).post(`/api/aniversarios/${VALID_UUID}/arquivar`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('Caso 4: Bloquear edição de aniversário arquivado', async () => {
    pool.query.mockResolvedValue({ rows: [{ id: VALID_UUID, status_editorial: 'ARQUIVADA', is_editable: false }] });

    const res = await request(app)
      .put(`/api/aniversarios/${VALID_UUID}`)
      .send({ titulo: 'Attempt' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ARCHIVED_NEWS_IMMUTABLE');
  });

  test('Paginação na listagem', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ total: 10 }] }) // Count
      .mockResolvedValueOnce({ rows: [{ id: VALID_UUID }, { id: VALID_UUID }, { id: VALID_UUID }] }) // Items
      .mockResolvedValueOnce({ rows: [] }); // Midias

    const res = await request(app).get('/api/aniversarios?pagina=1&status_editorial=ARQUIVADA');

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(3);
    expect(res.body.pagination).toBeDefined();
    expect(res.body.pagination.totalPages).toBe(4); // ceil(10/3)
  });
});
