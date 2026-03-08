const controller = require('./consultaProcessual.controller');
const service = require('../service/consultaProcessual.service');

jest.mock('../service/consultaProcessual.service', () => ({
  consultarPorUsuarioLogado: jest.fn(),
}));

describe('consultaProcessual.controller debug endpoint', () => {
  beforeEach(() => jest.clearAllMocks());

  test('bloqueia perfil fora de ADMIN e DIRETORIA', async () => {
    const req = { user: { id: 1, perfil_acesso: 'FUNCIONARIO' }, requestId: 'req-1', query: {} };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    await controller.consultarDebugMe(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(service.consultarPorUsuarioLogado).not.toHaveBeenCalled();
  });

  test('permite perfil DIRETORIA', async () => {
    const req = { user: { id: 1, perfil_acesso: 'DIRETORIA' }, requestId: 'req-2', query: { mode: 'personal' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    service.consultarPorUsuarioLogado.mockResolvedValue({ ok: true, sources: [], totalItems: 0 });

    await controller.consultarDebugMe(req, res);

    expect(service.consultarPorUsuarioLogado).toHaveBeenCalledWith({
      userId: 1,
      requestId: 'req-2',
      mode: 'personal',
      debug: true,
    });
    expect(res.json).toHaveBeenCalledWith({ ok: true, sources: [], totalItems: 0 });
  });
});
