const request = require('supertest');
const pool = require('../config/db');

// Mock pool.query e pool.connect
jest.mock('../config/db', () => {
  const mClient = {
    query: jest.fn().mockImplementation((q) => {
        return Promise.resolve({ rows: [] });
    }),
    release: jest.fn(),
  };
  return {
    query: jest.fn().mockResolvedValue({ rows: [] }),
    connect: jest.fn().mockResolvedValue(mClient),
  };
});

// Mock auth middleware
jest.mock('../middlewares/auth', () => (req, res, next) => {
  req.user = { id: 1, perfil_acesso: 'DIRETORIA' };
  next();
});

// Mock requirePermission
jest.mock('../middlewares/requirePermission', () => (perm) => (req, res, next) => next());

// Mock Resend and Cloudinary before app
jest.mock('resend', () => ({ Resend: jest.fn().mockImplementation(() => ({})) }));
jest.mock('cloudinary', () => ({ v2: { config: jest.fn(), uploader: { upload_stream: jest.fn() } } }));

const app = require('../app');
const Textos = require('../utils/textos');

describe('Verification of Fixes for Token Generation', () => {
  let mClient;

  beforeEach(async () => {
    jest.clearAllMocks();
    mClient = await pool.connect();
    mClient.query.mockResolvedValue({ rows: [] });
    pool.query.mockResolvedValue({ rows: [] });
  });

  test('should return 404 when assembly is not found (Fixed behavior)', async () => {
    mClient.query.mockImplementation((q) => {
        if (q.includes('SELECT estado FROM assembleias')) return Promise.resolve({ rows: [] });
        return Promise.resolve({ rows: [] });
    });

    const response = await request(app)
      .post('/api/assembleias/bf923c6a-4959-4674-9844-0c201630983d/token')
      .send({ tipo_chamada: 'PRIMEIRA' });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe(Textos.ASSEMBLEIA.NAO_ENCONTRADA);
  });

  test('should return 409 when assembly is in invalid state (Fixed behavior)', async () => {
    mClient.query.mockImplementation((q) => {
        if (q.includes('SELECT estado FROM assembleias')) return Promise.resolve({ rows: [{ estado: 'CRIADA' }] });
        return Promise.resolve({ rows: [] });
    });

    const response = await request(app)
      .post('/api/assembleias/bf923c6a-4959-4674-9844-0c201630983d/token')
      .send({ tipo_chamada: 'PRIMEIRA' });

    expect(response.status).toBe(409);
    expect(response.body.error).toContain("estado atual");
  });

  test('should return 422 for invalid tipo_chamada', async () => {
    const response = await request(app)
      .post('/api/assembleias/bf923c6a-4959-4674-9844-0c201630983d/token')
      .send({ tipo_chamada: 'INVALID' });

    expect(response.status).toBe(422);
    expect(response.body.error).toContain("Tipo de chamada inválido");
  });

  test('should be idempotent: return existing token for same tipo_chamada', async () => {
    mClient.query.mockImplementation((q) => {
        if (q.includes('SELECT estado FROM assembleias')) return Promise.resolve({ rows: [{ estado: 'ABERTA' }] });
        if (q.includes('assembleia_quoruns') && q.includes('SELECT') && q.includes('encerrado_em IS NULL')) {
            return Promise.resolve({ rows: [{ id: 'q1', token: '123456' }] });
        }
        return Promise.resolve({ rows: [] });
    });

    const response = await request(app)
      .post('/api/assembleias/bf923c6a-4959-4674-9844-0c201630983d/token')
      .send({ tipo_chamada: 'PRIMEIRA' });

    expect(response.status).toBe(200);
    expect(response.body.token).toBe('123456');
    expect(response.body.isNew).toBe(false);
  });

  test('should generate new token if none exists for tipo_chamada', async () => {
    mClient.query.mockImplementation((q) => {
        if (q.includes('SELECT estado FROM assembleias')) return Promise.resolve({ rows: [{ estado: 'ABERTA' }] });
        if (q.includes('assembleia_quoruns') && q.includes('SELECT') && q.includes('encerrado_em IS NULL')) {
            return Promise.resolve({ rows: [] }); // None existing
        }
        if (q.includes('COUNT(*)') && q.includes('filiados')) {
            return Promise.resolve({ rows: [{ total: 10 }] });
        }
        if (q.includes('INSERT INTO assembleia_quoruns')) {
            return Promise.resolve({ rows: [{ id: 'qnew', token: '654321', quorum_total_ativos: 10, quorum_necessario: 6 }] });
        }
        if (q.includes('SELECT perfil_acesso FROM filiados')) {
            return Promise.resolve({ rows: [{ perfil_acesso: 'DIRETORIA' }] });
        }
        return Promise.resolve({ rows: [] });
    });

    const response = await request(app)
      .post('/api/assembleias/bf923c6a-4959-4674-9844-0c201630983d/token')
      .send({ tipo_chamada: 'SEGUNDA' });

    expect(response.status).toBe(200);
    expect(response.body.token).toBe('654321');
    expect(response.body.isNew).toBe(true);
  });
});
