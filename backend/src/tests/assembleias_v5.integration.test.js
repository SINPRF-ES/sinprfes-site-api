// src/tests/assembleias_v5.integration.test.js
const request = require('supertest');
const pool = require('../config/db');

// Mock pool.query
jest.mock('../config/db', () => ({
  query: jest.fn(),
  connect: jest.fn().mockResolvedValue({
    query: jest.fn(),
    release: jest.fn(),
  }),
}));

// Mock auth middleware
jest.mock('../middlewares/auth', () => (req, res, next) => {
  req.user = { id: 1, perfil_acesso: 'DIRETORIA' };
  next();
});

// Mock requirePermission
jest.mock('../middlewares/requirePermission', () => (perm) => (req, res, next) => next());

// Mock services that might cause issues (resend, cloudinary)
jest.mock('resend', () => ({ Resend: jest.fn().mockImplementation(() => ({})) }));
jest.mock('cloudinary', () => ({ v2: { config: jest.fn(), uploader: { upload_stream: jest.fn() } } }));

const app = require('../app');

describe('Assembleias V5 Integration Tests', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    // Default mock for pool.connect
    pool.connect.mockResolvedValue({
        query: jest.fn().mockResolvedValue({ rows: [] }),
        release: jest.fn()
    });
    // Default mock for pool.query
    pool.query.mockResolvedValue({ rows: [] });
  });

  describe('GET /api/assembleias', () => {
    test('should return 200 for DIRETORIA even if some assemblies exist', async () => {
      pool.query.mockResolvedValue({ rows: [{ id: 'ass-1', titulo: 'Test', tipo: 'AGO' }] });

      const response = await request(app).get('/api/assembleias');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body[0].titulo).toBe('Test');
    });

    test('should return 500 with meaningful error on schema failure', async () => {
      pool.query.mockRejectedValue(new Error('column "pauta" does not exist'));

      const response = await request(app).get('/api/assembleias');

      expect(response.status).toBe(500);
      expect(response.body.error).toContain('Erro de esquema');
    });
  });

  describe('POST /api/assembleias', () => {
    test('should succeed with full assembly type name', async () => {
      pool.query.mockResolvedValue({ rows: [{ id: 'ass-new', titulo: 'New Ass', tipo: 'AGO' }] });

      const response = await request(app)
        .post('/api/assembleias')
        .send({
          titulo: 'Assembleia 2026',
          tipo: 'Assembleia Geral Ordinária',
          data_evento: '2026-12-31',
          hora_primeira_chamada: '10:00',
          hora_segunda_chamada: '10:30',
          edital_drive_file_id: 'drive-123'
        });

      expect(response.status).toBe(201);
      // Verify that service.criar was called with normalized 'AGO'
      // We check if pool.query was called with 'AGO'
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO assembleias'),
        expect.arrayContaining(['AGO'])
      );
    });

    test('should return 422 for invalid payload (missing fields)', async () => {
      const response = await request(app)
        .post('/api/assembleias')
        .send({ titulo: 'Missing Tipo' });

      expect(response.status).toBe(422);
      expect(response.body.error.toLowerCase()).toContain('obrigatórios');
    });

    test('should return 422 for invalid tipo', async () => {
      const response = await request(app)
        .post('/api/assembleias')
        .send({ titulo: 'Test', tipo: 'INVALID' });

      expect(response.status).toBe(422);
    });

    test('should return 422 on database constraint violation', async () => {
      pool.query.mockRejectedValue(new Error('violates check constraint "chk_tipo"'));

      const response = await request(app)
        .post('/api/assembleias')
        .send({
            titulo: 'Test',
            tipo: 'AGO',
            data_evento: '2026-03-01',
            hora_primeira_chamada: '10:00',
            hora_segunda_chamada: '10:30',
            edital_drive_file_id: 'drive-123'
        });

      expect(response.status).toBe(422);
    });
  });

  describe('POST /api/assembleias/:id/token', () => {
    let mClient;

    beforeEach(async () => {
      mClient = {
        query: jest.fn(),
        release: jest.fn(),
      };
      pool.connect.mockResolvedValue(mClient);
    });

    test('should succeed and be idempotent', async () => {
      mClient.query.mockImplementation((q) => {
        if (q.includes('BEGIN')) return Promise.resolve({ rows: [] });
        if (q.includes('SELECT estado FROM assembleias')) return Promise.resolve({ rows: [{ estado: 'ABERTA' }] });
        if (q.includes('assembleia_quoruns') && q.includes('SELECT') && q.includes('encerrado_em IS NULL')) {
            return Promise.resolve({ rows: [] });
        }
        if (q.includes('COUNT(*)') && q.includes('filiados')) return Promise.resolve({ rows: [{ total: 10 }] });
        if (q.includes('SELECT perfil_acesso, situacao_sindical FROM filiados')) return Promise.resolve({ rows: [{ perfil_acesso: 'DIRETORIA', situacao_sindical: 'FILIADO_SINPRF_ES' }] });
        if (q.includes('INSERT INTO assembleia_quoruns')) return Promise.resolve({ rows: [{ id: 'q1', token: '111222' }] });
        return Promise.resolve({ rows: [] });
      });

      // Mock for buscarEstadoCompleto queries on pool.query
      pool.query.mockResolvedValue({ rows: [] });

      const res1 = await request(app)
        .post('/api/assembleias/bf923c6a-4959-4674-9844-0c201630983d/token')
        .send({ tipo_chamada: 'PRIMEIRA' });

      expect(res1.status).toBe(200);
      expect(res1.body.token).toBe('111222');
      expect(res1.body.isNew).toBe(true);
      expect(res1.body.presente).toBe(true);
      expect(res1.body.tokenAtivo).toBe(true);

      // Call again for idempotency
      mClient.query.mockReset();
      mClient.query.mockImplementation((q) => {
        if (q.includes('BEGIN')) return Promise.resolve({ rows: [] });
        if (q.includes('SELECT estado FROM assembleias')) return Promise.resolve({ rows: [{ estado: 'ABERTA' }] });
        if (q.includes('assembleia_quoruns') && q.includes('SELECT') && q.includes('encerrado_em IS NULL')) {
            return Promise.resolve({ rows: [{ id: 'q1', token: '111222' }] });
        }
        if (q.includes('SELECT perfil_acesso, situacao_sindical FROM filiados')) return Promise.resolve({ rows: [{ perfil_acesso: 'DIRETORIA', situacao_sindical: 'FILIADO_SINPRF_ES' }] });
        return Promise.resolve({ rows: [] });
      });

      const res2 = await request(app)
        .post('/api/assembleias/bf923c6a-4959-4674-9844-0c201630983d/token')
        .send({ tipo_chamada: 'PRIMEIRA' });

      expect(res2.status).toBe(200);
      expect(res2.body.token).toBe('111222');
      expect(res2.body.isNew).toBe(false);
    });

    test('should return 404 for non-existent assembly', async () => {
      mClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }); // SELECT estado (not found)

      const response = await request(app)
        .post('/api/assembleias/bf923c6a-4959-4674-9844-0c201630983d/token')
        .send({ tipo_chamada: 'PRIMEIRA' });

      expect(response.status).toBe(404);
    });

    test('should return 409 for invalid assembly state', async () => {
      mClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ estado: 'CRIADA' }] }); // SELECT estado

      const response = await request(app)
        .post('/api/assembleias/bf923c6a-4959-4674-9844-0c201630983d/token')
        .send({ tipo_chamada: 'PRIMEIRA' });

      expect(response.status).toBe(409);
    });

    test('should return 422 for invalid tipo_chamada', async () => {
      const response = await request(app)
        .post('/api/assembleias/bf923c6a-4959-4674-9844-0c201630983d/token')
        .send({ tipo_chamada: 'INVALID' });

      expect(response.status).toBe(422);
    });
  });
});
