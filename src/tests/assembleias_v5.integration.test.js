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
    jest.clearAllMocks();
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
          data_evento: '2026-03-01',
          hora_primeira_chamada: '10:00',
          hora_segunda_chamada: '10:30'
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
        .send({ titulo: 'Test', tipo: 'AGO' });

      expect(response.status).toBe(422);
    });
  });
});
