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

describe('Informes Editorial Functional Tests (Mocked)', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    pool.connect.mockResolvedValue({
      query: jest.fn().mockResolvedValue({ rows: [] }),
      release: jest.fn(),
    });
    // Default mock for existence check
    pool.query.mockResolvedValue({ rows: [{ status_editorial: 'ATUAL', is_editable: true }] });
  });

  test('Caso 1: Criar informe atual', async () => {
    const txClient = {
      query: jest.fn(),
      release: jest.fn(),
    };
    pool.connect.mockResolvedValue(txClient);

    txClient.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // SELECT FOR UPDATE (atuais)
      .mockResolvedValueOnce({ rows: [{ id: VALID_UUID, titulo: 'TEST_I1', status_editorial: 'ATUAL', is_editable: true }] }) // Insert
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const res = await request(app)
      .post('/api/informes')
      .send({ titulo: 'TEST_I1', conteudo: 'C' });

    expect(res.status).toBe(201);
    expect(res.body.status_editorial).toBe('ATUAL');
  });

  test('Caso 7: Publicar novo informe arquiva o atual automaticamente', async () => {
    const txClient = {
      query: jest.fn(),
      release: jest.fn(),
    };
    pool.connect.mockResolvedValue(txClient);

    txClient.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 'OLD_ID' }] }) // SELECT FOR UPDATE (atuais)
      .mockResolvedValueOnce({ rows: [] }) // archive previous current
      .mockResolvedValueOnce({ rows: [{ id: VALID_UUID, titulo: 'TEST_I2', status_editorial: 'ATUAL', is_editable: true }] }) // Update new current
      .mockResolvedValueOnce({ rows: [] }) // check public_ref uniqueness
      .mockResolvedValueOnce({ rows: [{ id: VALID_UUID, titulo: 'TEST_I2', status_editorial: 'ATUAL', is_editable: true, public_ref: '20260314-informe-01' }] }) // index update
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const res = await request(app).post(`/api/informes/${VALID_UUID}/publicar`);

    expect(res.status).toBe(200);
    expect(res.body.status_editorial).toBe('ATUAL');
  });

  test('Caso 8: Arquivar informe', async () => {
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

    const res = await request(app).post(`/api/informes/${VALID_UUID}/arquivar`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('Caso 6: Bloquear edição de informe arquivado', async () => {
    pool.query.mockResolvedValue({ rows: [{ id: VALID_UUID, status_editorial: 'ARQUIVADA', is_editable: false }] });

    const res = await request(app)
      .put(`/api/informes/${VALID_UUID}`)
      .send({ titulo: 'Attempt' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ARCHIVED_NEWS_IMMUTABLE');
  });

  test('Paginação na listagem (Management requested pagination)', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ total: 10 }] }) // Count
      .mockResolvedValueOnce({ rows: [{ id: VALID_UUID }, { id: VALID_UUID }, { id: VALID_UUID }] }) // Items
      .mockResolvedValueOnce({ rows: [] }); // Midias

    const res = await request(app).get('/api/informes?pagina=1&status_editorial=ARQUIVADA');

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(3);
    expect(res.body.pagination).toBeDefined();
    expect(res.body.pagination.totalPages).toBe(4); // ceil(10/3)
  });

  test('Listagem interna corrige informe sem public_ref para evitar descompasso', async () => {
    const informeSemRef = {
      id: VALID_UUID,
      titulo: 'Informe sem referência',
      status: 'PUBLICADA',
      created_at: '2026-03-12T14:30:00.000Z',
      status_editorial: 'ATUAL',
      public_ref: null
    };

    const txClient = {
      query: jest.fn(),
      release: jest.fn(),
    };

    pool.connect.mockResolvedValue(txClient);
    pool.query
      .mockResolvedValueOnce({ rows: [{ total: 1 }] })
      .mockResolvedValueOnce({ rows: [informeSemRef] })
      .mockResolvedValueOnce({ rows: [] });

    txClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ ...informeSemRef, public_ref: '20260312-informe-01' }] });

    const res = await request(app).get('/api/informes?pagina=1&status_editorial=ATUAL');

    expect(res.status).toBe(200);
    expect(res.body.items[0].public_ref).toBe('20260312-informe-01');
  });
});
