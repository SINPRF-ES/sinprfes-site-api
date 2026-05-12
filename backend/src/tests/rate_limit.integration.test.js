const express = require('express');
const request = require('supertest');
const { resourceIntensiveLimiter } = require('../middlewares/securityRateLimit');

describe('Resource Intensive Rate Limiter', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());

    // Simula a ordem de middleware real: Limiter -> Auth (mock) -> Controller
    app.post('/api/test-limiter',
      resourceIntensiveLimiter,
      (req, res, next) => {
        // Mock de autenticação
        req.user = { id: 1, perfil_acesso: 'ADMIN' };
        next();
      },
      (req, res) => {
        res.status(200).json({ success: true });
      }
    );
  });

  test('deve bloquear a 6ª requisição antes de processar autenticação pesada', async () => {
    // 5 requisições permitidas
    for (let i = 0; i < 5; i++) {
      const res = await request(app).post('/api/test-limiter');
      expect(res.status).toBe(200);
    }

    // 6ª requisição deve ser bloqueada
    const resBlocked = await request(app).post('/api/test-limiter');
    expect(resBlocked.status).toBe(429);
    expect(resBlocked.body.error).toBe('Limite de solicitações intensivas atingido. Por favor, aguarde 15 minutos.');
  });
});
