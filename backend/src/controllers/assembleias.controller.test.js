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

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_VOTACAO_UUID = '550e8400-e29b-41d4-a716-446655440001';

describe('Assembleias Controller', () => {
  let req, res;

  beforeEach(() => {
    req = {
      params: { id: VALID_UUID },
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
    service.listar.mockResolvedValue([{ id: VALID_UUID }]);

    await controller.listar(req, res);

    expect(res.json).toHaveBeenCalledWith([{ id: VALID_UUID }]);
  });

  test('votar should auto-close votation if everyone has voted', async () => {
    req.params = { id: VALID_UUID, vid: VALID_VOTACAO_UUID };
    req.body = { voto: 'SIM' };

    service.buscarVotacaoAtiva.mockResolvedValue({ id: VALID_VOTACAO_UUID, encerra_em: new Date(Date.now() + 10000).toISOString() });
    service.verificarElegibilidade.mockResolvedValue(true);
    service.registrarVoto.mockResolvedValue({});
    service.contarVotos.mockResolvedValue({ total: 10, SIM: 6, NAO: 4 });
    service.listarVotosNominais.mockResolvedValue([]);
    service.buscarUltimoQuorum.mockResolvedValue({ id: 'q1' });
    service.contarPresentesNoQuorum.mockResolvedValue(10); // Matches contagem.total
    service.finalizarVotacao.mockResolvedValue({ id: VALID_VOTACAO_UUID, status: 'ENCERRADA' });

    await controller.votar(req, res);

    expect(service.finalizarVotacao).toHaveBeenCalledWith(VALID_VOTACAO_UUID);
    expect(res.json).toHaveBeenCalledWith({ success: true, requestId: 'test-id' });
  });

  describe('gerarRelatorio', () => {
    test('should return 403 for COMUNICADOR profile', async () => {
      req.user.perfil_acesso = 'COMUNICADOR';
      service.buscarPorId.mockResolvedValue({ id: VALID_UUID });

      await controller.gerarRelatorio(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Seu perfil não possui permissão para gerar relatórios.',
        requestId: 'test-id'
      }));
    });

    test('should allow FILIADO profile and return success', async () => {
      req.user.perfil_acesso = 'FILIADO';
      service.buscarPorId.mockResolvedValue({ id: VALID_UUID });
      service.gerarDadosRelatorio.mockResolvedValue({ assembleia: { id: VALID_UUID } });
      filiadosService.buscarPorId.mockResolvedValue({ id: 1, nome: 'Test', email1: 'test@example.com' });
      pdfService.gerarPdfRelatorioAssembleia.mockResolvedValue(Buffer.from('pdf'));
      emailService.enviarEmailRelatorioAssembleia.mockResolvedValue({});

      await controller.gerarRelatorio(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        message: 'O relatório foi gerado e enviado para seu e-mail com sucesso.',
        requestId: 'test-id'
      }));
    });
  });
});
