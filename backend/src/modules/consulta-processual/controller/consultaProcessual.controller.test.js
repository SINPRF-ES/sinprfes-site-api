const controller = require('./consultaProcessual.controller');
const service = require('../service/consultaProcessual.service');
const { getConsultaProcessualConfig } = require('../utils/consultaProcessualConfig');

jest.mock('../service/consultaProcessual.service', () => ({
  consultarPorUsuarioLogado: jest.fn(),
}));

jest.mock('../utils/consultaProcessualConfig', () => ({
  getConsultaProcessualConfig: jest.fn(() => ({ institutionalPublicVisible: false })),
}));

describe('consultaProcessual.controller debug endpoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getConsultaProcessualConfig.mockReturnValue({ institutionalPublicVisible: false });
  });

  test('bloqueia perfil fora de ADMIN e DIRETORIA', async () => {
    const req = { user: { id: 1, perfil_acesso: 'FUNCIONARIO' }, requestId: 'req-1', query: {} };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    await controller.consultarDebugMe(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(service.consultarPorUsuarioLogado).not.toHaveBeenCalled();
  });

  test('permite perfil DIRETORIA', async () => {
    const req = { user: { id: 1, perfil_acesso: 'DIRETORIA' }, requestId: 'req-2', query: {} };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    service.consultarPorUsuarioLogado.mockResolvedValue({ ok: true, sources: [], totalItems: 0 });

    await controller.consultarDebugMe(req, res);

    expect(service.consultarPorUsuarioLogado).toHaveBeenCalledWith({
      userId: 1,
      requestId: 'req-2',
      debug: true,
      mode: 'personal',
    });
    expect(res.json).toHaveBeenCalledWith({ ok: true, sources: [], totalItems: 0 });
  });


  test('bloqueia mode institutional quando visibilidade pública está desativada', async () => {
    const req = { user: { id: 1, perfil_acesso: 'FUNCIONARIO' }, requestId: 'req-4', query: { mode: 'institutional' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    await controller.consultarMe(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(service.consultarPorUsuarioLogado).not.toHaveBeenCalled();
  });

  test('permite mode institutional para todos quando visibilidade pública está ativada', async () => {
    getConsultaProcessualConfig.mockReturnValue({ institutionalPublicVisible: true });
    const req = { user: { id: 1, perfil_acesso: 'FUNCIONARIO' }, requestId: 'req-5', query: { mode: 'institutional' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    service.consultarPorUsuarioLogado.mockResolvedValue({ ok: true, sources: [], totalItems: 0 });

    await controller.consultarMe(req, res);

    expect(service.consultarPorUsuarioLogado).toHaveBeenCalledWith({
      userId: 1,
      requestId: 'req-5',
      debug: false,
      mode: 'institutional',
    });
  });

  test('encaminha mode institutional quando presente na query', async () => {
    const req = { user: { id: 1, perfil_acesso: 'DIRETORIA' }, requestId: 'req-3', query: { mode: 'institutional' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    service.consultarPorUsuarioLogado.mockResolvedValue({ ok: true, sources: [], totalItems: 0 });

    await controller.consultarMe(req, res);

    expect(service.consultarPorUsuarioLogado).toHaveBeenCalledWith({
      userId: 1,
      requestId: 'req-3',
      debug: false,
      mode: 'institutional',
    });
  });
});
