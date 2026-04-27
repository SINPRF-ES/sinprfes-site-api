// src/controllers/filiados.controller.test.js
const controller = require('./filiados.controller');
const service = require('../services/filiados.service');
const Textos = require('../utils/textos');
const pool = require('../config/db');
const { enviarEmailBoasVindasFiliado } = require('../services/email.service');

jest.mock('../services/filiados.service');
jest.mock('../utils/log');
jest.mock('../config/db', () => ({
  query: jest.fn()
}));
jest.mock('../services/email.service', () => ({
  enviarEmailBoasVindasFiliado: jest.fn().mockResolvedValue(undefined)
}));

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
    pool.query.mockResolvedValue({ rows: [] });
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

    test('should reject uf_sindicato_externo ES for FILIADO_OUTRO_SINDICATO', async () => {
      req.user = { id: 1, perfil_acesso: 'DIRETORIA' };
      req.params.id = '10';
      req.body = { situacao_sindical: 'FILIADO_OUTRO_SINDICATO', uf_sindicato_externo: 'ES', nome: 'Teste' };
      service.buscarPorId.mockResolvedValue({ id: 10, nome: 'Teste', situacao_sindical: 'FILIADO_OUTRO_SINDICATO' });

      await controller.atualizarFiliado(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.stringContaining('não pode ser ES')
      }));
    });

    test('should clear uf_sindicato_externo when situacao_sindical is not FILIADO_OUTRO_SINDICATO', async () => {
      req.user = { id: 1, perfil_acesso: 'DIRETORIA' };
      req.params.id = '10';
      req.body = { situacao_sindical: 'NAO_FILIADO', uf_sindicato_externo: 'RJ', nome: 'Teste' };
      service.buscarPorId.mockResolvedValue({ id: 10, nome: 'Teste', situacao_sindical: 'FILIADO_OUTRO_SINDICATO' });
      service.atualizarFiliadoPorId.mockResolvedValue({ id: 10, nome: 'Teste' });

      await controller.atualizarFiliado(req, res);

      expect(service.atualizarFiliadoPorId).toHaveBeenCalledWith(10, expect.objectContaining({
        situacao_sindical: 'NAO_FILIADO',
        uf_sindicato_externo: null
      }));
    });
  });

  describe('criarFiliado', () => {
    test('should reject invalid uf_sindicato_externo', async () => {
      req.user = { id: 1, perfil_acesso: 'DIRETORIA' };
      req.body = {
        nome: 'Novo Filiado',
        situacao_sindical: 'FILIADO_OUTRO_SINDICATO',
        uf_sindicato_externo: 'XX'
      };

      await controller.criarFiliado(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: 'UF do sindicato externo inválida.'
      }));
    });

    test('should return duplicate cpf message with existing filiado name on race condition', async () => {
      req.user = { id: 1, perfil_acesso: 'DIRETORIA' };
      req.body = {
        nome: 'Novo Filiado',
        cpf: '123.456.789-00',
        email1: 'novo@email.com',
        telefone1: '27999999999',
        lotacao: 'SEDE',
        situacao_sindical: 'FILIADO_SINPRF_ES'
      };

      pool.query
        .mockResolvedValueOnce({ rows: [] }) // pre-check cpf
        .mockResolvedValueOnce({ rows: [{ nome: 'Fulano de Tal' }] }); // lookup in catch

      service.criarFiliadoInicial.mockRejectedValue({
        code: 'CPF_DUPLICADO',
        message: 'duplicate key value violates unique constraint "filiados_cpf_key"'
      });

      await controller.criarFiliado(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        message: 'CPF já cadastrado para Fulano de Tal.',
        code: 'CPF_DUPLICADO'
      }));
    });

    test('should force cpf null for NAO_FILIADO even when cpf is provided', async () => {
      req.user = { id: 1, perfil_acesso: 'DIRETORIA' };
      req.body = {
        nome: 'Sem CPF Obrigatório',
        cpf: '123.456.789-00',
        email1: 'naofiliado@email.com',
        telefone1: '27999999999',
        situacao_sindical: 'NAO_FILIADO'
      };
      service.criarFiliadoInicial.mockResolvedValue({ id: 101, nome: 'Sem CPF Obrigatório' });

      await controller.criarFiliado(req, res);

      expect(service.criarFiliadoInicial).toHaveBeenCalledWith(expect.objectContaining({
        cpf: null,
        situacao_sindical: 'NAO_FILIADO'
      }), 'DIRETORIA');
      expect(enviarEmailBoasVindasFiliado).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe('atualizarMeusDados (Regressions & Task B2)', () => {
    test('should allow gestor to update situacao_sindical and uf_sindicato_externo for themselves', async () => {
      req.user = { id: 1, perfil_acesso: 'ADMIN' };
      req.body = {
        email1: 'admin@test.com',
        situacao_sindical: 'FILIADO_OUTRO_SINDICATO',
        uf_sindicato_externo: 'RJ'
      };
      service.buscarPorId.mockResolvedValue({ id: 1, situacao_sindical: 'FILIADO_SINPRF_ES' });
      service.atualizarDadosProprios.mockResolvedValue({ id: 1 });

      await controller.atualizarMeusDados(req, res);

      expect(service.atualizarDadosProprios).toHaveBeenCalledWith(1, expect.objectContaining({
        situacao_sindical: 'FILIADO_OUTRO_SINDICATO',
        uf_sindicato_externo: 'RJ'
      }));
    });

    test('should reject ES for gestor in atualizarMeusDados', async () => {
      req.user = { id: 1, perfil_acesso: 'ADMIN' };
      req.body = {
        email1: 'admin@test.com',
        situacao_sindical: 'FILIADO_OUTRO_SINDICATO',
        uf_sindicato_externo: 'ES'
      };
      service.buscarPorId.mockResolvedValue({ id: 1, situacao_sindical: 'FILIADO_SINPRF_ES' });

      await controller.atualizarMeusDados(req, res);

      expect(res.status).toHaveBeenCalledWith(422);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: "VALIDATION_ERROR"
      }));
    });

    test('should NOT clear uf_sindicato_externo if not provided and situation remains FILIADO_OUTRO_SINDICATO', async () => {
      req.user = { id: 1, perfil_acesso: 'ADMIN' };
      req.body = { email1: 'admin@test.com' }; // uf_sindicato_externo is undefined
      service.buscarPorId.mockResolvedValue({
        id: 1,
        situacao_sindical: 'FILIADO_OUTRO_SINDICATO',
        uf_sindicato_externo: 'MG'
      });
      service.atualizarDadosProprios.mockResolvedValue({ id: 1 });

      await controller.atualizarMeusDados(req, res);

      // Should NOT be in the payload sent to service if undefined in controller body
      const callArgs = service.atualizarDadosProprios.mock.calls[0][1];
      expect(callArgs.uf_sindicato_externo).toBeUndefined();
    });

    test('should clear uf_sindicato_externo if situation changes from FILIADO_OUTRO_SINDICATO', async () => {
      req.user = { id: 1, perfil_acesso: 'ADMIN' };
      req.body = {
        email1: 'admin@test.com',
        situacao_sindical: 'FILIADO_SINPRF_ES'
      };
      service.buscarPorId.mockResolvedValue({
        id: 1,
        nome: 'Admin User',
        cpf: '12345678901',
        telefone1: '27999999999',
        lotacao: 'SEDE',
        situacao_sindical: 'FILIADO_OUTRO_SINDICATO',
        uf_sindicato_externo: 'MG'
      });
      service.atualizarDadosProprios.mockResolvedValue({ id: 1 });

      await controller.atualizarMeusDados(req, res);

      expect(service.atualizarDadosProprios).toHaveBeenCalledWith(1, expect.objectContaining({
        situacao_sindical: 'FILIADO_SINPRF_ES',
        uf_sindicato_externo: null
      }));
    });
  });

  describe('atualizarFiliado Persistence Bug', () => {
    test('should NOT clear uf_sindicato_externo if not in body and situation remains same', async () => {
      req.user = { id: 1, perfil_acesso: 'DIRETORIA' };
      req.params.id = '10';
      req.body = { nome: 'Novo Nome' }; // uf_sindicato_externo is undefined
      service.buscarPorId.mockResolvedValue({
        id: 10,
        nome: 'Teste',
        situacao_sindical: 'FILIADO_OUTRO_SINDICATO',
        uf_sindicato_externo: 'RJ'
      });
      service.atualizarFiliadoPorId.mockResolvedValue({ id: 10 });

      await controller.atualizarFiliado(req, res);

      const callArgs = service.atualizarFiliadoPorId.mock.calls[0][1];
      expect(callArgs.uf_sindicato_externo).toBeUndefined();
    });
  });
});
