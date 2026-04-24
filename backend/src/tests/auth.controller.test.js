const authController = require('../controllers/auth.controller');
const authService = require('../services/auth.service');
const filiadosService = require('../services/filiados.service');
const bcrypt = require('bcryptjs');

jest.mock('../services/auth.service');
jest.mock('../services/filiados.service');
jest.mock('../utils/log');
jest.mock('bcryptjs');

describe('Auth Controller - Refresh Flow', () => {
  let req, res;

  beforeEach(() => {
    req = {
      body: {},
      headers: {},
      ip: '127.0.0.1',
      requestId: 'test-req-id'
    };
    res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis()
    };
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
  });

  test('login should return refreshToken', async () => {
    req.body = { cpf: '123', senha: 'password' };

    filiadosService.buscarPorCpf.mockResolvedValue({ id: 1, cpf: '123', senha_hash: 'hashed', situacao_sindical: 'FILIADO_SINPRF_ES' });
    bcrypt.compare.mockResolvedValue(true);
    authService.createRefreshToken.mockResolvedValue('token-123');

    await authController.login(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      refreshToken: 'token-123'
    }));
  });

  test('refresh should return new tokens', async () => {
    req.body = { refreshToken: 'old-token' };
    authService.verifyRefreshToken.mockResolvedValue({ id: 'uuid-old', filiado_id: 1 });
    filiadosService.buscarPorId.mockResolvedValue({ id: 1, nome: 'Test', situacao_sindical: 'FILIADO_SINPRF_ES' });
    authService.rotateRefreshToken.mockResolvedValue('new-token');

    await authController.refresh(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      token: expect.any(String),
      refreshToken: 'new-token'
    }));
  });

  test('refresh should return 401 for invalid token', async () => {
    req.body = { refreshToken: 'invalid' };
    authService.verifyRefreshToken.mockResolvedValue(null);

    await authController.refresh(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('login should return 403 for non-SINPRF_ES situacao_sindical', async () => {
    req.body = { cpf: '123', senha: 'password' };
    filiadosService.buscarPorCpf.mockResolvedValue({
      id: 1,
      cpf: '123',
      senha_hash: 'hashed',
      situacao_sindical: 'NAO_FILIADO'
    });

    await authController.login(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: 'Acesso permitido apenas para filiados ao SINPRF/ES.'
    }));
  });
});
