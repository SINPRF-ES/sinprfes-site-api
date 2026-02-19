// src/controllers/filiados_me.controller.test.js
const controller = require('./filiados.controller');
const service = require('../services/filiados.service');

jest.mock('../services/filiados.service');
jest.mock('../utils/log');

describe('Filiados Controller - atualizarMeusDados', () => {
  let req, res;

  beforeEach(() => {
    req = {
      user: { id: 10, perfil_acesso: 'FILIADO' },
      body: {},
      requestId: 'req-me-test'
    };
    res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis()
    };
    jest.clearAllMocks();
  });

  test('deve realizar update parcial (apenas campos enviados no body)', async () => {
    req.body = {
      telefone1: '(27) 99999-1234'
    };
    service.atualizarDadosProprios.mockResolvedValue({ id: 10 });

    await controller.atualizarMeusDados(req, res);

    // Deve conter apenas telefone1 e NADA MAIS (exceto talvez campos dependentes se processados, mas aqui não foram)
    const payloadSent = service.atualizarDadosProprios.mock.calls[0][1];
    expect(payloadSent).toEqual({
      telefone1: '27999991234'
    });
    expect(payloadSent.cep).toBeUndefined();
    expect(payloadSent.email1).toBeUndefined();
  });

  test('deve bloquear campos proibidos com 400', async () => {
    req.body = {
      perfil_acesso: 'ADMIN',
      telefone1: '123',
      email1: 'test@test.com',
      logradouro_bairro: 'Rua A',
      numero: '123',
      cidade: 'Vitoria',
      uf: 'ES',
      cep: '29000000'
    };

    await controller.atualizarMeusDados(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: "FORBIDDEN_FIELD"
    }));
    expect(service.atualizarDadosProprios).not.toHaveBeenCalled();
  });

  test('deve retornar 422 para campos inválidos com objeto fields', async () => {
    req.body = {
      email1: 'e-mail-invalido',
      cep: '123'
    };

    await controller.atualizarMeusDados(req, res);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: "VALIDATION_ERROR",
      fields: expect.objectContaining({
        email1: "E-mail inválido",
        cep: "Deve ter 8 dígitos"
      })
    }));
  });

  test('não deve vazar erro detalhado do banco (err.detail) e retornar 422/409', async () => {
    const dbError = new Error('Database error');
    dbError.code = '23505';
    dbError.detail = 'Failing row contains (sensitive data)';

    req.body = { telefone1: '123' };
    service.atualizarDadosProprios.mockRejectedValue(dbError);

    await controller.atualizarMeusDados(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    const responseBody = res.json.mock.calls[0][0];
    expect(responseBody.message).not.toContain('Failing row contains');
    expect(responseBody.message).toContain('já constam em nosso sistema');
  });

  test('deve omitir mensagem se err.message contiver Failing row (vazamento)', async () => {
    const dbError = new Error('Erro grave: Failing row contains (email=hack@me.com, password=$2b$12$...)');
    // Sem código, cai no default 500

    req.body = { telefone1: '123' };
    service.atualizarDadosProprios.mockRejectedValue(dbError);

    await controller.atualizarMeusDados(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    const responseBody = res.json.mock.calls[0][0];
    expect(responseBody.message).not.toContain('Failing row contains');
    expect(responseBody.message).toBe("Erro interno ao atualizar dados.");
  });

  test('deve converter strings vazias em null e fazer trim em campos enviados', async () => {
    req.body = {
      email2: '  ',
      complemento: '  Apt 101  '
    };
    service.atualizarDadosProprios.mockResolvedValue({ id: 10 });

    await controller.atualizarMeusDados(req, res);

    expect(service.atualizarDadosProprios).toHaveBeenCalledWith(10, expect.objectContaining({
      email2: null,
      complemento: 'Apt 101'
    }));
  });
});
