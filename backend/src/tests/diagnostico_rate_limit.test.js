const express = require('express');
const request = require('supertest');
const { diagnosticLimiter } = require('../middlewares/assembleiaRateLimit');

describe('Diagnostic Rate Limiter', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.set('trust proxy', 1);
    app.use(express.json());

    app.post('/api/diagnostico/log',
      diagnosticLimiter,
      (req, res) => {
        res.status(200).json({ success: true });
      }
    );
  });

  test('deve bloquear a 6ª requisição ao log de diagnóstico', async () => {
    // 5 requisições permitidas (conforme definido em diagnosticLimiter: max: 5)
    for (let i = 0; i < 5; i++) {
      const res = await request(app).post('/api/diagnostico/log');
      expect(res.status).toBe(200);
    }

    // 6ª requisição deve ser bloqueada
    const resBlocked = await request(app).post('/api/diagnostico/log');
    expect(resBlocked.status).toBe(429);
    expect(resBlocked.body.error).toBe('Muitas solicitações de diagnóstico. Por favor, aguarde um minuto.');
  });
});
