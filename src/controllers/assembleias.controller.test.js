// src/controllers/assembleias.controller.test.js
const controller = require('./assembleias.controller');
const service = require('../services/assembleias.service');
const filiadosService = require('../services/filiados.service');
const pdfService = require('../services/pdf.service');
const emailService = require('../services/email.service');
const Textos = require('../utils/textos');

jest.mock('../services/assembleias.service');
jest.mock('../services/filiados.service');
jest.mock('../services/pdf.service');
jest.mock('../services/email.service');
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

  test('votar should auto-close votation if everyone has voted', async () => {
    req.params = { id: 'ass1', vid: 'v1' };
    req.body = { voto: 'SIM' };

    service.buscarVotacaoAtiva.mockResolvedValue({ id: 'v1', encerra_em: new Date(Date.now() + 10000).toISOString() });
    service.verificarElegibilidade.mockResolvedValue(true);
    service.registrarVoto.mockResolvedValue({});
    service.contarVotos.mockResolvedValue({ total: 10, SIM: 6, NAO: 4 });
    service.listarVotosNominais.mockResolvedValue([]);
    service.buscarUltimoQuorum.mockResolvedValue({ id: 'q1' });
    service.contarPresentesNoQuorum.mockResolvedValue(10); // Matches contagem.total
    service.finalizarVotacao.mockResolvedValue({ id: 'v1', status: 'ENCERRADA' });

    await controller.votar(req, res);

    expect(service.finalizarVotacao).toHaveBeenCalledWith('v1');
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  describe('gerarRelatorio', () => {
    test('should return 403 for COMUNICADOR profile', async () => {
      req.user.perfil_acesso = 'COMUNICADOR';
      service.buscarPorId.mockResolvedValue({ id: '1' });

      await controller.gerarRelatorio(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Seu perfil não possui permissão para gerar relatórios.'
      }));
    });

    test('should allow FILIADO profile and return success', async () => {
      req.user.perfil_acesso = 'FILIADO';
      service.buscarPorId.mockResolvedValue({ id: '1' });
      service.gerarDadosRelatorio.mockResolvedValue({ assembleia: { id: '1' } });
      filiadosService.buscarPorId.mockResolvedValue({ id: 1, nome: 'Test', email1: 'test@example.com' });
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
