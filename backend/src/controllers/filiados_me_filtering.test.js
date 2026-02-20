// src/controllers/filiados_me_filtering.test.js
const controller = require('./filiados.controller');
const service = require('../services/filiados.service');

jest.mock('../services/filiados.service');
jest.mock('../utils/log');

describe('Filiados Controller - atualizarMeusDados (Filtering)', () => {
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

  test('FILIADO deve alterar telefone1 com sucesso', async () => {
    req.body = {
      telefone1: '(27) 99999-1234'
    };
    service.atualizarDadosProprios.mockResolvedValue({ id: 10 });

    await controller.atualizarMeusDados(req, res);

    expect(service.atualizarDadosProprios).toHaveBeenCalledWith(10, expect.objectContaining({
      telefone1: '27999991234'
    }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  test('FILIADO deve alterar lotacao com sucesso', async () => {
    req.body = {
      lotacao: 'DEL 01 - Viana'
    };
    service.atualizarDadosProprios.mockResolvedValue({ id: 10 });

    await controller.atualizarMeusDados(req, res);

    expect(service.atualizarDadosProprios).toHaveBeenCalledWith(10, expect.objectContaining({
      lotacao: 'DEL 01 - Viana'
    }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  test('FILIADO enviando sexo/siape: deve ignorar campos proibidos e atualizar permitidos', async () => {
    req.body = {
      telefone1: '27999998877',
      sexo: 'F',
      siape: '1234567'
    };
    service.atualizarDadosProprios.mockResolvedValue({ id: 10 });

    await controller.atualizarMeusDados(req, res);

    const payloadSent = service.atualizarDadosProprios.mock.calls[0][1];
    expect(payloadSent).toEqual({
      telefone1: '27999998877'
    });
    expect(payloadSent.sexo).toBeUndefined();
    expect(payloadSent.siape).toBeUndefined();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  test('FILIADO alterando apenas dependentes: deve funcionar', async () => {
    req.body = {
      dep1_nome: 'Filho Teste',
      dep1_cpf: '11122233344',
      dep1_parentesco: 'FILHO_ENTEADO'
    };
    service.atualizarDadosProprios.mockResolvedValue({ id: 10 });

    await controller.atualizarMeusDados(req, res);

    expect(service.atualizarDadosProprios).toHaveBeenCalledWith(10, expect.objectContaining({
      dep1_nome: 'Filho Teste',
      dep1_cpf: '11122233344',
      dep1_parentesco: 'FILHO_ENTEADO'
    }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  test('Gestão (ADMIN) deve conseguir alterar sexo e siape', async () => {
    req.user.perfil_acesso = 'ADMIN';
    req.body = {
      sexo: 'M',
      siape: '7654321'
    };
    service.atualizarDadosProprios.mockResolvedValue({ id: 10 });

    await controller.atualizarMeusDados(req, res);

    const payloadSent = service.atualizarDadosProprios.mock.calls[0][1];
    expect(payloadSent.sexo).toBe('M');
    expect(payloadSent.siape).toBe('7654321');
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });
});
