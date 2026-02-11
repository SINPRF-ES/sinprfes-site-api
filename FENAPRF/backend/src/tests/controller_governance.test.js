// src/tests/controller_governance.test.js
const controller = require('../controllers/assembleias.controller');
const service = require('../services/assembleias.service');
const Textos = require('../utils/textos');

jest.mock('../services/assembleias.service');
jest.mock('../websocket/assembleia.socket');
jest.mock('../utils/log');

describe('Controller Governance Rules', () => {
  let req, res;

  beforeEach(() => {
    req = {
      params: { id: 'a9bbd71b-5c5d-47cf-b35e-fc781e368b41' },
      user: { id: 1, perfil_acesso: 'DIRETORIA' },
      body: {},
      requestId: 'test-req'
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
  });

  describe('President Authority on Tokens', () => {
    test('gerarTokenQuorum should allow DIRETORIA if no mesa established', async () => {
      service.buscarMesa.mockResolvedValue(null);
      service.gerarQuorum.mockResolvedValue({ id: 'q1', token: '123456', isNew: true });
      service.buscarEstadoCompleto.mockResolvedValue({});

      req.body = { tipo_chamada: 'PRIMEIRA' };
      await controller.gerarTokenQuorum(req, res);

      expect(res.json).toHaveBeenCalled();
    });

    test('gerarTokenQuorum should block non-President if mesa established', async () => {
      service.buscarMesa.mockResolvedValue({ presidente_user_id: 10, estabelecida_em: new Date() });

      req.user.id = 1; // Not the president (10)
      req.user.perfil_acesso = 'USER'; // Not Diretoria
      req.body = { tipo_chamada: 'PRIMEIRA' };
      await controller.gerarTokenQuorum(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: Textos.ASSEMBLEIA.APENAS_PRESIDENTE, requestId: 'test-req' });
    });

    test('gerarTokenQuorum should allow President if mesa established', async () => {
      service.buscarMesa.mockResolvedValue({ presidente_user_id: 1, estabelecida_em: new Date() });
      service.gerarQuorum.mockResolvedValue({ id: 'q1', token: '123456', isNew: true });
      service.buscarEstadoCompleto.mockResolvedValue({});

      req.user.id = 1; // Is the president
      req.body = { tipo_chamada: 'PRIMEIRA' };
      await controller.gerarTokenQuorum(req, res);

      expect(res.json).toHaveBeenCalled();
    });
  });

  describe('Mesa Substitution', () => {
    test('substituirMesa should return 400 if justification missing', async () => {
        req.body = { presidente_user_id: 2, secretario_user_id: 3 }; // No justificativa
        await controller.substituirMesa(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
    });
  });
});
