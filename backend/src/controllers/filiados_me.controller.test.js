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

  test('deve normalizar telefone e CEP removendo não-dígitos', async () => {
    req.body = {
      telefone1: '(27) 99999-1234',
      cep: '29.100-000'
    };
    service.atualizarDadosProprios.mockResolvedValue({ id: 10 });

    await controller.atualizarMeusDados(req, res);

    expect(service.atualizarDadosProprios).toHaveBeenCalledWith(10, expect.objectContaining({
      telefone1: '27999991234',
      cep: '29100000'
    }));
  });

  test('deve converter strings vazias em null e fazer trim', async () => {
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

  test('não deve vazar erro detalhado do banco (err.detail)', async () => {
    const dbError = new Error('Database error');
    dbError.code = '23505';
    dbError.detail = 'Failing row contains (sensitive data)';

    service.atualizarDadosProprios.mockRejectedValue(dbError);

    await controller.atualizarMeusDados(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    const responseBody = res.json.mock.calls[0][0];
    expect(responseBody.message).not.toContain('Failing row contains');
    expect(responseBody.message).toContain('já constam em nosso sistema');
  });

  test('não deve permitir atualização de perfil_acesso via rota /me', async () => {
    req.body = {
      perfil_acesso: 'ADMIN',
      telefone1: '123'
    };
    service.atualizarDadosProprios.mockResolvedValue({ id: 10 });

    await controller.atualizarMeusDados(req, res);

    const payloadSentToService = service.atualizarDadosProprios.mock.calls[0][1];
    expect(payloadSentToService.perfil_acesso).toBeUndefined();
  });
});
