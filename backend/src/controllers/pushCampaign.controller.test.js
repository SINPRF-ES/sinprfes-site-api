// src/controllers/pushCampaign.controller.test.js
const controller = require('./pushCampaign.controller');
const pushCampaignService = require('../services/pushCampaign.service');
const pushService = require('../services/push.service');

jest.mock('../services/pushCampaign.service');
jest.mock('../services/push.service');
jest.mock('../utils/log');

describe('Push Campaign Controller', () => {
  let req, res;

  beforeEach(() => {
    req = {
      body: {},
      user: { id: 1, perfil_acesso: 'DIRETORIA' },
      requestId: 'test-request-id'
    };
    res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis()
    };
  });

  describe('sendCampaign', () => {
    test('should return 200 and result on success', async () => {
      req.body = { title: 'Test', body: 'Message content', targetType: 'ALL' };
      pushCampaignService.sendCampaign.mockResolvedValue({ success: true, sent: 5, campaignId: 'uuid' });

      await controller.sendCampaign(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, sent: 5 }));
    });

    test('should return 200 and sent=0 if no tokens are found', async () => {
        req.body = { title: 'Test', body: 'Message content', targetType: 'ALL' };
        pushCampaignService.sendCampaign.mockResolvedValue({ success: true, sent: 0, campaignId: 'uuid' });

        await controller.sendCampaign(req, res);

        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, sent: 0 }));
    });

    test('should return 400 if body is missing', async () => {
      req.body = { title: 'Test' };

      await controller.sendCampaign(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        message: 'Payload inválido: title e body devem ser string não-vazia.',
        errors: expect.objectContaining({ body: 'O corpo da mensagem (body) é obrigatório.' }),
        code: 'VALIDATION_ERROR'
      }));
    });

    test('should return 400 if body is not a string', async () => {
      req.body = { title: 'Test', body: true };

      await controller.sendCampaign(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        message: 'Payload inválido: title e body devem ser string não-vazia.',
        errors: expect.objectContaining({ body: 'O corpo da mensagem (body) deve ser uma string.' }),
        code: 'VALIDATION_ERROR'
      }));
    });

    test('should return 400 if title is not a string', async () => {
      req.body = { title: 123, body: 'Valid message' };

      await controller.sendCampaign(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        message: 'Payload inválido: title e body devem ser string não-vazia.',
        errors: expect.objectContaining({ title: 'O título (title) deve ser uma string.' }),
        code: 'VALIDATION_ERROR'
      }));
    });

    test('should return 400 if title is too long', async () => {
      req.body = { title: 'a'.repeat(61), body: 'Valid message' };

      await controller.sendCampaign(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        code: 'VALIDATION_ERROR'
      }));
    });

    test('should return 400 if targetType is invalid', async () => {
      req.body = { body: 'Message', targetType: 'INVALID' };

      await controller.sendCampaign(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        code: 'VALIDATION_ERROR',
        errors: expect.objectContaining({ targetType: expect.stringContaining('Permitidos') })
      }));
    });

    test('should return 500 on service failure', async () => {
      req.body = { body: 'Message' };
      pushCampaignService.sendCampaign.mockRejectedValue(new Error('DB Error'));

      await controller.sendCampaign(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        message: 'Erro ao processar campanha de push.',
        details: 'DB Error',
        errorId: expect.any(String)
      }));
    });

    test('should return 502 on FCM credential error', async () => {
      req.body = { body: 'Message' };
      pushCampaignService.sendCampaign.mockResolvedValue({
        success: true,
        sent: 0,
        failed: 10,
        hasCredentialError: true,
        campaignId: 'uuid'
      });

      await controller.sendCampaign(req, res);

      expect(res.status).toHaveBeenCalledWith(502);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        code: 'FCM_CREDENTIALS_ERROR'
      }));
    });
  });

  describe('pushHealth', () => {
    test('should return health status', async () => {
      pushService.listActiveTokens.mockResolvedValue(['token1', 'token2']);

      await controller.pushHealth(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        checklist: expect.objectContaining({ hasTokens: true })
      }));
    });
  });

  describe('listCampaigns', () => {
    test('should return list of campaigns', async () => {
      pushCampaignService.listCampaigns.mockResolvedValue([{ id: 1, body: 'Msg' }]);

      await controller.listCampaigns(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, campaigns: expect.any(Array) }));
    });
  });
});
