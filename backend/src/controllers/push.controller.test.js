// src/controllers/push.controller.test.js
const controller = require('./push.controller');
const pushService = require('../services/push.service');

jest.mock('../services/push.service');
jest.mock('../utils/log');

describe('Push Controller', () => {
  let req, res;

  beforeEach(() => {
    req = {
      body: {},
      user: { id: 1 },
      requestId: 'test-request-id',
      method: 'POST',
      originalUrl: '/api/push/register'
    };
    res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis()
    };
  });

  describe('register', () => {
    test('should return 200 on successful registration', async () => {
      req.body = { expoPushToken: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]', platform: 'android' };
      pushService.upsertToken.mockResolvedValue({ id: 100 });

      await controller.register(req, res);

      expect(res.json).toHaveBeenCalledWith({ success: true, id: 100, requestId: 'test-request-id' });
    });

    test('should return 401 if user is not authenticated', async () => {
      req.user = null;
      req.body = { expoPushToken: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]' };

      await controller.register(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, requestId: 'test-request-id' }));
    });

    test('should return 400 if expoPushToken is missing', async () => {
      req.body = { platform: 'android' };

      await controller.register(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, requestId: 'test-request-id' }));
    });

    test('should return 400 if service throws "ExpoPushToken inválido."', async () => {
      req.body = { expoPushToken: 'invalid' };
      pushService.upsertToken.mockRejectedValue(new Error('ExpoPushToken inválido.'));

      await controller.register(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'ExpoPushToken inválido.', requestId: 'test-request-id' });
    });

    test('should return 500 on unexpected errors', async () => {
      req.body = { expoPushToken: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]' };
      pushService.upsertToken.mockRejectedValue(new Error('Database explosion'));

      await controller.register(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: 'Erro ao registrar push token.',
        errorId: expect.any(String),
        requestId: 'test-request-id'
      }));
    });
  });

  describe('unregister', () => {
    test('should return 200 on successful unregistration', async () => {
      req.body = { expoPushToken: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]' };
      pushService.revokeToken.mockResolvedValue(true);

      await controller.unregister(req, res);

      expect(res.json).toHaveBeenCalledWith({ success: true, requestId: 'test-request-id' });
    });
  });
});
