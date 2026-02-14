// src/controllers/assembleias.controller.test.js
const controller = require('./assembleias.controller');
const service = require('../services/assembleias.service');
const usersService = require('../services/users.service');
const pdfService = require('../services/pdf.service');
const emailService = require('../services/email.service');
const Textos = require('../utils/textos');

jest.mock('../services/assembleias.service');
jest.mock('../services/users.service');
jest.mock('../services/pdf.service');
jest.mock('../services/email.service');
jest.mock('../websocket/assembleia.socket');

describe('Assembleias Controller', () => {
  let req, res;

  beforeEach(() => {
    req = {
      params: { id: '550e8400-e29b-41d4-a716-446655440000' },
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
    expect(res.json).toHaveBeenCalledWith({ error: `${Textos.ASSEMBLEIA.TRANSICAO_INVALIDA} (ABERTA -> ABERTA)`, requestId: 'test-id' });
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

  test('votar should auto-close votation if everyone has voted', async () => {
    const vid = '550e8400-e29b-41d4-a716-446655440001';
    req.params = { id: '550e8400-e29b-41d4-a716-446655440000', vid };
    req.body = { voto: 'SIM' };

    service.buscarVotacaoAtiva.mockResolvedValue({ id: vid, encerra_em: new Date(Date.now() + 10000).toISOString() });
    service.verificarElegibilidade.mockResolvedValue(true);
    service.registrarVoto.mockResolvedValue({});
    service.contarVotos.mockResolvedValue({ total: 10, SIM: 6, NAO: 4 });
    service.listarVotosNominais.mockResolvedValue([]);
    service.contarElegiveisNaVotacao.mockResolvedValue(10); // Matches contagem.total
    service.finalizarVotacao.mockResolvedValue({ id: 'v1', status: 'ENCERRADA' });

    await controller.votar(req, res);

    expect(service.finalizarVotacao).toHaveBeenCalledWith(vid);
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  describe('gerarRelatorio', () => {
    test('should return 403 for COMUNICADOR profile', async () => {
      req.user.perfil_acesso = 'COMUNICADOR';
      service.buscarPorId.mockResolvedValue({ id: '1', estado: 'ENCERRADO' });

      await controller.gerarRelatorio(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Seu perfil não possui permissão para gerar relatórios.'
      }));
    });

    test('should allow USER profile and return success', async () => {
      req.user.perfil_acesso = 'USER';
      service.buscarPorId.mockResolvedValue({ id: '1', estado: 'ENCERRADO' });
      service.gerarDadosRelatorio.mockResolvedValue({ assembleia: { id: '1' } });
      usersService.buscarPorId.mockResolvedValue({ id: 1, nome: 'Test', email1: 'test@example.com' });
      pdfService.gerarPdfRelatorioAssembleia.mockResolvedValue(Buffer.from('pdf'));
      emailService.enviarEmailRelatorioAssembleia.mockResolvedValue({});

      await controller.gerarRelatorio(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        message: 'O relatório foi gerado e enviado para seu e-mail com sucesso.'
      }));
    });
  });
});
