const request = require('supertest');
const express = require('express');
const requestTracker = require('../middlewares/requestTracker');
const errorHandler = require('../middlewares/errorHandler');
const { normalizarCpf } = require('../utils/format');

describe('Logging and Error Handling Middleware', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use(requestTracker);

    app.get('/test-success', (req, res) => {
      res.status(200).json({ success: true, requestId: req.requestId });
    });

    app.get('/test-error', (req, res) => {
      throw new Error('Test error');
    });

    app.use(errorHandler);
  });

  test('requestTracker should add requestId and log request', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    const response = await request(app).get('/test-success');

    expect(response.status).toBe(200);
    expect(response.body.requestId).toBeDefined();
    expect(response.headers['x-request-id']).toBe(response.body.requestId);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[REQ]'));
    consoleSpy.mockRestore();
  });

  test('errorHandler should log stacktrace and return JSON', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    const response = await request(app).get('/test-error');

    expect(response.status).toBe(500);
    expect(response.body.error).toBe('INTERNAL_SERVER_ERROR');
    expect(response.body.requestId).toBeDefined();
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('[ERR]'));
    consoleErrorSpy.mockRestore();
  });
});

describe('Format Utils', () => {
  test('normalizarCpf should remove non-digits', () => {
    expect(normalizarCpf('123.456.789-00')).toBe('12345678900');
    expect(normalizarCpf('12345678900')).toBe('12345678900');
    expect(normalizarCpf('')).toBeNull();
    expect(normalizarCpf(null)).toBeNull();
  });
});
