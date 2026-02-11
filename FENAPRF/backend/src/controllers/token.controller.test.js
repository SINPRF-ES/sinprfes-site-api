// src/controllers/token.controller.test.js
const controller = require('./assembleias.controller');
const service = require('../services/assembleias.service');
const Textos = require('../utils/textos');

jest.mock('../services/assembleias.service');
jest.mock('../websocket/assembleia.socket');
jest.mock('../utils/log');

describe('Assembleias Controller - Token Generation', () => {
  let req, res;
  const validUUID = '550e8400-e29b-41d4-a716-446655440000';

  beforeEach(() => {
    req = {
      params: { id: validUUID },
      user: { id: 1, perfil_acesso: 'DIRETORIA' },
      body: { tipo_chamada: 'PRIMEIRA' },
      requestId: 'test-token-id'
    };
    res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis()
    };
    jest.clearAllMocks();
  });

  test('Should return 200 when generating token for DIRETORIA in ABERTA assembly', async () => {
    service.gerarQuorum.mockResolvedValue({
      id: 'quorum-1',
      token: '123456',
      isNew: true
    });

    await controller.gerarTokenQuorum(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      token: '123456',
      quorum_id: 'quorum-1'
    }));
  });

  test('Should return 400 for invalid UUID format', async () => {
    req.params.id = 'invalid-uuid-123';

    await controller.gerarTokenQuorum(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "ID inválido (UUID esperado)." });
  });

  test('Should return 409 when assembly is in invalid state', async () => {
    service.gerarQuorum.mockRejectedValue(new Error(Textos.ASSEMBLEIA.TRANSICAO_INVALIDA));

    await controller.gerarTokenQuorum(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.stringContaining("Não é possível gerar token")
    }));
  });

  test('Should handle idempotency (isNew: false) and return 200', async () => {
    service.gerarQuorum.mockResolvedValue({
      id: 'quorum-old',
      token: '654321',
      isNew: false
    });

    await controller.gerarTokenQuorum(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      token: '654321',
      isNew: false
    }));
  });
});
