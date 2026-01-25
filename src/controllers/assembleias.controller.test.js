// src/controllers/assembleias.controller.test.js
const controller = require('./assembleias.controller');
const service = require('../services/assembleias.service');
const Textos = require('../utils/textos');

jest.mock('../services/assembleias.service');
jest.mock('../websocket/assembleia.socket');

describe('Assembleias Controller', () => {
  let req, res;

  beforeEach(() => {
    req = {
      params: { id: '1' },
      user: { id: 1, perfil_acesso: 'DIRETORIA' },
      body: {},
      requestId: 'test-id'
    };
    res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis()
    };
  });

  test('abrir should return 409 on invalid transition', async () => {
    service.abrir.mockRejectedValue(new Error(`${Textos.ASSEMBLEIA.TRANSICAO_INVALIDA} (ABERTA -> ABERTA)`));

    await controller.abrir(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: `${Textos.ASSEMBLEIA.TRANSICAO_INVALIDA} (ABERTA -> ABERTA)` });
  });

  test('iniciarExecucao should return 422 on business rule failure (e.g. mesa missing)', async () => {
    service.iniciarExecucao.mockRejectedValue(new Error(Textos.ASSEMBLEIA.MESA_NAO_DEFINIDA));

    await controller.iniciarExecucao(req, res);

    expect(res.status).toHaveBeenCalledWith(422);
  });

  test('listar should return 200 for ADMIN profile', async () => {
    req.user.perfil_acesso = 'ADMIN';
    service.listar.mockResolvedValue([{ id: 'ass-1' }]);

    await controller.listar(req, res);

    expect(res.json).toHaveBeenCalledWith([{ id: 'ass-1' }]);
  });
});
