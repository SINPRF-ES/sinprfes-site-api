const request = require('supertest');
const pool = require('../config/db');
const emailService = require('../services/email.service');
const pdfService = require('../services/pdf.service');
const usersService = require('../services/users.service');

// Mock pool
jest.mock('../config/db', () => ({
  query: jest.fn(),
  connect: jest.fn().mockResolvedValue({
    query: jest.fn(),
    release: jest.fn(),
  }),
}));

// Mock services
jest.mock('../services/email.service');
jest.mock('../services/pdf.service');
jest.mock('../services/users.service');

// Mock auth
let mockUser = { id: 'user-1', perfil_acesso: 'DIRETORIA' };
jest.mock('../middlewares/auth', () => (req, res, next) => {
  req.user = mockUser;
  req.requestId = 'req-123';
  next();
});

const app = require('../app');

describe('Assembleia Report API', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockUser = { id: 'user-1', perfil_acesso: 'DIRETORIA' };

    // Default mocks
    pdfService.gerarPdfRelatorioAssembleia.mockResolvedValue(Buffer.from('pdf-content'));
    usersService.buscarPorId.mockResolvedValue({ id: 'user-1', nome: 'Test User', email1: 'test@test.com' });
  });

  test('should allow DIRETORIA to generate report during EM_CURSO', async () => {
    pool.query.mockResolvedValue({ rows: [{ id: 'ass-1', estado: 'EM_CURSO', titulo: 'Ass 1' }] });

    const response = await request(app).post('/api/assembleias/ass-1/relatorio');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(emailService.enviarEmailRelatorioAssembleia).toHaveBeenCalled();
  });

  test('should allow USER to generate report during EM_CURSO', async () => {
    mockUser = { id: 'user-2', perfil_acesso: 'USER' };
    pool.query.mockResolvedValue({ rows: [{ id: 'ass-1', estado: 'EM_CURSO', titulo: 'Ass 1' }] });

    const response = await request(app).post('/api/assembleias/ass-1/relatorio');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  test('should allow USER to generate report when ENCERRADA', async () => {
    mockUser = { id: 'user-2', perfil_acesso: 'USER' };
    pool.query.mockResolvedValue({ rows: [{ id: 'ass-1', estado: 'ENCERRADA', titulo: 'Ass 1' }] });

    const response = await request(app).post('/api/assembleias/ass-1/relatorio');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  test('should block COMUNICADOR from generating report even when ENCERRADA', async () => {
    mockUser = { id: 'user-3', perfil_acesso: 'COMUNICADOR' };
    pool.query.mockResolvedValue({ rows: [{ id: 'ass-1', estado: 'ENCERRADA', titulo: 'Ass 1' }] });

    const response = await request(app).post('/api/assembleias/ass-1/relatorio');

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('FORBIDDEN');
  });

  test('should return 500 if primary delivery fails', async () => {
    pool.query.mockResolvedValue({ rows: [{ id: 'ass-1', estado: 'ENCERRADA', titulo: 'Ass 1' }] });
    emailService.enviarEmailRelatorioAssembleia.mockRejectedValue(new Error('SMTP Error'));

    const response = await request(app).post('/api/assembleias/ass-1/relatorio');

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
  });
});
