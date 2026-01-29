// src/controllers/pushCampaign.controller.test.js
const controller = require('./pushCampaign.controller');
const pushCampaignService = require('../services/pushCampaign.service');

jest.mock('../services/pushCampaign.service');
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

    test('should return 400 if body is missing', async () => {
      req.body = { title: 'Test' };

      await controller.sendCampaign(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, error: 'O corpo da mensagem (body) é obrigatório.' }));
    });

    test('should return 500 on service failure', async () => {
      req.body = { body: 'Message' };
      pushCampaignService.sendCampaign.mockRejectedValue(new Error('DB Error'));

      await controller.sendCampaign(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, errorId: expect.any(String) }));
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
