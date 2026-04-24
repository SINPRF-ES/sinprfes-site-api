// src/controllers/filiados.controller.test.js
const controller = require('./filiados.controller');
const service = require('../services/filiados.service');
const Textos = require('../utils/textos');

jest.mock('../services/filiados.service');
jest.mock('../utils/log');

describe('Filiados Controller', () => {
  let req, res;

  beforeEach(() => {
    req = {
      params: {},
      user: { id: 1, perfil_acesso: 'DIRETORIA' },
      body: {},
      requestId: 'test-filiados-req'
    };
    res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis()
    };
    jest.clearAllMocks();
  });

  describe('getMe', () => {
    test('should return own data with requestId', async () => {
      service.buscarPorId.mockResolvedValue({ id: 1, nome: 'Test User' });

      await controller.getMe(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        id: 1,
        nome: 'Test User',
        requestId: 'test-filiados-req'
      }));
    });
  });

  describe('getFiliadoById', () => {
    test('should return 400 for non-numeric ID', async () => {
      req.params.id = 'abc';
      await controller.getFiliadoById(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
          message: "ID inválido.",
          requestId: 'test-filiados-req'
      }));
    });

    test('should return 200 for valid ID and DIRETORIA profile', async () => {
      req.params.id = '2';
      service.buscarPorId.mockResolvedValue({ id: 2, nome: 'Other User' });

      await controller.getFiliadoById(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        id: 2,
        nome: 'Other User',
        requestId: 'test-filiados-req'
      }));
    });
  });

  describe('listarFiliados', () => {
    test('should return 400 for invalid situacao_sindical filter', async () => {
      req.query = { situacao_sindical: 'valor_invalido' };
      await controller.listarFiliados(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: 'situacao_sindical inválida.'
      }));
    });
  });

  describe('atualizarFiliado', () => {
    test('should block FILIADO profile from updating situacao_sindical', async () => {
      req.user = { id: 22, perfil_acesso: 'FILIADO' };
      req.params.id = '10';
      req.body = { situacao_sindical: 'NAO_FILIADO' };

      await controller.atualizarFiliado(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });
  });
});
